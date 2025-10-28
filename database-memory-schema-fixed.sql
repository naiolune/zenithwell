-- Enhanced Database Schema for Memory & Session Types (FIXED)
-- This file contains the additional tables and functions needed for the enhanced AI system
-- Updated to use correct table names from the existing schema

-- Add session_type column to existing therapy_sessions table
ALTER TABLE public.therapy_sessions 
ADD COLUMN IF NOT EXISTS session_type VARCHAR(20) DEFAULT 'individual' 
CHECK (session_type IN ('individual', 'relationship', 'family', 'general'));

-- Create user_goals table for storing user wellness goals
CREATE TABLE IF NOT EXISTS public.user_goals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    goal_text TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'achieved', 'paused')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    achieved_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_memory table for storing AI memory about users
CREATE TABLE IF NOT EXISTS public.user_memory (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    memory_key VARCHAR(255) NOT NULL,
    memory_value TEXT NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('goals', 'preferences', 'background', 'progress', 'custom')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient memory retrieval
CREATE INDEX IF NOT EXISTS idx_user_goals_user_id ON public.user_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_user_goals_status ON public.user_goals(status);
CREATE INDEX IF NOT EXISTS idx_user_memory_user_id ON public.user_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_user_memory_category ON public.user_memory(category);
CREATE INDEX IF NOT EXISTS idx_user_memory_active ON public.user_memory(is_active);
CREATE INDEX IF NOT EXISTS idx_therapy_sessions_type ON public.therapy_sessions(session_type);

-- RLS Policies for user_goals
ALTER TABLE public.user_goals ENABLE ROW LEVEL SECURITY;

-- Users can only access their own goals
CREATE POLICY "Users can view their own goals" ON public.user_goals
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own goals" ON public.user_goals
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own goals" ON public.user_goals
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own goals" ON public.user_goals
    FOR DELETE USING (auth.uid() = user_id);

-- Admins can manage all goals
CREATE POLICY "Admins can manage all goals" ON public.user_goals
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE user_id = auth.uid() AND is_admin = true
        )
    );

-- RLS Policies for user_memory
ALTER TABLE public.user_memory ENABLE ROW LEVEL SECURITY;

-- Users can only access their own memory
CREATE POLICY "Users can view their own memory" ON public.user_memory
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own memory" ON public.user_memory
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own memory" ON public.user_memory
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own memory" ON public.user_memory
    FOR DELETE USING (auth.uid() = user_id);

-- Admins can manage all memory
CREATE POLICY "Admins can manage all memory" ON public.user_memory
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE user_id = auth.uid() AND is_admin = true
        )
    );

-- Service role can manage all data (for server-side operations)
CREATE POLICY "Service role can manage all goals" ON public.user_goals
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage all memory" ON public.user_memory
    FOR ALL USING (auth.role() = 'service_role');

-- Database Functions for Memory Management

-- Get formatted memory context for AI (server calls this)
CREATE OR REPLACE FUNCTION get_user_memory_context(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  memory_text TEXT;
BEGIN
  SELECT string_agg(
    format('- %s: %s', memory_key, memory_value), 
    E'\n'
  )
  INTO memory_text
  FROM user_memory
  WHERE user_id = p_user_id AND is_active = true
  ORDER BY created_at DESC;
  
  RETURN COALESCE(memory_text, 'No previous memory available');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if first session for user (FIXED - uses therapy_sessions table)
CREATE OR REPLACE FUNCTION is_first_session(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM therapy_sessions 
    WHERE user_id = p_user_id 
    AND created_at < NOW() - INTERVAL '5 minutes'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-store goal (called by server after AI conversation)
CREATE OR REPLACE FUNCTION store_user_goal(p_user_id UUID, p_goal_text TEXT)
RETURNS UUID AS $$
DECLARE
  goal_id UUID;
BEGIN
  INSERT INTO user_goals (user_id, goal_text, status)
  VALUES (p_user_id, p_goal_text, 'active')
  RETURNING id INTO goal_id;
  
  RETURN goal_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user's active goals
CREATE OR REPLACE FUNCTION get_user_goals(p_user_id UUID, p_status VARCHAR DEFAULT 'active')
RETURNS TABLE (
    id UUID,
    goal_text TEXT,
    status VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE,
    achieved_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT g.id, g.goal_text, g.status, g.created_at, g.achieved_at
  FROM user_goals g
  WHERE g.user_id = p_user_id 
  AND (p_status = 'all' OR g.status = p_status)
  ORDER BY g.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user memory by category
CREATE OR REPLACE FUNCTION get_user_memory_by_category(p_user_id UUID, p_category VARCHAR DEFAULT NULL)
RETURNS TABLE (
    id UUID,
    memory_key VARCHAR,
    memory_value TEXT,
    category VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT m.id, m.memory_key, m.memory_value, m.category, m.created_at
  FROM user_memory m
  WHERE m.user_id = p_user_id 
  AND m.is_active = true
  AND (p_category IS NULL OR m.category = p_category)
  ORDER BY m.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Search user memory
CREATE OR REPLACE FUNCTION search_user_memory(p_user_id UUID, p_query TEXT)
RETURNS TABLE (
    id UUID,
    memory_key VARCHAR,
    memory_value TEXT,
    category VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT m.id, m.memory_key, m.memory_value, m.category, m.created_at
  FROM user_memory m
  WHERE m.user_id = p_user_id 
  AND m.is_active = true
  AND (
    m.memory_key ILIKE '%' || p_query || '%' 
    OR m.memory_value ILIKE '%' || p_query || '%'
  )
  ORDER BY m.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_user_memory_context(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION is_first_session(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION store_user_goal(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_user_goals(UUID, VARCHAR) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_user_memory_by_category(UUID, VARCHAR) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION search_user_memory(UUID, TEXT) TO authenticated, service_role;
