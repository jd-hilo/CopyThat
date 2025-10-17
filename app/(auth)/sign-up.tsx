import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Animated,
  ScrollView,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Typography, TextInput, SpinningHeadphone } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { College, COLLEGES } from '@/constants/colleges';
import { trackAccountCreated, trackEmailEntered } from '../_layout';
import * as AppleAuthentication from 'expo-apple-authentication';
type Step = 'email' | 'otp' | 'username' | 'college' | 'review' | 'password';

export default function SignUpScreen() {
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    college: '' as College,
    otp: '',
  });
  const [currentStep, setCurrentStep] = useState<Step>('email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slideAnim] = useState(new Animated.Value(0));
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(
    null
  );
  const { id } = useLocalSearchParams(); 
  const [otpSent, setOtpSent] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);
  const [userExist, setUserExist] = useState(false);
  const [password, setPassword] = useState('');
  const PASSWORD_EMAILS = ['apple@test.com', 'jd@sull.com', 'jd@sull1.com'];

  const userExistRef = useRef('unknown');
  // Timer effect for OTP resend
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (otpTimer > 0) {
      interval = setInterval(() => {
        setOtpTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [otpTimer]);

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const checkExistingUser = async (email: string) => {
    try { 

      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/check-existing-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ email }),
        }
      );

      if (!response.ok) {
        console.error('Edge function response not ok:', response.status);
        throw new Error('Failed to check existing user');
      }

      const result = await response.json(); 

      return result;
    } catch (error) {
      console.error('Error checking existing user:', error);
      throw error;
    }
  };

  const handleSendOTP = async () => {
    try { 

      // Prevent sending if timer is still active
      if (otpTimer > 0) {
        console.log('OTP timer still active, preventing resend');
        return;
      }

      setLoading(true);
      setError(null);

      if (!formData.email || !validateEmail(formData.email)) { 
        setError('Please enter a valid email address');
        return;
      }

      // Send OTP only if timer is not active
      console.log('Email validation passed, sending OTP...');
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email: formData.email,
      });

      if (signInError) {
        console.error('OTP send error:', signInError);
        throw signInError;
      }
 
      setOtpSent(true);
      setOtpTimer(60); // 60 seconds cooldown
      setCurrentStep('otp'); 
    } catch (err) {
      console.error('handleSendOTP catch error:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to send verification code'
      );
    } finally {
      setLoading(false); 
    }
  };

  const handleVerifyOTP = async () => {
    try {
      console.log('=== handleVerifyOTP START ===');
      console.log('OTP:', formData.otp);
      console.log('Email:', formData.email);
      console.log('Loading state:', loading);

      setLoading(true);
      setError(null);

      // Dismiss keyboard
      Keyboard.dismiss();

      if (!formData.otp) {
        console.log('OTP validation failed - no OTP provided');
        setError('Please enter the verification code');
        return;
      }

      console.log('OTP validation passed, verifying OTP...');
      // First verify the OTP
      const {
        data: { user },
        error: verifyError,
      } = await supabase.auth.verifyOtp({
        email: formData.email,
        token: formData.otp,
        type: 'email',
      });

      if (verifyError) {
        console.error('OTP verification error:', verifyError);
        throw verifyError;
      }

      console.log('OTP verified successfully');
      console.log('User from OTP verification:', user);

      // Check if user has a profile
      if (user) {
        console.log('User exists, checking for profile...');
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profileError) {
          console.log('Profile query error:', profileError);
        }

        console.log('Profile data:', profile);

        if (profile && profile.username && profile.college) {
          console.log('Profile exists and is complete, signing user in...');
          // User exists and has a complete profile, sign them in
          const {
            data: { session },
            error: sessionError,
          } = await supabase.auth.getSession();
          if (sessionError) {
            console.error('Session error:', sessionError);
            throw sessionError;
          }

          console.log('Session data:', session);

          if (session) {
            console.log('Session exists, navigating to tabs...');
            // Wait a brief moment to ensure session state is updated
            await new Promise((resolve) => setTimeout(resolve, 100));
            router.replace({ pathname: '/(tabs)', params: { id: id } });
            return;
          }
        } else {
          console.log(
            'No profile exists or profile is incomplete, continuing with sign up...'
          );
        }
      } else {
        console.log('No user returned from OTP verification');
      }

      // If no profile exists or profile is incomplete, continue with sign up
      console.log('Moving to username step...');
      setCurrentStep('username');
      setOtpSent(false); // Reset OTP state
      setOtpTimer(0); // Reset timer
      console.log('=== handleVerifyOTP END ===');
    } catch (err) {
      console.error('handleVerifyOTP catch error:', err);
      setError(
        err instanceof Error ? err.message : 'Invalid verification code'
      );
    } finally {
      setLoading(false);
      console.log('handleVerifyOTP loading set to false');
    }
  };

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

  const validateStep = (step: Step): string | null => {
    switch (step) {
      case 'email':
        if (!formData.email?.trim()) return 'Email is required';
        if (!validateEmail(formData.email.trim())) {
          return 'Please enter a valid email address';
        }
        break;
      case 'otp':
        if (!formData.otp?.trim()) return 'Verification code is required';
        if (formData.otp.trim().length !== 6)
          return 'Verification code must be 6 digits';
        break;
      case 'username':
        if (!formData.username?.trim()) return 'Username is required';
        const usernameRegex = /^[a-zA-Z0-9_]+$/;
        if (!usernameRegex.test(formData.username.trim())) {
          return 'Username can only contain letters, numbers, and underscores';
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

  const handleNext = async () => {
    console.log('=== handleNext START ===');
    console.log('Current step:', currentStep);
    console.log('Form data:', formData);
    console.log('handle next sign Up :', userExistRef.current);
    if (PASSWORD_EMAILS.includes(formData.email.toLowerCase())) {
      setCurrentStep('password');
      return;
    }
    const error = validateStep(currentStep);
    if (error) {
      console.log('Validation error:', error);
      setError(error);
      return;
    }
    setError(null);

    // Handle OTP verification separately
    if (currentStep === 'otp') {
      console.log('OTP step detected, calling handleVerifyOTP...');
      await handleVerifyOTP();
      return;
    }

    // Handle email step with authentication check
    if (currentStep === 'email') {
      console.log(
        'Email step detected, checking if email is already authenticated...'
      );
      setLoading(true);
      try {
        // Check if timer is still active (meaning OTP was recently sent)
        if (otpTimer > 0) {
          console.log('OTP was recently sent, moving to OTP step without resending');
          animateTransition('next');
          setCurrentStep('otp');
          setLoading(false);
          return;
        }

       // const result = await checkExistingUser(formData.email);

        // Only send OTP if it hasn't been sent recently
        if (!otpSent || otpTimer === 0) {
          console.log('Sending OTP...');
          const { error: otpError } = await supabase.auth.signInWithOtp({
            email: formData.email,
          });

          if (otpError) {
            throw otpError;
          }

          // Set OTP timer and sent flag
          setOtpSent(true);
          setOtpTimer(60);
        }

        // if (result.exists && result.hasCompletedProfile) {
        //   console.log(
        //     'User exists and has completed profile, moving to OTP verification...'
        //   );
        // } else if (result.exists && !result.hasCompletedProfile) {
        //   console.log(
        //     'User exists but profile is incomplete, moving to OTP verification...'
        //   );
        // } else {
        //   console.log('User does not exist, moving to OTP verification...');
        // }

        // Proceed to OTP step
        console.log('Moving from email to otp step');
        animateTransition('next');
        setCurrentStep('otp');
        setLoading(false);
        return;
      } catch (err) {
        console.error('Error in email step:', err);
        setError(err instanceof Error ? err.message : 'Failed to verify email. Please try again.');
        setLoading(false);
        return;
      }
    }

    animateTransition('next');

    switch (currentStep) {
      case 'username':
        console.log('Moving from username to college step');
        setCurrentStep('college');
        break;
      case 'college':
        console.log('Moving from college to review step');
        setCurrentStep('review');
        break;
    }
    console.log('=== handleNext END ===');
  };

  const handleVerifyOTPLogin = async () => {
    try {
      setLoading(true);
      setError(null);
      setUserExist(false);

      // Dismiss keyboard
      Keyboard.dismiss();

      if (!formData.otp) {
        setError('Please enter the verification code');
        return;
      }

      const {
        data: { user },
        error: verifyError,
      } = await supabase.auth.verifyOtp({
        email: formData.email.toLowerCase(),
        token: formData.otp,
        type: 'email',
      });

      if (verifyError) throw verifyError;

      if (user) {
        // Wait a brief moment to ensure session state is updated
        await new Promise((resolve) => setTimeout(resolve, 100));
        handleSubmit();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Invalid verification code'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    animateTransition('back');
    switch (currentStep) {
      case 'otp':
        setCurrentStep('email');
        break;
      case 'username':
        setCurrentStep('otp');
        break;
      case 'college':
        setCurrentStep('username');
        break;
      case 'review':
        setCurrentStep('college');
        break;
      case 'password':
        setCurrentStep('email');
        break;
    }
  };

  const handleSubmit = async () => {
    try {
      console.log('=== handleSubmit START ===');
      console.log('Form data:', formData);
      console.log('Loading state:', loading);

      setError(null);
      setLoading(true);

      // First get the current session
      console.log('Getting current session...');
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();
      if (sessionError) {
        console.error('Error getting session:', sessionError);
        throw sessionError;
      }

      console.log('Current session:', session);

      if (!session) {
        console.log('No active session, trying to get user...');
        // Try to get user without session
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();
        if (userError) {
          console.error('Error getting user:', userError);
          throw userError;
        }

        console.log('Current user without session:', user);

        if (!user) {
          console.log('No user found, creating new user account...');
          // Create the user account with email and OTP
          const { error: signUpError } = await supabase.auth.signUp({
            email: formData.email,
            password: Math.random().toString(36).slice(-8), // Generate random password
            options: {
              data: {
                username: formData.username,
                college: formData.college,
              },
            },
          });

          if (signUpError) {
            console.error('Sign up error:', signUpError);
            throw signUpError;
          }

          console.log('User account created successfully');

          // Get the user again after creation
          const {
            data: { user: newUser },
            error: newUserError,
          } = await supabase.auth.getUser();
          if (newUserError) {
            console.error('Error getting new user:', newUserError);
            throw newUserError;
          }

          if (newUser) {
            console.log('New user retrieved:', newUser);
            await createUserProfile(newUser.id);
          }
        } else {
          console.log('User exists but no session, creating profile...');
          await createUserProfile(user.id);
        }
      } else {
        console.log(
          'Session exists, creating profile for user:',
          session.user.id
        );
        await createUserProfile(session.user.id);
      }

      // Redirect to onboarding flow instead of showing microphone modal
      console.log('Redirecting to onboarding flow...');
      router.push('/onboarding-mic');
      console.log('=== handleSubmit END ===');
    } catch (err) {
      return true;
      console.error('handleSubmit catch error:', err);
      // setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
      console.log('handleSubmit loading set to false');
    }
  };

  const createUserProfile = async (
    userId: string,
    username: string | null = null
  ) => { 
    const { data: existingProfile, error: existingProfileError } =
      await supabase.from('profiles').select('*').eq('id', userId).single();

    if (existingProfileError) {
      console.log('Profile query error:', existingProfileError);
    }

    console.log('Existing profile:', existingProfile);

    if (!existingProfile) {
      console.log('No existing profile, creating new profile...');
      // Create profile only if it doesn't exist
      const { error: profileError } = await supabase.from('profiles').insert({
        id: userId,
        username: username ? username : formData.username,
        college: formData.college,
        avatar_url:
          'https://dqthkfmvvedzyowhyeyd.supabase.co/storage/v1/object/public/avatars/default.png',
      });

      if (profileError) {
        console.error('Profile creation error:', profileError);
        throw profileError;
      }
      if (!profileError && username) {
        router.replace('/(tabs)');
      }

      console.log('Profile created successfully');
    } else {
      console.log('Profile already exists, skipping creation');
    }

    console.log('Tracking account created event...');
    trackAccountCreated();
  };

  const handleEmailSubmit = async () => {
    if (!formData.email) return;
    setCurrentStep('college');
  };
  const appSignIn = async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      // Sign in via Supabase Auth.
      if (credential.identityToken) {
        const {
          error,
          data: { user },
        } = await supabase.auth.signInWithIdToken({
          provider: 'apple',
          token: credential.identityToken,
        }); 
        if (!error) {
          if (user) {
            // Check if user has a profile
            const { data: profile, error: profileError } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', user.id)
              .single();
            console.log('profile and profile Error :', profile, profileError);
            if (!profileError && profile) {
              router.replace({ pathname: '/(tabs)', params: { id: id } });
            } else {
              // Prefill email and start profile completion flow
              setFormData((prev) => ({
                ...prev,
                email: user.email ?? '',
              }));
              setCurrentStep('username');
            }
          }
        } else {
          console.log('error apple sign in :', error);
          throw error;
        }
      } else {
        throw new Error('No identityToken.');
      }
    } catch (e) {
      console.log('error :', e);
      setError(e instanceof Error ? e.message : 'Failed to sign in with Apple');
    }
  };

  const handlePasswordSignIn = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!password) {
        setError('Please enter your password');
        return;
      }

      const {
        data: { user },
        error: signInError,
      } = await supabase.auth.signInWithPassword({
        email: formData.email.toLowerCase(),
        password,
      });

      if (signInError) throw signInError;

      if (user) {
        // Wait a brief moment to ensure session state is updated
        await new Promise((resolve) => setTimeout(resolve, 100));

        router.replace({ pathname: '/(tabs)', params: { id: id } });
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Invalid email or password'
      );
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
        case 'email':
          return (
            <View style={styles.stepContainer}>
              <Typography variant="h1" style={styles.stepTitle}>
                enter your email
              </Typography>
              <Typography variant="body" style={styles.stepSubtitle}>
                we'll send you a verification code
              </Typography>
              <TextInput
                value={formData.email}
                onChangeText={(value) =>
                  handleInputChange('email', value.toLowerCase())
                }
                placeholder="enter your email"
                autoCapitalize="none"
                keyboardType="email-address"
                style={styles.input}
                placeholderTextColor="#8A8E8F"
              />
            </View>
          );
        case 'otp':
          return (
            <View style={styles.stepContainer}>
              <Typography variant="h1" style={styles.stepTitle}>
                verify your email
              </Typography>
              <Typography variant="body" style={styles.stepSubtitle}>
                enter the 6-digit code we sent to {formData.email}
              </Typography>
              <View style={styles.otpContainer}>
                <TextInput
                  value={formData.otp}
                  onChangeText={(value) => handleInputChange('otp', value)}
                  placeholder="000000"
                  keyboardType="number-pad"
                  maxLength={6}
                  style={styles.input}
                  placeholderTextColor="#8A8E8F"
                />
                {otpTimer > 0 ? (
                  <Typography variant="bodyBold" style={styles.resendText}>
                    resend code in {otpTimer}s
                  </Typography>
                ) : (
                  <TouchableOpacity onPress={handleSendOTP} disabled={loading}>
                    <Typography variant="bodyBold" style={styles.resendLink}>
                      resend code
                    </Typography>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
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
                  <Typography variant="bodyBold" style={styles.availabilityText}>
                    username available
                  </Typography>
                )}
                {usernameAvailable === false && (
                  <Typography
                    variant="bodyBold"
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
                        variant="bodyBold"
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
                  <Typography variant="bodyBold" style={styles.reviewValue}>
                    {formData.username}
                  </Typography>
                </View>
                <View style={styles.reviewItem}>
                  <Typography variant="bodyBold" style={styles.reviewLabel}>
                    email
                  </Typography>
                  <Typography variant="bodyBold" style={styles.reviewValue}>
                    {formData.email}
                  </Typography>
                </View>
                <View style={styles.reviewItem}>
                  <Typography variant="bodyBold" style={styles.reviewLabel}>
                    college
                  </Typography>
                  <Typography variant="bodyBold" style={styles.reviewValue}>
                    {formData.college}
                  </Typography>
                </View>
              </View>
            </View>
          );
        case 'password':
          return (
            <View style={styles.stepContainer}>
              <Typography variant="h1" style={styles.stepTitle}>
                enter password
              </Typography>
              <Typography variant="body" style={styles.stepSubtitle}>
                enter your password for {formData.email}
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
              loading && styles.buttonDisabled,
              currentStep === 'email' && [
                styles.continueButton,
                !formData.email
                  ? styles.continueButtonDisabled
                  : styles.continueButtonEnabled,
              ],
            ]}
            onPress={
              currentStep === 'password'
                ? handlePasswordSignIn
                : userExist
                ? handleVerifyOTPLogin
                : currentStep === 'review'
                ? handleSubmit
                : handleNext
            }
            disabled={loading || (currentStep === 'email' && !formData.email)}
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
            ) : currentStep === 'email' ? (
              <Typography
                variant="bodyBold"
                style={[
                  styles.buttonText,
                  !formData.email ? styles.buttonTextDisabled : {},
                ]}
              >
                continue
              </Typography>
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
              appSignIn();
            }}
          />
        )}
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
    fontFamily: 'Nunito-Bold',
    fontWeight: '700',
    color: '#333A3C',
    marginBottom: 8,
    textAlign: 'center',
    textTransform: 'lowercase',
  },
  stepSubtitle: {
    fontSize: 16,
    fontFamily: 'Nunito-Bold',
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
    paddingBottom: 10,
  },
  button: {
    width: 56,
    height: 56,
    backgroundColor: '#FFEFB4',
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButton: {
    width: '100%',
    height: 70,
    borderRadius: 38,
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
  continueButtonEnabled: {
    backgroundColor: '#1D1D1D',
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  continueButtonDisabled: {
    backgroundColor: '#1D1D1D',
    borderColor: 'rgba(255, 255, 255, 0.12)',
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 20,
    fontFamily: 'Nunito-Bold',
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'lowercase',
  },
  buttonTextDisabled: {
    color: '#FFFFFF',
    opacity: 0.5,
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
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
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
