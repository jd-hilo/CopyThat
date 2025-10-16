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
  console.log('session :', session, user);
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        setUser(session?.user);
      }
    });
    supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setSession(session);
        if (session?.user) {
          setUser(session?.user);
        }
      } else {
        router.replace('/');
      }
    });
  }, []);
  console.log('user ,user profile :', user, userProfile);

  // 🔹 Load from AsyncStorage first
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
      } catch (err) {
        console.error('Error loading cached session:', err);
      } finally {
        setLoading(false);
      }
    };

    loadCachedSession();

    // Also check Supabase session in case of refresh
    const getSession = async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();
      if (error) console.error(error);

      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        setUser(session.user);
        setUserProfile(profile);

        // 🔹 Cache session & profile
        await AsyncStorage.setItem('session', JSON.stringify(session));
        if (profile) {
          await AsyncStorage.setItem('profile', JSON.stringify(profile));
        }
      }
    };

    getSession();

    // 🔹 Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (_event, session: Session | null) => {
        if (session?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          setUser(session.user);
          setUserProfile(profile);

          // Cache session and profile
          await AsyncStorage.setItem('session', JSON.stringify(session));
          if (profile) {
            await AsyncStorage.setItem('profile', JSON.stringify(profile));
          }
        } else {
          // Clear cache when logged out
          setUser(null);
          setUserProfile(null);
          await AsyncStorage.removeItem('session');
          await AsyncStorage.removeItem('profile');
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
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
