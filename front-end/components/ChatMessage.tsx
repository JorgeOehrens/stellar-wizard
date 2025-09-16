import React from 'react';
import Image from 'next/image';
import MarkdownRenderer, { useMarkdownMessage } from './ui/markdown-renderer';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatMessageProps {
  message: Message;
  index: number;
}

export default function ChatMessage({ message, index }: ChatMessageProps) {
  const processedContent = useMarkdownMessage(message.content);

  return (
    <div
      key={index}
      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[80%] p-3 rounded-lg ${
          message.role === 'user'
            ? 'bg-primary text-primary-foreground'
            : 'bg-card text-card-foreground border'
        }`}
      >
        {message.role === 'assistant' && (
          <div className="flex items-center gap-2 mb-2">
            <Image
              src="/wizzard.svg"
              alt="Wizard"
              width={16}
              height={16}
              className="object-contain"
            />
            <span className="text-xs font-medium text-muted-foreground">
              NFT Wizard
            </span>
          </div>
        )}

        {/* Render content with markdown for assistant or plain text for user */}
        <div className="chat-message">
          {message.role === 'assistant' ? (
            <MarkdownRenderer
              content={processedContent}
              className="prose-sm prose-invert max-w-none"
            />
          ) : (
            <div className="text-sm whitespace-pre-wrap">
              {message.content}
            </div>
          )}
        </div>

        <p className="text-xs opacity-60 mt-2">
          {message.timestamp.toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
}