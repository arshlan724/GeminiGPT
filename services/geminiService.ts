import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { Message, Role, ModelId, ModelConfig } from "../types";

// Ensure API key is present
const apiKey = process.env.API_KEY;
if (!apiKey) {
  console.warn("API_KEY is missing from environment variables. Chat functionality will likely fail.");
}

const ai = new GoogleGenAI({ apiKey: apiKey || 'dummy-key-for-build' });

const SYSTEM_INSTRUCTION = `You are a highly capable AI assistant powered by Google's Gemini models. You have access to real-time information via Google Search.

Core Responsibilities:
1. **Real-Time Knowledge**: If a user asks about current events, news, or dynamic information (e.g., "stock price of X", "weather in Y", "who won the game yesterday"), utilize your search capabilities to provide accurate, up-to-date answers.
2. **Problem Solving**: Approach problems methodically. Break down complex tasks into manageable steps.
3. **Code Generation**: When asked for code, provide clean, production-ready, and well-commented code.
4. **Clarity & Conciseness**: Be direct. Use Markdown (lists, headers, code blocks) to organize information effectively.
5. **Accuracy**: Strive for factual correctness. If a query involves ambiguous or missing information, ask clarifying questions.

Your goal is to be the most helpful assistant for the user's specific needs, utilizing the web when necessary to ensure information is current.`;

/**
 * Transforms internal message format to the API format.
 */
const formatHistory = (messages: Message[]) => {
  return messages.map(msg => ({
    role: msg.role === Role.User ? 'user' : 'model',
    parts: [{ text: msg.content }]
  }));
};

/**
 * Converts raw API errors into user-friendly messages.
 */
export const getUserFriendlyErrorMessage = (error: unknown): string => {
  const msg = error instanceof Error ? error.message : String(error);
  
  if (msg.includes('429') || msg.includes('Quota exceeded') || msg.includes('Resource has been exhausted')) {
    return "You've reached the request limit for the API key. Please wait a moment or check your quota.";
  }
  if (msg.includes('401') || msg.includes('403') || msg.includes('API key')) {
    return "Authentication failed. Please check your API key settings.";
  }
  if (msg.includes('503') || msg.includes('Overloaded')) {
    return "The model is currently overloaded. Please try again later.";
  }
  if (msg.includes('SAFETY') || msg.includes('blocked')) {
    return "The response was blocked due to safety settings.";
  }
  if (msg.includes('fetch failed') || msg.includes('NetworkError') || msg.includes('Failed to fetch')) {
    return "Network error. Please check your internet connection.";
  }
  
  return msg || "An unexpected error occurred. Please try again.";
};

/**
 * Sends a chat message to Gemini with streaming response.
 */
export const streamChatResponse = async (
  currentModelId: ModelId,
  history: Message[],
  newMessage: string,
  onChunk: (text: string, metadata?: any) => void
): Promise<string> => {
  
  const config = ModelConfig[currentModelId];
  const modelName = config.apiModel;
  
  // Configure specific model settings
  const generationConfig: any = {
    systemInstruction: SYSTEM_INSTRUCTION,
    tools: [{ googleSearch: {} }] // Enable Google Search Grounding for real-time info
  };
  
  // If user selected the "Thinking" variant
  if (currentModelId === ModelId.FlashThinking) {
    generationConfig.thinkingConfig = { thinkingBudget: 1024 }; 
    // Thinking models might have stricter tool usage, but we leave search enabled if supported
  }

  try {
    const chat = ai.chats.create({
      model: modelName,
      config: generationConfig,
      history: formatHistory(history),
    });

    const resultStream = await chat.sendMessageStream({ message: newMessage });

    let fullText = '';
    
    for await (const chunk of resultStream) {
      const c = chunk as GenerateContentResponse;
      const text = c.text;
      const metadata = c.candidates?.[0]?.groundingMetadata;

      // Check for safety blocks or other finish reasons that aren't normal
      const finishReason = c.candidates?.[0]?.finishReason;
      if (!text && finishReason && finishReason !== 'STOP') {
        throw new Error(`Response blocked due to ${finishReason}`);
      }

      if (text) {
        fullText += text;
      }
      
      // Pass text (even if empty, to ensure metadata updates) and metadata
      onChunk(text || '', metadata);
    }

    return fullText;
  } catch (error) {
    console.error("Error streaming chat response:", error);
    throw error;
  }
};

/**
 * Generates a title for a chat session based on the first message.
 */
export const generateChatTitle = async (firstMessage: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Generate a very short, concise title (max 4-5 words) for a chat that starts with this message: "${firstMessage}". Do not use quotes.`,
    });
    return response.text?.trim() || 'New Chat';
  } catch (e) {
    console.warn("Failed to generate chat title:", e);
    return 'New Chat';
  }
};