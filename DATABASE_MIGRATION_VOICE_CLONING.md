# Database Migration for Voice Cloning Feature

## Profiles Table Updates

Add the following columns to the `profiles` table:

```sql
-- Add voice clone ID from Eleven Labs
ALTER TABLE profiles ADD COLUMN voice_clone_id TEXT DEFAULT NULL;

-- Add voice clone status
ALTER TABLE profiles ADD COLUMN voice_clone_status TEXT DEFAULT 'none' CHECK (voice_clone_status IN ('none', 'pending', 'ready', 'failed'));

-- Add voice clone recording URL
ALTER TABLE profiles ADD COLUMN voice_clone_recording_url TEXT DEFAULT NULL;

-- Add index for faster queries
CREATE INDEX idx_profiles_voice_clone_status ON profiles(voice_clone_status) WHERE voice_clone_status = 'ready';
```

## Stories Table Updates

Add the following columns to the `stories` table:

```sql
-- Add flag to indicate if voice was cloned
ALTER TABLE stories ADD COLUMN is_voice_cloned BOOLEAN DEFAULT FALSE;

-- Add original voice user ID (who recorded the original audio)
ALTER TABLE stories ADD COLUMN original_voice_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Add cloned voice user ID (whose voice was used for cloning)
ALTER TABLE stories ADD COLUMN cloned_voice_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Add index for querying voice-cloned stories
CREATE INDEX idx_stories_voice_cloned ON stories(is_voice_cloned) WHERE is_voice_cloned = TRUE;
```

## TypeScript Type Updates

Update your `types/supabase.ts` file to include these new fields in the generated types. If using Supabase CLI, run:

```bash
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > types/supabase.ts
```

Or manually add to your Database interface:

```typescript
profiles: {
  Row: {
    // ... existing fields
    voice_clone_id: string | null;
    voice_clone_status: 'none' | 'pending' | 'ready' | 'failed';
    voice_clone_recording_url: string | null;
  };
  // ... Insert and Update types
};

stories: {
  Row: {
    // ... existing fields
    is_voice_cloned: boolean;
    original_voice_user_id: string | null;
    cloned_voice_user_id: string | null;
  };
  // ... Insert and Update types
};
```

## Testing the Migration

After running the migration, verify:

1. Check that profiles table has new columns:
   ```sql
   SELECT column_name, data_type FROM information_schema.columns 
   WHERE table_name = 'profiles' 
   AND column_name IN ('voice_clone_id', 'voice_clone_status', 'voice_clone_recording_url');
   ```

2. Check that stories table has new columns:
   ```sql
   SELECT column_name, data_type FROM information_schema.columns 
   WHERE table_name = 'stories' 
   AND column_name IN ('is_voice_cloned', 'original_voice_user_id', 'cloned_voice_user_id');
   ```

3. Verify defaults are working:
   ```sql
   SELECT voice_clone_status FROM profiles LIMIT 1;
   -- Should return 'none' for existing profiles
   ```

## Rollback (If Needed)

```sql
-- Profiles table
ALTER TABLE profiles DROP COLUMN IF EXISTS voice_clone_id;
ALTER TABLE profiles DROP COLUMN IF EXISTS voice_clone_status;
ALTER TABLE profiles DROP COLUMN IF EXISTS voice_clone_recording_url;
DROP INDEX IF EXISTS idx_profiles_voice_clone_status;

-- Stories table
ALTER TABLE stories DROP COLUMN IF EXISTS is_voice_cloned;
ALTER TABLE stories DROP COLUMN IF EXISTS original_voice_user_id;
ALTER TABLE stories DROP COLUMN IF EXISTS cloned_voice_user_id;
DROP INDEX IF EXISTS idx_stories_voice_cloned;
```

