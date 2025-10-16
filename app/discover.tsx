import React, { useState } from 'react';
import { View, StyleSheet, FlatList, TextInput, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, TrendingUp, Bookmark } from 'lucide-react-native';
import { Typography } from '@/components/ui/Typography';
import { StoryCard } from '@/components/stories/StoryCard';
import { CategorySelector } from '@/components/audio/CategorySelector';
import { theme, Category, categories } from '@/constants/theme';
import { mockStories, AudioStory } from '@/constants/mockData';

const trendingTopics = [
  'Technology News',
  'Morning Motivation',
  'Travel Stories',
  'Business Tips',
  'Comedy Hour'
];

export default function DiscoverScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category | undefined>();
  const [activeTab, setActiveTab] = useState<'trending' | 'categories'>('trending');

  const handleCategorySelect = (category: Category) => {
    setSelectedCategory(category);
  };

  const filteredStories = selectedCategory
    ? mockStories.filter(story => story.category === selectedCategory)
    : mockStories;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Typography variant="h1">Discover</Typography>
        <View style={styles.searchContainer}>
          <Search size={20} color={theme.colors.text.secondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search stories..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={theme.colors.text.tertiary}
          />
        </View>
        <View style={styles.tabs}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'trending' && styles.activeTab]}
            onPress={() => setActiveTab('trending')}
          >
            <TrendingUp 
              size={20} 
              color={activeTab === 'trending' ? theme.colors.primary : theme.colors.text.secondary} 
            />
            <Typography 
              variant="bodySmall" 
              color={activeTab === 'trending' ? theme.colors.primary : theme.colors.text.secondary}
              style={styles.tabLabel}
            >
              Trending
            </Typography>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'categories' && styles.activeTab]}
            onPress={() => setActiveTab('categories')}
          >
            <Bookmark 
              size={20} 
              color={activeTab === 'categories' ? theme.colors.primary : theme.colors.text.secondary} 
            />
            <Typography 
              variant="bodySmall" 
              color={activeTab === 'categories' ? theme.colors.primary : theme.colors.text.secondary}
              style={styles.tabLabel}
            >
              Categories
            </Typography>
          </TouchableOpacity>
        </View>
      </View>

      {activeTab === 'trending' ? (
        <View style={styles.trendingContainer}>
          <Typography variant="h3" style={styles.sectionTitle}>Trending Topics</Typography>
          
          <View style={styles.trendingTopics}>
            {trendingTopics.map((topic, index) => (
              <TouchableOpacity key={index} style={styles.trendingTopic}>
                <TrendingUp size={16} color={theme.colors.primary} />
                <Typography variant="bodySmall" style={styles.topicText}>{topic}</Typography>
              </TouchableOpacity>
            ))}
          </View>
          
          <Typography variant="h3" style={styles.sectionTitle}>Popular Stories</Typography>
          
          <FlatList
            data={filteredStories}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <StoryCard story={item} />
            )}
            contentContainerStyle={styles.listContent}
          />
        </View>
      ) : (
        <View style={styles.categoriesContainer}>
          <Typography variant="h3" style={styles.sectionTitle}>Browse Categories</Typography>
          
          <View style={styles.categoriesGrid}>
            {categories.map(category => (
              <TouchableOpacity 
                key={category} 
                style={[
                  styles.categoryCard,
                  { backgroundColor: theme.colors.background.tertiary }
                ]}
                onPress={() => handleCategorySelect(category)}
              >
                <Typography variant="bodyBold">{category}</Typography>
              </TouchableOpacity>
            ))}
          </View>
          
          {selectedCategory && (
            <>
              <View style={styles.categoryHeader}>
                <Typography variant="h3">{selectedCategory} Stories</Typography>
                <TouchableOpacity onPress={() => setSelectedCategory(undefined)}>
                  <Typography variant="bodySmall" color={theme.colors.primary}>Clear</Typography>
                </TouchableOpacity>
              </View>
              
              <FlatList
                data={filteredStories}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <StoryCard story={item} />
                )}
                contentContainerStyle={styles.listContent}
              />
            </>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
  },
  header: {
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  searchInput: {
    flex: 1,
    marginLeft: theme.spacing.sm,
    color: theme.colors.text.primary,
    fontSize: 16,
  },
  tabs: {
    flexDirection: 'row',
    marginTop: theme.spacing.md,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.full,
    marginRight: theme.spacing.sm,
  },
  activeTab: {
    backgroundColor: theme.colors.primaryLight,
  },
  tabLabel: {
    marginLeft: theme.spacing.xs,
  },
  trendingContainer: {
    flex: 1,
    padding: theme.spacing.md,
  },
  sectionTitle: {
    marginBottom: theme.spacing.md,
  },
  trendingTopics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  trendingTopic: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background.secondary,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.full,
  },
  topicText: {
    marginLeft: theme.spacing.xs,
  },
  categoriesContainer: {
    flex: 1,
    padding: theme.spacing.md,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  categoryCard: {
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    minWidth: '45%',
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  listContent: {
    paddingBottom: theme.spacing.xl,
  },
});