# Memory & Session Types Database Setup

## Overview
This guide will help you set up the enhanced database schema for memory management and session types in your ZenithWell application.

## Database Schema Setup

### Option 1: Supabase Dashboard (Recommended)
1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy and paste the contents of `database-memory-schema-fixed.sql`
4. Click "Run" to execute the SQL

### Option 2: Command Line (if you have psql installed)
```bash
psql "postgresql://postgres.jdrtoqbxmdltnhinbdms:gxOV3PJPecTTcc6nttDvxqtl7lmZlK9OPuHCLl-LIgs@aws-0-us-west-1.pooler.supabase.com:6543/postgres" -f database-memory-schema-fixed.sql
```

## What the Schema Adds

### New Tables
1. **user_goals** - Stores user wellness goals
   - `id`, `user_id`, `goal_text`, `status`, `created_at`, `achieved_at`

2. **user_memory** - Stores AI memory about users
   - `id`, `user_id`, `memory_key`, `memory_value`, `category`, `created_at`, `is_active`

### Enhanced Tables
1. **sessions** - Added `session_type` column
   - Values: 'individual', 'relationship', 'family', 'general'

### New Functions
1. `get_user_memory_context(user_id)` - Formats memory for AI
2. `is_first_session(user_id)` - Detects first session
3. `store_user_goal(user_id, goal_text)` - Auto-stores goals
4. `get_user_goals(user_id, status)` - Retrieves goals
5. `get_user_memory_by_category(user_id, category)` - Gets memory by category
6. `search_user_memory(user_id, query)` - Searches memory

### RLS Policies
- Users can only access their own memory and goals
- Admins can manage all memory and goals
- Service role has full access for server-side operations

## Features Enabled

### 1. Session Type Selection
- Individual sessions (default)
- Relationship sessions (couples)
- Family sessions (family members)
- General group sessions (friends/peers)

### 2. Memory Management
- **Goals**: User's wellness goals
- **Preferences**: Communication preferences, triggers
- **Background**: Important life context, relationships
- **Progress**: Milestones, achievements, setbacks
- **Custom**: User-defined memory items

### 3. AI Context Enhancement
- Dynamic system prompts based on session type
- First session goal collection
- Memory-aware responses
- ZenithWell branding throughout

### 4. User Privacy Controls
- View all stored memory
- Edit/delete any memory item
- Clear all memory
- Complete transparency

## Testing the Implementation

After running the schema:

1. **Create a new individual session** - Should auto-set session_type to 'individual'
2. **Create a group session** - Should prompt for session type selection
3. **First session** - AI should ask for goals and store them
4. **Memory page** - Should show memory management interface
5. **Subsequent sessions** - AI should reference previous memory

## Troubleshooting

### If you get permission errors:
- Make sure you're using the service role key for server-side operations
- Check that RLS policies are properly created
- Verify user authentication is working

### If memory isn't persisting:
- Check that the API routes are working (`/api/memory`, `/api/goals`)
- Verify the memory service is using the correct Supabase client
- Check browser network tab for API errors

### If AI responses aren't enhanced:
- Verify the enhanced AI service is being used
- Check that session context is being passed correctly
- Ensure system prompts are being generated properly

## Next Steps

1. Run the database schema
2. Test creating sessions with different types
3. Test memory management functionality
4. Verify AI responses include memory context
5. Test first session goal collection

The implementation is now complete with all server-side security, memory management, and enhanced AI capabilities!
