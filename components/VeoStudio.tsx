import React, { useState } from 'react';
import { generateVeoVideo } from '../services/geminiService';
import { Loader2, Video as VideoIcon, AlertCircle, ImagePlus, X } from 'lucide-react';
import { VeoConfig } from '../types';

interface VeoStudioProps {
  onVideoGenerated: (url: string, prompt: string) => void;
}

const VeoStudio: React.FC<VeoStudioProps> = ({ onVideoGenerated }) => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputImage, setInputImage] = useState<string | null>(null);
  const [config, setConfig] = useState<VeoConfig>({
    prompt: '',
    aspectRatio: '16:9',
    resolution: '720p',
  });

  const handleGenerate = async () => {
    if (!prompt && !inputImage) return;
    setIsGenerating(true);
    setError(null);

    try {
      // Check for API Key selection (User must select paid key for Veo)
      if (window.aistudio && window.aistudio.hasSelectedApiKey) {
          const hasKey = await window.aistudio.hasSelectedApiKey();
          if (!hasKey) {
             await window.aistudio.openSelectKey();
          }
      }

      const videoUrl = await generateVeoVideo(prompt, config.aspectRatio, config.resolution, inputImage || undefined);
      if (videoUrl) {
        onVideoGenerated(videoUrl, prompt || 'Image to Video');
      } else {
        throw new Error("Failed to retrieve video URL.");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) setInputImage(ev.target.result as string);
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  return (
    <div className="flex-1 bg-gray-900 p-8 flex flex-col items-center overflow-y-auto">
      <div className="w-full max-w-2xl">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl mb-4 shadow-lg">
            <VideoIcon className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Veo Video Studio</h1>
          <p className="text-gray-400">Generate cinematic videos from text prompts or images using Google Veo 3.</p>
        </div>

        <div className="bg-gray-800 rounded-xl p-6 shadow-2xl border border-gray-700">
          
          {/* Image Upload Section */}
          <div className="mb-6">
             <label className="block text-sm font-medium text-gray-300 mb-2">Reference Image (Optional)</label>
             {inputImage ? (
                 <div className="relative inline-block group">
                     <img src={inputImage} alt="Reference" className="h-32 rounded border border-purple-500/50" />
                     <button 
                        onClick={() => setInputImage(null)}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg hover:bg-red-600"
                     >
                         <X className="w-4 h-4" />
                     </button>
                 </div>
             ) : (
                <label className="flex items-center justify-center w-full h-20 border-2 border-dashed border-gray-700 rounded-lg hover:border-purple-500/50 hover:bg-gray-700/50 cursor-pointer transition-all">
                    <div className="flex items-center space-x-2 text-gray-500">
                        <ImagePlus className="w-5 h-5" />
                        <span className="text-sm">Upload starting frame</span>
                    </div>
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                </label>
             )}
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">Prompt</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="A futuristic city with flying cars..."
              className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent h-24 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Aspect Ratio</label>
              <select 
                value={config.aspectRatio}
                onChange={(e) => setConfig({...config, aspectRatio: e.target.value as any})}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white"
              >
                <option value="16:9">16:9 (Landscape)</option>
                <option value="9:16">9:16 (Portrait)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Resolution</label>
              <select 
                value={config.resolution}
                onChange={(e) => setConfig({...config, resolution: e.target.value as any})}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white"
              >
                <option value="720p">720p</option>
                <option value="1080p">1080p</option>
              </select>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-800 rounded-lg flex items-center text-red-200 text-sm">
              <AlertCircle className="w-4 h-4 mr-2" />
              {error}
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-500">
              Note: Requires a paid Google Cloud Project API Key.
            </div>
            <button
              onClick={handleGenerate}
              disabled={isGenerating || (!prompt && !inputImage)}
              className={`px-6 py-2 rounded-lg font-medium flex items-center space-x-2 transition-all ${
                isGenerating || (!prompt && !inputImage)
                  ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:shadow-lg hover:shadow-purple-500/25'
              }`}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <VideoIcon className="w-4 h-4" />
                  <span>Generate Video</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VeoStudio;