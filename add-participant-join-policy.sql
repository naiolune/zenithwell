-- Add RLS policy to allow users to join sessions via valid invites
-- This policy allows users to insert themselves as participants if:
-- 1. There's a valid, active invite for the session, OR
-- 2. They are the session owner
-- AND they are inserting themselves (user_id matches auth.uid())

CREATE POLICY "Users can join sessions via valid invites" ON public.session_participants
  FOR INSERT WITH CHECK (
    -- User must be inserting themselves
    auth.uid() = public.session_participants.user_id
    AND (
      -- Allow if there's a valid invite for this session
      EXISTS (
        SELECT 1 FROM public.session_invites
        WHERE session_id = public.session_participants.session_id
        AND is_active = true
        AND expires_at > NOW()
      )
      OR
      -- Allow if user is the session owner
      EXISTS (
        SELECT 1 FROM public.therapy_sessions
        WHERE session_id = public.session_participants.session_id
        AND user_id = auth.uid()
      )
    )
  );

-- Note: The existing policy "Users can add participants to their sessions" 
-- only allows session owners to add participants. This new policy adds
-- the ability for users to join via invites.
