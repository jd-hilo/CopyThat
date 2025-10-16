import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextStyle,
  Image,
  Alert,
  Linking,
  Modal,
  Platform,
  Animated,
  TextInput,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import {
  Bell,
  Camera,
  MoreVertical,
  LogOut,
  Trash2,
  User as UserIcon,
  Users,
  Bell as BellIcon,
  X,
  School,
  Pencil,
} from 'lucide-react-native';
import { Typography } from '@/components/ui/Typography';
import { StoryCard } from '@/components/stories/StoryCard';
import { theme, Category } from '@/constants/theme';
import { signOut } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { Database, College } from '@/types/supabase';
import type { AudioStory } from '@/constants/mockData';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system';
import { AddFriendsModal } from '@/components/friends/AddFriendsModal';
import { showReactionNotificationModal } from '@/lib/notifications';
import * as Haptics from 'expo-haptics';
import { SpinningHeadphone } from '@/components/ui/SpinningHeadphone';
import { useAuth } from '@/contexts/authContext';

type Story = Database['public']['Tables']['stories']['Row'] & {
  user: Database['public']['Tables']['profiles']['Row'];
};

type Profile = Database['public']['Tables']['profiles']['Row'];

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { userProfile: profile, user, setUserProfile: setProfile } = useAuth();
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showFeatureModal, setShowFeatureModal] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'thoughts' | 'groups'>(
    'groups'
  );
  const [groups, setGroups] = useState<any[]>([]);
  const [isAddFriendsModalVisible, setIsAddFriendsModalVisible] =
    useState(false);
  const [showRemoveFriendModal, setShowRemoveFriendModal] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<Profile | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showEditNameModal, setShowEditNameModal] = useState(false);
  const [newName, setNewName] = useState('');
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (showProfileModal) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 50,
          friction: 7,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 0.8,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [showProfileModal]);
  const loadData = async () => {
    try {
      // setLoading(true);
      await fetchStories();
      await fetchGroups();
      await checkUnreadNotifications();
      // await Promise.all([
      //   fetchStories(),
      //   fetchGroups(),
      //   checkUnreadNotifications(),
      // ]);
    } catch (error) {
      console.error('Error loading profile data:', error);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const interval = setInterval(checkUnreadNotifications, 30000); // Check every 30 seconds

    return () => {
      clearInterval(interval);
    };
  }, []);

  // Check notification status when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      checkUnreadNotifications();
      setSelectedTab('groups');
    }, [])
  );

  // Handle refresh parameter from notifications
  useFocusEffect(
    React.useCallback(() => {
      if (params.refresh === 'true') {
        // Clear the parameter
        router.setParams({});
        // Refresh friends list and switch to friends tab
        fetchGroups();
        setSelectedTab('groups');
      }
    }, [params.refresh])
  );

  const fetchProfile = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('No authenticated user');
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
      throw error; // Re-throw to be caught by the parent try-catch
    }
  };

  const fetchStories = async () => {
    try {
      // const {
      //   data: { user },
      // } = await supabase.auth.getUser();
      // if (!user) {
      //   throw new Error('No authenticated user');
      // }

      const { data, error } = await supabase
        .from('stories')
        .select(
          `
          *,
          user:user_id(*)
        `
        )
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const stories = data?.map((story) => ({
        ...story,
        user: {
          ...story.user,
          profileImage:
            story.user.avatar_url ||
            'https://hilo.supabase.co/storage/v1/object/public/avatars/default.png',
          college: story.user.college as College | null,
          friend_count: story.user.friend_count || 0,
          friend_request_count: story.user.friend_request_count || 0,
        },
      }));
      setStories(stories || []);
    } catch (error) {
      console.log('Error fetching stories:', error,user);
      throw error; // Re-throw to be caught by the parent try-catch
    }
  };

  const fetchGroups = async () => {
    try {
      console.log('Fetching groups...');
      // const {
      //   data: { user },
      // } = await supabase.auth.getUser();
      // if (!user) return;

      // Fetch user's groups
      const { data: userGroups, error } = await supabase
        .from('groups')
        .select(
          `
          *,
          group_members!inner (user_id),
          member_count:group_members(count)
        `
        )
        .eq('group_members.user_id', user?.id);

      if (error) throw error;

      console.log('User groups fetched:', userGroups);
      setGroups(userGroups || []);
    } catch (error) {
      console.error('Error fetching groups:', error);
      setGroups([]);
    }
  };

  const checkUnreadNotifications = async () => {
    try {
      // const {
      //   data: { user },
      // } = await supabase.auth.getUser();
      // if (!user) return;

      // Check for unread notifications from the notifications table
      const { data: unreadNotifications, error: notificationsError } =
        await supabase
          .from('notifications')
          .select('id')
          .eq('user_id', user?.id)
          .eq('read', false);

      if (notificationsError) {
        console.error('Error checking notifications:', notificationsError);
      }

      // Check for unread reactions
      const { data: reactions } = await supabase
        .from('reactions')
        .select('id')
        .eq('story.user_id', user?.id)
        .is('read', false);

      // Check for pending friend requests
      const { data: friendRequests } = await supabase
        .from('friend_requests')
        .select('id')
        .eq('receiver_id', user?.id)
        .eq('status', 'pending');

      setHasUnreadNotifications(
        Boolean(
          (unreadNotifications && unreadNotifications.length > 0) ||
            (reactions && reactions.length > 0) ||
            (friendRequests && friendRequests.length > 0)
        )
      );
    } catch (error) {
      console.error('Error checking unread notifications:', error);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchStories();
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      // Small delay to ensure sign out completes
      await new Promise((resolve) => setTimeout(resolve, 100));
      // Force navigation to sign up page
      router.replace('/(auth)/sign-up');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleNotificationsPress = () => {
    router.push('/notifications');
  };

  const handleEnablePushNotifications = async () => {
    try {
      await showReactionNotificationModal();
      setShowMenu(false);
    } catch (error) {
      console.error('Error enabling push notifications:', error);
      Alert.alert(
        'Error',
        'Failed to enable push notifications. Please try again.'
      );
    }
  };

  const handleGiveFeedback = () => {
    const email = 'jd@hilo.media';
    const subject = 'Feedback for Hear Me Out';
    const body = 'Hi,\n\nI have some feedback about the app:\n\n';

    const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;

    Linking.openURL(mailtoUrl).catch((error) => {
      console.error('Error opening email client:', error);
      Alert.alert(
        'Error',
        'Could not open email client. Please email jd@hilo.media directly.'
      );
    });

    setShowMenu(false);
  };

  const handleUploadImage = async () => {
    try {
      console.log('Starting image upload process...');

      // Request permission with error handling
      let permissionResult;
      try {
        permissionResult =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        console.log('Permission result:', permissionResult);
      } catch (permissionError) {
        console.error('Error requesting permissions:', permissionError);
        Alert.alert(
          'Error',
          'Failed to request photo library permissions. Please try again.'
        );
        return;
      }

      if (!permissionResult.granted) {
        Alert.alert(
          'Permission Required',
          'Please allow access to your photo library to upload a profile picture.',
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Open Settings',
              onPress: () => Linking.openSettings(),
            },
          ]
        );
        return;
      }

      console.log('Launching image picker...');

      // Pick image with compression
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });

      console.log('Image picker result:', result);

      if (!result.canceled && result.assets[0].uri) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        // Create user-specific folder path
        const fileName = `${user.id}/${Date.now()}.jpg`;

        // Use base64 directly from the picker result
        const base64Data = result.assets[0].base64;
        if (!base64Data) {
          throw new Error('Failed to get image data');
        }

        // Upload image to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, decode(base64Data), {
            contentType: 'image/jpeg',
            upsert: true,
          });

        if (uploadError) throw uploadError;

        // Get public URL
        const {
          data: { publicUrl },
        } = supabase.storage.from('avatars').getPublicUrl(fileName);

        // Update profile with new avatar URL
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ avatar_url: publicUrl })
          .eq('id', user.id);

        if (updateError) throw updateError;

        // Update local state
        if (profile) {
          setProfile({ ...profile, avatar_url: publicUrl });
        }
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert(
        'Upload Failed',
        'Failed to upload profile picture. Please try again with a smaller image.'
      );
    }
  };

  const handleUpdateName = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Update profile with new username
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ username: newName.trim() })
        .eq('id', user.id);

      if (updateError) throw updateError;

      // Update local state
      if (profile) {
        setProfile({ ...profile, username: newName.trim() });
      }
      setShowEditNameModal(false);
      setNewName('');
    } catch (error) {
      console.error('Error updating name:', error);
      Alert.alert(
        'Update Failed',
        'Failed to update username. Please try again.'
      );
    }
  };

  const convertToAudioStory = (story: Story): AudioStory => ({
    id: story.id,
    title: story.title,
    description: story.description || undefined,
    transcription: story.transcription || undefined,
    audioUrl: story.audio_url,
    duration: story.duration || 0,
    category: (story.category as Category) || 'Stories',
    createdAt: story.created_at,
    likeCount: story.like_count || 0,
    reactionCount: story.reaction_count || 0,
    isLiked: false,
    isPrivate: false,
    isFriendsOnly: false,
    user: {
      id: story.user.id,
      name: story.user.username,
      username: story.user.username,
      profileImage:
        story.user.avatar_url ||
        'https://hilo.supabase.co/storage/v1/object/public/avatars/default.png',
      college: story.user.college as College | null,
      friend_count: story.user.friend_count || 0,
      friend_request_count: story.user.friend_request_count || 0,
      points: story.user.points || 0,
    },
  });

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Typography variant="h2" style={styles.emptyStateTitle}>
        no thoughts yet 🎧
      </Typography>
      <Typography variant="body" style={styles.emptyStateText}>
        share your first thought with your friends!
      </Typography>
      <TouchableOpacity
        style={styles.recordNowButton}
        onPress={() => router.push('/(tabs)/record')}
      >
        <Typography variant="h2" style={styles.recordNowButtonText}>
          record now 🎙️
        </Typography>
      </TouchableOpacity>
    </View>
  );

  const handleAddFriends = () => {
    setIsAddFriendsModalVisible(true);
  };

  const handleRemoveFriend = async () => {
    try {
      if (!selectedFriend) return;

      console.log('Removing friend:', selectedFriend.username);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      console.log('Current user:', user.id);

      // Update the friend request status to rejected (both directions)
      const { error } = await supabase
        .from('friend_requests')
        .update({ status: 'rejected' })
        .or(
          `and(sender_id.eq.${user.id},receiver_id.eq.${selectedFriend.id}),and(sender_id.eq.${selectedFriend.id},receiver_id.eq.${user.id})`
        );

      if (error) throw error;

      console.log('Friend request status updated to rejected successfully');

      // Get current friend counts for both users
      const { data: currentUserProfile } = await supabase
        .from('profiles')
        .select('friend_count')
        .eq('id', user.id)
        .single();

      const { data: friendProfile } = await supabase
        .from('profiles')
        .select('friend_count')
        .eq('id', selectedFriend.id)
        .single();

      console.log(
        'Current user friend count:',
        currentUserProfile?.friend_count
      );
      console.log('Friend profile friend count:', friendProfile?.friend_count);

      // Update friend counts for both users
      const { error: updateError1 } = await supabase
        .from('profiles')
        .update({
          friend_count: Math.max(
            0,
            (currentUserProfile?.friend_count || 0) - 1
          ),
        })
        .eq('id', user.id);

      if (updateError1) throw updateError1;

      const { error: updateError2 } = await supabase
        .from('profiles')
        .update({
          friend_count: Math.max(0, (friendProfile?.friend_count || 0) - 1),
        })
        .eq('id', selectedFriend.id);

      if (updateError2) throw updateError2;

      console.log('Friend counts updated successfully');

      // Remove friend from local state
      setGroups(groups.filter((friend) => friend.id !== selectedFriend.id));

      // Update local profile friend count
      if (profile) {
        setProfile({
          ...profile,
          friend_count: Math.max(0, (profile.friend_count || 0) - 1),
        });
      }

      // Refresh friends list from database
      await fetchGroups();

      // Close modal
      setShowRemoveFriendModal(false);
      setSelectedFriend(null);

      console.log('Friend removal completed successfully');
    } catch (error) {
      console.error('Error removing friend:', error);
      Alert.alert('Error', 'Failed to remove friend. Please try again.');
    }
  };

  const renderEmptyFriendsState = () => (
    <View style={styles.emptyState}>
      <Typography variant="h2" style={styles.emptyStateTitle}>
        you need at least 1 friend to share thoughts 👥
      </Typography>
      <Typography variant="body" style={styles.emptyStateText}>
        add your besties, but also the entertainers ✨
      </Typography>
      <TouchableOpacity
        style={styles.addFriendsButton}
        onPress={handleAddFriends}
      >
        <Typography variant="h2" style={styles.addFriendsButtonText}>
          add friends
        </Typography>
      </TouchableOpacity>
    </View>
  );

  const renderEmptyGroupsState = () => (
    <View style={styles.emptyContainer}>
      <Typography variant="h3" style={styles.emptyTitle}>
        No groups yet
      </Typography>
      <Typography
        variant="body"
        color={theme.colors.text.secondary}
        style={styles.emptyText}
      >
        You are not in any groups yet, create or join from the home page
      </Typography>
    </View>
  );

  const renderStoryItem = ({ item }: { item: Story }) => (
    <StoryCard
      story={convertToAudioStory(item)}
      handleEmojiSelect={() => {}}
      position={0}
      isFocused2={false}
    />
  );

  const handleDeleteAccount = async () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const {
                data: { user },
              } = await supabase.auth.getUser();
              if (!user) return;

              // Delete user's stories first
              await supabase.from('stories').delete().eq('user_id', user.id);

              // Delete user's reactions
              await supabase.from('reactions').delete().eq('user_id', user.id);

              // Delete user's group memberships
              await supabase
                .from('group_members')
                .delete()
                .eq('user_id', user.id);

              // Delete user's friend relationships
              await supabase
                .from('friends')
                .delete()
                .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

              // Delete user's profile
              await supabase.from('profiles').delete().eq('id', user.id);

              // Delete the auth account using the admin API
              const { data, error: userError } = await supabase.auth.getUser();
              if (userError || !data?.user)
                throw userError || new Error('No user found');

              const { error: deleteError } = await supabase.rpc('delete_user', {
                user_id: data.user.id,
              });
              if (deleteError) throw deleteError;

              // Sign out
              const { error: signOutError } = await supabase.auth.signOut();
              if (signOutError) throw signOutError;

              // Navigate to sign up immediately
              router.replace('/(auth)/sign-up');
            } catch (error) {
              console.error('Error deleting account:', error);
              Alert.alert(
                'Error',
                'Failed to delete account. Please try again.'
              );
            }
          },
        },
      ]
    );
  };

  // Tab bar UI
  const renderTabBar = () => (
    <View style={styles.tabBarContainer}>
      <TouchableOpacity
        style={[
          styles.tabButton,
          selectedTab === 'thoughts' ? styles.tabButtonActive : undefined,
        ]}
        onPress={() => setSelectedTab('thoughts')}
      >
        <UserIcon
          size={22}
          color={selectedTab === 'thoughts' ? '#000' : '#8A8E8F'}
        />
        <Typography
          variant="body"
          style={
            selectedTab === 'thoughts'
              ? [styles.tabLabel, styles.tabLabelActive]
              : [styles.tabLabel]
          }
        >
          thoughts
        </Typography>
        <Typography
          variant="body"
          style={
            selectedTab === 'thoughts'
              ? [styles.tabCount, styles.tabLabelActive]
              : [styles.tabCount]
          }
        >
          {stories.length}
        </Typography>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.tabButton,
          selectedTab === 'groups' ? styles.tabButtonActive : undefined,
        ]}
        onPress={() => setSelectedTab('groups')}
      >
        <Users
          size={22}
          color={selectedTab === 'groups' ? '#000' : '#8A8E8F'}
        />
        <Typography
          variant="body"
          style={
            selectedTab === 'groups'
              ? [styles.tabLabel, styles.tabLabelActive]
              : [styles.tabLabel]
          }
        >
          groups
        </Typography>
        <Typography
          variant="body"
          style={
            selectedTab === 'groups'
              ? [styles.tabCount, styles.tabLabelActive]
              : [styles.tabCount]
          }
        >
          {groups.length}
        </Typography>
      </TouchableOpacity>
    </View>
  );

  // Groups list UI
  const renderGroupItem = ({ item }: { item: any }) => (
    <View style={styles.friendItem}>
      <TouchableOpacity
        onPress={() => {
          // Navigate to the group or show group details
          console.log('Group selected:', item.name);
        }}
      >
        <Image
          source={{
            uri:
              item.avatar_url ||
              'https://dqthkfmvvedzyowhyewd.supabase.co/storage/v1/object/public/avatars/default.png',
          }}
          style={styles.friendAvatar}
        />
      </TouchableOpacity>
      <Typography variant="body" style={styles.friendName}>
        {item.name}
      </Typography>
      <View style={styles.friendButton}>
        <Typography variant="body" style={styles.friendButtonText}>
          {item.member_count?.[0]?.count || 0} members
        </Typography>
      </View>
    </View>
  );
  console.log('profile screen :', profile, loading);
  if (!profile || loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: '#FFFFFF' }]}>
        <View style={styles.loadingContainer}>
          <SpinningHeadphone size={32} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: '#FFFFFF' }]}
      edges={['top']}
    >
      <View style={[styles.header, { backgroundColor: '#FFFFFF' }]}>
        <View
          style={[
            styles.headerTop,
            {
              backgroundColor: '#FFFFFF',
              paddingLeft: 16 + insets.left,
              paddingRight: 16 + insets.right,
            },
          ]}
        >
          <View style={styles.headerLeftButtons}>
            <TouchableOpacity
              onPress={() => setShowMenu(true)}
              style={styles.menuButton}
            >
              <MoreVertical size={24} color="#333A3C" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowFeatureModal(true)}
              style={styles.ideaButton}
              accessibilityLabel="feature requests"
            >
              <Typography variant="h2" style={styles.ideaIcon}>💡</Typography>
            </TouchableOpacity>
          </View>
          <View style={styles.headerCenter} pointerEvents="none">
            <Typography variant="h2" style={styles.headerTitle}>
              profile
            </Typography>
          </View>
          <TouchableOpacity
            onPress={handleNotificationsPress}
            style={styles.notificationButton}
          >
            <Bell size={24} color="#333A3C" />
            {hasUnreadNotifications && (
              <View style={styles.notificationBadge} />
            )}
          </TouchableOpacity>
        </View>
        <View style={[styles.profileInfo, { backgroundColor: '#FFFFFF' }]}>
          <View style={styles.profileImageWrapper}>
            <Image
              source={{
                uri:
                  profile.avatar_url ||
                  'https://dqthkfmvvedzyowhyeyd.supabase.co/storage/v1/object/public/avatars/default.png',
              }}
              style={styles.avatarImage}
            />
            <TouchableOpacity
              style={styles.uploadOverlay}
              onPress={handleUploadImage}
            >
              <Camera size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <View style={styles.nameContainer}>
            <Typography variant="h2" style={styles.username}>
              {profile.username}
            </Typography>
            <TouchableOpacity
              style={styles.editNameIcon}
              onPress={() => {
                setNewName(profile.username);
                setShowEditNameModal(true);
              }}
            >
              <Pencil size={16} color="#333A3C" />
            </TouchableOpacity>
          </View>
        </View>
        {renderTabBar()}
      </View>
      <View style={styles.tabContent}>
        {selectedTab === 'thoughts' ? (
          loading ? (
            <View style={styles.loadingContainer}>
              <SpinningHeadphone size={32} />
            </View>
          ) : (
            <FlatList
              data={stories}
              renderItem={renderStoryItem}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 100 }}
              ListEmptyComponent={renderEmptyState}
              onRefresh={handleRefresh}
              refreshing={refreshing}
            />
          )
        ) : (
          <FlatList
            data={groups}
            renderItem={renderGroupItem}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 24 }}
            ListEmptyComponent={renderEmptyGroupsState}
          />
        )}
      </View>
      {/* Edit Name Modal */}
      <Modal
        visible={showEditNameModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEditNameModal(false)}
      >
        <TouchableOpacity
          style={[styles.menuOverlay, { paddingBottom: 100 }]} // Add padding to move content up
          activeOpacity={1}
          onPress={() => setShowEditNameModal(false)}
        >
          <View
            style={[
              styles.editNameModalContent,
              { transform: [{ translateY: -15 }] },
            ]}
          >
            <Typography variant="h3" style={styles.editNameTitle}>
              Edit Name
            </Typography>
            <TextInput
              value={newName}
              onChangeText={setNewName}
              placeholder="Enter your name"
              style={styles.editNameInput}
              autoFocus
            />
            <View style={styles.editNameButtons}>
              <TouchableOpacity
                style={[styles.editNameButton, styles.editNameCancelButton]}
                onPress={() => setShowEditNameModal(false)}
              >
                <Typography
                  variant="body"
                  style={styles.editNameCancelButtonText}
                >
                  Cancel
                </Typography>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.editNameButton, styles.editNameSaveButton]}
                onPress={handleUpdateName}
                disabled={!newName.trim()}
              >
                <Typography
                  variant="body"
                  style={styles.editNameSaveButtonText}
                >
                  Save
                </Typography>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Add Friends Modal */}
      <AddFriendsModal
        visible={isAddFriendsModalVisible}
        onClose={() => setIsAddFriendsModalVisible(false)}
      />
      {/* Menu Modal */}
      <Modal
        visible={showMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMenu(false)}
      >
        <TouchableOpacity
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={() => setShowMenu(false)}
        >
          <View style={styles.menuContent}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleEnablePushNotifications}
            >
              <BellIcon size={16} color="#333A3C" style={{ marginRight: 8 }} />
              <Typography variant="body" style={styles.menuItemText}>
                Enable Notifications
              </Typography>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleGiveFeedback}
            >
              <Pencil size={16} color="#333A3C" style={{ marginRight: 8 }} />
              <Typography variant="body" style={styles.menuItemText}>
                Give Feedback
              </Typography>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={handleSignOut}>
              <LogOut size={16} color="#333A3C" style={{ marginRight: 8 }} />
              <Typography variant="body" style={styles.menuItemText}>
                Sign Out
              </Typography>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleDeleteAccount}
            >
              <Trash2 size={16} color="#FF3B30" style={{ marginRight: 8 }} />
              <Typography
                variant="body"
                style={[styles.menuItemText, styles.deleteText]}
              >
                Delete Account
              </Typography>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
      {/* Remove Friend Modal */}
      <Modal
        visible={showRemoveFriendModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRemoveFriendModal(false)}
      >
        <View style={styles.removeFriendModalOverlay}>
          <View style={styles.removeFriendModalContent}>
            <View style={styles.removeFriendModalHeader}>
              <TouchableOpacity
                style={styles.removeFriendCloseButton}
                onPress={() => setShowRemoveFriendModal(false)}
              >
                <X size={24} color="#000" />
              </TouchableOpacity>
            </View>

            <Typography variant="h1" style={styles.removeFriendTitle}>
              remove friend
            </Typography>

            <Typography variant="body" style={styles.removeFriendSubtitle}>
              Are you sure you want to remove {selectedFriend?.username} as a
              friend?
            </Typography>

            <View style={styles.removeFriendButtons}>
              <TouchableOpacity
                style={styles.removeFriendButton}
                onPress={handleRemoveFriend}
              >
                <Trash2 size={20} color="#FFFFFF" />
                <Typography variant="h2" style={styles.removeFriendButtonText}>
                  remove friend
                </Typography>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowRemoveFriendModal(false);
                  setSelectedFriend(null);
                }}
              >
                <Typography variant="body" style={styles.cancelButtonText}>
                  cancel
                </Typography>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Feature Request Modal */}
      <Modal
        visible={showFeatureModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFeatureModal(false)}
      >
        <View style={styles.featureModalOverlay}>
          <View style={styles.featureModalContent}>
            <View style={styles.successIconContainer}>
              <Typography variant="h2">💡</Typography>
            </View>
            <Typography variant="h2" style={styles.successTitle}>
              have a feature request?
            </Typography>
            <Typography variant="body" style={styles.successMessage}>
              we’d love to hear it. tap below to share your idea.
            </Typography>
            <TouchableOpacity
              style={styles.successButton}
              onPress={() => {
                Linking.openURL('https://pastoral-supply-662.notion.site/2712cec59ddf808ab418cd36d12c679e?pvs=105');
                setShowFeatureModal(false);
              }}
            >
              <Typography variant="body" style={styles.successButtonText}>
                share request
              </Typography>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.successButton, { backgroundColor: '#FFEFB4', marginTop: 12 }]}
              onPress={() => setShowFeatureModal(false)}
            >
              <Typography variant="body" style={[styles.successButtonText, { color: '#000' }]}>
                close
              </Typography>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      {/* Profile Modal */}
      <Modal
        visible={showProfileModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowProfileModal(false)}
      >
        <View style={styles.userProfileModalOverlay}>
          <Animated.View
            style={[
              styles.userProfileModalContent,
              {
                transform: [{ scale: scaleAnim }],
                opacity: opacityAnim,
              },
            ]}
          >
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowProfileModal(false)}
            >
              <X size={24} color="#000" />
            </TouchableOpacity>

            <View style={styles.userProfileHeader}>
              <Image
                source={{
                  uri:
                    selectedFriend?.avatar_url ||
                    'https://hilo.supabase.co/storage/v1/object/public/avatars/default.png',
                }}
                style={styles.userProfileAvatar}
              />
              <Typography variant="h2" style={styles.userProfileName}>
                {selectedFriend?.username}
              </Typography>
              <Typography
                variant="bodySmall"
                style={styles.userProfileUsername}
              >
                @{selectedFriend?.username}
              </Typography>
            </View>

            <View style={styles.userProfileStats}>
              <View style={styles.userProfileStat}>
                <Typography variant="h3" style={styles.userProfileStatNumber}>
                  {selectedFriend?.friend_count || 0}
                </Typography>
                <Typography
                  variant="caption"
                  style={styles.userProfileStatLabel}
                >
                  Friends
                </Typography>
              </View>
              <View style={styles.userProfileStatDivider} />
              <View style={styles.userProfileStat}>
                <Typography variant="h3" style={styles.userProfileStatNumber}>
                  {selectedFriend?.points || 0}
                </Typography>
                <Typography
                  variant="caption"
                  style={styles.userProfileStatLabel}
                >
                  Points 🎧
                </Typography>
              </View>
            </View>

            {selectedFriend?.college && (
              <View style={styles.userProfileInfo}>
                <School size={16} color="#000" style={{ marginRight: 8 }} />
                <Typography variant="body" style={styles.userProfileInfoText}>
                  {selectedFriend.college}
                </Typography>
              </View>
            )}

            <TouchableOpacity
              style={styles.blockButton}
              onPress={() => {
                setShowProfileModal(false);
                setShowRemoveFriendModal(true);
              }}
            >
              <Trash2 size={16} color="#FF3B30" style={{ marginRight: 8 }} />
              <Typography variant="body" style={styles.blockButtonText}>
                Remove Friend
              </Typography>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    padding: 10,
    paddingTop: 0,
    // no shadow
    elevation: 0,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  headerCenter: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  headerLeftButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Nunito',
    fontWeight: '700',
    color: '#333A3C',
  },
  notificationButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
  },
  profileInfo: {
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  profileImageWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  avatarImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#FFEFB4',
  },
  uploadOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#FFEFB4',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  username: {
    fontSize: 20,
    fontFamily: 'Nunito',
    fontWeight: '700',
    color: '#333A3C',
    marginBottom: 2,
  },
  fullName: {
    fontSize: 14,
    fontFamily: 'Nunito',
    color: '#8A8E8F',
    marginBottom: 4,
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    marginTop: 8,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontFamily: 'Nunito',
    fontWeight: '700',
    color: '#333A3C',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'Nunito',
    color: '#8A8E8F',
  },
  content: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontFamily: 'Nunito',
    fontWeight: '700',
    color: '#333A3C',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    fontFamily: 'Nunito',
    color: '#8A8E8F',
    textAlign: 'center',
  },
  signOutButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 29,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginTop: 16,
    marginHorizontal: 24,
  },
  signOutText: {
    fontSize: 16,
    fontFamily: 'Nunito',
    fontWeight: '700',
    color: '#333A3C',
  },
  notificationBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
  },
  friendRequestBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
  },
  menuButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ideaButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ideaIcon: {
    fontSize: 16,
    lineHeight: 20,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingBottom: 15, // Increased to 15px to move the modal up more
    alignItems: 'center',
  },
  menuContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 8,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  menuItemText: {
    fontSize: 16,
    color: '#333A3C',
  },
  deleteText: {
    color: '#FF3B30',
  },
  tabBarContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 8,
    gap: 16,
    backgroundColor: '#FFFFFF',
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 3,
    borderColor: '#F0F0F0',
    paddingVertical: 4,
    paddingHorizontal: 14,
    marginHorizontal: 4,
  },
  tabButtonActive: {
    borderColor: '#000',
    backgroundColor: '#F0F0F0',
  },
  tabLabel: {
    fontFamily: 'Nunito',
    fontSize: 16,
    fontWeight: '700',
    color: '#8A8E8F',
    marginLeft: 6,
    marginRight: 4,
  },
  tabLabelActive: {
    color: '#000',
  },
  tabCount: {
    fontFamily: 'Nunito',
    fontSize: 16,
    fontWeight: '700',
    color: '#8A8E8F',
  },
  tabContent: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 0,
    paddingTop: 8,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 32,
    borderWidth: 5,
    borderColor: '#fff7d1',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  friendAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: 16,
  },
  friendName: {
    flex: 1,
    fontFamily: 'Nunito',
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
  },
  friendButton: {
    backgroundColor: '#fff7d1',
    borderRadius: 24,
    paddingVertical: 6,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
  },
  friendButtonText: {
    fontFamily: 'Nunito',
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    marginRight: 4,
  },
  addFriendsButton: {
    marginTop: 24,
    backgroundColor: '#FFEFB4',
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 36,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  addFriendsButtonText: {
    fontFamily: 'Nunito',
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    textAlign: 'center',
    textTransform: 'lowercase',
  },
  removeFriendModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeFriendModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    padding: 24,
    width: 347,
    alignItems: 'center',
  },
  removeFriendModalHeader: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 24,
  },
  removeFriendCloseButton: {
    padding: 8,
  },
  removeFriendTitle: {
    fontFamily: 'Nunito',
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 44,
    textAlign: 'center',
    color: '#000405',
    marginBottom: 24,
    textTransform: 'lowercase',
  },
  removeFriendSubtitle: {
    fontFamily: 'Nunito',
    fontSize: 18,
    fontWeight: '600',
    color: '#8A8E8F',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  removeFriendButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    gap: 16,
  },
  removeFriendButton: {
    backgroundColor: '#FF3B30',
    borderRadius: 26,
    paddingVertical: 14,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  removeFriendButtonText: {
    fontFamily: 'Nunito',
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 8,
    textTransform: 'lowercase',
  },
  cancelButton: {
    backgroundColor: '#F8F9FA',
    borderRadius: 26,
    paddingVertical: 14,
    paddingHorizontal: 24,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontFamily: 'Nunito',
    fontSize: 18,
    fontWeight: '700',
    color: '#8A8E8F',
    textTransform: 'lowercase',
  },
  userProfileModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userProfileModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    width: '90%',
    maxWidth: 360,
    alignItems: 'center',
    marginBottom: 10, // This will move the modal up by 10px
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  userProfileHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  userProfileAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
  },
  userProfileName: {
    fontSize: 24,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  userProfileUsername: {
    fontSize: 14,
    color: '#666',
  },
  userProfileStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    width: '100%',
    marginBottom: 24,
  },
  userProfileStat: {
    alignItems: 'center',
  },
  userProfileStatNumber: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  userProfileStatLabel: {
    fontSize: 12,
    color: '#666',
  },
  userProfileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  userProfileInfoText: {
    fontSize: 14,
    color: '#666',
  },
  userProfileStatDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#666',
  },
  blockButton: {
    backgroundColor: '#FFE4E4',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
  },
  blockButtonText: {
    fontSize: 16,
    color: '#FF3B30',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  featureModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 36,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 327,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.24,
    shadowRadius: 24,
    elevation: 8,
  },
  // Match success modal styles from record screen
  successIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFEFB4',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
    fontFamily: 'Nunito-Bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  successMessage: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8A8E8F',
    fontFamily: 'Nunito-SemiBold',
    marginBottom: 24,
    textAlign: 'center',
  },
  successButton: {
    backgroundColor: '#1D1D1D',
    borderRadius: 29,
    paddingVertical: 16,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.24,
    shadowRadius: 24,
    elevation: 8,
  },
  successButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'Nunito-Regular',
  },
  recordNowButton: {
    marginTop: 24,
    backgroundColor: '#FFEFB4',
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 36,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  recordNowButtonText: {
    fontFamily: 'Nunito',
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    textAlign: 'center',
    textTransform: 'lowercase',
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  editNameIcon: {
    padding: 4,
  },
  editNameModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingTop: 40, // More padding at the top
    paddingBottom: 32,
    paddingHorizontal: 32,
    width: '90%',
    maxWidth: 360,
    alignItems: 'center',
    marginTop: -10,
  },
  editNameTitle: {
    fontSize: 24, // Reduced from 28
    fontWeight: '700',
    color: '#000',
    marginBottom: 32,
    textAlign: 'center',
    width: '100%', // Ensure title takes full width
    paddingHorizontal: 16, // Add some padding for longer titles
  },
  editNameInput: {
    width: '100%',
    height: 60, // Increased from 50
    borderColor: '#E0E0E0',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 18,
    fontFamily: 'Nunito',
    color: '#333A3C',
    marginBottom: 32, // Increased from 24
  },
  editNameButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 16,
    marginTop: 8, // Added margin top
  },
  editNameButton: {
    flex: 1, // Make buttons take equal space
    paddingVertical: 16, // Increased from 12
    paddingHorizontal: 24,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editNameCancelButton: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  editNameCancelButtonText: {
    fontFamily: 'Nunito',
    fontSize: 18,
    fontWeight: '700',
    color: '#8A8E8F',
    textTransform: 'lowercase',
  },
  editNameSaveButton: {
    backgroundColor: '#FFEFB4',
    borderWidth: 1,
    borderColor: '#FFEFB4',
  },
  editNameSaveButtonText: {
    fontFamily: 'Nunito',
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    textTransform: 'lowercase',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: 'Nunito',
    fontWeight: '700',
    color: '#333A3C',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontFamily: 'Nunito',
    color: '#8A8E8F',
    textAlign: 'center',
  },
});
