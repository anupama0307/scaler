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
import GitHubPanel from './GitHubPanel';
import Vapi from '@vapi-ai/web';
import ReactMarkdown from 'react-markdown';

// ─── Types ────────────────────────────────────────────────────────
interface Source {
  type: 'resume' | 'github' | 'persona' | 'context';
  label: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  showBookingWidget?: boolean;
  sources?: Source[];
}

type Theme = 'dark' | 'light';

// ─── Constants ────────────────────────────────────────────────────
const SUGGESTED_QUESTIONS = [
  'Tell me about RISKOFF',
  'What are your AI skills?',
  'What are you passionate about?',
  'Tell me about your research',
  'Schedule a call',
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

// Decode the base64 X-Sources header (UTF-8 safe) into a Source list.
function decodeSources(header: string | null): Source[] {
  if (!header) return [];
  try {
    const json = decodeURIComponent(
      atob(header)
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
    );
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as Source[]) : [];
  } catch {
    return [];
  }
}

const SOURCE_ICONS: Record<Source['type'], string> = {
  resume: '📄',
  github: '⌥',
  persona: '👤',
  context: '🔎',
};

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

// ─── Header action icons ──────────────────────────────────────────
function GitHubIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-2c-3.2.7-3.88-1.54-3.88-1.54-.53-1.34-1.3-1.7-1.3-1.7-1.06-.72.08-.71.08-.71 1.17.08 1.79 1.2 1.79 1.2 1.04 1.79 2.73 1.27 3.4.97.1-.76.41-1.27.74-1.56-2.55-.29-5.23-1.28-5.23-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 015.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.69 5.39-5.25 5.68.42.36.79 1.08.79 2.18v3.23c0 .31.21.68.8.56A11.51 11.51 0 0023.5 12C23.5 5.73 18.27.5 12 .5z" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function ExportIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="13" y2="17" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  );
}

// ─── ChatInterface ────────────────────────────────────────────────
export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [theme, setTheme] = useState<Theme>('dark');
  const [showGitHub, setShowGitHub] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ─── Theme: init from localStorage, apply to <html> ──────────────
  useEffect(() => {
    const stored = (typeof window !== 'undefined' && localStorage.getItem('theme')) as Theme | null;
    if (stored === 'light' || stored === 'dark') {
      setTheme(stored);
    }
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('theme', theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  }, []);

  // ─── Export conversation as PDF ──────────────────────────────────
  const exportChat = useCallback(async () => {
    if (messages.length === 0) return;

    // Strip light markdown + non-Latin glyphs that the PDF font can't render
    const clean = (s: string) =>
      s
        .replace(/[*_`#>]/g, '')
        .replace(/—/g, '-')
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .replace(/[^\x00-\x7F]/g, '')
        .trim();

    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });

    const margin = 48;
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const maxW = pageW - margin * 2;
    let y = margin;

    const ensureSpace = (h: number) => {
      if (y + h > pageH - margin) {
        doc.addPage();
        y = margin;
      }
    };

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(20, 23, 41);
    doc.text('Conversation with Anupama Nair - AI Representative', margin, y);
    y += 20;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(130, 138, 160);
    doc.text(`Exported ${new Date().toLocaleString()}`, margin, y);
    y += 14;

    doc.setDrawColor(220, 224, 234);
    doc.line(margin, y, pageW - margin, y);
    y += 22;

    for (const m of messages) {
      // Role label
      ensureSpace(28);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      if (m.role === 'user') {
        doc.setTextColor(8, 145, 178);
        doc.text('You', margin, y);
      } else {
        doc.setTextColor(79, 70, 229);
        doc.text('Anupama AI', margin, y);
      }
      y += 16;

      // Body text (wrapped)
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10.5);
      doc.setTextColor(35, 41, 60);
      const lines = doc.splitTextToSize(clean(m.content) || '(no content)', maxW) as string[];
      for (const line of lines) {
        ensureSpace(15);
        doc.text(line, margin, y);
        y += 15;
      }

      // Sources
      if (m.sources?.length) {
        ensureSpace(14);
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8.5);
        doc.setTextColor(130, 138, 160);
        const srcLines = doc.splitTextToSize(
          `Sources: ${m.sources.map((s) => s.label).join(', ')}`,
          maxW
        ) as string[];
        for (const line of srcLines) {
          ensureSpace(12);
          doc.text(line, margin, y);
          y += 12;
        }
      }

      y += 12;
    }

    doc.save(`anupama-chat-${new Date().toISOString().slice(0, 10)}.pdf`);
  }, [messages]);

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

        const sources = decodeSources(res.headers.get('X-Sources'));

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
              ? { ...m, content: finalContent, showBookingWidget: hasBooking, sources }
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
              Online · CS Student & AI Builder
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

          <button
            className="icon-btn"
            onClick={() => setShowGitHub(true)}
            title="View recent GitHub activity"
            aria-label="View GitHub activity"
            type="button"
          >
            <GitHubIcon />
          </button>

          <a
            className="icon-btn"
            href="/resume.pdf"
            download
            title="Download résumé (PDF)"
            aria-label="Download résumé"
          >
            <DownloadIcon />
          </a>

          <button
            className="icon-btn"
            onClick={exportChat}
            disabled={isEmpty}
            title="Export this conversation (PDF)"
            aria-label="Export conversation"
            type="button"
          >
            <ExportIcon />
          </button>

          <button
            className="theme-toggle-btn"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label="Toggle color theme"
            type="button"
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
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
            <div className="hero-avatar" aria-hidden="true">
              AN
              <span className="live-dot" aria-hidden="true" />
            </div>

            <div className="hero-badge">
              <span className="hero-badge-dot" aria-hidden="true" />
              Personal AI Agent · Online
            </div>

            <div>
              <h1 className="hero-title">
                Hi, I&apos;m{' '}
                <span className="gradient-text shimmer">Anupama&apos;s</span>
                <br />
                AI Representative
              </h1>
            </div>

            <p className="hero-subtitle">
              Ask me anything about Anupama&apos;s background, research, projects,
              and skills — or get to know the person behind the code.
            </p>

            <div className="hero-facts" aria-label="Quick facts">
              <span className="hero-fact">🎓 CS @ Amrita</span>
              <span className="hero-fact">📄 Published Researcher</span>
              <span className="hero-fact">🛠️ AI / ML Builder</span>
            </div>

            <div className="hero-prompt-label">Try asking</div>
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
                {/* Source citations */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="sources-row" aria-label="Sources">
                    <span className="sources-label">Sources</span>
                    {msg.sources.map((s, i) => (
                      <span key={i} className={`source-chip source-${s.type}`}>
                        <span aria-hidden="true">{SOURCE_ICONS[s.type]}</span>
                        {s.label}
                      </span>
                    ))}
                  </div>
                )}
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

      {/* GitHub activity modal */}
      {showGitHub && <GitHubPanel onClose={() => setShowGitHub(false)} />}
    </div>
  );
}
