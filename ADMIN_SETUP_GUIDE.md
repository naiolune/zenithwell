# Admin Setup Guide

This guide explains how to set up admin access for the ZenithWell platform to resolve RLS (Row-Level Security) policy violations.

## The Problem

You're seeing errors like:
- `Failed to save configuration: new row violates row-level security policy for table "ai_config"`
- `Admin privileges required to manage AI configurations`

This happens because the RLS policies require users to have `is_admin = true` in the database to perform admin operations.

## Solution: Set Up Admin Access

### Method 1: Using Supabase Dashboard (Recommended)

1. **Go to your Supabase Dashboard**
   - Navigate to your project at https://supabase.com/dashboard
   - Select your ZenithWell project

2. **Open the SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New query"

3. **Run the Admin Setup Query**
   ```sql
   -- Replace 'your-email@example.com' with your actual email address
   UPDATE public.users 
   SET is_admin = true 
   WHERE email = 'your-email@example.com';
   ```

4. **Verify the Update**
   ```sql
   -- Check that your user is now an admin
   SELECT email, is_admin, subscription_tier 
   FROM public.users 
   WHERE email = 'your-email@example.com';
   ```

### Method 2: Using Supabase Table Editor

1. **Open Table Editor**
   - Go to "Table Editor" in your Supabase dashboard
   - Select the `users` table

2. **Find Your User**
   - Look for your email address in the table
   - Click on the row to edit it

3. **Update Admin Status**
   - Find the `is_admin` column
   - Change the value from `false` to `true`
   - Save the changes

### Method 3: Using Migration Script

If you prefer to use the migration script:

1. **Run the migration**
   ```bash
   # If you have the migration file
   psql -h your-db-host -U postgres -d your-db-name -f migration-add-admin-field.sql
   ```

2. **Set yourself as admin**
   ```sql
   UPDATE public.users 
   SET is_admin = true 
   WHERE email = 'your-email@example.com';
   ```

## Verification Steps

After setting up admin access:

1. **Sign out and sign back in** to your ZenithWell account
2. **Try accessing admin features**:
   - Go to `/admin` - should show admin dashboard
   - Go to `/admin/ai-config` - should allow creating AI configurations
   - Go to `/admin/support` - should show user management

3. **Test AI Configuration**
   - Try creating a new AI provider configuration
   - The error should be resolved

## Troubleshooting

### Still Getting RLS Errors?

1. **Check your email address**
   - Make sure you're using the exact email address you signed up with
   - Check for typos in the SQL query

2. **Verify the update worked**
   ```sql
   SELECT email, is_admin FROM public.users WHERE email = 'your-email@example.com';
   ```
   Should show `is_admin: true`

3. **Clear browser cache**
   - Sign out completely
   - Clear browser cache/cookies
   - Sign back in

4. **Check authentication**
   - Make sure you're signed in with the correct account
   - Try signing out and back in

### Multiple Admin Users

To set up multiple admin users:

```sql
-- Set multiple users as admins
UPDATE public.users 
SET is_admin = true 
WHERE email IN (
  'admin1@example.com',
  'admin2@example.com',
  'admin3@example.com'
);
```

### Remove Admin Access

To remove admin access from a user:

```sql
UPDATE public.users 
SET is_admin = false 
WHERE email = 'user@example.com';
```

## Security Notes

- **Admin privileges are powerful** - only grant to trusted users
- **The `is_admin` field controls access** to all admin features
- **RLS policies enforce** that only admins can manage AI configs and users
- **Always verify** admin status after setup

## Need Help?

If you're still experiencing issues:

1. Check the browser console for detailed error messages
2. Verify your Supabase connection settings
3. Ensure your user account exists in the `users` table
4. Contact support with specific error messages

---

**Note**: This setup is required because the platform uses Row-Level Security (RLS) policies to ensure only authorized admins can manage system configurations and user accounts.
