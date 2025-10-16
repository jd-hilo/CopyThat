-- Drop existing problematic policies
DROP POLICY IF EXISTS "Group members can view group membership" ON group_members;
DROP POLICY IF EXISTS "Group admins can manage membership" ON group_members;
DROP POLICY IF EXISTS "Users can manage their own membership" ON group_members;
DROP POLICY IF EXISTS "Users can leave groups" ON group_members;

-- Create new simplified policies

-- Allow users to view group members for groups they belong to or public groups
CREATE POLICY "View group members"
ON group_members FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM groups g
    WHERE g.id = group_members.group_id
    AND (
      g.is_public = true
      OR g.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM group_members gm
        WHERE gm.group_id = group_members.group_id
        AND gm.user_id = auth.uid()
      )
    )
  )
);

-- Allow group creators to manage members
CREATE POLICY "Group creators can manage members"
ON group_members FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM groups g
    WHERE g.id = group_members.group_id
    AND g.created_by = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM groups g
    WHERE g.id = group_members.group_id
    AND g.created_by = auth.uid()
  )
);

-- Allow users to join groups (either their own membership or via invite)
CREATE POLICY "Users can join groups"
ON group_members FOR INSERT
TO authenticated
WITH CHECK (
  -- User can only set their own user_id
  user_id = auth.uid()
  OR
  -- Group creator can add any user
  EXISTS (
    SELECT 1 FROM groups g
    WHERE g.id = group_members.group_id
    AND g.created_by = auth.uid()
  )
);

-- Allow users to leave groups
CREATE POLICY "Users can leave groups"
ON group_members FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM groups g
    WHERE g.id = group_members.group_id
    AND g.created_by = auth.uid()
  )
);

-- Add comment for documentation
COMMENT ON TABLE group_members IS 'Stores group membership information with role-based access control';










