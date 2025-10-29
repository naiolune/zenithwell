-- Comprehensive fix for therapy_sessions session_type constraint
-- Run this script to ensure the constraint allows the correct values

-- First, check what constraints currently exist
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'public.therapy_sessions'::regclass 
AND conname LIKE '%session_type%';

-- Drop ALL existing session_type constraints (there might be multiple)
DO $$
DECLARE
    constraint_rec RECORD;
BEGIN
    FOR constraint_rec IN 
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'public.therapy_sessions'::regclass 
        AND conname LIKE '%session_type%'
    LOOP
        EXECUTE 'ALTER TABLE public.therapy_sessions DROP CONSTRAINT IF EXISTS ' || constraint_rec.conname;
        RAISE NOTICE 'Dropped constraint: %', constraint_rec.conname;
    END LOOP;
END $$;

-- Add the correct constraint for our session types
-- This allows: individual, group, introduction
ALTER TABLE public.therapy_sessions 
ADD CONSTRAINT therapy_sessions_session_type_check 
CHECK (session_type IN ('individual', 'group', 'introduction'));

-- Verify the constraint was created correctly
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'public.therapy_sessions'::regclass 
AND conname = 'therapy_sessions_session_type_check';

-- Test insert with 'individual' (should work)
DO $$
DECLARE
    test_user_id uuid;
    test_session_id uuid;
BEGIN
    -- Get a valid user ID
    SELECT user_id INTO test_user_id FROM public.users LIMIT 1;
    
    IF test_user_id IS NOT NULL THEN
        -- Test insert with 'individual'
        INSERT INTO public.therapy_sessions (
            user_id, 
            title, 
            is_group, 
            session_type
        ) VALUES (
            test_user_id,
            'TEST - Individual Session',
            false,
            'individual'
        ) RETURNING session_id INTO test_session_id;
        
        -- Clean up
        DELETE FROM public.therapy_sessions WHERE session_id = test_session_id;
        RAISE NOTICE 'Test passed: individual session_type works correctly';
    ELSE
        RAISE NOTICE 'No users found in database, skipping test';
    END IF;
END $$;

-- Test insert with 'group' (should work)
DO $$
DECLARE
    test_user_id uuid;
    test_session_id uuid;
BEGIN
    SELECT user_id INTO test_user_id FROM public.users LIMIT 1;
    
    IF test_user_id IS NOT NULL THEN
        INSERT INTO public.therapy_sessions (
            user_id, 
            title, 
            is_group, 
            session_type
        ) VALUES (
            test_user_id,
            'TEST - Group Session',
            true,
            'group'
        ) RETURNING session_id INTO test_session_id;
        
        DELETE FROM public.therapy_sessions WHERE session_id = test_session_id;
        RAISE NOTICE 'Test passed: group session_type works correctly';
    END IF;
END $$;

-- Test insert with 'introduction' (should work)
DO $$
DECLARE
    test_user_id uuid;
    test_session_id uuid;
BEGIN
    SELECT user_id INTO test_user_id FROM public.users LIMIT 1;
    
    IF test_user_id IS NOT NULL THEN
        INSERT INTO public.therapy_sessions (
            user_id, 
            title, 
            is_group, 
            session_type
        ) VALUES (
            test_user_id,
            'TEST - Introduction Session',
            false,
            'introduction'
        ) RETURNING session_id INTO test_session_id;
        
        DELETE FROM public.therapy_sessions WHERE session_id = test_session_id;
        RAISE NOTICE 'Test passed: introduction session_type works correctly';
    END IF;
END $$;
