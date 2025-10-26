import React from 'react';
import { RefreshControl, StyleSheet } from 'react-native';

interface CustomRefreshControlProps {
  refreshing: boolean;
  onRefresh: () => void;
}

export function CustomRefreshControl({ refreshing, onRefresh }: CustomRefreshControlProps) {
  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor="transparent"
      colors={["transparent"]}
      style={styles.nativeControl}
    />
  );
}

const styles = StyleSheet.create({
  nativeControl: {
    opacity: 0,
  },
}); 