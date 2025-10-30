-- Add RLS policy to allow public access to active invites for validation
-- This allows unauthenticated users to validate invite codes

CREATE POLICY "Public can view active invites by code" ON public.session_invites
    FOR SELECT USING (
        is_active = true AND
        expires_at > NOW()
    );
