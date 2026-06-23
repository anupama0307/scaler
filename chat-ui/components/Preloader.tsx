'use client';

import React, { useEffect, useRef, useState } from 'react';

interface PreloaderProps {
  onDone: () => void;
}

const STAGES = ['initializing', 'loading persona', 'embedding context', 'almost ready'];
const BRAND = 'ANUPAMA';

export default function Preloader({ onDone }: PreloaderProps) {
  const [count, setCount] = useState(0);
  const [exiting, setExiting] = useState(false);
  const rafRef = useRef<number | null>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const duration = reduce ? 600 : 2600;
    const start = performance.now();

    const finish = () => {
      if (doneRef.current) return;
      doneRef.current = true;
      setTimeout(() => setExiting(true), 400);
      setTimeout(() => onDone(), 400 + 750);
    };

    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setCount(Math.round(eased * 100));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setCount(100);
        finish();
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [onDone]);

  const stage = STAGES[Math.min(Math.floor(count / 25), STAGES.length - 1)];
  const padded = String(count).padStart(3, '0');

  return (
    <div className={`preloader${exiting ? ' preloader-exit' : ''}`} role="status" aria-label="Loading">
      <div className="pl-sweep" aria-hidden="true" />
      <div className="pl-orb pl-orb-a" aria-hidden="true" />
      <div className="pl-orb pl-orb-b" aria-hidden="true" />

      {/* Brand lettering */}
      <div className="pl-brand" aria-hidden="true">
        {BRAND.split('').map((ch, i) => (
          <span key={i} style={{ animationDelay: `${0.15 + i * 0.06}s` }}>
            {ch}
          </span>
        ))}
      </div>

      {/* Big counter — leading zeros dimmed for an odometer feel */}
      <div className="pl-number" aria-hidden="true">
        {padded.split('').map((d, i) => {
          const isLeadingZero = i < padded.length - String(count).length;
          return (
            <span key={i} className={`pl-digit${isLeadingZero ? ' pl-digit-dim' : ''}`}>
              {d}
            </span>
          );
        })}
        <span className="pl-percent">%</span>
      </div>

      {/* Progress line with a glowing leading dot */}
      <div className="pl-bar">
        <div className="pl-bar-fill" style={{ width: `${count}%` }}>
          <span className="pl-bar-dot" />
        </div>
      </div>

      {/* Caption */}
      <div className="pl-caption">
        <span className="pl-stage">{stage}</span>
        <span className="pl-readout">{padded} / 100</span>
      </div>
    </div>
  );
}
