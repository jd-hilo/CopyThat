-- Look at details of the reaction we'll reply to
SELECT 
  r.id as reaction_id,
  r.user_id as reaction_owner_id,
  p.username as reaction_owner_username,
  r.story_id,
  s.title as story_title,
  s.user_id as story_owner_id,
  p2.username as story_owner_username
FROM reactions r
JOIN profiles p ON p.id = r.user_id
JOIN stories s ON s.id = r.story_id
JOIN profiles p2 ON p2.id = s.user_id
WHERE r.id = '8edc5c46-a2df-46cb-96ab-ecba990d9387';

-- See existing notifications for this reaction
SELECT * FROM notifications 
WHERE story_id IN (
  SELECT story_id FROM reactions 
  WHERE id = '8edc5c46-a2df-46cb-96ab-ecba990d9387'
)
ORDER BY created_at DESC;

-- Insert a reply to this reaction
INSERT INTO reactions (
  id,
  story_id,
  user_id,
  audio_url,
  duration,
  reply_to
)
SELECT
  gen_random_uuid(),  -- new unique ID for this reply
  story_id,  -- same story as the original reaction
  '9625a069-8d57-4a8e-bde6-a8ed85eb514b',  -- the user making the reply
  'test_audio_url_for_reply.m4a',  -- dummy audio URL
  30,  -- dummy duration
  '8edc5c46-a2df-46cb-96ab-ecba990d9387'  -- this is the reaction we're replying to
FROM reactions
WHERE id = '8edc5c46-a2df-46cb-96ab-ecba990d9387';

-- Check the notifications after inserting the reply
SELECT * FROM notifications 
WHERE story_id IN (
  SELECT story_id FROM reactions 
  WHERE id = '8edc5c46-a2df-46cb-96ab-ecba990d9387'
)
AND created_at > NOW() - interval '1 minute'
ORDER BY created_at DESC; 