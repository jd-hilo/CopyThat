import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { Typography } from '@/components/ui/Typography';
import { supabase } from '@/lib/supabase';
import { MessageCircle, Plus, X } from 'lucide-react-native';

interface FeedbackBannerProps {
  onFeedbackSubmitted?: () => void;
  onFeedbackReaction?: (feedback: any) => void;
  onRecordFeedback?: () => void;
}

export function FeedbackBanner({ onFeedbackSubmitted, onFeedbackReaction, onRecordFeedback }: FeedbackBannerProps) {
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUser(user);
    }
  };

  const handleRecordFeedbackPress = () => {
    setShowFeedbackModal(false); // Close the info modal
    onRecordFeedback?.(); // Open the recording modal
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.banner}
        onPress={() => setShowFeedbackModal(true)}
        activeOpacity={0.8}
      >
        <View style={styles.bannerContent}>
          <View style={styles.bannerText}>
            <Typography variant="bodyBold" style={styles.bannerTitle}>
              Share Your Feedback
            </Typography>
            <Typography variant="caption" style={styles.bannerSubtitle}>
              Help us improve the app with your thoughts
            </Typography>
          </View>
          <View style={styles.talkButton}>
            <View style={styles.talkDot} />
            <Typography variant="bodyBold" style={styles.talkText}>talk</Typography>
          </View>
        </View>
      </TouchableOpacity>

      {/* Feedback Modal */}
      <Modal
        visible={showFeedbackModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFeedbackModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Typography variant="h3">Share Feedback</Typography>
              <TouchableOpacity
                onPress={() => setShowFeedbackModal(false)}
                style={styles.closeButton}
              >
                <X size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <Typography variant="body" style={styles.modalDescription}>
                We'd love to hear your thoughts about the app! Share your feedback, suggestions, or report any issues you've encountered.
              </Typography>
              
              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleRecordFeedbackPress}
              >
                <View style={styles.talkDot} />
                <Typography variant="button" style={styles.submitButtonText}>
                  talk
                </Typography>
              </TouchableOpacity>

              <View style={styles.feedbackExamples}>
                <Typography variant="bodyBold" style={styles.examplesTitle}>
                  What kind of feedback can you share?
                </Typography>
                <View style={styles.exampleItem}>
                  <Typography variant="body">• Feature suggestions</Typography>
                </View>
                <View style={styles.exampleItem}>
                  <Typography variant="body">• Bug reports</Typography>
                </View>
                <View style={styles.exampleItem}>
                  <Typography variant="body">• User experience improvements</Typography>
                </View>
                <View style={styles.exampleItem}>
                  <Typography variant="body">• General thoughts about the app</Typography>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  banner: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bannerText: {
    flex: 1,
    marginLeft: 12,
  },
  bannerTitle: {
    color: '#333',
    marginBottom: 2,
  },
  bannerSubtitle: {
    color: '#666',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '90%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalBody: {
    padding: 16,
  },
  closeButton: {
    padding: 4,
  },
  modalDescription: {
    marginBottom: 24,
    lineHeight: 22,
    color: '#666',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEFB4',
    borderRadius: 26,
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 8,
    minWidth: 78,
    justifyContent: 'center',
    marginBottom: 24,
  },
  submitButtonText: {
    fontFamily: 'Nunito',
    fontSize: 16,
    fontWeight: '700',
    color: '#000405',
  },
  feedbackExamples: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
  },
  examplesTitle: {
    marginBottom: 12,
    color: '#333',
  },
  exampleItem: {
    marginBottom: 8,
  },
  talkDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FF0000',
    opacity: 0.4,
    marginRight: 4,
  },
  talkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEFB4',
    borderRadius: 26,
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 8,
    minWidth: 78,
    justifyContent: 'center',
  },
  talkText: {
    fontFamily: 'Nunito',
    fontSize: 16,
    fontWeight: '700',
    color: '#000405',
  },
}); 