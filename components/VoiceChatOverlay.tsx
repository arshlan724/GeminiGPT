import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from '@google/genai';
import { X, Mic, MicOff, Volume2, Radio, ChevronDown } from 'lucide-react';
import { VOICE_PERSONAS, VoicePersona } from '../types';

interface VoiceChatOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

// Audio Utils
function createBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  
  // Custom Encode to avoid external deps
  let binary = '';
  const bytes = new Uint8Array(int16.buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);

  return {
    data: base64,
    mimeType: 'audio/pcm;rate=16000',
  };
}

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

const VoiceChatOverlay: React.FC<VoiceChatOverlayProps> = ({ isOpen, onClose }) => {
  const [selectedPersona, setSelectedPersona] = useState<VoicePersona>(VOICE_PERSONAS[0]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showPersonaMenu, setShowPersonaMenu] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  // Audio Context Refs
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  
  // Connection Refs
  const sessionRef = useRef<Promise<any> | null>(null);
  const activeSessionRef = useRef<any>(null); // To store the resolved session
  
  // Visualization Animation Frame
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      startSession();
    } else {
      stopSession();
    }
    return () => {
      stopSession();
    };
  }, [isOpen, selectedPersona]);

  // Visualizer Loop
  useEffect(() => {
    if (!isOpen) return;

    const simulateVisualizer = () => {
      // If we had a real AnalyserNode we would use it here.
      // For now, we simulate "activity" based on connection state and random noise when talking
      if (isConnected) {
         // Create a fluctuating value
         const base = 20;
         const fluctuation = Math.random() * 50;
         setAudioLevel(base + fluctuation);
      } else {
         setAudioLevel(10);
      }
      animationFrameRef.current = requestAnimationFrame(simulateVisualizer);
    };
    
    simulateVisualizer();
    return () => {
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isOpen, isConnected]);


  const startSession = async () => {
    if (isConnecting || isConnected) return;
    setIsConnecting(true);

    try {
      const apiKey = process.env.API_KEY;
      if (!apiKey) throw new Error("No API Key");

      const ai = new GoogleGenAI({ apiKey });

      // Init Audio Contexts
      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const inputCtx = inputAudioContextRef.current;
      const outputCtx = outputAudioContextRef.current;

      // Connect to Gemini Live
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedPersona.voiceName } }
            },
            systemInstruction: selectedPersona.systemInstruction,
        },
        callbacks: {
            onopen: () => {
                console.log("Gemini Live Connected");
                setIsConnected(true);
                setIsConnecting(false);

                // Setup Input Streaming
                const source = inputCtx.createMediaStreamSource(stream);
                const processor = inputCtx.createScriptProcessor(4096, 1, 1);
                
                processor.onaudioprocess = (e) => {
                    if (isMuted) return; // Don't send data if muted
                    const inputData = e.inputBuffer.getChannelData(0);
                    const pcmBlob = createBlob(inputData);
                    
                    sessionPromise.then(session => {
                        session.sendRealtimeInput({ media: pcmBlob });
                    });
                };

                source.connect(processor);
                processor.connect(inputCtx.destination);
                
                sourceRef.current = source;
                processorRef.current = processor;
            },
            onmessage: async (msg: LiveServerMessage) => {
                // Handle Audio Output
                const base64Audio = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                if (base64Audio) {
                    const ctx = outputAudioContextRef.current;
                    if (!ctx) return;

                    const audioBuffer = await decodeAudioData(
                        decode(base64Audio),
                        ctx,
                        24000,
                        1
                    );
                    
                    const source = ctx.createBufferSource();
                    source.buffer = audioBuffer;
                    source.connect(ctx.destination);
                    
                    // Simple queueing logic
                    const currentTime = ctx.currentTime;
                    if (nextStartTimeRef.current < currentTime) {
                        nextStartTimeRef.current = currentTime;
                    }
                    
                    source.start(nextStartTimeRef.current);
                    nextStartTimeRef.current += audioBuffer.duration;
                    
                    audioSourcesRef.current.add(source);
                    source.onended = () => {
                        audioSourcesRef.current.delete(source);
                    }
                }

                // Handle interruption
                if (msg.serverContent?.interrupted) {
                    audioSourcesRef.current.forEach(s => s.stop());
                    audioSourcesRef.current.clear();
                    nextStartTimeRef.current = 0;
                }
            },
            onclose: () => {
                console.log("Session Closed");
                setIsConnected(false);
            },
            onerror: (err) => {
                console.error("Session Error", err);
                setIsConnected(false);
            }
        }
      });

      sessionRef.current = sessionPromise;
      // Store resolved session to close later
      sessionPromise.then(s => activeSessionRef.current = s);

    } catch (e) {
      console.error("Failed to start voice session", e);
      setIsConnecting(false);
      onClose(); // Close overlay on error
    }
  };

  const stopSession = () => {
     // Close Session
     if (activeSessionRef.current) {
        // There isn't a direct close method on the session object in the SDK typings sometimes, 
        // but often the server closes on disconnect. 
        // The best way is to stop sending and close contexts.
     }

     // Stop Input
     if (streamRef.current) {
         streamRef.current.getTracks().forEach(track => track.stop());
         streamRef.current = null;
     }
     if (processorRef.current) {
         processorRef.current.disconnect();
         processorRef.current = null;
     }
     if (sourceRef.current) {
         sourceRef.current.disconnect();
         sourceRef.current = null;
     }

     // Close Contexts
     if (inputAudioContextRef.current) {
         inputAudioContextRef.current.close();
         inputAudioContextRef.current = null;
     }
     if (outputAudioContextRef.current) {
         outputAudioContextRef.current.close();
         outputAudioContextRef.current = null;
     }

     // Clear Queue
     audioSourcesRef.current.forEach(s => {
         try { s.stop(); } catch(e){}
     });
     audioSourcesRef.current.clear();
     nextStartTimeRef.current = 0;

     setIsConnected(false);
     setIsConnecting(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-gray-950 flex flex-col items-center justify-between p-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="w-full flex justify-between items-center max-w-lg">
        <div className="relative">
            <button 
                onClick={() => setShowPersonaMenu(!showPersonaMenu)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-800 rounded-full text-gray-200 hover:bg-gray-700 transition-all border border-gray-700"
            >
                <span className="text-xl">{selectedPersona.icon}</span>
                <span className="font-medium text-sm">{selectedPersona.name}</span>
                <ChevronDown size={14} className={`transition-transform ${showPersonaMenu ? 'rotate-180' : ''}`} />
            </button>

            {/* Persona Dropdown */}
            {showPersonaMenu && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl overflow-hidden z-20">
                    <div className="p-1">
                        {VOICE_PERSONAS.map(p => (
                            <button
                                key={p.id}
                                onClick={() => {
                                    setSelectedPersona(p);
                                    setShowPersonaMenu(false);
                                }}
                                className={`w-full text-left px-3 py-3 rounded-lg flex items-center gap-3 transition-colors ${selectedPersona.id === p.id ? 'bg-gray-700' : 'hover:bg-gray-700/50'}`}
                            >
                                <span className="text-xl">{p.icon}</span>
                                <div>
                                    <div className="text-sm font-semibold text-gray-200">{p.name}</div>
                                    <div className="text-xs text-gray-400 leading-tight mt-0.5">{p.description}</div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
        
        <button onClick={onClose} className="p-3 bg-gray-800 rounded-full text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
          <X size={24} />
        </button>
      </div>

      {/* Visualizer / Status */}
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-lg relative">
         <div className="relative">
            {/* Outer Glow */}
            <div 
                className={`absolute inset-0 rounded-full blur-3xl transition-all duration-300 ${isConnected ? 'bg-blue-500/20' : 'bg-transparent'}`}
                style={{ transform: `scale(${1 + (audioLevel / 100)})` }}
            />
            
            {/* Main Orb */}
            <div 
                className={`w-32 h-32 md:w-48 md:h-48 rounded-full flex items-center justify-center transition-all duration-500 shadow-2xl z-10 ${
                    isConnected ? 'bg-gradient-to-br from-blue-600 to-purple-600' : 'bg-gray-800'
                }`}
                style={{ 
                    transform: isConnected ? `scale(${1 + (audioLevel / 200)})` : 'scale(1)',
                    boxShadow: isConnected ? `0 0 ${audioLevel}px rgba(59, 130, 246, 0.5)` : 'none'
                }}
            >
                {isConnecting ? (
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white opacity-50"></div>
                ) : (
                    <div className="text-4xl md:text-6xl animate-pulse">
                        {isConnected ? (audioLevel > 25 ? '⚡️' : '🎧') : '...'}
                    </div>
                )}
            </div>
         </div>
         
         <div className="mt-8 text-center space-y-2">
             <h2 className="text-2xl font-semibold text-gray-200">
                {isConnecting ? 'Connecting...' : (isConnected ? 'Listening' : 'Disconnected')}
             </h2>
             <p className="text-gray-400 text-sm max-w-xs mx-auto">
                {isConnected ? `Speak now to chat with the ${selectedPersona.name} mode.` : 'Starting secure voice session...'}
             </p>
         </div>
      </div>

      {/* Controls */}
      <div className="w-full max-w-lg grid grid-cols-3 gap-6 mb-8">
         <div className="flex items-center justify-center">
             <div className="text-gray-500 text-xs font-mono bg-gray-900 px-3 py-1 rounded-full border border-gray-800 flex items-center gap-2">
                <Radio size={10} className={isConnected ? "text-green-500 animate-pulse" : "text-gray-500"} />
                LIVE 24kHz
             </div>
         </div>

         <div className="flex items-center justify-center">
            <button 
                onClick={() => {
                    setIsMuted(!isMuted);
                    // Just toggle the muted state ref/state. The processor checks this.
                }}
                className={`p-6 rounded-full transition-all duration-200 shadow-lg ${isMuted ? 'bg-red-500/20 text-red-400 border border-red-500/50' : 'bg-white text-black hover:scale-105'}`}
            >
                {isMuted ? <MicOff size={28} /> : <Mic size={28} />}
            </button>
         </div>

         <div className="flex items-center justify-center">
             <button 
                onClick={onClose}
                className="p-4 rounded-full bg-gray-800 text-red-400 hover:bg-gray-700 hover:text-red-300 transition-all border border-gray-700"
             >
                <X size={24} />
             </button>
         </div>
      </div>
    </div>
  );
};

export default VoiceChatOverlay;