-- Enable Realtime for session_messages table
-- Run this in Supabase SQL Editor to enable real-time updates

-- Enable replication for session_messages table
ALTER PUBLICATION supabase_realtime ADD TABLE session_messages;

-- Also enable for session_participants if not already enabled
ALTER PUBLICATION supabase_realtime ADD TABLE session_participants;

-- Verify tables are in replication
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime';
