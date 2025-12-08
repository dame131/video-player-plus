
import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { MediaItem } from '../types';
import { 
    Play, Pause, Volume2, VolumeX, Maximize, SkipBack, SkipForward, 
    Settings, Sliders, Type, Repeat, RotateCw, ZoomIn, Sun, Activity, 
    Clock, Monitor, Image as ImageIcon, Subtitles, Download, X, List 
} from 'lucide-react';

interface PlayerProps {
  media: MediaItem | null;
}

export interface PlayerRef {
  captureFrame: () => string | null;
}

// VLC-style predefined EQ presets
const EQ_PRESETS: Record<string, number[]> = {
    'Flat': [0,0,0,0,0,0,0,0,0,0],
    'Rock': [4,3,2,0,-1,-1,0,2,3,4],
    'Techno': [4,3,0,-2,-3,0,2,4,4,4],
    'Voice': [-2,-2,-1,0,3,3,3,2,0,-2],
    'Classical': [3,2,1,0,0,0,1,2,3,3],
};

const Player = forwardRef<PlayerRef, PlayerProps>(({ media }, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Audio Context Refs ---
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const eqNodesRef = useRef<BiquadFilterNode[]>([]);
  const delayNodeRef = useRef<DelayNode | null>(null);

  // --- State: Playback ---
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [loop, setLoop] = useState<{ a: number | null, b: number | null, active: boolean }>({ a: null, b: null, active: false });

  // --- State: Audio ---
  const [volume, setVolume] = useState(1); // 0 to 2 (200%)
  const [isMuted, setIsMuted] = useState(false);
  const [audioDelay, setAudioDelay] = useState(0); // seconds
  const [eqPreset, setEqPreset] = useState('Flat');
  const [eqValues, setEqValues] = useState<number[]>(EQ_PRESETS['Flat']);

  // --- State: Video ---
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [scale, setScale] = useState(1); // Zoom
  const [aspectRatio, setAspectRatio] = useState<string>('auto'); // auto, 16:9, 4:3, etc.

  // --- State: Subtitles ---
  const [subtitleText, setSubtitleText] = useState('');
  const [subtitles, setSubtitles] = useState<Array<{start: number, end: number, text: string}>>([]);
  const [subtitleOffset, setSubtitleOffset] = useState(0); // ms

  // --- State: UI ---
  const [showControls, setShowControls] = useState(false);
  const [activeMenu, setActiveMenu] = useState<'none' | 'audio' | 'video' | 'subs'>('none');
  const [osdMessage, setOsdMessage] = useState<string | null>(null);
  const osdTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // --- Gestures State ---
  const touchStartRef = useRef<{x: number, y: number} | null>(null);
  const gestureActionRef = useRef<'seek' | 'volume' | 'brightness' | null>(null);
  const lastTapRef = useRef<number>(0);

  useImperativeHandle(ref, () => ({
    captureFrame: () => {
      if (!videoRef.current || media?.type !== 'video') return null;
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
          // Apply filters to capture if possible? Native canvas doesn't easily capture CSS filters of video
          // We just capture raw frame
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg');
      }
      return null;
    }
  }));

  // --- Audio Setup ---
  useEffect(() => {
      if (videoRef.current && !audioCtxRef.current && media?.type === 'video') {
          // Note: createMediaElementSource requires CORS for remote videos. 
          // Works for local blobs. For stream URLs, might fail if no CORS header.
          try {
              const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
              const ctx = new AudioContextClass();
              audioCtxRef.current = ctx;

              const source = ctx.createMediaElementSource(videoRef.current);
              sourceNodeRef.current = source;

              // EQ Bands (10 bands: 31, 62, 125, 250, 500, 1k, 2k, 4k, 8k, 16k)
              const frequencies = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
              const filters = frequencies.map(freq => {
                  const filter = ctx.createBiquadFilter();
                  filter.type = 'peaking';
                  filter.frequency.value = freq;
                  filter.Q.value = 1;
                  filter.gain.value = 0;
                  return filter;
              });
              eqNodesRef.current = filters;

              // Delay
              const delay = ctx.createDelay(5.0); // max 5 sec delay
              delay.delayTime.value = 0;
              delayNodeRef.current = delay;

              // PreAmp/Gain (Volume > 100%)
              const gain = ctx.createGain();
              gain.value = 1;
              gainNodeRef.current = gain;

              // Connect Chain
              // source -> delay -> eq[0]...->eq[9] -> gain -> dest
              let prevNode: AudioNode = source;
              prevNode.connect(delay);
              prevNode = delay;

              filters.forEach(f => {
                  prevNode.connect(f);
                  prevNode = f;
              });

              prevNode.connect(gain);
              gain.connect(ctx.destination);

          } catch (e) {
              console.warn("Audio Context Setup failed (likely CORS on remote stream):", e);
          }
      }
  }, [media]);

  // Update EQ
  useEffect(() => {
      eqValues.forEach((val, i) => {
          if (eqNodesRef.current[i]) {
              eqNodesRef.current[i].gain.value = val;
          }
      });
  }, [eqValues]);

  // Update Audio Delay
  useEffect(() => {
      if (delayNodeRef.current) {
          delayNodeRef.current.delayTime.value = Math.max(0, audioDelay);
      }
  }, [audioDelay]);

  // --- Init ---
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.load();
      setIsPlaying(false);
      setProgress(0);
      setSubtitleText('');
      setSubtitles([]);
      // Reset Video Filters
      setBrightness(100);
      setContrast(100);
      setSaturation(100);
      setRotation(0);
      setScale(1);
    }
  }, [media]);

  // --- Loop Logic ---
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const ct = videoRef.current.currentTime;
      setProgress(ct);
      setDuration(videoRef.current.duration || 0);

      // Loop check
      if (loop.active && loop.b !== null && loop.a !== null) {
          if (ct >= loop.b) {
              videoRef.current.currentTime = loop.a;
          }
      }

      // Subtitles check
      const currentSub = subtitles.find(s => ct * 1000 >= (s.start + subtitleOffset) && ct * 1000 <= (s.end + subtitleOffset));
      setSubtitleText(currentSub ? currentSub.text : '');
    }
  };

  const showOSD = (msg: string) => {
      setOsdMessage(msg);
      if (osdTimeoutRef.current) clearTimeout(osdTimeoutRef.current);
      osdTimeoutRef.current = setTimeout(() => setOsdMessage(null), 2000);
  };

  const togglePlay = () => {
    if (videoRef.current) {
      // Resume Audio Context if suspended (browser policy)
      if (audioCtxRef.current?.state === 'suspended') {
          audioCtxRef.current.resume();
      }

      if (isPlaying) {
        videoRef.current.pause();
        showOSD("Pause");
      } else {
        videoRef.current.play();
        showOSD("Play");
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSeek = (time: number) => {
      if (videoRef.current) {
          videoRef.current.currentTime = time;
          setProgress(time);
          showOSD(`Seek: ${formatTime(time)}`);
      }
  };

  const adjustVolume = (delta: number) => {
      let newVol = Math.max(0, Math.min(2, volume + delta)); // Max 200%
      setVolume(newVol);
      
      // If we have AudioContext gain node, use it for > 100%
      // Native video volume caps at 1.0
      if (videoRef.current) {
          videoRef.current.volume = Math.min(1, newVol);
      }
      if (gainNodeRef.current) {
          // If vol > 1, gain handles the boost. 
          // E.g. Vol 1.5 -> video vol 1.0, gain 1.5
          // If Vol 0.5 -> video vol 0.5, gain 1.0 (or video vol 1, gain 0.5)
          // Simplest: Video always 1.0 (unless muted), Gain controls everything? 
          // Better: Video vol max 1. Gain handles boost.
          gainNodeRef.current.gain.value = Math.max(1, newVol);
      }
      showOSD(`Volume: ${Math.round(newVol * 100)}%`);
  };

  // --- Subtitle Parser (Simple SRT/VTT) ---
  const handleSubtitleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
          const content = ev.target?.result as string;
          const parsed = parseSubtitles(content);
          setSubtitles(parsed);
          showOSD("Subtitles Loaded");
      };
      reader.readAsText(file);
  };

  const parseSubtitles = (content: string) => {
      // Very