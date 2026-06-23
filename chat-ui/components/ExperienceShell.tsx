'use client';

import React, { useState } from 'react';
import Preloader from './Preloader';
import ChatInterface from './ChatInterface';

export default function ExperienceShell() {
  const [ready, setReady] = useState(false);

  return (
    <>
      {!ready && <Preloader onDone={() => setReady(true)} />}
      {ready && (
        <div className="app-enter">
          <ChatInterface />
        </div>
      )}
    </>
  );
}
