import { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { useEffect } from 'react';
import Animated from 'react-native-reanimated';

interface WaveBarProps {
  index: number;
  isRecording: boolean;
}

export function WaveBar({ index, isRecording }: WaveBarProps) {
  // Match recording tab behavior for smoothness
  const height = useSharedValue(10);
  const baseHeight = 8 + (index % 3) * 4; // keep slight visual variety
  const colors = [
    '#83E8FF',
    '#0099FF',
    '#00FF6E',
    '#FD8CFF',
    '#FF006F',
    '#FFFB00',
    '#FFFFFF',
  ];
  const color = colors[index % colors.length];

  useEffect(() => {
    if (isRecording) {
      height.value = withRepeat(
        withTiming(Math.random() * 20 + 10, {
          duration: 500,
          easing: Easing.inOut(Easing.ease),
        }),
        -1,
        true
      );
    } else {
      height.value = withTiming(baseHeight, { duration: 300 });
    }
  }, [isRecording]);

  const animatedStyle = useAnimatedStyle(() => ({
    height: height.value,
    backgroundColor: color,
    width: 4,
    borderRadius: 2,
    marginHorizontal: 1,
    opacity: color === '#FFFFFF' ? 0.32 : 1,
  }));

  return <Animated.View style={animatedStyle} />;
} 