-- Check current constraint
SELECT conname, pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'public.therapy_sessions'::regclass 
AND conname LIKE '%session_type%';

-- Drop the existing constraint (it only allows individual/relationship/family/general)
ALTER TABLE public.therapy_sessions 
DROP CONSTRAINT IF EXISTS therapy_sessions_session_type_check;

-- Add the correct constraint for our new session types
ALTER TABLE public.therapy_sessions 
ADD CONSTRAINT therapy_sessions_session_type_check 
CHECK (session_type IN ('individual', 'group', 'introduction'));

-- Test the insert with a valid user ID (get first user from users table)
DO $$
DECLARE
    test_user_id uuid;
BEGIN
    -- Get a valid user ID
    SELECT user_id INTO test_user_id FROM public.users LIMIT 1;
    
    IF test_user_id IS NOT NULL THEN
        -- Test the insert
        INSERT INTO public.therapy_sessions (
            user_id, 
            title, 
            is_group, 
            session_type,
            session_summary
        ) VALUES (
            test_user_id,
            'Test Session - Constraint Check',
            false,
            'introduction',
            'Test session to verify session_type column exists'
        );
        
        -- Clean up test data
        DELETE FROM public.therapy_sessions 
        WHERE user_id = test_user_id 
        AND title = 'Test Session - Constraint Check';
        
        RAISE NOTICE 'Constraint test passed! session_type column accepts "introduction" value.';
    ELSE
        RAISE NOTICE 'No users found in database, skipping constraint test.';
    END IF;
END $$;