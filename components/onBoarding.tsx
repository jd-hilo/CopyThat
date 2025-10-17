import { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Animated,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Typography, TextInput } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { College, COLLEGES } from '@/constants/colleges';
import React from 'react';
type Step = 'email' | 'otp' | 'username' | 'college' | 'review';

export default function OnBoarding({
  userId,
  onRequestClose,
}: {
  userId: string;
  onRequestClose: () => void;
}) {
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    college: '' as College,
    otp: '',
  });
  const [currentStep, setCurrentStep] = useState<Step>('username');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slideAnim] = useState(new Animated.Value(0));
  const [showMicModal, setShowMicModal] = useState(false);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(
    null
  );
  const [otpSent, setOtpSent] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);
  const [userExist, setUserExist] = useState(false);

  const checkUsernameAvailability = async (username: string) => {
    console.log('=== checkUsernameAvailability START ===');
    console.log('Checking username:', username);

    if (!username.trim()) {
      console.log('Username is empty, setting availability to null');
      setUsernameAvailable(null);
      return;
    }

    setIsCheckingUsername(true);
    try {
      console.log('Querying database for username...');
      const { data, error } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', username.trim())
        .maybeSingle();

      if (error) {
        console.error('Username check error:', error);
        throw error;
      }

      console.log('Username query result:', data);
      const isAvailable = !data;
      console.log('Username available:', isAvailable);
      setUsernameAvailable(isAvailable);
    } catch (err) {
      console.error('Error checking username:', err);
      setUsernameAvailable(null);
    } finally {
      setIsCheckingUsername(false);
      console.log('=== checkUsernameAvailability END ===');
    }
  };

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    if (field === 'username') {
      const debouncedCheck = setTimeout(() => {
        checkUsernameAvailability(value);
      }, 500);
      return () => clearTimeout(debouncedCheck);
    }
  };

  const animateTransition = (direction: 'next' | 'back') => {
    slideAnim.setValue(direction === 'next' ? 1 : -1);
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const handleNext = async () => {
    console.log('=== handleNext START ===');
    console.log('Current step:', currentStep);
    console.log('Form data:', formData);

    animateTransition('next');

    switch (currentStep) {
      case 'username':
        console.log('Moving from username to college step');
        setCurrentStep('college');
        break;
      case 'college':
        console.log('Moving from college to review step');
        completeOnboarding();
        break;
    }
    console.log('=== handleNext END ===');
  };

  const completeOnboarding = async () => {
    try {
      console.log('completing on boarding :');
      setCurrentStep('');
      const { error } = await supabase
        .from('profiles') // replace with your actual table name
        .update({
          username: formData.username,
          college: formData.college,
          complete_profile: true,
        })
        .eq('id', userId); // or whatever your unique identifier column is

      if (error) {
        console.error('Error updating profile:', error.message);
        return { success: false, error: error.message };
      } else {
        onRequestClose();
      }

      return { success: true };
    } catch (e) {
      console.error('Unexpected error:', e);
      return { success: false, error: e.message };
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
            <View style={styles.stepContainer}>
              <Typography variant="h1" style={styles.stepTitle}>
                choose your username
              </Typography>
              <Typography variant="body" style={styles.stepSubtitle}>
                this is your hear me out Copy codename
              </Typography>
              <View style={styles.inputContainer}>
                <TextInput
                  value={formData.username}
                  onChangeText={(value) =>
                    handleInputChange('username', value.toLowerCase())
                  }
                  placeholder="choose a username"
                  autoCapitalize="none"
                  style={[
                    styles.input,
                    usernameAvailable === true && styles.inputAvailable,
                    usernameAvailable === false && styles.inputUnavailable,
                  ]}
                  placeholderTextColor="#8A8E8F"
                />
                {isCheckingUsername && (
                  <View style={styles.checkingIndicator}>
                    <ActivityIndicator size="small" color="#8A8E8F" />
                  </View>
                )}
                {usernameAvailable === true && (
                  <Typography variant="body" style={styles.availabilityText}>
                    username available
                  </Typography>
                )}
                {usernameAvailable === false && (
                  <Typography
                    variant="body"
                    style={[styles.availabilityText, styles.unavailableText]}
                  >
                    username taken
                  </Typography>
                )}
              </View>
            </View>
          );
        case 'college':
          return (
            <View style={styles.stepContainer}>
              <Typography variant="h1" style={styles.stepTitle}>
                select your college
              </Typography>
              <Typography variant="body" style={styles.stepSubtitle}>
                connect with students from your school
              </Typography>
              <ScrollView
                style={styles.collegeScrollView}
                contentContainerStyle={styles.collegeScrollContent}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.collegeContainer}>
                  {COLLEGES.map((collegeOption) => (
                    <TouchableOpacity
                      key={collegeOption}
                      style={[
                        styles.collegeOption,
                        formData.college === collegeOption &&
                          styles.selectedCollege,
                      ]}
                      onPress={() =>
                        handleInputChange('college', collegeOption)
                      }
                    >
                      <Typography
                        variant="body"
                        style={[
                          styles.collegeText,
                          formData.college === collegeOption
                            ? styles.selectedCollegeText
                            : {},
                        ]}
                      >
                        {collegeOption}
                      </Typography>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          );
        case 'review':
          return (
            <View style={styles.stepContainer}>
              <Typography variant="h1" style={styles.stepTitle}>
                review your information
              </Typography>
              <Typography variant="body" style={styles.stepSubtitle}>
                make sure everything looks correct
              </Typography>
              <View style={styles.reviewContainer}>
                <View style={styles.reviewItem}>
                  <Typography variant="bodyBold" style={styles.reviewLabel}>
                    username
                  </Typography>
                  <Typography variant="body" style={styles.reviewValue}>
                    {formData.username}
                  </Typography>
                </View>
                <View style={styles.reviewItem}>
                  <Typography variant="bodyBold" style={styles.reviewLabel}>
                    email
                  </Typography>
                  <Typography variant="body" style={styles.reviewValue}>
                    {formData.email}
                  </Typography>
                </View>
                <View style={styles.reviewItem}>
                  <Typography variant="bodyBold" style={styles.reviewLabel}>
                    college
                  </Typography>
                  <Typography variant="body" style={styles.reviewValue}>
                    {formData.college}
                  </Typography>
                </View>
              </View>
            </View>
          );
      }
    };

    return (
      <Animated.View
        style={[
          styles.step,
          {
            transform: [{ translateX: slide }],
          },
        ]}
      >
        {getStepContent()}
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
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
          <TouchableOpacity
            style={[
              styles.button,
              currentStep !== 'email' && styles.buttonWithMargin,
              loading && styles.buttonDisabled,
            ]}
            onPress={handleNext}
            disabled={loading}
          >
            {currentStep === 'review' ? (
              loading ? (
                <Typography variant="bodyBold" style={styles.buttonText}>
                  ...
                </Typography>
              ) : (
                <Ionicons name="checkmark" size={32} color="#333A3C" />
              )
            ) : currentStep === 'email' && loading ? (
              <Typography variant="bodyBold" style={styles.buttonText}>
                checking...
              </Typography>
            ) : (
              <Ionicons name="arrow-forward" size={24} color="#333A3C" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    padding: 24,
  },
  step: {
    flex: 1,
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
  collegeScrollView: {
    width: '100%',
    maxHeight: 400,
  },
  collegeScrollContent: {
    paddingBottom: 16,
  },
  collegeContainer: {
    width: '100%',
  },
  collegeOption: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  selectedCollege: {
    backgroundColor: '#FFEFB4',
  },
  collegeText: {
    fontSize: 16,
    fontFamily: 'Nunito',
    color: '#333A3C',
  },
  selectedCollegeText: {
    fontWeight: '600',
  },
  reviewContainer: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 24,
    width: '100%',
  },
  reviewItem: {
    marginBottom: 16,
  },
  reviewLabel: {
    fontSize: 14,
    fontFamily: 'Nunito',
    color: '#333A3C',
    marginBottom: 4,
    textTransform: 'lowercase',
  },
  reviewValue: {
    fontSize: 16,
    fontFamily: 'Nunito',
    color: '#333A3C',
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
    backgroundColor: '#FFEFB4',
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButton: {
    backgroundColor: '#F8F8F8',
  },
  buttonWithMargin: {
    marginLeft: 12,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    fontSize: 16,
    fontFamily: 'Nunito',
    color: '#333A3C',
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
  inputContainer: {
    width: '100%',
    position: 'relative',
  },
  inputAvailable: {
    borderColor: '#4CAF50',
    borderWidth: 1,
  },
  inputUnavailable: {
    borderColor: '#FF4D4D',
    borderWidth: 1,
  },
  checkingIndicator: {
    position: 'absolute',
    right: 16,
    top: '50%',
    transform: [{ translateY: -10 }],
  },
  availabilityText: {
    marginTop: 8,
    fontSize: 14,
    color: '#4CAF50',
    textAlign: 'left',
    textTransform: 'lowercase',
  },
  unavailableText: {
    color: '#FF4D4D',
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
});
