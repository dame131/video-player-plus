
import React, { useState, useRef } from 'react';
import Sidebar from './components/Sidebar';
import Player, { PlayerRef } from './components/Player';
import GeminiAssistant from './components/GeminiAssistant';
import VeoStudio from './components/VeoStudio';
import ImageStudio from './components/ImageStudio';
import LiveView from './components/LiveView';
import { ViewMode, MediaItem } from './types';

// Using simple random ID gen instead of uuid import to ensure it works without npm install
const generateId = () => Math.random().toString(36).substr(2, 9);

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewMode>(ViewMode.PLAYER);
  const [playlist, setPlaylist] = useState<MediaItem[]>([]);
  const [currentMediaId, setCurrentMediaId] = useState<string | null>(null);
  
  const playerRef = useRef<PlayerRef>(null);

  const handleUpload = (files: FileList) => {
    const newItems: MediaItem[] = Array.from(files).map(file => ({
      id: generateId(),
      name: file.name,
      url: URL.createObjectURL(file),
      type: file.type.startsWith('video') ? 'video' : file.type.startsWith('audio') ? 'audio' : 'image',
      mimeType: file.type
    }));

    setPlaylist(prev => [...prev, ...newItems]);
    if (!currentMediaId && newItems.length > 0) {
      setCurrentMediaId(newItems[0].id);
      setCurrentView(ViewMode.PLAYER);
    }
  };

  const handleAddStream = (url: string) => {
      const newItem: MediaItem = {
          id: generateId(),
          name: `Stream ${playlist.length + 1}`,
          url: url,
          type: 'video', // Default assumption
          isStream: true
      };
      setPlaylist(prev => [newItem, ...prev]);
      setCurrentMediaId(newItem.id);
      setCurrentView(ViewMode.PLAYER);
  };

  const handleMediaSelect = (item: MediaItem) => {
    setCurrentMediaId(item.id);
  };

  const addToPlaylist = (url: string, name: string, type: 'video' | 'image') => {
    const newItem: MediaItem = {
      id: generateId(),
      name: name,
      url: url,
      type: type
    };
    setPlaylist(prev => [newItem, ...prev]); // Add to top
  };

  const getCurrentMedia = () => playlist.find(p => p.id === currentMediaId) || null;

  const handleCaptureContext = (): string | null => {
      // If we are in player mode, ask player for a frame
      if (currentView === ViewMode.PLAYER && playerRef.current) {
          return playerRef.current.captureFrame();
      }
      return null;
  };

  return (
    <div className="flex h-screen bg-gray-950 text-white font-sans overflow-hidden">
      {/* Sidebar */}
      <Sidebar 
        currentView={currentView}
        onViewChange={setCurrentView}
        playlist={playlist}
        currentMediaId={currentMediaId}
        onMediaSelect={handleMediaSelect}
        onUpload={handleUpload}
        onAddStream={handleAddStream}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col relative min-w-0">
        
        {/* View Switcher */}
        {currentView === ViewMode.PLAYER && (
          <Player 
            ref={playerRef}
            media={getCurrentMedia()} 
          />
        )}

        {currentView === ViewMode.VEO_STUDIO && (
          <VeoStudio onVideoGenerated={(url, prompt) => addToPlaylist(url, `Veo: ${prompt}`, 'video')} />
        )}

        {currentView === ViewMode.IMAGE_STUDIO && (
          <ImageStudio onImageGenerated={(url, name) => addToPlaylist(url, name, 'image')} />
        )}

        {currentView === ViewMode.LIVE && (
          <LiveView />
        )}
      </div>

      {/* Assistant Panel - Always visible for quick access */}
      <GeminiAssistant onCaptureContext={handleCaptureContext} />

    </div>
  );
};

export default App;
