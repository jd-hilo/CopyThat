import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TextInput, FlatList, ActivityIndicator, TouchableOpacity, Modal, Platform, Share, KeyboardAvoidingView, Alert, Image } from 'react-native';
import { Typography } from '../ui/Typography';
import { X, UserPlus, Check, Share2, ChevronDown, ChevronUp } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { trackInviteSent } from '@/app/_layout'; 
import { posthog } from '@/posthog';

interface AddFriendsModalProps {
  visible: boolean;
  onClose: () => void;
}

interface User {
  id: string;
  username: string;
  avatar_url: string | null;
  has_pending_request: boolean;
  showSuggestions?: boolean;
  suggestedFriends?: User[];
}

export function AddFriendsModal({ visible, onClose }: AddFriendsModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [sendingRequest, setSendingRequest] = useState<string | null>(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState<string | null>(null); 
  useEffect(() => {
    if (searchQuery.length > 2) {
      searchUsers();
    } else {
      setUsers([]);
    }
  }, [searchQuery]);

  const searchUsers = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // First get the profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .ilike('username', `%${searchQuery}%`)
        .neq('id', user.id)
        .limit(10);

      if (profilesError) throw profilesError;

      // Then get any existing friend requests for these users (both sent and received)
      const { data: friendRequests, error: requestsError } = await supabase
        .from('friend_requests')
        .select('sender_id, receiver_id, status')
        .or(`and(sender_id.eq.${user.id},receiver_id.in.(${profiles?.map(p => `"${p.id}"`).join(',')})),and(sender_id.in.(${profiles?.map(p => `"${p.id}"`).join(',')}),receiver_id.eq.${user.id})`);

      if (requestsError) throw requestsError;

      // Combine the data
      const formattedUsers = profiles?.map(profile => {
        const hasPendingRequest = friendRequests?.some(fr => 
          (fr.sender_id === user.id && fr.receiver_id === profile.id) ||
          (fr.sender_id === profile.id && fr.receiver_id === user.id)
        ) || false;
        
        return {
          id: profile.id,
          username: profile.username,
          avatar_url: profile.avatar_url,
          has_pending_request: hasPendingRequest,
          showSuggestions: false,
          suggestedFriends: []
        };
      }) || [];

      setUsers(formattedUsers);
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSuggestedFriends = async (userId: string) => {
    try {
      console.log('Fetching suggested friends for user:', userId);
      setLoadingSuggestions(userId);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // First get the target user's college
      const { data: targetUser, error: targetUserError } = await supabase
        .from('profiles')
        .select('college')
        .eq('id', userId)
        .single();

      if (targetUserError) {
        console.error('Error fetching target user:', targetUserError);
        throw targetUserError;
      }

      console.log('Target user college:', targetUser.college);

      // Get all accepted friend requests for the target user
      const { data: friendRequests, error: requestsError } = await supabase
        .from('friend_requests')
        .select('sender_id, receiver_id')
        .eq('status', 'accepted')
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);

      if (requestsError) {
        console.error('Error fetching friend requests:', requestsError);
        throw requestsError;
      }

      console.log('Found friend requests:', friendRequests);

      // Get the friend IDs
      const friendIds = (friendRequests || [])
        .map(fr => fr.sender_id === userId ? fr.receiver_id : fr.sender_id)
        .filter(id => id !== user.id); // Exclude current user

      console.log('Friend IDs:', friendIds);

      // Get existing friend requests to exclude users we already have requests with
      const { data: existingRequests, error: existingError } = await supabase
        .from('friend_requests')
        .select('sender_id, receiver_id, status')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);

      if (existingError) {
        console.error('Error fetching existing requests:', existingError);
        throw existingError;
      }

      console.log('Existing requests:', existingRequests);

      const existingRequestIds = (existingRequests || []).map(er => 
        er.sender_id === user.id ? er.receiver_id : er.sender_id
      );

      console.log('Existing request IDs:', existingRequestIds);

      let suggestedProfiles: Array<{ id: string; username: string; avatar_url: string | null }> = [];

      if (friendIds.length > 0) {
        // If user has friends, fetch their profiles first
        const { data: friendProfiles, error: profileError } = await supabase
          .from('profiles')
          .select('id, username, avatar_url')
          .in('id', friendIds)
          .not('id', 'in', existingRequestIds.length > 0 ? `(${existingRequestIds.map(id => `"${id}"`).join(',')})` : '(null)')
          .limit(3);

        if (profileError) {
          console.error('Error fetching friend profiles:', profileError);
          throw profileError;
        }

        suggestedProfiles = friendProfiles;
      }

      // If we don't have enough suggestions from friends, get users from the same college
      if (!suggestedProfiles || suggestedProfiles.length < 3) {
        const remainingSlots = 3 - (suggestedProfiles?.length || 0);
        console.log('Fetching college users, remaining slots:', remainingSlots);

        const excludeIds = [
          user.id,
          userId,
          ...(existingRequestIds || []),
          ...(suggestedProfiles?.map(p => p.id) || [])
        ];

        console.log('Excluding IDs:', excludeIds);

        const { data: collegeProfiles, error: collegeError } = await supabase
          .from('profiles')
          .select('id, username, avatar_url')
          .eq('college', targetUser.college)
          .not('id', 'in', `(${excludeIds.join(',')})`)
          .limit(remainingSlots);

        if (collegeError) {
          console.error('Error fetching college profiles:', collegeError);
          throw collegeError;
        }

        console.log('Found college profiles:', collegeProfiles);
        suggestedProfiles = [...(suggestedProfiles || []), ...(collegeProfiles || [])];
      }

      console.log('Final suggested profiles:', suggestedProfiles);

      const suggestedFriends = (suggestedProfiles || []).map(profile => ({
        id: profile.id,
        username: profile.username,
        avatar_url: profile.avatar_url,
        has_pending_request: false
      }));

      console.log('Formatted suggested friends:', suggestedFriends);
      return suggestedFriends;
    } catch (error) {
      console.error('Error fetching suggested friends:', error);
      return [];
    } finally {
      setLoadingSuggestions(null);
    }
  };

  const handleSendRequest = async (userId: string) => {
    try {
      console.log('Sending friend request to:', userId);
      setSendingRequest(userId);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if a friend request already exists
      const { data: existingRequest, error: checkError } = await supabase
        .from('friend_requests')
        .select('id, status')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${user.id})`)
        .single();

      if (checkError && !checkError.message.includes('JSON object requested, multiple (or no) rows returned')) {
        console.error('Error checking existing request:', checkError);
        throw checkError;
      }

      // If a request already exists, don't create a new one
      if (existingRequest) {
        console.log('Friend request already exists:', existingRequest);
        return;
      }

      const { error } = await supabase
        .from('friend_requests')
        .insert([
          {
            sender_id: user.id,
            receiver_id: userId,
            status: 'pending'
          }
        ]);

      if (error) {
        console.error('Error inserting friend request:', error);
        throw error;
      }

      console.log('Friend request sent successfully');

      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      // Check if this is a main list user or a suggested friend
      const isMainListUser = users.some(u => u.id === userId);
      
      if (isMainListUser) {
        // For main list users, fetch and show suggestions
        const suggestedFriends = await fetchSuggestedFriends(userId);
        setUsers(prevUsers => prevUsers.map(u => {
          if (u.id === userId) {
            return {
              ...u,
              has_pending_request: true,
              showSuggestions: true,
              suggestedFriends
            };
          }
          return u;
        }));
      } else {
        // For suggested friends, just update the status
        setUsers(prevUsers => prevUsers.map(u => {
          if (u.suggestedFriends?.some(sf => sf.id === userId)) {
            return {
              ...u,
              suggestedFriends: u.suggestedFriends.map(sf =>
                sf.id === userId ? { ...sf, has_pending_request: true } : sf
              )
            };
          }
          return u;
        }));
      }

    } catch (error) {
      console.error('Error sending friend request:', error);
    } finally {
      setSendingRequest(null);
    }
  };

  const handleToggleSuggestions = (userId: string) => {
    console.log('Toggling suggestions for user:', userId);
    setUsers(users.map(u => {
      if (u.id === userId) {
        const newState = { ...u, showSuggestions: !u.showSuggestions };
        console.log('New user state:', newState);
        return newState;
      }
      return u;
    }));
  };

  const handleShareProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single();

      if (!profile) return;

      await Share.share({
        message: `join me on hear me out Copy, username is ${profile.username} 
        
        https://apps.apple.com/us/app/hear-me-out-social-audio/id6745344571`,
      });
      //  posthog.capture('user_invited_friends', {
      //   user: profile,
      //   timeStampt: new Date().toISOString(),
      // });

      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      trackInviteSent();
    } catch (error) {
      console.error('Error sharing profile:', error);
    }
  };

  const renderUserItem = ({ item }: { item: User }) => {
    // Skip rendering if this is a suggested friend (they shouldn't have their own suggestions)
    if (users.some(u => u.suggestedFriends?.some(sf => sf.id === item.id))) {
      return null;
    }

    return (
      <View>
    <View style={styles.userItem}>
      <View style={styles.userInfo}>
            <Image
              source={{ 
                uri: item.avatar_url || 'https://dqthkfmvvedzyowhyeyd.supabase.co/storage/v1/object/public/avatars/default.png'
              }}
              style={styles.avatar}
            />
        <Typography variant="body" style={styles.username}>
          @{item.username}
        </Typography>
          </View>
          <View style={styles.userActions}>
            {item.has_pending_request && item.suggestedFriends && item.suggestedFriends.length > 0 && (
              <TouchableOpacity
                style={styles.toggleButton}
                onPress={() => handleToggleSuggestions(item.id)}
              >
                {item.showSuggestions ? (
                  <ChevronUp size={20} color="#000" />
                ) : (
                  <ChevronDown size={20} color="#000" />
                )}
              </TouchableOpacity>
        )}
      <TouchableOpacity
        style={[
          styles.followButton,
          item.has_pending_request && styles.followingButton
        ]}
        onPress={() => handleSendRequest(item.id)}
        disabled={item.has_pending_request || sendingRequest === item.id}
      >
        {sendingRequest === item.id ? (
          <ActivityIndicator size="small" color="#000" />
        ) : item.has_pending_request ? (
                <Check size={16} color="#000" style={styles.buttonIcon} />
        ) : (
                <UserPlus size={16} color="#000" style={styles.buttonIcon} />
              )}
            </TouchableOpacity>
          </View>
        </View>
        {loadingSuggestions === item.id ? (
          <View style={styles.suggestionsLoadingContainer}>
            <ActivityIndicator size="small" color="#FFEFB4" />
          </View>
        ) : item.has_pending_request && item.suggestedFriends && item.suggestedFriends.length > 0 ? (
          renderSuggestedFriends(item)
        ) : null}
      </View>
    );
  };

  const renderSuggestedFriends = (user: User) => {
    console.log('Rendering suggestions for user:', user);
    if (!user.showSuggestions) {
      console.log('Not showing suggestions because showSuggestions is false');
      return null;
    }

    return (
      <View style={styles.suggestionsContainer}>
        <Typography variant="bodySmall" style={styles.suggestionsTitle}>
          how about these folks?
        </Typography>
        {user.suggestedFriends?.map((friend) => (
          <View key={friend.id} style={styles.suggestedFriendItem}>
            <View style={styles.userInfo}>
              <Image
                source={{ 
                  uri: friend.avatar_url || 'https://dqthkfmvvedzyowhyeyd.supabase.co/storage/v1/object/public/avatars/default.png'
                }}
                style={styles.avatar}
              />
              <Typography variant="body" style={styles.username}>
                @{friend.username}
              </Typography>
            </View>
            <TouchableOpacity
              style={[
                styles.followButton,
                friend.has_pending_request && styles.followingButton
              ]}
              onPress={() => {
                console.log('Clicked send request for suggested friend:', friend);
                handleSendRequest(friend.id);
              }}
              disabled={friend.has_pending_request || sendingRequest === friend.id}
            >
              {sendingRequest === friend.id ? (
                <ActivityIndicator size="small" color="#000" />
              ) : friend.has_pending_request ? (
                <Check size={16} color="#000" style={styles.buttonIcon} />
              ) : (
                <UserPlus size={16} color="#000" style={styles.buttonIcon} />
        )}
      </TouchableOpacity>
          </View>
        ))}
    </View>
  );
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
      >
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <X size={24} color="#000" />
            </TouchableOpacity>
          </View>

          <Typography variant="h1" style={styles.title}>
            friends are important!
          </Typography>

          <View style={styles.inviteButtonContainer}>
            <LinearGradient
              colors={['#FF0000', '#FFA500', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#FF00FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gradientBorder}
            >
              <TouchableOpacity 
                style={styles.inviteButton}
                onPress={handleShareProfile}
              >
                <Typography variant="h2" style={styles.inviteText}>
                  invite friends
                </Typography>
              </TouchableOpacity>
            </LinearGradient>
          </View>

          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="search username"
              placeholderTextColor="#fff"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              returnKeyLabel="Search"
              onSubmitEditing={() => {
                if (searchQuery.length > 2) {
                  searchUsers();
                }
              }}
            />
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#FFEFB4" />
            </View>
          ) : (
            <FlatList
              data={users}
              renderItem={renderUserItem}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                searchQuery.length > 2 ? (
                  <Typography variant="body" style={styles.emptyText}>
                    No users found
                  </Typography>
                ) : null
              }
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    padding: 24,
    width: 347,
    maxHeight: '80%',
    alignItems: 'center',
    marginVertical: 'auto',
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 24,
  },
  title: {
    fontFamily: 'Nunito',
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 44,
    textAlign: 'center',
    color: '#000405',
    marginBottom: 48,
  },
  closeButton: {
    padding: 8,
  },
  inviteButtonContainer: {
    width: 244,
    height: 56,
    marginBottom: 18,
  },
  gradientBorder: {
    width: '100%',
    height: '100%',
    borderRadius: 26,
    padding: 2,
  },
  inviteButton: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1D1D1D',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inviteText: {
    fontFamily: 'Nunito',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 27,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  searchContainer: {
    width: 244,
    height: 56,
    marginBottom: 24,
  },
  searchInput: {
    width: '100%',
    height: '100%',
    backgroundColor: '#D6D6D6',
    borderRadius: 26,
    padding: 14,
    paddingHorizontal: 20,
    fontSize: 16,
    fontFamily: 'Nunito',
    fontWeight: '700',
    lineHeight: 22,
    textAlign: 'center',
    color: '#FFFFFF',
  },
  loadingContainer: {
    padding: 24,
    alignItems: 'center',
  },
  listContent: {
    width: '100%',
    paddingHorizontal: 0,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  userInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  userActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  followButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#000',
  },
  followingButton: {
    backgroundColor: '#FFEFB4',
    borderColor: '#FFEFB4',
  },
  toggleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  suggestionsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F8F8F8',
  },
  suggestionsTitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  suggestedFriendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    width: '100%',
  },
  suggestionsLoadingContainer: {
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    marginTop: 24,
  },
  buttonIcon: {
    marginLeft: 0,
  },
}); 