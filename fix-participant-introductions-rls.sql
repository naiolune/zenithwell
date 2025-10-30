-- Fix RLS policies for participant_introductions to allow upserts
-- The UPDATE policy needs WITH CHECK clause in addition to USING for upserts to work

-- Drop existing policies
DROP POLICY IF EXISTS "Users can insert their own introductions" ON public.participant_introductions;
DROP POLICY IF EXISTS "Users can update their own introductions" ON public.participant_introductions;

-- Recreate INSERT policy - allow users to insert their own introductions
-- Also allow if there's a valid invite for the session (for join flow)
CREATE POLICY "Users can insert their own introductions" ON public.participant_introductions
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND (
      -- Allow if there's a valid invite for this session
      EXISTS (
        SELECT 1 FROM public.session_invites
        WHERE session_id = public.participant_introductions.session_id
        AND is_active = true
        AND expires_at > NOW()
      )
      OR
      -- Allow if user is already a participant
      EXISTS (
        SELECT 1 FROM public.session_participants
        WHERE session_id = public.participant_introductions.session_id
        AND user_id = auth.uid()
      )
      OR
      -- Allow if user is the session owner
      EXISTS (
        SELECT 1 FROM public.therapy_sessions
        WHERE session_id = public.participant_introductions.session_id
        AND user_id = auth.uid()
      )
    )
  );

-- Recreate UPDATE policy with both USING and WITH CHECK for upserts
CREATE POLICY "Users can update their own introductions" ON public.participant_introductions
  FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
