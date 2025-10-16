import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Dimensions,
  Platform,
  Modal,
  LayoutChangeEvent,
  Share,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Typography } from '@/components/ui/Typography';
import {
  Play,
  Pause,
  ArrowLeft,
  Share as ShareICon,
  FileText,
  Mic2,
  X,
} from 'lucide-react-native';
import { Audio } from 'expo-av';
import { formatTimeAgo, formatDuration } from '@/utils/timeUtils';
import { theme } from '@/constants/theme';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import { QuickRecordingModal } from '@/components/audio/QuickRecordingModal';
import { ReactionItem } from '@/components/stories/ReactionItem';
import type { Database } from '@/types/supabase';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
} from 'react-native-reanimated';
import { useAudioPlayback } from '@/lib/AudioPlaybackContext';
import { Tag as TagIcon } from 'lucide-react-native';
import { SpinningHeadphone } from '@/components/ui/SpinningHeadphone';


const { width } = Dimensions.get('window');

type StoryResponse = {
  id: string;
  title: string;
  description: string | null;
  transcription: string | null;
  audio_url: string;
  duration: number;
  created_at: string;
  category: string;
  user: {
    id: string;
    username: string;
    avatar_url: string | null;
    friend_count: number;
  };
};

type Story = {
  id: string;
  title: string;
  description: string | null;
  transcription: string | null;
  audioUrl: string;
  duration: number;
  createdAt: string;
  category: string;
  user: {
    id: string;
    name: string;
    username: string;
    profileImage: string;
    followersCount: number;
  };
};

type Profile = Database['public']['Tables']['profiles']['Row'];
type DbReaction = Database['public']['Tables']['reactions']['Row'];

type Reaction = Omit<Omit<DbReaction, 'read'>, 'user'> & {
  user: Pick<Profile, 'id' | 'username' | 'avatar_url'>;
  reply_to?: string | null;
  replying_to?: {
    id: string;
    transcription: string | null;
    user: {
      username: string;
    };
  };
};

const WaveformBar = ({
  index,
  isPlaying,
}: {
  index: number;
  isPlaying: boolean;
}) => {
  const height = useSharedValue(12 + Math.random() * 20);
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

// Update the helper function to handle nested replies
const organizeReactionsIntoThreads = (reactions: Reaction[]) => {
  const threads: { [key: string]: Reaction[] } = {};
  const topLevelReactions: Reaction[] = [];
  const replyThreads: { [key: string]: Reaction[] } = {};

  // First pass: organize all replies
  reactions.forEach((reaction) => {
    if (reaction.reply_to) {
      if (!threads[reaction.reply_to]) {
        threads[reaction.reply_to] = [];
      }
      threads[reaction.reply_to].push(reaction);

      // Also track replies to this reply
      if (!replyThreads[reaction.id]) {
        replyThreads[reaction.id] = [];
      }
    } else {
      topLevelReactions.push(reaction);
    }
  });

  return { threads, topLevelReactions, replyThreads };
};

// Create a recursive component for rendering reaction threads
const ReactionThread = ({
  reaction,
  threads,
  replyThreads,
  expandedThreads,
  toggleThread,
  onReply,
  onReplyClick,
  reactionRefs,
  handleReactionLayout,
  currentUserId,
  onDeleteReaction,
  level = 0,
}: {
  reaction: Reaction;
  threads: { [key: string]: Reaction[] };
  replyThreads: { [key: string]: Reaction[] };
  expandedThreads: { [key: string]: boolean };
  toggleThread: (id: string) => void;
  onReply: (reaction: Reaction) => void;
  onReplyClick: (reactionId: string) => void;
  reactionRefs: React.MutableRefObject<{ [key: string]: View | null }>;
  handleReactionLayout: (reactionId: string, event: LayoutChangeEvent) => void;
  currentUserId?: string;
  onDeleteReaction?: (reactionId: string) => void;
  level?: number;
}) => {
  const hasReplies = threads[reaction.id]?.length > 0;

  return (
    <View style={styles.threadContainer}>
      <View
        ref={(ref: View | null) => {
          reactionRefs.current[reaction.id] = ref;
        }}
        onLayout={(event) => handleReactionLayout(reaction.id, event)}
        style={styles.reactionContainer}
      >
        <ReactionItem
          reaction={reaction}
          onReply={onReply}
          onReplyClick={onReplyClick}
          replyCount={threads[reaction.id]?.length || 0}
          onViewReplies={() => toggleThread(reaction.id)}
          isExpanded={expandedThreads[reaction.id]}
          isNestedReply={level > 1}
          currentUserId={currentUserId}
          onDelete={onDeleteReaction}
        />
      </View>

      {/* Replies */}
      {expandedThreads[reaction.id] && hasReplies && (
        <View
          style={[
            styles.repliesContainer,
            level > 0 && styles.nestedRepliesContainer,
          ]}
        >
          {threads[reaction.id].map((reply) => (
            <ReactionThread
              key={reply.id}
              reaction={reply}
              threads={threads}
              replyThreads={replyThreads}
              expandedThreads={expandedThreads}
              toggleThread={toggleThread}
              onReply={onReply}
              onReplyClick={onReplyClick}
              reactionRefs={reactionRefs}
              handleReactionLayout={handleReactionLayout}
              currentUserId={currentUserId}
              onDeleteReaction={onDeleteReaction}
              level={level + 1}
            />
          ))}
        </View>
      )}
    </View>
  );
};

export default function StoryDetails() {
  const params = useLocalSearchParams();
  const id = params.id?.toString();
  const prefetchedData = params.prefetchedData
    ? JSON.parse(params.prefetchedData as string)
    : null;
  const router = useRouter();
  const { currentlyPlayingId, setCurrentlyPlayingId } = useAudioPlayback();

  const [isPlaying, setIsPlaying] = useState(false);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [story, setStory] = useState<any>(prefetchedData);
  const [loading, setLoading] = useState(!prefetchedData);
  const [showTranscriptModal, setShowTranscriptModal] = useState(false);
  const [showReactionModal, setShowReactionModal] = useState(false);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [selectedReaction, setSelectedReaction] = useState<Reaction | null>(
    null
  );
  const reactionRefs = useRef<{ [key: string]: View | null }>({});
  const scrollViewRef = useRef<ScrollView>(null);
  const reactionPositions = useRef<{ [key: string]: number }>({});
  const [contentHeight, setContentHeight] = useState(0);
  const [expandedThreads, setExpandedThreads] = useState<{
    [key: string]: boolean;
  }>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const toggleThread = (reactionId: string) => {
    setExpandedThreads((prev) => ({
      ...prev,
      [reactionId]: !prev[reactionId],
    }));
  };

  const handleDeleteReaction = async (reactionId: string) => {
    try {
      const { error } = await supabase
        .from('reactions')
        .delete()
        .eq('id', reactionId);

      if (error) {
        console.error('Error deleting reaction:', error);
        return;
      }

      // Remove the reaction from local state
      setReactions(prev => prev.filter(reaction => reaction.id !== reactionId));
    } catch (error) {
      console.error('Error deleting reaction:', error);
    }
  };
  async function checkUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      console.log('User is logged in:', user);
      setCurrentUserId(user.id);
    } else {
      console.log('id :', id);
      router.replace({ pathname: '/(auth)/sign-up', params: { id: id } });
    }
  }

  useEffect(() => {
    checkUser();
  }, []);

  const fetchStory = useCallback(async () => {
    if (!id || prefetchedData) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('stories')
        .select(
          `
          id,
          title,
          description,
          transcription,
          audio_url,
          duration,
          created_at,
          category,
          user:user_id!inner(
            id,
            username,
            avatar_url,
            friend_count
          )
        `
        )
        .eq('id', id)
        .single();

      if (error) throw error;

      if (data) {
        const storyData = data as unknown as StoryResponse;
        // Convert Supabase data to match our AudioStory format
        const formattedData: Story = {
          id: storyData.id,
          title: storyData.title,
          description: storyData.description,
          transcription: storyData.transcription,
          audioUrl: storyData.audio_url,
          duration: storyData.duration,
          createdAt: storyData.created_at,
          category: storyData.category,
          user: {
            id: storyData.user.id,
            name: storyData.user.username,
            username: storyData.user.username,
            profileImage:
              storyData.user.avatar_url ||
              'https://hilo.supabase.co/storage/v1/object/public/avatars/default.png',
            followersCount: storyData.user.friend_count || 0,
          },
        };
        setStory(formattedData);
      }
    } catch (error) {
      console.error('Error fetching story:', error);
    } finally {
      setLoading(false);
    }
  }, [id, prefetchedData]);

  const fetchReactions = useCallback(async () => {
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from('reactions')
        .select(
          `
          id,
          user_id,
          story_id,
          audio_url,
          transcription,
          reply_to,
          created_at,
          duration,
          like_count,
          user:user_id!inner(
            id,
            username,
            avatar_url
          ),
          replying_to:reply_to(
            id,
            transcription,
            user:user_id!inner(
              username
            )
          )
        `
        )
        .eq('story_id', id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedReactions: Reaction[] = (data || []).map((r) => {
        const reaction = r as any;
        return {
          id: reaction.id,
          user_id: reaction.user_id,
          story_id: reaction.story_id,
          audio_url: reaction.audio_url,
          transcription: reaction.transcription,
          reply_to: reaction.reply_to,
          created_at: reaction.created_at,
          duration: reaction.duration,
          like_count: reaction.like_count,
          user: {
            id: reaction.user.id,
            username: reaction.user.username,
            avatar_url: reaction.user.avatar_url,
          },
          replying_to: reaction.replying_to
            ? {
                id: reaction.replying_to.id,
                transcription: reaction.replying_to.transcription,
                user: {
                  username: reaction.replying_to.user.username,
                },
              }
            : undefined,
        };
      });

      setReactions(formattedReactions);
    } catch (error) {
      console.error('Error fetching reactions:', error);
    }
  }, [id]);

  useEffect(() => {
    fetchStory();
    fetchReactions();
  }, [fetchStory, fetchReactions]);

  useEffect(() => {
    // Set up audio mode for better quality
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
    });
  }, []);

  // Clean up sounds when component unmounts
  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  // Add effect to pause any playing audio when entering the page
  useEffect(() => {
    const pauseAllAudio = async () => {
      try {
        // Stop any currently playing audio
        if (sound) {
          await sound.stopAsync();
          await sound.unloadAsync();
          setSound(null);
          setIsPlaying(false);
        }
        // Clear the currently playing ID in context
        setCurrentlyPlayingId(null);
      } catch (error) {
        console.error('Error stopping audio:', error);
      }
    };

    pauseAllAudio();
  }, []);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  const handlePlayPause = async () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    try {
      // If sound exists and is playing, pause it
      if (sound && isPlaying) {
        await sound.pauseAsync();
        setIsPlaying(false);
        return;
      }

      // If sound exists but is paused, or no sound exists, restart/start the audio
      if (sound) {
        // Unload existing sound to restart from beginning
        await sound.unloadAsync();
        setSound(null);
      }

      // Load and play the sound (always restart from beginning)
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
      setSound(newSound);
      setIsPlaying(true);

      newSound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) return;
        if (status.didJustFinish) {
          setIsPlaying(false);
        }
      });
    } catch (error) {
      console.error('Error playing audio:', error);
      setIsPlaying(false);
      setSound(null);
    }
  };

  const handleReactionSuccess = () => {
    fetchReactions();
  };

  const handleReactionReply = (reaction: Reaction) => {
    setSelectedReaction(reaction);
    setShowReactionModal(true);
  };

  const handleReplyClick = (reactionId: string) => {
    // Find the reaction in our reactions array
    const targetReaction = reactions.findIndex((r) => r.id === reactionId);
    if (targetReaction === -1) {
      console.log('Could not find target reaction:', reactionId);
      return;
    }

    const position = reactionPositions.current[reactionId];
    if (position !== undefined && scrollViewRef.current) {
      // Scroll to show the reaction near the top of the screen
      const scrollOffset = Math.max(0, position - 150); // 150px from top
      scrollViewRef.current.scrollTo({ y: scrollOffset, animated: true });

      // Flash the background of the target reaction
      const targetRef = reactionRefs.current[reactionId];
      if (targetRef) {
        targetRef.setNativeProps({
          style: { backgroundColor: '#FFEFB4' },
        });
        setTimeout(() => {
          targetRef.setNativeProps({
            style: { backgroundColor: '#FAF2E0' },
          });
        }, 1500);
      }
    } else {
      console.log('Could not find position for reaction:', reactionId);
    }
  };

  const handleReactionLayout = (
    reactionId: string,
    event: LayoutChangeEvent
  ) => {
    reactionPositions.current[reactionId] = event.nativeEvent.layout.y;
  };

  if (!id) {
    return (
      <View style={styles.container}>
        <Typography variant="body">No story ID provided</Typography>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <SpinningHeadphone size={32} />
      </View>
    );
  }

  if (!story) {
    return (
      <View
        style={[
          styles.container,
          { alignItems: 'center', justifyContent: 'center' },
        ]}
      >
        <Typography variant="h1" style={{ fontSize: 120, marginBottom: 20 }}>
          😢
        </Typography>
        <Typography variant="body">
          Story not found or You do not have access
        </Typography>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      {/* Custom Header */}
      <View
        style={[
          styles.header,
          { flexDirection: 'row', justifyContent: 'space-between' },
        ]}
      >
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <ArrowLeft size={24} color="#000405" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            Share.share({
              title: 'Listen on Hear Me Out',
              message: `Listen on Hear Me Out- ${story.title}\n Check it out now:`,
              url: `https://sharehearmeout.vercel.app/story/${story.id}`,
            });
          }}
        >
          <ShareICon size={24} color="#000405" />
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.content}
        showsVerticalScrollIndicator={false}
        onLayout={(event) => {
          setContentHeight(event.nativeEvent.layout.height);
        }}
      >
        <View style={styles.profileSection}>
          <View style={styles.avatarOuterCircle}>
            <Image
              source={{ uri: story.user.profileImage }}
              style={styles.avatarImage}
            />
          </View>
          <Typography variant="body" style={styles.username}>
            {story?.user?.name?.toLowerCase() || 'unknown user'}
          </Typography>
        </View>

        <View style={styles.titleSection}>
          <Typography variant="h1" style={styles.title}>
            {story.title}
          </Typography>
        </View>

        <View style={styles.categoryTagContainer}>
          <View style={styles.categoryTag}>
            <TagIcon
              size={14}
              color="#000405"
              fill="#FFFB00"
              strokeWidth={2.0}
              style={{
                position: 'relative',
              }}
            />
            <Typography variant="bodySmall" style={styles.categoryText}>
              {story.category}
            </Typography>
          </View>
        </View>

        <View style={styles.infoRow}>
          <Typography variant="caption" style={styles.timestamp}>
            {formatTimeAgo(story.createdAt)}
          </Typography>
          <Typography variant="caption" style={styles.duration}>
            {formatDuration(story.duration)}
          </Typography>
        </View>

        <View style={styles.waveformAndTagRow}>
          <View style={styles.audioControlContainer}>
            <TouchableOpacity style={styles.playButton} onPress={handlePlayPause}>
              {isPlaying ? (
                <Pause size={20} color="#000" />
              ) : (
                <Play size={20} color="#000" fill="#000" />
              )}
            </TouchableOpacity>
            <View style={styles.waveformRow}>
              {[...Array(7)].map((_, i) => (
                <WaveformBar key={i} index={i} isPlaying={isPlaying} />
              ))}
            </View>
          </View>
        </View>

        {/* Transcription Button */}
        {story.transcription && (
          <TouchableOpacity
            style={styles.transcriptionButton}
            onPress={() => setShowTranscriptModal(true)}
            activeOpacity={0.8}
          >
            <FileText size={14} color="#9B5602" />
            <Typography variant="body" style={styles.transcriptionButtonText}>
              View transcription
            </Typography>
          </TouchableOpacity>
        )}

        {/* Reactions Section */}
        <View style={styles.reactionsSection}>
          <Typography variant="h2" style={styles.reactionsTitle}>
            Reactions
          </Typography>
          {reactions.length > 0 ? (
            (() => {
              const { threads, topLevelReactions, replyThreads } =
                organizeReactionsIntoThreads(reactions);

              return topLevelReactions.map((reaction) => (
                <ReactionThread
                  key={reaction.id}
                  reaction={reaction}
                  threads={threads}
                  replyThreads={replyThreads}
                  expandedThreads={expandedThreads}
                  toggleThread={toggleThread}
                  onReply={handleReactionReply}
                  onReplyClick={handleReplyClick}
                  reactionRefs={reactionRefs}
                  handleReactionLayout={handleReactionLayout}
                  currentUserId={currentUserId || undefined}
                  onDeleteReaction={handleDeleteReaction}
                />
              ));
            })()
          ) : (
            <View style={styles.emptyContainer}>
              <Typography variant="h3" style={styles.emptyTitle}>
                No reactions yet
              </Typography>
              <Typography
                variant="body"
                color={theme.colors.text.secondary}
                style={styles.emptyText}
              >
                Press talk to start the conversation
              </Typography>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom Controls */}
      <View style={styles.bottomControls}>
                  <TouchableOpacity
            style={styles.talkButton}
            onPress={() => {
              if (Platform.OS === 'ios') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
              setShowReactionModal(true);
            }}
          >
            <Mic2 size={18} color="#000" />
            <Typography variant="h2" style={styles.talkText}>
              talk
            </Typography>
          </TouchableOpacity>


      </View>

      {/* Transcript Modal */}
      <Modal
        visible={showTranscriptModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTranscriptModal(false)}
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
              onPress={() => setShowTranscriptModal(false)}
              style={styles.closeButton}
            >
              <X size={24} color="#000" />
            </TouchableOpacity>
            <View style={styles.modalHeader}>
              <Typography variant="h2" style={styles.modalTitle}>
                Transcription
              </Typography>
            </View>
            <ScrollView
              style={styles.transcriptionScroll}
              showsVerticalScrollIndicator={false}
            >
              <Typography variant="body" style={styles.transcriptionText}>
                {story.transcription}
              </Typography>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Reaction Modal */}
      {showReactionModal && (
        <Modal
          visible={showReactionModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => {
            setShowReactionModal(false);
            setSelectedReaction(null);
          }}
        >
          <View style={styles.modalOverlay}>
            <QuickRecordingModal
              isVisible={showReactionModal}
              storyId={id}
              onClose={() => {
                setShowReactionModal(false);
                setSelectedReaction(null);
              }}
              onSuccess={() => {
                handleReactionSuccess();
                setSelectedReaction(null);
              }}
              username={story.user.username}
              replyingTo={
                selectedReaction
                  ? {
                      transcription: selectedReaction.transcription || '',
                      reactionId: selectedReaction.id,
                    }
                  : undefined
              }
              onReplyClick={handleReplyClick}
            />
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backButton: {
    width: 48,
    height: 48,
    backgroundColor: '#FAF2E0',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  profileSection: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 16,
  },
  avatarOuterCircle: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 6,
    borderColor: '#FFEFB4',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarImage: {
    width: 92,
    height: 92,
    borderRadius: 46,
  },
  username: {
    fontSize: 16,
    color: '#888',
    marginTop: 0,
    marginBottom: 8,
    textAlign: 'center',
    fontFamily: 'Nunito',
    fontWeight: '400',
    textTransform: 'lowercase',
    letterSpacing: 0.2,
  },
  titleSection: {
    alignItems: 'center',
    marginTop: 0,
    marginBottom: 0,
    paddingHorizontal: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#000',
    textAlign: 'center',
    lineHeight: 32,
    marginBottom: 12,
    marginTop: 0,
    fontFamily: 'Nunito-Black',
  },
  categoryTagContainer: {
    alignItems: 'center',
    marginBottom: 16,
    alignSelf: 'center',
    width: 'auto',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    marginTop: 0,
  },
  timestamp: {
    fontFamily: 'Nunito',
    fontSize: 15,
    color: '#B0B0B0',
    fontWeight: '400',
    marginRight: 8,
  },
  duration: {
    fontFamily: 'Nunito',
    fontSize: 15,
    color: '#000',
    fontWeight: '700',
    textAlign: 'right',
  },
  waveformAndTagRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 8,
    gap: 16,
  },
  audioControlContainer: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 17,
    paddingHorizontal: 24,
    gap: 10,
    width: 128,
    height: 51,
    backgroundColor: '#FFFEDA',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    borderRadius: 52,
    elevation: 3,
  },
  waveformRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  categoryTag: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
    paddingHorizontal: 6,
    gap: 4,
    width: 110,
    height: 30,
    backgroundColor: '#FAF2E0',
    borderRadius: 26,
    flexShrink: 0,
    flexGrow: 0,
  },
  categoryText: {
    fontFamily: 'Nunito',
    fontStyle: 'normal',
    fontWeight: '700',
    fontSize: 12,
    lineHeight: 16,
    color: '#000405',
    textAlign: 'center',
    textAlignVertical: 'center',
    marginTop: 0,
    marginBottom: 0,
    paddingTop: 0,
    paddingBottom: 0,
    flexShrink: 1,
    flexGrow: 1,
  },
  transcriptionButton: {
    marginTop: 10,
    marginBottom: 20,
    backgroundColor: '#FAF2E0',
    borderRadius: 25,
    alignSelf: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    paddingLeft: 8,
    gap: 4,
    width: 200,
    height: 30,
  },
  transcriptionButtonText: {
    fontFamily: 'Nunito',
    fontStyle: 'normal',
    fontWeight: '600',
    fontSize: 13,
    lineHeight: 18,
    color: '#9B5602',
  },
  reactionsSection: {
    marginBottom: 100,
  },
  reactionsTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#000',
    marginBottom: 16,
  },
  bottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 32,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
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
    height: 50,
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
    flex: 1,
  },
  recordDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FF6B6B',
    marginRight: 12,
  },
  talkText: {
    fontFamily: 'Nunito',
    fontStyle: 'normal',
    fontWeight: '700',
    fontSize: 18,
    lineHeight: 24,
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
    width: 16,
    height: 16,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    paddingRight: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    maxHeight: '80%',
    width: '100%',
    maxWidth: 340,
  },
  modalScroll: {
    marginBottom: 20,
  },
  modalTranscript: {
    fontSize: 16,
    color: '#282929',
    marginBottom: 20,
  },
  closeModalButton: {
    alignSelf: 'center',
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 24,
    borderRadius: 16,
    backgroundColor: '#FAF2E0',
  },
  reactionCard: {
    backgroundColor: '#FAF2E0',
    borderRadius: 24,
    padding: 16,
    marginBottom: 16,
  },
  reactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  reactionUser: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reactionAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  reactionUsername: {
    fontSize: 14,
    color: '#000',
    fontWeight: '600',
  },
  reactionTime: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  reactionTitle: {
    fontSize: 16,
    color: '#000',
    marginBottom: 8,
  },
  quoteBox: {
    backgroundColor: '#FFEFB4',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  quoteText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  audioPlayer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    textAlign: 'center',
  },
  reactionContainer: {
    marginBottom: 8,
  },
  reactionWithReplies: {
    marginBottom: 8, // Add some space between the reaction and replies
  },
  threadContainer: {
    marginBottom: 16,
  },
  repliesContainer: {
    marginLeft: 20,
    borderLeftWidth: 2,
    borderLeftColor: '#FFD600',
    paddingLeft: 16,
  },
  repliesOutline: {
    borderWidth: 2,
    borderColor: '#FFD600',
    borderRadius: 16,
    padding: 12,
    paddingTop: 0,
    backgroundColor: '#FFFBEB',
  },
  repliesHeader: {
    backgroundColor: 'rgba(255, 214, 0, 0.15)',
    marginHorizontal: -12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#FFD600',
    borderTopLeftRadius: 14, // 2px less than container to account for border
    borderTopRightRadius: 14,
  },
  repliesHeaderText: {
    color: '#282929',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    opacity: 0.8,
  },
  nestedRepliesContainer: {
    marginLeft: 16,
    opacity: 0.9,
  },
  replyContainer: {
    marginBottom: 8,
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
    fontFamily: 'Nunito',
    textTransform: 'lowercase',
    textAlignVertical: 'center',
    lineHeight: 32,
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
});
