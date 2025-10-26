import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import RecordScreen from '../record';

export default function RecordModal() {
  const params = useLocalSearchParams();
  const groupId = params.groupId as string | undefined;
  
  // Debug log to see if groupId is being passed from URL
  console.log('RecordModal - groupId from params:', groupId);
  console.log('RecordModal - all params:', params);
  
  // Reuse the existing record screen UI, presented as a modal group
  return <RecordScreen initialGroupId={groupId} />;
}


