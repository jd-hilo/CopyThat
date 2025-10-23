import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Typography } from '@/components/ui/Typography';
import { Check, Mic } from 'lucide-react-native';
import { Audio } from 'expo-av';

interface GroupMember {
  id: string;
  username: string;
  avatar_url: string | null;
  voice_clone_id: string | null;
  voice_clone_status: string | null;
}

interface VoiceSelectorProps {
  groupMembers: GroupMember[];
  selectedVoiceUserId: string | null;
  currentUserId: string;
  onSelectVoice: (userId: string | null, voiceId: string | null) => void;
}

export function VoiceSelector({
  groupMembers,
  selectedVoiceUserId,
  currentUserId,
  onSelectVoice,
}: VoiceSelectorProps) {
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);

  // Filter members who have voice clones ready
  const membersWithVoices = groupMembers.filter(
    (member) => member.voice_clone_status === 'ready' && member.voice_clone_id
  );

  // Debug logging
  console.log('VoiceSelector - All members:', groupMembers.length);
  console.log('VoiceSelector - Members with voices:', membersWithVoices.length);
  console.log('VoiceSelector - First member:', groupMembers[0]);
  console.log('VoiceSelector - Members with voices details:', membersWithVoices.map(m => ({
    id: m.id,
    username: m.username,
    voice_clone_id: m.voice_clone_id,
    voice_clone_status: m.voice_clone_status
  })));

  // Add current user's own voice as an option
  const currentUser = groupMembers.find((m) => m.id === currentUserId);

  const handleSelectVoice = (userId: string | null, voiceId: string | null) => {
    console.log('VoiceSelector - handleSelectVoice called:', { userId, voiceId });
    onSelectVoice(userId, voiceId);
  };

  // Note: Voice preview would require storing sample audio
  // For now, we'll just show the selection UI
  const handlePreviewVoice = async (voiceId: string) => {
    // This would play a sample of the cloned voice
    // Implementation would require a sample audio file
    console.log('Preview voice:', voiceId);
  };

  if (membersWithVoices.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Typography variant="body" style={styles.emptyText}>
          No group members have recorded their voice yet. Be the first!
        </Typography>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Typography variant="h3" style={styles.cardTitle}>
          🎭 use a member's voice
        </Typography>
        <Typography variant="body" style={styles.cardSubtitle}>
          select whose voice you want to sound like
        </Typography>
        
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Own Voice Option */}
          <TouchableOpacity
            style={[
              styles.voiceCard,
              selectedVoiceUserId === null && styles.voiceCardSelected,
            ]}
            onPress={() => handleSelectVoice(null, null)}
          >
            <View style={styles.avatarContainer}>
              <Image
                source={{
                  uri:
                    currentUser?.avatar_url ||
                    'https://dqthkfmvvedzyowhyeyd.supabase.co/storage/v1/object/public/avatars/default.png',
                }}
                style={styles.avatar}
              />
              {selectedVoiceUserId === null && (
                <View style={styles.selectedBadge}>
                  <Check size={12} color="#FFF" />
                </View>
              )}
            </View>
            <Typography variant="bodySmall" style={styles.username}>
              Your Voice
            </Typography>
          </TouchableOpacity>

          {/* Group Members' Voices */}
          {membersWithVoices.map((member) => (
            <TouchableOpacity
              key={member.id}
              style={[
                styles.voiceCard,
                selectedVoiceUserId === member.id && styles.voiceCardSelected,
              ]}
              onPress={() =>
                handleSelectVoice(member.id, member.voice_clone_id)
              }
            >
              <View style={styles.avatarContainer}>
                <Image
                  source={{
                    uri:
                      member.avatar_url ||
                      'https://dqthkfmvvedzyowhyeyd.supabase.co/storage/v1/object/public/avatars/default.png',
                  }}
                  style={styles.avatar}
                />
                {selectedVoiceUserId === member.id && (
                  <View style={styles.selectedBadge}>
                    <Check size={12} color="#FFF" />
                  </View>
                )}
                <View style={styles.voiceIconBadge}>
                  <Mic size={10} color="#FFF" />
                </View>
              </View>
              <Typography variant="bodySmall" style={styles.username}>
                {member.username}
              </Typography>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
    paddingHorizontal: 0,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 36,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.24,
    shadowRadius: 24,
    elevation: 8,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    fontFamily: 'Nunito-Bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  cardSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8A8E8F',
    fontFamily: 'Nunito-SemiBold',
    marginBottom: 20,
    textAlign: 'center',
  },
  scrollContent: {
    paddingHorizontal: 4,
    paddingVertical: 8,
    gap: 16,
  },
  voiceCard: {
    alignItems: 'center',
    padding: 12,
    borderRadius: 20,
    backgroundColor: '#F8F9FA',
    borderWidth: 3,
    borderColor: 'transparent',
    minWidth: 90,
  },
  voiceCardSelected: {
    backgroundColor: '#FFEFB4',
    borderColor: '#FFD700',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 8,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E0E0E0',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  selectedBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  voiceIconBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FF9B71',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  username: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000',
    textAlign: 'center',
    fontFamily: 'Nunito-Bold',
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});

