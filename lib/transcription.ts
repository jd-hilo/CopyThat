import * as FileSystem from 'expo-file-system';

interface TranscriptionSessionConfig {
  model: 'whisper-1' | 'gpt-4o-transcribe' | 'gpt-4o-mini-transcribe';
  language?: string;
  prompt?: string;
}

interface TranscriptionSession {
  ws: WebSocket;
  sessionId: string;
  onTranscriptionDelta?: (delta: string) => void;
  onTranscriptionComplete?: (transcript: string) => void;
  onError?: (error: Error) => void;
}

let activeSession: TranscriptionSession | null = null;

async function createTranscriptionSession(config: TranscriptionSessionConfig): Promise<TranscriptionSession> {
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OpenAI API key is not configured');
  }

  try {
    console.log('Creating transcription session with config:', {
      model: config.model,
      language: config.language
    });

    // First create the session via REST API
    const response = await fetch('https://api.openai.com/v1/audio/realtime/transcription-sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        object: 'realtime.transcription_session',
        input_audio_format: 'pcm16',
        input_audio_transcription: [{
          model: config.model,
          language: config.language || 'en',
          prompt: config.prompt,
        }],
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 1000,
          silence_duration_ms: 700,
        },
        input_audio_noise_reduction: {
          type: 'near_field'
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to create transcription session:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      throw new Error(`Failed to create transcription session: ${response.statusText}`);
    }

    const sessionData = await response.json();
    console.log('Session created:', sessionData);
    const sessionId = sessionData.id;

    // Create WebSocket connection
    const ws = new WebSocket(`wss://api.openai.com/v1/audio/realtime/transcription-sessions/${sessionId}/ws?api_key=${apiKey}`);

    return new Promise((resolve, reject) => {
      const session: TranscriptionSession = {
        ws,
        sessionId,
        onTranscriptionDelta: undefined,
        onTranscriptionComplete: undefined,
        onError: undefined,
      };

      ws.onopen = () => {
        console.log('WebSocket connection opened');
        activeSession = session;
        resolve(session);
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('Received websocket message:', data);
        
        switch (data.type) {
          case 'conversation.item.input_audio_transcription.delta':
            session.onTranscriptionDelta?.(data.delta);
            break;
          case 'conversation.item.input_audio_transcription.completed':
            session.onTranscriptionComplete?.(data.transcript);
            break;
          default:
            console.log('Unknown message type:', data.type);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        session.onError?.(new Error('WebSocket error occurred'));
        reject(error);
      };

      ws.onclose = (event) => {
        console.log('WebSocket connection closed:', event.code, event.reason);
        if (activeSession === session) {
          activeSession = null;
        }
      };

      // Set a timeout for the connection
      setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          ws.close();
          reject(new Error('WebSocket connection timeout'));
        }
      }, 10000);
    });
  } catch (error) {
    console.error('Error creating transcription session:', error);
    throw error;
  }
}

export async function startRealtimeTranscription(
  onTranscriptionDelta: (text: string) => void,
  onTranscriptionComplete: (text: string) => void,
  onError: (error: Error) => void,
  config: Partial<TranscriptionSessionConfig> = {}
): Promise<() => void> {
  try {
    console.log('Starting realtime transcription');

    if (activeSession) {
      console.log('Closing existing session');
      activeSession.ws.close();
      activeSession = null;
    }

    const session = await createTranscriptionSession({
      model: 'whisper-1',
      language: 'en',
      ...config
    });

    console.log('Session created successfully');

    session.onTranscriptionDelta = onTranscriptionDelta;
    session.onTranscriptionComplete = onTranscriptionComplete;
    session.onError = onError;

    // Return cleanup function
    return () => {
      console.log('Cleaning up transcription session');
      if (session.ws.readyState === WebSocket.OPEN) {
        session.ws.close();
      }
      if (activeSession === session) {
        activeSession = null;
      }
    };
  } catch (error) {
    console.error('Error starting realtime transcription:', error);
    onError(error instanceof Error ? error : new Error('Failed to start transcription'));
    return () => {}; // Return no-op cleanup function
  }
}

export function sendAudioChunk(audioData: string) {
  if (!activeSession) {
    console.error('No active transcription session');
    return;
  }

  if (activeSession.ws.readyState !== WebSocket.OPEN) {
    console.error('WebSocket not open:', activeSession.ws.readyState);
    return;
  }

  try {
    activeSession.ws.send(JSON.stringify({
      type: 'input_audio_buffer.append',
      data: audioData,
      encoding: 'base64'
    }));
  } catch (error) {
    console.error('Error sending audio chunk:', error);
  }
}

// Keep the old one-shot transcription for files
export async function transcribeAudioFile(fileUri: string): Promise<string | null> {
  try {
    console.log('Starting file transcription for:', fileUri);

    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    console.log('File info:', fileInfo);

    if (!fileInfo.exists) {
      console.error('File does not exist:', fileUri);
      return null;
    }

    if (!fileInfo.uri) {
      console.error('Invalid file URI');
      return null;
    }

    if (fileInfo.size && fileInfo.size > 25 * 1024 * 1024) {
      console.error('File too large:', fileInfo.size);
      return null;
    }

    const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
    if (!apiKey) {
      console.error('OpenAI API key is not configured');
      return null;
    }

    const formData = new FormData();
    formData.append('file', {
      uri: fileUri,
      name: 'audio.m4a',
      type: 'audio/m4a',
    } as any);
    formData.append('model', 'whisper-1');
    formData.append('language', 'en');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'multipart/form-data',
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API Error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      return null;
    }

    const data = await response.json();
    return data.text || null;
  } catch (error) {
    console.error('Error transcribing audio file:', error);
    return null;
  }
} 