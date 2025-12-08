import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage } from '../types';
import { createChatSession, sendMessageToChat, generateSpeech } from '../services/geminiService';
import { Send, Sparkles, Loader2, Camera, X, Volume2 } from 'lucide-react';
import { Chat } from '@google/genai';

interface GeminiAssistantProps {
  onCaptureContext: () => string | null; // Callback to get current video frame
}

const GeminiAssistant: React.FC<GeminiAssistantProps> = ({ onCaptureContext }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      text: 'Hello! I am your Gemini media assistant. I can help you analyze videos, answer questions about your media, or just chat. How can I help?',
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [chatSession, setChatSession] = useState<Chat | null>(null);
  const [contextImage, setContextImage] = useState<string | null>(null);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const chat = createChatSession(
      "You are a helpful media assistant integrated into a video player application. " +
      "You can see screenshots of the video the user is watching if they provide them. " +
      "Answer concisely and helpfully. If the user asks about the video content, analyze the provided image."
    );
    setChatSession(chat);
    return () => {
        audioContextRef.current?.close();
    }
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if ((!input.trim() && !contextImage) || !chatSession) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
      timestamp: Date.now(),
      images: contextImage ? [contextImage] : undefined
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    const currentContext = contextImage ? [contextImage] : [];
    setContextImage(null); // Clear context after sending
    setIsThinking(true);

    try {
      const responseText = await sendMessageToChat(chatSession, userMsg.text || "Analyze this image", currentContext);
      
      const modelMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: responseText,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, modelMsg]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        text: "Sorry, I encountered an error processing your request.",
        timestamp: Date.now(),
      }]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleCapture = () => {
    const frame = onCaptureContext();
    if (frame) {
      setContextImage(frame);
    } else {
      // If no video is playing, maybe user wants to upload? 
      // For now, simple visual feedback that nothing was captured
      alert("No active video found to capture.");
    }
  };

  const handleSpeak = async (msg: ChatMessage) => {
      if (playingMessageId === msg.id) return; // Already playing/loading
      setPlayingMessageId(msg.id);

      try {
        const audioData = await generateSpeech(msg.text);
        if (audioData) {
            if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            }
            const ctx = audioContextRef.current;
            const audioBuffer = await ctx.decodeAudioData(audioData); // standard decode for TTS output which is clean
            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(ctx.destination);
            source.start(0);
            source.onended = () => setPlayingMessageId(null);
        } else {
            setPlayingMessageId(null);
        }
      } catch (e) {
          console.error("Speech play failed", e);
          setPlayingMessageId(null);
      }
  };

  return (
    <div className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col h-full shadow-xl z-20">
      <div className="p-4 border-b border-gray-800 flex items-center justify-between">
        <h2 className="font-semibold flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-blue-400" />
          <span>Gemini Assistant</span>
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div
              className={`max-w-[90%] rounded-lg p-3 text-sm relative group ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-200'
              }`}
            >
              {msg.images && msg.images.length > 0 && (
                <div className="mb-2">
                    <img src={msg.images[0]} alt="Context" className="rounded border border-white/20 max-h-32 object-contain" />
                </div>
              )}
              <div className="whitespace-pre-wrap">{msg.text}</div>
              
              {/* TTS Button for Model Messages */}
              {msg.role === 'model' && (
                  <button 
                    onClick={() => handleSpeak(msg)}
                    className={`absolute -bottom-6 left-0 text-gray-500 hover:text-blue-400 transition-colors p-1 ${playingMessageId === msg.id ? 'text-blue-400 animate-pulse' : ''}`}
                    title="Read aloud"
                  >
                      <Volume2 className="w-4 h-4" />
                  </button>
              )}
            </div>
            <span className="text-[10px] text-gray-600 mt-1 mb-2">
              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
        {isThinking && (
          <div className="flex items-center space-x-2 text-gray-500 text-sm">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Gemini is thinking...</span>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-gray-800">
        {contextImage && (
            <div className="mb-2 relative inline-block">
                <img src={contextImage} alt="Context Preview" className="h-16 rounded border border-blue-500" />
                <button 
                    onClick={() => setContextImage(null)}
                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5"
                >
                    <X className="w-3 h-3" />
                </button>
            </div>
        )}
        <div className="flex items-end space-x-2">
          <button
            onClick={handleCapture}
            title="Analyze current video frame"
            className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 transition-colors"
          >
            <Camera className="w-5 h-5" />
          </button>
          <div className="flex-1 relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask about the video..."
              className="w-full bg-gray-800 border-none rounded-lg pl-3 pr-3 py-2 text-sm text-white focus:ring-1 focus:ring-blue-500 resize-none h-10 min-h-[40px] max-h-24 scrollbar-hide"
            />
          </div>
          <button
            onClick={handleSend}
            disabled={(!input && !contextImage) || isThinking}
            className="p-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-white transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default GeminiAssistant;