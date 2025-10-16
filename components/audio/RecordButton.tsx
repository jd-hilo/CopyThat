import React from 'react';
import { TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useState } from 'react';
import { Mic } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  withRepeat, 
  Easing 
} from 'react-native-reanimated';
import { theme } from '@/constants/theme';

interface RecordButtonProps {
  onPress: () => void;
}

export function RecordButton({ onPress }: RecordButtonProps) {
  const [isPressed, setIsPressed] = useState(false);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.7);

  const handlePressIn = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
    
    setIsPressed(true);
    scale.value = withTiming(0.95, { duration: 200 });
    opacity.value = withRepeat(
      withTiming(0.3, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  };

  const handlePressOut = () => {
    setIsPressed(false);
    scale.value = withTiming(1, { duration: 200 });
    opacity.value = withTiming(0.7, { duration: 200 });
    onPress();
  };

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  const pulseStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
    };
  });

  return (
    <>
      <Animated.View style={[styles.pulse, pulseStyle]} />
      <Animated.View style={[styles.container, animatedStyle]}>
        <TouchableOpacity
          style={[styles.button, isPressed && styles.buttonPressed]}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={0.8}
        >
          <Mic size={28} color={theme.colors.white} />
        </TouchableOpacity>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 16,
    alignSelf: 'center',
    zIndex: 10,
  },
  button: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.lg,
  },
  buttonPressed: {
    backgroundColor: theme.colors.primaryDark,
  },
  pulse: {
    position: 'absolute',
    bottom: 8,
    alignSelf: 'center',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.primary,
    zIndex: 9,
  },
});