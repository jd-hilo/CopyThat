// AuthContext.tsx
import * as React from 'react';
import { supabase } from '@/lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Database } from '@/types/supabase';
import { AppState } from 'react-native';
import { router } from 'expo-router';

type EmojiType = 'heart' | 'fire' | 'laugh' | 'wow' | 'sad';

interface EmojiReaction {
  id: string;
  story_id: string;
  user_id: string;
  emoji_type: EmojiType;
  created_at: string;
}
interface EmojiReactionCount {
  story_id: string;
  emoji_type: EmojiType;
  count: number;
}
interface FormattedStory {
  id: string;
  title: string;
  description?: string;
  transcription?: string;
  audioUrl: string;
  duration: number;
  createdAt: string;
  createdAtMs: number;
  category: Category;
  isPrivate: boolean;
  isFriendsOnly: boolean;
  reactionCount: number;
  likeCount: number;
  isLiked: boolean;
  user: {
    id: string;
    name: string;
    username: string;
    profileImage: string;
    college: string | null;
    friend_count: number;
    friend_request_count: number;
    points: number;
  };
  userReaction?: EmojiReaction | null;
  reactionCounts?: EmojiReactionCount[] | [];
}

type AuthContextType = {
  user: User | null;
  userProfile: Profile | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  setUserProfile: React.Dispatch<React.SetStateAction<Profile | null>>;
  signUp: (options: { email: string; password: string }) => Promise<void>;
  signIn: (options: { email: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
};

type Profile = Database['public']['Tables']['profiles']['Row'];

const AuthContext = createContext<AuthContextType | undefined>(undefined);
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  console.log('session :', session, user);
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error('Auth session error:', error);
          return;
        }
        setSession(session);
        if (session?.user) {
          setUser(session?.user);
        }
        setIsInitialized(true);
      } catch (error) {
        console.error('Error initializing auth:', error);
        setIsInitialized(true);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      try {
        if (session) {
          setSession(session);
          if (session?.user) {
            setUser(session?.user);
          }
        } else {
          // Don't navigate immediately, let the component handle the redirect
          setUser(null);
          setUserProfile(null);
        }
      } catch (error) {
        console.error('Auth state change error:', error);
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  // Set initialized after the first auth check
  useEffect(() => {
    if (isInitialized) {
      setLoading(false);
    }
  }, [isInitialized]);
  console.log('user ,user profile :', user, userProfile);

  // Load cached session immediately for faster startup
  useEffect(() => {
    const loadCachedSession = async () => {
      try {
        const cachedSession = await AsyncStorage.getItem('session');
        const cachedProfile = await AsyncStorage.getItem('profile');

        if (cachedSession) {
          const parsedSession: Session = JSON.parse(cachedSession);
          setUser(parsedSession.user);
        }
        if (cachedProfile) {
          setUserProfile(JSON.parse(cachedProfile));
        }
        setLoading(false); // Set loading to false immediately after loading cache
      } catch (err) {
        console.error('Error loading cached session:', err);
        setLoading(false);
      }
    };

    loadCachedSession();

    // Background session refresh (non-blocking)
    const refreshSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error('Supabase session error:', error);
          return;
        }

        if (session?.user) {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (!profileError && profile) {
            setUser(session.user);
            setUserProfile(profile);
            
            // Update cache
            try {
              await AsyncStorage.setItem('session', JSON.stringify(session));
              await AsyncStorage.setItem('profile', JSON.stringify(profile));
            } catch (cacheError) {
              console.error('Cache error:', cacheError);
            }
          }
        }
      } catch (error) {
        console.error('Error refreshing session:', error);
      }
    };

    // Refresh session in background after a short delay
    setTimeout(refreshSession, 100);

    // 🔹 Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (_event, session: Session | null) => {
        try {
          if (session?.user) {
            const { data: profile, error: profileError } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .maybeSingle();

            if (profileError) {
              console.error('Profile fetch error in auth change:', profileError);
            }
            
            // If profile doesn't exist yet, that's okay during signup
            if (profileError && profileError.code === 'PGRST116') {
              console.log('Profile does not exist yet - this is normal during signup');
            }

            setUser(session.user);
            setUserProfile(profile);

            // Cache session and profile
            try {
              await AsyncStorage.setItem('session', JSON.stringify(session));
              if (profile) {
                await AsyncStorage.setItem('profile', JSON.stringify(profile));
              }
            } catch (cacheError) {
              console.error('Cache error in auth change:', cacheError);
            }
          } else {
            // Clear cache when logged out - don't navigate here
            setUser(null);
            setUserProfile(null);
            try {
              await AsyncStorage.removeItem('session');
              await AsyncStorage.removeItem('profile');
            } catch (cacheError) {
              console.error('Cache clear error:', cacheError);
            }
          }
        } catch (error) {
          console.error('Error in auth state change:', error);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async ({
    email,
    password,
  }: {
    email: string;
    password: string;
  }) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  };

  const signIn = async ({
    email,
    password,
  }: {
    email: string;
    password: string;
  }) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    // 🔹 Clear cache when logging out
    await AsyncStorage.removeItem('session');
    await AsyncStorage.removeItem('profile');
    setUser(null);
    setUserProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        setUser,
        setUserProfile,
        signUp,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
