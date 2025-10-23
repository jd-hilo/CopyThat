import { Category } from './theme';
import { College } from '@/types/supabase';

export interface User {
  id: string;
  username: string;
  name: string;
  profileImage: string;
  bio?: string;
  friend_count: number;
  friend_request_count: number;
  college: College | null;
  points: number;
}
type EmojiType = 'heart' | 'fire' | 'laugh' | 'wow' | 'sad';

interface EmojiReaction {
  id: string;
  story_id: string;
  user_id: string;
  emoji_type: EmojiType;
  created_at: string;
  uid:string
}
interface EmojiReactionCount {
  story_id: string;
  emoji_type: EmojiType;
  count: number;
}
export interface AudioStory {
  id: string;
  title: string;
  description?: string;
  transcription?: string;
  audioUrl: string;
  duration: number; // in seconds
  createdAt: string;
  category: Category;
  user: User;
  creatorId?: string; // The actual user who created the story (for ownership checks)
  reactionCount: number;
  likeCount: number;
  isLiked: boolean;
  isPrivate: boolean;
  isFriendsOnly: boolean;
   userReaction?: EmojiReaction | null;
  reactionCounts?: EmojiReactionCount[] | [];
}

export interface AudioReaction {
  id: string;
  audioUrl: string;
  duration: number; // in seconds
  createdAt: string;
  user: User;
  storyId: string;
  likeCount: number;
  isLiked: boolean;
}

// Example users
export const users: User[] = [
  {
    id: '1',
    username: 'alex_producer',
    name: 'Alex Johnson',
    profileImage: 'https://images.pexels.com/photos/2379005/pexels-photo-2379005.jpeg?auto=compress&cs=tinysrgb&w=300',
    bio: 'Audio storyteller & podcast host. Sharing stories that matter.',
    friend_count: 512,
    friend_request_count: 0,
    college: 'Harvard',
    points: 0
  },
  {
    id: '2',
    username: 'sarahvoice',
    name: 'Sarah Williams',
    profileImage: 'https://images.pexels.com/photos/1587009/pexels-photo-1587009.jpeg?auto=compress&cs=tinysrgb&w=300',
    bio: 'Voice artist with a passion for narration and audio content',
    friend_count: 418,
    friend_request_count: 0,
    college: 'Yale',
    points: 0
  },
  {
    id: '3',
    username: 'miketechnical',
    name: 'Mike Chen',
    profileImage: 'https://images.pexels.com/photos/2804282/pexels-photo-2804282.jpeg?auto=compress&cs=tinysrgb&w=300',
    bio: 'Tech reviewer and audio enthusiast. Let\'s talk gadgets!',
    friend_count: 231,
    friend_request_count: 0,
    college: 'MIT',
    points: 0
  },
  {
    id: '4',
    username: 'janedoe',
    name: 'Jane Doe',
    profileImage: 'https://images.pexels.com/photos/1542085/pexels-photo-1542085.jpeg?auto=compress&cs=tinysrgb&w=300',
    bio: 'Sharing my thoughts one audio clip at a time',
    friend_count: 354,
    friend_request_count: 0,
    college: 'Stanford',
    points: 0
  },
  {
    id: '5',
    username: 'davidcreator',
    name: 'David Wilson',
    profileImage: 'https://images.pexels.com/photos/1681010/pexels-photo-1681010.jpeg?auto=compress&cs=tinysrgb&w=300',
    bio: 'Creator and storyteller. Audio is my medium of choice.',
    friend_count: 512,
    friend_request_count: 0,
    college: 'Harvard',
    points: 0
  }
];

export const mockStories: AudioStory[] = [
  {
    id: '1',
    title: 'The Future of AI in Our Daily Lives',
    description: 'Exploring how artificial intelligence is seamlessly integrating into our routines and what we can expect in the coming years.',
    audioUrl: 'https://example.com/audio1.mp3',
    duration: 184, // 3:04
    createdAt: '2023-11-15T14:32:00Z',
    category: 'Technology',
    user: users[2],
    reactionCount: 42,
    likeCount: 156,
    isLiked: false,
    isPrivate: false,
    isFriendsOnly: false
  },
  {
    id: '2',
    title: 'Morning Meditation for Productivity',
    description: 'A quick 5-minute guided meditation to start your day with focus and clarity.',
    audioUrl: 'https://example.com/audio2.mp3',
    duration: 302, // 5:02
    createdAt: '2023-11-14T08:15:00Z',
    category: 'Health',
    user: users[1],
    reactionCount: 18,
    likeCount: 243,
    isLiked: true,
    isPrivate: false,
    isFriendsOnly: false
  },
  {
    id: '3',
    title: 'Breaking: New Climate Policy Announced',
    description: 'Analysis of the groundbreaking climate policy unveiled today and what it means for global sustainability efforts.',
    audioUrl: 'https://example.com/audio3.mp3',
    duration: 245, // 4:05
    createdAt: '2023-11-13T16:45:00Z',
    category: 'News',
    user: users[0],
    reactionCount: 56,
    likeCount: 189,
    isLiked: false,
    isPrivate: false,
    isFriendsOnly: false
  },
  {
    id: '4',
    title: 'Behind the Scenes of My Latest Project',
    description: 'Taking you through the creative process and challenges faced while developing my new app.',
    audioUrl: 'https://example.com/audio4.mp3',
    duration: 421, // 7:01
    createdAt: '2023-11-12T21:10:00Z',
    category: 'Personal',
    user: users[4],
    reactionCount: 24,
    likeCount: 118,
    isLiked: true,
    isPrivate: false,
    isFriendsOnly: false
  },
  {
    id: '5',
    title: 'Weekly Comedy Roundup: Episode 12',
    description: 'Highlighting the funniest moments from the week and adding my own comedic spin.',
    audioUrl: 'https://example.com/audio5.mp3',
    duration: 378, // 6:18
    createdAt: '2023-11-11T19:30:00Z',
    category: 'Comedy',
    user: users[3],
    reactionCount: 87,
    likeCount: 315,
    isLiked: false,
    isPrivate: false,
    isFriendsOnly: false
  },
  {
    id: '6',
    title: 'How I Built a 7-Figure E-commerce Business',
    description: 'Sharing the strategies and lessons learned while scaling my online business to seven figures.',
    audioUrl: 'https://example.com/audio6.mp3',
    duration: 542, // 9:02
    createdAt: '2023-11-10T11:25:00Z',
    category: 'Business',
    user: users[2],
    reactionCount: 31,
    likeCount: 276,
    isLiked: true,
    isPrivate: false,
    isFriendsOnly: false
  },
  {
    id: '7',
    title: 'Concert Review: Live at Madison Square Garden',
    description: 'My thoughts on last night\'s incredible performance and the electric atmosphere of the venue.',
    audioUrl: 'https://example.com/audio7.mp3',
    duration: 296, // 4:56
    createdAt: '2023-11-09T09:45:00Z',
    category: 'Music',
    user: users[1],
    reactionCount: 42,
    likeCount: 198,
    isLiked: false,
    isPrivate: false,
    isFriendsOnly: false
  }
];

export const mockReactions: AudioReaction[] = [
  {
    id: '101',
    audioUrl: 'https://example.com/reaction1.mp3',
    duration: 28, // 0:28
    createdAt: '2023-11-15T16:32:00Z',
    user: users[1],
    storyId: '1',
    likeCount: 12,
    isLiked: false
  },
  {
    id: '102',
    audioUrl: 'https://example.com/reaction2.mp3',
    duration: 15, // 0:15
    createdAt: '2023-11-15T18:45:00Z',
    user: users[3],
    storyId: '1',
    likeCount: 8,
    isLiked: true
  },
  {
    id: '103',
    audioUrl: 'https://example.com/reaction3.mp3',
    duration: 22, // 0:22
    createdAt: '2023-11-14T10:12:00Z',
    user: users[0],
    storyId: '2',
    likeCount: 19,
    isLiked: false
  },
  {
    id: '104',
    audioUrl: 'https://example.com/reaction4.mp3',
    duration: 18, // 0:18
    createdAt: '2023-11-13T21:23:00Z',
    user: users[4],
    storyId: '3',
    likeCount: 7,
    isLiked: true
  }
];