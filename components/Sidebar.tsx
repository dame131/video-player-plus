
import React, { useRef } from 'react';
import { ViewMode, MediaItem } from '../types';
import { Play, Film, Image as ImageIcon, Plus, Video, Music, Radio, Globe } from 'lucide-react';

interface SidebarProps {
  currentView: ViewMode;
  onViewChange: (mode: ViewMode) => void;
  playlist: MediaItem[];
  currentMediaId: string | null;
  onMediaSelect: (item: MediaItem) => void;
  onUpload: (files: FileList) => void;
  onAddStream?: (url: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onViewChange,
  playlist,
  currentMediaId,
  onMediaSelect,
  onUpload,
  onAddStream
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUpload(e.target.files);
    }
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAddStream = () => {
      const url = prompt("Enter Network Stream URL (m3u8, mp4, mp3):");
      if (url && onAddStream) {
          onAddStream(url);
      }
  };

  return (
    <div className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-800 flex items-center space-x-2">
        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
          <Play className="w-5 h-5 text-white fill-current" />
        </div>
        <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
          Gemini Media
        </span>
      </div>

      {/* Navigation */}
      <nav className="p-2 space-y-1">
        <button
          onClick={() => onViewChange(ViewMode.PLAYER)}
          className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md transition-colors ${
            currentView === ViewMode.PLAYER ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'
          }`}
        >
          <Play className="w-4 h-4" />
          <span>Player</span>
        </button>
        <button
          onClick={() => onViewChange(ViewMode.VEO_STUDIO)}
          className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md transition-colors ${
            currentView === ViewMode.VEO_STUDIO ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'
          }`}
        >
          <Film className="w-4 h-4" />
          <span>Veo Studio</span>
        </button>
        <button
          onClick={() => onViewChange(ViewMode.IMAGE_STUDIO)}
          className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md transition-colors ${
            currentView === ViewMode.IMAGE_STUDIO ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'
          }`}
        >
          <ImageIcon className="w-4 h-4" />
          <span>Image Studio</span>
        </button>
        <button
          onClick={() => onViewChange(ViewMode.LIVE)}
          className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md transition-colors ${
            currentView === ViewMode.LIVE ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'
          }`}
        >
          <Radio className="w-4 h-4 text-red-500" />
          <span>Gemini Live</span>
        </button>
      </nav>

      {/* Library */}
      <div className="flex-1 overflow-y-auto mt-4">
        <div className="px-4 pb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Library</h3>
          <div className="flex space-x-1">
            <button 
                onClick={handleAddStream}
                className="p-1 hover:bg-gray-800 rounded text-gray-400 hover:text-white"
                title="Open Network Stream"
            >
                <Globe className="w-4 h-4" />
            </button>
            <button 
                onClick={() => fileInputRef.current?.click()}
                className="p-1 hover:bg-gray-800 rounded text-gray-400 hover:text-white"
                title="Open File"
            >
                <Plus className="w-4 h-4" />
            </button>
          </div>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            className="hidden" 
            multiple 
            accept="video/*,audio/*,image/*" 
          />
        </div>

        <ul className="space-y-1 px-2">
          {playlist.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => {
                    onMediaSelect(item);
                    onViewChange(ViewMode.PLAYER);
                }}
                className={`w-full flex items-center space-x-3 px-2 py-2 rounded-md text-sm text-left truncate transition-colors ${
                  currentMediaId === item.id ? 'bg-gray-800 text-blue-400' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                {item.type === 'video' ? <Video className="w-4 h-4 min-w-[16px]" /> : 
                 item.type === 'audio' ? <Music className="w-4 h-4 min-w-[16px]" /> :
                 <ImageIcon className="w-4 h-4 min-w-[16px]" />}
                <span className="truncate">{item.name}</span>
              </button>
            </li>
          ))}
          {playlist.length === 0 && (
            <li className="px-4 py-8 text-center text-gray-600 text-sm">
              No media files. <br/>Click + to add.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
};

export default Sidebar;
