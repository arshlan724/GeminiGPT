import React, { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Menu, Headphones, Sparkles } from 'lucide-react';

import { ChatSession, Message, Role, ModelId } from './types';
import * as GeminiService from './services/geminiService';

import Sidebar from './components/Sidebar';
import MessageBubble from './components/MessageBubble';
import InputArea from './components/InputArea';
import ModelSelector from './components/ModelSelector';
import VoiceChatOverlay from './components/VoiceChatOverlay';

const App: React.FC = () => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [currentModel, setCurrentModel] = useState<ModelId>(ModelId.Flash);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isVoiceModeOpen, setIsVoiceModeOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Initialize with a new chat if none exists
  useEffect(() => {
    if (sessions.length === 0 && !currentSessionId) {
      createNewChat();
    }
  }, []);

  const currentSession = sessions.find(s => s.id === currentSessionId);

  useEffect(() => {
    scrollToBottom();
  }, [currentSession?.messages, isStreaming]);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const createNewChat = () => {
    const newSession: ChatSession = {
      id: uuidv4(),
      title: 'New Chat',
      messages: [],
      updatedAt: Date.now(),
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
    setIsSidebarOpen(false); // Close sidebar on mobile on new chat
  };

  const handleDeleteChat = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions(prev => prev.filter(s => s.id !== id));
    if (currentSessionId === id) {
      setCurrentSessionId(null);
      // If we deleted the only one, effect will create a new one, or if others exist, create new
      if (sessions.length <= 1) {
         // It will be handled by the empty check or we can force it
         setTimeout(createNewChat, 0); 
      } else {
         const next = sessions.find(s => s.id !== id);
         if(next) setCurrentSessionId(next.id);
      }
    }
  };

  const handleClearCurrentSession = () => {
    if (!currentSessionId || isStreaming) return;
    
    if (window.confirm("Are you sure you want to clear all messages in this chat?")) {
      setSessions(prev => prev.map(session => {
        if (session.id === currentSessionId) {
          return {
            ...session,
            messages: [],
            updatedAt: Date.now()
          };
        }
        return session;
      }));
    }
  };

  /**
   * Core function to handle generating a response from Gemini
   * Appends a placeholder bot message and streams content into it.
   */
  const generateAIResponse = async (sessionId: string, currentHistory: Message[]) => {
    setIsStreaming(true);

    // Create placeholder for bot message
    const botMessageId = uuidv4();
    const botMessage: Message = {
      id: botMessageId,
      role: Role.Model,
      content: '', // Start empty
      timestamp: Date.now(),
      isStreaming: true,
    };

    // Add bot placeholder to state
    setSessions(prev => prev.map(session => {
      if (session.id === sessionId) {
        return {
          ...session,
          messages: [...session.messages, botMessage],
        };
      }
      return session;
    }));

    try {
      // The history we send to the API should include everything UP TO the bot's turn
      // which is `currentHistory`.
      // Note: The `currentHistory` passed in should ALREADY contain the user's latest message.
      
      let fullResponseText = '';

      // We extract the last message as the "new" message for the API call in some SDK wrappers,
      // but GeminiService.streamChatResponse expects (history, newMessage).
      // Let's separate them.
      const historyForApi = currentHistory.slice(0, -1);
      const lastUserMessage = currentHistory[currentHistory.length - 1];

      if (!lastUserMessage) throw new Error("No user message to respond to.");

      await GeminiService.streamChatResponse(
        currentModel,
        historyForApi, 
        lastUserMessage.content,
        (chunkText, metadata) => {
          fullResponseText += chunkText;
          setSessions(prev => prev.map(session => {
            if (session.id === sessionId) {
              const updatedMessages = session.messages.map(msg => {
                if (msg.id === botMessageId) {
                  const updatedMsg = { ...msg, content: fullResponseText };
                  if (metadata) {
                    updatedMsg.groundingMetadata = metadata;
                  }
                  return updatedMsg;
                }
                return msg;
              });
              return { ...session, messages: updatedMessages };
            }
            return session;
          }));
        }
      );

      // Finalize message state
      setSessions(prev => prev.map(session => {
        if (session.id === sessionId) {
          const updatedMessages = session.messages.map(msg => {
            if (msg.id === botMessageId) {
              return { ...msg, isStreaming: false };
            }
            return msg;
          });
          
          // Generate title if it's the first exchange (2 messages: 1 user, 1 bot)
          if (updatedMessages.length === 2) {
             GeminiService.generateChatTitle(lastUserMessage.content).then(title => {
                setSessions(curr => curr.map(s => s.id === sessionId ? { ...s, title } : s));
             });
          }
          
          return { ...session, messages: updatedMessages, updatedAt: Date.now() };
        }
        return session;
      }));

    } catch (error) {
      console.error("Chat error:", error);
      const friendlyError = GeminiService.getUserFriendlyErrorMessage(error);
      
      setSessions(prev => prev.map(session => {
        if (session.id === sessionId) {
          const updatedMessages = session.messages.map(msg => {
            if (msg.id === botMessageId) {
              return { 
                ...msg, 
                isStreaming: false, 
                isError: true,
                errorMessage: friendlyError
              };
            }
            return msg;
          });
          return { ...session, messages: updatedMessages };
        }
        return session;
      }));
    } finally {
      setIsStreaming(false);
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!currentSessionId || isStreaming) return;

    const userMessage: Message = {
      id: uuidv4(),
      role: Role.User,
      content: text,
      timestamp: Date.now(),
    };

    // 1. Update session with user message first
    let updatedHistory: Message[] = [];
    
    setSessions(prev => {
      return prev.map(session => {
        if (session.id === currentSessionId) {
          const newMessages = [...session.messages, userMessage];
          updatedHistory = newMessages; // Capture for async call
          return {
            ...session,
            messages: newMessages,
            updatedAt: Date.now()
          };
        }
        return session;
      });
    });

    // 2. Trigger AI response
    // We use setTimeout to ensure state is settled or just pass the variables directly.
    // Since we captured `updatedHistory`, we can pass it directly.
    await generateAIResponse(currentSessionId, updatedHistory);
  };

  const handleEditMessage = async (messageId: string, newContent: string) => {
    if (!currentSessionId || isStreaming) return;

    const session = sessions.find(s => s.id === currentSessionId);
    if (!session) return;

    // Find the index of the message being edited
    const msgIndex = session.messages.findIndex(m => m.id === messageId);
    if (msgIndex === -1) return;

    // Truncate history: Keep messages *before* the edited one
    const truncatedHistory = session.messages.slice(0, msgIndex);

    // Create the new version of the user message
    // We create a new ID to ensure it's treated as a fresh turn
    const newMsg: Message = {
      id: uuidv4(),
      role: Role.User,
      content: newContent,
      timestamp: Date.now()
    };

    const newHistory = [...truncatedHistory, newMsg];

    // Update state to reflect truncated history + new message
    setSessions(prev => prev.map(s => {
      if (s.id === currentSessionId) {
        return {
          ...s,
          messages: newHistory,
          updatedAt: Date.now()
        };
      }
      return s;
    }));

    // Trigger AI response with the new history context
    await generateAIResponse(currentSessionId, newHistory);
  };

  return (
    <div className="flex h-screen bg-gray-900 text-gray-100 overflow-hidden font-sans selection:bg-blue-500/30">
      <Sidebar 
        sessions={sessions}
        currentSessionId={currentSessionId}
        onNewChat={createNewChat}
        onSelectChat={(id) => setCurrentSessionId(id)}
        onDeleteChat={handleDeleteChat}
        onClearCurrentSession={handleClearCurrentSession}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <main className="flex-1 flex flex-col h-full relative w-full bg-[#212121]">
        {/* Top Header */}
        <div className="h-14 flex items-center justify-between px-4 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden p-2 text-gray-400 hover:text-white rounded-md hover:bg-gray-800 transition-colors"
            >
              <Menu size={20} />
            </button>
            <ModelSelector 
              currentModel={currentModel} 
              onModelChange={setCurrentModel}
              disabled={isStreaming} 
            />
          </div>
          
          {/* Voice Chat Button */}
          <div>
             <button
                onClick={() => setIsVoiceModeOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-full transition-colors border border-gray-700"
             >
                <Headphones size={16} />
             </button>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
          <div className="max-w-3xl mx-auto px-4 pb-20 pt-6">
            {currentSession?.messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-6">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-2xl shadow-white/10">
                    <Sparkles size={32} className="text-black" />
                </div>
                <div>
                   <h2 className="text-2xl font-semibold text-white mb-2">Welcome</h2>
                   <p className="text-gray-400">Ask anything, or start with voice chat.</p>
                </div>
              </div>
            ) : (
              <>
                {currentSession?.messages.map((msg) => (
                  <MessageBubble 
                    key={msg.id} 
                    message={msg} 
                    onEdit={isStreaming ? undefined : handleEditMessage} 
                  />
                ))}
                <div ref={bottomRef} className="h-4" />
              </>
            )}
          </div>
        </div>

        {/* Input Area */}
        <div className="absolute bottom-0 left-0 w-full z-20">
           <InputArea 
             onSend={handleSendMessage} 
             disabled={!currentSessionId} 
             isStreaming={isStreaming}
           />
        </div>
        
        {/* Voice Overlay */}
        <VoiceChatOverlay 
           isOpen={isVoiceModeOpen} 
           onClose={() => setIsVoiceModeOpen(false)} 
        />
      </main>
    </div>
  );
};

export default App;