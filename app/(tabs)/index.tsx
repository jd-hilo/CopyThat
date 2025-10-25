import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import {
  View,
  StyleSheet,
  Platform,
  Modal,
  TouchableOpacity,
  ScrollView,
  Linking,
  FlatList,
  Alert,
  Share,
  Image,
  Text,
  ActivityIndicator,
  Animated,
  AppState,
  AppStateStatus,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  Typography,
  SpinningHeadphone,
  CustomRefreshControl,
  CommunityTitleToggle,
  HotNewToggle,
} from '@/components/ui';
import { StoryCard } from '@/components/stories/StoryCard';
import { QuickRecordingModal } from '@/components/audio/QuickRecordingModal';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { theme, Category } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/supabase';
import type { AudioStory } from '@/constants/mockData';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  UserPlus,
  Users,
  Plus,
  MoreVertical,
  Share as ShareIcon,
  LogOut,
  X,
  Mic,
} from 'lucide-react-native';
import { AddFriendsModal } from '@/components/friends/AddFriendsModal';
import { GroupModal } from '@/components/groups/GroupModal';
import { JoinGroupModal } from '@/components/groups/JoinGroupModal';
import { RecordingModal } from '@/components/audio/RecordingModal';
import { ModalC } from '@/components/modalC';
import OnBoarding from '@/components/onBoarding';
import { VoiceCloningModal } from '@/components/audio/VoiceCloningModal';
// Use require to avoid type resolution issues for expo-updates in TS
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Updates = require('expo-updates');
import React from 'react';
import { posthog } from '@/posthog';
import { useAudioPlayback } from '@/lib/AudioPlaybackContext';
import { useAuth } from '@/contexts/authContext';
import { LinearGradient } from 'expo-linear-gradient';
import { mixpanel } from '../_layout';

type Story = Database['public']['Tables']['stories']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];
type Group = Database['public']['Tables']['groups']['Row'];
type GroupMember = Database['public']['Tables']['group_members']['Row'];
type EmojiType = 'heart' | 'fire' | 'laugh' | 'wow' | 'sad';

interface EmojiReaction {
  id: string;
  story_id: string;
  user_id: string;
  emoji_type: EmojiType;
  created_at: string;
}
interface EmojiReactionCount {
  story_id: string;
  emoji_type: EmojiType;
  count: number;
}

interface StoryWithUser extends Story {
  user: Profile;
  cloned_voice_user?: Profile | null;
  is_group_story: boolean;
  group_stories?: {
    group: {
      id: string;
      name: string;
      member_count: number;
    };
  }[];
}

interface FormattedStory {
  id: string;
  title: string;
  description?: string;
  transcription?: string;
  audioUrl: string;
  duration: number;
  createdAt: string;
  createdAtMs: number;
  category: Category;
  isPrivate: boolean;
  isFriendsOnly: boolean;
  isGroupStory: boolean;
  reactionCount: number;
  likeCount: number;
  isLiked: boolean;
  creatorId?: string; // The actual user who created the story (for ownership checks)
  user: {
    id: string;
    name: string;
    username: string;
    profileImage: string;
    college: string | null;
    friend_count: number;
    friend_request_count: number;
    points: number;
  };
  group?: {
    id: string;
    name: string;
    member_count: number;
  } | null;
  userReaction?: EmojiReaction | null;
  reactionCounts?: EmojiReactionCount[] | [];
}

export default function HomeScreen() {
  const router = useRouter();
  const [isQuickRecordingModalVisible, setIsQuickRecordingModalVisible] =
    useState(false);
  const [isFeedbackRecordingModalVisible, setIsFeedbackRecordingModalVisible] =
    useState(false);
  const [thoughts, setThoughts] = useState<FormattedStory[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStory, setSelectedStory] = useState<FormattedStory | null>(
    null
  );
  const { id, feed } = useLocalSearchParams<{ id: string; feed?: string }>();
  const [toggleOn, setToggleOn] = useState(false);
  const [isCollegeFeed, setIsCollegeFeed] = useState(true);
  const [isHotFeed, setIsHotFeed] = useState(false);
  const { currentlyPlayingId, isPlaying } = useAudioPlayback();
  const [isAddFriendsModalVisible, setIsAddFriendsModalVisible] =
    useState(false);
  const [isGroupModalVisible, setIsGroupModalVisible] = useState(false);
  const [userGroups, setUserGroups] = useState<
    (Group & { member_count: { count: number } })[]
  >([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [userPoints, setUserPoints] = useState<number>(0);
  const [hasFriends, setHasFriends] = useState(false);
  const [completeProfileModal, setCompleteProfileModal] = useState(false);
  const scrollRef = useRef<FlatList>(null);
  const savedOffsetRef = useRef(0);
  const itemPositionsRef = useRef<Record<string, number>>({});
  const { user, userProfile: userProfileContext, signOut } = useAuth();
  const currentStoryRef = useRef<FormattedStory | null>(null);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showJoinGroupModal, setShowJoinGroupModal] = useState(false);
  const [isFabExpanded, setIsFabExpanded] = useState(false);
  const [showViewMembersModal, setShowViewMembersModal] = useState(false);
  const [groupMembers, setGroupMembers] = useState<any[]>([]);
  const [visibleStory, setVisibleStory] = useState();
  const { userProfile, setUserProfile } = useAuth();
  const currentVisible = useRef(null);
  const hintOpacity = useRef(new Animated.Value(0)).current;
  const hintTimerRef = useRef<any>(null);
  const [userHasVoiceClone, setUserHasVoiceClone] = useState(false);
  const [showVoiceCloningModal, setShowVoiceCloningModal] = useState(false);
  // When the playing story changes, scroll it to the top anchor
  useEffect(() => {
    if (!currentlyPlayingId) return;
    const y = itemPositionsRef.current[currentlyPlayingId];
    if (typeof y === 'number' && scrollRef.current) {
      scrollRef.current.scrollToOffset({
        offset: Math.max(0, y - 8),
        animated: true,
      });
    }
  }, [currentlyPlayingId]);
  useEffect(() => {
    const checkVoiceCloneStatus = async () => {
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('voice_clone_status')
          .eq('id', user.id)
          .single();
        
        console.log('Voice clone status check:', profile?.voice_clone_status);
        setUserHasVoiceClone(profile?.voice_clone_status === 'ready');
      }
    };

    if (userProfile) {
      mixpanel.identify(userProfile.id);
      //posthog.identify(userProfile.id, { user: userProfile });
      // Check voice clone status from database (not cached profile)
      checkVoiceCloneStatus();
    }
    if (id) {
      router.push({ pathname: '/story/[id]', params: { id: id } });
    }
    if (userProfile) {
      if (!userProfile?.username || !userProfile.college) {
        setCompleteProfileModal(true);
      }
    }
  }, [userProfile, user]);

  // Handle feed parameter and auto-refresh
  useEffect(() => {
    if (feed === 'friends') {
      setIsCollegeFeed(false);
      // Auto-refresh to show the new post
      setTimeout(() => {
        fetchThoughts();
      }, 500);
    } else if (feed === 'community') {
      setIsCollegeFeed(true);
      // Auto-refresh to show the new post
      setTimeout(() => {
        fetchThoughts();
      }, 500);
    }
  }, [feed]);
  const checkCollege = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        setUserProfile(profile);
        setUserHasVoiceClone(profile?.voice_clone_status === 'ready');

        if (profile?.college === 'None of the Above') {
          setIsCollegeFeed(true);
        }
        setUserProfile(profile);
        fetchThoughts();
      }
    } catch (error) {
      console.log('error :', error);
    }
  };

  const fetchUserGroups = async () => {
    try {
      // Don't fetch groups if user is not available
      if (!user?.id) {
        setUserGroups([]);
        return;
      }

      const { data: groups, error } = await supabase
        .from('groups')
        .select(
          `
          *,
          group_members!inner (user_id),
          member_count:group_members(count)
        `
        )
        .eq('group_members.user_id', user.id)
        .order('created_at', { ascending: false }); // Order by most recent first

      if (error) throw error;
      setUserGroups(groups || []);

      // Auto-select first group for "None of the Above" users if they have groups and no group is selected
      if (
        userProfile?.college === 'None of the Above' &&
        groups &&
        groups.length > 0 &&
        !selectedGroupId
      ) {
        setSelectedGroupId(groups[0].id);
        setIsCollegeFeed(false); // Switch to groups view
      }
    } catch (error) {
      console.error('Error fetching user groups:', error);
    }
  };
  // useEffect((()=>{
  //   setTimeout(async() => {
  //     if(thoughts.length===0){
  //       console.log("reloading the app",thoughts.length)
  //       await Updates.reloadAsync();
  //     }
  //   }, 10000);
  // }),[thoughts])
  useEffect(() => {
    if (userProfile) {
      fetchThoughts();
    } else if (user?.id) {
      checkCollege();
    }

    if (user?.id) {
      fetchUserGroups();
    }
  }, [isCollegeFeed, selectedGroupId, userProfile, user?.id]);

  useEffect(() => {
    const fetchPoints = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('points')
          .eq('id', user.id)
          .single();
        if (profile && typeof profile.points === 'number') {
          setUserPoints(profile.points);
        }
      }
    };
    fetchPoints();
  }, []);

  useEffect(() => {
    checkFriendStatus();
  }, []);

  // Fade in troubleshooting hint if loading lasts more than 3s
  useEffect(() => {
    if (loading) {
      hintOpacity.setValue(0);
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
      hintTimerRef.current = setTimeout(() => {
        Animated.timing(hintOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }).start();
      }, 3000);
    } else {
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
      hintOpacity.setValue(0);
    }
    return () => {
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    };
  }, [loading, hintOpacity]);

  const checkFriendStatus = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.id) {
        const { data: friendIds } = await supabase
          .from('friend_requests')
          .select('sender_id, receiver_id')
          .eq('status', 'accepted')
          .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);

        setHasFriends((friendIds?.length || 0) > 0);
      }
    } catch (error) {
      console.error('Error checking friend status:', error);
    }
  };

  const formatStory = (story: StoryWithUser): FormattedStory => {
    // Use cloned voice user's info if voice was cloned, otherwise use original poster
    const displayUser = story.cloned_voice_user || story.user;
    
    return {
      id: story.id,
      title: story.title,
      description: story.description || undefined,
      transcription: story.transcription || undefined,
      audioUrl: story.audio_url,
      duration: story.duration,
      createdAt: story.created_at,
      createdAtMs: new Date(story.created_at).getTime(),
      category: story.category as Category,
      isPrivate: story.is_private || false,
      isFriendsOnly: story.is_friends_only || false,
      isGroupStory: story.is_group_story || false,
      reactionCount: story.reaction_count || 0,
      likeCount: story.like_count || 0,
      isLiked: false,
      creatorId: story.user_id, // Always use the actual creator's ID for ownership checks
      user: {
        id: displayUser.id,
        name: displayUser.full_name || displayUser.username,
        username: displayUser.username,
        profileImage: displayUser.avatar_url || 'https://via.placeholder.com/150',
        college: displayUser.college,
        friend_count: displayUser.friend_count || 0,
        friend_request_count: displayUser.friend_request_count || 0,
        points: displayUser.points || 0,
      },
      group: story.group_stories?.[0]?.group || null,
    };
  };

  const sortStories = (isHot: boolean) => {
    console.log('Sorting stories, isHot:', isHot); // Debug log
    setThoughts((prevThoughts) => {
      if (prevThoughts.length <= 1) {
        console.log('Less than 2 stories, no sorting needed');
        return prevThoughts;
      }

      console.log('Stories before sort:', prevThoughts.length); // Debug log

      const stories = [...prevThoughts];
      let sortedStories;

      if (isHot) {
        const nowMs = Date.now();
        sortedStories = stories.sort((a, b) => {
          // Calculate hot score based on reactions and time
          const minutesA = Math.max(0, (nowMs - a.createdAtMs) / 60000);
          const minutesB = Math.max(0, (nowMs - b.createdAtMs) / 60000);

          // Recent posts get a boost
          const boostA = minutesA < 10 ? 5 : 0;
          const boostB = minutesB < 10 ? 5 : 0;

          // Hot score formula: (reactions + boost) / time_decay
          const scoreA =
            (a.reactionCount + boostA) / Math.pow(minutesA + 1, 1.5);
          const scoreB =
            (b.reactionCount + boostB) / Math.pow(minutesB + 1, 1.5);

          // Sort by score, fallback to creation time if scores are equal
          return scoreB - scoreA || b.createdAtMs - a.createdAtMs;
        });
      } else {
        // Simple chronological sort for "New"
        sortedStories = stories.sort((a, b) => b.createdAtMs - a.createdAtMs);
      }

      console.log('Stories after sort:', sortedStories.length); // Debug log
      return sortedStories;
    });
  };
  useFocusEffect(
    useCallback(() => {
      // Only refresh if we don't already have data; otherwise keep scroll
      if (!thoughts || thoughts.length === 0) {
        fetchThoughts().then(() => {
          if (scrollRef.current && savedOffsetRef.current > 0) {
            try {
              scrollRef.current.scrollToOffset({
                offset: savedOffsetRef.current,
                animated: false,
              });
            } catch (e) {}
          }
        });
      }
    }, [thoughts?.length])
  );
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      console.log('APp state :', nextAppState);
      if (nextAppState === 'active') {
        // App came to foreground, refresh data
        fetchThoughts();
      }
    };

    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange
    );
    return () => subscription?.remove();
  }, []);
  const fetchThoughts = async () => {
    console.log('fetching thoughts :', user);
    console.log('fetch thoughts 1');
    if (!user?.id) {
      setThoughts([]);
      setLoading(false);
      return;
    }
    console.log('fetch thoughts 2');
    setLoading(true);
    try {
      console.log('fetch thoughts 3');
      let query = supabase
        .from('stories')
        .select(
          `
        id,
        title,
        description,
        audio_url,
        duration,
        category,
        user_id,
        reaction_count,
        like_count,
        is_private,
        is_friends_only,
        is_group_story,
        transcription,
        created_at,
        updated_at,
        is_voice_cloned,
        cloned_voice_user_id,
        user:profiles!user_id(*),
        cloned_voice_user:profiles!cloned_voice_user_id(*),
        group_stories (
          group:groups (
            id,
            name,
            member_count:group_members(count)
          )
        )
      `
        )
        .order('created_at', { ascending: false });
      console.log('fetch thoughts 4');
      if (selectedGroupId) {
        console.log('fetch thoughts 5');
        // For group feed, we need to get stories that are specifically posted to this group
        // First get story IDs from group_stories table for this group
        const { data: groupStoryIds, error: groupError } = await supabase
          .from('group_stories')
          .select('story_id')
          .eq('group_id', selectedGroupId);
        console.log('Group error :', groupError, 'Group data :', groupStoryIds);
        if (groupError) throw groupError;

        const storyIds = groupStoryIds?.map((gs) => gs.story_id) || [];

        if (storyIds.length === 0) {
          setThoughts([]);
          setLoading(false);
          return;
        }

        // Now get the stories for these IDs
        query = query.eq('is_group_story', true).in('id', storyIds);
      } else if (isCollegeFeed) {
        console.log('fetch thoughts 6 - groups only mode');
        // In groups-only mode, don't show any stories in college feed
        // Return early with empty array
        setThoughts([]);
        setLoading(false);
        return;
      } else {
        // In friends feed, show:
        // 1. Your own stories that are friends-only
        // 2. Friends' stories that are friends-only
        console.log('fetch thoughts 9');
        const { data: friendIds, error: friendError } = await supabase
          .from('friend_requests')
          .select('sender_id, receiver_id')
          .eq('status', 'accepted')
          .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);

        console.log('Friend requests:', friendIds);
        console.log('Friend requests error:', friendError);

        const friendUserIds =
          friendIds?.reduce((acc: string[], fr) => {
            if (fr.sender_id === user.id) {
              acc.push(fr.receiver_id);
            } else if (fr.receiver_id === user.id) {
              acc.push(fr.sender_id);
            }
            return acc;
          }, []) || [];

        // Add the user's own ID to show their own friends-only stories
        friendUserIds.push(user.id);

        console.log('Friend user IDs:', friendUserIds);

        query = query
          .eq('is_friends_only', true)
          .eq('is_group_story', false)
          .in('user_id', friendUserIds);
      }
      let query1 = supabase.from('stories').select('id, title').limit(5);
      const { data: data1, error: error1 } = await query1;
      console.log('Simple query:', data1, error1);
      console.log('fetch thoughts 10', query);

      const { data, error } = await query;
      console.log('query data & error :', data, error);
      console.log('fetch thoughts 11');
      if (error) {
        console.error('Error fetching stories:', error);
        return;
      }

      console.log('Fetched stories:', data?.length);

      // Filter out null stories and ensure all required fields exist
      const validStories = (data?.filter((story) => {
        if (!story || !story.id || !story.user) return false;

        // Handle case where user might be an array
        if (Array.isArray(story.user)) {
          return story.user[0] && (story.user[0] as any).id;
        }

        return (story.user as any).id;
      }) || []) as unknown as StoryWithUser[];

      console.log('Valid stories after filtering:', validStories.length);

      // NEW: Fetch reactions for all stories in a single query
      const storyIds = validStories.map((story) => story.id);
      let allReactionCounts: Record<string, EmojiReactionCount[]> = {};
      let userReactions: Record<string, EmojiReaction | null> = {};

      if (storyIds.length > 0) {
        // Fetch reaction counts for all stories
        const { data: countsData, error: countsError } = await supabase
          .from('emoji_reaction_counts')
          .select('*')
          .in('story_id', storyIds);

        if (!countsError && countsData) {
          // Group counts by story_id
          allReactionCounts = countsData.reduce((acc, count) => {
            if (!acc[count.story_id]) {
              acc[count.story_id] = [];
            }
            acc[count.story_id].push(count);
            return acc;
          }, {} as Record<string, EmojiReactionCount[]>);
        }

        // Fetch user's reactions for all stories
        const { data: userReactionsData, error: userReactionsError } =
          await supabase
            .from('emoji_reactions')
            .select('*')
            .eq('user_id', user.id)
            .in('story_id', storyIds);

        if (!userReactionsError && userReactionsData) {
          // Map user reactions by story_id
          userReactionsData.forEach((reaction) => {
            userReactions[reaction.story_id] = reaction;
          });
        }
      }

      // Convert the data to match FormattedStory format with reactions
      const formattedStories: FormattedStory[] = validStories.map((story) => ({
        ...formatStory(story),
        reactionCounts: allReactionCounts[story.id] || [],
        userReaction: userReactions[story.id] || null,
      }));

      setThoughts(formattedStories);
    } catch (error) {
      setLoading(false);
      console.log('Error in fetchStories:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
      // After load via manual refresh, also restore position
      if (scrollRef.current && savedOffsetRef.current > 0) {
        try {
          scrollRef.current.scrollToOffset({
            offset: savedOffsetRef.current,
            animated: false,
          });
        } catch (e) {}
      }
    }
  };
  const handleReactionInstant = async (
    position: number,
    story: AudioStory,
    emojiType: EmojiType
  ) => {
    try {
      if (!userProfile || !userProfile.id) {
        console.log('⚠️ No userProfile available');
      }
      mixpanel.track('Emoji reaction added');
      const storyId = story.id;
      let reactionType = 'added';
      let updatedReaction: any = {
        uid: uuidv4(),
        story_id: storyId,
        user_id: userProfile?.id || user?.id,
        emoji_type: emojiType,
        created_at: new Date().toISOString(),
      };
      // Capture the reaction we may need to delete BEFORE state update
      let existingReaction;

      setThoughts((prev) => {
        const target = prev[position];
        if (!target || target.id !== storyId) return prev;

        let updatedCounts = [...(target.reactionCounts || [])];
        const currentReaction = target.userReaction;

        if (!currentReaction) {
          // Case 1: First time reacting
          const existingCount = updatedCounts.find(
            (c) => c.emoji_type === emojiType
          );
          if (existingCount) {
            existingCount.count += 1;
          } else {
            updatedCounts.push({
              story_id: storyId,
              emoji_type: emojiType,
              count: 1,
            });
          }
        } else if (currentReaction.emoji_type === emojiType) {
          // Case 2: Remove same emoji
          existingReaction = thoughts[position]?.userReaction;
          reactionType = 'remove';
          updatedCounts = updatedCounts
            .map((c) =>
              c.emoji_type === emojiType ? { ...c, count: c.count - 1 } : c
            )
            .filter((c) => c.count > 0);
          updatedReaction = null;
        } else {
          // Case 3: Switch emoji
          reactionType = 'changed';
          updatedCounts = updatedCounts
            .map((c) =>
              c.emoji_type === currentReaction.emoji_type
                ? { ...c, count: c.count - 1 }
                : c
            )
            .filter((c) => c.count > 0);

          const newEmojiCount = updatedCounts.find(
            (c) => c.emoji_type === emojiType
          );
          if (newEmojiCount) {
            newEmojiCount.count += 1;
          } else {
            updatedCounts.push({
              story_id: storyId,
              emoji_type: emojiType,
              count: 1,
            });
          }
        }

        const updated = [...prev];
        updated[position] = {
          ...target,
          userReaction: updatedReaction,
          reactionCounts: updatedCounts,
        };
        return updated;
      });

      // Fire DB updates **after state update**
      if (reactionType === 'added') {
        const { error, status } = await supabase
          .from('emoji_reactions')
          .insert(updatedReaction);
        console.log(
          'added reaction →',
          error,
          status,
          updatedReaction,
          userProfile,
          'type of userprofile :',
          typeof userProfile
        );

        // Track emoji reaction event with PostHog
        if (!error && userProfile) {
          // posthog.capture('emoji_reaction_added', {
          //   user: {
          //     id: userProfile.id,
          //     username: userProfile.username,
          //   },
          //   story_id: storyId,
          //   emoji_type: emojiType,
          //   timeStamp: new Date().toISOString(),
          // });
        }
      }
      if (reactionType === 'changed' && story?.userReaction) {
        const { error, status } = await supabase
          .from('emoji_reactions')
          .delete()
          .eq('uid', story.userReaction.uid);
        console.log(
          'removed reaction →',
          error,
          status,
          story.userReaction.uid
        );
        const { error: error1, status: status1 } = await supabase
          .from('emoji_reactions')
          .insert(updatedReaction);
        console.log('added reaction →', error1, status1);

        // Track emoji reaction changed event with PostHog
        if (!error1 && !error && userProfile) {
          // posthog.capture('emoji_reaction_changed', {
          //   user: {
          //     id: userProfile.id,
          //     username: userProfile.username,
          //   },
          //   story_id: storyId,
          //   previous_emoji_type: story.userReaction.emoji_type,
          //   new_emoji_type: emojiType,
          //   timeStamp: new Date().toISOString(),
          // });
        }
      }

      if (reactionType === 'remove' && story?.userReaction) {
        const { error, status } = await supabase
          .from('emoji_reactions')
          .delete()
          .eq('uid', story.userReaction.uid);
        console.log(
          'removed reaction →',
          error,
          status,
          story.userReaction.uid
        );

        // Track emoji reaction removed event with PostHog
        if (!error && userProfile) {
          // posthog.capture('emoji_reaction_removed', {
          //   user: {
          //     id: userProfile.id,
          //     username: userProfile.username,
          //   },
          //   story_id: storyId,
          //   emoji_type: story.userReaction.emoji_type,
          //   timeStamp: new Date().toISOString(),
          // });
        }
      }
    } catch (error) {
      console.error('error Reaction Update:', error);
    }
  };

  const handleReaction = (story: FormattedStory) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    // Find the story in our thoughts array
    const dbStory = thoughts.find((s) => s.id === story.id);
    console.log('Found dbStory:', dbStory ? 'yes' : 'no');

    if (!dbStory) {
      console.warn('Story not found in thoughts array:', story.id);
      // If story not found in thoughts, use the passed story
      setSelectedStory(story);
    } else {
      setSelectedStory(dbStory);
    }

    setIsQuickRecordingModalVisible(true);
  };

  const handleFeedbackReaction = (feedback: any) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    setSelectedStory(feedback);
    setIsQuickRecordingModalVisible(true);
  };

  const handleSaveRecording = () => {
    fetchThoughts();
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchThoughts();
  };

  const handleStoryPlayed = (story: FormattedStory) => {
    // setCurrentlyPlayingId(story.id); // This line is removed as per the edit hint
  };

  const handleRequestSchool = async () => {
    const notionUrl =
      'https://pastoral-supply-662.notion.site/1ed2cec59ddf804c9172d6b994d91d0c?pvs=105';
    try {
      await Linking.openURL(notionUrl);
    } catch (error) {
      console.error('Error opening URL:', error);
    }
  };

  const handleShareGroupInvite = async (group: Group) => {
    try {
      const message = `join my group "${group.name}" on hear me out Copy! use invite code: ${group.invite_code}

https://apps.apple.com/us/app/hear-me-out-social-audio/id6745344571`;

      await Share.share({
        message,
      });
      mixpanel.track('Group shared');
    } catch (error) {
      console.error('Error sharing group invite:', error);
      Alert.alert('Error', 'Failed to share group invite');
    }
  };

  const handleJoinGroupSuccess = async (groupId: string) => {
    setSelectedGroupId(groupId);
    setIsCollegeFeed(false);
    await fetchUserGroups();
    await fetchThoughts();
    // Force refresh after a short delay
    setTimeout(() => {
      fetchThoughts();
    }, 100);
  };

  const handleShareGroup = () => {
    if (selectedGroupId && userGroups.length > 0) {
      const selectedGroup = userGroups.find((g) => g.id === selectedGroupId);
      if (selectedGroup) {
        handleShareGroupInvite(selectedGroup);
      }
    }
    setIsFabExpanded(false);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      // Small delay to ensure sign out completes
      await new Promise((resolve) => setTimeout(resolve, 100));
      // Force navigation to sign up page
      router.replace('/(auth)/sign-up');
    } catch (error) {
      console.error('Error signing out:', error);
      Alert.alert('Error', 'Failed to sign out. Please try again.');
    }
  };

  const handleLeaveGroup = () => {
    if (selectedGroupId && userGroups.length > 0) {
      const selectedGroup = userGroups.find((g) => g.id === selectedGroupId);
      if (selectedGroup) {
        Alert.alert(
          'Leave Group',
          `Are you sure you want to leave "${selectedGroup.name}"?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Leave',
              style: 'destructive',
              onPress: async () => {
                try {
                  const {
                    data: { user },
                  } = await supabase.auth.getUser();
                  if (!user?.id) return;

                  await supabase
                    .from('group_members')
                    .delete()
                    .eq('user_id', user.id)
                    .eq('group_id', selectedGroupId);

                  // Reset to college feed
                  setSelectedGroupId(null);
                  setIsCollegeFeed(true);
                  await fetchThoughts();
                  await fetchUserGroups();
                } catch (error) {
                  console.error('Error leaving group:', error);
                  Alert.alert(
                    'Error',
                    'Failed to leave group. Please try again.'
                  );
                }
              },
            },
          ]
        );
      }
    }
    setIsFabExpanded(false);
  };

  const handleViewMembers = async () => {
    if (selectedGroupId) {
      try {
        // Fetch group members
        const { data: members, error } = await supabase
          .from('group_members')
          .select(
            `
            user_id,
            profiles!inner (
              id,
              username,
              avatar_url,
              college
            )
          `
          )
          .eq('group_id', selectedGroupId);

        if (error) throw error;

        setGroupMembers(members || []);
        setShowViewMembersModal(true);
      } catch (error) {
        console.error('Error fetching group members:', error);
        Alert.alert('Error', 'Failed to load group members');
      }
    }
    setIsFabExpanded(false);
  };

  const renderEmptyState = () => {
    // Check if user needs to record voice clone first
    if (!userHasVoiceClone) {
      return (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyMessageBox}>
            {/* Card Image Container */}
            <View style={styles.cardImageContainer}>
              <Image
                source={require('@/assets/images/cards.png')}
                style={styles.cardImage}
                resizeMode="contain"
              />
            </View>

            {/* Text and Button Container */}
            <View style={styles.textButtonContainer}>
              <Typography variant="body" style={styles.groupEmptyText}>
                🎙️ record your voice first to start using the app
              </Typography>

              <View style={styles.inviteButtonContainer}>
                <LinearGradient
                  colors={[
                    '#FF0000',
                    '#FFA500',
                    '#FFFF00',
                    '#00FF00',
                    '#00FFFF',
                    '#0000FF',
                    '#FF00FF',
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.gradientBorder}
                >
                  <TouchableOpacity
                    style={styles.inviteButton}
                    onPress={() => router.push('/(tabs)/profile')}
                  >
                    <Typography variant="h2" style={styles.inviteText}>
                      go to profile
                    </Typography>
                  </TouchableOpacity>
                </LinearGradient>
              </View>
            </View>
          </View>
        </View>
      );
    }

    if (loading) {
      return (
        <View style={styles.emptyContainer}>
          <SpinningHeadphone size={32} />
          <Animated.View
            style={{
              opacity: hintOpacity,
              marginTop: 12,
              paddingHorizontal: 24,
            }}
          >
            <Typography
              variant="body"
              style={{ color: '#8A8E8F', textAlign: 'center' }}
            >
              Having Issues? 🤔
            </Typography>
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={async () => {
                await Updates.reloadAsync();
              }}
              activeOpacity={0.85}
            >
              <Typography variant="body" style={styles.refreshText}>
                refresh
              </Typography>
            </TouchableOpacity>
          </Animated.View>
        </View>
      );
    }

    // Check if we're in a group feed and if the group has only one member
    if (selectedGroupId && !isCollegeFeed) {
      const selectedGroup = userGroups.find((g) => g.id === selectedGroupId);

      if (
        selectedGroup &&
        Array.isArray(selectedGroup.member_count) &&
        selectedGroup.member_count[0]?.count === 1
      ) {
        return (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyMessageBox}>
              {/* Card Image Container */}
              <View style={styles.cardImageContainer}>
                <Image
                  source={require('@/assets/images/cards.png')}
                  style={styles.cardImage}
                  resizeMode="contain"
                />
              </View>

              {/* Text and Button Container */}
              <View style={styles.textButtonContainer}>
                <Typography variant="body" style={styles.groupEmptyText}>
                  Uh oh, there are no other people here 😟
                </Typography>

                <View style={styles.inviteButtonContainer}>
                  <LinearGradient
                    colors={[
                      '#FF0000',
                      '#FFA500',
                      '#FFFF00',
                      '#00FF00',
                      '#00FFFF',
                      '#0000FF',
                      '#FF00FF',
                    ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.gradientBorder}
                  >
                    <TouchableOpacity
                      style={styles.inviteButton}
                      onPress={() => handleShareGroupInvite(selectedGroup)}
                    >
                      <Typography variant="h2" style={styles.inviteText}>
                        share invite
                      </Typography>
                    </TouchableOpacity>
                  </LinearGradient>
                </View>
              </View>
            </View>
          </View>
        );
      }

      // If there are multiple people but no posts
      if (
        selectedGroup &&
        Array.isArray(selectedGroup.member_count) &&
        selectedGroup.member_count[0]?.count > 1
      ) {
        return (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyMessageBox}>
              {/* Card Image Container */}
              <View style={styles.cardImageContainer}>
                <Image
                  source={require('@/assets/images/cards.png')}
                  style={styles.cardImage}
                  resizeMode="contain"
                />
              </View>

              {/* Text and Button Container */}
              <View style={styles.textButtonContainer}>
                <Typography variant="body" style={styles.groupEmptyText}>
                  There are no posts yet...
                </Typography>

                <View style={styles.inviteButtonContainer}>
                  <LinearGradient
                    colors={[
                      '#FF0000',
                      '#FFA500',
                      '#FFFF00',
                      '#00FF00',
                      '#00FFFF',
                      '#0000FF',
                      '#FF00FF',
                    ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.gradientBorder}
                  >
                    <TouchableOpacity
                      style={styles.inviteButton}
                      onPress={() => router.push('/record')}
                    >
                      <Typography variant="h2" style={styles.inviteText}>
                        record now
                      </Typography>
                    </TouchableOpacity>
                  </LinearGradient>
                </View>
              </View>
            </View>
          </View>
        );
      }
    }

    // College feed - show groups-only message for all users
    if (isCollegeFeed) {
      return (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyMessageBox}>
            {/* Card Image Container */}
            <View style={styles.cardImageContainer}>
              <Image
                source={require('@/assets/images/cards.png')}
                style={styles.cardImage}
                resizeMode="contain"
              />
            </View>

            {/* Text and Button Container */}
            <View style={styles.textButtonContainer}>
              <Typography variant="body" style={styles.groupEmptyText}>
                create or join a group to get started 🎧
              </Typography>

              <View style={styles.smallButtonContainer}>
                <TouchableOpacity
                  style={styles.createGroupButton}
                  onPress={() => setIsGroupModalVisible(true)}
                >
                  <Typography
                    variant="body"
                    style={[styles.smallButtonText, { color: '#FFFFFF' }]}
                  >
                    create group
                  </Typography>
                </TouchableOpacity>
              </View>

              <View style={styles.smallButtonContainer}>
                <TouchableOpacity
                  style={styles.joinGroupButton}
                  onPress={() => setShowJoinGroupModal(true)}
                >
                  <Typography
                    variant="body"
                    style={[styles.smallButtonText, { color: '#000000' }]}
                  >
                    join group
                  </Typography>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyMessageBox}>
          <Typography variant="h2" style={styles.emptyTitle}>
            no thoughts yet 🎧
          </Typography>
          <Typography
            variant="body"
            color={theme.colors.text.secondary}
            style={styles.emptyText}
          >
            be the first to share a thought!
          </Typography>
            <TouchableOpacity
              style={styles.recordNowButton}
              onPress={() => router.push('/record')}
            >
            <Typography variant="h2" style={styles.recordNowButtonText}>
              record now 🎙️
            </Typography>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const handleHotNewToggle = (newIsHotFeed: boolean) => {
    setIsHotFeed(newIsHotFeed);

    // Force immediate sort
    requestAnimationFrame(() => {
      sortStories(newIsHotFeed);
    });
  };

  const handleToggleFeed = async (
    newIsCollegeFeed: boolean,
    groupId: string | null
  ) => {
    if (!newIsCollegeFeed && !groupId) {
      // Check if user has any friends
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.id) {
        const { data: friendIds } = await supabase
          .from('friend_requests')
          .select('sender_id, receiver_id')
          .eq('status', 'accepted')
          .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);

        const friendCount = friendIds?.length || 0;
        if (friendCount === 0) {
          setIsAddFriendsModalVisible(true);
        }
      }
    }

    setIsCollegeFeed(newIsCollegeFeed);
    setSelectedGroupId(groupId);
  };

  const handleAddFriends = () => {
    setIsAddFriendsModalVisible(true);
  };

  const handleOpenFeedbackModal = () => {
    setIsFeedbackRecordingModalVisible(true);
  };

  const handleSaveFeedback = () => {
    setIsFeedbackRecordingModalVisible(false);
  };

  const handleDeleteStory = useCallback((storyId: string) => {
    // Remove the story from the local state immediately
    setThoughts((prevThoughts) =>
      prevThoughts.filter((story) => story.id !== storyId)
    );
  }, []);
  const renderItem = useCallback(
    ({ item, index }: { item: FormattedStory; index: number }) => {
      if (!item || !item.id) {
        return null;
      }
      return (
        <StoryCard
          key={`story-${item.id}`}
          handleEmojiSelect={handleReactionInstant}
          story={item as unknown as AudioStory}
          position={index}
          onReaction={handleReaction as (story: AudioStory) => void}
          onPlay={handleStoryPlayed as (story: AudioStory) => void}
          onDelete={handleDeleteStory}
          isFocused2={currentVisible.current}
        />
      );
    },
    []
  );
  const viewabilityConfig = {
    itemVisiblePercentThreshold: 80, // play only when 80% visible
  };

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: any }) => {
      if (viewableItems.length > 0) {
        const topItem = viewableItems[0].item; // topmost visible
        currentVisible.current = topItem;
        setVisibleStory(topItem);
      }
    }
  ).current;

  return (
    <>
      <SafeAreaView style={styles.container}>
        {/* Show voice clone requirement message if user hasn't recorded */}
        {!userHasVoiceClone ? (
          <View style={styles.voiceCloneRequiredOverlay}>
            <View style={styles.emptyMessageBox}>
              {/* Card Image Container */}
              <View style={styles.cardImageContainer}>
                <Image
                  source={require('@/assets/images/cards.png')}
                  style={styles.cardImage}
                  resizeMode="contain"
                />
              </View>

              {/* Text and Button Container */}
              <View style={styles.textButtonContainer}>
                <Typography variant="body" style={styles.voiceCloneRequiredSubtitle}>
                  voice cloning is required to use the app
                </Typography>

                <View style={styles.inviteButtonContainer}>
                  <LinearGradient
                    colors={[
                      '#FF0000',
                      '#FFA500',
                      '#FFFF00',
                      '#00FF00',
                      '#00FFFF',
                      '#0000FF',
                      '#FF00FF',
                    ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.gradientBorder}
                  >
                  <TouchableOpacity
                    style={styles.inviteButton}
                    onPress={() => setShowVoiceCloningModal(true)}
                  >
                    <Typography variant="h2" style={styles.inviteText}>
                      🎙️ record voice
                    </Typography>
                  </TouchableOpacity>
                </LinearGradient>
              </View>

            </View>
          </View>
        </View>
      ) : (
          <>
            <View style={styles.header}>
              <View style={styles.headerTop}>
                <View style={styles.headerLeft}>
                  <View style={styles.feedToggleContainer}>
                    <CommunityTitleToggle
                      isCollegeFeed={isCollegeFeed}
                      selectedGroupId={selectedGroupId}
                      groups={userGroups}
                      userCollege={userProfile?.college}
                      onToggle={(newIsCollegeFeed, groupId) => {
                        setIsCollegeFeed(newIsCollegeFeed);
                        setSelectedGroupId(groupId ?? null);
                      }}
                      onCreateGroup={() => setIsGroupModalVisible(true)}
                      onJoinGroup={() => setShowJoinGroupModal(true)}
                    />
                  </View>
                </View>
                <View style={styles.headerRight}>
                  <View style={styles.hotNewToggleContainer}>
                    <HotNewToggle
                      isHotFeed={isHotFeed}
                      onToggle={handleHotNewToggle}
                    />
                  </View>
                </View>
              </View>
            </View>
            <FlatList
          ref={scrollRef}
          data={thoughts}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          onScroll={(e) => {
            savedOffsetRef.current = e.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
          refreshControl={
            <CustomRefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
            />
          }
          ListEmptyComponent={!loading ? renderEmptyState : null}
          viewabilityConfig={viewabilityConfig}
          onViewableItemsChanged={onViewableItemsChanged}
          contentContainerStyle={styles.flatListContent}
            />
            {loading && (thoughts?.length ?? 0) === 0 && (
              <View style={styles.loadingOverlay}>
                <SpinningHeadphone size={32} />
                <Animated.View
                  style={{
                    opacity: hintOpacity,
                    marginTop: 12,
                    paddingHorizontal: 24,
                  }}
                >
                  <Typography
                    variant="body"
                    style={{ color: '#8A8E8F', textAlign: 'center' }}
                  >
                    Having Issues? 🤔
                  </Typography>
                  <TouchableOpacity
                    style={styles.refreshButton}
                    onPress={async () => {
                      await Updates.reloadAsync();
                    }}
                    activeOpacity={0.85}
                  >
                    <Typography variant="body" style={styles.refreshText}>
                      refresh
                    </Typography>
                  </TouchableOpacity>
                </Animated.View>
              </View>
            )}

            {/* Record Button FAB - Bottom Left - Only show in group feed */}
            {selectedGroupId && !isCollegeFeed && (
              <View style={styles.recordFabContainer}>
                <TouchableOpacity
                  style={styles.fabButton}
                  onPress={() => router.push('/record')}
                >
                  <Mic size={24} color="#000000" />
                </TouchableOpacity>
              </View>
            )}

            {/* Group Actions FAB */}
            {selectedGroupId && !isCollegeFeed && (
          <View style={styles.fabContainer}>
            <TouchableOpacity
              style={styles.fabButton}
              onPress={() => setIsFabExpanded(!isFabExpanded)}
            >
              <MoreVertical size={24} color="#000000" />
            </TouchableOpacity>

            {isFabExpanded && (
              <View style={styles.fabOptions}>
                <TouchableOpacity
                  style={styles.fabOption}
                  onPress={handleViewMembers}
                >
                  <Users size={20} color="#333A3C" />
                  <Text style={styles.fabOptionText}>View Members</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.fabOption}
                  onPress={handleShareGroup}
                >
                  <ShareIcon size={20} color="#333A3C" />
                  <Text style={styles.fabOptionText}>Share Group</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.fabOption}
                  onPress={handleLeaveGroup}
                >
                  <LogOut size={20} color="#FF3B30" />
                  <Text style={styles.fabOptionText}>Leave Group</Text>
                </TouchableOpacity>
              </View>
              )}
            </View>
          )}
          </>
        )}
      </SafeAreaView>

      {isQuickRecordingModalVisible && selectedStory && (
        <QuickRecordingModal
          storyId={selectedStory.id}
          isVisible={isQuickRecordingModalVisible}
          onClose={() => setIsQuickRecordingModalVisible(false)}
          onSuccess={handleSaveRecording}
          username={selectedStory.user.username}
        />
      )}

      {/* Removed sticky microphone button; use the Mic tab to navigate to record screen */}

      <AddFriendsModal
        visible={isAddFriendsModalVisible}
        onClose={() => setIsAddFriendsModalVisible(false)}
      />
      <GroupModal
        isVisible={isGroupModalVisible}
        onClose={() => setIsGroupModalVisible(false)}
        onSuccess={async (groupId: string) => {
          try {
            // Automatically select the newly created group first
            setSelectedGroupId(groupId);
            setIsCollegeFeed(false); // Switch to groups view
            console.log(
              'Selected new group:',
              groupId,
              'isCollegeFeed set to false'
            );

            // Then fetch the updated groups and thoughts
            await fetchUserGroups();
            await fetchThoughts();

            // Force a refresh of the feed to show the new group's content
            setTimeout(() => {
              fetchThoughts();
            }, 100);
          } catch (error) {
            console.error('Error in group creation success handler:', error);
          }
        }}
      />

      <JoinGroupModal
        isVisible={showJoinGroupModal}
        onClose={() => setShowJoinGroupModal(false)}
        onSuccess={handleJoinGroupSuccess}
      />

      <RecordingModal
        isVisible={isFeedbackRecordingModalVisible}
        onClose={() => setIsFeedbackRecordingModalVisible(false)}
        onSave={handleSaveFeedback}
        mode="feedback"
      />
      <ModalC
        onRequestClose={() => {}}
        visible={completeProfileModal}
        width={'80%'}
      >
        <ScrollView contentContainerStyle={{ maxHeight: '80%' }}>
          <OnBoarding
            onRequestClose={() => {
              setCompleteProfileModal(false);
            }}
            userId={userProfile?.id as string}
          />
        </ScrollView>
      </ModalC>

      {/* Voice Cloning Modal */}
      <VoiceCloningModal
        visible={showVoiceCloningModal}
        onClose={() => setShowVoiceCloningModal(false)}
        userId={user?.id || ''}
        username={userProfile?.username || ''}
        onSuccess={async (voiceId) => {
          console.log('Voice clone created on home screen:', voiceId);
          setUserHasVoiceClone(true);
          setShowVoiceCloningModal(false);
          
          // Refresh user profile to get updated voice clone status
          if (user) {
            const { data: updatedProfile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', user.id)
              .single();
            if (updatedProfile) {
              setUserProfile(updatedProfile);
            }
          }
        }}
      />

      {/* View Members Modal */}
      <Modal
        visible={showViewMembersModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowViewMembersModal(false)}
      >
        <View style={styles.modalOverlayNoBackground}>
          <View style={styles.viewMembersModalContent}>
            <View style={styles.modalHeader}>
              <Typography variant="h2" style={styles.modalTitle}>
                Group Members
              </Typography>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowViewMembersModal(false)}
              >
                <X size={24} color="#000" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.membersList}>
              {groupMembers.map((member) => (
                <View key={member.user_id} style={styles.memberItem}>
                  <Image
                    source={{
                      uri:
                        member.profiles.avatar_url ||
                        'https://dqthkfmvvedzyowhyewd.supabase.co/storage/v1/object/public/avatars/default.png',
                    }}
                    style={styles.memberAvatar}
                  />
                  <View style={styles.memberInfo}>
                    <Typography variant="body" style={styles.memberName}>
                      {member.profiles.username}
                    </Typography>
                    <Typography variant="body" style={styles.memberCollege}>
                      {member.profiles.college}
                    </Typography>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  feedToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  groupsList: {
    marginTop: 12,
    maxHeight: 40,
  },
  groupsListContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  groupChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  groupChipSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  groupChipText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  groupChipTextSelected: {
    color: 'white',
  },
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    position: 'relative',
  },
  header: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    padding: 0,
    paddingTop: 25,
    height: 80,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    zIndex: 1,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 25,
    marginBottom: 0,
    marginTop: 0,
  },
  headerLeft: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerRight: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  hotNewToggleContainer: {
    width: 140,
    height: 36,
    borderRadius: 18,
    borderWidth: 0,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 0,
  },
  headerSide: {
    width: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 0,
    gap: 4,
  },
  streakText: {
    fontFamily: 'Nunito-Regular',
    fontSize: 14,
    fontWeight: '700',
    color: '#000608',
    marginRight: 2,
  },
  streakIcon: {
    fontSize: 16,
    marginLeft: 2,
  },
  customToggle: {
    width: 64,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: '#F7C53B',
    backgroundColor: '#FAF6E8',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 0,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  customToggleOn: {
    backgroundColor: '#FAF6E8',
    borderColor: '#F7C53B',
  },
  toggleTrack: {
    width: 58,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    padding: 2,
  },
  toggleTrackOn: {
    justifyContent: 'flex-end',
  },
  toggleThumb: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#C6F4FF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  toggleThumbOn: {
    backgroundColor: '#fff',
    borderColor: '#C6F4FF',
  },
  feedTitle: {
    fontFamily: 'Nunito',
    fontSize: 24,
    fontWeight: '700',
    color: '#000405',
    lineHeight: 33,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  list: {
    flex: 1,
    position: 'relative',
  },
  listContent: {
    paddingTop: Platform.OS === 'ios' ? 20 : 16,
    paddingHorizontal: 0,
    gap: 8,
    paddingBottom: 32,
  },
  flatListContent: {
    paddingTop: 20,
    paddingBottom: 32,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyList: {
    flex: 1,
  },
  emptyContainer: {
    flex: 0.7,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    marginTop: 40,
  },
  emptyMessageBox: {
    alignItems: 'center',
    padding: 20,
    gap: 20,
  },
  emptyTitle: {
    fontSize: 28,
    marginBottom: 16,
    textAlign: 'center',
    color: '#000405',
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 18,
    textAlign: 'center',
    color: '#666',
    fontWeight: '600',
    marginBottom: 24,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalOverlayNoBackground: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },

  addFriendsButton: {
    position: 'absolute',
    bottom: 120,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 24,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 1000,
  },
  addFriendsText: {
    fontSize: 16,
    color: '#000',
    fontFamily: 'Nunito',
    fontWeight: '700',
  },
  requestButton: {
    marginTop: 16,
    backgroundColor: '#FFEFB4',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  requestButtonText: {
    fontSize: 16,
    color: '#000',
    fontFamily: 'Nunito',
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  addFriendsButtonInCard: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  addFriendsButtonText: {
    color: '#000',
    fontSize: 20,
    fontWeight: '700',
  },
  recordNowButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginTop: 16,
  },
  recordNowButtonText: {
    color: '#000',
    fontSize: 20,
    fontWeight: '700',
  },
  stickyMicrophoneButton: {
    position: 'absolute',
    bottom: 120,
    right: 20,
    backgroundColor: '#FFFFFF',
    width: 80,
    height: 70,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 4,
    borderWidth: 2,
    borderColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 6,
    zIndex: 9999,
  },
  refreshButton: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingHorizontal: 24,
    gap: 8,
    minWidth: 220,
    height: 56,
    backgroundColor: '#1D1D1D',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 32,
    marginTop: 16,
  },
  refreshText: {
    fontFamily: 'Nunito-Bold',
    fontStyle: 'normal',
    fontWeight: '700',
    fontSize: 18,
    lineHeight: 22,
    color: '#FFFFFF',
    textAlign: 'center',
    flex: 1,
    marginRight: 8,
    textTransform: 'lowercase',
  },
  microphoneIconContainer: {
    backgroundColor: '#FEFEFE',
    borderRadius: 18,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardImageContainer: {
    width: 240,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  textButtonContainer: {
    width: 254,
    alignItems: 'center',
    gap: 20,
  },
  groupEmptyText: {
    width: 254,
    fontFamily: 'Nunito',
    fontStyle: 'normal',
    fontWeight: '500',
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
    color: '#626262',
  },
  shareInviteButton: {
    width: 174,
    height: 48,
    padding: 2,
    borderRadius: 47,
    overflow: 'hidden',
  },
  shareInviteButtonInner: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 2,
    width: 170,
    height: 44,
    backgroundColor: '#000405',
    borderRadius: 35,
    gap: 10,
  },
  shareInviteButtonText: {
    width: 108,
    height: 27,
    fontFamily: 'Nunito',
    fontStyle: 'normal',
    fontWeight: '700',
    fontSize: 20,
    lineHeight: 27,
    color: '#FFFFFF',
  },
  shareIcon: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareIconVector: {
    width: 20,
    height: 20,
    borderLeftWidth: 1.67,
    borderBottomWidth: 1.67,
    borderColor: '#FFFFFF',
    transform: [{ rotate: '45deg' }],
  },
  inviteButtonContainer: {
    width: 244,
    height: 56,
    marginBottom: 18,
  },
  gradientBorder: {
    width: '100%',
    height: '100%',
    borderRadius: 26,
    padding: 2,
  },
  inviteButton: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1D1D1D',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inviteText: {
    fontFamily: 'Nunito',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 27,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  recordFabContainer: {
    position: 'absolute',
    bottom: 120,
    left: 16,
    zIndex: 1000,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 120,
    right: 16,
    zIndex: 1000,
  },
  fabButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  fabOptions: {
    position: 'absolute',
    bottom: 60,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  fabOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    minWidth: 140,
    backgroundColor: '#FAFAFA',
  },
  fabOptionText: {
    marginLeft: 12,
    fontSize: 16,
    fontWeight: '600',
    color: '#333A3C',
    fontFamily: 'Nunito',
  },
  smallButtonContainer: {
    width: 180,
    height: 40,
    marginBottom: 0,
  },
  createGroupButton: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1D1D1D',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333333',
  },
  joinGroupButton: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F6F6F6',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  smallButtonText: {
    fontFamily: 'Nunito',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
    textAlign: 'center',
  },
  viewMembersModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    width: '90%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  membersList: {
    maxHeight: 400,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginVertical: 4,
    backgroundColor: '#F8F8F8',
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 16,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  memberCollege: {
    fontSize: 14,
    color: '#8A8E8F',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    fontFamily: 'Nunito-Bold',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E4E4E4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  voiceCloneRequiredOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  voiceCloneRequiredTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000000',
    fontFamily: 'Nunito-Bold',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 36,
  },
  voiceCloneRequiredSubtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#626262',
    fontFamily: 'Nunito-SemiBold',
    textAlign: 'center',
    lineHeight: 24,
  },
});
