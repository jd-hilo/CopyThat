import React from 'react';
import { useEffect, useState } from 'react';
import { Stack, usePathname, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { SplashScreen } from 'expo-router';
import { theme } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { Tabs } from 'expo-router';
import { Home, Mic, User } from 'lucide-react-native';
import { Session } from '@supabase/supabase-js';
import * as TrackingTransparency from 'expo-tracking-transparency';
import {
  AudioPlaybackProvider,
  useAudioPlayback,
} from '@/lib/AudioPlaybackContext';
// import { Adjust, AdjustConfig, AdjustEvent } from 'react-native-adjust';
import { Platform, Text, View } from 'react-native';
import { MenuProvider } from 'react-native-popup-menu';
import { configureNotifications } from '@/lib/notifications';
import { posthog } from '../posthog';
import { AuthProvider } from '@/contexts/authContext';
import { Mixpanel } from 'mixpanel-react-native';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: 'https://4eb954acf463a58e6365c9eaf09007ef@o4510251294588928.ingest.us.sentry.io/4510251319164929',

  // Adds more context data to events (IP address, cookies, user, etc.)
  // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
  sendDefaultPii: true,

  // Enable Logs
  enableLogs: true,
  integrations: [Sentry.feedbackIntegration()],

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: __DEV__,
});
const trackAutomaticEvents = false;
const useNative = false;
export const mixpanel = new Mixpanel(
  'acb206fd2279b464f39a2d6827ea6b9c',
  trackAutomaticEvents,
  useNative
);
mixpanel.init();
const adjustAppToken = '9obru9zeai2o';

SplashScreen.preventAutoHideAsync();

// Adjust event tracking functions - temporarily disabled to prevent crashes
// export const trackLetsGoClicked = () => {
//   const event = new AdjustEvent('3m9ioy');
//   Adjust.trackEvent(event);
//   console.log("Let's Go Clicked (Onboarding Step 1) tracked");
// };

// export const trackEmailEntered = () => {
//   const event = new AdjustEvent('pspayu');
//   Adjust.trackEvent(event);
//   console.log('Email Entered (Onboarding 2) tracked');
// };

// export const trackAccountCreated = () => {
//   const event = new AdjustEvent('7i2fi0');
//   Adjust.trackEvent(event);
//   console.log('Account Created (Onboarding 3) tracked');
// };

// export const trackPermissionsGranted = () => {
//   const event = new AdjustEvent('tbz8na');
//   Adjust.trackEvent(event);
//   console.log('Permissions Granted tracked');
// };

// export const trackAudioPosted = () => {
//   try {
//     const event = new AdjustEvent('aou9vt');
//     Adjust.trackEvent(event);
//     console.log('Adjust Audio Posted event tracked');
//   } catch (error) {
//     console.log('Adjust error :', error);
//   }
// };

// export const trackD1Retention = () => {
//   const event = new AdjustEvent('xel8sb');
//   Adjust.trackEvent(event);
//   console.log('D1 retention event tracked');
// };

// export const trackD7Retention = () => {
//   const event = new AdjustEvent('302shb');
//   Adjust.trackEvent(event);
//   console.log('D7 retention event tracked');
// };

// export const trackReactionPosted = () => {
//   const event = new AdjustEvent('nb33xx');
//   Adjust.trackEvent(event);
//   console.log('Reaction posted event tracked');
// };

// export const trackInviteSent = () => {
//   const event = new AdjustEvent('1nngq9');
//   Adjust.trackEvent(event);
//   console.log('Invite Sent event tracked');
// };

function RootLayoutNav() {
  const [session, setSession] = useState<Session | null>(null);
  const segments = useSegments();
  const { setCurrentlyPlayingId, currentlyPlayingId } = useAudioPlayback();
  useEffect(() => {
    const initializeTracking = async () => {
      try {
        if (Platform.OS === 'ios') {
          const { status } =
            await TrackingTransparency.getTrackingPermissionsAsync();
          if (status !== 'granted') {
            const request =
              await TrackingTransparency.requestTrackingPermissionsAsync();
            console.log('Tracking permission status:', request.status);
          } else {
            console.log('Tracking already granted');
          }
        }

        const deviceID = await TrackingTransparency.getAdvertisingId();
        // Temporarily disable Adjust to prevent crashes
        // initializeAdjustSDK();
      } catch (error) {
        console.error('Error initializing tracking:', error);
      }
    };

    initializeTracking();
  }, []);

  // const initializeAdjustSDK = () => {
  //   try {
  //     const adjustConfig = new AdjustConfig(
  //       adjustAppToken,
  //       AdjustConfig.EnvironmentProduction
  //     );
  //     Adjust.initSdk(adjustConfig);
  //     adjustConfig.setLogLevel(AdjustConfig.LogLevelVerbose); // Optional: for debugging
  //   } catch (error) {
  //     console.log('Adjust error initializing Adjust SDK :', error);
  //   }
  // };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);

      // Temporarily disable Adjust tracking to prevent crashes
      // Track D1 and D7 retention when user opens the app
      // if (session) {
      //   const userCreatedAt = new Date(session.user.created_at);
      //   const now = new Date();
      //   const daysSinceCreation = Math.floor(
      //     (now.getTime() - userCreatedAt.getTime()) / (1000 * 60 * 60 * 24)
      //   );

      //   if (daysSinceCreation === 1) {
      //     trackD1Retention();
      //   } else if (daysSinceCreation === 7) {
      //     trackD7Retention();
      //   }
      // }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    // Configure notifications
    configureNotifications();
  }, []);
  // Listen for navigation state changes
  useEffect(() => {
    const cleanup = async () => {
      try {
        if (currentlyPlayingId) {
          // Give a small delay to allow any current audio operations to complete
          await new Promise((resolve) => setTimeout(resolve, 100));
          setCurrentlyPlayingId(null);
        }
      } catch (error) {
        console.warn('Error during navigation audio cleanup:', error);
        // Ensure we still clear the playing ID even if there's an error
        setCurrentlyPlayingId(null);
      }
    };

    cleanup();
  }, [segments, setCurrentlyPlayingId, currentlyPlayingId]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: theme.colors.background.primary,
        },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      {/* Modal group for slide-up presentation */}
      <Stack.Screen
        name="(modals)"
        options={{
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen
        name="notifications"
        options={{
          presentation: 'modal',
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen name="+not-found" options={{ title: 'Oops!' }} />
    </Stack>
  );
}

export default Sentry.wrap(function RootLayout() {
  const [loaded, error] = useFonts({
    'Nunito-Regular': require('../assets/fonts/Nunito-Regular.ttf'),
    'Nunito-Medium': require('../assets/fonts/Nunito-Medium.ttf'),
    'Nunito-SemiBold': require('../assets/fonts/Nunito-SemiBold.ttf'),
    'Nunito-Bold': require('../assets/fonts/Nunito-Bold.ttf'),
    'Nunito-ExtraBold': require('../assets/fonts/Nunito-ExtraBold.ttf'),
    'Nunito-Black': require('../assets/fonts/Nunito-Black.ttf'),
  });
  const pathname = usePathname();
  const segments = useSegments();

  useEffect(() => {
    console.log('🔎 Pathname:', pathname);
    console.log('🔎 Segments:', segments);
  }, [pathname, segments]);
  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>
          Something went wrong {'\n'}Loaded: {loaded} {'\n'}Error: {error}
        </Text>
      </View>
    );
  }
  return (
    <ErrorBoundary>
      <MenuProvider>
        <AuthProvider>
          <AudioPlaybackProvider>
            <RootLayoutNav />
            <StatusBar style="auto" />
          </AudioPlaybackProvider>
        </AuthProvider>
      </MenuProvider>
    </ErrorBoundary>
  );
});

export function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#333A3C',
        tabBarInactiveTintColor: '#8A8E8F',
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: '#F4F4F4',
        },
        tabBarLabelStyle: {
          fontFamily: 'Nunito-Regular',
          fontSize: 12,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Home size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="record"
        options={{
          title: 'Record',
          tabBarIcon: ({ color }) => <Mic size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <User size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}