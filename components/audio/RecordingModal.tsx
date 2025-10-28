import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Alert, Platform, ActivityIndicator, TextInput } from 'react-native';
import { Mic, X, Pause, Play } from 'lucide-react-native';
import { Typography } from '@/components/ui/Typography';
import { theme } from '@/constants/theme';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { supabase } from '@/lib/supabase';
import { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence, withDelay, Easing } from 'react-native-reanimated';
import { formatDuration } from '@/utils/timeUtils';
import Animated from 'react-native-reanimated';
import { createStory } from '@/lib/stories';
import { createFeedback } from '@/lib/feedback';
import { CategorySelector } from '@/components/audio/CategorySelector';

interface RecordingModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSave: () => void;
  mode?: 'story' | 'feedback';
}

const WaveBar = ({ index, isRecording }: { index: number; isRecording: boolean }) => {
  const height = useSharedValue(12 + Math.random() * 20);
  const colors = ["#FFD700", "#FFA500", "#00FF6E", "#FD8CFF", "#FF006F", "#FFFB00"];
  const color = colors[index % colors.length];
  const delay = index * 100;

  useEffect(() => {
    if (isRecording) {
      height.value = withRepeat(
        withSequence(
          withDelay(
            delay,
            withTiming(24 + Math.random() * 12, { duration: 500 })
          ),
          withTiming(12 + Math.random() * 8, { duration: 500 })
        ),
        -1,
        true
      );
    } else {
      height.value = withTiming(12 + Math.random() * 20, { duration: 300 });
    }
  }, [isRecording]);

  const animatedStyle = useAnimatedStyle(() => ({
    height: height.value,
    backgroundColor: color,
    width: 4,
    borderRadius: 2,
    marginHorizontal: 1,
  }));

  return <Animated.View style={animatedStyle} />;
};

export function RecordingModal({ isVisible, onClose, onSave, mode = 'story' }: RecordingModalProps) {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<'Personal' | 'Music' | 'News' | 'Comedy' | 'Education' | 'Stories' | 'Business' | 'Technology' | 'Health' | 'Entertainment' | 'Sports' | 'Other'>('Personal');
  const [isSaving, setIsSaving] = useState(false);
  
  const recordingUri = useRef<string | null>(null);
  const sound = useRef<Audio.Sound | null>(null);
  const pulseOpacity = useSharedValue(0);
  const recordingDotScale = useSharedValue(1);
  const finalDuration = useRef<number>(0);

  const resetModal = () => {
    setRecording(null);
    setIsRecording(false);
    setIsReviewing(false);
    setIsPlaying(false);
    setDuration(0);
    setTitle('');
    setDescription('');
    setCategory('Personal');
    setIsSaving(false);
    recordingUri.current = null;
    if (sound.current) {
      sound.current.unloadAsync();
      sound.current = null;
    }
    pulseOpacity.value = withTiming(0);
    recordingDotScale.value = withTiming(1);
    finalDuration.current = 0;
  };

  useEffect(() => {
    return () => {
      if (recording) {
        recording.stopAndUnloadAsync();
      }
      if (sound.current) {
        sound.current.unloadAsync();
      }
      // Reset audio mode to allow full playback volume
      Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      }).catch((err) => {
        console.warn('Error resetting audio mode during cleanup:', err);
      });
    };
  }, [recording]);

  // Reset modal when it becomes visible
  useEffect(() => {
    if (isVisible) {
      resetModal();
    }
  }, [isVisible]);

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
        setDuration(prev => {
          if (prev + 1 >= 120) {
            stopRecording();
            return 120;
          }
          return prev + 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isRecording]);

  const recordingDotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: recordingDotScale.value }],
  }));

  const handleModalClose = async () => {
    // Reset audio mode to restore full playback volume
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      });
    } catch (err) {
      console.warn('Error resetting audio mode on close:', err);
    }
    resetModal();
    onClose();
  };

  const startRecording = async () => {
    try {
      if (Platform.OS === 'ios') {
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

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
      setIsRecording(true);
      setDuration(0);
      finalDuration.current = 0;
      pulseOpacity.value = withRepeat(
        withTiming(0.3, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    } catch (err) {
      console.error('Failed to start recording', err);
      setIsRecording(false);
      setDuration(0);
    }
  };

  const stopRecording = async () => {
    try {
      if (!recording) return;

      if (Platform.OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      setIsRecording(false);
      pulseOpacity.value = withTiming(0, { duration: 300 });

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      });

      if (uri) {
        recordingUri.current = uri;
        setIsReviewing(true);
      }
    } catch (err) {
      console.error('Failed to stop recording', err);
      setDuration(0);
    }
  };

  const playRecording = async () => {
    try {
      if (!recordingUri.current) return;

      if (sound.current) {
        if (isPlaying) {
          await sound.current.pauseAsync();
          setIsPlaying(false);
        } else {
          await sound.current.playAsync();
          setIsPlaying(true);
        }
        return;
      }

      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
        allowsRecordingIOS: false,
      });

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: recordingUri.current },
        { 
          progressUpdateIntervalMillis: 1000,
          shouldPlay: true,
          volume: 1.0,
          rate: 1.0,
          isMuted: false,
          isLooping: false,
          shouldCorrectPitch: true
        }
      );

      await newSound.setVolumeAsync(1.0);
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
    } catch (err) {
      console.error('Failed to play recording', err);
      setIsPlaying(false);
      if (sound.current) {
        try {
          await sound.current.unloadAsync();
        } catch (cleanupError) {
          console.warn('Error cleaning up sound:', cleanupError);
        }
        sound.current = null;
      }
    }
  };

  const restartRecording = () => {
    if (sound.current) {
      sound.current.unloadAsync();
      sound.current = null;
    }
    recordingUri.current = null;
    setIsReviewing(false);
    setIsPlaying(false);
    setDuration(0);
    finalDuration.current = 0;
    setTitle('');
    setDescription('');
  };

  const handleSave = async () => {
    if (!recordingUri.current || (mode === 'story' && !title.trim())) return;

    try {
      setIsSaving(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      if (mode === 'story') {
        await createStory(recordingUri.current, user.id, {
          title: title.trim(),
          description: description.trim(),
          category,
          duration
        });
      } else {
        await createFeedback({
          audioUri: recordingUri.current,
          duration
        });
      }

      // Reset audio mode to restore full playback volume after saving
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          shouldDuckAndroid: false,
          playThroughEarpieceAndroid: false,
        });
      } catch (err) {
        console.warn('Error resetting audio mode on save:', err);
      }

      resetModal();
      onSave();
      onClose();
    } catch (error) {
      console.error('Failed to save:', error);
      Alert.alert('Error', 'Failed to save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const pulseStyle = useAnimatedStyle(() => {
    return {
      opacity: pulseOpacity.value,
    };
  });

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={handleModalClose} style={styles.closeButton}>
              <X size={24} color={theme.colors.text.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            {!isReviewing ? (
              <View style={styles.recordingSection}>
                <Typography variant="h2" style={styles.title}>
                  {mode === 'story' ? 'create a story' : 'leave your feedback'}
                </Typography>
                
                <View style={styles.waveformContainer}>
                  <View style={styles.audioWaveform}>
                    {[...Array(20)].map((_, i) => (
                      <WaveBar key={i} index={i} isRecording={isRecording} />
                    ))}
                  </View>
                </View>

                <View style={styles.recordingControlsRow}>
                  <View style={styles.recordingInfo}>
                    <Typography variant="bodySmall" style={styles.maxDurationLabel}>
                      Max 2 minutes
                    </Typography>
                    <Typography variant="body" style={styles.timer}>
                      {formatDuration(duration)}
                    </Typography>
                  </View>
                  <TouchableOpacity
                    style={[styles.recordButton, isRecording && styles.recordingButton]}
                    onPress={isRecording ? stopRecording : startRecording}
                  >
                    <Animated.View style={[styles.pulse, pulseStyle]} />
                    {isRecording ? (
                      <Pause size={24} color={theme.colors.white} />
                    ) : (
                      <Mic size={24} color={theme.colors.white} />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.reviewSection}>
                <Typography variant="h2" style={styles.title}>
                  {mode === 'story' ? 'create a story' : 'leave your feedback'}
                </Typography>
                
                <View style={styles.waveformContainer}>
                  <View style={styles.audioWaveform}>
                    {[...Array(20)].map((_, i) => (
                      <WaveBar key={i} index={i} isRecording={isPlaying} />
                    ))}
                  </View>
                </View>

                <View style={styles.reviewControls}>
                  <TouchableOpacity
                    style={styles.playButton}
                    onPress={playRecording}
                    disabled={isSaving}
                  >
                    {isPlaying ? (
                      <Pause size={24} color={theme.colors.text.primary} />
                    ) : (
                      <Play size={24} color={theme.colors.text.primary} />
                    )}
                  </TouchableOpacity>
                  <Typography variant="body" style={styles.duration}>
                    {formatDuration(duration)}
                  </Typography>
                </View>

                <View style={styles.formContainer}>
                  {mode === 'story' && (
                    <>
                      <TextInput
                        style={styles.input}
                        placeholder="Title of your story"
                        value={title}
                        onChangeText={setTitle}
                      />
                      <TextInput
                        style={[styles.input, styles.descriptionInput]}
                        placeholder="Add a description (optional)"
                        value={description}
                        onChangeText={setDescription}
                        multiline
                      />
                      <CategorySelector selectedCategory={category} onSelectCategory={setCategory} />
                    </>
                  )}
                </View>

                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={styles.restartButton}
                    onPress={restartRecording}
                    disabled={isSaving}
                  >
                    <Typography variant="body" style={styles.restartText}>
                      restart
                    </Typography>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.submitButton, isSaving && styles.submitButtonDisabled]}
                    onPress={handleSave}
                    disabled={isSaving || (mode === 'story' && !title.trim())}
                  >
                    <Typography variant="body" style={styles.submitText}>
                      {isSaving ? 'saving...' : (mode === 'story' ? 'save story' : 'submit feedback')}
                    </Typography>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    maxHeight: '60%',
    width: '90%',
    alignSelf: 'center',
    marginTop: 'auto',
    marginBottom: 'auto',
    ...theme.shadows.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: theme.spacing.xl,
  },
  title: {
    fontFamily: 'Nunito',
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.text.primary,
    textTransform: 'lowercase',
    marginBottom: theme.spacing.xl,
    textAlign: 'center',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.background.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.sm,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordingSection: {
    alignItems: 'center',
    width: '100%',
  },
  reviewSection: {
    alignItems: 'center',
    width: '100%',
    gap: theme.spacing.xl,
  },
  waveformContainer: {
    width: '100%',
    height: 90,
    justifyContent: 'center',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.lg,
  },
  audioWaveform: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: 100,
    gap: 4,
  },
  recordingControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    marginTop: 32,
  },
  recordingInfo: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  maxDurationLabel: {
    color: '#8A8E8F',
    fontSize: 13,
    fontFamily: 'Nunito',
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 2,
  },
  timer: {
    fontFamily: 'Nunito',
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.text.primary,
    letterSpacing: 1,
  },
  recordButton: {
    width: 102,
    height: 78,
    backgroundColor: theme.colors.text.primary,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.md,
  },
  recordingButton: {
    backgroundColor: theme.colors.error,
  },
  pulse: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.text.primary,
    borderRadius: 26,
    opacity: 0.4,
  },
  reviewControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  playButton: {
    width: 60,
    height: 60,
    borderRadius: theme.borderRadius.full,
    backgroundColor: '#FFEFB4',
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.md,
  },
  duration: {
    color: theme.colors.text.primary,
    fontSize: 16,
    fontFamily: 'Nunito',
    fontWeight: '600',
  },
  formContainer: {
    width: '100%',
    gap: theme.spacing.md,
  },
  input: {
    width: '100%',
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    fontSize: 16,
    fontFamily: 'Nunito',
    color: theme.colors.text.primary,
  },
  descriptionInput: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    width: '100%',
    justifyContent: 'center',
  },
  restartButton: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.borderRadius.md,
    ...theme.shadows.sm,
  },
  submitButton: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    backgroundColor: '#FFEFB4',
    borderRadius: theme.borderRadius.md,
    ...theme.shadows.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  restartText: {
    color: theme.colors.text.primary,
    fontSize: 16,
    fontFamily: 'Nunito',
    fontWeight: '600',
  },
  submitText: {
    color: theme.colors.text.primary,
    fontSize: 16,
    fontFamily: 'Nunito',
    fontWeight: '600',
  },
});