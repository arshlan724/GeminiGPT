import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Message, Role } from '../types';
import { User, Copy, Check, Globe, AlertCircle, Sparkles, Pencil, X, CornerDownLeft } from 'lucide-react';

interface MessageBubbleProps {
  message: Message;
  onEdit?: (messageId: string, newContent: string) => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, onEdit }) => {
  const isUser = message.role === Role.User;
  const [copied, setCopied] = React.useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reset edit content if message content changes externally
  useEffect(() => {
    setEditContent(message.content);
  }, [message.content]);

  // Auto-resize textarea
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
      textareaRef.current.focus();
    }
  }, [isEditing, editContent]);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveEdit = () => {
    if (editContent.trim() !== message.content) {
      if (onEdit) {
        onEdit(message.id, editContent);
      }
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditContent(message.content);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  return (
    <div className={`w-full flex mb-6 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex gap-4 max-w-3xl w-full ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        
        {/* Avatar */}
        <div className="flex-shrink-0 flex flex-col relative items-end">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            isUser ? 'bg-gray-600' : 'bg-transparent'
          }`}>
            {isUser ? (
              <User size={18} className="text-gray-200" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Sparkles size={16} className="text-white" />
              </div>
            )}
          </div>
        </div>
        
        {/* Message Content */}
        <div className={`relative flex-1 overflow-hidden group ${
          isUser 
            ? 'max-w-[85%] md:max-w-[75%]' 
            : 'text-gray-100 px-1 pt-1 max-w-full'
        }`}>
          {isUser ? (
            // USER MESSAGE
            isEditing ? (
              <div className="bg-[#2f2f2f] border border-gray-600 rounded-2xl rounded-tr-sm p-3">
                <textarea
                  ref={textareaRef}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full bg-transparent text-gray-100 resize-none focus:outline-none text-[15px] leading-relaxed"
                  rows={1}
                />
                <div className="flex justify-end gap-2 mt-3">
                  <button 
                    onClick={handleSaveEdit}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-full transition-colors"
                  >
                    Save & Submit
                  </button>
                  <button 
                    onClick={handleCancelEdit}
                    className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs font-medium rounded-full transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-gray-700/80 text-white rounded-2xl rounded-tr-sm px-5 py-3.5">
                <div className="whitespace-pre-wrap text-[15px] leading-relaxed">{message.content}</div>
              </div>
            )
          ) : (
            // BOT MESSAGE
            <div className="prose prose-invert prose-p:leading-relaxed prose-pre:p-0 max-w-none text-[15px]">
              {message.content === '' && message.isStreaming ? (
                <div className="flex items-center space-x-2 pt-2">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></span>
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></span>
                </div>
              ) : (
                 <ReactMarkdown
                  components={{
                    code({ node, inline, className, children, ...props }: any) {
                      const match = /language-(\w+)/.exec(className || '');
                      return !inline && match ? (
                        <div className="rounded-md overflow-hidden my-4 border border-gray-700/50">
                          <div className="flex items-center justify-between px-4 py-2 bg-[#2d2d2d] border-b border-gray-700/50 text-xs text-gray-400 font-sans">
                            <span>{match[1]}</span>
                          </div>
                          <SyntaxHighlighter
                            style={vscDarkPlus}
                            language={match[1]}
                            PreTag="div"
                            customStyle={{ margin: 0, borderRadius: 0, background: '#1e1e1e' }}
                            {...props}
                          >
                            {String(children).replace(/\n$/, '')}
                          </SyntaxHighlighter>
                        </div>
                      ) : (
                        <code className={`${className} bg-gray-700/50 rounded px-1.5 py-0.5 text-sm font-mono`} {...props}>
                          {children}
                        </code>
                      );
                    },
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              )}
            </div>
          )}

          {/* Error Message Display */}
          {message.errorMessage && (
            <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-300 text-sm flex items-start gap-3">
               <AlertCircle size={16} className="mt-0.5 flex-shrink-0 text-red-400" />
               <div className="flex-1 leading-normal">
                 <span className="font-semibold block mb-0.5 text-red-200">Error</span>
                 {message.errorMessage}
               </div>
            </div>
          )}

          {/* Sources / Grounding Metadata Display */}
          {!isUser && message.groundingMetadata?.groundingChunks && message.groundingMetadata.groundingChunks.length > 0 && (
            <div className="mt-4 pt-3 border-t border-gray-800">
              <div className="text-[11px] font-bold text-gray-500 mb-2 flex items-center gap-1.5 uppercase tracking-wider">
                <Globe size={12} /> 
                Sources
              </div>
              <div className="flex flex-wrap gap-2">
                {message.groundingMetadata.groundingChunks.map((chunk: any, idx: number) => {
                  if (chunk.web) {
                    return (
                       <a 
                          key={idx} 
                          href={chunk.web.uri} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-xs text-gray-300 hover:text-white px-3 py-1.5 rounded-full transition-all max-w-[280px] border border-gray-700/50 hover:border-gray-600"
                          title={chunk.web.title}
                       >
                          <span className="truncate">{chunk.web.title}</span>
                       </a>
                    )
                  }
                  return null;
                })}
              </div>
            </div>
          )}
          
          {/* Action Buttons Row */}
          {!isEditing && !message.isStreaming && (
            <div className={`mt-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 ${isUser ? 'justify-end pr-1' : 'justify-start'}`}>
                {/* Edit Button (User only) */}
                {isUser && onEdit && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="p-1.5 rounded-md hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors"
                    title="Edit message"
                  >
                    <Pencil size={14} />
                  </button>
                )}

                {/* Copy Button (Both) */}
                <button 
                    onClick={handleCopy}
                    className="p-1.5 rounded-md hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors" 
                    title="Copy"
                >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;