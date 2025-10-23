import { supabase } from './supabase';
import { Database } from '@/types/supabase';
import { uploadAudio } from './storage';
import { Platform } from 'react-native';
import { voiceChanger } from './elevenLabs';

type Story = Database['public']['Tables']['stories']['Row'];

interface CreateStoryData {
  title: string;
  description?: string;
  category: string;
  duration: number;
  transcription?: string | null;
  isPrivate?: boolean;
  isFriendsOnly?: boolean;
  groupId?: string | null;
  selectedVoiceUserId?: string | null;
  selectedVoiceId?: string | null;
  clonedAudioUri?: string | null;
}

export async function createStory(
  audioUri: string,
  userId: string,
  data: CreateStoryData
): Promise<boolean> {
  console.log('=== Starting createStory ===');
  console.log('DEBUG: Input parameters:', { audioUri, userId, data });

  try {
    if (!audioUri || !userId) {
      console.error('DEBUG: Missing required parameters');
      return false;
    }

    // Validate audio URI format for mobile
    if (Platform.OS !== 'web' && !audioUri.startsWith('file://')) {
      console.log('DEBUG: Adding file:// prefix for mobile');
      audioUri = `file://${audioUri}`;
    }
    console.log('DEBUG: Final audio URI:', audioUri);

    // Handle voice cloning if selected
    let finalAudioUri = audioUri;
    let isVoiceCloned = false;
    let originalVoiceUserId = userId;
    let clonedVoiceUserId: string | null = null;

    // Check if cloned audio is already provided (from preview)
    if (data.clonedAudioUri && data.selectedVoiceUserId) {
      console.log('DEBUG: Using pre-generated cloned audio');
      finalAudioUri = data.clonedAudioUri;
      isVoiceCloned = true;
      clonedVoiceUserId = data.selectedVoiceUserId;
    } else if (data.selectedVoiceId && data.selectedVoiceUserId) {
      // Generate voice clone if not already done using speech-to-speech
      console.log('DEBUG: Voice cloning selected, converting audio with speech-to-speech');
      try {
        const voiceChangeResult = await voiceChanger(audioUri, data.selectedVoiceId);
        
        if (voiceChangeResult.success && voiceChangeResult.audioUri) {
          finalAudioUri = voiceChangeResult.audioUri;
          isVoiceCloned = true;
          clonedVoiceUserId = data.selectedVoiceUserId;
          console.log('DEBUG: Voice successfully cloned via speech-to-speech');
        } else {
          console.error('DEBUG: Voice cloning failed:', voiceChangeResult.error);
          // Fall back to original audio
          console.log('DEBUG: Falling back to original audio');
        }
      } catch (error) {
        console.error('DEBUG: Error during voice cloning:', error);
        // Fall back to original audio
        console.log('DEBUG: Falling back to original audio due to error');
      }
    }

    // Upload audio file with retry
    let audioUrl: string | null = null;
    let retries = 3;
    
    console.log('DEBUG: Starting upload attempts');
    while (retries > 0 && !audioUrl) {
      try {
        console.log(`DEBUG: Upload attempt ${4 - retries}`);
        audioUrl = await uploadAudio(finalAudioUri, userId);
        if (audioUrl) {
          console.log('DEBUG: Upload successful');
          break;
        }
      } catch (error) {
        console.error(`DEBUG: Upload attempt ${4 - retries} failed:`, error);
        if (error instanceof Error) {
          console.error('DEBUG: Error details:', {
            message: error.message,
            stack: error.stack
          });
        }
        retries--;
        if (retries > 0) {
          console.log('DEBUG: Waiting before retry...');
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    if (!audioUrl) {
      console.error('DEBUG: Failed to upload audio after all attempts');
      return false;
    }

    console.log('DEBUG: Creating story record in database');
    
    if (data.groupId) {
      // For group stories, create in stories table with group flag and link to group
      console.log('DEBUG: Creating group story');
      
      // Create story record with group story flag
      const { data: createdStory, error } = await supabase
        .from('stories')
        .insert({
          title: data.title,
          description: data.description,
          audio_url: audioUrl,
          duration: data.duration,
          category: data.category,
          user_id: userId,
          transcription: data.transcription,
          is_private: true, // Group stories are private by default
          is_friends_only: false,
          is_group_story: true,
          is_voice_cloned: isVoiceCloned,
          original_voice_user_id: isVoiceCloned ? originalVoiceUserId : null,
          cloned_voice_user_id: isVoiceCloned ? clonedVoiceUserId : null,
        })
        .select('id')
        .single();
        
      if (error || !createdStory) {
        console.error('DEBUG: Error creating group story record:', error);
        return false;
      }
      
      // Insert into group_stories table
      const { error: groupStoryError } = await supabase
        .from('group_stories')
        .insert({
          group_id: data.groupId,
          story_id: createdStory.id
        });

      if (groupStoryError) {
        console.error('DEBUG: Error creating group story record:', groupStoryError);
        return false;
      }
      
      console.log('DEBUG: Group story created successfully');
    } else {
      // For regular stories, insert into main stories table
      const { error } = await supabase
        .from('stories')
        .insert({
          title: data.title,
          description: data.description,
          audio_url: audioUrl,
          duration: data.duration,
          category: data.category,
          user_id: userId,
          transcription: data.transcription,
          is_private: data.isPrivate || false,
          is_friends_only: data.isFriendsOnly || false,
          is_group_story: false,
          is_voice_cloned: isVoiceCloned,
          original_voice_user_id: isVoiceCloned ? originalVoiceUserId : null,
          cloned_voice_user_id: isVoiceCloned ? clonedVoiceUserId : null,
        });
        
      if (error) {
        console.error('DEBUG: Error creating story record:', error);
        return false;
      }
    }

    // Increment user points
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('points')
      .eq('id', userId)
      .single();
    if (!profileError && profile) {
      await supabase
        .from('profiles')
        .update({ points: (profile.points || 0) + 1 })
        .eq('id', userId);
    }

    console.log('DEBUG: Story created successfully');
    return true;
  } catch (error) {
    console.error('DEBUG: Error in createStory:', error);
    if (error instanceof Error) {
      console.error('DEBUG: Error details:', {
        message: error.message,
        stack: error.stack
      });
    }
    return false;
  }
}