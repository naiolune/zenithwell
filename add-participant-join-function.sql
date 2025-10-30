-- Function to add a participant to a session
-- This function bypasses RLS by using SECURITY DEFINER
-- It validates that there's a valid invite before adding the participant

CREATE OR REPLACE FUNCTION add_session_participant(
  p_session_id UUID,
  p_user_id UUID,
  p_role VARCHAR(20) DEFAULT 'participant'
)
RETURNS TABLE (
  session_id UUID,
  user_id UUID,
  role VARCHAR(20),
  is_ready BOOLEAN,
  joined_at TIMESTAMP WITH TIME ZONE
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_invite_exists BOOLEAN;
  v_current_count INTEGER;
  v_max_participants INTEGER;
  v_result RECORD;
BEGIN
  -- Check if there's a valid, active invite for this session
  SELECT EXISTS(
    SELECT 1 FROM session_invites
    WHERE session_id = p_session_id
    AND is_active = true
    AND expires_at > NOW()
  ) INTO v_invite_exists;

  -- If no valid invite, check if user is session owner (can add themselves)
  IF NOT v_invite_exists THEN
    SELECT EXISTS(
      SELECT 1 FROM therapy_sessions
      WHERE session_id = p_session_id
      AND user_id = p_user_id
    ) INTO v_invite_exists;
  END IF;

  IF NOT v_invite_exists THEN
    RAISE EXCEPTION 'No valid invite found or user is not session owner';
  END IF;

  -- Check if user is already a participant
  IF EXISTS(
    SELECT 1 FROM session_participants
    WHERE session_id = p_session_id
    AND user_id = p_user_id
  ) THEN
    -- Return existing participant
    SELECT * INTO v_result
    FROM session_participants
    WHERE session_id = p_session_id
    AND user_id = p_user_id;
    
    RETURN QUERY SELECT 
      v_result.session_id,
      v_result.user_id,
      v_result.role,
      v_result.is_ready,
      v_result.joined_at;
    RETURN;
  END IF;

  -- Get max participants from invite
  SELECT max_participants INTO v_max_participants
  FROM session_invites
  WHERE session_id = p_session_id
  AND is_active = true
  AND expires_at > NOW()
  LIMIT 1;

  -- Get current participant count
  SELECT COUNT(*) INTO v_current_count
  FROM session_participants
  WHERE session_id = p_session_id;

  -- Check if session is full
  IF v_max_participants IS NOT NULL AND v_current_count >= v_max_participants THEN
    RAISE EXCEPTION 'Session is full';
  END IF;

  -- Insert participant
  INSERT INTO session_participants (
    session_id,
    user_id,
    role,
    is_ready
  ) VALUES (
    p_session_id,
    p_user_id,
    p_role,
    false
  )
  RETURNING * INTO v_result;

  RETURN QUERY SELECT 
    v_result.session_id,
    v_result.user_id,
    v_result.role,
    v_result.is_ready,
    v_result.joined_at;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION add_session_participant(UUID, UUID, VARCHAR) TO authenticated;
