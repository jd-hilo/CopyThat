import React from 'react';
import { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Platform, Image, Modal, ScrollView, Alert, Dimensions, Text } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Play,
  Pause,
  MoreVertical,
  Tag as TagIcon,
  Lock,
  School,
  Trash2,
  X,
  Smile,
  Ban,
  MessageCircle,
} from 'lucide-react-native';
import { Typography } from '@/components/ui/Typography';
import * as Haptics from 'expo-haptics';
import { formatTimeAgo } from '@/utils/timeUtils';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
} from 'react-native-reanimated';
import { Audio } from 'expo-av';
import { supabase } from '@/lib/supabase';
import { useAudioPlayback } from '@/lib/AudioPlaybackContext';
import { EmojiPicker } from '../EmojiPicker';
import { useIsFocused } from '@react-navigation/native';
import { trackReactionPosted } from '../../app/_layout';

const EMOJIS = {
  heart: '❤️',
  fire: '🔥',
  laugh: '😂',
  wow: '😮',
  sad: '🥺'
} as const;

type EmojiType = keyof typeof EMOJIS;

interface FeedbackCardProps {
  feedback: {
    id: string;
    title: string;
    description?: string;
    transcription?: string;
    audioUrl: string;
    duration: number;
    createdAt: string;
    user: {
      id: string;
      name: string;
      username: string;
      profileImage: string;
      college: string | null;
      friend_count: number;
      friend_request_count: number;
    };
    reactionCount: number;
    likeCount: number;
    isLiked: boolean;
  };
  onPlay?: (feedback: any) => void;
  onReaction?: (feedback: any) => void;
  onReactionPosted?: () => void;
}

function formatAudioDuration(seconds: number) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const WaveformBar = ({ index, isPlaying }: { index: number; isPlaying: boolean }) => {
  const height = useSharedValue(12 + Math.random() * 20);
  const colors = ["#FFD700", "#FFA500", "#00FF6E", "#FD8CFF", "#FF006F", "#FFFB00", "#FFFFFF"];
  const color = colors[index % colors.length];
  const delay = index * 100;

  useEffect(() => {
    if (isPlaying) {
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
  }, [isPlaying]);

  const animatedStyle = useAnimatedStyle(() => ({
    height: height.value,
    backgroundColor: color,
    width: 5,
    borderRadius: 6,
    marginHorizontal: 1,
    opacity: color === '#FFFFFF' ? 0.32 : 1,
  }));

  return <Animated.View style={animatedStyle} />;
};

const EmojiReaction = ({ emoji, count }: { emoji: string; count: number }) => {
  const scale = useSharedValue(1);
  const rotation = useSharedValue(0);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.2, { duration: 200 }),
        withTiming(1, { duration: 200 })
      ),
      -1,
      true
    );
    rotation.value = withRepeat(
      withSequence(
        withTiming(-5, { duration: 200 }),
        withTiming(5, { duration: 200 })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { rotate: `${rotation.value}deg` }
    ]
  }));

  return (
    <View style={styles.reactionCount}>
      <Animated.View style={animatedStyle}>
        <Typography variant="body" style={styles.emoji}>
          {emoji}
        </Typography>
      </Animated.View>
      <Typography variant="caption">{count}</Typography>
    </View>
  );
};

const AudioWaveIcon = () => {
  return (
    <View style={styles.audioWaveContainer}>
      <View style={styles.audioWaveIcon}>
        <View style={[styles.waveBar, { height: 8 }]} />
        <View style={[styles.waveBar, { height: 12 }]} />
        <View style={[styles.waveBar, { height: 16 }]} />
        <View style={[styles.waveBar, { height: 12 }]} />
        <View style={[styles.waveBar, { height: 8 }]} />
      </View>
    </View>
  );
};

const EmojiRain = ({ emoji }: { emoji: string }) => {
  const translateY = useSharedValue(-50);
  const opacity = useSharedValue(0);
  const randomX = Math.random() * Dimensions.get('window').width - 40;
  const randomDelay = Math.random() * 500;
  const randomDuration = 1500 + Math.random() * 500;

  useEffect(() => {
    opacity.value = withDelay(
      randomDelay,
      withSequence(
        withTiming(1, { duration: 200 }),
        withDelay(
          randomDuration - 400,
          withTiming(0, { duration: 200 })
        )
      )
    );
    translateY.value = withDelay(
      randomDelay,
      withTiming(400, { duration: randomDuration })
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: randomX },
      { translateY: translateY.value }
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.emojiRain, animatedStyle]}>
      <Text style={styles.emojiRainText}>{emoji}</Text>
    </Animated.View>
  );
};

export function FeedbackCard({ feedback, onPlay, onReaction, onReactionPosted }: FeedbackCardProps) {
  const router = useRouter();
  const isFocused = useIsFocused();
  const [isPlaying, setIsPlaying] = useState(false);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const progress = useSharedValue(0);
  const [showTranscriptionModal, setShowTranscriptionModal] = useState(false);
  const [showUserProfileModal, setShowUserProfileModal] = useState(false);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isLiked, setIsLiked] = useState(feedback.isLiked);
  const [likeCount, setLikeCount] = useState(feedback.likeCount);
  const [reactionCount, setReactionCount] = useState(feedback.reactionCount);
  const [isBlocked, setIsBlocked] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [emojiRain, setEmojiRain] = useState<string[]>([]);

  const { currentlyPlayingId, setCurrentlyPlayingId } = useAudioPlayback();

  useEffect(() => {
    const checkCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUser(user);
      }
    };
    checkCurrentUser();
  }, []);

  useEffect(() => {
    const checkIfBlocked = async () => {
      if (!currentUser || !feedback.user.id) return;
      
      const { data: blockedUser } = await supabase
        .from('blocked_users')
        .select('*')
        .eq('blocker_id', currentUser.id)
        .eq('blocked_id', feedback.user.id)
        .single();
      
      setIsBlocked(!!blockedUser);
    };
    checkIfBlocked();
  }, [currentUser, feedback.user.id]);

  const loadAudio = async () => {
    try {
      if (sound) {
        await sound.unloadAsync();
      }

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: feedback.audioUrl },
        { shouldPlay: false },
        (status) => {
          if (status.isLoaded && status.durationMillis) {
            progress.value = status.positionMillis / status.durationMillis;
          }
        }
      );

      setSound(newSound);
    } catch (error) {
      console.error('Error loading audio:', error);
    }
  };

  const handlePlayPause = async (e?: any) => {
    e?.stopPropagation();
    
    if (!sound) {
      await loadAudio();
      return;
    }

    try {
      if (isPlaying) {
        await sound.pauseAsync();
        setIsPlaying(false);
        setCurrentlyPlayingId(null);
      } else {
        // Stop any currently playing audio
        if (currentlyPlayingId && currentlyPlayingId !== feedback.id) {
          setCurrentlyPlayingId(null);
        }
        
        await sound.playAsync();
        setIsPlaying(true);
        setCurrentlyPlayingId(feedback.id);
        onPlay?.(feedback);
      }
    } catch (error) {
      console.error('Error playing/pausing audio:', error);
    }
  };

  const handleCardPress = async () => {
    if (isBlocked) return;
    
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push(`/feedback/${feedback.id}` as any);
    } catch (error) {
      console.error('Error navigating to feedback details:', error);
    }
  };

  const handleDelete = async () => {
    Alert.alert(
      'Delete Feedback',
      'Are you sure you want to delete this feedback? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('feedback')
                .delete()
                .eq('id', feedback.id);
              
              if (error) throw error;
              
              setShowOptionsModal(false);
            } catch (error) {
              console.error('Error deleting feedback:', error);
              Alert.alert('Error', 'Failed to delete feedback');
            }
          }
        }
      ]
    );
  };

  const handleProfilePress = () => {
    setShowUserProfileModal(false);
    router.push(`/profile/${feedback.user.id}` as any);
  };

  const handleReactionPress = () => {
    setShowEmojiPicker(true);
  };

  const handleTalkPress = () => {
    // Pause audio when opening talk modal
    if (isPlaying && sound) {
      sound.pauseAsync();
      setIsPlaying(false);
      setCurrentlyPlayingId(null);
    }
    onReaction?.(feedback);
  };

  const handleEmojiSelect = async (emojiType: EmojiType) => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const emoji = EMOJIS[emojiType];
      setEmojiRain(prev => [...prev, emoji]);
      
      // Add emoji reaction logic here if needed
      setShowEmojiPicker(false);
      
      setTimeout(() => {
        setEmojiRain(prev => prev.slice(1));
      }, 2000);
    } catch (error) {
      console.error('Error selecting emoji:', error);
    }
  };

  const handleReactionSubmit = async (audioUrl: string, duration: number) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('feedback_reactions')
        .insert({
          feedback_id: feedback.id,
          user_id: user.id,
          audio_url: audioUrl,
          duration: Math.round(duration)
        });

      if (error) throw error;

      setReactionCount(prev => prev + 1);
      onReactionPosted?.();
      trackReactionPosted();
    } catch (error) {
      console.error('Error submitting reaction:', error);
      Alert.alert('Error', 'Failed to submit reaction');
    }
  };

  const handleLike = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (isLiked) {
        const { error } = await supabase
          .from('feedback_likes')
          .delete()
          .eq('feedback_id', feedback.id)
          .eq('user_id', user.id);

        if (error) throw error;
        setLikeCount(prev => prev - 1);
        setIsLiked(false);
      } else {
        const { error } = await supabase
          .from('feedback_likes')
          .insert({
            feedback_id: feedback.id,
            user_id: user.id
          });

        if (error) throw error;
        setLikeCount(prev => prev + 1);
        setIsLiked(true);
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const handleBlockUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('blocked_users')
        .insert({
          blocker_id: user.id,
          blocked_id: feedback.user.id
        });

      if (error) throw error;

      setIsBlocked(true);
      setShowOptionsModal(false);
      Alert.alert('User Blocked', 'You have blocked this user');
    } catch (error) {
      console.error('Error blocking user:', error);
      Alert.alert('Error', 'Failed to block user');
    }
  };

  if (isBlocked) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Emoji Rain */}
      {emojiRain.map((emoji, index) => (
        <EmojiRain key={index} emoji={emoji} />
      ))}

      <TouchableOpacity
        style={styles.card}
        onPress={handleCardPress}
        activeOpacity={0.95}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.userInfo}
            onPress={() => setShowUserProfileModal(true)}
          >
            <Image
              source={{ uri: feedback.user.profileImage }}
              style={styles.profileImage}
            />
            <View style={styles.userDetails}>
              <Typography variant="bodyBold" style={styles.userName}>
                {feedback.user.name}
              </Typography>
              <Typography variant="caption" style={styles.timestamp}>
                {formatTimeAgo(feedback.createdAt)}
              </Typography>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.optionsButton}
            onPress={() => setShowOptionsModal(true)}
          >
            <MoreVertical size={20} color="#666" />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <Typography variant="h3" style={styles.title}>
            {feedback.title}
          </Typography>
          
          {feedback.description && (
            <Typography variant="body" style={styles.description}>
              {feedback.description}
            </Typography>
          )}

          <View style={styles.audioSection}>
            <TouchableOpacity
              style={styles.playButton}
              onPress={handlePlayPause}
            >
              {isPlaying ? (
                <Pause size={24} color="#fff" />
              ) : (
                <Play size={24} color="#fff" />
              )}
            </TouchableOpacity>

            <View style={styles.audioInfo}>
              <View style={styles.waveform}>
                {Array.from({ length: 20 }).map((_, index) => (
                  <WaveformBar key={index} index={index} isPlaying={isPlaying} />
                ))}
              </View>
              <Typography variant="caption" style={styles.duration}>
                {formatAudioDuration(feedback.duration)}
              </Typography>
            </View>
          </View>

          {feedback.transcription && (
            <TouchableOpacity
              style={styles.transcriptionButton}
              onPress={() => setShowTranscriptionModal(true)}
            >
              <Typography variant="caption" style={styles.transcriptionText}>
                View Transcription
              </Typography>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, isLiked && styles.likedButton]}
            onPress={handleLike}
          >
            <Typography variant="caption" style={[styles.actionText, isLiked ? styles.likedText : {}]}>
              ❤️ {likeCount}
            </Typography>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleReactionPress}
          >
            <Typography variant="caption" style={styles.actionText}>
              😊 React
            </Typography>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleTalkPress}
          >
            <Typography variant="caption" style={styles.actionText}>
              🎤 {reactionCount} Talk
            </Typography>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>

      {/* Transcription Modal */}
      <Modal
        visible={showTranscriptionModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTranscriptionModal(false)}
      >
        <View style={[styles.modalOverlay, { justifyContent: 'center', alignItems: 'center' }]}>
          <View style={[styles.modalContent, {
            maxHeight: '80%',
            marginHorizontal: 20,
            borderRadius: 24,
            width: '90%',
          }]}>
            <View style={styles.modalHeader}>
              <Typography variant="h3">Transcription</Typography>
              <TouchableOpacity
                onPress={() => setShowTranscriptionModal(false)}
                style={styles.closeButton}
              >
                <X size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <Typography variant="body">
                {feedback.transcription}
              </Typography>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* User Profile Modal */}
      <Modal
        visible={showUserProfileModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowUserProfileModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Typography variant="h3">User Profile</Typography>
              <TouchableOpacity
                onPress={() => setShowUserProfileModal(false)}
                style={styles.closeButton}
              >
                <X size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <View style={styles.profileModalContent}>
                <Image
                  source={{ uri: feedback.user.profileImage }}
                  style={styles.profileModalImage}
                />
                <Typography variant="h3">{feedback.user.name}</Typography>
                <Typography variant="body">@{feedback.user.username}</Typography>
                {feedback.user.college && (
                  <Typography variant="body">{feedback.user.college}</Typography>
                )}
                <TouchableOpacity
                  style={styles.viewProfileButton}
                  onPress={handleProfilePress}
                >
                  <Typography variant="body" style={styles.viewProfileText}>
                    View Full Profile
                  </Typography>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Options Modal */}
      <Modal
        visible={showOptionsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowOptionsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Typography variant="h3">Options</Typography>
              <TouchableOpacity
                onPress={() => setShowOptionsModal(false)}
                style={styles.closeButton}
              >
                <X size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              {currentUser?.id === feedback.user.id && (
                <TouchableOpacity
                  style={styles.optionButton}
                  onPress={handleDelete}
                >
                  <Trash2 size={20} color="#ff4444" />
                  <Typography variant="body" style={styles.deleteText}>
                    Delete Feedback
                  </Typography>
                </TouchableOpacity>
              )}
              
              {currentUser?.id !== feedback.user.id && (
                <TouchableOpacity
                  style={styles.optionButton}
                  onPress={handleBlockUser}
                >
                  <Ban size={20} color="#ff4444" />
                  <Typography variant="body" style={styles.deleteText}>
                    Block User
                  </Typography>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Emoji Picker */}
      <EmojiPicker
        visible={showEmojiPicker}
        onClose={() => setShowEmojiPicker(false)}
        onSelect={handleEmojiSelect}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontWeight: '600',
    color: '#333',
  },
  timestamp: {
    color: '#666',
    marginTop: 2,
  },
  optionsButton: {
    padding: 4,
  },
  content: {
    marginBottom: 16,
  },
  title: {
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  description: {
    color: '#666',
    marginBottom: 12,
    lineHeight: 20,
  },
  audioSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  audioInfo: {
    flex: 1,
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
    marginBottom: 4,
  },
  duration: {
    color: '#666',
    fontSize: 12,
  },
  transcriptionButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  transcriptionText: {
    color: '#FFD700',
    fontSize: 12,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  actionText: {
    color: '#666',
    fontSize: 14,
  },
  likedButton: {
    backgroundColor: '#ffe6e6',
  },
  likedText: {
    color: '#ff4444',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '90%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalBody: {
    padding: 16,
  },
  closeButton: {
    padding: 4,
  },
  profileModalContent: {
    alignItems: 'center',
  },
  profileModalImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 16,
  },
  viewProfileButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#FFD700',
    borderRadius: 8,
  },
  viewProfileText: {
    color: '#fff',
    fontWeight: '600',
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  deleteText: {
    color: '#ff4444',
    marginLeft: 12,
  },
  audioWaveContainer: {
    marginRight: 12,
  },
  audioWaveIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 24,
  },
  waveBar: {
    width: 3,
    backgroundColor: '#FFD700',
    borderRadius: 2,
    marginHorizontal: 1,
  },
  reactionCount: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  emoji: {
    fontSize: 16,
    marginRight: 4,
  },
  emojiRain: {
    position: 'absolute',
    zIndex: 1000,
  },
  emojiRainText: {
    fontSize: 24,
  },
}); 