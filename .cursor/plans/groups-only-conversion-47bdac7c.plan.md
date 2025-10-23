<!-- 47bdac7c-10d9-44ba-9172-31cc466c9def 609cd9d8-f7e8-4b31-882a-6f02ef85a0da -->
# Voice Cloning with Eleven Labs Integration

## Overview

Implement voice cloning feature where users can record their voice for cloning in their profile, and when recording, can select a group member's voice to clone their speech.

## Phase 1: Database Schema Updates

### Add Voice Clone Fields to Profiles Table

- Add `voice_clone_id` (string, nullable) to store Eleven Labs voice ID
- Add `voice_clone_status` (enum: 'none', 'pending', 'ready', 'failed')
- Add `voice_clone_recording_url` (string, nullable) for the source audio

## Phase 2: Environment Configuration

### Create Eleven Labs Configuration File

- **File**: `lib/elevenLabs.ts`
- Store API key from environment variable
- Create helper functions for API calls
- Add error handling following Eleven Labs documentation

## Phase 3: Voice Recording for Cloning (Profile Page)

### Update Profile Page (`app/(tabs)/profile.tsx`)

- Add "Record Voice for Cloning" button in the profile header or settings
- Create a new modal/screen for voice cloning recording (similar to record tab)
- Requirements:
- Minimum 30 seconds of clear audio
- User instructions on what to say
- Upload to Eleven Labs voice cloning API
- Store voice_clone_id in profile

### Create Voice Cloning Recording Component

- **File**: `components/audio/VoiceCloningModal.tsx`
- Similar UI to RecordingModal
- 30-60 second recording window
- Preview playback
- Submit to Eleven Labs API
- Show progress/status
- Handle errors gracefully per Eleven Labs docs

## Phase 4: Voice Selection in Record Flow

### Update Record Details View (`app/(tabs)/record.tsx`)

- After group selection, add "Use Member's Voice" section
- Only show if:
- A group is selected
- User has recorded their own voice for cloning
- Group members have recorded voices
- Fetch group members with available voice clones
- Display member list with voice clone status
- Allow preview of voice (short sample)

### Create Voice Selection Component

- **File**: `components/audio/VoiceSelector.tsx`
- Display group members with voice clones
- Show avatar, username, and "Preview Voice" button
- Selected state styling
- Option to use own voice (default)

## Phase 5: Voice Conversion/Text-to-Speech

### Update Story Creation Flow (`lib/stories.ts`)

- Check if a cloned voice is selected
- If selected:
- Use transcription as input text
- Call Eleven Labs text-to-speech API with selected voice_id
- Replace audio file with generated audio
- Store metadata (original_voice_user_id, cloned_voice_user_id)
- If not selected, use original recording

### Eleven Labs Integration Functions

**In `lib/elevenLabs.ts`:**

1. `createVoiceClone(audioUri: string, userId: string, name: string)` - Create voice clone
2. `getVoiceCloneStatus(voiceId: string)` - Check clone status
3. `textToSpeech(text: string, voiceId: string)` - Convert text to speech
4. `deleteVoiceClone(voiceId: string)` - Delete voice clone
5. `getVoicesList()` - Get user's voice clones

## Phase 6: Voice Clone Management

### Update Profile Page

- Show voice clone status
- Allow re-recording voice
- Allow deleting voice clone
- Show when voice was last recorded

### Database Updates for Stories

- Add `original_voice_user_id` (nullable) - who recorded the original audio
- Add `cloned_voice_user_id` (nullable) - whose voice was used for cloning
- Add `is_voice_cloned` (boolean) - flag for cloned voices

## Phase 7: UI/UX Enhancements

### Voice Clone Status Badge

- Show badge in profile if voice clone is ready
- Show status during recording ("Processing voice clone...")
- Loading states during API calls

### Error Handling

- Network errors
- API rate limits
- Invalid audio format
- Voice clone failed
- Clear error messages per Eleven Labs documentation

## Technical Details

### Eleven Labs API Integration Points

1. **Voice Cloning**: POST `/v1/voice-cloning/clone`

- Upload audio file
- Provide name and description
- Get voice_id back

2. **Text-to-Speech**: POST `/v1/text-to-speech/{voice_id}`

- Send text (transcription)
- Get audio file back

3. **Get Voices**: GET `/v1/voices`

- List available voices

4. **Delete Voice**: DELETE `/v1/voices/{voice_id}`

### API Key Storage

- Store in `.env`: `EXPO_PUBLIC_ELEVEN_LABS_API_KEY=sk_523d8fecfd2f9be60d071fab25a29120eb764612056d76da`
- Access via `process.env.EXPO_PUBLIC_ELEVEN_LABS_API_KEY`

## Files to Create/Modify

### New Files

1. `lib/elevenLabs.ts` - Eleven Labs API integration
2. `components/audio/VoiceCloningModal.tsx` - Voice recording for cloning
3. `components/audio/VoiceSelector.tsx` - Voice selection component

### Modified Files

1. `app/(tabs)/profile.tsx` - Add voice clone button
2. `app/(tabs)/record.tsx` - Add voice selection in details view
3. `lib/stories.ts` - Handle voice cloning in story creation
4. `types/supabase.ts` - Update types for new database fields

## Success Criteria

- Users can record their voice for cloning from profile
- Voice clone status is clearly displayed
- When recording in a group, users can select member voices
- Selected voice successfully clones the user's speech
- Audio quality is maintained
- Errors are handled gracefully with clear messaging

### To-dos

- [ ] Remove college selection step from sign-up flow and set default college to 'None of the Above'
- [ ] Remove college selection step from onboarding component and set default college to 'None of the Above'
- [ ] Remove college feed option from CommunityTitleToggle dropdown
- [ ] Update home feed logic to remove college-based filtering and show groups-only empty states
- [ ] Test the complete sign-up flow and verify groups-only functionality works correctly