import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Typography } from './ui/Typography';
import { EmojiPicker } from './EmojiPicker';
import { useReactions } from '@/hooks/useReactions';

const EMOJIS = {
  heart: '❤️',
  fire: '🔥',
  laugh: '😂',
  wow: '😮',
  sad: '😢'
};

interface StoryProps {
  id: string;
  // ... other existing props
}

export function Story({ id, ...props }: StoryProps) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const { reactionCounts, userReaction, addReaction, removeReaction } = useReactions(id);

  const handleReactionPress = () => {
    if (userReaction) {
      removeReaction();
    } else {
      setShowEmojiPicker(true);
    }
  };

  const handleEmojiSelect = (reactionType: keyof typeof EMOJIS) => {
    addReaction(reactionType);
  };

  return (
    <View style={styles.container}>
      {/* Existing story content */}
      
      <View style={styles.reactionContainer}>
        <TouchableOpacity 
          style={styles.reactionButton}
          onPress={handleReactionPress}
        >
          {userReaction ? (
            <Typography variant="h1" style={styles.emoji}>
              {EMOJIS[userReaction.emoji_type]}
            </Typography>
          ) : (
            <Typography variant="body">React</Typography>
          )}
        </TouchableOpacity>

        {/* Show reaction counts */}
        <View style={styles.reactionCounts}>
          {reactionCounts.map((reaction) => (
            <View key={reaction.emoji_type} style={styles.reactionCount}>
              <Typography variant="body" style={styles.emoji}>
                {EMOJIS[reaction.emoji_type]}
              </Typography>
              <Typography variant="caption">{reaction.count}</Typography>
            </View>
          ))}
        </View>
      </View>

      <EmojiPicker
        visible={showEmojiPicker}
        onClose={() => setShowEmojiPicker(false)}
        onSelect={handleEmojiSelect}
        selectedReaction={userReaction?.emoji_type}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // ... existing styles
  },
  reactionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  reactionButton: {
    padding: 8,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    marginRight: 12,
  },
  reactionCounts: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reactionCount: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  emoji: {
    fontSize: 16,
    marginRight: 4,
  },
}); 