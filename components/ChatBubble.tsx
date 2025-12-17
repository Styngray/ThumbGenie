import React from 'react';
import { Message, MessageRole } from '../types';

interface ChatBubbleProps {
  message: Message;
  onReuse?: (text: string) => void;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({ message, onReuse }) => {
  const isUser = message.role === MessageRole.USER;
  const isSystem = message.role === MessageRole.SYSTEM;
  const isError = message.isError;

  if (isSystem) {
    return (
      <div className="flex justify-center my-4 opacity-75">
        <span className="text-xs font-medium text-gray-400 bg-gray-800 px-3 py-1 rounded-full border border-gray-700">
          {message.text}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex w-full mb-4 ${isUser ? 'justify-end' : 'justify-start'} group items-end`}>
      {/* Reuse Button for User messages (appears on left of bubble) */}
      {isUser && onReuse && (
        <button 
          onClick={() => onReuse(message.text)}
          className="mr-2 mb-2 p-1.5 text-gray-500 hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-all transform hover:scale-110"
          title="Reuse this prompt"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
        </button>
      )}

      <div
        className={`relative max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-lg
          ${isUser 
            ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-br-none' 
            : isError
              ? 'bg-red-900/50 border border-red-700 text-red-200 rounded-bl-none'
              : 'bg-gray-800 border border-gray-700 text-gray-200 rounded-bl-none'
          }
        `}
      >
        <p className="whitespace-pre-wrap">{message.text}</p>
        
        {message.imageUrl && !isUser && (
          <div className="mt-3 rounded-lg overflow-hidden border border-gray-600/50 shadow-sm">
            <img src={message.imageUrl} alt="Generated result" className="w-full h-auto object-cover" />
          </div>
        )}
        
        <div className={`text-[10px] mt-1 opacity-50 ${isUser ? 'text-blue-100' : 'text-gray-400'}`}>
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
};