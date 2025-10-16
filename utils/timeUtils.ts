import { formatDistanceToNow, format } from 'date-fns';

export function formatTimeAgo(dateString: string): string {
  try {
    // Ensure we have a valid date string
    if (!dateString) {
      return '';
    }
    
    const date = new Date(dateString);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return '';
    }
    
    return formatDistanceToNow(date, { addSuffix: true });
  } catch (error) {
    console.error('Error formatting time ago:', error);
    return '';
  }
}

export function formatDate(dateString: string): string {
  try {
    // Ensure we have a valid date string
    if (!dateString) {
      return '';
    }
    
    const date = new Date(dateString);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return '';
    }
    
    return format(date, 'MMM d, yyyy');
  } catch (error) {
    console.error('Error formatting date:', error);
    return '';
  }
}

export function formatDuration(seconds: number): string {
  try {
    // Ensure we have a valid number
    if (typeof seconds !== 'number' || isNaN(seconds)) {
      return '0s';
    }
    
    return `${Math.floor(seconds)}s`;
  } catch (error) {
    console.error('Error formatting duration:', error);
    return '0s';
  }
}