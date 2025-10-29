-- Add session_type column to therapy_sessions table
ALTER TABLE public.therapy_sessions 
ADD COLUMN IF NOT EXISTS session_type TEXT DEFAULT 'individual' 
CHECK (session_type IN ('individual', 'group', 'introduction'));

-- Add index for session_type for better performance
CREATE INDEX IF NOT EXISTS idx_therapy_sessions_session_type 
ON public.therapy_sessions USING btree (session_type);