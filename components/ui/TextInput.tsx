import React from 'react';
import { TextInput as RNTextInput, TextInputProps, StyleSheet } from 'react-native';

export function TextInput(props: TextInputProps) {
  const { style, ...rest } = props;

  return (
    <RNTextInput
      style={[styles.input, style]}
      placeholderTextColor="#8A8E8F"
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: 'Nunito-Regular',
    color: '#333A3C',
  },
}); 