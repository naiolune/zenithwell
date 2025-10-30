-- RPC function to toggle ready status for current user in a group session
CREATE OR REPLACE FUNCTION public.toggle_ready_status(
  session_uuid UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  uid UUID := auth.uid();
  current_ready_status BOOLEAN;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get current ready status
  SELECT is_ready INTO current_ready_status
  FROM public.session_participants
  WHERE session_id = session_uuid
    AND user_id = uid;

  -- If user is not a participant, raise error
  IF current_ready_status IS NULL THEN
    RAISE EXCEPTION 'User is not a participant in this session';
  END IF;

  -- Toggle ready status
  UPDATE public.session_participants
  SET is_ready = NOT COALESCE(current_ready_status, false)
  WHERE session_id = session_uuid
    AND user_id = uid;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.toggle_ready_status(UUID) TO authenticated;
