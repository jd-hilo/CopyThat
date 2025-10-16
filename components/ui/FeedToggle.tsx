import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Typography } from './Typography';
import { School, Users } from 'lucide-react-native';

interface FeedToggleProps {
  isCollegeFeed: boolean;
  onToggle: (isCollegeFeed: boolean) => void;
}

export function FeedToggle({ isCollegeFeed, onToggle }: FeedToggleProps) {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[
          styles.toggleButton,
          isCollegeFeed ? styles.activeButton : styles.inactiveButton,
        ]}
        onPress={() => onToggle(true)}
      >
        <School
          size={14}
          color={isCollegeFeed ? '#3B2F2F' : '#8A8E8F'}
          style={styles.icon}
        />
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.toggleButton,
          !isCollegeFeed ? styles.activeButton : styles.inactiveButton,
        ]}
        onPress={() => onToggle(false)}
      >
        <Users
          size={14}
          color={!isCollegeFeed ? '#3B2F2F' : '#8A8E8F'}
          style={styles.icon}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
  toggleButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    borderRadius: 15,
  },
  activeButton: {
    backgroundColor: '#FFEFB4',
    borderWidth: 2,
    borderColor: '#C6F4FF',
  },
  inactiveButton: {
    backgroundColor: 'transparent',
  },
  icon: {
    marginHorizontal: 2,
  },
}); 