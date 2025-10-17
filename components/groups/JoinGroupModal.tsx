import { useState } from 'react';
import {
  View,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
} from 'react-native';
import { Typography } from '@/components/ui/Typography';
import { supabase } from '@/lib/supabase';
import { ArrowUpRight } from 'lucide-react-native';
import { posthog } from '@/posthog';
import { mixpanel } from '@/app/_layout';

const { width: screenWidth } = Dimensions.get('window');

interface JoinGroupModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSuccess: (groupId: string) => void;
}

export function JoinGroupModal({
  isVisible,
  onClose,
  onSuccess,
}: JoinGroupModalProps) {
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleJoinGroup = async () => {
    if (!inviteCode.trim()) {
      Alert.alert('Error', 'Please enter an invite code');
      return;
    }

    setLoading(true);
    try {
      const enteredCode = inviteCode.trim();
      console.log('Attempting to join group with invite code:', enteredCode);

      // Fetch all groups and filter in JavaScript to debug the issue
      const { data: allGroups, error: allGroupsError } = await supabase
        .from('groups')
        .select('*');

      if (allGroupsError) {
        console.error('Error fetching all groups:', allGroupsError);
        throw allGroupsError;
      }

      console.log('All groups in database:', allGroups);
      console.log('Looking for invite code:', enteredCode);

      // Filter groups by invite code in JavaScript
      const matchingGroups =
        allGroups?.filter((group) => {
          console.log(
            `Group "${group.name}" has invite code: "${
              group.invite_code
            }" (type: ${typeof group.invite_code})`
          );
          return group.invite_code === enteredCode;
        }) || [];

      console.log('Matching groups found:', matchingGroups);

      if (matchingGroups.length === 0) {
        Alert.alert('Error', 'Invalid invite code');
        return;
      }

      const group = matchingGroups[0];
      console.log(
        'Group found:',
        group.name,
        'with invite code:',
        group.invite_code
      );

      // Check if user is already a member
      const { data: existingMember, error: memberError } = await supabase
        .from('group_members')
        .select('*')
        .eq('group_id', group.id)
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (memberError && memberError.code !== 'PGRST116') {
        throw memberError;
      }

      if (existingMember) {
        Alert.alert('Error', 'You are already a member of this group');
        return;
      }

      // Add user to group
      const { error: joinError } = await supabase.from('group_members').insert({
        group_id: group.id,
        user_id: (await supabase.auth.getUser()).data.user?.id,
      });
      mixpanel.track('Group joined');

      if (joinError) throw joinError;

      // Track group joined event with PostHog
      const {
        data: { user },
      } = await supabase.auth.getUser();
      // posthog.capture('group_joined', {
      //   user: {
      //     id: user?.id || '',
      //     email: user?.email || '',
      //   },
      //   group: {
      //     id: group.id,
      //     name: group.name,
      //     invite_code: group.invite_code,
      //   },
      //   timeStamp: new Date().toISOString(),
      // });

      // Success - no alert, just close and call onSuccess
      onSuccess(group.id);
      onClose();
    } catch (error) {
      console.error('Error joining group:', error);
      Alert.alert('Error', 'Failed to join group. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setInviteCode('');
      onClose();
    }
  };

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardAvoidingView}
            keyboardVerticalOffset={Platform.OS === 'ios' ? -90 : -200}
          >
            <View style={styles.modalContent}>
              {/* Handle Bar */}
              <View style={styles.handleBar} />

              {/* Header Section */}
              <View style={styles.headerSection}>
                <Typography variant="h1" style={styles.title}>
                  enter group pin
                </Typography>
                <Typography variant="body" style={styles.subtitle}>
                  Join your friends by entering the unique PIN they shared with
                  you.
                </Typography>
              </View>

              {/* Content Container */}
              <View style={styles.contentContainer}>
                {/* PIN Input Section */}
                <View style={styles.pinSection}>
                  <TextInput
                    style={styles.pinInput}
                    value={inviteCode}
                    onChangeText={(text) =>
                      setInviteCode(text.toUpperCase().slice(0, 5))
                    }
                    placeholder="Enter 5-letter code"
                    placeholderTextColor="#999"
                    autoCapitalize="characters"
                    maxLength={5}
                    editable={!loading}
                    autoFocus={true}
                    textAlign="center"
                  />
                </View>

                {/* Continue Button */}
                <TouchableOpacity
                  style={[
                    styles.continueButton,
                    (!inviteCode.trim() || loading) &&
                      styles.continueButtonDisabled,
                  ]}
                  onPress={handleJoinGroup}
                  disabled={!inviteCode.trim() || loading}
                >
                  <Typography variant="h2" style={styles.continueButtonText}>
                    {loading ? 'joining...' : 'continue'}
                  </Typography>
                  <ArrowUpRight size={20} color="#FFFB00" />
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  keyboardAvoidingView: {
    width: '100%',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    width: 390,
    height: 484,
    left: (screenWidth - 390) / 2,
    top: 70,
    borderTopLeftRadius: 42,
    borderTopRightRadius: 42,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.12,
    shadowRadius: 32,
    elevation: 10,
  },
  handleBar: {
    width: 48,
    height: 4,
    backgroundColor: '#000000',
    alignSelf: 'center',
    marginTop: 16,
    borderRadius: 2,
  },
  headerSection: {
    width: '100%',
    alignItems: 'center',
    gap: 12,
    marginTop: 20,
  },
  title: {
    width: '100%',
    fontFamily: 'Nunito',
    fontStyle: 'normal',
    fontWeight: '700',
    fontSize: 24,
    lineHeight: 33,
    textAlign: 'center',
    color: '#000405',
  },
  subtitle: {
    width: '100%',
    fontFamily: 'Nunito',
    fontStyle: 'normal',
    fontWeight: '400',
    fontSize: 15,
    lineHeight: 20,
    textAlign: 'center',
    color: '#5B5554',
  },
  pinSection: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinInput: {
    width: '100%',
    height: 56,
    backgroundColor: '#FAF2E0',
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    fontSize: 18,
    color: '#545A5C',
    fontWeight: '600',
  },
  continueButton: {
    backgroundColor: '#1D1D1D',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 38,
    paddingVertical: 14,
    paddingHorizontal: 24,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.24,
    shadowRadius: 24,
    elevation: 8,
    marginTop: 16,
  },
  continueButtonDisabled: {
    opacity: 0.5,
  },
  continueButtonText: {
    fontFamily: 'Nunito',
    fontWeight: '700',
    fontSize: 20,
    lineHeight: 22,
    color: '#FFFFFF',
  },
  continueButtonIcon: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    paddingHorizontal: 24,
    paddingTop: 36,
    paddingBottom: 24,
  },
});
