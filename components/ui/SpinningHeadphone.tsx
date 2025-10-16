import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';

interface SpinningHeadphoneProps {
  size?: number;
}

export function SpinningHeadphone({ size = 24 }: SpinningHeadphoneProps) {
  const spinValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      })
    );
    animation.start();

    return () => animation.stop();
  }, []);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.Text
      style={[
        styles.emoji,
        {
          transform: [{ rotate: spin }],
          fontSize: size,
        },
      ]}
    >
      🎧
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  emoji: {
    textAlign: 'center',
  },
}); 