-- Migration: Add user name support
-- This migration adds support for storing user names in auth.users.user_metadata
-- and optionally adds a full_name column to public.users for easier querying

-- Step 1: Add full_name column to public.users table (optional, for easier querying)
-- Note: Names are primarily stored in auth.users.user_metadata (first_name, last_name, full_name)
-- This column is optional and can be synced from auth metadata if needed
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS full_name TEXT;

-- Step 2: Create a function to sync names from auth.users metadata to public.users
-- This function can be called periodically or triggered to keep public.users.full_name in sync
CREATE OR REPLACE FUNCTION public.sync_user_names_from_auth()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_record RECORD;
  user_full_name TEXT;
  user_first_name TEXT;
  user_last_name TEXT;
BEGIN
  -- Loop through all users in public.users
  FOR user_record IN 
    SELECT user_id FROM public.users
  LOOP
    -- Get user metadata from auth.users
    SELECT 
      raw_user_meta_data->>'first_name',
      raw_user_meta_data->>'last_name',
      raw_user_meta_data->>'full_name'
    INTO 
      user_first_name,
      user_last_name,
      user_full_name
    FROM auth.users
    WHERE id = user_record.user_id;
    
    -- Determine full name: prefer first_name + last_name, fallback to full_name
    IF user_first_name IS NOT NULL OR user_last_name IS NOT NULL THEN
      user_full_name := TRIM(COALESCE(user_first_name, '') || ' ' || COALESCE(user_last_name, ''));
    END IF;
    
    -- Update public.users.full_name if we have a name
    IF user_full_name IS NOT NULL AND user_full_name != '' THEN
      UPDATE public.users
      SET full_name = user_full_name
      WHERE user_id = user_record.user_id;
    END IF;
  END LOOP;
END;
$$;

-- Step 3: Create a trigger function to automatically sync names when auth.users metadata changes
-- Note: This requires the auth.users table to be accessible, which may require special permissions
-- For now, we'll document this as optional since Supabase handles auth metadata separately

-- Step 4: Create a function to get user display name (first name or full name)
-- This can be used in queries to get display names
CREATE OR REPLACE FUNCTION public.get_user_display_name(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  display_name TEXT;
  user_first_name TEXT;
  user_last_name TEXT;
  user_full_name TEXT;
BEGIN
  -- Try to get from auth.users metadata first
  SELECT 
    raw_user_meta_data->>'first_name',
    raw_user_meta_data->>'last_name',
    raw_user_meta_data->>'full_name'
  INTO 
    user_first_name,
    user_last_name,
    user_full_name
  FROM auth.users
  WHERE id = p_user_id;
  
  -- Prefer first_name if available, otherwise use full_name
  IF user_first_name IS NOT NULL AND user_first_name != '' THEN
    display_name := user_first_name;
  ELSIF user_full_name IS NOT NULL AND user_full_name != '' THEN
    display_name := user_full_name;
  ELSE
    -- Fallback to public.users.full_name
    SELECT full_name INTO display_name
    FROM public.users
    WHERE user_id = p_user_id;
  END IF;
  
  RETURN COALESCE(display_name, 'Member');
END;
$$;

-- Step 5: Initial sync of existing users (optional - uncomment to run)
-- Call this manually after running the migration to backfill existing users
-- SELECT public.sync_user_names_from_auth();

-- Step 6: Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.sync_user_names_from_auth() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_display_name(UUID) TO authenticated;

-- Notes:
-- 1. Names are stored in auth.users.user_meta_data as:
--    - first_name (string)
--    - last_name (string)  
--    - full_name (string, computed as first_name + last_name)
--
-- 2. The public.users.full_name column is optional and can be synced from auth metadata
--    for easier querying, but is not required since we fetch from auth.users directly
--
-- 3. New signups automatically store names in user_metadata during registration
--
-- 4. Existing users can update their names via the settings page, which updates auth metadata
--
-- 5. The get_user_display_name() function can be used in queries to get display names
--    Example: SELECT get_user_display_name(user_id) FROM session_participants;
