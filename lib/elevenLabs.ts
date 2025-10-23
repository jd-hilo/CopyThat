import * as FileSystem from 'expo-file-system';

// Eleven Labs API Configuration
const ELEVEN_LABS_API_KEY = process.env.EXPO_PUBLIC_ELEVEN_LABS_API_KEY;
const ELEVEN_LABS_BASE_URL = 'https://api.elevenlabs.io/v1';

interface VoiceCloneResponse {
  voice_id: string;
  name: string;
  samples: Array<{
    sample_id: string;
    file_name: string;
    mime_type: string;
    size_bytes: number;
    hash: string;
  }>;
  category: string;
  fine_tuning: {
    is_allowed_to_fine_tune: boolean;
    finetuning_state: string;
    verification_attempts_count: number;
    manual_verification_requested: boolean;
  };
  labels: Record<string, string>;
  description: string;
  preview_url: string;
  available_for_tiers: string[];
  settings: any;
  sharing: any;
  high_quality_base_model_ids: string[];
}

interface ElevenLabsError {
  detail: {
    status: string;
    message: string;
  };
}

/**
 * Creates a voice clone from an audio file
 * @param audioUri - Local URI of the audio file
 * @param userId - User ID for naming the voice
 * @param name - Display name for the voice
 * @returns Voice ID from Eleven Labs
 */
export async function createVoiceClone(
  audioUri: string,
  userId: string,
  name: string
): Promise<{ success: boolean; voiceId?: string; error?: string }> {
  try {
    if (!ELEVEN_LABS_API_KEY) {
      throw new Error('Eleven Labs API key is not configured');
    }

    // Read the audio file
    const audioInfo = await FileSystem.getInfoAsync(audioUri);
    if (!audioInfo.exists) {
      throw new Error('Audio file does not exist');
    }

    // Create form data
    const formData = new FormData();
    
    // Add audio file
    const audioBlob = {
      uri: audioUri,
      type: 'audio/m4a',
      name: `voice_${userId}.m4a`,
    } as any;
    
    formData.append('files', audioBlob);
    formData.append('name', name);
    formData.append('description', `Voice clone for user ${userId}`);
    
    // Make API request
    const response = await fetch(`${ELEVEN_LABS_BASE_URL}/voices/add`, {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVEN_LABS_API_KEY,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData: ElevenLabsError = await response.json();
      throw new Error(
        errorData?.detail?.message || `API request failed with status ${response.status}`
      );
    }

    const data: VoiceCloneResponse = await response.json();
    
    return {
      success: true,
      voiceId: data.voice_id,
    };
  } catch (error) {
    console.error('Error creating voice clone:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Gets the status of a voice clone
 * @param voiceId - Eleven Labs voice ID
 * @returns Voice details including status
 */
export async function getVoiceCloneStatus(
  voiceId: string
): Promise<{ success: boolean; status?: string; error?: string }> {
  try {
    if (!ELEVEN_LABS_API_KEY) {
      throw new Error('Eleven Labs API key is not configured');
    }

    const response = await fetch(`${ELEVEN_LABS_BASE_URL}/voices/${voiceId}`, {
      method: 'GET',
      headers: {
        'xi-api-key': ELEVEN_LABS_API_KEY,
      },
    });

    if (!response.ok) {
      const errorData: ElevenLabsError = await response.json();
      throw new Error(
        errorData?.detail?.message || `API request failed with status ${response.status}`
      );
    }

    const data: VoiceCloneResponse = await response.json();
    
    return {
      success: true,
      status: data.fine_tuning?.finetuning_state || 'ready',
    };
  } catch (error) {
    console.error('Error getting voice clone status:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Converts audio to a different voice using Speech-to-Speech API
 * @param audioUri - Local URI of the audio file
 * @param voiceId - Eleven Labs voice ID to convert to
 * @returns Local URI of the voice-converted audio file
 */
export async function voiceChanger(
  audioUri: string,
  voiceId: string
): Promise<{ success: boolean; audioUri?: string; error?: string }> {
  try {
    if (!ELEVEN_LABS_API_KEY) {
      throw new Error('Eleven Labs API key is not configured');
    }

    // Read the audio file info
    const audioInfo = await FileSystem.getInfoAsync(audioUri);
    if (!audioInfo.exists) {
      throw new Error('Audio file does not exist');
    }

    console.log('Voice changer - Audio file exists:', audioUri);

    // Create form data
    const formData = new FormData();
    
    // Add audio file
    const audioBlob = {
      uri: audioUri,
      type: 'audio/mpeg',
      name: 'audio.mp3',
    } as any;
    
    formData.append('audio', audioBlob);
    formData.append('model_id', 'eleven_english_sts_v2');
    
    console.log('Voice changer - Sending request to Eleven Labs');

    // Make API request to speech-to-speech endpoint
    const response = await fetch(
      `${ELEVEN_LABS_BASE_URL}/speech-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVEN_LABS_API_KEY,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Voice changer API error:', errorText);
      throw new Error(
        `API request failed with status ${response.status}: ${errorText}`
      );
    }

    console.log('Voice changer - Got response, saving audio');

    // ElevenLabs returns MP3 format - save as mp3
    const responseAudioBlob = await response.blob();
    const outputUri = `${FileSystem.documentDirectory}voice_changed_${Date.now()}.mp3`;
    
    // Convert blob to base64 and save
    const reader = new FileReader();
    const base64Audio = await new Promise<string>((resolve, reject) => {
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(responseAudioBlob);
    });

    await FileSystem.writeAsStringAsync(outputUri, base64Audio, {
      encoding: FileSystem.EncodingType.Base64,
    });

    console.log('Voice changer - Audio saved as mp3:', outputUri);

    return {
      success: true,
      audioUri: outputUri,
    };
  } catch (error) {
    console.error('Error in voice changer:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Converts text to speech using a cloned voice
 * @param text - Text to convert to speech
 * @param voiceId - Eleven Labs voice ID
 * @returns Local URI of the generated audio file
 */
export async function textToSpeech(
  text: string,
  voiceId: string
): Promise<{ success: boolean; audioUri?: string; error?: string }> {
  try {
    if (!ELEVEN_LABS_API_KEY) {
      throw new Error('Eleven Labs API key is not configured');
    }

    if (!text || text.trim().length === 0) {
      throw new Error('Text is required for text-to-speech conversion');
    }

    // Make API request
    const response = await fetch(
      `${ELEVEN_LABS_BASE_URL}/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVEN_LABS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorData: ElevenLabsError = await response.json();
      throw new Error(
        errorData?.detail?.message || `API request failed with status ${response.status}`
      );
    }

    // Save audio to file
    const audioBlob = await response.blob();
    const audioUri = `${FileSystem.documentDirectory}cloned_audio_${Date.now()}.mp3`;
    
    // Convert blob to base64 and save
    const reader = new FileReader();
    const base64Audio = await new Promise<string>((resolve, reject) => {
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(audioBlob);
    });

    await FileSystem.writeAsStringAsync(audioUri, base64Audio, {
      encoding: FileSystem.EncodingType.Base64,
    });

    return {
      success: true,
      audioUri,
    };
  } catch (error) {
    console.error('Error converting text to speech:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Deletes a voice clone
 * @param voiceId - Eleven Labs voice ID
 * @returns Success status
 */
export async function deleteVoiceClone(
  voiceId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!ELEVEN_LABS_API_KEY) {
      throw new Error('Eleven Labs API key is not configured');
    }

    const response = await fetch(`${ELEVEN_LABS_BASE_URL}/voices/${voiceId}`, {
      method: 'DELETE',
      headers: {
        'xi-api-key': ELEVEN_LABS_API_KEY,
      },
    });

    if (!response.ok) {
      const errorData: ElevenLabsError = await response.json();
      throw new Error(
        errorData?.detail?.message || `API request failed with status ${response.status}`
      );
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error('Error deleting voice clone:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Gets a list of all voices for the current user
 * @returns List of voices
 */
export async function getVoicesList(): Promise<{
  success: boolean;
  voices?: Array<{ voice_id: string; name: string; category: string }>;
  error?: string;
}> {
  try {
    if (!ELEVEN_LABS_API_KEY) {
      throw new Error('Eleven Labs API key is not configured');
    }

    const response = await fetch(`${ELEVEN_LABS_BASE_URL}/voices`, {
      method: 'GET',
      headers: {
        'xi-api-key': ELEVEN_LABS_API_KEY,
      },
    });

    if (!response.ok) {
      const errorData: ElevenLabsError = await response.json();
      throw new Error(
        errorData?.detail?.message || `API request failed with status ${response.status}`
      );
    }

    const data = await response.json();
    
    return {
      success: true,
      voices: data.voices || [],
    };
  } catch (error) {
    console.error('Error getting voices list:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Validates that the API key is configured and working
 * @returns Whether the API is accessible
 */
export async function validateApiKey(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    if (!ELEVEN_LABS_API_KEY) {
      throw new Error('Eleven Labs API key is not configured');
    }

    const response = await fetch(`${ELEVEN_LABS_BASE_URL}/user`, {
      method: 'GET',
      headers: {
        'xi-api-key': ELEVEN_LABS_API_KEY,
      },
    });

    if (!response.ok) {
      throw new Error(`API key validation failed with status ${response.status}`);
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error('Error validating API key:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

