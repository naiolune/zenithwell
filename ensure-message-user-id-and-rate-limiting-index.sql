-- Migration: Ensure user_id column exists and add index for rate limiting
-- This migration ensures the session_messages table has user_id for group session message attribution
-- and adds indexes optimized for rate limiting queries

-- Add user_id column if it doesn't exist
ALTER TABLE public.session_messages 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(user_id) ON DELETE CASCADE;

-- Add index for better query performance on rate limiting checks
-- This index helps when querying recent messages by user_id for rate limiting
CREATE INDEX IF NOT EXISTS idx_session_messages_rate_limit 
ON public.session_messages(session_id, user_id, timestamp DESC)
WHERE sender_type = 'user';

-- Add index for user_id lookups (if not already exists from previous migration)
CREATE INDEX IF NOT EXISTS idx_session_messages_user_id 
ON public.session_messages(user_id);

-- Update existing user messages to set user_id based on session owner
-- Note: For group sessions with multiple users, we can only set user_id for messages
-- that were sent by the session owner retroactively. Other messages will remain NULL
-- until the session is used again with proper user_id tracking.
DO $$
BEGIN
  -- Only update messages that don't have user_id set and belong to sessions where
  -- we can determine the owner (i.e., sender_type is 'user')
  UPDATE public.session_messages sm
  SET user_id = ts.user_id
  FROM public.therapy_sessions ts
  WHERE sm.session_id = ts.session_id
    AND sm.sender_type = 'user'
    AND sm.user_id IS NULL
    -- Only update messages from sessions where is_group is false or session_type is 'individual'
    -- For group sessions, we can't retroactively determine which user sent which message
    AND (ts.is_group = false OR ts.session_type = 'individual');
END $$;

-- Add comment explaining the column
COMMENT ON COLUMN public.session_messages.user_id IS 'User who sent the message (NULL for AI messages). Required for group session message attribution and rate limiting.';

-- Add comment for the rate limiting index
COMMENT ON INDEX idx_session_messages_rate_limit IS 'Optimized index for rate limiting queries that check recent messages by session and user';

