import React, { useState, useRef, useEffect } from 'react';
import { Send, ArrowUp } from 'lucide-react';

interface InputAreaProps {
  onSend: (message: string) => void;
  disabled: boolean;
  isStreaming: boolean;
}

const InputArea: React.FC<InputAreaProps> = ({ onSend, disabled, isStreaming }) => {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if (input.trim() && !disabled && !isStreaming) {
      onSend(input.trim());
      setInput('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  return (
    <div className="w-full bg-gradient-to-t from-gray-900 via-gray-900 to-transparent pb-6 pt-10 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="relative flex items-end w-full p-3 bg-[#2f2f2f] rounded-[26px] shadow-lg border border-gray-700/50 focus-within:border-gray-600 transition-colors">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled || isStreaming}
            placeholder="Message Gemini..."
            className="w-full bg-transparent text-gray-100 placeholder-gray-400 focus:outline-none resize-none max-h-[200px] overflow-y-auto py-3 pl-3 pr-12 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent"
            style={{ minHeight: '44px' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || disabled || isStreaming}
            className={`absolute right-3 bottom-3 p-2 rounded-full transition-all duration-200 ${
              input.trim() && !disabled && !isStreaming
                ? 'bg-white text-black hover:bg-gray-200'
                : 'bg-[#4a4a4a] text-gray-500 cursor-not-allowed'
            }`}
          >
            {isStreaming ? (
              <div className="w-4 h-4 rounded-full border-2 border-gray-500 border-t-transparent animate-spin" />
            ) : (
              <ArrowUp size={20} strokeWidth={2.5} />
            )}
          </button>
        </div>
        <div className="text-center mt-2">
            <p className="text-[11px] text-gray-500">Gemini can make mistakes. Check important info.</p>
        </div>
      </div>
    </div>
  );
};

export default InputArea;