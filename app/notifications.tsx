import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, Check, X, Bell } from 'lucide-react-native';
import { Typography } from '@/components/ui/Typography';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/supabase';
import * as Haptics from 'expo-haptics';
import { theme } from '@/constants/theme';
import { showReactionNotificationModal } from '@/lib/notifications';
import * as Notifications from 'expo-notifications';

type Notification = {
  id: string;
  created_at: string;
  type: 'system' | 'friend_request';
  story?: {
    title: string;
  };
  user?: {
    id: string;
    username: string;
    avatar_url: string | null;
  };
  status?: 'pending' | 'accepted' | 'rejected';
  // System notification fields
  header?: string;
  message?: string;
  read: boolean;
};

type RawReaction = Database['public']['Tables']['reactions']['Row'] & {
  story: {
    id: string;
    title: string;
  } | null;
  user: {
    id: string;
    username: string;
    avatar_url: string | null;
  } | null;
};

type FriendRequestQueryResult = {
  id: string;
  created_at: string;
  status: 'pending' | 'accepted' | 'rejected';
  sender: {
    id: string;
    username: string;
    avatar_url: string | null;
  };
};

type RawSystemNotification = {
  id: string;
  created_at: string;
  header: string;
  message: string;
};

const NotificationItem = ({ item, onUpdate }: { item: Notification, onUpdate: () => void }) => {
  // If the notification is not valid, don't render anything
  if (!item) return null;
  if (item.type !== 'system' && (!item.user || !item.user.username)) return null;

  const handleAcceptRequest = async () => {
    try {
      const { error } = await supabase
        .from('friend_requests')
        .update({ status: 'accepted' })
        .eq('id', item.id);

      if (error) throw error;

      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      onUpdate();
      
      // Route to profile page with refresh flag
      router.push({
        pathname: '/(tabs)/profile',
        params: { refresh: 'true' }
      });
    } catch (error) {
      console.error('Error accepting friend request:', error);
    }
  };

  const handleRejectRequest = async () => {
    try {
      const { error } = await supabase
        .from('friend_requests')
        .update({ status: 'rejected' })
        .eq('id', item.id);

      if (error) throw error;

      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }

      onUpdate();
    } catch (error) {
      console.error('Error rejecting friend request:', error);
    }
  };

  if (item.type === 'system') {
    return (
      <View style={[styles.notificationItem, styles.systemNotificationItem]}>
        <View style={styles.notificationContent}>
          <Typography variant="bodyBold" style={styles.systemNotificationHeader}>
            {item.header}
          </Typography>
          <Typography variant="body" style={styles.systemNotificationMessage}>
            {item.message}
          </Typography>
        </View>
      </View>
    );
  }

  return (
    <View style={[
      styles.notificationItem, 
      styles.cardNotificationItem,
      !item.read && styles.unreadNotification
    ]}>
      <View style={styles.notificationContent}>
        {!item.read && <View style={styles.unreadDot} />}
        {item.type === 'friend_request' && item.user && (
          <>
            <Typography variant="bodyBold" style={styles.username}>
              {item.user.username}
            </Typography>
            <Typography variant="body" style={styles.action}>
              sent you a friend request
            </Typography>
            <View style={styles.requestActions}>
              <TouchableOpacity 
                style={[styles.requestButton, styles.acceptButton]}
                onPress={handleAcceptRequest}
              >
                <Check size={16} color="#000" />
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.requestButton, styles.rejectButton]}
                onPress={handleRejectRequest}
              >
                <X size={16} color="#000" />
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </View>
  );
};

const EmptyState = () => (
  <View style={styles.emptyState}>
    <Typography variant="h2" style={styles.emptyStateTitle}>
      no notifications yet
    </Typography>
    <Typography variant="body" style={styles.emptyStateText}>
      When someone reacts to your stories or sends you a friend request, you'll see them here!
    </Typography>
  </View>
);

const ErrorState = ({ error, onRetry }: { error: string | null, onRetry: () => void }) => (
  <View style={styles.emptyState}>
    <Typography variant="h2" style={styles.emptyStateTitle}>
      Something went wrong
    </Typography>
    <Typography variant="body" style={styles.emptyStateText}>
      {error}
    </Typography>
    <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
      <Typography variant="bodyBold" style={styles.retryButtonText}>
        Try Again
      </Typography>
    </TouchableOpacity>
  </View>
);

const NotificationsScreen = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean | null>(null);

  const checkNotificationPermissions = async () => {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      setNotificationsEnabled(status === 'granted');
    } catch (error) {
      console.error('Error checking notification permissions:', error);
      setNotificationsEnabled(false);
    }
  };

  const handleEnableNotifications = async () => {
    try {
      await showReactionNotificationModal();
      // Recheck permissions after enabling
      await checkNotificationPermissions();
    } catch (error) {
      console.error('Error enabling notifications:', error);
    }
  };

  const fetchNotifications = async () => {
    try {
      setError(null);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('Please sign in to view notifications');
        return;
      }

      // Mark ALL notifications for this user as read
      const { error: markReadError } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false);

      if (markReadError) {
        console.error('Error marking notifications as read:', markReadError);
      } else {
        console.log('Successfully marked all notifications as read');
        // Broadcast that notifications were read
        await supabase.channel('notifications').send({
          type: 'broadcast',
          event: 'notifications_read',
          payload: { userId: user.id }
        });
      }

      // Fetch ALL system notifications (both read and unread)
      const { data: systemNotifications, error: notificationsError } = await supabase
        .from('notifications')
        .select('id, created_at, header, message, user_id, is_active, read')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50); // Limit to last 50 notifications for performance

      if (notificationsError) {
        console.error('Supabase query error:', notificationsError);
        setError('Failed to load notifications');
        return;
      }

      // Fetch friend requests
      const { data: friendRequests, error: friendRequestsError } = await supabase
        .from('friend_requests')
        .select('*, sender:profiles!friend_requests_sender_id_fkey(*)')
        .eq('receiver_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (friendRequestsError) {
        console.error('Error fetching friend requests:', friendRequestsError);
        setError('Failed to load friend requests');
        return;
      }

      // Format notifications
      const formattedSystemNotifications: Notification[] = (systemNotifications || []).map(notification => ({
        id: notification.id,
        created_at: notification.created_at,
        type: 'system',
        header: notification.header,
        message: notification.message,
        user: undefined,
        read: notification.read,
      }));

      const formattedFriendRequests: Notification[] = (friendRequests || []).map(request => {
        const senderData = request.sender as Database['public']['Tables']['profiles']['Row'];
        return {
          id: request.id,
          created_at: request.created_at,
          type: 'friend_request' as const,
          user: {
            id: senderData.id,
            username: senderData.username,
            avatar_url: senderData.avatar_url
          },
          status: request.status as 'pending' | 'accepted' | 'rejected',
          read: false, // Friend requests are considered unread until actioned
        };
      });

      // Combine and sort all notifications by date
      const allNotifications = [...formattedSystemNotifications, ...formattedFriendRequests]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setNotifications(allNotifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setError('An unexpected error occurred');
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchNotifications();
    checkNotificationPermissions();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <ArrowLeft size={24} color="#333A3C" />
        </TouchableOpacity>
        <Typography variant="h2" style={styles.headerTitle}>
          Notifications
        </Typography>
        <View style={styles.headerRight} />
      </View>

      {/* Notification Permission Banner */}
      {notificationsEnabled === false && (
        <TouchableOpacity style={styles.notificationBanner} onPress={handleEnableNotifications}>
          <View style={styles.bannerContent}>
            <Bell size={20} color="#8A8E8F" />
            <Typography variant="body" style={styles.bannerText}>
              Enable notifications to get updates when someone reacts to your stories
            </Typography>
            <Typography variant="bodyBold" style={styles.bannerButton}>
              Enable
            </Typography>
          </View>
        </TouchableOpacity>
      )}

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : error ? (
        <ErrorState error={error} onRetry={fetchNotifications} />
      ) : (
        <FlatList
          data={notifications.filter(n => n && (n.type === 'system' || (n.user && n.user.username)))}
          renderItem={({ item }) => (
            <NotificationItem item={item} onUpdate={fetchNotifications} />
          )}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={EmptyState}
          onRefresh={handleRefresh}
          refreshing={refreshing}
        />
      )}
    </SafeAreaView>
  );
};

export default NotificationsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    marginTop: -40,
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Nunito',
    fontWeight: '700',
    color: '#333A3C',
  },
  headerRight: {
    width: 40,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F4F4F4',
  },
  cardNotificationItem: {
    backgroundColor: '#F8F9FA',
  },
  notificationContent: {
    flex: 1,
  },
  username: {
    fontSize: 16,
    fontFamily: 'Nunito',
    fontWeight: '600',
    color: '#333A3C',
    marginBottom: 4,
  },
  action: {
    fontSize: 14,
    fontFamily: 'Nunito',
    color: '#8A8E8F',
    marginBottom: 4,
  },
  storyTitle: {
    fontSize: 14,
    fontFamily: 'Nunito',
    color: '#333A3C',
    fontStyle: 'italic',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 40,
    backgroundColor: '#FFFFFF',
    minHeight: 300,
  },
  emptyStateTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
    fontFamily: 'Nunito-Bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8A8E8F',
    fontFamily: 'Nunito-SemiBold',
    marginBottom: 24,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#FFEFB4',
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#333A3C',
    fontFamily: 'Nunito',
    fontWeight: '600',
  },
  requestActions: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 8,
  },
  requestButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptButton: {
    backgroundColor: '#FFEFB4',
  },
  rejectButton: {
    backgroundColor: '#FFE4E4',
  },
  systemNotificationItem: {
    backgroundColor: '#F8F9FA',
    borderColor: '#E9ECEF',
  },
  systemNotificationHeader: {
    fontSize: 16,
    fontFamily: 'Nunito',
    fontWeight: '600',
    color: '#333A3C',
    marginBottom: 4,
  },
  systemNotificationMessage: {
    fontSize: 14,
    fontFamily: 'Nunito',
    color: '#8A8E8F',
    lineHeight: 20,
  },
  unreadNotification: {
    backgroundColor: '#FFEFB4',
    borderColor: '#F7C53B',
  },
  unreadDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F7C53B',
  },
  notificationBanner: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  bannerText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Nunito',
    color: '#8A8E8F',
    lineHeight: 20,
  },
  bannerButton: {
    fontSize: 14,
    fontFamily: 'Nunito',
    fontWeight: '600',
    color: '#333A3C',
  },
}); 