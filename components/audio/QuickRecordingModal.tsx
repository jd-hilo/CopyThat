import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
  Platform,
  TouchableWithoutFeedback,
  ActivityIndicator,
} from 'react-native';
import { Mic, X, Pause, Play, Square, Check } from 'lucide-react-native';
import { Typography } from '@/components/ui/Typography';
import { theme } from '@/constants/theme';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { supabase } from '@/lib/supabase';
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
import { posthog } from '@/posthog';
import { useAuth } from '@/contexts/authContext';
import { mixpanel } from '@/app/_layout';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VoiceSelector } from '@/components/audio/VoiceSelector';
import { voiceChanger } from '@/lib/elevenLabs';

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
  const insets = useSafeAreaInsets();
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

  // Voice cloning state
  const [groupMembers, setGroupMembers] = useState<any[]>([]);
  const [selectedVoiceUserId, setSelectedVoiceUserId] = useState<string | null>(null);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null);
  const [isGeneratingVoice, setIsGeneratingVoice] = useState(false);
  const [clonedAudioUri, setClonedAudioUri] = useState<string | null>(null);

  // Cleanup audio resources
  useEffect(() => {
    return () => {
      if (recording) {
        recording.stopAndUnloadAsync().catch((err) => {
          console.warn('Error stopping recording during cleanup:', err);
        });
      }
      if (sound.current) {
        sound.current.unloadAsync().catch((err) => {
          console.warn('Error unloading sound during cleanup:', err);
        });
      }
    };
  }, [recording]);

  // Fetch group members who have voice clones for this story's group (if any)
  useEffect(() => {
    const fetchGroupMembers = async () => {
      try {
        if (!storyId) return;
        // Find group for this story (if it is a group story)
        const { data: groupLink, error: groupLinkError } = await supabase
          .from('group_stories')
          .select('group_id')
          .eq('story_id', storyId)
          .maybeSingle();

        if (groupLinkError) {
          console.warn('Error fetching group link for story:', groupLinkError);
          return;
        }
        if (!groupLink?.group_id) {
          // Not a group story; no members to offer
          setGroupMembers([]);
          return;
        }

        const { data: members, error } = await supabase
          .from('group_members')
          .select(`
            user_id,
            profiles!inner (
              id,
              username,
              avatar_url,
              voice_clone_id,
              voice_clone_status
            )
          `)
          .eq('group_id', groupLink.group_id);

        if (error) throw error;

        const formatted = (members || []).map((m: any) => ({
          id: m.profiles.id,
          username: m.profiles.username,
          avatar_url: m.profiles.avatar_url,
          voice_clone_id: m.profiles.voice_clone_id,
          voice_clone_status: m.profiles.voice_clone_status,
        }));
        setGroupMembers(formatted);
      } catch (err) {
        console.warn('Failed to fetch group members for reaction cloning:', err);
        setGroupMembers([]);
      }
    };

    if (isVisible) {
      fetchGroupMembers();
    }
  }, [isVisible, storyId]);

  // Reset cloned audio when selection changes; auto-generate when ready
  useEffect(() => {
    setClonedAudioUri(null);
    if (sound.current) {
      sound.current.unloadAsync().catch((err) => {
        console.warn('Error unloading sound during reset:', err);
      });
      sound.current = null;
      setIsPlaying(false);
    }

    if (
      selectedVoiceId &&
      selectedVoiceUserId &&
      selectedVoiceUserId !== (user?.id || '') &&
      recordingUri.current
    ) {
      handleGenerateVoicePreview();
    }
  }, [selectedVoiceId, selectedVoiceUserId]);

  const handleGenerateVoicePreview = async () => {
    try {
      if (!selectedVoiceId || !recordingUri.current) return;
      setIsGeneratingVoice(true);
      const result = await voiceChanger(recordingUri.current, selectedVoiceId);
      if (result.success && result.audioUri) {
        setClonedAudioUri(result.audioUri);
      }
    } catch (e) {
      console.warn('Voice preview generation failed:', e);
    } finally {
      setIsGeneratingVoice(false);
    }
  };

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
    // Note: Don't stop recording here - let the cleanup useEffect handle it
    // Stopping here can cause issues when reopening the modal
    onClose();
  };

  const startRecording = async () => {
    console.log('DEBUG: startRecording called');

    try {
      // Clean up any existing recording or sound first
      if (recording) {
        try {
          await recording.stopAndUnloadAsync();
        } catch (err) {
          console.warn('Error cleaning up existing recording:', err);
        }
      }
      if (sound.current) {
        try {
          await sound.current.unloadAsync();
        } catch (err) {
          console.warn('Error cleaning up existing sound:', err);
        }
        sound.current = null;
      }

      if (Platform.OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      await Audio.requestPermissionsAsync();
      // Ensure iOS recording works (silent switch / proper category)
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(newRecording);
      setIsRecording(true);
      setDuration(0);
      finalDuration.current = 0;
      pulseOpacity.value = withRepeat(
        withTiming(0.3, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    } catch (err) {
      console.error('Error in recording setup:', err);
      setIsRecording(false);
      setDuration(0);
      setRecording(null);
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
      if (!recordingUri.current && !clonedAudioUri) return;

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
      // Match playback mode used in stories/reaction items
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: clonedAudioUri || recordingUri.current! },
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
      sound.current.unloadAsync().catch((err) => {
        console.warn('Error unloading sound on restart:', err);
      });
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
      let uri = recordingUri.current;

      // If a different member's voice is selected, ensure we have a cloned audio
      if (
        selectedVoiceId &&
        selectedVoiceUserId &&
        selectedVoiceUserId !== (user?.id || '')
      ) {
        if (!clonedAudioUri) {
          const result = await voiceChanger(uri, selectedVoiceId);
          if (result.success && result.audioUri) {
            uri = result.audioUri;
          }
        } else {
          uri = clonedAudioUri;
        }
      }

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
      // Determine content type and extension based on uri
      const isMp3 = uri.toLowerCase().endsWith('.mp3');
      const contentType = isMp3 ? 'audio/mpeg' : 'audio/m4a';
      const extension = isMp3 ? 'mp3' : 'm4a';

      // Start both transcription and upload in parallel
      const [transcription, uploadResult] = await Promise.all([
        transcribeAudioFile(uri),
        supabase.storage
          .from('reactions')
          .upload(`reactions/${storyId}/${Date.now()}.${extension}`, arrayBuffer, {
            contentType,
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
        cloned_voice_user_id: selectedVoiceUserId && selectedVoiceUserId !== (user?.id || '') ? selectedVoiceUserId : null,
        is_voice_cloned: selectedVoiceUserId && selectedVoiceUserId !== (user?.id || '') ? true : false,
      });

      if (reactionError) throw reactionError;

      // Track audio reaction submission event with PostHog

      if (sound.current) {
        sound.current.unloadAsync().catch((err) => {
          console.warn('Error unloading sound on submit:', err);
        });
        sound.current = null;
      }

      // Show send animation after submit is complete
      setShowSendAnimation(true);
      // posthog.capture('audio_reaction_submitted', {
      //   user: {
      //     id: user?.id || '',
      //     email: user?.email || '',
      //   },
      //   story_id: storyId,
      //   username: username || '',
      //   duration: duration,
      //   is_reply: !!replyingTo,
      //   reply_to_reaction_id: replyingTo?.reactionId || null,
      //   timeStamp: new Date().toISOString(),
      // });

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
      transparent={false}
      presentationStyle="fullScreen"
      onRequestClose={handleModalClose}
    >
      <TouchableWithoutFeedback onPress={() => {}}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={styles.modalContent}>
              {/* Handle line */}
              <View style={styles.handleLine} />

              <View style={styles.header}>
                {isPlaybackMode && (
                  <TouchableOpacity
                    onPress={restartRecording}
                    style={styles.closeButton}
                  >
                    <X size={24} color={theme.colors.text.primary} />
                  </TouchableOpacity>
                )}
                {!isPlaybackMode && (
                  <TouchableOpacity
                    onPress={handleModalClose}
                    style={styles.closeButton}
                  >
                    <X size={24} color={theme.colors.text.primary} />
                  </TouchableOpacity>
                )}
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

                    {/* Voice Status Message - Show inline */}
                    {selectedVoiceId && selectedVoiceUserId !== (user?.id || '') && (
                      <View style={styles.voicePreviewContainer}>
                        {isGeneratingVoice ? (
                          <View style={styles.generatingContainer}>
                            <ActivityIndicator size="small" color="#FF9B71" />
                            <Typography variant="body" style={styles.generatingText}>
                              Converting your reply to {groupMembers.find(m => m.id === selectedVoiceUserId)?.username}'s voice...
                            </Typography>
                          </View>
                        ) : clonedAudioUri ? (
                          <View style={styles.previewReadyContainer}>
                            <Check size={18} color="#4CAF50" />
                            <Typography variant="body" style={styles.previewReadyText}>
                              Voice converted! Tap play to preview the cloned voice
                            </Typography>
                          </View>
                        ) : null}
                      </View>
                    )}

                    <View style={styles.playbackActions}>
                      <TouchableOpacity
                        style={styles.restartButton}
                        onPress={() => {
                          setIsPlaybackMode(false);
                          setDuration(0);
                          recordingUri.current = null;
                          if (sound.current) {
                            sound.current.unloadAsync().catch((err) => {
                              console.warn('Error unloading sound on restart button:', err);
                            });
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

                    {/* Voice Selection for Cloning - Show below actions */}
                    {groupMembers.length > 0 && groupMembers.some(m => m.voice_clone_status === 'ready') && (
                      <View style={[styles.bottomContainer, { paddingBottom: Math.max(16, insets.bottom + 12) }]}>
                        <VoiceSelector
                          groupMembers={groupMembers}
                          selectedVoiceUserId={selectedVoiceUserId}
                          currentUserId={user?.id || ''}
                          onSelectVoice={(userId, voiceId) => {
                            setSelectedVoiceUserId(userId);
                            setSelectedVoiceId(voiceId);
                          }}
                        />
                      </View>
                    )}
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
  voicePreviewContainer: {
    width: '100%',
    paddingHorizontal: 16,
  },
  generatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  generatingText: {
    color: '#333',
  },
  previewReadyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  previewReadyText: {
    color: '#333',
    fontWeight: '600',
  },
  bottomContainer: {
    marginTop: 'auto',
    backgroundColor: '#F7F8F9',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    paddingHorizontal: 12,
  },
  // Playback Section
  playbackSection: {
    alignItems: 'center',
    gap: 16,
    marginTop: 200,
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
    backgroundColor: '#FFFFFF',
    justifyContent: 'flex-start',
    alignItems: 'stretch',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 56,
    gap: 32,
    width: '100%',
    flex: 1,
  },
  handleLine: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderRadius: 0,
    alignSelf: 'center',
    marginBottom: 0,
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
