import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import { cn } from '@/lib/utils';

// Import highlight.js CSS theme
import 'highlight.js/styles/github-dark.css';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export default function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return (
    <div className={cn('prose prose-sm max-w-none dark:prose-invert', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight, rehypeRaw]}
        components={{
          // Custom heading styles
          h1: ({ children }) => (
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4 mt-6">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3 mt-5">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2 mt-4">
              {children}
            </h3>
          ),

          // Custom paragraph styles
          p: ({ children }) => (
            <p className="text-gray-800 dark:text-gray-200 mb-3 leading-relaxed">
              {children}
            </p>
          ),

          // Custom list styles
          ul: ({ children }) => (
            <ul className="list-disc list-inside mb-3 space-y-1 text-gray-800 dark:text-gray-200">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside mb-3 space-y-1 text-gray-800 dark:text-gray-200">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="text-gray-800 dark:text-gray-200">
              {children}
            </li>
          ),

          // Custom code block styles
          code: ({ className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || '');
            const isBlock = match;

            if (isBlock) {
              return (
                <div className="relative">
                  <div className="bg-gray-900 dark:bg-gray-800 rounded-lg p-4 my-4 overflow-x-auto">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-400 uppercase">
                        {match[1]}
                      </span>
                    </div>
                    <code
                      className={cn(
                        'text-sm text-gray-100 font-mono',
                        className
                      )}
                      {...props}
                    >
                      {children}
                    </code>
                  </div>
                </div>
              );
            }

            // Inline code
            return (
              <code
                className="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-1.5 py-0.5 rounded text-sm font-mono"
                {...props}
              >
                {children}
              </code>
            );
          },

          // Custom blockquote styles
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-900/20 pl-4 py-2 my-4 italic text-gray-700 dark:text-gray-300">
              {children}
            </blockquote>
          ),

          // Custom table styles
          table: ({ children }) => (
            <div className="overflow-x-auto my-4">
              <table className="min-w-full border border-gray-300 dark:border-gray-600">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-gray-100 dark:bg-gray-800">
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left font-semibold text-gray-900 dark:text-gray-100">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-gray-800 dark:text-gray-200">
              {children}
            </td>
          ),

          // Custom link styles
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline"
            >
              {children}
            </a>
          ),

          // Custom horizontal rule
          hr: () => (
            <hr className="border-t border-gray-300 dark:border-gray-600 my-6" />
          ),

          // Custom strong/bold styles
          strong: ({ children }) => (
            <strong className="font-semibold text-gray-900 dark:text-gray-100">
              {children}
            </strong>
          ),

          // Custom emphasis/italic styles
          em: ({ children }) => (
            <em className="italic text-gray-800 dark:text-gray-200">
              {children}
            </em>
          )
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

// Hook for formatting messages in chat
export function useMarkdownMessage(content: string) {
  // Clean up the content and handle special formatting
  const cleanContent = React.useMemo(() => {
    if (!content) return '';

    // Handle code blocks that might not have proper markdown formatting
    let processed = content;

    // Auto-detect JSON and wrap in code blocks
    const jsonRegex = /(\{[\s\S]*\}|\[[\s\S]*\])/g;
    processed = processed.replace(jsonRegex, (match) => {
      try {
        JSON.parse(match);
        return `\`\`\`json\n${match}\n\`\`\``;
      } catch {
        return match;
      }
    });

    // Auto-detect URLs and make them clickable
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    processed = processed.replace(urlRegex, '[$1]($1)');

    return processed;
  }, [content]);

  return cleanContent;
}