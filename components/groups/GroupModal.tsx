import React, { useState } from 'react';
import {
  View,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
} from 'react-native';
import { Typography } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { Camera, ArrowUpRight } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { posthog } from '@/posthog';
import { mixpanel } from '@/app/_layout';

interface GroupModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSuccess: (groupId: string) => void;
}

export const GroupModal: React.FC<GroupModalProps> = ({
  isVisible,
  onClose,
  onSuccess,
}) => {
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(false);
  const [groupImage, setGroupImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const handleImagePick = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        setGroupImage(result.assets[0].base64);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const uploadGroupImage = async (): Promise<string | null> => {
    if (!groupImage) return null;

    try {
      setUploadingImage(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;

      // Create group-specific folder path
      const fileName = `${user.id}/${Date.now()}.jpg`;

      // Upload image to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('groups')
        .upload(fileName, decode(groupImage), {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from('groups').getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading group image:', error);
      Alert.alert(
        'Upload Failed',
        'Failed to upload group image. Please try again with a smaller image.'
      );
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert('Error', 'Please enter a group name');
      return;
    }

    setLoading(true);
    try {
      // Upload group image if selected
      let avatarUrl = null;
      if (groupImage) {
        avatarUrl = await uploadGroupImage();
      }

      // First, create the group (invite_code will be generated automatically by database trigger)
      const { data: group, error: groupError } = await supabase
        .from('groups')
        .insert({
          name: groupName.trim(),
          description: null,
          avatar_url: avatarUrl,
          is_public: false,
          invite_code: null, // Let database trigger generate this
          created_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .select()
        .single();

      if (groupError) throw groupError;

      const userId = (await supabase.auth.getUser()).data.user?.id;
      if (!userId) throw new Error('Not authenticated');

      // Add creator as admin
      const { error: memberError } = await supabase
        .from('group_members')
        .insert({
          group_id: group.id,
          user_id: userId,
          role: 'admin',
        });

      if (memberError) throw memberError;

      // Track group creation event with PostHog
      // posthog.capture('group_created', {
      //   user: {
      //     id: userId,
      //     email: (await supabase.auth.getUser()).data.user?.email || '',
      //   },
      //   group: {
      //     id: group.id,
      //     name: group.name,
      //     has_avatar: !!avatarUrl,
      //     is_public: false,
      //   },
      //   timeStamp: new Date().toISOString(),
      // });
      mixpanel.track('Group created');
      // Success - no alert, just call onSuccess and close
      onSuccess(group.id);
      onClose();
    } catch (error) {
      console.error('Error creating group:', error);
      Alert.alert('Error', 'Failed to create group. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const { width: screenWidth } = Dimensions.get('window');
  const modalWidth = screenWidth;

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
        keyboardVerticalOffset={Platform.OS === 'ios' ? -190 : -50}
      >
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={[styles.modalContent, { width: modalWidth }]}>
            {/* Handle line */}
            <View style={styles.handleLine} />

            {/* Header */}
            <View style={styles.header}>
              <Typography variant="h2" style={styles.title}>
                add group
              </Typography>
            </View>

            {/* Group Image Placeholder */}
            <TouchableOpacity
              style={styles.imagePlaceholder}
              onPress={handleImagePick}
            >
              {groupImage ? (
                <Image
                  source={{ uri: `data:image/jpeg;base64,${groupImage}` }}
                  style={styles.groupImage}
                  resizeMode="cover"
                />
              ) : (
                <Camera size={24} color="#FFE100" />
              )}
            </TouchableOpacity>

            {/* Group Name Input */}
            <View style={styles.nameInputContainer}>
              <TextInput
                style={styles.nameInput}
                placeholder="Enter group name"
                placeholderTextColor="#B5B2B5"
                value={groupName}
                onChangeText={setGroupName}
                maxLength={20}
                autoFocus={true}
              />
              <Typography variant="caption" style={styles.characterCount}>
                {groupName.length}/20
              </Typography>
            </View>

            {/* Create Button */}
            <TouchableOpacity
              style={[
                styles.createButton,
                (loading || uploadingImage) && styles.createButtonDisabled,
              ]}
              onPress={handleCreateGroup}
              disabled={loading || uploadingImage}
            >
              <Typography variant="body" style={styles.createButtonText}>
                {loading
                  ? 'creating...'
                  : uploadingImage
                  ? 'uploading...'
                  : 'create group'}
              </Typography>
              <ArrowUpRight size={28} color="#FFFB00" />
            </TouchableOpacity>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 42,
    borderTopRightRadius: 42,
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 40,
    gap: 32,
    boxShadow: '0px 4px 32px rgba(0, 0, 0, 0.12)',
    minHeight: 600,
  },
  handleLine: {
    width: 48,
    height: 4,
    backgroundColor: '#000000',
    borderRadius: 2,
    alignSelf: 'center',
  },
  header: {
    alignItems: 'flex-start',
    width: '100%',
    paddingTop: 8,
  },
  title: {
    fontFamily: 'Nunito',
    fontWeight: '800',
    fontSize: 24,
    lineHeight: 32,
    color: '#000405',
    textAlign: 'left',
    textTransform: 'lowercase',
  },
  imagePlaceholder: {
    width: 90,
    height: 90,
    backgroundColor: '#FAF2E0',
    borderWidth: 2,
    borderColor: '#FFE8BA',
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
  },
  groupImage: {
    width: '100%',
    height: '100%',
    borderRadius: 45,
  },
  nameInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 8,
  },
  nameInput: {
    flex: 1,
    fontFamily: 'Nunito',
    fontWeight: '600',
    fontSize: 20,
    lineHeight: 27,
    color: '#000405',
    padding: 0,
  },
  createButton: {
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
  createButtonDisabled: {
    opacity: 0.6,
  },
  characterCount: {
    position: 'absolute',
    right: 8,
    bottom: -20,
    fontSize: 12,
    color: '#B5B2B5',
  },
  createButtonText: {
    fontFamily: 'Nunito',
    fontWeight: '700',
    fontSize: 20,
    lineHeight: 22,
    color: '#FFFFFF',
  },
});
