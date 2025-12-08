import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob as GenAIBlob } from '@google/genai';
import { Mic, MicOff, Zap, Activity } from 'lucide-react';

const LiveView: React.FC = () => {
    const [connected, setConnected] = useState(false);
    const [status, setStatus] = useState("Disconnected");
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isMuted, setIsMuted] = useState(false);

    // Audio Refs
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const sessionPromiseRef = useRef<Promise<any> | null>(null);
    const nextStartTimeRef = useRef<number>(0);
    const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

    // Helper: Create Blob for Audio
    function createBlob(data: Float32Array): GenAIBlob {
        const l = data.length;
        const int16 = new Int16Array(l);
        for (let i = 0; i < l; i++) {
            int16[i] = data[i] * 32768;
        }
        
        let binary = '';
        const bytes = new Uint8Array(int16.buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        const b64 = btoa(binary);

        return {
            data: b64,
            mimeType: 'audio/pcm;rate=16000',
        };
    }

    // Helper: Decode Audio
    function decode(base64: string) {
        const binaryString = atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
    }

    async function decodeAudioData(
        data: Uint8Array,
        ctx: AudioContext,
        sampleRate: number,
        numChannels: number,
    ): Promise<AudioBuffer> {
        const dataInt16 = new Int16Array(data.buffer);
        const frameCount = dataInt16.length / numChannels;
        const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

        for (let channel = 0; channel < numChannels; channel++) {
            const channelData = buffer.getChannelData(channel);
            for (let i = 0; i < frameCount; i++) {
                channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
            }
        }
        return buffer;
    }

    const startSession = async () => {
        try {
            setStatus("Connecting...");
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            // Audio Contexts
            inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 16000});
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
            
            // Mic Stream
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            const sessionPromise = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                callbacks: {
                    onopen: () => {
                        setStatus("Live");
                        setConnected(true);
                        
                        // Setup Input Streaming
                        if (!inputAudioContextRef.current) return;
                        const source = inputAudioContextRef.current.createMediaStreamSource(stream);
                        const scriptProcessor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
                        
                        scriptProcessor.onaudioprocess = (e) => {
                            if (isMuted) return; // Simple mute
                            const inputData = e.inputBuffer.getChannelData(0);
                            const pcmBlob = createBlob(inputData);
                            sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
                        };
                        
                        source.connect(scriptProcessor);
                        scriptProcessor.connect(inputAudioContextRef.current.destination);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                        if (base64Audio && outputAudioContextRef.current) {
                            const ctx = outputAudioContextRef.current;
                            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
                            
                            const audioBuffer = await decodeAudioData(
                                decode(base64Audio),
                                ctx,
                                24000,
                                1
                            );
                            
                            const source = ctx.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(ctx.destination);
                            
                            source.addEventListener('ended', () => {
                                sourcesRef.current.delete(source);
                            });
                            
                            source.start(nextStartTimeRef.current);
                            nextStartTimeRef.current += audioBuffer.duration;
                            sourcesRef.current.add(source);
                        }
                    },
                    onclose: () => {
                        setStatus("Disconnected");
                        setConnected(false);
                    },
                    onerror: (e) => {
                        console.error(e);
                        setStatus("Error");
                        setConnected(false);
                    }
                },
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } }
                    }
                }
            });
            sessionPromiseRef.current = sessionPromise;

        } catch (e) {
            console.error(e);
            setStatus("Failed to connect");
        }
    };

    const stopSession = () => {
        // Cleanup logic would go here, closing contexts and session
        // For simple demo, we just reload or expect user to navigate away which unmounts
        if (sessionPromiseRef.current) {
             // There isn't a direct 'disconnect' on the promise wrapper easily accessible without keeping the session obj
             // But we can close contexts
        }
        inputAudioContextRef.current?.close();
        outputAudioContextRef.current?.close();
        setConnected(false);
        setStatus("Disconnected");
    };
    
    // Cleanup on unmount
    useEffect(() => {
        return () => {
            inputAudioContextRef.current?.close();
            outputAudioContextRef.current?.close();
        }
    }, []);

    return (
        <div className="flex-1 bg-gray-900 flex flex-col items-center justify-center p-8">
            <div className="w-full max-w-md bg-gray-800 rounded-2xl p-8 shadow-2xl border border-gray-700 text-center">
                <div className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center mb-6 transition-all ${connected ? 'bg-red-500/20 animate-pulse' : 'bg-gray-700'}`}>
                    <Activity className={`w-12 h-12 ${connected ? 'text-red-500' : 'text-gray-500'}`} />
                </div>
                
                <h2 className="text-2xl font-bold text-white mb-2">Gemini Live</h2>
                <p className="text-gray-400 mb-8">Real-time conversational AI. Speak naturally.</p>
                
                <div className="flex items-center justify-center space-x-4">
                    {!connected ? (
                        <button 
                            onClick={startSession}
                            className="flex items-center space-x-2 px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-semibold transition-all shadow-lg hover:shadow-blue-500/30"
                        >
                            <Zap className="w-5 h-5" />
                            <span>Start Live Session</span>
                        </button>
                    ) : (
                        <>
                            <button 
                                onClick={() => setIsMuted(!isMuted)}
                                className={`p-4 rounded-full ${isMuted ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300'}`}
                            >
                                {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                            </button>
                            <button 
                                onClick={stopSession}
                                className="px-8 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-full font-medium"
                            >
                                End Session
                            </button>
                        </>
                    )}
                </div>
                
                <div className="mt-6 text-sm text-gray-500 font-mono">
                    Status: {status}
                </div>
            </div>
        </div>
    );
}

export default LiveView;