import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
} from 'react-native';
import { Mic, X, Pause, Play, Square } from 'lucide-react-native';
import { Typography } from '@/components/ui/Typography';
import { theme } from '@/constants/theme';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { supabase } from '@/lib/supabase';
import * as FileSystem from 'expo-file-system';
import {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { formatDuration } from '@/utils/timeUtils';
import Animated from 'react-native-reanimated';
import { transcribeAudioFile } from '@/lib/transcription';
import { showReactionNotificationModal } from '@/lib/notifications';
import { posthog } from '@/posthog';
import { useAuth } from '@/contexts/authContext';
import { mixpanel } from '@/app/_layout';

interface QuickRecordingModalProps {
  storyId: string;
  isVisible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  username?: string;
  replyingTo?: {
    transcription: string;
    reactionId: string;
  };
  onReplyClick?: (reactionId: string) => void;
}

const WaveBar = ({
  index,
  isRecording,
}: {
  index: number;
  isRecording: boolean;
}) => {
  const height = useSharedValue(12 + Math.random() * 20);
  const colors = [
    '#83E8FF',
    '#0099FF',
    '#00FF6E',
    '#FD8CFF',
    '#FF006F',
    '#FFFB00',
  ];
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

export function QuickRecordingModal({
  storyId,
  isVisible,
  onClose,
  onSuccess,
  username,
  replyingTo,
  onReplyClick,
}: QuickRecordingModalProps) {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPlaybackMode, setIsPlaybackMode] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [duration, setDuration] = useState(0);
  const recordingUri = useRef<string | null>(null);
  const sound = useRef<Audio.Sound | null>(null);
  const pulseOpacity = useSharedValue(0);
  const recordingDotScale = useSharedValue(1);
  const finalDuration = useRef<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const flyAnimation = useSharedValue({ x: 0, y: 0, scale: 1, opacity: 1 });
  const [showSendAnimation, setShowSendAnimation] = useState(false);
  const { user } = useAuth();

  // Cleanup audio resources
  useEffect(() => {
    return () => {
      if (recording) {
        recording.stopAndUnloadAsync();
      }
      if (sound.current) {
        sound.current.unloadAsync();
      }
    };
  }, [recording]);

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
          if (prev + 1 >= 45) {
            stopRecording();
            return 45;
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

  const handleModalClose = () => {
    if (recording) {
      recording.stopAndUnloadAsync();
    }
    if (sound.current) {
      sound.current.unloadAsync();
    }
    onClose();
  };

  const startRecording = async () => {
    console.log('DEBUG: startRecording called');

    // Track talk button click event with PostHog
    posthog.capture('talk_button_clicked', {
      story_id: storyId,
      username: username || '',
      is_reply: !!replyingTo,
      timeStamp: new Date().toISOString(),
    });

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

      // Reset audio mode after stopping recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      });

      if (uri) {
        recordingUri.current = uri;
        setIsPlaybackMode(true);
      }
    } catch (err) {
      console.error('Failed to stop recording', err);
      setDuration(0);
    }
  };

  const proceedToSend = () => {
    // Send directly without going to review section
    submitRecording();
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

      setIsLoadingAudio(true);

      // Configure audio mode for better playback
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
          progressUpdateIntervalMillis: 100,
          shouldPlay: true,
          volume: 1.0,
          rate: 1.0,
          isMuted: false,
          isLooping: false,
          shouldCorrectPitch: false, // Disable pitch correction for faster loading
        }
      );
      sound.current = newSound;
      setIsPlaying(true);
      setIsLoadingAudio(false);

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
      if (err instanceof Error) {
        console.error('Error details:', {
          message: err.message,
          stack: err.stack,
        });
      }
      // Reset state on error
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
    setIsPlaybackMode(false);
    setIsPlaying(false);
    setDuration(0);
    finalDuration.current = 0;
  };

  const flyStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: flyAnimation.value.x },
        { translateY: flyAnimation.value.y },
        { scale: flyAnimation.value.scale },
      ],
      opacity: flyAnimation.value.opacity,
    };
  });

  const submitRecording = async () => {
    try {
      setIsSubmitting(true);
      if (!recordingUri.current) {
        console.error('No recording URI available');
        setIsSubmitting(false);
        return;
      }
      const uri = recordingUri.current;

      // Get the audio file as bytes
      const response = await fetch(uri);
      const blob = await response.blob();

      // Convert blob to array buffer
      const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = reject;
        reader.readAsArrayBuffer(blob);
      });
      // Start both transcription and upload in parallel
      const [transcription, uploadResult] = await Promise.all([
        transcribeAudioFile(uri),
        supabase.storage
          .from('reactions')
          .upload(`reactions/${storyId}/${Date.now()}.m4a`, arrayBuffer, {
            contentType: 'audio/m4a',
          }),
      ]);

      if (uploadResult.error) throw uploadResult.error;

      // Create the reaction record
      const { error: reactionError } = await supabase.from('reactions').insert({
        story_id: storyId,
        user_id: user?.id,
        audio_url: uploadResult.data.path,
        duration: duration,
        transcription: transcription,
        reply_to: replyingTo?.reactionId || null,
      });

      if (reactionError) throw reactionError;

      // Track audio reaction submission event with PostHog

      if (sound.current) {
        sound.current.unloadAsync();
        sound.current = null;
      }

      // Show send animation after submit is complete
      setShowSendAnimation(true);
      posthog.capture('audio_reaction_submitted', {
        user: {
          id: user?.id || '',
          email: user?.email || '',
        },
        story_id: storyId,
        username: username || '',
        duration: duration,
        is_reply: !!replyingTo,
        reply_to_reaction_id: replyingTo?.reactionId || null,
        timeStamp: new Date().toISOString(),
      });

      // Increment user points
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('points')
        .eq('id', user?.id)
        .single();
      if (!profileError && profile) {
        await supabase
          .from('profiles')
          .update({ points: (profile.points || 0) + 1 })
          .eq('id', user?.id);
      }
      setTimeout(() => {
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        setShowSendAnimation(false);
        mixpanel.track('Audio reaction posted');
        onSuccess();
        onClose();
      }, 700); // Animation duration
    } catch (err) {
      console.error('Failed to submit recording:', err);
      Alert.alert('Error', 'Failed to send reaction. Please try again.');
      setIsSubmitting(false);
    }
  };

  const pulseStyle = useAnimatedStyle(() => {
    return {
      opacity: pulseOpacity.value,
    };
  });

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleModalClose}
    >
      <TouchableWithoutFeedback onPress={handleModalClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={styles.modalContent}>
              {/* Handle line */}
              <View style={styles.handleLine} />

              <View style={styles.header}>
                <TouchableOpacity
                  onPress={handleModalClose}
                  style={styles.closeButton}
                >
                  <X size={24} color={theme.colors.text.primary} />
                </TouchableOpacity>
              </View>

              <View style={styles.content}>
                {replyingTo && (
                  <TouchableOpacity
                    style={styles.replyingToBox}
                    onPress={() => {
                      onClose();
                      onReplyClick?.(replyingTo.reactionId);
                    }}
                  >
                    <Typography
                      variant="bodySmall"
                      style={styles.replyingToLabel}
                    >
                      replying to...
                    </Typography>
                    <Typography
                      variant="body"
                      style={styles.replyingToText}
                      numberOfLines={2}
                    >
                      {replyingTo.transcription}
                    </Typography>
                  </TouchableOpacity>
                )}

                {!isPlaybackMode ? (
                  <View style={styles.recordingSection}>
                    {!replyingTo && (
                      <Typography variant="h2" style={styles.title}>
                        got something to say to {username}?
                      </Typography>
                    )}

                    <View style={styles.waveformContainer}>
                      <View style={styles.audioWaveform}>
                        {[...Array(20)].map((_, i) => (
                          <WaveBar
                            key={i}
                            index={i}
                            isRecording={isRecording}
                          />
                        ))}
                      </View>
                    </View>

                    <View style={styles.recordingControlsRow}>
                      <View style={styles.recordingInfo}>
                        <Typography
                          variant="bodySmall"
                          style={styles.maxDurationLabel}
                        >
                          Max 45 seconds
                        </Typography>
                        <Typography variant="body" style={styles.timer}>
                          {formatDuration(duration)}
                        </Typography>
                      </View>
                      <TouchableOpacity
                        style={[
                          styles.recordButton,
                          isRecording && styles.recordingButton,
                        ]}
                        onPress={isRecording ? stopRecording : startRecording}
                      >
                        <Animated.View style={[styles.pulse, pulseStyle]} />
                        {isRecording ? (
                          <Square size={24} color={theme.colors.white} />
                        ) : (
                          <Mic size={24} color={theme.colors.white} />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : isPlaybackMode ? (
                  <View style={styles.playbackSection}>
                    <Typography variant="h2" style={styles.title}>
                      listen to your recording
                    </Typography>

                    {/* Audio Duration */}
                    <View style={styles.audioDurationContainer}>
                      <Typography
                        variant="body"
                        style={styles.audioDurationText}
                      >
                        {formatDuration(duration)}
                      </Typography>
                    </View>

                    {/* Audio Visualization */}
                    <View style={styles.audioSection}>
                      <View style={styles.audioWaveform}>
                        {[...Array(20)].map((_, i) => (
                          <WaveBar key={i} index={i} isRecording={isPlaying} />
                        ))}
                      </View>
                      <TouchableOpacity
                        style={styles.playButton}
                        onPress={playRecording}
                      >
                        {isPlaying ? (
                          <Pause size={20} color="#000000" />
                        ) : (
                          <Play size={20} color="#000000" />
                        )}
                      </TouchableOpacity>
                    </View>

                    <View style={styles.playbackActions}>
                      <TouchableOpacity
                        style={styles.restartButton}
                        onPress={() => {
                          setIsPlaybackMode(false);
                          setDuration(0);
                          recordingUri.current = null;
                          if (sound.current) {
                            sound.current.unloadAsync();
                            sound.current = null;
                          }
                        }}
                      >
                        <Typography variant="body" style={styles.restartText}>
                          restart
                        </Typography>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.sendButton,
                          isSubmitting && styles.submitButtonDisabled,
                        ]}
                        onPress={proceedToSend}
                        disabled={isSubmitting}
                      >
                        <Typography variant="body" style={styles.sendText}>
                          {isSubmitting ? 'sending' : 'send'}
                        </Typography>
                        {!isSubmitting && (
                          <Play
                            size={20}
                            color="#FFFFFF"
                            style={styles.playIcon}
                          />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : null}

                {showSendAnimation && (
                  <Animated.View
                    style={{
                      ...StyleSheet.absoluteFillObject,
                      justifyContent: 'center',
                      alignItems: 'center',
                      backgroundColor: 'rgba(255,255,255,1)',
                      zIndex: 99,
                      opacity: 1,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 24,
                        color: '#000000',
                        fontFamily: 'Nunito-Regular',
                        fontWeight: '600',
                      }}
                    >
                      sent! 🎉
                    </Text>
                  </Animated.View>
                )}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Playback Section
  playbackSection: {
    alignItems: 'center',
    gap: 16,
  },
  playbackControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  playbackActions: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  sendButton: {
    backgroundColor: '#000000',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sendText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  // Action Buttons
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 42,
    borderTopRightRadius: 42,
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 40,
    gap: 32,
    width: '100%',
    minHeight: '70%',
  },
  handleLine: {
    width: 48,
    height: 4,
    backgroundColor: '#000000',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: theme.spacing.md,
  },
  title: {
    fontFamily: 'Nunito-Bold',
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    textTransform: 'lowercase',
    marginBottom: 8,
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
    width: 247,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: 80,
    marginTop: 0,
    marginBottom: 0,
    gap: 4,
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.01)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
    position: 'relative',
  },
  recordingControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    marginTop: 32,
    gap: 20,
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
  recordingDot: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.error,
  },
  reviewControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  playButton: {
    width: 44,
    height: 33,
    backgroundColor: '#F6F6F6',
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    padding: 8,
  },
  duration: {
    color: theme.colors.text.primary,
    fontSize: 16,
    fontFamily: 'Nunito',
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  restartButton: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.borderRadius.md,
    ...theme.shadows.sm,
  },
  submitButton: {
    backgroundColor: '#000000',
    borderRadius: 50,
    paddingVertical: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    marginTop: 16,
    minWidth: 140,
  },
  submitButtonDisabled: {
    opacity: 0.7,
    backgroundColor: '#333333',
  },
  restartText: {
    color: theme.colors.text.primary,
    fontSize: 16,
    fontFamily: 'Nunito',
    fontWeight: '600',
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Nunito',
  },
  replyingToBox: {
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    alignItems: 'center',
    width: '100%',
  },
  replyingToLabel: {
    color: '#8A8E8F',
    fontSize: 13,
    fontFamily: 'Nunito',
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 2,
  },
  replyingToText: {
    color: theme.colors.text.primary,
    fontSize: 16,
    fontFamily: 'Nunito',
    fontWeight: '600',
    textAlign: 'center',
  },
  playIcon: {
    marginLeft: 4,
  },
  audioDurationContainer: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  audioDurationText: {
    fontFamily: 'Nunito-SemiBold',
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    textAlign: 'center',
  },
  audioSection: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    paddingHorizontal: 24,
    position: 'relative',
  },
});
