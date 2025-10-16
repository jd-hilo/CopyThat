import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Animated } from 'react-native';
import { Typography } from '@/components/ui/Typography';
import { Input } from '@/components/ui/Input';
import { College, COLLEGES } from '@/constants/colleges';
import { signUp } from '@/lib/auth';
import { Picker } from '@react-native-picker/picker';
import { theme } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';

interface SignUpFormProps {
  onSuccess: () => void;
}

interface FormData {
  email: string;
  password: string;
  username: string;
  college: College;
}

type Step = 'username' | 'email' | 'password' | 'college' | 'review';

export function SignUpForm({ onSuccess }: SignUpFormProps) {
  const [formData, setFormData] = useState<FormData>({
    email: '',
    password: '',
    username: '',
    college: 'None of the Above'
  });
  const [currentStep, setCurrentStep] = useState<Step>('username');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slideAnim] = useState(new Animated.Value(0));

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const validateStep = (step: Step): string | null => {
    switch (step) {
      case 'username':
        if (!formData.username?.trim()) return 'Username is required';
        const usernameRegex = /^[a-zA-Z0-9_]+$/;
        if (!usernameRegex.test(formData.username.trim())) {
          return 'Username can only contain letters, numbers, and underscores';
        }
        break;
      case 'email':
        if (!formData.email?.trim()) return 'Email is required';
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email.trim())) {
          return 'Please enter a valid email address';
        }
        break;
      case 'password':
        if (!formData.password?.trim()) return 'Password is required';
        if (formData.password.trim().length < 6) {
          return 'Password must be at least 6 characters long';
        }
        break;
      case 'college':
        if (!formData.college) return 'College is required';
        break;
    }
    return null;
  };

  const animateTransition = (direction: 'next' | 'back') => {
    slideAnim.setValue(direction === 'next' ? 1 : -1);
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const handleNext = () => {
    const error = validateStep(currentStep);
    if (error) {
      setError(error);
      return;
    }
    setError(null);
    animateTransition('next');

    switch (currentStep) {
      case 'username':
        setCurrentStep('email');
        break;
      case 'email':
        setCurrentStep('password');
        break;
      case 'password':
        setCurrentStep('college');
        break;
      case 'college':
        setCurrentStep('review');
        break;
    }
  };

  const handleBack = () => {
    animateTransition('back');
    switch (currentStep) {
      case 'email':
        setCurrentStep('username');
        break;
      case 'password':
        setCurrentStep('email');
        break;
      case 'college':
        setCurrentStep('password');
        break;
      case 'review':
        setCurrentStep('college');
        break;
    }
  };

  const handleSignUp = async () => {
    try {
      setLoading(true);
      setError(null);

      const { error: signUpError } = await signUp(
        formData.email,
        formData.password,
        formData.username,
        formData.college
      );

      if (signUpError) {
        throw signUpError;
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during signup');
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    const slide = slideAnim.interpolate({
      inputRange: [-1, 0, 1],
      outputRange: [-300, 0, 300],
    });

    const getStepContent = () => {
      switch (currentStep) {
        case 'username':
          return (
            <View style={styles.pageContainer}>
              <Typography variant="h1" style={styles.pageTitle}>choose your username</Typography>
              <Typography variant="body" style={styles.pageSubtitle}>
                this will be your unique identifier on campfire
              </Typography>
              <Input
                placeholder="username"
                value={formData.username}
                onChangeText={(value) => handleInputChange('username', value)}
                autoCapitalize="none"
                style={styles.input}
              />
            </View>
          );
        case 'email':
          return (
            <View style={styles.pageContainer}>
              <Typography variant="h1" style={styles.pageTitle}>enter your email</Typography>
              <Typography variant="body" style={styles.pageSubtitle}>
                we'll use this to verify your account
              </Typography>
              <Input
                placeholder="email"
                value={formData.email}
                onChangeText={(value) => handleInputChange('email', value)}
                autoCapitalize="none"
                keyboardType="email-address"
                style={styles.input}
              />
            </View>
          );
        case 'password':
          return (
            <View style={styles.pageContainer}>
              <Typography variant="h1" style={styles.pageTitle}>create password</Typography>
              <Typography variant="body" style={styles.pageSubtitle}>
                make it strong and memorable
              </Typography>
              <Input
                placeholder="password"
                value={formData.password}
                onChangeText={(value) => handleInputChange('password', value)}
                secureTextEntry
                style={styles.input}
              />
            </View>
          );
        case 'college':
          return (
            <View style={styles.pageContainer}>
              <Typography variant="h1" style={styles.pageTitle}>select your college</Typography>
              <Typography variant="body" style={styles.pageSubtitle}>
                connect with students from your school
              </Typography>
              <View style={styles.pickerContainer}>
                <Picker<College>
                  selectedValue={formData.college}
                  onValueChange={(value: College) => handleInputChange('college', value)}
                  style={styles.picker}
                  itemStyle={styles.pickerItem}
                >
                  {COLLEGES.map((collegeOption) => (
                    <Picker.Item 
                      key={collegeOption} 
                      label={collegeOption} 
                      value={collegeOption}
                      color="#000000"
                    />
                  ))}
                </Picker>
              </View>
            </View>
          );
        case 'review':
          return (
            <View style={styles.pageContainer}>
              <Typography variant="h1" style={styles.pageTitle}>review your information</Typography>
              <Typography variant="body" style={styles.pageSubtitle}>
                make sure everything looks correct
              </Typography>
              <View style={styles.reviewContainer}>
                <View style={styles.reviewItem}>
                  <Typography variant="bodyBold" style={styles.reviewLabel}>username</Typography>
                  <Typography variant="body" style={styles.reviewValue}>{formData.username}</Typography>
                </View>
                <View style={styles.reviewItem}>
                  <Typography variant="bodyBold" style={styles.reviewLabel}>email</Typography>
                  <Typography variant="body" style={styles.reviewValue}>{formData.email}</Typography>
                </View>
                <View style={styles.reviewItem}>
                  <Typography variant="bodyBold" style={styles.reviewLabel}>college</Typography>
                  <Typography variant="body" style={styles.reviewValue}>{formData.college}</Typography>
                </View>
              </View>
            </View>
          );
      }
    };

    return (
      <Animated.View style={[
        styles.page,
        {
          transform: [{ translateX: slide }]
        }
      ]}>
        {getStepContent()}
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      {error && (
        <Typography variant="body" style={styles.error}>{error}</Typography>
      )}

      {renderStep()}

      <View style={styles.buttonContainer}>
        {currentStep !== 'username' && (
          <TouchableOpacity
            style={[styles.button, styles.backButton]}
            onPress={handleBack}
            disabled={loading}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            styles.button,
            currentStep !== 'username' && styles.buttonWithMargin,
            loading && styles.buttonDisabled
          ]}
          onPress={currentStep === 'review' ? handleSignUp : handleNext}
          disabled={loading}
        >
          {currentStep === 'review' ? (
            <Typography variant="bodyBold" style={styles.buttonText}>
              {loading ? 'Creating Account...' : 'Create Account'}
            </Typography>
          ) : (
            <Ionicons name="arrow-forward" size={24} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  page: {
    flex: 1,
    padding: 24,
  },
  pageContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  pageTitle: {
    marginBottom: 12,
    textAlign: 'center',
    color: '#000000',
    fontFamily: 'Nunito',
    textTransform: 'lowercase',
  },
  pageSubtitle: {
    marginBottom: 32,
    textAlign: 'center',
    color: theme.colors.text.secondary,
    fontFamily: 'Nunito',
    textTransform: 'lowercase',
  },
  input: {
    marginBottom: 16,
    fontFamily: 'Nunito',
    color: '#000000',
  },
  pickerContainer: {
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  picker: {
    height: 60,
  },
  pickerItem: {
    fontFamily: 'Nunito',
    fontSize: 16,
    height: 60,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    padding: 24,
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
  buttonWithMargin: {
    marginLeft: 12,
  },
  backButton: {
    backgroundColor: '#F8F8F8',
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#FFFFFF',
    fontFamily: 'Nunito-Bold',
    fontWeight: '700',
    textTransform: 'lowercase',
  },
  error: {
    color: theme.colors.error,
    marginBottom: 16,
    textAlign: 'center',
    paddingHorizontal: 24,
    fontFamily: 'Nunito',
  },
  reviewContainer: {
    backgroundColor: '#F3F4F6',
    padding: 24,
    borderRadius: 12,
  },
  reviewItem: {
    marginBottom: 16,
  },
  reviewLabel: {
    color: '#000000',
    fontFamily: 'Nunito',
    textTransform: 'lowercase',
    marginBottom: 4,
  },
  reviewValue: {
    color: '#000000',
    fontFamily: 'Nunito',
  },
}); 