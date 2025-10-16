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
const images = [
  require('../assets/images/Frame 1 HMO.png'),
  require('../assets/images/Frame 2 HMO.png'),
  require('../assets/images/Frame 4 HMO.png'),
  require('../assets/images/Frame 3 HMO.png'),
];

const slideTexts = [
  'welcome to the show 👋',
  "say what you're thinking",
  'join your campus circle',
  'join groups with friends',
];

export default function WelcomeScreen() {
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const { user, userProfile, setUserProfile, setUser } = useAuth();
  // Handle scroll end to create infinite effect
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const currentIndex = Math.round(contentOffsetX / screenWidth);

    if (currentIndex === images.length) {
      // When we reach the last image (which is a duplicate of the first),
      // quickly scroll back to the first image without animation
      scrollViewRef.current?.scrollTo({ x: 0, animated: false });
      setCurrentSlide(0);
    } else if (currentIndex === -1) {
      // When scrolling left from the first image
      scrollViewRef.current?.scrollTo({
        x: (images.length - 1) * screenWidth,
        animated: false,
      });
      setCurrentSlide(images.length - 1);
    } else {
      setCurrentSlide(currentIndex);
    }
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
        setTimeout(() => {
          setIsLoading(false);
        }, 1000);
      } else {
        setTimeout(() => {
          setIsLoading(false);
        }, 1000);
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

  // if (isLoading) {
  //   return (
  //     <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
  //       <SpinningHeadphone size={32} />
  //     </View>
  //   );
  // }
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
          {[...images, images[0]].map((image, index) => (
            <Image
              key={index}
              source={image}
              style={[
                styles.slideImage,
                index === 1
                  ? { marginLeft: 5 }
                  : index === 2
                  ? { marginLeft: 5 }
                  : null,
              ]}
            />
          ))}
        </ScrollView>

        {/* Progress bar */}
        <View style={styles.progressBarContainer}>
          {images.map((_, index) => (
            <View
              key={index}
              style={[
                styles.progressDot,
                index === currentSlide ? styles.activeDot : styles.inactiveDot,
              ]}
            />
          ))}
        </View>

        {/* Slide text display */}
        <View style={styles.slideTextContainer}>
          <Typography variant="h3" style={styles.slideText}>
            {slideTexts[currentSlide]}
          </Typography>
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
  slideTextContainer: {
    alignItems: 'center',
    paddingHorizontal: 24,
    marginTop: 16,
    marginBottom: 32,
  },
  slideText: {
    fontSize: 20,
    color: '#000000',
    textAlign: 'center',
    fontFamily: 'Nunito-Bold',
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
  slideImage: {
    width: screenWidth,
    height: '100%',
    resizeMode: 'contain',
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
