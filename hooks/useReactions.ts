import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { posthog } from '@/posthog';

type EmojiType = 'heart' | 'fire' | 'laugh' | 'wow' | 'sad';

interface EmojiReaction {
  id: string;
  story_id: string;
  user_id: string;
  emoji_type: EmojiType;
  created_at: string;
}

interface EmojiReactionCount {
  emoji_type: EmojiType;
  count: number;
}

// Global subscription manager to prevent multiple subscriptions to the same channel
const subscriptionManager = new Map<
  string,
  {
    channel: any;
    subscribers: Set<() => void>;
    refCount: number;
  }
>();

// Cache for reaction data
const reactionCache = new Map<
  string,
  {
    counts: EmojiReactionCount[];
    userReaction: EmojiReaction | null;
    timestamp: number;
  }
>();

// Cache timeout in milliseconds (5 seconds)
const CACHE_TIMEOUT = 5000;

// export function useReactions(storyId: string) {
//   const [reactionCounts, setReactionCounts] = useState<EmojiReactionCount[]>([]);
//   const [userReaction, setUserReaction] = useState<EmojiReaction | null>(null);
//   const [loading, setLoading] = useState(true);

//   // Check cache first
//   useEffect(() => {
//     const cachedData = reactionCache.get(storyId);
//     if (cachedData && (Date.now() - cachedData.timestamp) < CACHE_TIMEOUT) {
//       setReactionCounts(cachedData.counts);
//       setUserReaction(cachedData.userReaction);
//       setLoading(false);
//     }
//   }, [storyId]);

//   useEffect(() => {
//     let isSubscribed = true;
//     const channelName = `emoji_reactions_${storyId}`;

//     let manager = subscriptionManager.get(channelName);
//     if (!manager) {
//       manager = {
//         channel: null,
//         subscribers: new Set(),
//         refCount: 0
//       };
//       subscriptionManager.set(channelName, manager);
//     }

//     const setupSubscription = async () => {
//       try {
//         // Only fetch if we didn't get data from cache
//         if (loading) {
//         await fetchReactions();
//         }

//         if (!isSubscribed) return;

//         if (!manager!.channel) {
//           manager!.channel = supabase
//           .channel(channelName)
//           .on(
//             'postgres_changes',
//             {
//               event: '*',
//               schema: 'public',
//               table: 'emoji_reactions',
//               filter: `story_id=eq.${storyId}`,
//             },
//             () => {
//                 manager!.subscribers.forEach(callback => callback());
//             }
//           )
//           .on(
//             'postgres_changes',
//             {
//               event: '*',
//               schema: 'public',
//               table: 'emoji_reaction_counts',
//               filter: `story_id=eq.${storyId}`,
//             },
//             () => {
//                 manager!.subscribers.forEach(callback => callback());
//             }
//           )
//           .subscribe();
//         }

//         manager!.subscribers.add(fetchReactions);
//         manager!.refCount++;
//       } catch (error) {
//         console.error('Error setting up reactions subscription:', error);
//         setLoading(false);
//       }
//     };

//     setupSubscription();

//     return () => {
//       isSubscribed = false;

//       if (manager) {
//         manager.subscribers.delete(fetchReactions);
//         manager.refCount--;

//         if (manager.refCount === 0) {
//           if (manager.channel) {
//             manager.channel.unsubscribe();
//           }
//           subscriptionManager.delete(channelName);
//         }
//       }
//     };
//   }, [storyId]);

//   const fetchReactions = async () => {
//     try {
//       const { data: { session } } = await supabase.auth.getSession();
//       const userId = session?.user?.id;

//       // Fetch both counts and user reaction in parallel
//       const [countsResponse, userReactionResponse] = await Promise.all([
//         supabase
//         .from('emoji_reaction_counts')
//         .select('emoji_type, count')
//           .eq('story_id', storyId),
//         userId ? supabase
//           .from('emoji_reactions')
//           .select('*')
//           .eq('story_id', storyId)
//           .eq('user_id', userId)
//           .single() : Promise.resolve({ data: null, error: null })
//       ]);

//       if (countsResponse.error) throw countsResponse.error;
//       const counts = countsResponse.data || [];
//       setReactionCounts(counts);

//       if (userReactionResponse.error && userReactionResponse.error.code !== 'PGRST116') {
//         throw userReactionResponse.error;
//       }
//       const userReactionData = userReactionResponse.data || null;
//       setUserReaction(userReactionData);

//       // Update cache
//       reactionCache.set(storyId, {
//         counts,
//         userReaction: userReactionData,
//         timestamp: Date.now()
//       });
//     } catch (error) {
//       console.error('Error fetching emoji reactions:', error);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const addReaction = async (emojiType: EmojiType) => {
//     try {
//       const { data: { session } } = await supabase.auth.getSession();
//       if (!session?.user) return;

//       if (userReaction) {
//         await removeReaction();
//       }

//       const { error: reactionError } = await supabase
//         .from('emoji_reactions')
//         .insert({
//           story_id: storyId,
//           user_id: session.user.id,
//           emoji_type: emojiType,
//         });

//       if (reactionError) throw reactionError;

//       const { error: countError } = await supabase
//         .from('emoji_reaction_counts')
//         .upsert({
//           story_id: storyId,
//           emoji_type: emojiType,
//           count: 1
//         }, {
//           onConflict: 'story_id,emoji_type',
//           ignoreDuplicates: false
//         });

//       if (countError) throw countError;

//       await fetchReactions();
//     } catch (error) {
//       console.error('Error adding emoji reaction:', error);
//     }
//   };

//   const removeReaction = async () => {
//     try {
//       const { data: { session } } = await supabase.auth.getSession();
//       if (!session?.user || !userReaction) return;

//       const { error: reactionError } = await supabase
//         .from('emoji_reactions')
//         .delete()
//         .eq('id', userReaction.id);

//       if (reactionError) throw reactionError;

//       const { error: countError } = await supabase
//         .from('emoji_reaction_counts')
//         .update({
//           count: supabase.from('emoji_reaction_counts')
//             .select('count')
//             .eq('story_id', storyId)
//             .eq('emoji_type', userReaction.emoji_type)
//             .single()
//             .then(result => (result.data?.count || 1) - 1)
//         })
//         .eq('story_id', storyId)
//         .eq('emoji_type', userReaction.emoji_type);

//       if (countError) throw countError;

//       await supabase
//         .from('emoji_reaction_counts')
//         .delete()
//         .eq('story_id', storyId)
//         .eq('emoji_type', userReaction.emoji_type)
//         .eq('count', 0);

//       await fetchReactions();
//     } catch (error) {
//       console.error('Error removing emoji reaction:', error);
//     }
//   };

//   return {
//     reactionCounts,
//     userReaction,
//     loading,
//     addReaction,
//     removeReaction
//   };
// }
export function useReactions(
  storyId: string,
  initialData?: {
    reactionCounts: EmojiReactionCount[];
    userReaction: EmojiReaction | null;
  }
) {
  const [reactionCounts, setReactionCounts] = useState<EmojiReactionCount[]>(
    initialData?.reactionCounts || []
  );
  const [userReaction, setUserReaction] = useState<EmojiReaction | null>(
    initialData?.userReaction || null
  );
  const [loading, setLoading] = useState(!initialData);

  // Use initial data if provided
  useEffect(() => {
    if (initialData) {
      setReactionCounts(initialData.reactionCounts);
      setUserReaction(initialData.userReaction);
      setLoading(false);

      // Update cache with initial data
      reactionCache.set(storyId, {
        counts: initialData.reactionCounts,
        userReaction: initialData.userReaction,
        timestamp: Date.now(),
      });
    }
  }, [storyId, initialData]);

  // Check cache first if no initial data
  useEffect(() => {
    if (!initialData) {
      const cachedData = reactionCache.get(storyId);
      if (cachedData && Date.now() - cachedData.timestamp < CACHE_TIMEOUT) {
        setReactionCounts(cachedData.counts);
        setUserReaction(cachedData.userReaction);
        setLoading(false);
      }
    }
  }, [storyId, initialData]);

  useEffect(() => {
    // Skip subscription if we have initial data and no need for real-time updates
    if (initialData && !userReaction) {
      return;
    }

    let isSubscribed = true;
    const channelName = `emoji_reactions_${storyId}`;

    let manager = subscriptionManager.get(channelName);
    if (!manager) {
      manager = {
        channel: null,
        subscribers: new Set(),
        refCount: 0,
      };
      subscriptionManager.set(channelName, manager);
    }

    const setupSubscription = async () => {
      try {
        // Only fetch if we didn't get data from cache or initial data
        if (loading && !initialData) {
          await fetchReactions();
        }

        if (!isSubscribed) return;

        if (!manager!.channel) {
          manager!.channel = supabase
            .channel(channelName)
            .on(
              'postgres_changes',
              {
                event: '*',
                schema: 'public',
                table: 'emoji_reactions',
                filter: `story_id=eq.${storyId}`,
              },
              () => {
                manager!.subscribers.forEach((callback) => callback());
              }
            )
            .on(
              'postgres_changes',
              {
                event: '*',
                schema: 'public',
                table: 'emoji_reaction_counts',
                filter: `story_id=eq.${storyId}`,
              },
              () => {
                manager!.subscribers.forEach((callback) => callback());
              }
            )
            .subscribe();
        }

        manager!.subscribers.add(fetchReactions);
        manager!.refCount++;
      } catch (error) {
        console.error('Error setting up reactions subscription:', error);
        setLoading(false);
      }
    };

    setupSubscription();

    return () => {
      isSubscribed = false;

      if (manager) {
        manager.subscribers.delete(fetchReactions);
        manager.refCount--;

        if (manager.refCount === 0) {
          if (manager.channel) {
            manager.channel.unsubscribe();
          }
          subscriptionManager.delete(channelName);
        }
      }
    };
  }, [storyId, initialData]);

  const fetchReactions = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userId = session?.user?.id;

      // Fetch both counts and user reaction in parallel
      const [countsResponse, userReactionResponse] = await Promise.all([
        supabase
          .from('emoji_reaction_counts')
          .select('emoji_type, count')
          .eq('story_id', storyId),
        userId
          ? supabase
              .from('emoji_reactions')
              .select('*')
              .eq('story_id', storyId)
              .eq('user_id', userId)
              .single()
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (countsResponse.error) throw countsResponse.error;
      const counts = countsResponse.data || [];
      setReactionCounts(counts);

      if (
        userReactionResponse.error &&
        userReactionResponse.error.code !== 'PGRST116'
      ) {
        throw userReactionResponse.error;
      }
      const userReactionData = userReactionResponse.data || null;
      setUserReaction(userReactionData);

      // Update cache
      reactionCache.set(storyId, {
        counts,
        userReaction: userReactionData,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('Error fetching emoji reactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const addReaction = async (emojiType: EmojiType) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) return;

      // Instant UI update
      const newReaction = {
        id: `temp-${Date.now()}`,
        story_id: storyId,
        user_id: session.user.id,
        emoji_type: emojiType,
        created_at: new Date().toISOString(),
      };

      setUserReaction(newReaction);

      // Update counts optimistically
      setReactionCounts((prev) => {
        const existing = prev.find((rc) => rc.emoji_type === emojiType);
        if (existing) {
          return prev.map((rc) =>
            rc.emoji_type === emojiType ? { ...rc, count: rc.count + 1 } : rc
          );
        } else {
          return [
            ...prev,
            { story_id: storyId, emoji_type: emojiType, count: 1 },
          ];
        }
      });

      // Remove previous reaction if exists
      if (
        userReaction &&
        userReaction.id &&
        !userReaction.id.startsWith('temp-')
      ) {
        await removeReaction(true); // Pass true to skip UI update
      }

      // Send to server
      const { error: reactionError } = await supabase
        .from('emoji_reactions')
        .insert({
          story_id: storyId,
          user_id: session.user.id,
          emoji_type: emojiType,
        });

      if (reactionError) throw reactionError;

      // Track emoji reaction event with PostHog
      // posthog.capture('emoji_reaction_added', {
      //   user: {
      //     id: session.user.id,
      //     email: session.user.email || '',
      //   },
      //   story_id: storyId,
      //   emoji_type: emojiType,
      //   timeStamp: new Date().toISOString(),
      // });

      // Refresh to get actual data from server
      await fetchReactions();
    } catch (error) {
      console.error('Error adding emoji reaction:', error);
      // Revert on error
      await fetchReactions();
    }
  };

  const removeReaction = async (skipUiUpdate = false) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user || !userReaction) return;

      // Skip UI update if requested (for internal use)
      if (!skipUiUpdate) {
        // Instant UI update
        setUserReaction(null);
        setReactionCounts((prev) =>
          prev
            .map((rc) =>
              rc.emoji_type === userReaction.emoji_type
                ? { ...rc, count: Math.max(0, rc.count - 1) }
                : rc
            )
            .filter((rc) => rc.count > 0)
        );
      }

      // Only send to server if it's a real reaction (not a temp one)
      if (userReaction.id && !userReaction.id.startsWith('temp-')) {
        const { error: reactionError } = await supabase
          .from('emoji_reactions')
          .delete()
          .eq('id', userReaction.id);

        if (reactionError) throw reactionError;
      }

      // Refresh to get actual data from server
      await fetchReactions();
    } catch (error) {
      console.error('Error removing emoji reaction:', error);
      // Revert on error
      await fetchReactions();
    }
  };

  return {
    reactionCounts,
    userReaction,
    loading,
    addReaction,
    removeReaction,
  };
}
