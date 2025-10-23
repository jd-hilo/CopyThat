# Voice Cloning Feature Setup Guide

## Prerequisites

1. **Eleven Labs API Key**: You'll need an Eleven Labs API account and API key
2. **Database Access**: Access to run SQL migrations on your Supabase database

## Step 1: Environment Configuration

Create a `.env` file in the project root (if it doesn't exist) and add:

```env
EXPO_PUBLIC_ELEVEN_LABS_API_KEY=sk_523d8fecfd2f9be60d071fab25a29120eb764612056d76da
```

**Note**: This file is git-ignored. Keep your API key secure and never commit it to version control.

## Step 2: Database Migration

Run the SQL migrations detailed in `DATABASE_MIGRATION_VOICE_CLONING.md`:

1. Log into your Supabase dashboard
2. Go to SQL Editor
3. Copy and paste the migration SQL for:
   - Profiles table updates
   - Stories table updates
4. Run the migrations
5. Verify the changes

## Step 3: Update TypeScript Types (Optional but Recommended)

If using Supabase CLI:

```bash
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > types/supabase.ts
```

This will regenerate your types with the new database fields.

## Step 4: Test the Feature

### Profile Page - Record Voice
1. Open the app and go to your profile
2. Tap the menu button (three dots)
3. Select "Record Voice Clone"
4. Record 30-60 seconds of clear audio
5. Submit and wait for processing
6. You should see a microphone badge on your profile avatar

### Record Tab - Use Cloned Voice
1. Join or create a group
2. Go to the Record tab
3. Record a voice memo
4. Select the group in the details view
5. If you have a voice clone, you'll see a "Use a member's voice" section
6. Select a group member's voice (who has recorded their voice)
7. Post the recording - it will be converted to the selected voice

## How It Works

1. **Voice Recording**: User records their voice (30-60 seconds) from the profile page
2. **Upload to Eleven Labs**: The audio is sent to Eleven Labs API for voice cloning
3. **Voice ID Storage**: The voice ID is stored in the user's profile
4. **Voice Selection**: When recording a memo in a group, users can select whose voice to use
5. **Text-to-Speech**: The recording's transcription is converted to speech using the selected voice
6. **Storage**: The cloned audio is uploaded and the original metadata is preserved

## Troubleshooting

### Voice Clone Not Appearing
- Check that the recording is at least 30 seconds
- Verify the Eleven Labs API key is correctly set
- Check network logs for API errors
- Verify database fields were added correctly

### Voice Cloning Fails
- Ensure audio quality is good (quiet environment, clear speech)
- Check Eleven Labs API quota/limits
- Verify the transcription is not empty
- Check console logs for detailed error messages

### Voice Selection Not Showing
- Ensure you're in a group (not college feed)
- Verify you have recorded your own voice first
- Check that other group members have voice clones with status 'ready'

## API Rate Limits

Eleven Labs free tier typically allows:
- Limited voice clones per month
- Limited character conversions per month

Monitor your usage in the Eleven Labs dashboard.

## Privacy Considerations

- Users should consent to their voice being cloned
- Voice clones are tied to user accounts
- Deleting a user's account should also delete their voice clone
- Voice clones can only be used within groups where the user is a member

## Known Limitations

1. Voice preview is not implemented yet (would require storing sample audio)
2. Voice cloning quality depends on the source audio quality
3. Text-to-speech may not perfectly capture all nuances
4. Processing time varies (typically 10-30 seconds)

