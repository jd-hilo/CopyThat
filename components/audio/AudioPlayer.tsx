import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Play, Pause, SkipBack, SkipForward, Volume2, Clock, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';
import { Typography } from '../ui/Typography';
import { theme } from '@/constants/theme';
import { formatDuration } from '@/utils/timeUtils';
import type { Database } from '@/types/supabase';

type Story = Database['public']['Tables']['stories']['Row'] & {
  user: Database['public']['Tables']['profiles']['Row'];
};

interface AudioPlayerProps {
  story?: Story;
  onClose: () => void;
  isVisible: boolean;
}

export function AudioPlayer({ story, onClose, isVisible }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const progress = useSharedValue(0);
  const translateY = useSharedValue(100);
  
  const sound = useRef<Audio.Sound | null>(null);
  const playbackObject = useRef<ReturnType<typeof setInterval> | null>(null);

  // Add focus effect to handle navigation changes
  useFocusEffect(
    React.useCallback(() => {
      // Cleanup when screen loses focus
      return () => {
        if (sound.current) {
          cleanup();
        }
      };
    }, [])
  );

  useEffect(() => {
    if (isVisible && story) {
      translateY.value = withTiming(0, { duration: 300 });
      loadAudio();
    } else {
      translateY.value = withTiming(100, { duration: 300 });
      cleanup();
    }
  }, [isVisible, story]);

  const cleanup = async () => {
    try {
      if (playbackObject.current) {
        clearInterval(playbackObject.current);
        playbackObject.current = null;
      }
      
      if (sound.current) {
        // First try to pause before unloading to prevent URL errors
        try {
          const status = await sound.current.getStatusAsync();
          if (status.isLoaded && status.isPlaying) {
            await sound.current.pauseAsync();
          }
        } catch (pauseError) {
          console.warn('Error pausing audio:', pauseError);
          // Continue with cleanup even if pause fails
        }

        // Wrap unload in try-catch to handle potential URL errors
        try {
          await sound.current.unloadAsync();
        } catch (unloadError) {
          console.warn('Error unloading audio:', unloadError);
          // If unload fails, we still want to null the reference
        }
        
        sound.current = null;
      }
      
      setIsPlaying(false);
      setCurrentTime(0);
      progress.value = 0;
    } catch (error) {
      console.warn('Error during cleanup:', error);
      // Reset state even if cleanup fails
      sound.current = null;
      setIsPlaying(false);
      setCurrentTime(0);
      progress.value = 0;
    }
  };

  const loadAudio = async () => {
    if (!story?.audio_url) return;
    
    try {
      setIsLoading(true);
      await cleanup();
      
      // Configure audio mode for better playback
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
        allowsRecordingIOS: false,
      });
      
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: story.audio_url },
        { 
          progressUpdateIntervalMillis: 1000,
          shouldPlay: false,
          volume: 1.0,
          rate: 1.0,
          isMuted: false,
          isLooping: false,
          shouldCorrectPitch: true
        }
      );
      
      sound.current = newSound;
      
      // Set maximum volume after creation
      await sound.current.setVolumeAsync(1.0);
      
      // Set up status update handler
      sound.current.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) return;
        
        setCurrentTime(status.positionMillis / 1000);
        progress.value = status.positionMillis / (status.durationMillis || 1);
        
        if (status.didJustFinish) {
          setIsPlaying(false);
          setCurrentTime(0);
          progress.value = 0;
        }
      });
    } catch (error) {
      console.error('Error loading audio:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlayPause = async () => {
    if (!sound.current) return;
    
    try {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      
      if (isPlaying) {
        await sound.current.pauseAsync();
      } else {
        await sound.current.playAsync();
      }
      
      setIsPlaying(!isPlaying);
    } catch (error) {
      console.error('Error playing/pausing audio:', error);
    }
  };

  const handleSeekBackward = async () => {
    if (!sound.current) return;
    
    try {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      
      const newTime = Math.max(0, currentTime - 15);
      await sound.current.setPositionAsync(newTime * 1000);
      setCurrentTime(newTime);
      progress.value = newTime / (story?.duration || 1);
    } catch (error) {
      console.error('Error seeking backward:', error);
    }
  };

  const handleSeekForward = async () => {
    if (!sound.current) return;
    
    try {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      
      const newTime = Math.min(story?.duration || 0, currentTime + 15);
      await sound.current.setPositionAsync(newTime * 1000);
      setCurrentTime(newTime);
      progress.value = newTime / (story?.duration || 1);
    } catch (error) {
      console.error('Error seeking forward:', error);
    }
  };

  const togglePlaybackSpeed = async () => {
    if (!sound.current) return;
    
    try {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      
      const newSpeed = playbackSpeed === 1 ? 1.5 : playbackSpeed === 1.5 ? 2 : 1;
      await sound.current.setRateAsync(newSpeed, true);
      setPlaybackSpeed(newSpeed);
    } catch (error) {
      console.error('Error changing playback speed:', error);
    }
  };

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
    };
  });

  if (!story) return null;

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <View style={styles.progressBar}>
        <Animated.View 
          style={[
            styles.progressFill, 
            { width: `${progress.value * 100}%` }
          ]} 
        />
      </View>
      
      <View style={styles.contentContainer}>
        <View style={styles.header}>
          <View style={styles.storyInfo}>
            <View>
              <Typography variant="bodyBold" numberOfLines={1}>{story.title}</Typography>
              <Typography variant="caption" color={theme.colors.text.secondary}>
                {story.user.username}
              </Typography>
            </View>
            
            <View style={styles.timeInfo}>
              <Typography variant="caption" color={theme.colors.text.secondary}>
                {formatDuration(currentTime)} / {formatDuration(story.duration)}
              </Typography>
            </View>
          </View>
          
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={20} color={theme.colors.text.secondary} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.controls}>
          <TouchableOpacity style={styles.controlButton} onPress={togglePlaybackSpeed}>
            <Clock size={20} color={theme.colors.text.secondary} />
            <Typography variant="caption" color={theme.colors.text.secondary}>
              {playbackSpeed}x
            </Typography>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.controlButton} onPress={handleSeekBackward}>
            <SkipBack size={24} color={theme.colors.text.primary} />
            <Typography variant="caption" color={theme.colors.text.secondary}>
              15s
            </Typography>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.playButton, isLoading && styles.playButtonDisabled]} 
            onPress={handlePlayPause}
            disabled={isLoading}
          >
            {isPlaying ? (
              <Pause size={28} color={theme.colors.white} />
            ) : (
              <Play size={28} color={theme.colors.white} />
            )}
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.controlButton} onPress={handleSeekForward}>
            <SkipForward size={24} color={theme.colors.text.primary} />
            <Typography variant="caption" color={theme.colors.text.secondary}>
              15s
            </Typography>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.controlButton}>
            <Volume2 size={20} color={theme.colors.text.secondary} />
          </TouchableOpacity>
        </View>
      </View>
      
      <View style={styles.waveformContainer}>
        {Array.from({ length: 50 }).map((_, index) => {
          const barHeight = 4 + Math.random() * 20;
          const isActive = (index / 50) <= progress.value;
          
          return (
            <View 
              key={index} 
              style={[
                styles.waveformBar, 
                { 
                  height: barHeight,
                  backgroundColor: isActive ? theme.colors.primary : theme.colors.text.tertiary
                }
              ]} 
            />
          );
        })}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.background.primary,
    borderTopLeftRadius: theme.borderRadius.lg,
    borderTopRightRadius: theme.borderRadius.lg,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    ...theme.shadows.lg,
  },
  progressBar: {
    height: 2,
    backgroundColor: theme.colors.background.tertiary,
    width: '100%',
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
  },
  contentContainer: {
    padding: theme.spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  storyInfo: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  controlButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xs,
  },
  playButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.md,
  },
  playButtonDisabled: {
    opacity: 0.5,
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  waveformBar: {
    flex: 1,
    marginHorizontal: 1,
    borderRadius: 1,
  },
  closeButton: {
    padding: theme.spacing.xs,
    marginLeft: theme.spacing.md,
  },
});