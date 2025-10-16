import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useState } from 'react';
import { Typography } from '../ui/Typography';
import { categories, Category, categoryColors, theme } from '@/constants/theme';

interface CategorySelectorProps {
  onSelectCategory: (category: Category) => void;
  selectedCategory?: Category;
}

export function CategorySelector({ onSelectCategory, selectedCategory }: CategorySelectorProps) {
  const [activeCategory, setActiveCategory] = useState<Category | undefined>(selectedCategory);

  const handleSelect = (category: Category) => {
    setActiveCategory(category);
    onSelectCategory(category);
  };

  return (
    <View style={styles.container}>
      <Typography variant="bodyBold" style={styles.title}>Select a category</Typography>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoriesContainer}
      >
        {categories.map(category => (
          <TouchableOpacity
            key={category}
            style={[
              styles.categoryItem,
              activeCategory === category && styles.activeCategory,
              { borderColor: categoryColors[category] }
            ]}
            onPress={() => handleSelect(category)}
          >
            <Typography
              variant="bodySmall"
              color={activeCategory === category ? theme.colors.white : theme.colors.text.primary}
            >
              {category}
            </Typography>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: theme.spacing.md,
  },
  title: {
    marginBottom: theme.spacing.sm,
    marginLeft: theme.spacing.md,
  },
  categoriesContainer: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  categoryItem: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.full,
    marginRight: theme.spacing.sm,
    borderWidth: 1,
  },
  activeCategory: {
    backgroundColor: theme.colors.primary,
    borderColor: 'transparent',
  },
});