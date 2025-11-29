import React from 'react';
import { Plus, MessageSquare, Trash2, Settings, X, Eraser } from 'lucide-react';
import { ChatSession } from '../types';

interface SidebarProps {
  sessions: ChatSession[];
  currentSessionId: string | null;
  onNewChat: () => void;
  onSelectChat: (id: string) => void;
  onDeleteChat: (id: string, e: React.MouseEvent) => void;
  onClearCurrentSession: () => void;
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  sessions, 
  currentSessionId, 
  onNewChat, 
  onSelectChat, 
  onDeleteChat,
  onClearCurrentSession,
  isOpen,
  onClose
}) => {
  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-gray-900/80 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <div className={`
        fixed md:static inset-y-0 left-0 z-50
        w-[260px] bg-gray-900 flex flex-col border-r border-gray-800
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        
        {/* New Chat Button */}
        <div className="p-3 flex-shrink-0 flex items-center justify-between">
          <button
            onClick={() => {
                onNewChat();
                if (window.innerWidth < 768) onClose();
            }}
            className="flex-1 flex items-center gap-3 px-3 py-3 border border-gray-700 rounded-md hover:bg-gray-800 transition-colors text-sm text-gray-200"
          >
            <Plus size={16} />
            New chat
          </button>
          <button onClick={onClose} className="md:hidden p-2 text-gray-400">
             <X size={20} />
          </button>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 scrollbar-thin scrollbar-thumb-gray-700">
          <div className="text-xs font-semibold text-gray-500 px-3 py-2">Recent</div>
          {sessions.length === 0 ? (
            <div className="px-3 text-sm text-gray-600 italic">No chat history</div>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                onClick={() => {
                    onSelectChat(session.id);
                    if (window.innerWidth < 768) onClose();
                }}
                className={`
                  group flex items-center gap-3 px-3 py-3 text-sm rounded-md cursor-pointer
                  transition-colors relative overflow-hidden
                  ${session.id === currentSessionId ? 'bg-gray-800 text-white' : 'text-gray-300 hover:bg-gray-800/50'}
                `}
              >
                <MessageSquare size={16} className="flex-shrink-0" />
                <span className="flex-1 truncate relative z-10">
                  {session.title}
                </span>
                
                {session.id === currentSessionId && (
                  <button
                    onClick={(e) => onDeleteChat(session.id, e)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-red-400 z-20"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
                
                {/* Fade effect for text overflow */}
                <div className={`absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l ${session.id === currentSessionId ? 'from-gray-800' : 'from-gray-900 group-hover:from-gray-800'} to-transparent z-0`} />
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-gray-800 space-y-1">
          <button 
            onClick={onClearCurrentSession}
            disabled={!currentSessionId}
            className={`flex items-center gap-3 w-full px-3 py-3 text-sm rounded-md transition-colors ${!currentSessionId ? 'text-gray-600 cursor-not-allowed hidden' : 'text-gray-300 hover:bg-gray-800 hover:text-red-400'}`}
          >
            <Eraser size={16} />
            Clear current chat
          </button>

          <button className="flex items-center gap-3 w-full px-3 py-3 text-sm text-gray-300 hover:bg-gray-800 rounded-md transition-colors">
            <Settings size={16} />
            Settings
          </button>
          <div className="mt-2 px-3 py-2 text-xs text-gray-600 border-t border-gray-800 pt-3">
             Powered by Google Gemini
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;