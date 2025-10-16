import React, { createContext, useContext, useState } from 'react';

interface AudioPlaybackContextType {
  currentlyPlayingId: string | null;
  setCurrentlyPlayingId: (id: string | null) => void;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
}

const AudioPlaybackContext = createContext<AudioPlaybackContextType | null>(null);

export function AudioPlaybackProvider({ children }: { children: React.ReactNode }) {
  const [currentlyPlayingId, setCurrentlyPlayingId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <AudioPlaybackContext.Provider value={{ currentlyPlayingId, setCurrentlyPlayingId, isPlaying, setIsPlaying }}>
      {children}
    </AudioPlaybackContext.Provider>
  );
}

export function useAudioPlayback() {
  const context = useContext(AudioPlaybackContext);
  if (!context) {
    throw new Error('useAudioPlayback must be used within an AudioPlaybackProvider');
  }
  return context;
} 