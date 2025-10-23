import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Typography } from '@/components/ui';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { VoiceCloningModal } from '@/components/audio/VoiceCloningModal';
import { supabase } from '@/lib/supabase';

export default function OnboardingMicScreen() {
  const [showModal, setShowModal] = useState(true);
  const [userId, setUserId] = useState<string>('');
  const [username, setUsername] = useState<string>('');

  useEffect(() => {
    const getUserInfo = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        const { data: profile } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', user.id)
          .single();
        if (profile) {
          setUsername(profile.username);
        }
      }
    };
    getUserInfo();
  }, []);

  const handleSuccess = (voiceId: string) => {
    console.log('Voice clone created:', voiceId);
    setShowModal(false);
    router.push('/onboarding-notifications');
  };

  const handleClose = () => {
    setShowModal(false);
    router.push('/onboarding-notifications');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.textContainer}>
          <Typography variant="h2" style={styles.title}>
            record your voice 🎤
          </Typography>
          <Typography variant="body" style={styles.subtitle}>
            clone your voice to use in the app
          </Typography>
        </View>

        {userId && username && (
          <VoiceCloningModal
            visible={showModal}
            onClose={handleClose}
            userId={userId}
            username={username}
            onSuccess={handleSuccess}
          />
        )}

        <TouchableOpacity style={styles.skipButton} onPress={handleClose}>
          <Typography variant="body" style={styles.skipButtonText}>
            skip for now
          </Typography>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  textContainer: {
    marginBottom: 40,
    width: '100%',
    alignItems: 'center',
  },
  title: {
    fontFamily: 'Nunito-Bold',
    fontWeight: '700',
    fontSize: 28,
    textAlign: 'center',
    color: '#333A3C',
    marginBottom: 12,
    textTransform: 'lowercase',
  },
  subtitle: {
    fontFamily: 'Nunito',
    fontSize: 16,
    textAlign: 'center',
    color: '#8A8E8F',
    textTransform: 'lowercase',
  },
  skipButton: {
    position: 'absolute',
    bottom: 40,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  skipButtonText: {
    fontSize: 16,
    fontFamily: 'Nunito',
    color: '#8A8E8F',
    textAlign: 'center',
    textTransform: 'lowercase',
  },
}); 