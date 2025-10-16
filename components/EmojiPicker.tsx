import React from 'react';
import { View, Modal, TouchableOpacity, StyleSheet, Dimensions, Platform } from 'react-native';
import { Typography } from './ui/Typography';
import * as Haptics from 'expo-haptics';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

const EMOJIS = {
  heart: '❤️',
  fire: '🔥',
  laugh: '😂',
  wow: '😮',
  sad: '🥺'
};

type ReactionType = keyof typeof EMOJIS;

interface EmojiPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (reaction: ReactionType) => void;
  selectedReaction?: ReactionType;
  size?: 'small' | 'medium' | 'large';
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export function EmojiPicker({ visible, onClose, onSelect, selectedReaction, size = 'medium' }: EmojiPickerProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }]
  }));

  const handleEmojiPress = (type: ReactionType) => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onSelect(type);
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          containerWidth: Dimensions.get('window').width * 0.4,
          maxWidth: 160,
          padding: 6,
          buttonSize: 32,
          emojiSize: 16,
        };
      case 'large':
        return {
          containerWidth: Dimensions.get('window').width * 0.7,
          maxWidth: 300,
          padding: 12,
          buttonSize: 48,
          emojiSize: 20,
        };
      default: // medium
        return {
          containerWidth: Dimensions.get('window').width * 0.5,
          maxWidth: 200,
          padding: 8,
          buttonSize: 40,
          emojiSize: 18,
        };
    }
  };

  const sizeStyles = getSizeStyles();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity 
        style={styles.overlay} 
        activeOpacity={1} 
        onPress={onClose}
      >
        <View style={[styles.container, { 
          width: sizeStyles.containerWidth, 
          maxWidth: sizeStyles.maxWidth,
          padding: sizeStyles.padding 
        }]}>
          <View style={styles.emojiContainer}>
            {Object.entries(EMOJIS).map(([type, emoji]) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.emojiButton,
                  { 
                    width: sizeStyles.buttonSize, 
                    height: sizeStyles.buttonSize,
                    padding: sizeStyles.padding - 2
                  },
                  selectedReaction === type && styles.selectedEmoji
                ]}
                onPress={() => handleEmojiPress(type as ReactionType)}
              >
                <Typography variant="h1" style={[styles.emoji, { fontSize: sizeStyles.emojiSize }]}>
                  {emoji}
                </Typography>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: 'white',
    borderRadius: 16,
  },
  emojiContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  emojiButton: {
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedEmoji: {
    backgroundColor: '#FFFEDA',
    borderWidth: 1,
    borderColor: '#000405',
  },
  emoji: {
    // fontSize is now handled by size prop
  },
}); 