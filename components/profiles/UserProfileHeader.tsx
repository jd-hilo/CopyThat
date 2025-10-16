import { View, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { User } from '@/constants/mockData';
import { Typography } from '../ui/Typography';
import { Button } from '../ui/Button';
import { theme } from '@/constants/theme';

interface UserProfileHeaderProps {
  user: User;
  isCurrentUser?: boolean;
  onEditProfile?: () => void;
  onFollowUser?: () => void;
}

export function UserProfileHeader({
  user,
  isCurrentUser = false,
  onEditProfile,
  onFollowUser
}: UserProfileHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Image source={{ uri: user.profileImage }} style={styles.profileImage} />
        
        <View style={styles.userInfo}>
          <Typography variant="h2">{user.name}</Typography>
          <Typography variant="bodySmall" color={theme.colors.text.secondary}>
            @{user.username}
          </Typography>
          
          {user.bio && (
            <Typography 
              variant="body" 
              color={theme.colors.text.secondary}
              style={styles.bio}
            >
              {user.bio}
            </Typography>
          )}
        </View>
      </View>
      
      <View style={styles.stats}>
        <View style={styles.stat}>
          <Typography variant="h3">{user.followersCount}</Typography>
          <Typography variant="bodySmall" color={theme.colors.text.secondary}>
            Followers
          </Typography>
        </View>
        
        <View style={styles.statDivider} />
        
        <View style={styles.stat}>
          <Typography variant="h3">{user.followingCount}</Typography>
          <Typography variant="bodySmall" color={theme.colors.text.secondary}>
            Following
          </Typography>
        </View>
      </View>
      
      <View style={styles.actionContainer}>
        {isCurrentUser ? (
          <Button 
            variant="secondary" 
            style={styles.actionButton}
            onPress={onEditProfile}
          >
            Edit Profile
          </Button>
        ) : (
          <Button 
            style={styles.actionButton}
            onPress={onFollowUser}
          >
            Follow
          </Button>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.divider,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: theme.spacing.md,
  },
  userInfo: {
    flex: 1,
  },
  bio: {
    marginTop: theme.spacing.xs,
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  stat: {
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: theme.colors.divider,
  },
  actionContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  actionButton: {
    minWidth: 150,
  },
});