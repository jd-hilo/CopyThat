import React from 'react';
import { Tabs } from 'expo-router';
import { useColorScheme, View, Platform, StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAudioPlayback } from '@/lib/AudioPlaybackContext';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
  const [hasPendingFriendRequests, setHasPendingFriendRequests] = useState(false);
  const [userHasVoiceClone, setUserHasVoiceClone] = useState(true); // Default true to avoid flicker
  const { setCurrentlyPlayingId, currentlyPlayingId } = useAudioPlayback();

  const handleTabPress = async () => {
    try {
      // Single haptic feedback
      if (Platform.OS === 'ios') {
        await Haptics.selectionAsync();
      }

      // Stop all audio playback
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: false,
        staysActiveInBackground: false,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
        allowsRecordingIOS: false,
      });
      
      // Reset audio mode after a short delay
      setTimeout(async () => {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          shouldDuckAndroid: false,
          playThroughEarpieceAndroid: false,
          allowsRecordingIOS: false,
        });
      }, 100);

      // Stop any currently playing audio
      if (currentlyPlayingId) {
        const { sound } = await Audio.Sound.createAsync(
          { uri: '' },
          { shouldPlay: false }
        );
        await sound.stopAsync();
        await sound.unloadAsync();
      }

      setCurrentlyPlayingId(null);
    } catch (error) {
      console.error('Error stopping audio:', error);
    }
  };

  const checkNotificationStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setHasUnreadNotifications(false);
        setHasPendingFriendRequests(false);
        setUserHasVoiceClone(false);
        return;
      }

      // Check voice clone status
      const { data: profile } = await supabase
        .from('profiles')
        .select('voice_clone_status')
        .eq('id', user.id)
        .single();

      setUserHasVoiceClone(profile?.voice_clone_status === 'ready');

      // Simple check: only unread notifications for this user
      const { data: unreadNotifications, error: notificationsError } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', user.id)
        .eq('read', false);

      if (notificationsError) {
        console.error('Error checking notifications:', notificationsError);
        return;
      }

      // Check for pending friend requests
      const { data: friendRequests, error: friendRequestsError } = await supabase
        .from('friend_requests')
        .select('id')
        .eq('receiver_id', user.id)
        .eq('status', 'pending');

      if (friendRequestsError) {
        console.error('Error checking friend requests:', friendRequestsError);
        return;
      }

      setHasUnreadNotifications(Boolean(unreadNotifications && unreadNotifications.length > 0));
      setHasPendingFriendRequests(Boolean(friendRequests && friendRequests.length > 0));
    } catch (error) {
      console.error('Error checking notification status:', error);
      setHasUnreadNotifications(false);
      setHasPendingFriendRequests(false);
    }
  };

  useEffect(() => {
    checkNotificationStatus();
    const interval = setInterval(checkNotificationStatus, 30000); // Check every 30 seconds

    // Subscribe to notifications_read event
    const notificationsChannel = supabase.channel('notifications')
      .on('broadcast', { event: 'notifications_read' }, async (payload) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user && payload.userId === user.id) {
          setHasUnreadNotifications(false);
        }
      })
      .subscribe();

    // Subscribe to voice clone updates
    const voiceCloneChannel = supabase.channel('voice_clone_updates')
      .on('broadcast', { event: 'voice_clone_ready' }, async (payload) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user && payload.userId === user.id) {
          setUserHasVoiceClone(true);
        }
      })
      .subscribe();

    return () => {
      clearInterval(interval);
      notificationsChannel.unsubscribe();
      voiceCloneChannel.unsubscribe();
      setHasUnreadNotifications(false);
      setHasPendingFriendRequests(false);
    };
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#FBFBFB' }}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: '#FFFFFF',
          tabBarInactiveTintColor: '#000000',
          tabBarStyle: userHasVoiceClone ? {
            position: 'absolute',
            width: '100%',
            bottom: 0,
            height: 96,
            backgroundColor: '#FFFFFF',
            borderTopLeftRadius: 36,
            borderTopRightRadius: 36,
            borderTopWidth: 0,
            paddingTop: 13,
            alignSelf: 'center',
            alignItems: 'center',
            justifyContent: 'center',
            // Subtle top shadow to separate bar from content
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.08,
            shadowRadius: 4,
            elevation: 4,
          } : {
            display: 'none',
          },
          tabBarItemStyle: {
            paddingTop: 12,
          },
          tabBarLabelStyle: {
            display: 'none', // Hide the labels
          },
          headerShown: false,
        }}
        screenListeners={{
          tabPress: handleTabPress,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            href: userHasVoiceClone ? '/(tabs)' : null,
            tabBarIcon: ({ focused }) => (
              <View style={styles.iconContainer}>
                <Ionicons
                  name={focused ? 'headset' : 'headset-outline'}
                  size={26}
                  color={focused ? '#000000' : '#8A8E8F'}
                />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="record"
          options={{
            title: 'Record',
            href: userHasVoiceClone ? '/(tabs)/record' : null,
            tabBarIcon: ({ focused }) => (
              <View style={styles.iconContainer}>
                <Ionicons
                  name={focused ? 'mic' : 'mic-outline'}
                  size={26}
                  color={focused ? '#000000' : '#8A8E8F'}
                />
              </View>
            ),
            headerShown: false,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ focused }) => (
              <View style={styles.iconContainer}>
                <Ionicons
                  name={focused ? 'person' : 'person-outline'}
                  size={26}
                  color={focused ? '#000000' : '#8A8E8F'}
                />
              </View>
            ),
            headerShown: false,
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'column',
    gap: 4,
    borderRadius: 16,
  },
  indicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#111111',
  },
});