import React, { useEffect } from 'react';
import { View, StyleSheet, Pressable, Animated, Text } from 'react-native';
import { Typography } from '@/components/ui';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import { trackInviteSent } from '@/app/_layout';
import { Share, Platform } from 'react-native';
import { Adjust, AdjustEvent } from 'react-native-adjust'; 
import { posthog } from '@/posthog';

const MOCK_GROUPS = [
  {
    id: '1',
    name: 'Music Producers',
    emoji: '🎵',
    description: 'Share and discuss music production techniques',
    memberCount: 128
  },
  {
    id: '2',
    name: 'Podcast Club',
    emoji: '🎙️',
    description: 'Daily discussions about favorite podcasts',
    memberCount: 256
  },
  {
    id: '3',
    name: 'Voice Artists',
    emoji: '🎭',
    description: 'Community for voice acting enthusiasts',
    memberCount: 92
  },
];

export default function OnboardingGroupsScreen() {
  const fadeAnims = MOCK_GROUPS.map(() => new Animated.Value(0));
  const slideAnims = MOCK_GROUPS.map(() => new Animated.Value(50)); 

  useEffect(() => {
    // Animate each group entry with a stagger
    MOCK_GROUPS.forEach((_, index) => {
      Animated.sequence([
        Animated.delay(index * 300), // Longer stagger for more noticeable effect
        Animated.parallel([
          Animated.timing(fadeAnims[index], {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.spring(slideAnims[index], {
            toValue: 0,
            tension: 50,
            friction: 7,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    });
  }, []);

  const handleContinue = () => {
    if (Platform.OS === 'ios') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.textContainer}>
          <Typography variant="h3" style={styles.title}>
            join groups
          </Typography>
          <Typography variant="h2" style={styles.subtitle}>
            connect with{'\n'}your community!
          </Typography>
        </View>

        <View style={styles.groupsContainer}>
          {MOCK_GROUPS.map((group, index) => (
            <Animated.View
              key={group.id}
              style={[
                styles.groupItem,
                {
                  opacity: fadeAnims[index],
                  transform: [{ translateY: slideAnims[index] }],
                },
              ]}
            >
              <View style={styles.emojiContainer}>
                <Text style={styles.emoji}>{group.emoji}</Text>
              </View>
              <View style={styles.groupHeader}>
                <Typography variant="bodyBold" style={styles.groupName}>
                  {group.name}
                </Typography>
                <Typography variant="body" style={styles.groupDescription}>
                  {group.description}
                </Typography>
                <Typography variant="body" style={styles.memberCount}>
                  {group.memberCount} members
                </Typography>
              </View>
            </Animated.View>
          ))}
        </View>

        <View style={styles.buttonContainer}>
          <Pressable style={styles.continueButton} onPress={handleContinue}>
            <Typography variant="bodyBold" style={styles.continueButtonText}>
              Got it, let's go!
            </Typography>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
    position: 'relative',
  },
  textContainer: {
    marginTop: 60,
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontFamily: 'Nunito',
    fontWeight: '800',
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
    color: '#FFD700',
    marginBottom: 12,
  },
  subtitle: {
    fontFamily: 'Nunito',
    fontWeight: '700',
    fontSize: 26,
    lineHeight: 35,
    textAlign: 'center',
    color: '#000000',
  },
  groupsContainer: {
    width: '100%',
    gap: 12,
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  groupItem: {
    padding: 12,
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupHeader: {
    flex: 1,
    marginLeft: 12,
  },
  emojiContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  emoji: {
    fontSize: 18,
  },
  groupName: {
    fontFamily: 'Nunito',
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 2,
  },
  groupDescription: {
    fontFamily: 'Nunito',
    fontSize: 12,
    color: '#666666',
    marginBottom: 2,
  },
  memberCount: {
    fontFamily: 'Nunito',
    fontSize: 11,
    color: '#888888',
  },
  buttonContainer: {
    width: '100%',
    paddingHorizontal: 24,
    marginTop: 'auto',
    marginBottom: 24,
  },
  continueButton: {
    backgroundColor: '#FFD700',
    borderRadius: 16,
    paddingVertical: 16,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
});
