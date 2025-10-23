import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Typography, TextInput, SpinningHeadphone } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';

type Step = 'email' | 'password';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [currentStep, setCurrentStep] = useState<Step>('email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const slideAnim = useRef(new Animated.Value(-1000)).current;

  // Slide down animation on mount
  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleNext = async () => {
    if (!email) {
      setError('Please enter your email');
      return;
    }
    setError(null);
    setCurrentStep('password');
  };

  const handlePasswordSignIn = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!password) {
        setError('Please enter your password');
        return;
      }

      const { data: { user }, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase(),
        password,
      });

      if (signInError) throw signInError;

      if (user) {
        // Wait a brief moment to ensure session state is updated
        await new Promise((resolve) => setTimeout(resolve, 100));
        router.replace('/(tabs)');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setCurrentStep('email');
    setPassword('');
  };

  const handleSignUp = () => {
    // Slide up animation before navigation
    Animated.timing(slideAnim, {
      toValue: -1000,
      duration: 600,
      useNativeDriver: true,
    }).start(() => {
      router.replace('/(auth)/sign-up');
    });
  };

  const renderStep = () => {
    switch (currentStep) {
      case 'email':
        return (
          <View style={styles.stepContainer}>
            <Typography variant="h1" style={styles.stepTitle}>
              welcome back!
            </Typography>
            <Typography variant="body" style={styles.stepSubtitle}>
              enter your email to sign in
            </Typography>

            <TextInput
              value={email}
              onChangeText={(value) => setEmail(value.toLowerCase())}
              placeholder="enter your email"
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.input}
              placeholderTextColor="#8A8E8F"
            />
          </View>
        );
      case 'password':
        return (
          <View style={styles.stepContainer}>
            <Typography variant="h1" style={styles.stepTitle}>
              enter password
            </Typography>
            <Typography variant="body" style={styles.stepSubtitle}>
              enter your password for {email}
            </Typography>

            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="enter your password"
              secureTextEntry
              style={styles.input}
              placeholderTextColor="#8A8E8F"
            />
          </View>
        );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View
        style={[
          styles.animatedContainer,
          {
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.content}
        >
          {error && (
            <Typography variant="body" style={styles.error}>
              {error}
            </Typography>
          )}

          {renderStep()}

          <View style={styles.buttonContainer}>
            {currentStep !== 'email' && (
              <TouchableOpacity
                style={[styles.button, styles.backButton]}
                onPress={handleBack}
                disabled={loading}
              >
                <Ionicons name="arrow-back" size={24} color="#333A3C" />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                styles.button,
                currentStep !== 'email' && styles.buttonWithMargin,
                loading && styles.buttonDisabled
              ]}
              onPress={
                currentStep === 'password'
                  ? handlePasswordSignIn
                  : handleNext
              }
              disabled={loading}
            >
              {loading ? (
                <SpinningHeadphone size={24} />
              ) : (
                <Ionicons name="arrow-forward" size={24} color="#333A3C" />
              )}
            </TouchableOpacity>
          </View>

          {currentStep === 'email' && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={
                AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
              }
              buttonStyle={
                AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
              }
              cornerRadius={16}
              style={styles.appleButton}
              onPress={async () => {
                try {
                  const credential = await AppleAuthentication.signInAsync({
                    requestedScopes: [
                      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                      AppleAuthentication.AppleAuthenticationScope.EMAIL,
                    ],
                  });
                  
                  if (credential.identityToken) {
                    const { error, data: { user } } = await supabase.auth.signInWithIdToken({
                      provider: 'apple',
                      token: credential.identityToken,
                    });
                    
                    if (!error && user) {
                      router.replace('/(tabs)');
                    } else {
                      setError('Failed to sign in with Apple');
                    }
                  }
                } catch (e) {
                  console.error('Apple sign in error:', e);
                }
              }}
            />
          )}

          <View style={styles.footer}>
            <Typography variant="body" style={styles.footerText}>
              Don't have an account?
            </Typography>
            <TouchableOpacity onPress={handleSignUp}>
              <Typography variant="bodyBold" style={styles.footerLink}>
                Sign Up
              </Typography>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  animatedContainer: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 24,
  },
  stepContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepTitle: {
    fontSize: 32,
    fontFamily: 'Nunito',
    fontWeight: '700',
    color: '#333A3C',
    marginBottom: 8,
    textAlign: 'center',
    textTransform: 'lowercase',
  },
  stepSubtitle: {
    fontSize: 16,
    fontFamily: 'Nunito',
    color: '#8A8E8F',
    textAlign: 'center',
    marginBottom: 32,
    textTransform: 'lowercase',
  },
  input: {
    backgroundColor: '#F8F8F8',
    borderRadius: 16,
    paddingHorizontal: 20,
    height: 70,
    fontSize: 20,
    fontFamily: 'Nunito',
    fontWeight: '600',
    color: '#333A3C',
    width: '100%',
    textTransform: 'lowercase',
  },
  error: {
    color: '#FF4D4D',
    fontSize: 14,
    fontFamily: 'Nunito',
    marginBottom: 16,
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  button: {
    width: 56,
    height: 56,
    backgroundColor: '#1D1D1D',
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.24,
    shadowRadius: 24,
    elevation: 8,
  },
  backButton: {
    backgroundColor: '#F8F8F8',
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonWithMargin: {
    marginLeft: 12,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontFamily: 'Nunito-Bold',
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'lowercase',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
  },
  footerText: {
    fontSize: 14,
    fontFamily: 'Nunito',
    color: '#8A8E8F',
  },
  footerLink: {
    fontSize: 14,
    fontFamily: 'Nunito',
    color: '#333A3C',
  },
  otpContainer: {
    width: '100%',
    alignItems: 'center',
  },
  resendText: {
    marginTop: 16,
    color: '#8A8E8F',
    fontSize: 14,
    fontFamily: 'Nunito',
  },
  resendLink: {
    marginTop: 16,
    color: '#333A3C',
    fontSize: 14,
    fontFamily: 'Nunito',
    textDecorationLine: 'underline',
  },
  appleButton: {
    width: '100%',
    height: 70,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 16,
    overflow: 'hidden',
  },
});
