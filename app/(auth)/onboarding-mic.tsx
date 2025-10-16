import React from 'react';
import { View, StyleSheet, Pressable, Platform } from 'react-native';
import { Typography } from '@/components/ui';
import { router } from 'expo-router';
import { Audio } from 'expo-av';
import { SafeAreaView } from 'react-native-safe-area-context';
import { trackPermissionsGranted } from '../_layout';

export default function OnboardingMicScreen() {
  const handleMockAllow = async () => {
    try {
      // Configure audio mode first
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      // Create a temporary recording to force permission prompt
      const recording = new Audio.Recording();
      try {
        await recording.prepareToRecordAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY
        );
        await recording.stopAndUnloadAsync();
      } catch (error) {
        // Expected error when permissions aren't granted
      }

      // Now request permissions explicitly
      const { status } = await Audio.requestPermissionsAsync();
      if (status === 'granted') {
        trackPermissionsGranted();
      }
      router.push('/onboarding-notifications');
    } catch (error) {
      console.error('Error requesting microphone permission:', error);
      router.push('/onboarding-notifications');
    }
  };

  const handleSkip = () => {
    router.push('/onboarding-notifications');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.textContainer}>
          <Typography variant="h3" style={styles.title}>
            microphone access?
          </Typography>
          <Typography variant="h2" style={styles.subtitle}>
            our app will suck{'\n'}without it.
          </Typography>
        </View>

        {/* Mock Permission UI */}
        <View style={styles.mockPopover}>
          <View style={styles.mockTop}>
            <View style={styles.mockContent}>
              <Typography variant="h3" style={styles.mockTitle}>
                "Hear Me Out" Would Like to Access Your Microphone
              </Typography>
              <Typography variant="body" style={styles.mockDescription}>
                We need access to your mic so you can speak your mind and share your voice with friends.
              </Typography>
            </View>
          </View>
          <View style={styles.mockBottomAction}>
            <Pressable style={styles.mockAction} onPress={handleSkip}>
              <Typography variant="body" style={styles.mockActionLabel}>Don't Allow</Typography>
            </Pressable>
            <View style={styles.mockSeparatorVertical} />
            <Pressable style={styles.mockAction} onPress={handleMockAllow}>
              <Typography variant="bodyBold" style={[styles.mockActionLabel, styles.mockActionLabelBold]}>Continue</Typography>
            </Pressable>
          </View>
          <View style={styles.mockSeparatorHorizontal} />
        </View>
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
    paddingHorizontal: 20,
    position: 'relative',
  },
  textContainer: {
    marginTop: 60,
    width: '100%',
    alignItems: 'center',
  },
  title: {
    fontFamily: 'Nunito',
    fontWeight: '800',
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
    color: '#007AFF',
    marginBottom: 12,
  },
  subtitle: {
    fontFamily: 'Nunito',
    fontWeight: '700',
    fontSize: 26,
    lineHeight: 35,
    textAlign: 'center',
    color: '#000000',
  },
  mockPopover: {
    width: 270,
    height: 220,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
    position: 'absolute',
    top: '40%',
    alignSelf: 'center',
  },
  mockTop: {
    height: 176,
    padding: 20,
    paddingHorizontal: 16,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  },
  mockContent: {
    gap: 2,
    alignItems: 'center',
  },
  mockTitle: {
    width: 238,
    fontFamily: 'Nunito',
    fontSize: 17,
    lineHeight: 22,
    textAlign: 'center',
    letterSpacing: -0.408,
    color: '#000000',
    fontWeight: '700',
  },
  mockDescription: {
    width: 238,
    fontFamily: 'Nunito',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    letterSpacing: -0.078,
    color: '#000000',
    fontWeight: '400',
    marginTop: 2,
  },
  mockBottomAction: {
    flexDirection: 'row',
    height: 44,
    alignItems: 'center',
  },
  mockAction: {
    flex: 1,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mockActionLabel: {
    fontFamily: 'SF Pro Text',
    fontSize: 17,
    lineHeight: 22,
    textAlign: 'center',
    letterSpacing: -0.408,
    color: '#007AFF',
  },
  mockActionLabelBold: {
    fontWeight: '600',
  },
  mockSeparatorHorizontal: {
    height: 0.5,
    backgroundColor: 'rgba(0, 0, 0, 0.24)',
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 44,
  },
  mockSeparatorVertical: {
    width: 0.5,
    height: 44,
    backgroundColor: 'rgba(0, 0, 0, 0.24)',
  },
}); 