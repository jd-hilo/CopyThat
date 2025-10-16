-- Drop existing problematic policies
DROP POLICY IF EXISTS "Group members can view group membership" ON group_members;
DROP POLICY IF EXISTS "Group admins can manage membership" ON group_members;

-- Create new policies for group_members table
-- Allow viewing group membership if:
-- 1. The user is a member of the group (their ID matches)
-- 2. The user is viewing a public group
CREATE POLICY "Group members can view group membership"
ON group_members FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM groups g
    WHERE g.id = group_members.group_id
    AND g.is_public = true
  )
);

-- Allow group admins and moderators to manage membership
CREATE POLICY "Group admins can manage membership"
ON group_members FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM groups g
    WHERE g.id = group_members.group_id
    AND g.created_by = auth.uid()
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM groups g
    WHERE g.id = group_members.group_id
    AND g.created_by = auth.uid()
  )
);

-- Allow users to join/leave groups
CREATE POLICY "Users can manage their own membership"
ON group_members FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM groups g
    WHERE g.id = group_members.group_id
    AND (g.is_public = true OR g.created_by = auth.uid())
  )
);

CREATE POLICY "Users can leave groups"
ON group_members FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Update the groups policies to be more straightforward
DROP POLICY IF EXISTS "Public groups are viewable by everyone" ON groups;
DROP POLICY IF EXISTS "Group members can view their groups" ON groups;

CREATE POLICY "Groups are viewable by members or if public"
ON groups FOR SELECT
TO authenticated
USING (
  is_public = true OR
  created_by = auth.uid() OR
  EXISTS (
    SELECT 1 FROM group_members gm
    WHERE gm.group_id = id
    AND gm.user_id = auth.uid()
  )
);

-- Keep existing policies for group creation and updates
-- But add a policy for group deletion
CREATE POLICY "Group creators can delete their groups"
ON groups FOR DELETE
TO authenticated
USING (created_by = auth.uid());










