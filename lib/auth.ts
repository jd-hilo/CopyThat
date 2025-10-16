import { supabase } from './supabase';
import { College } from '@/types/supabase';

export async function signUp(email: string, password: string, username: string, college: College) {
  try {
    // Log input values
    console.debug('SignUp called with:', {
      email,
      username,
      college,
      password: '***'
    });

    // Basic validation
    if (!email?.trim() || !password?.trim() || !username?.trim() || !college) {
      console.debug('Validation failed:', {
        email: !email?.trim(),
        password: !password?.trim(),
        username: !username?.trim(),
        college: !college
      });
      throw new Error('All fields are required');
    }

    // Log the data being sent to Supabase
    console.debug('Sending to Supabase:', {
      email: email.trim(),
      username: username.trim(),
      college
    });

    // Sign up with Supabase
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: password.trim(),
      options: {
        data: {
          username: username.trim(),
          college: college,
          full_name: '',
          avatar_url: '',
          friend_count: 0,
          friend_request_count: 0,
        },
      },
    });

    if (error) {
      console.error('Supabase signup error:', error);
      throw error;
    }

    // After successful signup, create the profile
    if (data.user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: data.user.id,
          username: username.trim(),
          college: college,
          full_name: '',
          avatar_url: '',
          friend_count: 0,
          friend_request_count: 0,
        });

      if (profileError) {
        console.error('Error creating profile:', profileError);
        throw profileError;
      }
    }

    console.debug('Signup successful:', { userId: data.user?.id });
    return { data, error: null };
  } catch (error) {
    console.error('Error in signUp:', error);
    return { data: null, error };
  }
}

export async function signIn(email: string, password: string) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error in signIn:', error);
    return { data: null, error };
  }
}

export async function signOut() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return { error: null };
  } catch (error) {
    console.error('Error in signOut:', error);
    return { error };
  }
}

export async function getCurrentUser() {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;

    // If no user is authenticated, return null
    if (!user) {
      return { user: null, error: null };
    }

    // Fetch the user's profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle(); // Use maybeSingle() instead of single() to handle cases where profile might not exist

    // If there's a profile error that's not just "no rows returned", throw it
    if (profileError && !profileError.message.includes('JSON object requested, multiple (or no) rows returned')) {
      throw profileError;
    }

    // Return user data with profile if it exists, otherwise just return user data
    return {
      user: {
        ...user,
        profile: profile || null
      },
      error: null
    };
  } catch (error) {
    console.error('Error in getCurrentUser:', error);
    return { user: null, error };
  }
}