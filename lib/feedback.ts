import { supabase } from './supabase';
import { transcribeAudioFile } from './transcription';
import { uploadAudio } from './storage';

export const createFeedback = async ({
  title,
  description,
  audioUri,
  duration,
}: {
  title?: string;
  description?: string;
  audioUri: string;
  duration: number;
}) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // 1. Transcribe Audio
    const transcription = await transcribeAudioFile(audioUri);

    // 2. Upload Audio to Supabase Storage using the same method as stories
    const audioUrl = await uploadAudio(audioUri, user.id);
    if (!audioUrl) {
      throw new Error('Failed to upload audio file');
    }

    // 3. Insert into feedback table
    const { data: feedbackData, error: insertError } = await supabase
      .from('feedback')
      .insert({
        title: title || 'Feedback',
        description: description || null,
        audio_url: audioUrl,
        duration: Math.round(duration),
        user_id: user.id,
        transcription: transcription,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return feedbackData;

  } catch (error) {
    console.error('Error creating feedback:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message, error.stack);
    }
    throw error;
  }
}; 