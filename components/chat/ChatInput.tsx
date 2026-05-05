'use client';

import { useState, useRef, KeyboardEvent } from 'react';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function ChatInput({ onSend, disabled, placeholder = 'Type your message...' }: ChatInputProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  };

  const isEmpty = !input.trim();

  return (
    <div className="flex items-end gap-3 bg-[#2f2f2f] border border-[#3f3f3f] rounded-2xl px-4 py-3 focus-within:border-[#5f5f5f] transition-colors">
      <textarea
        ref={textareaRef}
        value={input}
        onChange={handleTextareaChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        rows={1}
        className="flex-1 resize-none outline-none text-sm text-[#ececec] placeholder-[#b0b0bf] max-h-[120px] disabled:opacity-50 bg-transparent"
        style={{ minHeight: '24px' }}
      />
      <button
        onClick={handleSend}
        disabled={disabled || isEmpty}
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
          isEmpty || disabled
            ? 'bg-[#3f3f3f] text-[#8e8ea0] cursor-not-allowed'
            : 'bg-white text-gray-900 hover:bg-gray-100'
        }`}
      >
        {disabled ? (
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        )}
      </button>
    </div>
  );
}
