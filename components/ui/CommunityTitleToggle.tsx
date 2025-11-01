import React, { useState } from 'react';
import { View, TouchableOpacity, TouchableWithoutFeedback, StyleSheet, Image, ScrollView } from 'react-native';
import { Typography } from './Typography';
import { ChevronDown, Users, Plus } from 'lucide-react-native';

interface CommunityTitleToggleProps {
  isCollegeFeed: boolean;
  selectedGroupId?: string | null;
  groups?: Array<{
    id: string;
    name: string;
    avatar_url?: string | null;
    member_count?: { count: number };
  }>;
  userCollege?: string | null;
  onToggle: (isCollegeFeed: boolean, groupId: string | null) => void;
  onCreateGroup?: () => void;
  onJoinGroup?: () => void;
}

export function CommunityTitleToggle({ isCollegeFeed, selectedGroupId, groups, userCollege, onToggle, onCreateGroup, onJoinGroup }: CommunityTitleToggleProps) {
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);

  const handleToggle = (newIsCollegeFeed: boolean) => {
    onToggle(newIsCollegeFeed, null);
    setIsDropdownVisible(false);
  };

  const closeDropdown = () => {
    setIsDropdownVisible(false);
  };

  const getSelectedGroup = () => {
    return selectedGroupId && groups ? groups.find(g => g.id === selectedGroupId) : null;
  };

  const getTitleText = () => {
    if (selectedGroupId && groups) {
      const selectedGroup = groups.find(g => g.id === selectedGroupId);
      if (selectedGroup) {
        return selectedGroup.name.length > 11 
          ? `${selectedGroup.name.slice(0, 11)}...` 
          : selectedGroup.name;
      }
    }
    return 'groups';
  };

  const getTitleIcon = () => {
    const group = getSelectedGroup();
    if (group) {
      if (group.avatar_url) {
        // Check if it's an emoji (single character, not a URL)
        const isEmoji = group.avatar_url.length <= 2 && !group.avatar_url.startsWith('http');
        if (isEmoji) {
          return (
            <Typography variant="body" style={styles.emojiAvatar}>
              {group.avatar_url}
            </Typography>
          );
        }
        return (
          <Image 
            source={{ uri: group.avatar_url }} 
            style={styles.groupAvatar}
            resizeMode="cover"
          />
        );
      }
    }
    return <Users size={14.86} color="#000000" />;
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.titleContainer}
        onPress={() => setIsDropdownVisible(!isDropdownVisible)}
        activeOpacity={0.7}
      >
        <View style={styles.titleContent}>
          <View style={styles.iconContainer}>
            {getTitleIcon()}
          </View>
          <Typography variant="body" style={styles.titleText}>
            {getTitleText()}
          </Typography>
          <ChevronDown 
            size={16} 
            color="#1E1E1E" 
            style={[
              styles.chevron,
              isDropdownVisible && styles.chevronRotated
            ]} 
          />
        </View>
      </TouchableOpacity>

      {isDropdownVisible && (
        <>
          <TouchableWithoutFeedback onPress={closeDropdown}>
            <View style={styles.backdrop} />
          </TouchableWithoutFeedback>
          <View style={styles.dropdownContainer}>
            <ScrollView 
              style={styles.dropdownScrollView}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
            >
              {/* Groups */}
              {groups && groups?.map(group => {
                const isEmoji = group.avatar_url && group.avatar_url.length <= 2 && !group.avatar_url.startsWith('http');
                return (
                  <TouchableOpacity
                    key={group.id}
                    style={[
                      styles.optionItem,
                      selectedGroupId === group.id && styles.selectedOption
                    ]}
                    onPress={() => {
                      onToggle(false, group.id);
                      setIsDropdownVisible(false);
                    }}
                  >
                    <View style={[styles.optionIcon, styles.groupIcon]}>
                      {group.avatar_url ? (
                        isEmoji ? (
                          <Typography variant="body" style={styles.emojiAvatarDropdown}>
                            {group.avatar_url}
                          </Typography>
                        ) : (
                          <Image 
                            source={{ uri: group.avatar_url }} 
                            style={styles.groupAvatar}
                            resizeMode="cover"
                          />
                        )
                      ) : (
                        <Users size={20} color="#000000" />
                      )}
                    </View>
                    <Typography variant="body" style={styles.optionText}>
                      {group.name}
                    </Typography>
                  </TouchableOpacity>
                );
              })}

              {/* Create Group Option */}
              {onCreateGroup && (
                <>
                  <View style={styles.divider} />
                  <TouchableOpacity
                    style={styles.optionItem}
                    onPress={() => {
                      onCreateGroup();
                      setIsDropdownVisible(false);
                    }}
                  >
                    <View style={[styles.optionIcon, styles.createGroupIcon]}>
                      <Plus size={20} color="#000000" />
                    </View>
                    <Typography variant="body" style={styles.optionText}>
                      create group
                    </Typography>
                  </TouchableOpacity>
                </>
              )}

              {/* Join Group Option */}
              {onJoinGroup && (
                <TouchableOpacity
                  style={styles.optionItem}
                  onPress={() => {
                    onJoinGroup();
                    setIsDropdownVisible(false);
                  }}
                >
                  <View style={[styles.optionIcon, styles.joinGroupIcon]}>
                    <Users size={20} color="#000000" />
                  </View>
                  <Typography variant="body" style={styles.optionText}>
                    join group
                  </Typography>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  groupIcon: {
    backgroundColor: '#E8F0FF',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E5E5',
    marginVertical: 8,
  },
  createGroupIcon: {
    backgroundColor: '#E8F0FF',
  },
  joinGroupIcon: {
    backgroundColor: '#E8F0FF',
  },
  container: {
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    position: 'relative',
  },
  titleContainer: {
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  titleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    padding: 0,
    gap: 8,
    width: 220,
    minHeight: 33,
    paddingVertical: 4,
  },
  iconContainer: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFEDA',
    borderWidth: 0.928572,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 3.71429,
    },
    shadowOpacity: 0.2,
    shadowRadius: 14.8571,
    elevation: 8,
  },
  titleText: {
    fontFamily: 'Nunito',
    fontStyle: 'normal',
    fontWeight: '700',
    fontSize: 18,
    lineHeight: 24,
    color: '#000405',
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  chevron: {
    width: 16,
    height: 16,
  },
  chevronRotated: {
    transform: [{ rotate: '180deg' }],
  },
  backdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
  },
  dropdownContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 8,
    minWidth: 200,
    maxHeight: 300, // Limit height to make it scrollable
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
    marginTop: 8,
  },
  dropdownScrollView: {
    flex: 1,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginVertical: 2,
  },
  selectedOption: {
    backgroundColor: '#FFFEDA',
    borderWidth: 1,
    borderColor: '#FFFEDA',
  },
  optionIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F5F5DC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  optionText: {
    flex: 1,
    color: '#000000',
    textTransform: 'lowercase',
  },
  collegeText: {
    fontWeight: 'bold',
  },
  groupAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  emojiAvatar: {
    fontSize: 14,
    lineHeight: 16,
    textAlign: 'center',
  },
  emojiAvatarDropdown: {
    fontSize: 16,
    lineHeight: 20,
    textAlign: 'center',
  },
  disabledOption: {
    opacity: 0.5,
  },
  disabledIcon: {
    backgroundColor: '#F0F0F0',
  },
  disabledText: {
    color: '#8A8E8F',
  },
});
