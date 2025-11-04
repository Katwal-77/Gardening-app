
import React from 'react';

export const TypingIndicator = () => (
  <div className="flex space-x-1.5 items-center">
    <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse-dot" style={{ animationDelay: '0s' }}></div>
    <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse-dot" style={{ animationDelay: '0.2s' }}></div>
    <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse-dot" style={{ animationDelay: '0.4s' }}></div>
  </div>
);
