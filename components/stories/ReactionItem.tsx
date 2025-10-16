import React, { useState, useEffect, forwardRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Platform, Image, Modal, ScrollView, Alert } from 'react-native';
import { Play, Pause, Mic2, MoreVertical, Trash2 } from 'lucide-react-native';
import { Typography } from '@/components/ui/Typography';
import { theme } from '@/constants/theme';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence, withDelay } from 'react-native-reanimated';
import { formatTimeAgo } from '@/utils/timeUtils';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/supabase';

type Profile = Database['public']['Tables']['profiles']['Row'];
type DbReaction = Database['public']['Tables']['reactions']['Row'];

type Reaction = Omit<Omit<DbReaction, 'read'>, 'user'> & {
  user: Pick<Profile, 'id' | 'username' | 'avatar_url'>;
  replying_to?: {
    id: string;
    transcription: string | null;
    user: {
      username: string;
    };
  };
};

interface ReactionItemProps {
  reaction: Reaction;
  onReply?: (reaction: Reaction) => void;
  onReplyClick?: (reactionId: string) => void;
  replyCount?: number;
  onViewReplies?: () => void;
  isExpanded?: boolean;
  isNestedReply?: boolean;
  currentUserId?: string;
  onDelete?: (reactionId: string) => void;
}

const WaveformBar = ({ index, isPlaying }: { index: number; isPlaying: boolean }) => {
  const height = useSharedValue(12 + Math.random() * 20);
  const colors = ["#83E8FF", "#0099FF", "#00FF6E", "#FD8CFF", "#FF006F", "#FFFB00"];
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
    width: 4,
    borderRadius: 2,
    marginHorizontal: 1,
  }));

  return <Animated.View style={animatedStyle} />;
};

export const ReactionItem = forwardRef<ScrollView, ReactionItemProps>(({ 
  reaction, 
  onReply, 
  onReplyClick, 
  replyCount = 0,
  onViewReplies,
  isExpanded = false,
  isNestedReply = false,
  currentUserId,
  onDelete
}, ref) => {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const progress = useSharedValue(0);
  const [showTranscriptionModal, setShowTranscriptionModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const isOwner = currentUserId === reaction.user.id;

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  const playReaction = async () => {
    try {
      if (Platform.OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      // If currently playing, just pause
      if (isPlaying && sound) {
        await sound.pauseAsync();
        setIsPlaying(false);
        return;
      }

      // Get the public URL for the audio
      const { data: { publicUrl } } = supabase.storage
        .from('reactions')
        .getPublicUrl(reaction.audio_url);

      // If we have a sound instance, stop and seek to start
      if (sound) {
        try {
          await sound.stopAsync();
          await sound.setPositionAsync(0);
          await sound.playAsync();
          setIsPlaying(true);
          return;
        } catch (error) {
          // If there's an error with existing sound, create new one
          console.log('Error with existing sound, creating new instance');
          setSound(null);
        }
      }

      // Configure audio mode for new sound instance
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      });

      // Create a new sound instance
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: publicUrl },
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

      setSound(newSound);
      setIsPlaying(true);
      await newSound.setVolumeAsync(1.0);

      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          setCurrentTime(status.positionMillis / 1000);
          progress.value = status.positionMillis / (status.durationMillis || 1);
          
          if (status.didJustFinish) {
            setIsPlaying(false);
            setCurrentTime(0);
            progress.value = 0;
          }
        }
      });
    } catch (error) {
      console.error('Error playing reaction:', error);
    }
  };

  const handleDelete = async () => {
    Alert.alert(
      'Delete Reaction',
      'Are you sure you want to delete this reaction? This action cannot be undone.',
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
                .from('reactions')
                .delete()
                .eq('id', reaction.id);

              if (error) throw error;

              setShowMenu(false);
              onDelete?.(reaction.id);
              Alert.alert('Success', 'Reaction deleted successfully.');
            } catch (error) {
              console.error('Error deleting reaction:', error);
              Alert.alert('Error', 'Failed to delete reaction. Please try again.');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Image 
            source={{ uri: reaction.user.avatar_url || 'https://hilo.supabase.co/storage/v1/object/public/avatars/default.png' }} 
            style={styles.avatar} 
          />
          <Typography variant="body" style={styles.username}>
            {reaction.user.username}
          </Typography>
        </View>
        <View style={styles.headerRight}>
          <Typography variant="caption" style={styles.timestamp}>
            {formatTimeAgo(reaction.created_at)}
          </Typography>
          {isOwner && (
            <TouchableOpacity 
              onPress={() => setShowMenu(true)}
              style={styles.menuButton}
            >
              <MoreVertical size={16} color="#000" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {reaction.replying_to && (
        <TouchableOpacity 
          style={styles.replyingToBox}
          onPress={() => onReplyClick?.(reaction.replying_to!.id)}
        >
          <Typography variant="bodySmall" style={styles.replyingToLabel}>
            replying to {reaction.replying_to.user.username}...
          </Typography>
          {reaction.replying_to.transcription && (
            <Typography 
              variant="body" 
              style={styles.replyingToText}
              numberOfLines={2}
            >
              {reaction.replying_to.transcription}
            </Typography>
          )}
        </TouchableOpacity>
      )}

      {reaction.transcription && (
        <TouchableOpacity 
          style={styles.transcriptionBox}
          onPress={() => setShowTranscriptionModal(true)}
          activeOpacity={0.7}
        >
          <Typography variant="body" style={styles.transcription} numberOfLines={2}>
            {reaction.transcription}
          </Typography>
        </TouchableOpacity>
      )}

      <View style={styles.footer}>
        <View style={styles.footerLeft}>
          <TouchableOpacity 
            onPress={playReaction} 
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
            {Math.floor(reaction.duration / 60)}:{(reaction.duration % 60).toString().padStart(2, '0')}
          </Typography>
          <View style={styles.waveform}>
            {[...Array(7)].map((_, i) => (
              <WaveformBar key={i} index={i} isPlaying={isPlaying} />
            ))}
          </View>
        </View>
        {!isNestedReply && (
          <TouchableOpacity 
            style={styles.talkButton}
            onPress={() => onReply?.(reaction)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Mic2 size={18} color="#000" />
            <Typography variant="bodyBold" style={styles.talkText}>talk</Typography>
          </TouchableOpacity>
        )}
      </View>

      {replyCount > 0 && (
        <TouchableOpacity 
          style={styles.viewRepliesButton}
          onPress={onViewReplies}
        >
          <Typography variant="bodySmall" style={styles.viewRepliesText}>
            {isExpanded ? 'Hide' : 'View'} {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
          </Typography>
        </TouchableOpacity>
      )}

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
            <ScrollView 
              style={styles.modalScroll}
              showsVerticalScrollIndicator={false}
            >
              <Typography variant="body" style={styles.modalTranscript}>
                {reaction.transcription}
              </Typography>
            </ScrollView>
            <TouchableOpacity 
              style={styles.closeModalButton}
              onPress={() => setShowTranscriptionModal(false)}
            >
              <Typography variant="bodyBold" style={{ color: '#F77C2B' }}>Close</Typography>
            </TouchableOpacity>
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
                Delete Reaction
              </Typography>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    padding: 12,
    paddingRight: 16,
    marginBottom: 16,
    width: '100%',
    maxWidth: 366,
    alignSelf: 'center',
    gap: 12,
    borderWidth: 1,
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 6,
  },
  username: {
    fontFamily: 'Nunito',
    fontSize: 14,
    color: '#000',
    fontWeight: '400',
  },
  timestamp: {
    fontFamily: 'Nunito',
    fontSize: 12,
    color: '#8A8E8F',
    fontWeight: '400',
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
    gap: 8,
  },
  playButton: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  duration: {
    fontFamily: 'Nunito',
    fontSize: 16,
    fontWeight: '700',
    color: '#000405',
    marginRight: 8,
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 32,
    marginLeft: 8,
    marginRight: 8,
  },
  transcriptionBox: {
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
  },
  transcription: {
    flex: 1,
    maxWidth: 318,
    minHeight: 42,
    fontFamily: 'Nunito',
    fontStyle: 'normal',
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 20,
    color: '#282929',
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
  talkDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FF6B6B',
    marginRight: 8,
  },
  talkText: {
    fontFamily: 'Nunito',
    fontStyle: 'normal',
    fontWeight: '700',
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
  replyingToBox: {
    backgroundColor: 'rgba(255,230,71,0.15)',
    borderRadius: 10,
    padding: 6,
    marginTop: 4,
    marginBottom: 8,
  },
  replyingToLabel: {
    fontFamily: 'Nunito',
    fontSize: 12,
    fontWeight: '500',
    color: '#8A8E8F',
    marginBottom: 2,
  },
  replyingToText: {
    fontFamily: 'Nunito',
    fontSize: 13,
    fontWeight: '500',
    color: '#282929',
    fontStyle: 'italic',
  },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  viewRepliesButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,230,71,0.15)',
    borderRadius: 16,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  viewRepliesText: {
    fontFamily: 'Nunito',
    fontSize: 13,
    fontWeight: '500',
    color: '#282929',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  menuButton: {
    padding: 4,
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
});  