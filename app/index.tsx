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
} from 'react-native';
import { Typography } from '@/components/ui/Typography';
import { SpinningHeadphone } from '@/components/ui/SpinningHeadphone';
import { Redirect, useRouter } from 'expo-router';
import * as TrackingTransparency from 'expo-tracking-transparency';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/authContext';
// jd@sull.com

// test1234
const { width: screenWidth } = Dimensions.get('window');

const slides = [
  {
    step: 'step 1',
    title: 'clone your voice',
    icon: '🎤',
    description: 'record your unique voice to use in the app',
  },
  {
    step: 'step 2',
    title: 'invite your friends',
    icon: '👥',
    description: 'share thoughts with your closest circle',
  },
  {
    step: 'step 3',
    title: 'copy voices and talk!',
    icon: '🎧',
    description: 'start sharing your hear me out moments',
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

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        // Fetch the user's profile
        supabase
          .from('profiles')
          .select('username, college')
          .eq('id', session.user.id)
          .single()
          .then(({ data: profile }) => {
            setUser(session.user);
            if (profile && profile.username && profile.college) {
              setUserProfile(profile);
              //router.replace('/(tabs)');
            } else {
              // Stay on the sign-up flow (do not navigate)
              // Optionally, you could route to the sign-up page if not already there
            }
          });
        setIsLoading(false);
      } else {
        setIsLoading(false);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {});

    return () => {
      subscription.unsubscribe();
    };
  }, []);
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

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <SpinningHeadphone size={32} />
      </View>
    );
  }
  
  if (user) {
    return <Redirect href={'/(tabs)'} />;
  }

  return <Redirect href={'/auth'} />;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.slideshowContainer}>
        <ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollViewContent}
          onMomentumScrollEnd={handleScroll}
          decelerationRate="fast"
        >
          {slides.map((slide, index) => (
            <View key={index} style={styles.slideContainer}>
              <View style={styles.slideContent}>
                <Typography variant="body" style={styles.stepLabel}>
                  {slide.step}
                </Typography>
                <Typography variant="h1" style={styles.slideIcon}>
                  {slide.icon}
                </Typography>
                <Typography variant="h2" style={styles.slideTitle}>
                  {slide.title}
                </Typography>
                <Typography variant="body" style={styles.slideDescription}>
                  {slide.description}
                </Typography>
              </View>
            </View>
          ))}
        </ScrollView>

        {/* Progress bar */}
        <View style={styles.progressBarContainer}>
          {slides.map((_, index) => (
            <View
              key={index}
              style={[
                styles.progressDot,
                index === currentSlide ? styles.activeDot : styles.inactiveDot,
              ]}
            />
          ))}
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.bottomContainer}>
          <View style={styles.logoContainer}>
            <Image
              source={require('../assets/images/logo.png')}
              style={styles.logo}
            />
          </View>

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
    flex: 'none',
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
