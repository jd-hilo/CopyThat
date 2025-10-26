import React from 'react';
import { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  Platform,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  Dimensions,
  Modal,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { X, Mic, Pause, Check, ArrowLeft, Tag, Lock, Send, Play, FileText } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { Typography } from '@/components/ui/Typography';
import { Category } from '@/constants/theme';
import { formatDuration } from '@/utils/timeUtils';
import { createStory } from '@/lib/stories';
import { supabase } from '@/lib/supabase';
import { transcribeAudioFile } from '@/lib/transcription';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { STORY_TAGS } from '@/constants/tags';
import { mixpanel } from './_layout';
//import { showReactionNotificationModal } from '@/lib/notifications';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import Svg, { Path } from 'react-native-svg';
import { posthog } from '@/posthog';
import { useAuth } from '@/contexts/authContext';
import { VoiceSelector } from '@/components/audio/VoiceSelector';
import { voiceChanger } from '@/lib/elevenLabs';
const { width } = Dimensions.get('window');

const WaveBar = ({
  index,
  isRecording,
  isPlaying = false,
}: {
  index: number;
  isRecording: boolean;
  isPlaying?: boolean;
}) => {
  const barHeight = useSharedValue(8 + Math.random() * 22);
  const colors = [
    '#83E8FF',
    '#0099FF',
    '#00FF6E',
    '#FD8CFF',
    '#FF006F',
    '#FFFB00',
    '#FFFFFF',
  ];
  const activeColor = colors[index % colors.length];
  const delay = index * 50;

  useEffect(() => {
    if (isRecording) {
      barHeight.value = withRepeat(
        withSequence(
          withDelay(
            delay,
            withTiming(30 + Math.random() * 20, { duration: 500 })
          ),
          withTiming(8 + Math.random() * 12, { duration: 500 })
        ),
        -1,
        true
      );
    } else if (isPlaying) {
      barHeight.value = withRepeat(
        withSequence(
          withDelay(
            delay,
            withTiming(60 + Math.random() * 50, { duration: 150 })
          ),
          withTiming(25 + Math.random() * 35, { duration: 150 })
        ),
        -1,
        true
      );
    } else {
      // Static height when not recording or playing
      barHeight.value = 8 + Math.random() * 15;
    }
  }, [isRecording, isPlaying]);

  const animatedStyle = useAnimatedStyle(() => ({
    height: barHeight.value,
    backgroundColor: isRecording ? activeColor : '#DADADA',
    opacity: isRecording ? 1 : 0.32,
    width: 4,
    borderRadius: 15.6257,
    shadowColor: isRecording ? 'rgba(253, 140, 255, 0.32)' : 'transparent',
    shadowOffset: {
      width: 0,
      height: 3.12515,
    },
    shadowRadius: isRecording ? 1.56257 : 0,
  }));

  return <Animated.View style={animatedStyle} />;
};

interface TagsModalProps {
  visible: boolean;
  onClose: () => void;
  onSaveTag: (tag: string) => void;
  selectedTag: string;
}

interface GroupsModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectGroup: (groupId: string | null) => void;
  selectedGroupId: string | null;
  groups: { id: string; name: string; member_count: { count: number } }[];
}

const GroupsModal = ({
  visible,
  onClose,
  onSelectGroup,
  selectedGroupId,
  groups,
}: GroupsModalProps) => {
  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Typography variant="h2" style={styles.modalTitle}>
              select group
            </Typography>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color="#000" />
            </TouchableOpacity>
          </View>

          <View style={styles.tagsList}>
            {groups.map((group) => (
              <TouchableOpacity
                key={group.id}
                style={[
                  styles.tagItem,
                  selectedGroupId === group.id && styles.tagItemSelected,
                ]}
                onPress={() => {
                  onSelectGroup(group.id);
                  onClose();
                }}
              >
                <Typography
                  variant="body"
                  style={{
                    ...styles.tagText,
                    ...(selectedGroupId === group.id
                      ? styles.tagTextSelected
                      : {}),
                  }}
                >
                  {group.name}
                </Typography>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={styles.saveTagsButton}
            onPress={() => {
              onSelectGroup(null);
              onClose();
            }}
          >
            <Typography variant="body" style={styles.saveTagsText}>
              clear selection
            </Typography>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const TagsModal = ({
  visible,
  onClose,
  onSaveTag,
  selectedTag,
}: TagsModalProps) => {
  const [currentTag, setCurrentTag] = useState(selectedTag);

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Typography variant="h2" style={styles.modalTitle}>
              select tag
            </Typography>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color="#000" />
            </TouchableOpacity>
          </View>

          <View style={styles.tagsList}>
            {STORY_TAGS.map((tag) => (
              <TouchableOpacity
                key={tag}
                style={[
                  styles.tagItem,
                  currentTag === tag && styles.tagItemSelected,
                ]}
                onPress={() => setCurrentTag(tag)}
              >
                <Typography
                  variant="body"
                  style={[
                    styles.tagText,
                    currentTag === tag ? styles.tagTextSelected : {},
                  ]}
                >
                  {tag}
                </Typography>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={styles.saveTagsButton}
            onPress={() => {
              onSaveTag(currentTag);
              onClose();
            }}
          >
            <Typography variant="body" style={styles.saveTagsText}>
              save tag
            </Typography>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const TranscriptionModal = ({
  visible,
  onClose,
  transcription,
}: {
  visible: boolean;
  onClose: () => void;
  transcription: string | null;
}) => {
  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.modalOverlay,
          { justifyContent: 'center', alignItems: 'center' },
        ]}
      >
        <View
          style={[
            styles.modalContent,
            {
              maxHeight: '80%',
              marginHorizontal: 20,
              borderRadius: 24,
              width: '90%',
            },
          ]}
        >
          <View style={styles.modalHeader}>
            <Typography variant="h2" style={styles.modalTitle}>
              Transcription
            </Typography>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color="#000" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.transcriptionScroll}>
            <Typography variant="body" style={styles.transcriptionText}>
              {transcription || 'No transcription available'}
            </Typography>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const DetailsView = ({
  duration,
  title,
  setTitle,
  onBack,
  onSave,
  isSaving,
  recordingUri,
  selectedTag,
  onTagChange,
  transcription,
  userCollege,
  onRestart,
  userGroups,
  selectedGroupId,
  onGroupChange,
  currentUserId,
  currentUserHasVoiceClone,
}: {
  duration: number;
  title: string;
  setTitle: (text: string) => void;
  onBack: () => void;
  onSave: (isPrivate: boolean, groupId?: string | null, selectedVoiceUserId?: string | null, selectedVoiceId?: string | null, clonedAudioUri?: string | null) => void;
  isSaving: boolean;
  recordingUri: string | null;
  selectedTag: string;
  onTagChange: (tag: string) => void;
  transcription: string | null;
  userCollege: string | null;
  onRestart: () => void;
  userGroups: { id: string; name: string; member_count: { count: number } }[];
  selectedGroupId: string | null;
  onGroupChange: (groupId: string | null) => void;
  currentUserId: string;
  currentUserHasVoiceClone: boolean;
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showTagsModal, setShowTagsModal] = useState(false);
  const [showGroupsModal, setShowGroupsModal] = useState(false);
  const [isFriendsOnly, setIsFriendsOnly] = useState(
    userCollege === 'None of the Above'
  );
  const sound = useRef<Audio.Sound | null>(null);
  const [showTranscriptionModal, setShowTranscriptionModal] = useState(false);
  const [showBackWarning, setShowBackWarning] = useState(false);
  const [groupMembers, setGroupMembers] = useState<any[]>([]);
  const [selectedVoiceUserId, setSelectedVoiceUserId] = useState<string | null>(null);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [clonedAudioUri, setClonedAudioUri] = useState<string | null>(null);
  const [isGeneratingVoice, setIsGeneratingVoice] = useState(false);
  const clonedSound = useRef<Audio.Sound | null>(null);

  // Fetch group members when group is selected
  useEffect(() => {
    const fetchGroupMembers = async () => {
      if (!selectedGroupId) {
        setGroupMembers([]);
        setSelectedVoiceUserId(null);
        setSelectedVoiceId(null);
        setClonedAudioUri(null);
        return;
      }

      setLoadingMembers(true);
      try {
        const { data: members, error } = await supabase
          .from('group_members')
          .select(
            `
            user_id,
            profiles!inner (
              id,
              username,
              avatar_url,
              voice_clone_id,
              voice_clone_status
            )
          `
          )
          .eq('group_id', selectedGroupId);

        if (error) throw error;

        // Format the data
        const formattedMembers = members?.map((m: any) => ({
          id: m.profiles.id,
          username: m.profiles.username,
          avatar_url: m.profiles.avatar_url,
          voice_clone_id: m.profiles.voice_clone_id,
          voice_clone_status: m.profiles.voice_clone_status,
        })) || [];

        console.log('Fetched group members:', formattedMembers.length);
        console.log('Members data:', formattedMembers);
        setGroupMembers(formattedMembers);
      } catch (error) {
        console.error('Error fetching group members:', error);
        setGroupMembers([]);
      } finally {
        setLoadingMembers(false);
      }
    };

    fetchGroupMembers();
  }, [selectedGroupId]);

  // Auto-generate voice preview when voice is selected
  useEffect(() => {
    // Reset and regenerate when voice selection changes
    setClonedAudioUri(null);
    if (clonedSound.current) {
      clonedSound.current.unloadAsync();
      clonedSound.current = null;
    }

    // Auto-generate if a different voice is selected
    if (selectedVoiceId && selectedVoiceUserId && selectedVoiceUserId !== currentUserId && recordingUri) {
      handleGenerateVoicePreview();
    }
  }, [selectedVoiceId, selectedVoiceUserId]);

  // Generate voice preview
  const handleGenerateVoicePreview = async () => {
    console.log('Generating voice preview:', { 
      selectedVoiceId,
      hasRecordingUri: !!recordingUri,
      recordingUri
    });
    
    if (!selectedVoiceId || !recordingUri) {
      console.log('Skipping voice generation - no voice selected or no recording');
      return;
    }

    setIsGeneratingVoice(true);
    try {
      console.log('Calling voiceChanger with:', { 
        audioUri: recordingUri, 
        voiceId: selectedVoiceId 
      });
      const result = await voiceChanger(recordingUri, selectedVoiceId);
      
      if (!result.success || !result.audioUri) {
        throw new Error(result.error || 'Failed to generate voice preview');
      }

      setClonedAudioUri(result.audioUri);
      
      // Automatically play the cloned audio after generation
      setTimeout(async () => {
        try {
          await Audio.setAudioModeAsync({
            playsInSilentModeIOS: true,
            staysActiveInBackground: true,
            shouldDuckAndroid: false,
            playThroughEarpieceAndroid: false,
            allowsRecordingIOS: false,
          });

          const { sound: newSound } = await Audio.Sound.createAsync(
            { uri: result.audioUri! },
            { shouldPlay: true }
          );

          clonedSound.current = newSound;
          setIsPlaying(true);

          newSound.setOnPlaybackStatusUpdate((status) => {
            if (!status.isLoaded) return;
            if (status.didJustFinish) {
              setIsPlaying(false);
              clonedSound.current?.unloadAsync();
              clonedSound.current = null;
            }
          });
        } catch (playError) {
          console.error('Error auto-playing preview:', playError);
        }
      }, 500);
    } catch (error) {
      console.error('Error generating voice preview:', error);
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to generate voice preview'
      );
    } finally {
      setIsGeneratingVoice(false);
    }
  };

  // Add cleanup on navigation
  useFocusEffect(
    React.useCallback(() => {
      return () => {
        const soundInstance = sound.current;
        if (soundInstance) {
          (async () => {
            try {
              // First try to pause before unloading to prevent URL errors
              try {
                const status = await soundInstance.getStatusAsync();
                if (status.isLoaded && status.isPlaying) {
                  await soundInstance.pauseAsync();
                }
              } catch (pauseError) {
                console.warn('Error pausing preview sound:', pauseError);
                // Continue with cleanup even if pause fails
              }

              // Wrap unload in try-catch to handle potential URL errors
              try {
                await soundInstance.unloadAsync();
              } catch (unloadError) {
                console.warn('Error unloading preview sound:', unloadError);
                // If unload fails, we still want to null the reference
              }
            } catch (error) {
              console.warn('Error during preview sound cleanup:', error);
            }
            // Always reset state regardless of errors
            sound.current = null;
            setIsPlaying(false);
          })();
        }
      };
    }, [])
  );

  // Get first three lines of transcription
  const previewText = transcription
    ? transcription.split('\n').slice(0, 2).join('\n')
    : 'No transcription available';

  // Match StoryCard playback using Expo Audio.Sound
  const playRecording = async () => {
    try {
      // Use cloned audio if available, otherwise use original recording
      const audioToPlay = clonedAudioUri || recordingUri;
      const soundRef = clonedAudioUri ? clonedSound : sound;

      if (!audioToPlay) {
        console.error('No audio URI available');
        return;
      }

      // Ensure audio mode matches story card behavior
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
        allowsRecordingIOS: false,
      });

      // Toggle play/pause using a single Sound instance
      if (soundRef.current) {
        const status = await soundRef.current.getStatusAsync();
        if (status.isLoaded && status.isPlaying) {
          await soundRef.current.pauseAsync();
          setIsPlaying(false);
        } else {
          await soundRef.current.playAsync();
          setIsPlaying(true);
        }
        return;
      }

      // Create and play sound from URI
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: audioToPlay },
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

      await newSound.setVolumeAsync(1.0);
      soundRef.current = newSound;
      setIsPlaying(true);

      newSound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) return;

        if (status.didJustFinish) {
          setIsPlaying(false);
          soundRef.current?.unloadAsync();
          soundRef.current = null;
        }
      });
    } catch (error) {
      console.error('Error playing preview:', error);
      setIsPlaying(false);
      if (sound.current) {
        try {
          await sound.current.unloadAsync();
        } catch {}
        sound.current = null;
      }
      if (clonedSound.current) {
        try {
          await clonedSound.current.unloadAsync();
        } catch {}
        clonedSound.current = null;
      }
    }
  };

  // Clean up sound when component unmounts
  useEffect(() => {
    return () => {
      if (sound.current) {
        sound.current.unloadAsync().catch((error) => {
          console.error('Error unloading sound on cleanup:', error);
        });
      }
      if (clonedSound.current) {
        clonedSound.current.unloadAsync().catch((error) => {
          console.error('Error unloading cloned sound on cleanup:', error);
        });
      }
    };
  }, []);

  return (
    <View style={styles.detailsContainer}>
      {/* Back button - Fixed position */}
      <View style={styles.detailsTopBar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setShowBackWarning(true)}
        >
          <ArrowLeft size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Scrollable Content */}
      <ScrollView
        style={styles.detailsScrollView}
        contentContainerStyle={styles.detailsContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Rest of the content */}
        <View style={styles.titleSection}>
          <Typography variant="h1" style={styles.titleLabel} numberOfLines={1}>
            what did you talk about?
          </Typography>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.titleInput}
              value={title}
              onChangeText={(text) => {
                if (text.length <= 50) {
                  setTitle(text);
                }
              }}
              placeholder="enter title"
              placeholderTextColor="#8A8E8F"
              maxLength={50}
            />
            <Typography variant="body" style={styles.characterCount}>
              {title.length}/50
            </Typography>
          </View>
        </View>

        {/* Audio Duration */}
        <View style={styles.audioDurationContainer}>
          <Typography variant="body" style={styles.audioDurationText}>
            {formatDuration(duration)}
          </Typography>
        </View>

        {/* Audio Visualization */}
        <View style={styles.audioSection}>
          <View style={styles.audioWaveform}>
            {[...Array(20)].map((_, i) => (
              <WaveBar
                key={i}
                index={i}
                isRecording={false}
                isPlaying={isPlaying}
              />
            ))}
          </View>
          <TouchableOpacity style={styles.playButton} onPress={playRecording}>
            {isPlaying ? (
              <Pause size={20} color="#000000" />
            ) : (
              <Play size={20} color="#000000" />
            )}
          </TouchableOpacity>
        </View>

        {/* Transcription Preview */}
        <TouchableOpacity
          style={styles.transcriptionButton}
          onPress={() => setShowTranscriptionModal(true)}
        >
          <FileText size={14} color="#9B5602" />
          <Typography variant="body" style={styles.transcriptionButtonText}>
            View transcription
          </Typography>
        </TouchableOpacity>

        {/* Options Section */}
        <View style={styles.optionsSection}>
          <View style={styles.optionBox}>
            {/* Hide tag option if user has no groups and college is "None of the Above" */}
            {!(
              userCollege === 'None of the Above' && userGroups.length === 0
            ) && (
              <View style={styles.optionRow}>
                <View style={styles.optionLabel}>
                  <Tag size={24} color="#000000" />
                  <Typography variant="body" style={styles.optionText}>
                    {selectedTag ? selectedTag : 'add tag'}
                  </Typography>
                </View>
                <TouchableOpacity
                  style={styles.optionButton}
                  onPress={() => setShowTagsModal(true)}
                >
                  {selectedTag ? (
                    <Check size={16} color="#000000" />
                  ) : (
                    <Typography variant="body" style={styles.plusIcon}>
                      +
                    </Typography>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* Show group option for regular users OR for "None of the Above" users who have groups */}
            {(userCollege !== 'None of the Above' ||
              (userCollege === 'None of the Above' &&
                userGroups.length > 0)) && (
              <View style={styles.optionRow}>
                <View style={styles.optionLabel}>
                  <Lock size={24} color="#000000" />
                  <Typography variant="body" style={styles.optionText}>
                    {selectedGroupId
                      ? userGroups.find(g => g.id === selectedGroupId)?.name || 
                        (userCollege === 'None of the Above' ? 'post to group *' : 'post to group')
                      : userCollege === 'None of the Above'
                      ? 'post to group *'
                      : 'post to group'}
                  </Typography>
                </View>
                <TouchableOpacity
                  style={[
                    styles.optionButton,
                    selectedGroupId && styles.optionButtonSelected,
                    userCollege === 'None of the Above' &&
                      !selectedGroupId &&
                      styles.optionButtonRequired,
                  ]}
                  onPress={() => setShowGroupsModal(true)}
                >
                  {selectedGroupId ? (
                    <Check size={16} color="#000000" />
                  ) : (
                    <Typography variant="body" style={styles.plusIcon}>
                      +
                    </Typography>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Voice Selection - Show if group is selected and any member has voice clone */}
          {selectedGroupId && groupMembers.length > 0 && groupMembers.some(m => m.voice_clone_status === 'ready') && (
            <>
              <VoiceSelector
                groupMembers={groupMembers}
                selectedVoiceUserId={selectedVoiceUserId}
                currentUserId={currentUserId}
                onSelectVoice={(userId, voiceId) => {
                  setSelectedVoiceUserId(userId);
                  setSelectedVoiceId(voiceId);
                }}
              />
              
              {/* Voice Preview Status */}
              {selectedVoiceId && selectedVoiceUserId !== currentUserId && (
                <View style={styles.voicePreviewContainer}>
                  {isGeneratingVoice ? (
                    <View style={styles.generatingContainer}>
                      <ActivityIndicator size="small" color="#FF9B71" />
                      <Typography variant="body" style={styles.generatingText}>
                        Converting to {groupMembers.find(m => m.id === selectedVoiceUserId)?.username}'s voice...
                      </Typography>
                    </View>
                  ) : clonedAudioUri ? (
                    <View style={styles.previewReadyContainer}>
                      <Check size={18} color="#4CAF50" />
                      <Typography variant="body" style={styles.previewReadyText}>
                        ✨ Voice converted! Tap play above to hear it in {groupMembers.find(m => m.id === selectedVoiceUserId)?.username}'s voice
                      </Typography>
                    </View>
                  ) : null}
                </View>
              )}
            </>
          )}

          <View style={styles.optionBox}>

            {/* Check if user has no groups and college is "None of the Above" */}
            {userCollege === 'None of the Above' && userGroups.length === 0 ? (
              <View style={styles.noGroupsContainer}>
                <Typography variant="body" style={styles.noGroupsText}>
                  join or create a group so you don't post into the void
                </Typography>
                <TouchableOpacity
                  style={[styles.postButton, styles.disabledPostButton]}
                  disabled={true}
                >
                  <Typography
                    variant="body"
                    style={[styles.postText, styles.disabledPostText]}
                  >
                    post recording
                  </Typography>
                  <View style={styles.sendIconContainer}>
                    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                      <Path
                        d="M9 18L15 12L9 6"
                        stroke="#8A8E8F"
                        strokeWidth={3}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                  </View>
                </TouchableOpacity>
              </View>
            ) : (
              /* Regular Post Recording Button */
              <TouchableOpacity
                style={styles.postButton}
                onPress={() => onSave(isFriendsOnly, selectedGroupId, selectedVoiceUserId, selectedVoiceId, clonedAudioUri)}
                disabled={isSaving}
              >
                <Typography variant="body" style={styles.postText}>
                  {isSaving ? 'posting...' : 'post recording'}
                </Typography>
                <View style={styles.sendIconContainer}>
                  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M9 18L15 12L9 6"
                      stroke="#FFFB00"
                      strokeWidth={3}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                </View>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <TagsModal
          visible={showTagsModal}
          onClose={() => setShowTagsModal(false)}
          onSaveTag={onTagChange}
          selectedTag={selectedTag}
        />

        <GroupsModal
          visible={showGroupsModal}
          onClose={() => setShowGroupsModal(false)}
          onSelectGroup={onGroupChange}
          selectedGroupId={selectedGroupId}
          groups={userGroups}
        />

        <TranscriptionModal
          visible={showTranscriptionModal}
          onClose={() => setShowTranscriptionModal(false)}
          transcription={transcription}
        />

      </ScrollView>

      {/* Warning Modal for Back Button */}
      <Modal
        visible={showBackWarning}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBackWarning(false)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'rgba(0,0,0,0.4)',
          }}
        >
          <View
            style={{
              backgroundColor: '#fff',
              borderRadius: 20,
              padding: 24,
              width: 300,
              alignItems: 'center',
            }}
          >
            <Typography
              variant="h2"
              style={{ textAlign: 'center', marginBottom: 12 }}
            >
              discard recording?
            </Typography>
            <Typography
              variant="body"
              style={{ textAlign: 'center', marginBottom: 24 }}
            >
              are you sure you want to go back? your current post will be
              lost.
            </Typography>
            <View style={{ flexDirection: 'row', gap: 16 }}>
              <TouchableOpacity
                style={{
                  paddingVertical: 12,
                  paddingHorizontal: 24,
                  borderRadius: 26,
                  backgroundColor: '#E4E4E4',
                  minWidth: 100,
                  alignItems: 'center',
                }}
                onPress={() => setShowBackWarning(false)}
              >
                <Typography
                  variant="body"
                  style={{ color: '#000000', fontWeight: '600' }}
                >
                  cancel
                </Typography>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  paddingVertical: 12,
                  paddingHorizontal: 24,
                  borderRadius: 26,
                  backgroundColor: '#1D1D1D',
                  minWidth: 100,
                  alignItems: 'center',
                }}
                onPress={async () => {
                  setShowBackWarning(false);
                  // Small delay to ensure modal closes properly
                  setTimeout(() => {
                    onRestart();
                  }, 100);
                }}
              >
                <Typography
                  variant="body"
                  style={{ color: '#FFFFFF', fontWeight: '600' }}
                >
                  yes, discard
                </Typography>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const SuccessModal = ({
  visible,
  onClose,
  router,
  userCollege,
  selectedGroupId,
}: {
  visible: boolean;
  onClose: () => void;
  router: any;
  userCollege: string | null;
  selectedGroupId: string | null;
}) => {
  const handleGotIt = () => {
    onClose();
    if (selectedGroupId) {
      // Route to groups feed with the specific group selected
      router.replace(`/(tabs)?feed=groups&groupId=${selectedGroupId}`);
    } else {
      // Route to community feed
      router.replace('/(tabs)');
    }
  };

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.successModalContainer}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.successModalContent}>
          <View style={styles.successIconContainer}>
            <Check size={32} color="#000000" />
          </View>
          <Typography variant="h2" style={styles.successTitle}>
            Posted!
          </Typography>
          <Typography variant="body" style={styles.successMessage}>
            Your recording has been published
          </Typography>
          <TouchableOpacity style={styles.successButton} onPress={handleGotIt}>
            <Typography variant="body" style={styles.successButtonText}>
              Got it
            </Typography>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

export default function RecordScreen({ initialGroupId }: { initialGroupId?: string } = {}) {
  const router = useRouter();
  const params = useLocalSearchParams<{ groupId?: string }>();
  const urlGroupId = params?.groupId ? String(params.groupId) : undefined;
  const [isRecording, setIsRecording] = useState(false);
  const [hasAudioSignal, setHasAudioSignal] = useState(false);
  const [duration, setDuration] = useState(0);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Category>('Personal');
  const [isSaving, setIsSaving] = useState(false);
  const [transcription, setTranscription] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [selectedTag, setSelectedTag] = useState('');
  const [userCollege, setUserCollege] = useState<string | null>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStoryIsFriendsOnly, setCurrentStoryIsFriendsOnly] =
    useState(false);
  const [userGroups, setUserGroups] = useState<
    { id: string; name: string; member_count: { count: number } }[]
  >([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(
    initialGroupId ?? urlGroupId ?? null
  );
  
  // Debug log to see if initialGroupId is being passed
  console.log('RecordScreen - initialGroupId:', initialGroupId);
  console.log('RecordScreen - selectedGroupId:', selectedGroupId);
  const [currentUserHasVoiceClone, setCurrentUserHasVoiceClone] = useState(false);
  const { user } = useAuth();
  const recording = useRef<Audio.Recording | null>(null);
  const recordingUri = useRef<string | null>(null);
  const cleanupTranscription = useRef<(() => void) | null>(null);
  const pulseOpacity = useSharedValue(0.7);
  const recordingDotScale = useSharedValue(1);
  const sound = useRef<Audio.Sound | null>(null);

  // Add cleanup on navigation
  useFocusEffect(
    React.useCallback(() => {
      return () => {
        cleanup();
      };
    }, [])
  );

  // Cleanup function to properly unload recording
  const cleanup = async () => {
    try {
      if (recording.current) {
        try {
          const status = await recording.current.getStatusAsync();
          if (status.isRecording) {
            await recording.current.stopAndUnloadAsync();
          }
        } catch (error) {
          console.warn('Error stopping recording:', error);
          // Continue cleanup even if stopping recording fails
        }
        recording.current = null;
      }

      if (cleanupTranscription.current) {
        cleanupTranscription.current();
        cleanupTranscription.current = null;
      }

      if (sound.current) {
        const soundInstance = sound.current;
        // First try to pause before unloading to prevent URL errors
        try {
          const status = await soundInstance.getStatusAsync();
          if (status.isLoaded && status.isPlaying) {
            await soundInstance.pauseAsync();
          }
        } catch (pauseError) {
          console.warn('Error pausing sound:', pauseError);
          // Continue with cleanup even if pause fails
        }

        // Wrap unload in try-catch to handle potential URL errors
        try {
          await soundInstance.unloadAsync();
        } catch (unloadError) {
          console.warn('Error unloading sound:', unloadError);
          // If unload fails, we still want to null the reference
        }
        sound.current = null;
      }

      // Reset audio mode
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: false,
          staysActiveInBackground: false,
          shouldDuckAndroid: false,
          playThroughEarpieceAndroid: false,
        });
      } catch (audioModeError) {
        console.warn('Error resetting audio mode:', audioModeError);
      }

      // Always reset state regardless of errors
      setIsRecording(false);
    } catch (error) {
      console.warn('Error during cleanup:', error);
      // Reset state even if cleanup fails
      recording.current = null;
      sound.current = null;
      setIsRecording(false);
    }
  };

  useEffect(() => {
    // Set up audio mode when component mounts
    const setupAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
      } catch (error) {
        console.error('Error setting up audio mode:', error);
      }
    };

    setupAudio();

    return () => {
      cleanup();
    };
  }, []);

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
    const checkUserCollege = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('college, voice_clone_status')
          .eq('id', user.id)
          .single();

        setUserCollege(profile?.college || null);
        setCurrentUserHasVoiceClone(profile?.voice_clone_status === 'ready');

        // Fetch user's groups
        const { data: groups } = await supabase
          .from('groups')
          .select(
            `
            *,
            group_members!inner (user_id),
            member_count:group_members(count)
          `
          )
          .eq('group_members.user_id', user.id);

        setUserGroups(groups || []);
      }
    };
    checkUserCollege();
  }, []);

  const startRecording = async () => {
    try {
      await cleanup();

      // Prevent attempts on unsupported environments
      if (Platform.OS === 'web') {
        Alert.alert(
          'Not supported',
          'Recording is not supported in the web environment for this build. Please use a physical device or Expo Go.'
        );
        return;
      }

      // Check if running on iOS simulator
      if (Platform.OS === 'ios' && Device.isDevice === false) {
        Alert.alert(
          'Simulator Detected',
          'Audio recording is not fully supported in the iOS simulator. Please use a physical device for recording.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Platform.OS will never be 'web' here since we return early above
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        console.error('Recording permissions not granted');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      const newRecording = new Audio.Recording();
      try {
        await newRecording.prepareToRecordAsync({
          ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
          android: {
            ...Audio.RecordingOptionsPresets.HIGH_QUALITY.android,
            extension: '.m4a',
            outputFormat: Audio.AndroidOutputFormat.MPEG_4,
            audioEncoder: Audio.AndroidAudioEncoder.AAC,
          },
          ios: {
            ...Audio.RecordingOptionsPresets.HIGH_QUALITY.ios,
            extension: '.m4a',
            outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
            audioQuality: Audio.IOSAudioQuality.HIGH,
          },
        });

        await newRecording.startAsync();
        recording.current = newRecording;
        setIsRecording(true);

        pulseOpacity.value = withRepeat(
          withTiming(0.3, {
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
          }),
          -1,
          true
        );

        newRecording.setProgressUpdateInterval(500);
        newRecording.setOnRecordingStatusUpdate(
          (status: Audio.RecordingStatus) => {
            if (status.isRecording) {
              // On iOS with metering enabled, metering is from 0 (loud) to ~-160 (silence).
              // Treat above -50 dB as having audio.
              // Some platforms may not support metering; fallback to true while recording.
              const metering = (status as any).metering as number | undefined;
              if (typeof metering === 'number') {
                setHasAudioSignal(metering > -50);
              } else {
                setHasAudioSignal(true);
              }
            } else {
              setHasAudioSignal(false);
            }
          }
        );
      } catch (error) {
        console.error('Error in recording setup:', error);
        try {
          await newRecording.stopAndUnloadAsync();
        } catch (stopError) {
          console.error('Error stopping failed recording:', stopError);
        }
        throw error;
      }
    } catch (err) {
      // Show a friendly message and ensure UI is stable
      Alert.alert(
        'Recording unavailable',
        'Unable to start audio recording in this environment. Please try on a physical device.'
      );
      console.warn('Failed to start recording:', err);
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    if (!recording.current) return;

    try {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      // Immediately stop recording state and timer
      setIsRecording(false);
      setHasAudioSignal(false);
      pulseOpacity.value = withTiming(0, { duration: 300 });

      const recordingInstance = recording.current;
      try {
        await recordingInstance.stopAndUnloadAsync();
        const uri = recordingInstance.getURI();
        if (!uri) {
          throw new Error('Failed to get recording URI');
        }
        recordingUri.current = uri;

        console.log('Starting transcription of recorded audio');
        setIsTranscribing(true);
        try {
          const transcript = await transcribeAudioFile(uri);
          if (transcript) {
            console.log('Transcription successful');
            setTranscription(transcript);
          }
        } catch (transcriptionError) {
          console.error('Transcription error:', transcriptionError);
        } finally {
          setIsTranscribing(false);
          setShowDetails(true); // Show the details form after recording
        }
      } catch (error) {
        console.error('Error stopping recording:', error);
        throw error;
      } finally {
        recording.current = null;
      }
    } catch (err) {
      console.error('Failed to stop recording:', err);
      setIsRecording(false);
    }
  };

  const resetRecordingState = () => {
    setIsRecording(false);
    setDuration(0);
    setTitle('');
    setDescription('');
    setCategory('Personal');
    setTranscription(null);
    setIsTranscribing(false);
    setShowDetails(false);
    setCurrentStoryIsFriendsOnly(false);
    recordingUri.current = null;
    if (recording.current) {
      recording.current = null;
    }
  };

  const handleSave = async (
    isPrivate: boolean,
    groupId?: string | null,
    selectedVoiceUserId?: string | null,
    selectedVoiceId?: string | null,
    clonedAudioUri?: string | null
  ) => {
    if (!recordingUri.current) {
      console.error('No recording available');
      return;
    }

    if (!title.trim()) {
      Alert.alert(
        'Missing Information',
        'Please add a title for your recording.'
      );
      return;
    }

    // Tag is now optional - no validation needed

    // Require group selection for "None of the Above" users who have groups
    if (
      userCollege === 'None of the Above' &&
      userGroups.length > 0 &&
      !selectedGroupId
    ) {
      Alert.alert(
        'Missing Information',
        'Please select a group to post your recording to.'
      );
      return;
    }

    setIsSaving(true);
    try {
      if (recording.current) {
        await recording.current.stopAndUnloadAsync();
        recording.current = null;
      }

      // const {
      //   data: { session },
      //   error: sessionError,
      // } = await supabase.auth.getSession();

      // if (sessionError || !session?.user) {
      //   console.error('Authentication failed:', sessionError);
      //   Alert.alert('Error', 'Failed to authenticate. Please try again.');
      //   setIsSaving(false);
      //   return;
      // }

      const audioUri = recordingUri.current;
      const success = await createStory(audioUri, user?.id as string, {
        title: title.trim() || 'Untitled Recording',
        description: description.trim(),
        category: selectedTag,
        duration,
        transcription: transcription,
        isPrivate: isPrivate,
        isFriendsOnly: userCollege === 'None of the Above' ? true : isPrivate,
        groupId: selectedGroupId,
        selectedVoiceUserId: selectedVoiceUserId,
        selectedVoiceId: selectedVoiceId,
        clonedAudioUri: clonedAudioUri,
      });
      mixpanel.track('Audio recording posted');

      if (success) {
        console.log('Audio posted successfully');
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        
        // Reset state
        resetRecordingState();
        setCurrentStoryIsFriendsOnly(
          userCollege === 'None of the Above' ? true : isPrivate
        );
        
        // Route directly to home page
        router.replace('/(tabs)');
      } else {
        Alert.alert('Error', 'Failed to publish recording. Please try again.');
      }
    } catch (error) {
      console.error('Error in handleSave:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const pulseStyle = useAnimatedStyle(() => {
    return {
      opacity: pulseOpacity.value,
    };
  });

  const recordingDotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: recordingDotScale.value }],
  }));

  return (
    <SafeAreaView style={styles.container}>
      {!showDetails ? (
        <View style={styles.content}>
          <View style={styles.newPostHeader}>
            <View style={styles.microphoneIconContainer}>
              <Mic size={18} color="#000000" />
            </View>
            <Typography variant="h2" style={styles.newPostText}>
              new post
            </Typography>
          </View>
          <View style={styles.waveformContainer}>
            <TouchableOpacity
              style={[styles.infoButton, styles.infoButtonAboveHeadline]}
              onPress={() => setShowInfoModal(true)}
            >
              <View style={styles.infoIcon}>
                <View style={styles.infoIconCircle} />
                <View style={styles.infoIconDot} />
              </View>
              <Typography variant="body" style={styles.infoButtonText}>
                What should i talk about?
              </Typography>
            </TouchableOpacity>
            <Typography variant="h2" style={styles.headline}>
              {isTranscribing ? 'submitting...' : 'speak your mind.'}
            </Typography>
            <View style={styles.audioWaveform}>
              {[...Array(20)].map((_, i) => (
                <WaveBar key={i} index={i} isRecording={isRecording} />
              ))}
            </View>
          </View>

          <View style={styles.recordingControls}>
            <View style={styles.recordingInfo}>
              <Typography variant="bodySmall" style={styles.maxDurationLabel}>
                Max 45 seconds
              </Typography>
              <Typography variant="body" style={styles.timer}>
                {formatDuration(duration)}
              </Typography>
            </View>

            <TouchableOpacity
              style={styles.recordButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                if (isRecording) {
                  stopRecording();
                } else {
                  startRecording();
                }
              }}
            >
              <Animated.View style={[styles.pulse, pulseStyle]} />
              {isRecording ? (
                <>
                  <Animated.View
                    style={[styles.recordingDot, recordingDotStyle]}
                  />
                  {isTranscribing ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Send size={28} color="#FFFFFF" />
                  )}
                </>
              ) : (
                <Mic size={28} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {/* Details Modal - Full Screen */}
      <Modal
        visible={showDetails}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowDetails(false)}
      >
        <DetailsView
          duration={duration}
          title={title}
          setTitle={setTitle}
          onBack={() => setShowDetails(false)}
          onSave={handleSave}
          isSaving={isSaving}
          recordingUri={recordingUri.current}
          selectedTag={selectedTag}
          onTagChange={setSelectedTag}
          transcription={transcription}
          userCollege={userCollege}
          onRestart={resetRecordingState}
          userGroups={userGroups}
          selectedGroupId={selectedGroupId}
          onGroupChange={setSelectedGroupId}
          currentUserId={user?.id || ''}
          currentUserHasVoiceClone={currentUserHasVoiceClone}
        />
      </Modal>
      <SuccessModal
        visible={showSuccessModal}
        onClose={() => {
          console.log('🔍 Success modal onClose called');
          setShowSuccessModal(false);
          resetRecordingState();
          // setShowNotificationModal(true);
        }}
        router={router}
        userCollege={userCollege}
        selectedGroupId={selectedGroupId}
      />

      {/* Info Modal */}
      <Modal
        visible={showInfoModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowInfoModal(false)}
      >
        <View style={[styles.modalOverlay, { justifyContent: 'center' }]}>
          <View
            style={[
              styles.modalContent,
              {
                minHeight: 'auto',
                maxHeight: '80%',
                marginHorizontal: 20,
                borderRadius: 36,
              },
            ]}
          >
            <View style={[styles.modalHeader, { marginBottom: 16 }]}>
              <Typography
                variant="h2"
                style={[styles.modalTitle, { fontSize: 20 }]}
              >
                What should I talk about?
              </Typography>
              <TouchableOpacity
                style={[styles.closeButton, { width: 32, height: 32 }]}
                onPress={() => setShowInfoModal(false)}
              >
                <X size={20} color="#000" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.infoContent}>
              <Typography variant="body" style={styles.infoText}>
                {'😂  Share a funny story that happened today\n\n'}
                {'🎓  Talk about something you learned recently\n\n'}
                {'🌍  Share your thoughts on a current event\n\n'}
                {'💡  Give advice about something you are good at\n\n'}
                {'✨  Share a memory that makes you happy\n\n'}
                {'🎯  Talk about your goals and dreams'}
              </Typography>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* {showNotificationModal && (
        <Modal
          visible={showNotificationModal}
          transparent
          animationType="fade"
          onRequestClose={() => {
            setShowNotificationModal(false);
            if (userCollege === 'None of the Above') {
              router.replace('/(tabs)?feed=friends');
            } else {
              router.replace('/(tabs)');
            }
          }}
        >
          <View style={styles.successModalContainer}>
            <View style={styles.successModalContent}>
              <View style={styles.successIconContainer}>
                <Typography variant="h2">🔔</Typography>
              </View>
              <Typography variant="h2" style={styles.successTitle}>
                Get Notified
              </Typography>
              <Typography variant="body" style={styles.successMessage}>
                Would you like to be notified when someone reacts to your
                stories?
              </Typography>
              <View style={styles.notificationButtons}>
                <TouchableOpacity
                  style={[styles.successButton, { backgroundColor: '#FFEFB4' }]}
                  onPress={async () => {
                    // await showReactionNotificationModal();
                    await
                      async (token) => {
                        if (token) {
                          const {
                            data: { user },
                          } = await supabase.auth.getUser();
                          if (!user) return;

                          const { error: updateError } = await supabase
                            .from('profiles')
                            .update({ push_token: token })
                            .eq('id', user.id);

                          if (updateError) throw updateError;
                          const message = {
                            to: token,
                            sound: 'default',
                            title: 'Test Push Notification',
                            body: 'Push notifications are enabled',
                          };
                          const res = await fetch(
                            'https://exp.host/--/api/v2/push/send',
                            {
                              method: 'POST',
                              mode: 'no-cors',
                              headers: {
                                Accept: 'application/json',
                                'Accept-Encoding': 'gzip, deflate',
                                'Content-Type': 'application/json',
                              },
                              body: JSON.stringify(message),
                            }
                          );
                        }
                      }
                    );
                    setShowNotificationModal(false);
                    if (userCollege === 'None of the Above') {
                      router.replace('/(tabs)?feed=friends');
                    } else {
                      router.replace('/(tabs)');
                    }
                  }}
                >
                  <Typography variant="body" style={styles.successButtonText}>
                    Yes, notify me
                  </Typography>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ marginTop: 12 }}
                  onPress={() => {
                    setShowNotificationModal(false);
                    if (userCollege === 'None of the Above') {
                      router.replace('/(tabs)?feed=friends');
                    } else {
                      router.replace('/(tabs)');
                    }
                  }}
                >
                  <Typography variant="body" style={{ color: '#666666' }}>
                    Not now
                  </Typography>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )} */}
    </SafeAreaView>
  );
}

async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('myNotificationChannel', {
      name: 'A channel is needed for the permissions prompt to appear',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      alert('Failed to get push token for push notification!');
      return;
    }
    // Learn more about projectId:
    // https://docs.expo.dev/push-notifications/push-notifications-setup/#configure-projectid
    // EAS projectId is used here.
    try {
      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ??
        Constants?.easConfig?.projectId;
      if (!projectId) {
        throw new Error('Project ID not found');
      }
      token = (
        await Notifications.getExpoPushTokenAsync({
          projectId,
        })
      ).data;
      console.log(token);
    } catch (e) {
      token = `${e}`;
    }
  } else {
    alert('Must use physical device for Push Notifications');
  }

  return token;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  waveformContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    gap: 24,
    paddingTop: 0,
    paddingBottom: 0,
    position: 'absolute',
    top: '40%',
    left: 0,
    right: 0,
    transform: [{ translateY: -100 }],
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
  detailsContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    width: '100%',
  },
  detailsScrollView: {
    flex: 1,
  },
  detailsContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 40,
  },
  detailsTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 26,
    paddingTop: 60,
    paddingBottom: 10,
    backgroundColor: '#FFFFFF',
    zIndex: 10,
  },
  waveBar: {
    width: 3,
    borderRadius: 15.6257,
    shadowColor: 'rgba(253, 140, 255, 0.32)',
    shadowOffset: {
      width: 0,
      height: 3.12515,
    },
    shadowRadius: 1.56257,
  },
  recordingControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    position: 'absolute',
    bottom: 120,
    left: 36,
    right: 36,
    paddingBottom: 0,
  },
  recordingInfo: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingLabel: {
    fontFamily: 'Nunito-Bold',
    fontSize: 16,
    fontWeight: '700',
    color: '#1D1D1D',
  },
  timer: {
    fontFamily: 'Nunito-SemiBold',
    fontSize: 16,
    fontWeight: '600',
    color: '#8A8E8F',
  },
  recordButton: {
    width: 102,
    height: 78,
    backgroundColor: '#1D1D1D',
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 14,
  },
  pulse: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1D1D1D',
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
    backgroundColor: '#FF0000',
  },
  backButton: {
    width: 44,
    height: 44,
    backgroundColor: '#333A3C',
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  durationText: {
    marginLeft: 20,
    fontFamily: 'Nunito-SemiBold',
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  titleSection: {
    marginTop: 5,
    gap: 8,
    alignItems: 'center',
  },
  audioDurationContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  audioDurationText: {
    fontFamily: 'Nunito-SemiBold',
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    textAlign: 'center',
  },
  titleLabel: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    fontFamily: 'Nunito-Bold',
    textTransform: 'lowercase',
    marginBottom: 8,
    textAlign: 'center',
  },
  inputContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    height: 88,
    backgroundColor: '#FFFFFF',
    borderWidth: 0.5,
    borderColor: '#8A8E8F',
    borderRadius: 29,
  },
  titleInput: {
    flex: 1,
    fontSize: 24,
    fontFamily: 'Nunito-SemiBold',
    fontWeight: '600',
    color: '#000000',
    paddingHorizontal: 0,
    paddingVertical: 12,
    textAlignVertical: 'center',
    includeFontPadding: false,
    lineHeight: 36,
    marginRight: 4,
    maxWidth: '85%',
  },
  characterCount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8A8E8F',
    marginLeft: 0,
    fontFamily: 'Nunito-Regular',
    minWidth: 25,
    textAlign: 'right',
    flexShrink: 0,
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
  optionsSection: {
    marginTop: 20,
    gap: 20,
  },
  optionBox: {
    width: '100%',
    backgroundColor: '#F6F6F6',
    borderRadius: 48,
    padding: 22,
    paddingHorizontal: 16,
    gap: 8,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 61,
  },
  optionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  optionText: {
    fontFamily: 'Nunito-Bold',
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
    textAlign: 'left',
    flex: 1,
  },
  optionButton: {
    width: 70,
    height: 61,
    backgroundColor: '#E4E4E4',
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  plusIcon: {
    fontSize: 28,
    color: '#000000',
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
    lineHeight: 32,
    height: 32,
  },
  checkbox: {
    width: 14,
    height: 14,
    borderWidth: 1.6,
    borderColor: '#000000',
    borderRadius: 2.5,
  },
  postButton: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingHorizontal: 32,
    gap: 8,
    minWidth: 280,
    height: 70,
    backgroundColor: '#1D1D1D',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 38,
    marginTop: 16,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.24,
    shadowRadius: 24,
    elevation: 8,
  },
  postText: {
    fontFamily: 'Nunito-Bold',
    fontStyle: 'normal',
    fontWeight: '700',
    fontSize: 20,
    lineHeight: 22,
    color: '#FFFFFF',
    textAlign: 'center',
    flex: 1,
    marginRight: 8,
    minWidth: 0,
  },
  sendIconContainer: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navArrow: {
    width: 20,
    height: 20,
    tintColor: '#FFFB00',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    padding: 24,
    minHeight: '50%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    fontFamily: 'Nunito-Bold',
    textTransform: 'lowercase',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E4E4E4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tagsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  tagItem: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
    paddingHorizontal: 16,
    gap: 8,
    minWidth: 100,
    height: 40,
    backgroundColor: '#FAF2E0',
    borderRadius: 26,
    flexShrink: 0,
    position: 'relative',
  },
  tagItemSelected: {
    backgroundColor: '#000000',
  },
  tagText: {
    fontFamily: 'Nunito-Bold',
    fontStyle: 'normal',
    fontWeight: '700',
    fontSize: 14,
    lineHeight: 18,
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
  tagTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
    lineHeight: 18,
  },
  saveTagsButton: {
    backgroundColor: '#000000',
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 'auto',
  },
  saveTagsText: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Nunito-Bold',
    color: '#FFFFFF',
  },
  optionButtonSelected: {
    backgroundColor: '#FFEFB4',
  },
  checkboxSelected: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  successModalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 20,
  },
  successModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 36,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 327,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.24,
    shadowRadius: 24,
    elevation: 8,
  },
  successIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFEFB4',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
    fontFamily: 'Nunito-Bold',
    marginBottom: 8,
  },
  successMessage: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8A8E8F',
    fontFamily: 'Nunito-SemiBold',
    marginBottom: 24,
    textAlign: 'center',
  },
  successButton: {
    backgroundColor: '#1D1D1D',
    borderRadius: 29,
    paddingVertical: 16,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.24,
    shadowRadius: 24,
    elevation: 8,
  },
  successButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'Nunito-Regular',
  },
  categoryTag: {
    backgroundColor: '#FF9B71',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    height: 32,
  },
  categoryTagText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Nunito-Regular',
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
  },
  transcriptionButton: {
    marginTop: 20,
    backgroundColor: '#FAF2E0',
    borderRadius: 25,
    alignSelf: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    paddingLeft: 12,
    gap: 6,
    width: 180,
    height: 36,
  },
  transcriptionButtonText: {
    fontFamily: 'Nunito-SemiBold',
    fontStyle: 'normal',
    fontWeight: '600',
    fontSize: 13,
    lineHeight: 18,
    color: '#9B5602',
  },
  transcriptionScroll: {
    maxHeight: '80%',
  },
  transcriptionText: {
    fontSize: 16,
    color: '#000000',
    lineHeight: 24,
  },
  headline: {
    fontFamily: 'Nunito-Bold',
    fontSize: 30,
    fontWeight: '700',
    color: '#000000',
    textAlign: 'center',
    textTransform: 'lowercase',
    marginBottom: 16,
    lineHeight: 33,
  },
  maxDurationLabel: {
    color: '#8A8E8F',
    fontSize: 13,
    fontFamily: 'Nunito-Regular',
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 2,
  },
  optionButtonRequired: {
    backgroundColor: '#E4E4E4',
  },
  modalSubtitle: {
    color: '#8A8E8F',
    fontSize: 16,
    fontFamily: 'Nunito-SemiBold',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 24,
  },
  notificationButtons: {
    width: '100%',
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#FF9B71',
  },
  secondaryButton: {
    backgroundColor: '#FFE4E4',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
    fontFamily: 'Nunito-Regular',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    right: 20,
    zIndex: 1,
    paddingTop: 60,
  },
  infoButton: {
    backgroundColor: '#FAF2E0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 25,
    width: 240,
    height: 32,
    alignSelf: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  infoButtonAboveHeadline: {
    marginBottom: 0,
    alignSelf: 'center',
    marginTop: 0,
  },
  newPostHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    padding: 8,
    gap: 8,
    width: 200,
    height: 56,
    position: 'absolute',
    top: 20,
    left: 20,
    zIndex: 1,
  },
  microphoneIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 0,
    gap: 4,
    width: 32,
    height: 32,
    justifyContent: 'center',
    backgroundColor: '#FFE8BA',
    borderWidth: 0.928572,
    borderColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 3.71429,
    },
    shadowOpacity: 0.2,
    shadowRadius: 14.8571,
    elevation: 3,
  },
  microphoneIcon: {
    width: 13.71,
    height: 13.71,
    position: 'relative',
  },
  microphoneBase: {
    position: 'absolute',
    left: '25%',
    right: '25%',
    top: '8.33%',
    bottom: '20.83%',
    backgroundColor: '#000000',
    borderWidth: 0.857143,
    borderColor: '#000000',
    width: '50%',
    height: '70.84%',
  },
  microphoneTop: {
    position: 'absolute',
    left: '41.67%',
    right: '41.67%',
    top: '25%',
    bottom: '72.92%',
    borderWidth: 0.857143,
    borderColor: '#FFFFFF',
    width: '16.66%',
    height: '47.92%',
  },
  microphoneMiddle: {
    position: 'absolute',
    left: '41.67%',
    right: '41.67%',
    top: '37.5%',
    bottom: '60.42%',
    borderWidth: 0.857143,
    borderColor: '#FFFFFF',
    width: '16.66%',
    height: '22.92%',
  },
  microphoneBottom: {
    position: 'absolute',
    left: '12.5%',
    right: '12.5%',
    top: '45.83%',
    bottom: '8.33%',
    borderWidth: 0.857143,
    borderColor: '#000000',
    width: '75%',
    height: '45.84%',
  },
  newPostText: {
    fontFamily: 'Nunito-Bold',
    fontStyle: 'normal',
    fontWeight: '700',
    fontSize: 24,
    lineHeight: 33,
    color: '#000405',
    flex: 1,
    textAlign: 'left',
  },
  infoIcon: {
    width: 16,
    height: 16,
    position: 'relative',
  },
  infoIconCircle: {
    position: 'absolute',
    left: '8.33%',
    right: '8.33%',
    top: '8.33%',
    bottom: '8.33%',
    opacity: 0.5,
    borderWidth: 0.875,
    borderColor: '#9B5602',
    borderRadius: 7,
  },
  infoIconDot: {
    position: 'absolute',
    left: '45.83%',
    right: '45.83%',
    top: '29.17%',
    bottom: '62.5%',
    backgroundColor: '#9B5602',
    width: 1.75,
    height: 4.67,
  },
  infoButtonText: {
    color: '#9B5602',
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Nunito-Regular',
    lineHeight: 18,
    flex: 1,
    textAlign: 'center',
  },
  infoContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  infoText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#000000',
    marginTop: 8,
  },
  noGroupsContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
  noGroupsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8A8E8F',
    fontFamily: 'Nunito-SemiBold',
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  disabledPostButton: {
    backgroundColor: '#E4E4E4',
    opacity: 0.6,
  },
  disabledPostText: {
    color: '#8A8E8F',
  },
  voicePreviewContainer: {
    marginTop: 12,
    marginBottom: 8,
    alignItems: 'center',
  },
  generatingContainer: {
    backgroundColor: '#FFF3E0',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  generatingText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E65100',
    fontFamily: 'Nunito-SemiBold',
  },
  previewReadyContainer: {
    backgroundColor: '#E8F5E9',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  previewReadyText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2E7D32',
    fontFamily: 'Nunito-SemiBold',
    flex: 1,
  },
});