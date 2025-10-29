-- Group Session Enhancements Database Schema
-- This file contains the database changes needed for enhanced group sessions

-- Add group_category column to therapy_sessions table
ALTER TABLE public.therapy_sessions 
ADD COLUMN IF NOT EXISTS group_category VARCHAR(20) 
CHECK (group_category IN ('relationship', 'family', 'general'));

-- Add session_status column to therapy_sessions table
ALTER TABLE public.therapy_sessions 
ADD COLUMN IF NOT EXISTS session_status VARCHAR(20) DEFAULT 'waiting' 
CHECK (session_status IN ('waiting', 'active', 'paused', 'ended'));

-- Create participant_introductions table
CREATE TABLE IF NOT EXISTS public.participant_introductions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES public.therapy_sessions(session_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    group_category VARCHAR(20) NOT NULL CHECK (group_category IN ('relationship', 'family', 'general')),
    
    -- Relationship session fields
    relationship_role VARCHAR(100),
    why_wellness TEXT,
    goals TEXT,
    challenges TEXT,
    
    -- Family session fields
    family_role VARCHAR(100),
    family_goals TEXT,
    what_to_achieve TEXT,
    
    -- General session fields
    participant_role VARCHAR(100),
    wellness_reason TEXT,
    personal_goals TEXT,
    expectations TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure only one introduction per user per session
    UNIQUE(session_id, user_id)
);

-- Create participant_presence table for heartbeat tracking
CREATE TABLE IF NOT EXISTS public.participant_presence (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES public.therapy_sessions(session_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    last_heartbeat TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_online BOOLEAN DEFAULT true,
    
    -- Ensure only one presence record per user per session
    UNIQUE(session_id, user_id)
);

-- Create session_invites table
CREATE TABLE IF NOT EXISTS public.session_invites (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES public.therapy_sessions(session_id) ON DELETE CASCADE,
    invite_code VARCHAR(32) NOT NULL UNIQUE,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    max_participants INTEGER DEFAULT 8,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add is_ready column to session_participants table
ALTER TABLE public.session_participants 
ADD COLUMN IF NOT EXISTS is_ready BOOLEAN DEFAULT false;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_participant_introductions_session_id ON public.participant_introductions(session_id);
CREATE INDEX IF NOT EXISTS idx_participant_introductions_user_id ON public.participant_introductions(user_id);
CREATE INDEX IF NOT EXISTS idx_participant_introductions_category ON public.participant_introductions(group_category);

CREATE INDEX IF NOT EXISTS idx_participant_presence_session_id ON public.participant_presence(session_id);
CREATE INDEX IF NOT EXISTS idx_participant_presence_user_id ON public.participant_presence(user_id);
CREATE INDEX IF NOT EXISTS idx_participant_presence_heartbeat ON public.participant_presence(last_heartbeat);
CREATE INDEX IF NOT EXISTS idx_participant_presence_online ON public.participant_presence(is_online);

CREATE INDEX IF NOT EXISTS idx_session_invites_code ON public.session_invites(invite_code);
CREATE INDEX IF NOT EXISTS idx_session_invites_session_id ON public.session_invites(session_id);
CREATE INDEX IF NOT EXISTS idx_session_invites_expires ON public.session_invites(expires_at);
CREATE INDEX IF NOT EXISTS idx_session_invites_active ON public.session_invites(is_active);

CREATE INDEX IF NOT EXISTS idx_therapy_sessions_group_category ON public.therapy_sessions(group_category);
CREATE INDEX IF NOT EXISTS idx_therapy_sessions_status ON public.therapy_sessions(session_status);

-- RLS Policies for participant_introductions
ALTER TABLE public.participant_introductions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view introductions for their sessions" ON public.participant_introductions
    FOR SELECT USING (
        session_id IN (
            SELECT session_id FROM public.session_participants 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert their own introductions" ON public.participant_introductions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own introductions" ON public.participant_introductions
    FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for participant_presence
ALTER TABLE public.participant_presence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view presence for their sessions" ON public.participant_presence
    FOR SELECT USING (
        session_id IN (
            SELECT session_id FROM public.session_participants 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own presence" ON public.participant_presence
    FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for session_invites
ALTER TABLE public.session_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view invites for their sessions" ON public.session_invites
    FOR SELECT USING (
        session_id IN (
            SELECT session_id FROM public.session_participants 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Session owners can manage invites" ON public.session_invites
    FOR ALL USING (
        created_by = auth.uid() AND
        session_id IN (
            SELECT session_id FROM public.session_participants 
            WHERE user_id = auth.uid()
        )
    );

-- Function to generate invite codes
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS TEXT AS $$
DECLARE
    code TEXT;
    exists BOOLEAN;
BEGIN
    LOOP
        code := upper(substring(md5(random()::text) from 1 for 8));
        SELECT EXISTS(SELECT 1 FROM public.session_invites WHERE invite_code = code) INTO exists;
        EXIT WHEN NOT exists;
    END LOOP;
    RETURN code;
END;
$$ LANGUAGE plpgsql;

-- Function to check if all participants are online
CREATE OR REPLACE FUNCTION check_all_participants_online(session_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    total_participants INTEGER;
    online_participants INTEGER;
BEGIN
    -- Count total participants
    SELECT COUNT(*) INTO total_participants
    FROM public.session_participants 
    WHERE session_id = session_uuid;
    
    -- Count online participants (heartbeat within 30 seconds)
    SELECT COUNT(*) INTO online_participants
    FROM public.participant_presence pp
    JOIN public.session_participants sp ON pp.session_id = sp.session_id AND pp.user_id = sp.user_id
    WHERE pp.session_id = session_uuid 
    AND pp.last_heartbeat > NOW() - INTERVAL '30 seconds';
    
    RETURN total_participants > 0 AND online_participants = total_participants;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up expired invites
CREATE OR REPLACE FUNCTION cleanup_expired_invites()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    UPDATE public.session_invites 
    SET is_active = false 
    WHERE expires_at < NOW() AND is_active = true;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
