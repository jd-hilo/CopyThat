-- First, disable RLS temporarily to make changes
ALTER TABLE group_members DISABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies for group_members
DROP POLICY IF EXISTS "Group members can view group membership" ON group_members;
DROP POLICY IF EXISTS "Group admins can manage membership" ON group_members;
DROP POLICY IF EXISTS "Users can manage their own membership" ON group_members;
DROP POLICY IF EXISTS "Users can leave groups" ON group_members;

-- Create ONE simple policy for viewing
CREATE POLICY "Anyone can view group members"
ON group_members FOR SELECT
TO authenticated
USING (true);

-- Create ONE simple policy for inserting
CREATE POLICY "Users can join groups"
ON group_members FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Create ONE simple policy for deleting
CREATE POLICY "Users can remove themselves"
ON group_members FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Re-enable RLS
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;










