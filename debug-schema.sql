-- Debug script to check if schema changes were applied
-- Run this in your Supabase SQL Editor to verify

-- Check if suspension fields exist in users table
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN ('is_suspended', 'suspended_at', 'suspended_by', 'suspension_reason', 'suspension_notes')
ORDER BY column_name;

-- Check if session lock fields exist in therapy_sessions table
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'therapy_sessions' 
AND column_name IN ('is_locked', 'locked_at', 'locked_by', 'lock_reason', 'can_unlock')
ORDER BY column_name;

-- Check if new tables were created
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('ai_session_notes', 'user_preferences', 'session_flags')
ORDER BY table_name;

-- Test a simple query to see if we can access user data
SELECT user_id, email, subscription_tier, is_admin 
FROM users 
LIMIT 1;
