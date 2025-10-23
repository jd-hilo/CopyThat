import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Dimensions,
  Platform,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Animated,
} from 'react-native';
import { Typography } from '@/components/ui/Typography';
import { SpinningHeadphone } from '@/components/ui/SpinningHeadphone';
import { Redirect, useRouter } from 'expo-router';
import * as TrackingTransparency from 'expo-tracking-transparency';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/authContext';
import { WaveBar } from '@/components/audio/WaveBar';
// jd@sull.com

// test1234
const { width: screenWidth } = Dimensions.get('window');

const slides = [
  {
    step: 'step 1',
    title: 'clone your voice',
    icon: '🎤',
    description: 'record your unique voice to use in the app',
    type: 'voice' as const,
  },
  {
    step: 'step 2',
    title: 'invite your friends',
    icon: '👥',
    description: 'share thoughts with your closest circle',
    type: 'groups' as const,
  },
  {
    step: 'step 3',
    title: 'copy voices and talk!',
    icon: '🎧',
    description: 'start sharing your hear me out moments',
    type: 'story' as const,
  },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const { user, userProfile, setUserProfile, setUser } = useAuth();
  // Handle scroll to update current slide indicator
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const currentIndex = Math.round(contentOffsetX / screenWidth);
    setCurrentSlide(Math.max(0, Math.min(currentIndex, slides.length - 1)));
  };
  const handleContinue = async () => {
    if (Platform.OS === 'ios') {
      const { status } =
        await TrackingTransparency.getTrackingPermissionsAsync();
      if (status !== 'granted') {
        await TrackingTransparency.requestTrackingPermissionsAsync();
      }
    }
    router.push('/(auth)/sign-up');
  };

  // orbital animations
  const orbitRotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(orbitRotation, {
        toValue: 1,
        duration: 12000,
        useNativeDriver: true,
      })
    ).start();
  }, [orbitRotation]);

  // Create 8 orbiting elements evenly spaced
  const orbitAngles = [0, 45, 90, 135, 180, 225, 270, 315];
  const emojis = ['🎤', '🎧', '🎵', '🎶', '💬', '🗣️', '👂', '🔊'];
  
  const rotations = orbitAngles.map((angle) =>
    orbitRotation.interpolate({
      inputRange: [0, 1],
      outputRange: [`${angle}deg`, `${angle + 360}deg`],
      extrapolate: 'extend',
    })
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.heroContainer}>
        <View style={styles.logoWrapper}>
          <Image source={require('../assets/images/logo.png')} style={styles.heroLogo} />

          {/* orbiting emojis */}
          {emojis.map((emoji, index) => (
            <Animated.View
              key={index}
              style={[styles.orbitContainer, { transform: [{ rotate: rotations[index] }] }]}
              pointerEvents="none"
            >
              <View style={styles.orbitItem}>
                <Typography variant="h1" style={styles.emoji}>
                  {emoji}
                </Typography>
              </View>
            </Animated.View>
          ))}
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.bottomContainer}>
          <View style={styles.buttonWrapper}>
            <TouchableOpacity style={styles.button} onPress={handleContinue}>
              <Typography variant="bodyBold" style={styles.buttonText}>
                continue →
              </Typography>
            </TouchableOpacity>

            <View style={styles.termsContainer}>
              <Typography variant="body" style={styles.termsText}>
                by clicking continue you agree to our{' '}
              </Typography>
              <TouchableOpacity
                onPress={() => {
                  router.push(
                    'https://pastoral-supply-662.notion.site/Terms-of-Service-Hear-Me-Out-1eb2cec59ddf804186a0dbb600cd822a?source=copy_link'
                  );
                }}
              >
                <Typography variant="body" style={styles.termsLink}>
                  terms
                </Typography>
              </TouchableOpacity>
            </View>
          </View>
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
  slideshowContainer: {
    height: '60%',
    marginTop: '10%',
  },
  heroContainer: {
    height: '60%',
    marginTop: '6%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrapper: {
    width: screenWidth * 0.5,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroLogo: {
    width: screenWidth * 1.1,
    height: screenWidth * 0.46,
    resizeMode: 'contain',
  },
  orbitContainer: {
    position: 'absolute',
    width: '50%',
    height: '50%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbitItem: {
    position: 'absolute',
    top: -120,
  },
  emoji: {
    fontSize: 28,
    lineHeight: 32,
  },
  progressBarContainer: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 0,
    gap: 7,
    width: 55,
    height: 10,
    marginTop: 16,
    alignSelf: 'center',
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  activeDot: {
    backgroundColor: '#FFE8BA',
    width: 10,
    height: 10,
  },
  inactiveDot: {
    backgroundColor: '#FAF2E0',
    width: 8,
    height: 8,
    opacity: 0.5,
  },
  scrollView: {
    width: screenWidth,
  },
  scrollViewContent: {
    alignItems: 'center',
  },
  slideContainer: {
    width: screenWidth,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  slideContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLabel: {
    fontSize: 14,
    color: '#8A8E8F',
    textAlign: 'center',
    fontFamily: 'Nunito-SemiBold',
    textTransform: 'lowercase',
    marginBottom: 16,
  },
  slideIcon: {
    fontSize: 80,
    textAlign: 'center',
    marginBottom: 24,
  },
  slideTitle: {
    fontSize: 32,
    color: '#333A3C',
    textAlign: 'center',
    fontFamily: 'Nunito-Bold',
    fontWeight: '700',
    textTransform: 'lowercase',
    marginBottom: 12,
  },
  slideDescription: {
    fontSize: 16,
    color: '#8A8E8F',
    textAlign: 'center',
    fontFamily: 'Nunito',
    textTransform: 'lowercase',
    lineHeight: 24,
  },
  voicePreview: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  waveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
  },
  groupPreview: {
    marginTop: 8,
    marginBottom: 8,
    alignItems: 'center',
    gap: 8,
  },
  groupPill: {
    backgroundColor: '#F0F0F0',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  groupPillText: {
    color: '#333A3C',
    fontFamily: 'Nunito',
  },
  groupPillSecondary: {
    backgroundColor: '#FFEFB4',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  groupPillSecondaryText: {
    color: '#000',
    fontFamily: 'Nunito',
    fontWeight: '700',
  },
  storyPreview: {
    marginTop: 8,
    marginBottom: 8,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end', // Align content to the bottom
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  bottomContainer: {
    width: '100%',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24, // Space between logo and button
  },
  logo: {
    width: 200,
    height: 80,
    resizeMode: 'contain',
  },
  subtitle: {
    fontSize: 16,
    color: '#8A8E8F',
    marginTop: 8,
  },
  buttonWrapper: {
    width: '100%',
    alignItems: 'center',
  },
  button: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.24,
    shadowRadius: 24,
    elevation: 8,
    marginBottom: 24,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontFamily: 'Nunito-Bold',
    fontWeight: '700',
    lineHeight: 22,
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
    marginTop: 0,
  },
  footerTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerText: {
    fontSize: 16,
    color: '#000000',
  },
  footerLink: {
    fontSize: 16,
    color: '#FFA500', // Orange color for the link
    fontWeight: 'bold',
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  termsText: {
    fontSize: 14,
    color: '#8A8E8F',
  },
  termsLink: {
    fontSize: 14,
    color: '#FFA500',
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
});
