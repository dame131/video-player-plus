import React, { useState } from 'react';
import { generateImage, editImage } from '../services/geminiService';
import { Loader2, Image as ImageIcon, Wand2, PlusCircle, AlertCircle } from 'lucide-react';
import { ImageConfig } from '../types';

interface ImageStudioProps {
  onImageGenerated: (url: string, name: string) => void;
}

const ImageStudio: React.FC<ImageStudioProps> = ({ onImageGenerated }) => {
  const [prompt, setPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'generate' | 'edit'>('generate');
  const [selectedImageForEdit, setSelectedImageForEdit] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<ImageConfig>({
    prompt: '',
    aspectRatio: '1:1',
    size: '1K'
  });

  const handleAction = async () => {
    if (!prompt) return;
    setIsProcessing(true);
    setError(null);

    try {
      let resultUrl: string | null = null;
      
      // Check for Key selection for High Quality Image Gen
      if (activeTab === 'generate' && window.aistudio) {
           // We might need to select key for Pro model usage
           if (window.aistudio.hasSelectedApiKey) {
             const hasKey = await window.aistudio.hasSelectedApiKey();
             if (!hasKey) {
                await window.aistudio.openSelectKey();
             }
           }
      }

      if (activeTab === 'generate') {
        resultUrl = await generateImage(prompt, config.aspectRatio, config.size);
      } else {
        if (!selectedImageForEdit) throw new Error("Please select an image to edit first.");
        resultUrl = await editImage(selectedImageForEdit, prompt);
      }

      if (resultUrl) {
        onImageGenerated(resultUrl, activeTab === 'generate' ? `Gen: ${prompt}` : `Edit: ${prompt}`);
        // If generating, maybe set it as the edit target for next step?
        if (activeTab === 'generate') setSelectedImageForEdit(resultUrl);
      } else {
        throw new Error("Failed to process image.");
      }
    } catch (err: any) {
      setError(err.message || "Operation failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) setSelectedImageForEdit(ev.target.result as string);
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  return (
    <div className="flex-1 bg-gray-900 p-8 flex flex-col items-center overflow-y-auto">
      <div className="w-full max-w-2xl">
        
        {/* Header Tabs */}
        <div className="flex space-x-4 mb-8 justify-center">
            <button 
                onClick={() => setActiveTab('generate')}
                className={`px-6 py-2 rounded-full font-medium transition-all ${activeTab === 'generate' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
            >
                Generate (Pro)
            </button>
            <button 
                onClick={() => setActiveTab('edit')}
                className={`px-6 py-2 rounded-full font-medium transition-all ${activeTab === 'edit' ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
            >
                Edit (Nano Banana)
            </button>
        </div>

        <div className="bg-gray-800 rounded-xl p-6 shadow-2xl border border-gray-700">
          
          {/* Edit Mode: Image uploader */}
          {activeTab === 'edit' && (
              <div className="mb-6 flex flex-col items-center justify-center border-2 border-dashed border-gray-600 rounded-lg p-6 bg-gray-900/50">
                  {selectedImageForEdit ? (
                      <div className="relative group">
                          <img src={selectedImageForEdit} alt="To Edit" className="max-h-64 rounded shadow-lg" />
                          <button 
                            onClick={() => setSelectedImageForEdit(null)}
                            className="absolute top-2 right-2 bg-red-600 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                              <PlusCircle className="w-4 h-4 rotate-45 text-white" />
                          </button>
                      </div>
                  ) : (
                      <label className="cursor-pointer flex flex-col items-center">
                          <PlusCircle className="w-10 h-10 text-gray-500 mb-2" />
                          <span className="text-sm text-gray-400">Upload source image</span>
                          <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                      </label>
                  )}
              </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
                {activeTab === 'generate' ? 'Image Prompt' : 'Editing Instruction'}
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={activeTab === 'generate' ? "A cute robot painting a canvas..." : "Add sunglasses to the person..."}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 h-24 resize-none"
            />
          </div>

          {activeTab === 'generate' && (
             <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Aspect Ratio</label>
                <select 
                    value={config.aspectRatio}
                    onChange={(e) => setConfig({...config, aspectRatio: e.target.value as any})}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white"
                >
                    <option value="1:1">1:1 (Square)</option>
                    <option value="4:3">4:3</option>
                    <option value="16:9">16:9</option>
                </select>
                </div>
                <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Size</label>
                <select 
                    value={config.size}
                    onChange={(e) => setConfig({...config, size: e.target.value as any})}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white"
                >
                    <option value="1K">1K</option>
                    <option value="2K">2K (High Res)</option>
                </select>
                </div>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-800 rounded-lg flex items-center text-red-200 text-sm">
              <AlertCircle className="w-4 h-4 mr-2" />
              {error}
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={handleAction}
              disabled={isProcessing || !prompt || (activeTab === 'edit' && !selectedImageForEdit)}
              className={`px-6 py-2 rounded-lg font-medium flex items-center space-x-2 transition-all ${
                isProcessing || !prompt || (activeTab === 'edit' && !selectedImageForEdit)
                  ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-500 hover:shadow-lg'
              }`}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  {activeTab === 'generate' ? <ImageIcon className="w-4 h-4" /> : <Wand2 className="w-4 h-4" />}
                  <span>{activeTab === 'generate' ? 'Generate' : 'Edit Image'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageStudio;
