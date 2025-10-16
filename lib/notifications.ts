import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Request notification permissions
export async function requestNotificationPermissions() {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  
  if (finalStatus !== 'granted') {
    return false;
  }

  // Get the token
  const token = await Notifications.getExpoPushTokenAsync({
    projectId: 'bd4470e6-49fb-4513-9e14-c7ebbfe8f255', // Your Expo project ID
  });

  // Store the token in Supabase
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabase
      .from('profiles')
      .update({ push_token: token.data })
      .eq('id', user.id);
  }

  return true;
}

// Configure notification settings
export function configureNotifications() {
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FFEFB4',
    });
  }
}

// Show local notification
export async function showLocalNotification(title: string, body: string) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
    },
    trigger: null,
  });
}

// Show reaction notification modal
export async function showReactionNotificationModal() {
  const { status } = await Notifications.getPermissionsAsync();
  
  if (status !== 'granted') {
    const granted = await requestNotificationPermissions();
    if (granted) {
      await showLocalNotification(
        'Notifications Enabled',
        'You\'ll be notified when someone reacts to your stories!'
      );
    }
  }
} 