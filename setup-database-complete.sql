-- Complete Database Setup for ZenithWell
-- Run this file in your Supabase SQL Editor to set up all required tables

-- Step 1: Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Step 2: Create base tables (from supabase-schema.sql)
-- Create users table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  subscription_tier TEXT NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro')),
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create therapy sessions table
CREATE TABLE IF NOT EXISTS public.therapy_sessions (
  session_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(user_id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  is_group BOOLEAN DEFAULT false,
  session_type TEXT DEFAULT 'individual' CHECK (session_type IN ('individual', 'group', 'introduction')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  session_summary TEXT
);

-- Create session participants table (for group sessions)
CREATE TABLE IF NOT EXISTS public.session_participants (
  session_id UUID REFERENCES public.therapy_sessions(session_id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(user_id) ON DELETE CASCADE NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  role TEXT NOT NULL CHECK (role IN ('owner', 'participant')),
  PRIMARY KEY (session_id, user_id)
);

-- Step 3: Add group session enhancements (from group-session-schema.sql)
-- Add group_category column to therapy_sessions table
ALTER TABLE public.therapy_sessions 
ADD COLUMN IF NOT EXISTS group_category VARCHAR(20) 
CHECK (group_category IN ('relationship', 'family', 'general'));

-- Add session_status column to therapy_sessions table
ALTER TABLE public.therapy_sessions 
ADD COLUMN IF NOT EXISTS session_status VARCHAR(20) DEFAULT 'waiting' 
CHECK (session_status IN ('waiting', 'active', 'paused', 'ended'));

-- Add is_ready column to session_participants table
ALTER TABLE public.session_participants 
ADD COLUMN IF NOT EXISTS is_ready BOOLEAN DEFAULT false;

-- Step 4: Create session_invites table
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

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_session_invites_code ON public.session_invites(invite_code);
CREATE INDEX IF NOT EXISTS idx_session_invites_session_id ON public.session_invites(session_id);
CREATE INDEX IF NOT EXISTS idx_session_invites_expires ON public.session_invites(expires_at);
CREATE INDEX IF NOT EXISTS idx_session_invites_active ON public.session_invites(is_active);
CREATE INDEX IF NOT EXISTS idx_therapy_sessions_group_category ON public.therapy_sessions(group_category);
CREATE INDEX IF NOT EXISTS idx_therapy_sessions_status ON public.therapy_sessions(session_status);

-- Step 5: Enable RLS
ALTER TABLE public.session_invites ENABLE ROW LEVEL SECURITY;

-- Step 6: Create RLS Policies for session_invites
-- Users can view invites for their sessions
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'session_invites' 
        AND policyname = 'Users can view invites for their sessions'
    ) THEN
        CREATE POLICY "Users can view invites for their sessions" ON public.session_invites
            FOR SELECT USING (
                session_id IN (
                    SELECT session_id FROM public.session_participants 
                    WHERE user_id = auth.uid()
                )
            );
    END IF;
END $$;

-- Session owners can manage invites
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'session_invites' 
        AND policyname = 'Session owners can manage invites'
    ) THEN
        CREATE POLICY "Session owners can manage invites" ON public.session_invites
            FOR ALL USING (
                created_by = auth.uid() AND
                session_id IN (
                    SELECT session_id FROM public.session_participants 
                    WHERE user_id = auth.uid()
                )
            );
    END IF;
END $$;

-- Public can view active invites by code (for validation)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'session_invites' 
        AND policyname = 'Public can view active invites by code'
    ) THEN
        CREATE POLICY "Public can view active invites by code" ON public.session_invites
            FOR SELECT USING (
                is_active = true AND
                expires_at > NOW()
            );
    END IF;
END $$;

-- Step 7: Create function to generate invite codes
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
