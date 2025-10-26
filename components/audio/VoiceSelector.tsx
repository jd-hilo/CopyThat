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

  // Add current user's own voice as an option
  const currentUser = groupMembers.find((m) => m.id === currentUserId);

  // Filter OTHER members (not current user) who have voice clones ready
  const otherMembersWithVoices = groupMembers.filter(
    (member) => 
      member.id !== currentUserId && 
      member.voice_clone_status === 'ready' && 
      member.voice_clone_id
  );

  // Debug logging
  console.log('VoiceSelector - All members:', groupMembers.length);
  console.log('VoiceSelector - Current user:', currentUser?.username);
  console.log('VoiceSelector - Other members with voices:', otherMembersWithVoices.length);
  console.log('VoiceSelector - Other members details:', otherMembersWithVoices.map(m => ({
    id: m.id,
    username: m.username,
    voice_clone_id: m.voice_clone_id,
    voice_clone_status: m.voice_clone_status
  })));

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

  // Always show the voice selector (at minimum "Your Voice" will be shown)

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

          {/* Other Group Members' Voices */}
          {otherMembersWithVoices.map((member) => (
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
    paddingBottom: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
    fontFamily: 'Nunito-Bold',
    marginBottom: 4,
    textAlign: 'center',
  },
  cardSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8A8E8F',
    fontFamily: 'Nunito-SemiBold',
    marginBottom: 12,
    textAlign: 'center',
  },
  scrollContent: {
    paddingHorizontal: 4,
    paddingVertical: 4,
    gap: 12,
  },
  voiceCard: {
    alignItems: 'center',
    padding: 8,
    borderRadius: 16,
    backgroundColor: '#F8F9FA',
    borderWidth: 2,
    borderColor: 'transparent',
    minWidth: 75,
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
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E0E0E0',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  selectedBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFF',
  },
  voiceIconBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FF9B71',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFF',
  },
  username: {
    fontSize: 11,
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

