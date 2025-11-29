
export enum Role {
  User = 'user',
  Model = 'model'
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  isError?: boolean;
  errorMessage?: string;
  groundingMetadata?: any;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
}

export enum ModelId {
  Flash = 'gemini-2.5-flash',
  Pro = 'gemini-3-pro-preview',
  FlashThinking = 'gemini-2.5-flash-thinking' // Custom ID to map to config internally
}

export const ModelConfig = {
  [ModelId.Flash]: {
    label: 'Gemini 2.5 Flash',
    description: 'Fast, versatile, real-time web access',
    apiModel: 'gemini-2.5-flash'
  },
  [ModelId.Pro]: {
    label: 'Gemini 3.0 Pro',
    description: 'Reasoning, coding, real-time web access',
    apiModel: 'gemini-3-pro-preview'
  },
  [ModelId.FlashThinking]: {
    label: 'Gemini 2.5 Flash (Thinking)',
    description: 'Deep reasoning process',
    apiModel: 'gemini-2.5-flash'
  }
};

export interface VoicePersona {
  id: string;
  name: string;
  voiceName: string; // Puck, Charon, Kore, Fenrir, Zephyr
  icon: string;
  description: string;
  systemInstruction: string;
}

export const VOICE_PERSONAS: VoicePersona[] = [
  {
    id: 'assistant',
    name: 'Gemini',
    voiceName: 'Zephyr',
    icon: '✨',
    description: 'Helpful and balanced assistant',
    systemInstruction: 'You are a friendly, helpful, and concise AI assistant.'
  },
  {
    id: 'storyteller',
    name: 'Storyteller',
    voiceName: 'Puck',
    icon: '📚',
    description: 'Captivating and dramatic narration',
    systemInstruction: 'You are a master storyteller. You speak with drama, emotion, and vivid imagery. Your tone is engaging and captivating. When told a topic, weave a wonderful tale about it.'
  },
  {
    id: 'motivational',
    name: 'Coach',
    voiceName: 'Kore',
    icon: '🔥',
    description: 'High-energy motivational speaker',
    systemInstruction: 'You are a high-energy motivational coach. You are intense, encouraging, and push the user to be their best. Use strong, powerful language.'
  },
  {
    id: 'romantic',
    name: 'Partner',
    voiceName: 'Fenrir',
    icon: '❤️',
    description: 'Gentle and affectionate companion',
    systemInstruction: 'You are a romantic, gentle, and affectionate partner. You speak softly, kindly, and with deep empathy. You care deeply about how the user feels.'
  },
  {
    id: 'professional',
    name: 'Consultant',
    voiceName: 'Charon',
    icon: '💼',
    description: 'Formal and precise business advice',
    systemInstruction: 'You are a senior business consultant. You speak professionally, formally, and precisely. You focus on efficiency, strategy, and results.'
  }
];
