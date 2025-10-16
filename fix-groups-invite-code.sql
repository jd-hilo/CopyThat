-- Add invite_code column to groups table
ALTER TABLE groups
ADD COLUMN invite_code text;

-- Create unique index on invite_code to ensure no duplicates
CREATE UNIQUE INDEX idx_groups_invite_code ON groups(invite_code)
WHERE invite_code IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN groups.invite_code IS 'Unique code used for inviting users to join the group';










