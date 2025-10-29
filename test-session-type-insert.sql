-- Test if we can insert with session_type column
-- This will fail if the column doesn't exist
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

-- If the above succeeds, clean up the test data
DELETE FROM public.therapy_sessions 
WHERE user_id = '00000000-0000-0000-0000-000000000000'::uuid 
AND title = 'Test Session';