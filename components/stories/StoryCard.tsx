import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Image,
  Modal,
  ScrollView,
  Alert,
  Dimensions,
  Text,
  LayoutChangeEvent,
  TouchableWithoutFeedback,
} from 'react-native';
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
  Mic2,
} from 'lucide-react-native';
import { Typography } from '@/components/ui/Typography';
import type { AudioStory } from '@/constants/mockData';
import * as Haptics from 'expo-haptics';
import { formatTimeAgo } from '@/utils/timeUtils';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { Audio } from 'expo-av';
import { supabase } from '@/lib/supabase';
import { useAudioPlayback } from '@/lib/AudioPlaybackContext';
import { EmojiPicker } from '../EmojiPicker';
import { useReactions } from '@/hooks/useReactions';
import { useIsFocused } from '@react-navigation/native';
import { mixpanel } from '../../app/_layout';
import { theme } from '@/constants/theme';
import {
  Menu,
  MenuOption,
  MenuOptions,
  MenuTrigger,
} from 'react-native-popup-menu';
import VisibilitySensor from '@svanboxel/visibility-sensor-react-native';

const EMOJIS = {
  heart: '❤️',
  fire: '🔥',
  laugh: '😂',
  wow: '😮',
  sad: '🥺',
} as const;

type EmojiType = keyof typeof EMOJIS;

type ReactionType = keyof typeof EMOJIS;

interface StoryCardProps {
  story: AudioStory;
  onPlay?: (story: AudioStory) => void;
  onReaction?: (story: AudioStory) => void;
  onReactionPosted?: () => void;
  onDelete?: (storyId: string) => void;
  isActive?: boolean;
  onLayout?: (e: LayoutChangeEvent) => void;
  handleEmojiSelect: (
    position: number,
    storyId: AudioStory,
    emoji: any
  ) => void;
  position: number;
  isFocused2: any;
}

function formatAudioDuration(seconds: number) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0)
    return `${h}:${m.toString().padStart(2, '0')}:${s
      .toString()
      .padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const WaveformBar = ({
  index,
  isPlaying,
}: {
  index: number;
  isPlaying: boolean;
}) => {
  // Match recording tab behavior for smoothness
  const height = useSharedValue(10);
  const baseHeight = 8 + (index % 3) * 4; // keep slight visual variety
  const colors = [
    '#83E8FF',
    '#0099FF',
    '#00FF6E',
    '#FD8CFF',
    '#FF006F',
    '#FFFB00',
    '#FFFFFF',
  ];
  const color = colors[index % colors.length];

  useEffect(() => {
    if (isPlaying) {
      height.value = withRepeat(
        withTiming(Math.random() * 20 + 10, {
          duration: 500,
          easing: Easing.inOut(Easing.ease),
        }),
        -1,
        true
      );
    } else {
      height.value = withTiming(baseHeight, { duration: 300 });
    }
  }, [isPlaying]);

  const animatedStyle = useAnimatedStyle(() => ({
    height: height.value,
    backgroundColor: color,
    width: 4,
    borderRadius: 2,
    marginHorizontal: 1,
    opacity: color === '#FFFFFF' ? 0.32 : 1,
  }));

  return <Animated.View style={animatedStyle} />;
};

const EmojiReaction = React.memo(
  ({ emoji, count }: { emoji: string; count: number }) => {
    return (
      <View style={styles.reactionCount}>
        <Typography variant="body" style={styles.emoji}>
          {emoji}
        </Typography>
        <Typography variant="caption">{count}</Typography>
      </View>
    );
  }
);

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

const ConfettiPiece = ({ index }: { index: number }) => {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const rotation = useSharedValue(0);
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);

  const colors = [
    '#FF6B6B',
    '#4ECDC4',
    '#45B7D1',
    '#96CEB4',
    '#FFEAA7',
    '#DDA0DD',
    '#98D8C8',
  ];
  const color = colors[index % colors.length];

  useEffect(() => {
    const angle = index * 45 * (Math.PI / 180);
    const distance = 60 + Math.random() * 40;

    translateX.value = withTiming(Math.cos(angle) * distance, {
      duration: 600,
      easing: Easing.out(Easing.ease),
    });
    translateY.value = withTiming(Math.sin(angle) * distance - 100, {
      duration: 600,
      easing: Easing.out(Easing.ease),
    });
    rotation.value = withTiming(360 + Math.random() * 180, {
      duration: 600,
      easing: Easing.out(Easing.ease),
    });
    opacity.value = withSequence(
      withTiming(1, { duration: 100 }),
      withTiming(0, { duration: 500, easing: Easing.out(Easing.ease) })
    );
    scale.value = withSequence(
      withTiming(1.2, { duration: 100 }),
      withTiming(0.8, { duration: 500, easing: Easing.out(Easing.ease) })
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotation.value}deg` },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.confettiPiece, { backgroundColor: color }, animatedStyle]}
    />
  );
};

const GraffitiSplash = () => {
  return (
    <View style={styles.confettiContainer}>
      {[...Array(8)].map((_, index) => (
        <ConfettiPiece key={index} index={index} />
      ))}
    </View>
  );
};

export function StoryCard({
  story,
  onPlay,
  onReaction,
  onReactionPosted,
  onDelete,
  isActive = false,
  onLayout,
  handleEmojiSelect,
  position,
  isFocused2,
}: StoryCardProps) {
  const router = useRouter();
  const isFocused = useIsFocused();
  const [isPlaying, setIsPlaying] = useState(false);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const progress = useSharedValue(0);
  const [showTranscriptionModal, setShowTranscriptionModal] = useState(false);
  const [showUserProfileModal, setShowUserProfileModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  const [isCurrentUser, setIsCurrentUser] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const viewRef = useRef<View>(null);
  const {
    currentlyPlayingId,
    setCurrentlyPlayingId,
    isPlaying: contextIsPlaying,
    setIsPlaying: setContextIsPlaying,
  } = useAudioPlayback();
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [audioReactionCount, setAudioReactionCount] = useState(0);
  const [showGraffitiSplash, setShowGraffitiSplash] = useState(false);
  const visibleRef = useRef([]);
  const isPlayingRef = useRef(false);

  // Determine if this card should be highlighted (either active or currently playing)
  const shouldHighlight =
    isActive ||
    (currentlyPlayingId === story.id && (contextIsPlaying || isPlaying));
  const getSizeStyles = (size = 'medium') => {
    switch (size) {
      case 'small':
        return {
          containerWidth: Dimensions.get('window').width * 0.4,
          maxWidth: 160,
          padding: 6,
          buttonSize: 32,
          emojiSize: 16,
        };
      case 'large':
        return {
          containerWidth: Dimensions.get('window').width * 0.7,
          maxWidth: 300,
          padding: 12,
          buttonSize: 48,
          emojiSize: 20,
        };
      default: // medium
        return {
          containerWidth: Dimensions.get('window').width * 0.5,
          maxWidth: 200,
          padding: 8,
          buttonSize: 40,
          emojiSize: 18,
        };
    }
  };
  const sizeStyles = getSizeStyles();

  // Cleanup function for unmounting
  useEffect(() => {
    return () => {
      if (sound) {
        // Ensure audio is properly stopped and cleaned up when component unmounts
        try {
          sound
            .stopAsync()
            .then(() => {
              sound
                .unloadAsync()
                .then(() => {
                  setSound(null);
                  setIsPlaying(false);
                  progress.value = 0;
                })
                .catch(() => {
                  // Ignore unload errors during cleanup
                });
            })
            .catch(() => {
              // If stop fails, try to unload directly
              sound.unloadAsync().catch(() => {
                // Ignore unload errors during cleanup
              });
            });
        } catch (error) {
          // If any operation fails, just clean up the state
          setSound(null);
          setIsPlaying(false);
          progress.value = 0;
        }
      }
    };
  }, [sound]);

  // Check if current user is the story author
  useEffect(() => {
    const checkCurrentUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        // Use creatorId if available (for cloned voice stories), otherwise use story.user.id
        const actualCreatorId = story.creatorId || story.user.id;
        const isOwner = user.id === actualCreatorId;
        if (isOwner !== isCurrentUser) {
          setIsCurrentUser(isOwner);
        }
      } else {
        if (isCurrentUser) {
          setIsCurrentUser(false);
        }
      }
    };
    checkCurrentUser();
  }, [story.id, story.creatorId, story.user?.id, isCurrentUser]);

  // (No global driver needed; each bar animates like the recording tab)

  useEffect(() => {
    if (
      currentlyPlayingId &&
      currentlyPlayingId !== story.id &&
      isPlaying &&
      sound
    ) {
      // Stop this card when another one starts playing
      setIsPlaying(false);
      sound.pauseAsync();
    }
  }, [currentlyPlayingId]);

  // Add effect to handle focus changes
  useEffect(() => {
    if (!isFocused && isPlaying && sound) {
      sound.pauseAsync();
      setIsPlaying(false);
      setCurrentlyPlayingId(null);
    }
  }, [isFocused, isPlaying, sound]);

  // If this card becomes the selected candidate, attempt immediate autoplay
  useEffect(() => {
    if (currentlyPlayingId === story.id && !isPlaying && !contextIsPlaying) {
      handlePlayPause();
    }
  }, [currentlyPlayingId]);

  useEffect(() => {
    checkIfBlocked();
  }, [story.user.id]);

  // Cleanup audio when component unmounts
  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync().catch(console.error);
      }
    };
  }, [sound]);

  useEffect(() => {
    const fetchAudioReactionCount = async () => {
      try {
        const { count, error } = await supabase
          .from('reactions')
          .select('*', { count: 'exact', head: true })
          .eq('story_id', story.id);

        if (error) throw error;
        setAudioReactionCount(count || 0);
      } catch (error) {
        console.error('Error fetching audio reaction count:', error);
      }
    };

    fetchAudioReactionCount();
  }, [story.id]);

  const checkIfBlocked = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('blocked_users')
        .select('id')
        .eq('blocker_id', user.id)
        .eq('blocked_id', story.user.id)
        .single();

      setIsBlocked(!!data);
    } catch (error) {
      console.error('Error checking if user is blocked:', error);
    }
  };

  const handleBlockUser = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      if (isBlocked) {
        // Unblock user
        await supabase
          .from('blocked_users')
          .delete()
          .eq('blocker_id', user.id)
          .eq('blocked_id', story.user.id);
      } else {
        // Block user
        await supabase.from('blocked_users').insert([
          {
            blocker_id: user.id,
            blocked_id: story.user.id,
          },
        ]);
      }

      setIsBlocked(!isBlocked);
      setShowUserProfileModal(false);
    } catch (error) {
      console.error('Error blocking/unblocking user:', error);
      Alert.alert('Error', 'Failed to block/unblock user. Please try again.');
    }
  };

  const handlePlayPause = async (e?: any) => {
    if (e) {
      e.stopPropagation();
    }

    try {
      // If another story is playing, stop it first
      if (currentlyPlayingId && currentlyPlayingId !== story.id) {
        setCurrentlyPlayingId(null);
        setContextIsPlaying(false);
      }

      if (!sound) {
        // Ensure iOS playback works in production (silent switch / category)
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          shouldDuckAndroid: false,
          playThroughEarpieceAndroid: false,
          allowsRecordingIOS: false,
        });
        // Create new sound instance if none exists
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: story.audioUrl },
          {
            progressUpdateIntervalMillis: 1000,
            shouldPlay: true,
            volume: 1.0,
            rate: 1.0,
            isMuted: false,
            isLooping: false,
            shouldCorrectPitch: true,
          }
        );

        setSound(newSound);
        setIsPlaying(true);
        setCurrentlyPlayingId(story.id);
        setContextIsPlaying(true);

        newSound.setOnPlaybackStatusUpdate((status) => {
          if (!status.isLoaded) return;

          setCurrentTime(status.positionMillis / 1000);
          progress.value = status.positionMillis / (status.durationMillis || 1);

          if (status.didJustFinish) {
            setIsPlaying(false);
            setCurrentTime(0);
            progress.value = 0;
            setCurrentlyPlayingId(null);
            setContextIsPlaying(false);
            onPlay?.(story);
          }
        });
      } else {
        // Simple pause/resume logic
        if (isPlaying) {
          await sound.pauseAsync();
          setIsPlaying(false);
          setCurrentlyPlayingId(null);
          setContextIsPlaying(false);
        } else {
          await Audio.setAudioModeAsync({
            playsInSilentModeIOS: true,
            staysActiveInBackground: true,
            shouldDuckAndroid: false,
            playThroughEarpieceAndroid: false,
            allowsRecordingIOS: false,
          });
          await sound.playAsync();
          setIsPlaying(true);
          setCurrentlyPlayingId(story.id);
          setContextIsPlaying(true);
        }
      }
    } catch (error) {
      console.error('Error playing audio:', error);
      setIsPlaying(false);
      setSound(null);
      setCurrentlyPlayingId(null);
      setContextIsPlaying(false);
    }
  };
  const handleDelete = async () => {
    Alert.alert(
      'Delete Story',
      'Are you sure you want to delete this story? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('stories')
                .delete()
                .eq('id', story.id);

              if (error) throw error;

              // Close the menu modal
              setShowMenu(false);

              // Call the onDelete callback to refresh the feed
              onDelete?.(story.id);

              // Show success message
              Alert.alert('Success', 'Story deleted successfully.');
            } catch (error) {
              console.error('Error deleting story:', error);
              Alert.alert('Error', 'Failed to delete story. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleProfilePress = () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setShowUserProfileModal(true);
  };

  const handleTalkPress = () => {
    mixpanel.track('Talk button clicked');
    // Pause audio when opening talk modal
    if (isPlaying && sound) {
      sound.pauseAsync();
      setIsPlaying(false);
      setCurrentlyPlayingId(null);
    }

    // Make sure onReaction is defined
    if (!onReaction) {
      return;
    }

    // Call onReaction with the story
    onReaction(story);
  };

  const handleImageVisibility = (visible: boolean) => {
    // Only autoplay if this is the topmost visible story
    if (visible && isFocused2?.id === story.id) {
      // Only play if this story is NOT already playing (check both state and ref)
      if (!isPlaying && !isPlayingRef.current && (!currentlyPlayingId || currentlyPlayingId === story.id)) {
        handlePlayPause2(story);
      }
    } else if (!visible && isPlaying) {
      // Pause when the story becomes invisible
      if (sound) {
        sound.pauseAsync();
        setIsPlaying(false);
        setCurrentlyPlayingId(null);
        setContextIsPlaying(false);
        isPlayingRef.current = false; // Clear the guard
      }
    }
  };

  const handlePlayPause2 = async (story: AudioStory) => {
    if (isPlayingRef.current) {
      return;
    }
    isPlayingRef.current = true;
    
    try {
      // If a different story is playing, stop and unload it first
      if (sound) {
        try {
          await sound.unloadAsync();
        } catch (e) {
          console.warn('Failed to unload previous sound:', e);
        }
        setSound(null);
      }

      // Create new sound instance for auto-play
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: story.audioUrl },
        {
          progressUpdateIntervalMillis: 100,
          shouldPlay: true,
          volume: 1.0,
          rate: 1.0,
          isMuted: false,
          isLooping: false,
          shouldCorrectPitch: true,
        }
      );

      // Set maximum volume explicitly
      await newSound.setVolumeAsync(1.0);
      
      // Set status update handler before setting state
      newSound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) return;

        setCurrentTime(status.positionMillis / 1000);
        progress.value = status.positionMillis / (status.durationMillis || 1);

        if (status.didJustFinish) {
          setIsPlaying(false);
          setCurrentTime(0);
          progress.value = 0;
          setCurrentlyPlayingId(null);
          setContextIsPlaying(false);
          
          // cleanup
          newSound.unloadAsync();
          setSound(null);
        }
      });
      
      // Set state after status handler is set up
      setSound(newSound);
      setIsPlaying(true);
      setCurrentlyPlayingId(story.id);
      setContextIsPlaying(true);
      isPlayingRef.current = false; // Clear the guard
    } catch (error) {
      console.error('Error playing audio:', error);
      setIsPlaying(false);
      setSound(null);
      setCurrentlyPlayingId(null);
      setContextIsPlaying(false);
      isPlayingRef.current = false; // Clear the guard on error
    }
  };

  return (
    <VisibilitySensor onChange={handleImageVisibility}>
      <View ref={viewRef} style={styles.container} onLayout={onLayout}>
        <TouchableOpacity
          style={[styles.card]}
          onPress={() => router.push(`/story/${story.id}`)}
          activeOpacity={0.9}
        >
          <View style={styles.backgroundContainer}></View>
          {shouldHighlight && (
            <View pointerEvents="none" style={styles.highlightOverlay} />
          )}
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <TouchableOpacity onPress={handleProfilePress}>
                <Image
                  source={{ uri: story.user.profileImage }}
                  style={styles.avatar}
                />
              </TouchableOpacity>
              <View style={styles.userInfo}>
                <Typography variant="body" style={styles.username}>
                  {story.user.name}
                </Typography>
                <Typography variant="caption" style={styles.headerTimestamp}>
                  {formatTimeAgo(story.createdAt)}
                </Typography>
              </View>
              {((story.reactionCounts && story?.reactionCounts?.length > 0) ||
                audioReactionCount > 0) && (
                <View style={styles.headerReactionCounts}>
                  {audioReactionCount > 0 && (
                    <View style={styles.headerReactionCount}>
                      <View style={{ width: 20, height: 20 }}>
                        <AudioWaveIcon />
                      </View>
                      <View style={styles.reactionCountBadge}>
                        <Typography
                          variant="caption"
                          style={styles.reactionCountText}
                        >
                          {audioReactionCount}
                        </Typography>
                      </View>
                    </View>
                  )}
                  {story?.reactionCounts?.map((reaction) => (
                    <View
                      key={reaction.emoji_type}
                      style={styles.headerReactionCount}
                    >
                      <Typography variant="body" style={styles.headerEmoji}>
                        {EMOJIS[reaction.emoji_type]}
                      </Typography>
                      <View style={styles.reactionCountBadge}>
                        <Typography
                          variant="caption"
                          style={styles.reactionCountText}
                        >
                          {reaction.count}
                        </Typography>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity onPress={() => setShowMenu(!showMenu)}>
                <MoreVertical size={16} color="#000" />
              </TouchableOpacity>
            </View>
          </View>
          {/* Timestamp, Title, Category */}
          <View style={styles.metaSection}>
            <View style={styles.titleRow}>
              <View style={styles.titleContainer}>
                <View style={styles.titleTextWrapper}>
                  <Typography variant="h3" style={styles.title}>
                    {story.title}{' '}
                  </Typography>
                  {story.category && (
                    <View style={styles.categoryTag}>
                      <TagIcon
                        size={14}
                        color="#000405"
                        fill="#FFFB00"
                        strokeWidth={1.2}
                        style={{
                          position: 'relative',
                        }}
                      />
                      <Typography variant="bodySmall" style={styles.categoryText}>
                        {story.category}
                      </Typography>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </View>
          {/* Description */}
          {story.transcription && (
            <TouchableOpacity
              style={styles.descriptionBox}
              activeOpacity={0.7}
              onPress={() => setShowTranscriptionModal(true)}
            >
              <View style={styles.verticalLine} />
              <Typography
                variant="body"
                style={styles.description}
                numberOfLines={2}
              >
                {story.transcription}
              </Typography>
            </TouchableOpacity>
          )}
          {/* Footer */}
          <View style={styles.footer}>
            <View style={styles.footerLeft}>
              <TouchableOpacity
                onPress={handlePlayPause}
                style={styles.playButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                {isPlaying ? (
                  <Pause size={24} color="#000" />
                ) : (
                  <Play size={24} color="#000" />
                )}
              </TouchableOpacity>
              <Typography variant="bodyBold" style={styles.duration}>
                {formatAudioDuration(story.duration)}
              </Typography>
              <View style={styles.waveform}>
                {[...Array(7)].map((_, i) => (
                  <WaveformBar key={i} index={i} isPlaying={isPlaying} />
                ))}
              </View>
            </View>
            <View style={styles.footerRight}>
              {/* Story Actions */}
              <View style={styles.actions}>
                {!isCurrentUser && ( // Only show reaction button for other users' stories
                  <View style={styles.reactionButtonContainer}>
                    {showGraffitiSplash && <GraffitiSplash />}
                    <Menu
                      style={{ backgroundColor: '#FFFEDA', borderRadius: 30 }}
                    >
                      <MenuTrigger
                        customStyles={{
                          TriggerTouchableComponent: TouchableWithoutFeedback,
                        }}
                      >
                        <View
                          style={[
                            styles.reactionButton,
                            story?.userReaction &&
                              styles.selectedReactionButton,
                          ]}
                          // onPress={handleReactionPress}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          {story?.userReaction ? (
                            <Typography variant="body" style={styles.emoji}>
                              {EMOJIS[story?.userReaction.emoji_type]}
                            </Typography>
                          ) : (
                            <Image
                              source={require('../../assets/icons/reactIcon.png')}
                              resizeMode="contain"
                              style={{ width: 36, height: 32 }}
                            />
                          )}
                        </View>
                      </MenuTrigger>
                      <MenuOptions
                        optionsContainerStyle={{
                          borderRadius: 30,
                          padding: 12,
                          marginTop: -55,
                        }}
                      >
                        <View
                          style={{
                            flexDirection: 'row',
                            gap: 5,
                            paddingHorizontal: 12,
                            borderRadius: 30,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {Object.entries(EMOJIS).map(
                            ([type, emoji], index) => (
                              <MenuOption
                                key={index}
                                onSelect={async () => {
                                  if (Platform.OS !== 'web') {
                                    Haptics.impactAsync(
                                      Haptics.ImpactFeedbackStyle.Light
                                    );
                                  }
                                  setShowGraffitiSplash(true);
                                  setTimeout(
                                    () => setShowGraffitiSplash(false),
                                    400
                                  );
                                  handleEmojiSelect(
                                    position,
                                    story,
                                    type as ReactionType
                                  );
                                }}
                                customStyles={{
                                  optionWrapper: {
                                    backgroundColor: 'transparent',
                                  }, // removes gray
                                  optionTouchable: {
                                    underlayColor: 'transparent',
                                  }, // disables highlight
                                }}
                              >
                                <Typography
                                  variant="h1"
                                  style={[
                                    styles.emoji,
                                    { fontSize: sizeStyles.emojiSize },
                                  ]}
                                >
                                  {emoji}
                                </Typography>
                              </MenuOption>
                            )
                          )}
                        </View>
                      </MenuOptions>
                    </Menu>
                  </View>
                )}
                <TouchableOpacity
                  style={styles.talkButton}
                  onPress={handleTalkPress}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Mic2 size={18} color="#000" />
                  <Typography variant="bodyBold" style={styles.talkText}>
                    talk
                  </Typography>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Transcription Modal */}
          <Modal
            visible={showTranscriptionModal}
            transparent
            animationType="fade"
            onRequestClose={() => setShowTranscriptionModal(false)}
          >
            <View
              style={[
                styles.transcriptionModalOverlay,
                { justifyContent: 'center', alignItems: 'center' },
              ]}
            >
              <View
                style={[
                  styles.transcriptionModalContent,
                  {
                    maxHeight: '80%',
                    marginHorizontal: 20,
                    borderRadius: 24,
                    width: '90%',
                  },
                ]}
              >
                <TouchableOpacity
                  onPress={() => setShowTranscriptionModal(false)}
                  style={styles.closeButton}
                >
                  <X size={24} color="#000" />
                </TouchableOpacity>
                <View style={styles.modalHeader}>
                  <Typography variant="h2" style={styles.modalTitle}>
                    Transcription
                  </Typography>
                </View>
                <ScrollView style={styles.transcriptionScroll}>
                  <Typography variant="body" style={styles.transcriptionText}>
                    {story.transcription}
                  </Typography>
                </ScrollView>
              </View>
            </View>
          </Modal>

          {/* Menu Modal */}
          <Modal
            visible={showMenu}
            transparent
            animationType="fade"
            onRequestClose={() => setShowMenu(false)}
          >
            <TouchableOpacity
              style={styles.menuOverlay}
              activeOpacity={1}
              onPress={() => setShowMenu(false)}
            >
              <View style={styles.menuContent}>
                {isCurrentUser ? (
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={handleDelete}
                  >
                    <Trash2
                      size={16}
                      color="#FF0000"
                      style={{ marginRight: 8 }}
                    />
                    <Typography variant="body" style={styles.deleteText}>
                      Delete Story
                    </Typography>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={async () => {
                      setShowMenu(false);
                      // Prompt for reason (optional)
                      let reason = '';
                      if (Platform.OS !== 'web') {
                        // Use Alert.prompt on iOS, fallback to default reason on Android
                        if (Platform.OS === 'ios') {
                          Alert.prompt(
                            'Report Story',
                            'Why are you reporting this story? (optional)',
                            [
                              { text: 'Cancel', style: 'cancel' },
                              {
                                text: 'Report',
                                onPress: async (input) => {
                                  reason = input || '';
                                  await supabase
                                    .from('reported_stories')
                                    .insert({ story_id: story.id, reason });
                                  Alert.alert(
                                    'Reported',
                                    'Thank you for reporting this story.'
                                  );
                                },
                              },
                            ],
                            'plain-text'
                          );
                          return;
                        }
                      }
                      // Android/web fallback: just report with empty reason
                      await supabase
                        .from('reported_stories')
                        .insert({ story_id: story.id, reason });
                      Alert.alert(
                        'Reported',
                        'Thank you for reporting this story.'
                      );
                    }}
                  >
                    <MoreVertical
                      size={16}
                      color="#FF0000"
                      style={{ marginRight: 8 }}
                    />
                    <Typography variant="body" style={styles.deleteText}>
                      Report Story
                    </Typography>
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>
          </Modal>

          {/* User Profile Modal */}
          <Modal
            visible={showUserProfileModal}
            transparent
            animationType="fade"
            onRequestClose={() => setShowUserProfileModal(false)}
          >
            <View style={styles.userProfileModalOverlay}>
              <View style={styles.userProfileModalContent}>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setShowUserProfileModal(false)}
                >
                  <X size={24} color="#000" />
                </TouchableOpacity>

                <View style={styles.userProfileHeader}>
                  <Image
                    source={{ uri: story.user.profileImage }}
                    style={styles.userProfileAvatar}
                  />
                  <Typography variant="h2" style={styles.userProfileName}>
                    {story.user.name}
                  </Typography>
                  <Typography
                    variant="bodySmall"
                    style={styles.userProfileUsername}
                  >
                    @{story.user.username}
                  </Typography>
                </View>

                <View style={styles.userProfileStats}>
                  <View style={styles.userProfileStat}>
                    <Typography
                      variant="h3"
                      style={styles.userProfileStatNumber}
                    >
                      {story.user.friend_count}
                    </Typography>
                    <Typography
                      variant="caption"
                      style={styles.userProfileStatLabel}
                    >
                      Friends
                    </Typography>
                  </View>
                  <View style={styles.userProfileStatDivider} />
                  <View style={styles.userProfileStat}>
                    <Typography
                      variant="h3"
                      style={styles.userProfileStatNumber}
                    >
                      {story.user.points || 0}
                    </Typography>
                    <Typography
                      variant="caption"
                      style={styles.userProfileStatLabel}
                    >
                      Points 🎧
                    </Typography>
                  </View>
                </View>

                {story.user.college && (
                  <View style={styles.userProfileInfo}>
                    <School size={16} color="#000" style={{ marginRight: 8 }} />
                    <Typography
                      variant="body"
                      style={styles.userProfileInfoText}
                    >
                      {story.user.college}
                    </Typography>
                  </View>
                )}

                {!isCurrentUser && (
                  <TouchableOpacity
                    style={[
                      styles.blockButton,
                      isBlocked ? styles.unblockButton : {},
                    ]}
                    onPress={handleBlockUser}
                  >
                    <Ban
                      size={16}
                      color={isBlocked ? '#000' : '#FF3B30'}
                      style={{ marginRight: 8 }}
                    />
                    <Typography
                      variant="body"
                      style={[
                        styles.blockButtonText,
                        isBlocked ? styles.unblockButtonText : {},
                      ]}
                    >
                      {isBlocked ? 'Unblock User' : 'Block User'}
                    </Typography>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </Modal>
        </TouchableOpacity>
      </View>
    </VisibilitySensor>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emojiButton: {
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedEmoji: {
    backgroundColor: '#FFFEDA',
    borderWidth: 1,
    borderColor: '#000405',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    padding: 12,
    paddingRight: 16,
    marginBottom: 16,
    width: '100%',
    maxWidth: 366,
    alignSelf: 'center',
    gap: 12,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardActive: {
    borderColor: '#FFFB00',
  },
  highlightOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#FFFB00',
  },
  backgroundContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    overflow: 'hidden',
  },
  backgroundImage: {
    width: '100%',
    height: '100%',
    borderRadius: 33,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    overflow: 'visible',
    position: 'relative',
    zIndex: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    marginRight: 60,
    overflow: 'visible',
  },
  headerReactionCounts: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 23,
    overflow: 'visible',
    position: 'relative',
    zIndex: 2,
  },
  headerReactionCount: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 6,
    paddingHorizontal: 8,
    width: 36,
    height: 36,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    marginLeft: -12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  reactionCountBadge: {
    position: 'absolute',
    left: -4,
    bottom: -4,
    backgroundColor: '#FFFEDA',
    borderRadius: 10,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  reactionCountText: {
    fontFamily: 'Nunito-Regular',
    fontSize: 10,
    fontWeight: '700',
    color: '#000405',
    textAlign: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 6,
  },
  userInfo: {
    flexDirection: 'column',
    gap: 2,
  },
  username: {
    fontFamily: 'Nunito-Regular',
    fontSize: 14,
    color: '#000',
    fontWeight: '400',
  },
  headerTimestamp: {
    fontFamily: 'Nunito-Regular',
    fontSize: 12,
    color: '#8A8E8F',
    fontWeight: '400',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 24,
    marginLeft: 8,
  },
  visibilityTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6B7280',
    borderRadius: 14,
    paddingHorizontal: 8,
    height: 20,
    gap: 3,
  },
  visibilityText: {
    fontFamily: 'Nunito-Regular',
    fontSize: 11,
    color: '#fff',
    fontWeight: '600',
    textAlignVertical: 'center',
    lineHeight: 20,
    marginTop: 0,
    marginBottom: 0,
    paddingTop: 0,
    paddingBottom: 0,
  },
  metaSection: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 2,
    marginBottom: 4,
  },
  timestamp: {
    fontFamily: 'Nunito-Regular',
    fontSize: 12,
    color: '#8A8E8F',
    fontWeight: '400',
    marginBottom: 2,
  },
  titleRow: {
    width: '100%',
    marginBottom: 2,
  },
  titleContainer: {
    flex: 1,
  },
  titleTextWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    rowGap: 8,
    columnGap: 0,
    flexShrink: 1,
  },
  title: {
    fontFamily: 'Nunito-Black',
    fontSize: 20,
    color: '#000405',
    fontWeight: '800',
    lineHeight: 27,
    marginRight: 8,
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  categoryTag: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
    paddingHorizontal: 10,
    gap: 4,
    minWidth: 83,
    height: 28,
    backgroundColor: '#FAF2E0',
    borderRadius: 26,
    marginLeft: 4,
    flexShrink: 0,
  },
  categoryText: {
    fontFamily: 'Nunito-SemiBold',
    fontStyle: 'normal',
    fontWeight: '600',
    fontSize: 12,
    lineHeight: 16,
    color: '#000405',
    textAlignVertical: 'center',
    marginTop: 0,
    marginBottom: 0,
    paddingTop: 0,
    paddingBottom: 0,
    flexShrink: 1,
    flexGrow: 1,
  },
  descriptionBox: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 10,
    gap: 8,
    width: '100%',
    maxWidth: 342,
    minHeight: 58,
    backgroundColor: '#FFFDF8',
    borderRadius: 12,
    marginTop: 2,
    marginBottom: 2,
    flexShrink: 1,
  },
  description: {
    flex: 1,
    maxWidth: 318,
    minHeight: 42,
    fontFamily: 'Nunito-Regular',
    fontStyle: 'normal',
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 20,
    color: '#282929',
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  verticalLine: {
    width: 2,
    height: 38,
    backgroundColor: '#E5E7EB',
    alignSelf: 'stretch',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    gap: 6,
    backgroundColor: '#FFFEDA',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 0,
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
  },
  duration: {
    fontFamily: 'Nunito-SemiBold',
    fontSize: 16,
    fontWeight: '600',
    color: '#000405',
    marginLeft: 4,
    marginRight: 4,
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 32,
    marginLeft: 5,
    marginBottom: 0,
    marginTop: -14,
  },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  talkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFB00',
    borderRadius: 26,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
    minWidth: 70,
    height: 40,
    borderWidth: 1,
    borderColor: '#000000',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.24,
    shadowRadius: 24,
    elevation: 8,
  },
  talkText: {
    fontFamily: 'Nunito-SemiBold',
    fontStyle: 'normal',
    fontWeight: '600',
    fontSize: 13,
    lineHeight: 18,
    color: '#00080A',
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
    marginTop: 0,
    marginBottom: 0,
    paddingTop: 0,
    paddingBottom: 0,
  },
  playButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  transcriptionModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  transcriptionModalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    paddingBottom: 10,
    maxHeight: '80%',
    width: '100%',
    maxWidth: 340,
  },
  transcriptionModalText: {
    fontSize: 16,
    color: '#282929',
    marginBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 16,
    width: '100%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    fontFamily: 'Nunito-Bold',
    textTransform: 'lowercase',
    textAlignVertical: 'center',
    lineHeight: 32,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E4E4E4',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  transcriptionScroll: {
    maxHeight: '80%',
    marginBottom: 0,
  },
  transcriptionText: {
    fontSize: 16,
    color: '#000000',
    lineHeight: 24,
  },
  closeModalButton: {
    alignSelf: 'center',
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 24,
    borderRadius: 16,
    backgroundColor: '#FAF2E0',
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 8,
    minWidth: 160,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  deleteText: {
    color: '#FF0000',
    fontSize: 16,
  },
  userProfileModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  userProfileModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    width: '90%',
    maxWidth: 360,
    alignItems: 'center',
  },
  userProfileHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  userProfileAvatar: {
    width: 92,
    height: 92,
    borderRadius: 46,
    marginBottom: 16,
    borderWidth: 6,
    borderColor: '#FFD600',
  },
  userProfileName: {
    fontSize: 24,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  userProfileUsername: {
    fontSize: 14,
    color: '#666',
  },
  userProfileStats: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  userProfileStat: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  userProfileStatDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#000',
    opacity: 0.1,
  },
  userProfileStatNumber: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  userProfileStatLabel: {
    fontSize: 12,
    color: '#666',
  },
  userProfileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
    padding: 12,
    borderRadius: 12,
  },
  userProfileInfoText: {
    fontSize: 14,
    color: '#000',
  },
  reactionButton: {
    padding: 8,
    borderRadius: 16,
    //  backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 5,
    width: 40,
    height: 40,
  },
  selectedReactionButton: {
    backgroundColor: '#FFFEDA',
    borderWidth: 1,
    borderColor: '#000405',
  },
  reactionText: {
    color: '#000',
  },
  reactionCounts: {
    marginTop: 8,
  },
  reactionCountsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  reactionCount: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  audioReactionCount: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  waveformBar: {
    width: 2,
    backgroundColor: '#666666',
    borderRadius: 1,
  },
  totalReactions: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  totalReactionsText: {
    color: '#666666',
  },
  audioWaveContainer: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 12,
  },
  audioWaveIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  waveBar: {
    width: 2,
    backgroundColor: '#000',
    borderRadius: 1,
  },
  emoji: {
    fontSize: 17,
    textAlign: 'center',
    width: 24,
    height: 24,
    lineHeight: 22,
    alignSelf: 'center',
    textAlignVertical: 'center',
    marginTop: -1,
  },
  headerEmoji: {
    fontFamily: 'Archivo',
    fontSize: 17,
    lineHeight: 22,
    color: '#0A0200',
    width: 24,
    height: 24,
    textAlign: 'center',
    alignSelf: 'center',
    textAlignVertical: 'center',
    marginTop: -1,
  },
  blockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#FFEFB4',
    marginTop: 16,
    width: '100%',
  },
  unblockButton: {
    backgroundColor: '#E5E5EA',
  },
  blockButtonText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '600',
  },
  unblockButtonText: {
    color: '#000',
  },
  emojiRainContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  emojiRain: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  emojiRainText: {
    fontSize: 24,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reactionButtonContainer: {
    position: 'relative',
  },
  confettiContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    pointerEvents: 'none',
  },
  confettiPiece: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    top: '50%',
    left: '50%',
    marginTop: -4,
    marginLeft: -4,
  },
});
