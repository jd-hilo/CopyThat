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
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Typography, TextInput, SpinningHeadphone } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { College, COLLEGES } from '@/constants/colleges';
// Tracking functions disabled - keeping imports for compatibility
const trackAccountCreated = () => {
  console.log('Account Created tracked (disabled)');
};

const trackEmailEntered = () => {
  console.log('Email Entered tracked (disabled)');
};
import * as AppleAuthentication from 'expo-apple-authentication';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
type Step = 'email' | 'password' | 'firstname' | 'profilepicture' | 'review';

export default function SignUpScreen() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstname: '',
    college: '' as College,
    avatarUrl: '',
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
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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

    if (field === 'firstname') {
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
      case 'password':
        if (!formData.password?.trim()) return 'Password is required';
        break;
      case 'firstname':
        if (!formData.firstname?.trim()) return 'First name is required';
        const usernameRegex = /^[a-zA-Z0-9_]+$/;
        if (!usernameRegex.test(formData.firstname.trim())) {
          return 'First name can only contain letters, numbers, and underscores';
        }
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
    
    const error = validateStep(currentStep);
    if (error) {
      console.log('Validation error:', error);
      setError(error);
      return;
    }
    setError(null);

    // Handle password step separately (need to check if user exists first)
    if (currentStep === 'password') {
      console.log('Attempting password sign-in if user exists');
      setLoading(true);
      try {
        const {
          data: { user },
          error: signInError,
        } = await supabase.auth.signInWithPassword({
          email: formData.email.toLowerCase(),
          password: formData.password,
        });

        if (!signInError && user) {
          console.log('User exists and signed in successfully, routing to tabs');
          // Small delay to ensure session state is updated
          await new Promise((resolve) => setTimeout(resolve, 300));
          router.replace('/(tabs)');
          return; // Exit early - don't proceed to next step
        }
      } catch (e) {
        // Ignore and proceed to signup flow
        console.log('Password sign-in attempt failed, proceeding to signup');
      }
      
      // If sign-in didn't succeed, proceed to firstname (new account flow)
      setLoading(false);
      animateTransition('next');
      setCurrentStep('firstname');
      console.log('=== handleNext END (password -> firstname) ===');
      return;
    }

    // Handle other steps
    animateTransition('next');

    switch (currentStep) {
      case 'email':
        console.log('Moving from email to password step');
        setCurrentStep('password');
        break;
      case 'firstname':
        console.log('Moving from firstname to profilepicture step');
        setCurrentStep('profilepicture');
        break;
      case 'profilepicture':
        console.log('Moving from profilepicture to review step');
        setCurrentStep('review');
        break;
    }
    console.log('=== handleNext END ===');
  };

  const handleBack = () => {
    animateTransition('back');
    switch (currentStep) {
      case 'password':
        setCurrentStep('email');
        break;
      case 'firstname':
        setCurrentStep('password');
        break;
      case 'profilepicture':
        setCurrentStep('firstname');
        break;
      case 'review':
        setCurrentStep('profilepicture');
        break;
    }
  };

  const handleUploadImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        setError('Please allow access to your photo library');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets[0].uri) {
        setSelectedImage(result.assets[0].uri);
        setFormData((prev) => ({
          ...prev,
          avatarUrl: result.assets[0].base64 || '',
        }));
      }
    } catch (error) {
      console.error('Error picking image:', error);
      setError('Failed to select image. Please try again.');
    }
  };

  const handleSkipProfilePicture = () => {
    setSelectedImage(null);
    setFormData((prev) => ({
      ...prev,
      avatarUrl: '',
    }));
    animateTransition('next');
    setCurrentStep('review');
  };

  const handleSubmit = async () => {
    try {
      console.log('=== handleSubmit START ===');
      console.log('Form data:', formData);
      console.log('Loading state:', loading);

      setError(null);
      setLoading(true);

      // Sign up with email and password (auto-confirm to skip email verification)
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: formData.email.toLowerCase(),
        password: formData.password,
        options: {
          emailRedirectTo: undefined,
        },
      });

      if (signUpError) {
        console.error('Sign up error:', signUpError);
        // Handle rate limiting error with a user-friendly message
        if (signUpError.message.includes('security purposes')) {
          setError('Please wait a moment before trying again');
          setLoading(false);
          return;
        }
        
        // Handle user already exists - try to sign in instead
        if (signUpError.message.includes('already registered') || 
            signUpError.message.includes('already exists') ||
            signUpError.message.includes('User already registered')) {
          console.log('User already exists, attempting sign in...');
          
          // Try to sign in with the provided password
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: formData.email.toLowerCase(),
            password: formData.password,
          });
          
          if (signInError) {
            setError('This email is already registered. Please use the sign in page or reset your password.');
            setLoading(false);
            return;
          }
          
          // Sign in successful, check if user has completed profile
          if (signInData.user) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', signInData.user.id)
              .single();
            
            if (profile && profile.username) {
              // Profile exists, go to tabs
              router.replace({ pathname: '/(tabs)', params: { id: id } });
            } else {
              // No profile, continue with profile creation
              // Won't work because user already has an account
              setError('Please use the sign in page to access your existing account.');
            }
            setLoading(false);
            return;
          }
        }
        
        throw signUpError;
      }

      console.log('User account created successfully:', data.user);
      console.log('Session from signup:', data.session);

      if (!data.user) {
        throw new Error('No user returned from sign up');
      }

      // If no session, email confirmation is required
      // Show message but allow them to check their email
      if (!data.session) {
        console.log('Email confirmation required');
        setError('Account created! Please check your email and click the confirmation link to continue.');
        setLoading(false);
        return;
      }

      // Session exists, proceed with profile setup
      let avatarUrl = 'https://dqthkfmvvedzyowhyeyd.supabase.co/storage/v1/object/public/avatars/default.png';
      
      if (formData.avatarUrl && selectedImage) {
        console.log('Uploading profile picture...');
        const fileName = `${data.user.id}/${Date.now()}.jpg`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, decode(formData.avatarUrl), {
            contentType: 'image/jpeg',
            upsert: true,
          });

        if (uploadError) {
          console.error('Upload error:', uploadError);
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(fileName);
          avatarUrl = publicUrl;
          console.log('Profile picture uploaded:', avatarUrl);
        }
      }

      // Create user profile
      await createUserProfile(data.user.id, avatarUrl);

      // Redirect to onboarding flow
      console.log('Redirecting to onboarding flow...');
      router.push('/onboarding-mic');
      console.log('=== handleSubmit END ===');
    } catch (err) {
      console.error('handleSubmit catch error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred during sign up');
    } finally {
      setLoading(false);
      console.log('handleSubmit loading set to false');
    }
  };

  const createUserProfile = async (userId: string, avatarUrl: string) => { 
    const { data: existingProfile, error: existingProfileError } =
      await supabase.from('profiles').select('*').eq('id', userId).single();

    if (existingProfileError) {
      console.log('Profile query error:', existingProfileError);
    }

    console.log('Existing profile:', existingProfile);

    if (!existingProfile) {
      console.log('No existing profile, creating new profile...');
      const { error: profileError } = await supabase.from('profiles').insert({
        id: userId,
        username: formData.firstname.trim(),
        college: 'None of the Above',
        avatar_url: avatarUrl,
      });

      if (profileError) {
        console.error('Profile creation error:', profileError);
        throw profileError;
      }

      console.log('Profile created successfully');
    } else {
      console.log('Profile already exists, skipping creation');
    }

    console.log('Tracking account created event...');
    trackAccountCreated();
  };

  const appSignIn = async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      
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
                firstname: credential.fullName?.givenName ?? '',
              }));
              setCurrentStep('firstname');
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
                let's get started with your account
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
        case 'password':
          return (
            <View style={styles.stepContainer}>
              <Typography variant="h1" style={styles.stepTitle}>
                create password
              </Typography>
              <Typography variant="body" style={styles.stepSubtitle}>
                choose a secure password
              </Typography>
              <TextInput
                value={formData.password}
                onChangeText={(value) => handleInputChange('password', value)}
                placeholder="enter your password"
                secureTextEntry
                style={styles.input}
                placeholderTextColor="#8A8E8F"
              />
            </View>
          );
        case 'firstname':
          return (
            <View style={styles.stepContainer}>
              <Typography variant="h1" style={styles.stepTitle}>
                what's your first name?
              </Typography>
              <Typography variant="body" style={styles.stepSubtitle}>
                this is how friends will know you
              </Typography>
              <View style={styles.inputContainer}>
                <TextInput
                  value={formData.firstname}
                  onChangeText={(value) =>
                    handleInputChange('firstname', value.toLowerCase())
                  }
                  placeholder="enter your first name"
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
                    name available
                  </Typography>
                )}
                {usernameAvailable === false && (
                  <Typography
                    variant="bodyBold"
                    style={[styles.availabilityText, styles.unavailableText]}
                  >
                    name taken
                  </Typography>
                )}
              </View>
            </View>
          );
        case 'profilepicture':
          return (
            <View style={styles.stepContainer}>
              <Typography variant="h1" style={styles.stepTitle}>
                add profile picture
              </Typography>
              <Typography variant="body" style={styles.stepSubtitle}>
                let friends recognize you
              </Typography>
              <View style={styles.profilePictureContainer}>
                {selectedImage ? (
                  <Image
                    source={{ uri: selectedImage }}
                    style={styles.profilePicturePreview}
                  />
                ) : (
                  <View style={styles.profilePicturePlaceholder}>
                    <Ionicons name="person" size={64} color="#8A8E8F" />
                  </View>
                )}
                <TouchableOpacity
                  style={styles.uploadButton}
                  onPress={handleUploadImage}
                >
                  <Typography variant="bodyBold" style={styles.uploadButtonText}>
                    {selectedImage ? 'change photo' : 'choose photo'}
                  </Typography>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.skipButton}
                  onPress={handleSkipProfilePicture}
                >
                  <Typography variant="body" style={styles.skipButtonText}>
                    skip for now
                  </Typography>
                </TouchableOpacity>
              </View>
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
                {selectedImage && (
                  <Image
                    source={{ uri: selectedImage }}
                    style={styles.reviewAvatar}
                  />
                )}
                <View style={styles.reviewItem}>
                  <Typography variant="bodyBold" style={styles.reviewLabel}>
                    first name
                  </Typography>
                  <Typography variant="bodyBold" style={styles.reviewValue}>
                    {formData.firstname}
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
              currentStep === 'review'
                ? handleSubmit
                : currentStep === 'profilepicture'
                ? handleNext
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
    backgroundColor: '#fffc00',
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
    backgroundColor: '#fffc00',
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
  profilePictureContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: 20,
  },
  profilePicturePreview: {
    width: 150,
    height: 150,
    borderRadius: 75,
    marginBottom: 20,
    borderWidth: 3,
    borderColor: '#fffc00',
  },
  profilePicturePlaceholder: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#F8F8F8',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 3,
    borderColor: '#E5E5E5',
  },
  uploadButton: {
    backgroundColor: '#fffc00',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginBottom: 12,
    width: '100%',
  },
  uploadButtonText: {
    fontSize: 16,
    fontFamily: 'Nunito-Bold',
    fontWeight: '700',
    color: '#333A3C',
    textAlign: 'center',
    textTransform: 'lowercase',
  },
  skipButton: {
    paddingVertical: 12,
  },
  skipButtonText: {
    fontSize: 14,
    fontFamily: 'Nunito',
    color: '#8A8E8F',
    textAlign: 'center',
    textTransform: 'lowercase',
  },
  reviewAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#fffc00',
  },
});
