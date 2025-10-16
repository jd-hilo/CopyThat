import { View, StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';
import { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { useEffect } from 'react';

interface WaveBarProps {
  index: number;
  isRecording: boolean;
}

export function WaveBar({ index, isRecording }: WaveBarProps) {
  const height = useSharedValue(10);
  const delay = index * 50;

  useEffect(() => {
    if (isRecording) {
      height.value = withRepeat(
        withTiming(
          Math.random() * 20 + 10,
          { duration: 500, easing: Easing.inOut(Easing.ease) }
        ),
        -1,
        true
      );
    } else {
      height.value = withTiming(10, { duration: 300 });
    }
  }, [isRecording]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      height: height.value,
    };
  });

  return (
    <View style={styles.container}>
      <View style={[styles.bar, animatedStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 3,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 2,
  },
  bar: {
    width: 3,
    backgroundColor: theme.colors.primary,
    borderRadius: 1.5,
  },
}); 