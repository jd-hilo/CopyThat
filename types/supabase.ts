export type Database = {
  public: {
    Tables: {
      groups: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          avatar_url: string | null;
          college: string | null;
          is_public: boolean;
          created_by: string;
          created_at: string;
          updated_at: string;
          invite_code: string | null;
          member_count?: number;
        };
      };
      group_members: {
        Row: {
          id: string;
          group_id: string;
          user_id: string;
          role: 'admin' | 'moderator' | 'member';
          joined_at: string;
        };
      };
      profiles: {
        Row: {
          id: string;
          username: string;
          full_name: string | null;
          avatar_url: string | null;
          friend_count: number;
          friend_request_count: number;
          college: string | null;
          created_at: string;
          bio: string | null;
          points: number;
          complete_profile:boolean;
        };
      };
      stories: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          audio_url: string;
          duration: number;
          category: string;
          user_id: string;
          reaction_count: number;
          like_count: number;
          is_private: boolean;
          is_friends_only: boolean;
          transcription: string | null;
          created_at: string;
          updated_at: string;
          is_group_story: boolean;
          is_voice_cloned: boolean | null;
          original_voice_user_id: string | null;
          cloned_voice_user_id: string | null;
        };
      };
      reactions: {
        Row: {
          id: string;
          story_id: string;
          user_id: string;
          audio_url: string;
          duration: number;
          like_count: number;
          transcription: string | null;
          created_at: string;
          read: boolean;
        };
      };
      friend_requests: {
        Row: {
          id: string;
          sender_id: string;
          receiver_id: string;
          status: 'pending' | 'accepted' | 'rejected';
          created_at: string;
        };
      };
    };
  };
};

export type College = string;

