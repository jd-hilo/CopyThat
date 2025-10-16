import React, { ReactNode } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableWithoutFeedback,
  Pressable,
  DimensionValue,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

interface ModalCProps {
  visible: boolean;
  onRequestClose: () => void;
  children: ReactNode;
  width?: DimensionValue;
  onPress?: () => void;
  hide?: boolean;
  animationType?: 'slide' | 'fade' | 'none';
}

export const ModalC: React.FC<ModalCProps> = ({
  visible,
  onRequestClose,
  children,
  width,
  onPress,
  hide = false,
  animationType,
}) => {
  return (
    <Modal
      animationType={animationType ? animationType : 'slide'}
      transparent={true}
      visible={visible}
      statusBarTranslucent={true}
    >
      <View style={styles.centeredView}>
        <TouchableWithoutFeedback>
          <View style={styles.overlay} />
        </TouchableWithoutFeedback>
        <View
          style={[
            styles.modalView,
            {
              width: width ? width : '100%',
              marginTop: 20,
            },
          ]}
        >
          {/* {!hide && (
            <Pressable
              onPress={onRequestClose}
              style={[{ alignSelf: 'flex-end' }]}
            >
              <Feather name="x" size={20} color={'#000'} />
            </Pressable>
          )} */}
          {children}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,

    width: '100%',
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  zapIcon: {
    marginLeft: -8,
    marginTop: -8,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '600',
    color: 'red',
    marginTop: 5,
  },
  instructions: {
    fontSize: 16,
    color: '#333',
    marginBottom: 20,
    textAlign: 'left',
  },
  settingsList: {
    marginBottom: 20,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  settingText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
    marginRight: 10,
  },
  settingsButton: {
    alignItems: 'center',
    padding: 10,
  },
  settingsButtonText: {
    fontSize: 18,
    color: 'red',
    fontWeight: '500',
  },
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    // backgroundColor: "rgba(0,0,0,0.5)",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)', // Adjust as needed for the overlay
  },
  modalView: {
    maxHeight: '95%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 10,
    alignItems: 'center',
    width: '90%',
    paddingHorizontal: 20,
  },
});
