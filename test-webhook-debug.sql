-- Test and debug the emoji reaction webhook

-- 1. Check if the trigger exists
SELECT 
    trigger_name,
    event_manipulation,
    action_statement,
    action_timing
FROM information_schema.triggers 
WHERE event_object_table = 'emoji_reactions';

-- 2. Check if the http extension is available
SELECT * FROM pg_extension WHERE extname = 'http';

-- 3. Test the webhook function directly
SELECT call_emoji_push_notification(
    '60b6282e-6bfb-46cc-8646-d9b519db4375'::uuid, 
    'heart'
);

-- 4. Check if there are any recent emoji reactions
SELECT 
    id,
    story_id,
    user_id,
    emoji_type,
    created_at
FROM emoji_reactions 
ORDER BY created_at DESC 
LIMIT 5;

-- 5. Check if notifications were created
SELECT 
    id,
    header,
    message,
    type,
    created_at
FROM notifications 
WHERE type = 'emoji_reaction'
ORDER BY created_at DESC 
LIMIT 5;

-- 6. Test inserting a new emoji reaction to see if trigger fires
-- (This will actually insert a test record)
INSERT INTO emoji_reactions (
    id,
    story_id,
    user_id,
    emoji_type,
    created_at
) VALUES (
    gen_random_uuid(),
    '60b6282e-6bfb-46cc-8646-d9b519db4375',
    'dc9c6279-247a-4553-bf7f-581010be4f6f',
    'fire',
    NOW()
);

-- 7. Check the logs (if available)
-- Note: This might not work in all environments
SELECT * FROM pg_stat_activity WHERE query LIKE '%emoji%' OR query LIKE '%webhook%'; 