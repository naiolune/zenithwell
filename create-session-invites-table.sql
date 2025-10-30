-- Create session_invites table if it doesn't exist
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

-- Enable RLS
ALTER TABLE public.session_invites ENABLE ROW LEVEL SECURITY;

-- RLS Policies for session_invites
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

-- Policy to allow public access to active invites for validation
CREATE POLICY "Public can view active invites by code" ON public.session_invites
    FOR SELECT USING (
        is_active = true AND
        expires_at > NOW()
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
