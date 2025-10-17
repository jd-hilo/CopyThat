import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Typography } from '@/components/ui';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function OnboardingNotificationsScreen() {
  const handleMockAllow = async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status === 'granted') {
        // Permission granted
      }
      router.push('/onboarding-friends');
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      router.push('/onboarding-friends');
    }
  };

  const handleSkip = () => {
    router.push('/onboarding-friends');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.textContainer}>
          <Typography variant="h3" style={styles.title}>
            notification access?
          </Typography>
          <Typography variant="h2" style={styles.subtitle}>
            just to keep you{'\n'}in the loop!
          </Typography>
        </View>

        {/* Mock Permission UI */}
        <View style={styles.mockPopover}>
          <View style={styles.mockTop}>
            <View style={styles.mockContent}>
              <Typography variant="h3" style={styles.mockTitle}>
                "Hear Me Out Copy" Would Like to Send You Notifications
              </Typography>
              <Typography variant="body" style={styles.mockDescription}>
                Notifications may include alerts, sounds, and icon badges. These can be configured in Settings.
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
    color: '#FFA500',
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