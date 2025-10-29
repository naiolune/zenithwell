-- Migration script to add introduction session support
-- Run this in your Supabase SQL editor

-- Add session_type column to therapy_sessions table
ALTER TABLE public.therapy_sessions 
ADD COLUMN IF NOT EXISTS session_type TEXT DEFAULT 'regular' 
CHECK (session_type IN ('regular', 'introduction'));

-- Create user_goals table
CREATE TABLE IF NOT EXISTS public.user_goals (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(user_id) ON DELETE CASCADE NOT NULL,
  goal_text TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'achieved', 'paused')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  achieved_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for user_goals
CREATE INDEX IF NOT EXISTS idx_user_goals_user_id ON public.user_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_user_goals_status ON public.user_goals(status);

-- Enable RLS on user_goals
ALTER TABLE public.user_goals ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_goals
CREATE POLICY IF NOT EXISTS "Users can view own goals" ON public.user_goals
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can create own goals" ON public.user_goals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can update own goals" ON public.user_goals
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can delete own goals" ON public.user_goals
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Service role can manage goals" ON public.user_goals
  FOR ALL USING (auth.role() = 'service_role');