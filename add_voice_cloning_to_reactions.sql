-- Add voice cloning support to reactions table

-- Add cloned_voice_user_id column to reactions table
ALTER TABLE reactions 
ADD COLUMN cloned_voice_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Add is_voice_cloned flag
ALTER TABLE reactions 
ADD COLUMN is_voice_cloned BOOLEAN DEFAULT FALSE;

-- Add index for querying
CREATE INDEX idx_reactions_cloned_voice ON reactions(cloned_voice_user_id) WHERE cloned_voice_user_id IS NOT NULL;

