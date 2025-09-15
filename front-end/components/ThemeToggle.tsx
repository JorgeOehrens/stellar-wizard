'use client';

import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../app/providers/ThemeProvider';

const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      aria-label="Toggle theme"
    >
      {theme === 'light' ? (
        <Moon className="w-4 h-4 text-gray-600" />
      ) : (
        <Sun className="w-4 h-4 text-gray-400" />
      )}
    </button>
  );
};

export default ThemeToggle;