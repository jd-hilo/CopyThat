import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { Typography } from '@/components/ui/Typography';
import { FeedbackCard } from '@/components/feedback/FeedbackCard';
import { QuickRecordingModal } from '@/components/audio/QuickRecordingModal';
import { supabase } from '@/lib/supabase';
import { TouchableOpacity } from 'react-native';

interface Feedback {
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
}

interface FeedbackReaction {
  id: string;
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
  likeCount: number;
  isLiked: boolean;
}

export default function FeedbackDetailsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [reactions, setReactions] = useState<FeedbackReaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showQuickRecordingModal, setShowQuickRecordingModal] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    fetchCurrentUser();
    fetchFeedback();
    fetchReactions();
  }, [id]);

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUser(user);
    }
  };

  const fetchFeedback = async () => {
    try {
      if (!id) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: feedbackData, error } = await supabase
        .from('feedback')
        .select(`
          id,
          title,
          description,
          audio_url,
          duration,
          transcription,
          created_at,
          like_count,
          reaction_count,
          user:profiles!user_id(
            id,
            full_name,
            username,
            avatar_url,
            college,
            friend_count,
            friend_request_count
          )
        `)
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching feedback:', error);
        Alert.alert('Error', 'Failed to load feedback');
        return;
      }

      // Check if current user has liked this feedback
      const { data: likeData } = await supabase
        .from('feedback_likes')
        .select('id')
        .eq('feedback_id', feedbackData.id)
        .eq('user_id', user.id)
        .single();

      const userData = feedbackData.user as any;
      const formattedFeedback: Feedback = {
        id: feedbackData.id,
        title: feedbackData.title,
        description: feedbackData.description,
        transcription: feedbackData.transcription,
        audioUrl: feedbackData.audio_url,
        duration: feedbackData.duration,
        createdAt: feedbackData.created_at,
        user: {
          id: userData.id,
          name: userData.full_name || userData.username,
          username: userData.username,
          profileImage: userData.avatar_url || 'https://via.placeholder.com/150',
          college: userData.college,
          friend_count: userData.friend_count || 0,
          friend_request_count: userData.friend_request_count || 0
        },
        reactionCount: feedbackData.reaction_count || 0,
        likeCount: feedbackData.like_count || 0,
        isLiked: !!likeData
      };

      setFeedback(formattedFeedback);
    } catch (error) {
      console.error('Error fetching feedback:', error);
      Alert.alert('Error', 'Failed to load feedback');
    } finally {
      setLoading(false);
    }
  };

  const fetchReactions = async () => {
    try {
      if (!id) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: reactionsData, error } = await supabase
        .from('feedback_reactions')
        .select(`
          id,
          audio_url,
          duration,
          created_at,
          like_count,
          user:profiles!user_id(
            id,
            full_name,
            username,
            avatar_url,
            college,
            friend_count,
            friend_request_count
          )
        `)
        .eq('feedback_id', id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching reactions:', error);
        return;
      }

      const formattedReactions: FeedbackReaction[] = await Promise.all(
        (reactionsData || []).map(async (reaction) => {
          // Check if current user has liked this reaction
          const { data: likeData } = await supabase
            .from('feedback_likes')
            .select('id')
            .eq('reaction_id', reaction.id)
            .eq('user_id', user.id)
            .single();

          const userData = reaction.user as any;
          return {
            id: reaction.id,
            audioUrl: reaction.audio_url,
            duration: reaction.duration,
            createdAt: reaction.created_at,
            user: {
              id: userData.id,
              name: userData.full_name || userData.username,
              username: userData.username,
              profileImage: userData.avatar_url || 'https://via.placeholder.com/150',
              college: userData.college,
              friend_count: userData.friend_count || 0,
              friend_request_count: userData.friend_request_count || 0
            },
            likeCount: reaction.like_count || 0,
            isLiked: !!likeData
          };
        })
      );

      setReactions(formattedReactions);
    } catch (error) {
      console.error('Error fetching reactions:', error);
    }
  };

  const handleFeedbackReaction = (feedback: Feedback) => {
    setShowQuickRecordingModal(true);
  };

  const handleFeedbackReactionSubmitted = () => {
    fetchReactions();
    fetchFeedback();
  };

  const handleQuickRecordingSuccess = () => {
    setShowQuickRecordingModal(false);
    fetchReactions();
    fetchFeedback();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Typography variant="body" style={styles.loadingText}>
            Loading feedback...
          </Typography>
        </View>
      </SafeAreaView>
    );
  }

  if (!feedback) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Typography variant="h3" style={styles.errorText}>
            Feedback not found
          </Typography>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Typography variant="button" style={styles.backButtonText}>
              Go Back
            </Typography>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color="#333" />
        </TouchableOpacity>
        <Typography variant="h3" style={styles.headerTitle}>
          Feedback Details
        </Typography>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <FeedbackCard
          feedback={feedback}
          onReaction={handleFeedbackReaction}
          onReactionPosted={handleFeedbackReactionSubmitted}
        />

        <View style={styles.reactionsSection}>
          <Typography variant="h3" style={styles.reactionsTitle}>
            Responses ({reactions.length})
          </Typography>
          
          {reactions.length === 0 ? (
            <View style={styles.emptyReactions}>
              <Typography variant="body" style={styles.emptyText}>
                No responses yet. Be the first to respond!
              </Typography>
            </View>
          ) : (
            reactions.map((reaction) => (
              <View key={reaction.id} style={styles.reactionItem}>
                {/* You can create a ReactionCard component similar to FeedbackCard */}
                <View style={styles.reactionCard}>
                  <View style={styles.reactionHeader}>
                    <Typography variant="bodyBold" style={styles.reactionUserName}>
                      {reaction.user.name}
                    </Typography>
                    <Typography variant="caption" style={styles.reactionTimestamp}>
                      {new Date(reaction.createdAt).toLocaleDateString()}
                    </Typography>
                  </View>
                  <View style={styles.reactionAudio}>
                    <Typography variant="body" style={styles.reactionDuration}>
                      🎤 {Math.floor(reaction.duration / 60)}:{(reaction.duration % 60).toString().padStart(2, '0')}
                    </Typography>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Quick Recording Modal */}
      {showQuickRecordingModal && (
        <QuickRecordingModal
          storyId="feedback"
          onClose={() => setShowQuickRecordingModal(false)}
          onSuccess={handleQuickRecordingSuccess}
          username={currentUser?.email}
          isVisible={showQuickRecordingModal}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#333',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorText: {
    textAlign: 'center',
    marginBottom: 24,
    color: '#666',
  },
  backButtonText: {
    color: '#007AFF',
  },
  reactionsSection: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  reactionsTitle: {
    marginBottom: 16,
    color: '#333',
  },
  emptyReactions: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
  },
  reactionItem: {
    marginBottom: 12,
  },
  reactionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  reactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reactionUserName: {
    color: '#333',
  },
  reactionTimestamp: {
    color: '#666',
  },
  reactionAudio: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reactionDuration: {
    color: '#007AFF',
  },
}); 