#!/bin/bash

# Test the emoji reaction push notification function
echo "Testing emoji reaction push notification function..."

# Test with heart emoji
echo "Testing with heart emoji..."
curl -X POST \
  https://dqthkfmvvedzyowhyeyd.supabase.co/functions/v1/send-emoji-reaction-push \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0YnFqZ3F1em9nZXZzZW5ub2xxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1NDE5MjMsImV4cCI6MjA3NjExNzkyM30.Jmd0sHL3JYQzD8vRLQK-u4dxz6X2U4h9lq1HeQxSTqk" \
  -d '{
    "story_id": "60b6282e-6bfb-46cc-8646-d9b519db4375",
    "emoji_type": "heart"
  }'

echo -e "\n\nTesting with fire emoji..."
curl -X POST \
  https://dqthkfmvvedzyowhyeyd.supabase.co/functions/v1/send-emoji-reaction-push \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0YnFqZ3F1em9nZXZzZW5ub2xxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1NDE5MjMsImV4cCI6MjA3NjExNzkyM30.Jmd0sHL3JYQzD8vRLQK-u4dxz6X2U4h9lq1HeQxSTqk" \
  -d '{
    "story_id": "60b6282e-6bfb-46cc-8646-d9b519db4375",
    "emoji_type": "fire"
  }'

echo -e "\n\nTesting with laugh emoji..."
curl -X POST \
  https://dqthkfmvvedzyowhyeyd.supabase.co/functions/v1/send-emoji-reaction-push \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0YnFqZ3F1em9nZXZzZW5ub2xxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1NDE5MjMsImV4cCI6MjA3NjExNzkyM30.Jmd0sHL3JYQzD8vRLQK-u4dxz6X2U4h9lq1HeQxSTqk" \
  -d '{
    "story_id": "60b6282e-6bfb-46cc-8646-d9b519db4375",
    "emoji_type": "laugh"
  }'

echo -e "\n\nTesting with wow emoji..."
curl -X POST \
  https://dqthkfmvvedzyowhyeyd.supabase.co/functions/v1/send-emoji-reaction-push \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0YnFqZ3F1em9nZXZzZW5ub2xxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1NDE5MjMsImV4cCI6MjA3NjExNzkyM30.Jmd0sHL3JYQzD8vRLQK-u4dxz6X2U4h9lq1HeQxSTqk" \
  -d '{
    "story_id": "60b6282e-6bfb-46cc-8646-d9b519db4375",
    "emoji_type": "wow"
  }'

echo -e "\n\nTesting with sad emoji..."
curl -X POST \
  https://dqthkfmvvedzyowhyeyd.supabase.co/functions/v1/send-emoji-reaction-push \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0YnFqZ3F1em9nZXZzZW5ub2xxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1NDE5MjMsImV4cCI6MjA3NjExNzkyM30.Jmd0sHL3JYQzD8vRLQK-u4dxz6X2U4h9lq1HeQxSTqk" \
  -d '{
    "story_id": "60b6282e-6bfb-46cc-8646-d9b519db4375",
    "emoji_type": "sad"
  }'

echo -e "\n\nTest completed!" 