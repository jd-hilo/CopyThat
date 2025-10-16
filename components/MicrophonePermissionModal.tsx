import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Image, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { trackPermissionsGranted } from '../app/_layout';

interface MicrophonePermissionModalProps {
  visible: boolean;
  onClose: () => void;
  onAllow: () => void;
}

export function MicrophonePermissionModal({ visible, onClose, onAllow }: MicrophonePermissionModalProps) {
  const handleAllow = () => {
    trackPermissionsGranted();
    onAllow();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalBox}>
          <View style={styles.content}>
            <Text style={styles.emoji}>🎤</Text>
            <Text style={styles.title}>Microphone access?</Text>
            <Text style={styles.subtitle}>Our app will suck without it.</Text>
            <TouchableOpacity style={styles.button} onPress={handleAllow} activeOpacity={0.85}>
              <Text style={styles.buttonText}>Yh, sure! Allow</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.10)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBox: {
    width: 350,
    height: 283,
    backgroundColor: '#FFFFFF',
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    padding: 0,
  },
  content: {
    width: 298,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    gap: 8,
  },
  emoji: {
    fontSize: 32,
    marginBottom: 4,
  },
  title: {
    fontFamily: 'Nunito',
    fontWeight: '800',
    fontSize: 20,
    lineHeight: 27,
    textAlign: 'center',
    color: '#000',
    marginBottom: 2,
  },
  subtitle: {
    fontFamily: 'Nunito',
    fontWeight: '600',
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
    color: '#000',
    marginBottom: 8,
  },
  button: {
    width: 185,
    height: 54,
    backgroundColor: '#FFE8BA',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 36,
    paddingVertical: 16,
    gap: 8,
    marginTop: 8,
  },
  buttonText: {
    fontFamily: 'Nunito',
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 22,
    color: '#000',
  },
}); 