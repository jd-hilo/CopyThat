import { supabase } from './supabase';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';

const STORAGE_BUCKET_NAME = 'stories';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function uploadAudio(uri: string, userId: string): Promise<string | null> {
  console.log('=== Starting uploadAudio ===');
  console.log('DEBUG: Input parameters:', { uri, userId });

  try {
    // Basic validation
    if (!uri || !userId) {
      console.error('DEBUG: Missing required parameters');
      return null;
    }

    // Check authentication
    console.log('DEBUG: Checking authentication');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.error('DEBUG: User not authenticated');
      return null;
    }

    // Handle mobile file URI
    let fileUri = uri;
    if (Platform.OS !== 'web') {
      console.log('DEBUG: Processing mobile file URI');
    
      // Check if file exists
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (!fileInfo.exists) {
        console.error('DEBUG: File does not exist:', fileUri);
        return null;
      }
      
      console.log('DEBUG: File info:', {
        size: fileInfo.size,
        uri: fileInfo.uri,
        isDirectory: fileInfo.isDirectory
      });

      if (fileInfo.size > MAX_FILE_SIZE) {
        console.error('DEBUG: File too large:', fileInfo.size);
        return null;
      }

      // Detect file extension and content type
      const isMP3 = fileUri.toLowerCase().endsWith('.mp3');
      const fileExtension = isMP3 ? '.mp3' : '.m4a';
      const contentType = isMP3 ? 'audio/mpeg' : 'audio/mp4';
      
      // Generate file path
      const filename = `${userId}/${Date.now()}${fileExtension}`;
      const filePath = `audio/${filename}`;
      console.log('DEBUG: Generated file path:', filePath, 'Content type:', contentType);
    
      // Get the upload URL from Supabase
      console.log('DEBUG: Getting upload URL from Supabase');
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from(STORAGE_BUCKET_NAME)
        .createSignedUploadUrl(filePath);

      if (signedUrlError || !signedUrlData?.signedUrl) {
        console.error('DEBUG: Failed to get signed URL:', signedUrlError);
        return null;
      }

      // Upload the file using FileSystem
      console.log('DEBUG: Starting file upload');
      const uploadResult = await FileSystem.uploadAsync(
        signedUrlData.signedUrl,
        fileUri,
        {
          httpMethod: 'PUT',
          headers: {
            'Content-Type': contentType,
          },
        }
      );

      if (uploadResult.status !== 200) {
        console.error('DEBUG: Upload failed with status:', uploadResult.status);
        return null;
      }

      // Get public URL
      console.log('DEBUG: Getting public URL');
      const { data: { publicUrl } } = supabase.storage
        .from(STORAGE_BUCKET_NAME)
        .getPublicUrl(filePath);

      console.log('DEBUG: Upload successful, public URL:', publicUrl);
      return publicUrl;
    } else {
      // Web handling (using FormData)
      console.log('DEBUG: Processing web file URI');
      const formData = new FormData();
      const file = {
        uri: fileUri,
        name: `${userId}/${Date.now()}.m4a`,
        type: 'audio/mp4',
      } as any; // Type assertion needed for FormData.append in React Native

      formData.append('file', file);

    const { data, error } = await supabase.storage
        .from(STORAGE_BUCKET_NAME)
        .upload(`audio/${userId}/${Date.now()}.m4a`, formData, {
          cacheControl: '3600',
          upsert: false,
          contentType: 'audio/mp4'
        });
      
    if (error) {
        console.error('DEBUG: Upload failed:', error);
      return null;
    }
    
    const { data: { publicUrl } } = supabase.storage
        .from(STORAGE_BUCKET_NAME)
        .getPublicUrl(`audio/${userId}/${Date.now()}.m4a`);
      
    return publicUrl;
    }
  } catch (error) {
    console.error('DEBUG: Error in uploadAudio:', error);
    if (error instanceof Error) {
      console.error('DEBUG: Error details:', {
        message: error.message,
        stack: error.stack
      });
    }
    return null;
  }
}