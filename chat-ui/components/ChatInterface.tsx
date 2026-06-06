'use client';

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  FormEvent,
  KeyboardEvent,
} from 'react';
import TypingIndicator from './TypingIndicator';
import BookingWidget from './BookingWidget';
import Vapi from '@vapi-ai/web';
import ReactMarkdown from 'react-markdown';

// ─── Types ────────────────────────────────────────────────────────
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  showBookingWidget?: boolean;
}

// ─── Constants ────────────────────────────────────────────────────
const SUGGESTED_QUESTIONS = [
  'Tell me about RISKOFF',
  'What are your AI skills?',
  'Why Scaler?',
  'Tell me about your research',
  'Schedule an interview',
];

const VAPI_ASSISTANT_ID = '54923852-d7e8-4697-a51c-c33f76bbaf2f';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function containsBookingMarker(text: string): boolean {
  return text.includes('__BOOKING_INTENT__');
}

function stripBookingMarker(text: string): string {
  return text.replace('__BOOKING_INTENT__', '').trimEnd();
}

// ─── PhoneIcon SVG ────────────────────────────────────────────────
function PhoneIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.68A2 2 0 012 .91h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
    </svg>
  );
}

// ─── SendIcon SVG ─────────────────────────────────────────────────
function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

// ─── ChatInterface ────────────────────────────────────────────────
export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ─── Vapi Web Call State ─────────────────────────────────────────
  const vapiRef = useRef<InstanceType<typeof Vapi> | null>(null);
  const [callStatus, setCallStatus] = useState<'idle' | 'loading' | 'active'>('idle');

  const getVapi = useCallback(() => {
    const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY ?? '';
    if (!publicKey) return null;
    if (!vapiRef.current) {
      vapiRef.current = new Vapi(publicKey);
      vapiRef.current.on('call-start', () => setCallStatus('active'));
      vapiRef.current.on('call-end', () => setCallStatus('idle'));
      vapiRef.current.on('error', (e: Error) => {
        console.error('Vapi Error:', e);
        if (callStatus === 'loading') {
          alert('Voice Call Error: ' + (e.message || 'The connection failed.'));
        }
        setCallStatus('idle');
      });
    }
    return vapiRef.current;
  }, []);

  const toggleCall = useCallback(async () => {
    if (callStatus === 'active') {
      vapiRef.current?.stop();
      setCallStatus('idle');
    } else if (callStatus === 'idle') {
      const vapi = getVapi();
      if (!vapi) {
        alert('NEXT_PUBLIC_VAPI_PUBLIC_KEY is not set. Please restart the dev server after adding it to chat-ui/.env.local.');
        return;
      }
      setCallStatus('loading');
      try {
        await vapi.start(VAPI_ASSISTANT_ID);
      } catch (e) {
        console.error('Failed to start Vapi call', e);
        setCallStatus('idle');
      }
    }
  }, [callStatus, getVapi]);

  // ─── Auto-scroll ───────────────────────────────────────────────
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  // ─── Textarea auto-resize ──────────────────────────────────────
  const resizeTextarea = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, []);

  useEffect(() => {
    resizeTextarea();
  }, [input, resizeTextarea]);

  // ─── Send message ──────────────────────────────────────────────
  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      const userMsg: Message = {
        id: generateId(),
        role: 'user',
        content: trimmed,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setIsLoading(true);

      const assistantId = generateId();
      const assistantMsg: Message = {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);

      try {
        const ctrl = new AbortController();
        abortRef.current = ctrl;

        const allMessages = [...messages, userMsg].map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: allMessages }),
          signal: ctrl.signal,
        });

        if (!res.ok || !res.body) {
          throw new Error(`API error ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = '';

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });

          // Strip marker for live rendering
          const displayText = containsBookingMarker(accumulated)
            ? stripBookingMarker(accumulated)
            : accumulated;

          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: displayText } : m
            )
          );
        }

        // Final: check for booking marker
        const hasBooking = containsBookingMarker(accumulated);
        const finalContent = hasBooking
          ? stripBookingMarker(accumulated)
          : accumulated;

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: finalContent, showBookingWidget: hasBooking }
              : m
          )
        );
      } catch (err: unknown) {
        if ((err as { name?: string }).name === 'AbortError') return;
        const errorText = err instanceof Error ? err.message : 'Something went wrong.';
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: `Sorry, I encountered an error: ${errorText}\n\nPlease try again.`,
                }
              : m
          )
        );
      } finally {
        setIsLoading(false);
        abortRef.current = null;
      }
    },
    [isLoading, messages]
  );

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleChipClick = (question: string) => {
    sendMessage(question);
  };

  const isEmpty = messages.length === 0;

  // ─── Render ────────────────────────────────────────────────────
  return (
    <div className="chat-layout">
      {/* Header */}
      <header className="chat-header">
        <div className="header-identity">
          <div className="header-avatar" aria-hidden="true">
            AN
            <span className="live-dot" aria-label="Online" />
          </div>
          <div className="header-info">
            <div className="header-name gradient-text">Anupama Nair — AI Agent</div>
            <div className="header-status">
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: '#22c55e',
                  display: 'inline-block',
                }}
              />
              Online · Scaler AI Intern Candidate
            </div>
          </div>
        </div>
        <div className="header-actions">
          <button
            onClick={toggleCall}
            disabled={callStatus === 'loading'}
            className={`voice-call-btn ${callStatus === 'active' ? 'call-active' : callStatus === 'loading' ? 'call-loading' : ''}`}
            title={callStatus === 'active' ? 'End voice call' : 'Start live voice call — works from any browser!'}
            aria-label={callStatus === 'active' ? 'End voice call' : 'Start live voice call'}
          >
            {callStatus === 'loading' ? (
              <><span className="live-dot" /> Connecting…</>
            ) : callStatus === 'active' ? (
              <><PhoneIcon /> End Call</>
            ) : (
              <><PhoneIcon /> 🎙️ Try Voice Call</>
            )}
          </button>
        </div>
      </header>

      {/* Messages */}
      <div
        className="messages-container"
        role="log"
        aria-live="polite"
        aria-label="Chat messages"
      >
        {/* Hero / Empty State */}
        {isEmpty && (
          <div className="hero-state">
            <div className="hero-avatar" aria-hidden="true">AN</div>
            <div>
              <h1 className="hero-title">
                Hi, I&apos;m{' '}
                <span className="gradient-text">Anupama&apos;s</span>
                <br />
                AI Representative
              </h1>
            </div>
            <p className="hero-subtitle">
              Ask me anything about Anupama's background, research, projects,
              skills, or why she&apos;s the perfect fit for the Scaler AI
              Engineer Intern role.
            </p>
            <div className="chips-grid" role="list" aria-label="Suggested questions">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  className="chip"
                  onClick={() => handleChipClick(q)}
                  type="button"
                  role="listitem"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message list */}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`message-row ${msg.role}`}
            role="article"
            aria-label={`${msg.role === 'user' ? 'You' : 'Anupama AI'}: ${msg.content.slice(0, 80)}`}
          >
            {/* Header (only for assistant) */}
            {msg.role === 'assistant' && (
              <div className="message-header">
                <div className="msg-avatar ai" aria-hidden="true">AN</div>
                <span className="msg-sender">Anupama AI</span>
                <span className="msg-time">{formatTime(msg.timestamp)}</span>
              </div>
            )}

            {/* Bubble */}
            {msg.role === 'user' ? (
              <>
                <div className="message-header">
                  <span className="msg-time" style={{ marginLeft: 0, marginRight: 'auto' }}>
                    {formatTime(msg.timestamp)}
                  </span>
                  <span className="msg-sender">You</span>
                  <div className="msg-avatar user" aria-hidden="true">U</div>
                </div>
                <div className="bubble-user">{msg.content}</div>
              </>
            ) : (
              <>
                <div className="bubble-ai">
                  {msg.content ? (
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  ) : (
                    <span style={{ opacity: 0.4, fontStyle: 'italic' }}>Thinking…</span>
                  )}
                </div>
                {/* Booking widget */}
                {msg.showBookingWidget && <BookingWidget />}
              </>
            )}
          </div>
        ))}

        {/* Typing indicator */}
        {isLoading &&
          messages.length > 0 &&
          messages[messages.length - 1]?.role === 'user' && (
            <TypingIndicator />
          )}

        <div ref={messagesEndRef} aria-hidden="true" />
      </div>

      {/* Input area */}
      <div className="input-area">
        <form onSubmit={handleSubmit}>
          <div className="input-wrapper">
            <textarea
              ref={textareaRef}
              className="chat-textarea"
              placeholder="Ask about Anupama's skills, projects, research…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              aria-label="Message input"
              disabled={isLoading}
            />
            <button
              type="submit"
              className="send-btn"
              disabled={!input.trim() || isLoading}
              aria-label="Send message"
              title="Send (⌘ + Enter)"
            >
              <SendIcon />
            </button>
          </div>
        </form>
        <p className="input-hint">
          Press <kbd style={{ fontFamily: 'monospace', opacity: 0.6 }}>⌘ Enter</kbd> to send
        </p>
      </div>
    </div>
  );
}
