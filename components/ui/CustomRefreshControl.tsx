import React from 'react';
import { RefreshControl, View, StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';
import { SpinningHeadphone } from './SpinningHeadphone';

interface CustomRefreshControlProps {
  refreshing: boolean;
  onRefresh: () => void;
}

export function CustomRefreshControl({ refreshing, onRefresh }: CustomRefreshControlProps) {
  return (
    <View style={styles.container}>
      <RefreshControl
        refreshing={refreshing}
        onRefresh={onRefresh}
        tintColor="transparent"
        colors={["transparent"]}
        style={styles.nativeControl}
      />
      {refreshing && (
        <View style={styles.spinnerContainer}>
          <SpinningHeadphone size={28} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  nativeControl: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    opacity: 0,
  },
  spinnerContainer: {
    position: 'absolute',
    top: -120,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
}); 