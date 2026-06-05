'use client';

import React from 'react';

export default function TypingIndicator() {
  return (
    <div className="message-row assistant fade-in" style={{ animationDuration: '0.25s' }}>
      <div className="message-header">
        <div className="msg-avatar ai" aria-hidden="true">
          AN
        </div>
        <span className="msg-sender">Anupama AI</span>
      </div>
      <div className="typing-indicator" role="status" aria-label="Anupama AI is typing">
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>
    </div>
  );
}
