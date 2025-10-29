-- Check current constraint
SELECT conname, pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'public.therapy_sessions'::regclass 
AND conname LIKE '%session_type%';

-- Drop the existing constraint
ALTER TABLE public.therapy_sessions 
DROP CONSTRAINT IF EXISTS therapy_sessions_session_type_check;

-- Add the correct constraint
ALTER TABLE public.therapy_sessions 
ADD CONSTRAINT therapy_sessions_session_type_check 
CHECK (session_type IN ('regular', 'introduction'));

-- Test the insert again
INSERT INTO public.therapy_sessions (
  user_id, 
  title, 
  is_group, 
  session_type,
  session_summary
) VALUES (
  '00000000-0000-0000-0000-000000000000'::uuid,
  'Test Session',
  false,
  'introduction',
  'Test session to verify session_type column exists'
);

-- Clean up test data
DELETE FROM public.therapy_sessions 
WHERE user_id = '00000000-0000-0000-0000-000000000000'::uuid 
AND title = 'Test Session';