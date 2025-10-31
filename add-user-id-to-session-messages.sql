-- Add user_id column to session_messages table for group sessions
-- This allows identifying which user sent each message

ALTER TABLE public.session_messages 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(user_id) ON DELETE CASCADE;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_session_messages_user_id ON public.session_messages(user_id);

-- Update existing user messages to set user_id based on session owner
-- Note: This is a best-effort update - for group sessions with multiple users,
-- we can't determine which user sent which message retroactively
UPDATE public.session_messages sm
SET user_id = ts.user_id
FROM public.therapy_sessions ts
WHERE sm.session_id = ts.session_id
  AND sm.sender_type = 'user'
  AND sm.user_id IS NULL;

-- Add comment explaining the column
COMMENT ON COLUMN public.session_messages.user_id IS 'User who sent the message (NULL for AI messages)';
