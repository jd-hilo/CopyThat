-- Show table structure
SELECT 
    column_name, 
    data_type, 
    column_default,
    is_nullable,
    character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'notifications'
ORDER BY ordinal_position;

-- Show RLS policies
SELECT 
    pol.policyname,
    pol.permissive,
    pol.roles,
    pol.cmd,
    pol.qual,
    pol.with_check
FROM pg_policies pol
WHERE pol.tablename = 'notifications';

-- Show sample notifications
SELECT 
    id,
    type,
    created_at,
    header,
    message,
    user_id,
    read,
    is_active
FROM notifications
LIMIT 5;

-- Fix existing friend request notifications
UPDATE notifications n
SET user_id = fr.receiver_id
FROM friend_requests fr
WHERE n.type = 'friend_request'
AND n.created_by = fr.sender_id
AND n.user_id IS NULL;

-- Check unread notifications
SELECT id, user_id, read, type, header, message
FROM notifications
WHERE read = false;

-- Check pending friend requests
SELECT id, sender_id, receiver_id, status, created_at
FROM friend_requests
WHERE status = 'pending';

-- Mark all notifications as read
UPDATE notifications
SET read = true
WHERE read = false;

-- Check unread notifications after update
SELECT id, user_id, read, type, header, message
FROM notifications
WHERE read = false;
