-- RPCs for group presence and participants

-- Ensure INSERT policy exists for participant_presence
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'participant_presence' 
      AND policyname = 'Users can insert their own presence'
  ) THEN
    CREATE POLICY "Users can insert their own presence" ON public.participant_presence
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- update_presence: upsert current user's presence for a session
CREATE OR REPLACE FUNCTION public.update_presence(
  session_uuid UUID,
  is_online BOOLEAN DEFAULT TRUE,
  is_away BOOLEAN DEFAULT FALSE
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.participant_presence (session_id, user_id, last_heartbeat, is_online)
  VALUES (session_uuid, uid, NOW(), is_online)
  ON CONFLICT (session_id, user_id)
  DO UPDATE SET last_heartbeat = EXCLUDED.last_heartbeat,
                is_online = EXCLUDED.is_online;
END;
$$;

-- get_session_participants: list participants with presence summary
CREATE OR REPLACE FUNCTION public.get_session_participants(
  session_uuid UUID
) RETURNS TABLE (
  user_id UUID,
  is_ready BOOLEAN,
  is_online BOOLEAN,
  is_away BOOLEAN,
  last_heartbeat TIMESTAMPTZ,
  presence_status TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT 
    sp.user_id,
    sp.is_ready,
    COALESCE(pp.is_online, false) AS is_online,
    COALESCE(false, false) AS is_away, -- placeholder if you add an is_away column later
    pp.last_heartbeat,
    CASE 
      WHEN COALESCE(pp.is_online, false) THEN 'online'
      ELSE 'offline'
    END AS presence_status
  FROM public.session_participants sp
  LEFT JOIN public.participant_presence pp
    ON pp.session_id = sp.session_id AND pp.user_id = sp.user_id
  WHERE sp.session_id = session_uuid
  ORDER BY sp.user_id;
$$;

-- Grant execute to authenticated users
DO $$
BEGIN
  GRANT EXECUTE ON FUNCTION public.update_presence(UUID, BOOLEAN, BOOLEAN) TO authenticated;
  GRANT EXECUTE ON FUNCTION public.get_session_participants(UUID) TO authenticated;
EXCEPTION WHEN others THEN
  -- ignore if role doesn't exist in local env
  NULL;
END $$;
