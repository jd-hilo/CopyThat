import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { Typography } from '@/components/ui/Typography';
import { formatDuration } from '@/utils/timeUtils';
import { X, Mic, Play, Pause, Check } from 'lucide-react-native';
import { createVoiceClone } from '@/lib/elevenLabs';
import { supabase } from '@/lib/supabase';

interface VoiceCloningModalProps {
  visible: boolean;
  onClose: () => void;
  userId: string;
  username: string;
  onSuccess: (voiceId: string) => void;
}

const WaveBar = ({
  index,
  isRecording,
  isPlaying = false,
}: {
  index: number;
  isRecording: boolean;
  isPlaying?: boolean;
}) => {
  const barHeight = useSharedValue(8 + Math.random() * 22);
  const colors = [
    '#83E8FF',
    '#0099FF',
    '#00FF6E',
    '#FD8CFF',
    '#FF006F',
    '#FFFB00',
    '#FFFFFF',
  ];
  const activeColor = colors[index % colors.length];
  const delay = index * 50;

  useEffect(() => {
    if (isRecording) {
      barHeight.value = withRepeat(
        withSequence(
          withTiming(delay + 30 + Math.random() * 20, { duration: 500 }),
          withTiming(8 + Math.random() * 12, { duration: 500 })
        ),
        -1,
        true
      );
    } else if (isPlaying) {
      barHeight.value = withRepeat(
        withSequence(
          withTiming(delay + 60 + Math.random() * 50, { duration: 150 }),
          withTiming(25 + Math.random() * 35, { duration: 150 })
        ),
        -1,
        true
      );
    } else {
      barHeight.value = 8 + Math.random() * 15;
    }
  }, [isRecording, isPlaying]);

  const animatedStyle = useAnimatedStyle(() => ({
    height: barHeight.value,
    backgroundColor: isRecording ? activeColor : '#DADADA',
    opacity: isRecording ? 1 : 0.32,
    width: 4,
    borderRadius: 15.6257,
  }));

  return <Animated.View style={animatedStyle} />;
};

export function VoiceCloningModal({
  visible,
  onClose,
  userId,
  username,
  onSuccess,
}: VoiceCloningModalProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingComplete, setRecordingComplete] = useState(false);
  
  const recording = useRef<Audio.Recording | null>(null);
  const recordingUri = useRef<string | null>(null);
  const sound = useRef<Audio.Sound | null>(null);
  const pulseOpacity = useSharedValue(0);
  const recordingDotScale = useSharedValue(1);

  // Minimum 30 seconds, maximum 60 seconds
  const MIN_DURATION = 30;
  const MAX_DURATION = 60;

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (recording.current) {
        recording.current.stopAndUnloadAsync();
      }
      if (sound.current) {
        sound.current.unloadAsync();
      }
    };
  }, []);

  useEffect(() => {
    if (isRecording) {
      recordingDotScale.value = withRepeat(
        withSequence(
          withTiming(1.3, { duration: 600, easing: Easing.ease }),
          withTiming(1, { duration: 600, easing: Easing.ease })
        ),
        -1,
        true
      );
    } else {
      recordingDotScale.value = withTiming(1);
    }
  }, [isRecording]);

  useEffect(() => {
    if (isRecording) {
      const interval = setInterval(() => {
        setDuration((prev) => {
          if (prev + 1 >= MAX_DURATION) {
            stopRecording();
            return MAX_DURATION;
          }
          return prev + 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isRecording]);

  const resetModal = () => {
    setIsRecording(false);
    setIsPlaying(false);
    setDuration(0);
    setIsProcessing(false);
    setRecordingComplete(false);
    recordingUri.current = null;
    if (recording.current) {
      recording.current.stopAndUnloadAsync();
      recording.current = null;
    }
    if (sound.current) {
      sound.current.unloadAsync();
      sound.current = null;
    }
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  const startRecording = async () => {
    try {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      const newRecording = new Audio.Recording();
      await newRecording.prepareToRecordAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      await newRecording.startAsync();
      
      recording.current = newRecording;
      setIsRecording(true);
      setDuration(0);
      setRecordingComplete(false);
      
      pulseOpacity.value = withRepeat(
        withTiming(0.3, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    } catch (err) {
      console.error('Failed to start recording', err);
      Alert.alert('Error', 'Failed to start recording. Please try again.');
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    if (!recording.current) return;

    try {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      setIsRecording(false);
      pulseOpacity.value = withTiming(0, { duration: 300 });

      await recording.current.stopAndUnloadAsync();
      const uri = recording.current.getURI();
      
      if (!uri) {
        throw new Error('Failed to get recording URI');
      }

      recordingUri.current = uri;
      setRecordingComplete(true);
      recording.current = null;
    } catch (err) {
      console.error('Failed to stop recording', err);
      Alert.alert('Error', 'Failed to save recording. Please try again.');
      setIsRecording(false);
    }
  };

  const playRecording = async () => {
    try {
      if (!recordingUri.current) return;

      if (sound.current) {
        const status = await sound.current.getStatusAsync();
        if (status.isLoaded && status.isPlaying) {
          await sound.current.pauseAsync();
          setIsPlaying(false);
          return;
        } else if (status.isLoaded) {
          await sound.current.playAsync();
          setIsPlaying(true);
          return;
        }
      }

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: recordingUri.current },
        { shouldPlay: true }
      );

      sound.current = newSound;
      setIsPlaying(true);

      newSound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) return;
        if (status.didJustFinish) {
          setIsPlaying(false);
          sound.current?.unloadAsync();
          sound.current = null;
        }
      });
    } catch (error) {
      console.error('Error playing recording:', error);
      setIsPlaying(false);
    }
  };

  const handleSubmit = async () => {
    if (!recordingUri.current) {
      Alert.alert('Error', 'No recording available');
      return;
    }

    if (duration < MIN_DURATION) {
      Alert.alert(
        'Recording Too Short',
        `Please record at least ${MIN_DURATION} seconds for voice cloning to work properly.`
      );
      return;
    }

    setIsProcessing(true);

    try {
      // Create voice clone with Eleven Labs
      const result = await createVoiceClone(
        recordingUri.current,
        userId,
        `${username}'s Voice`
      );

      if (!result.success || !result.voiceId) {
        throw new Error(result.error || 'Failed to create voice clone');
      }

      // Update user profile with voice clone ID
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          voice_clone_id: result.voiceId,
          voice_clone_status: 'ready',
          voice_clone_recording_url: recordingUri.current,
        })
        .eq('id', userId);

      if (updateError) {
        throw updateError;
      }

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      Alert.alert(
        'Success!',
        'Your voice has been cloned successfully. You can now use it when recording.',
        [
          {
            text: 'Got it',
            onPress: () => {
              onSuccess(result.voiceId!);
              handleClose();
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error submitting voice clone:', error);
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to create voice clone. Please try again.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const recordingDotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: recordingDotScale.value }],
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <X size={24} color="#000" />
          </TouchableOpacity>
          <Typography variant="h2" style={styles.headerTitle}>
            Record Your Voice
          </Typography>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Instructions */}
          <View style={styles.instructionsContainer}>
            <Typography variant="h3" style={styles.instructionsTitle}>
              Voice Cloning Instructions
            </Typography>
            <Typography variant="body" style={styles.instructionsText}>
              {'Record 30-60 seconds of clear audio:\n\n' +
                '• Speak naturally in a quiet environment\n' +
                '• Use your normal speaking voice\n' +
                '• Vary your tone and emotion\n' +
                '• Talk about anything you like\n' +
                '• Ensure good audio quality'}
            </Typography>
          </View>

          {/* Waveform */}
          <View style={styles.waveformContainer}>
            {[...Array(20)].map((_, i) => (
              <WaveBar
                key={i}
                index={i}
                isRecording={isRecording}
                isPlaying={isPlaying}
              />
            ))}
          </View>

          {/* Duration Display */}
          <View style={styles.durationContainer}>
            <Typography variant="body" style={styles.durationText}>
              {formatDuration(duration)} / {formatDuration(MAX_DURATION)}
            </Typography>
            {duration > 0 && duration < MIN_DURATION && (
              <Typography variant="bodySmall" style={styles.minDurationWarning}>
                Minimum {MIN_DURATION} seconds required
              </Typography>
            )}
          </View>

          {/* Controls */}
          <View style={styles.controlsContainer}>
            {!recordingComplete ? (
              <TouchableOpacity
                style={styles.recordButton}
                onPress={() => {
                  if (isRecording) {
                    stopRecording();
                  } else {
                    startRecording();
                  }
                }}
              >
                <Animated.View style={[styles.pulse, pulseStyle]} />
                {isRecording && (
                  <Animated.View style={[styles.recordingDot, recordingDotStyle]} />
                )}
                <Mic size={28} color="#FFFFFF" />
              </TouchableOpacity>
            ) : (
              <View style={styles.reviewControls}>
                <TouchableOpacity
                  style={styles.playButton}
                  onPress={playRecording}
                >
                  {isPlaying ? (
                    <Pause size={24} color="#000" />
                  ) : (
                    <Play size={24} color="#000" />
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={() => {
                    resetModal();
                  }}
                >
                  <Typography variant="body" style={styles.retryText}>
                    Try Again
                  </Typography>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Submit Button */}
          {recordingComplete && duration >= MIN_DURATION && (
            <TouchableOpacity
              style={[
                styles.submitButton,
                isProcessing && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <ActivityIndicator color="#FFFFFF" />
                  <Typography variant="body" style={styles.submitButtonText}>
                    Processing...
                  </Typography>
                </>
              ) : (
                <>
                  <Check size={20} color="#FFFFFF" />
                  <Typography variant="body" style={styles.submitButtonText}>
                    Create Voice Clone
                  </Typography>
                </>
              )}
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  instructionsContainer: {
    backgroundColor: '#F6F6F6',
    borderRadius: 20,
    padding: 20,
    marginBottom: 30,
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    marginBottom: 12,
  },
  instructionsText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#666',
  },
  durationContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  durationText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8A8E8F',
    fontFamily: 'Nunito-SemiBold',
  },
  minDurationWarning: {
    fontSize: 12,
    color: '#FF6B6B',
    marginTop: 4,
  },
  waveformContainer: {
    width: 247,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: 80,
    marginTop: 0,
    marginBottom: 30,
    gap: 4,
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.01)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
    position: 'relative',
    alignSelf: 'center',
  },
  controlsContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  recordButton: {
    width: 102,
    height: 78,
    backgroundColor: '#1D1D1D',
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 14,
    position: 'relative',
  },
  pulse: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1D1D1D',
    borderRadius: 26,
    opacity: 0.4,
  },
  recordingDot: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FF0000',
  },
  reviewControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  playButton: {
    width: 60,
    height: 60,
    backgroundColor: '#FFEFB4',
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#F0F0F0',
    borderRadius: 25,
  },
  retryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  submitButton: {
    flexDirection: 'row',
    backgroundColor: '#1D1D1D',
    borderRadius: 30,
    paddingVertical: 18,
    paddingHorizontal: 32,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginTop: 20,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

