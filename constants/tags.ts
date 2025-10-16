export const STORY_TAGS = [
  'Storytime',
  'Venting',
  'Feedback',
  'Hot Take'
] as const;

export type StoryTag = typeof STORY_TAGS[number]; 