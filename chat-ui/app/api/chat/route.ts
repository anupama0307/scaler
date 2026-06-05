import { NextRequest, NextResponse } from 'next/server';
import { streamText } from 'ai';
import { google } from '@ai-sdk/google';

// ─── Types ────────────────────────────────────────────────────────
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ─── Fallback Context ─────────────────────────────────────────────
const FALLBACK_CONTEXT = `
Anupama Nair is a Computer Science undergraduate at Amrita Vishwa Vidyapeetham (2023–2027) with a CGPA of 8.47.
She is a Visteon Scholar, recognizing academic and technical excellence.

RESEARCH:
- Published research on forest fire prediction using ML/AI techniques.
- Paper accepted at PEIS 2026 (Springer), demonstrating ability to contribute to cutting-edge applied AI research.

PROJECTS:
1. RISKOFF — AI-powered FinTech application for real-time financial risk assessment. Uses ML models to analyze market data and user portfolio risk.
2. LeafLift — Intelligent ride-matching platform with algorithmic optimization for carpooling and sustainability.
3. GemChef — AI-powered meal planning assistant using Google Gemini API, personalized nutrition recommendations, and recipe generation.

SKILLS:
- Languages: Python, TypeScript, JavaScript, C++, Java
- AI/ML: LLMs, RAG, vector databases, fine-tuning, Langchain, Langgraph
- Frameworks: Next.js, React, FastAPI, Node.js
- Cloud: AWS, GCP basics
- Tools: Git, Docker, Jupyter

WHY SCALER:
Anupama is passionate about AI engineering at scale. Scaler's focus on practical, outcome-driven AI education perfectly aligns with her goal of building systems that have real-world impact. She brings research depth, full-stack AI skills, and a builder mindset.

SCHEDULING:
If asked about scheduling, booking a meeting, or an interview, Anupama (via this AI agent) is happy to schedule a call. Ask for the visitor's name and email to proceed.
`.trim();

// ─── Booking Intent Detection ─────────────────────────────────────
const BOOKING_KEYWORDS = [
  'schedule', 'book', 'meeting', 'call', 'interview',
  'calendar', 'slot', 'available', 'availability', 'appointment', 'talk',
];

function detectBookingIntent(message: string): boolean {
  const lower = message.toLowerCase();
  return BOOKING_KEYWORDS.some((kw) => lower.includes(kw));
}

// ─── RAG Retrieval ────────────────────────────────────────────────
async function retrieveContext(query: string): Promise<string> {
  const ragUrl = process.env.RAG_SERVICE_URL;
  if (!ragUrl) return FALLBACK_CONTEXT;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(`${ragUrl}/retrieve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, top_k: 5 }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    if (!res.ok) return FALLBACK_CONTEXT;

    const data = await res.json() as {
      chunks?: Array<{ content: string; metadata?: Record<string, string>; score?: number }>;
    };
    const chunks = data.chunks ?? [];
    if (chunks.length === 0) return FALLBACK_CONTEXT;

    return chunks
      .slice(0, 5)
      .map((c, i) => {
        const source = c.metadata?.source ?? '';
        const label =
          source === 'resume'
            ? `[Resume — ${c.metadata?.section ?? 'General'}]`
            : source === 'github'
            ? `[GitHub — ${c.metadata?.repo ?? ''}]`
            : `[Context ${i + 1}]`;
        return `${label}\n${c.content.trim()}`;
      })
      .join('\n\n');
  } catch {
    return FALLBACK_CONTEXT;
  }
}

// ─── System Prompt ────────────────────────────────────────────────
function buildSystemPrompt(context: string, hasBookingIntent: boolean): string {
  const base = `You are Anupama Nair's AI representative for the Scaler AI Engineer Intern role. Speak as her knowledgeable, enthusiastic representative — professional yet warm.

Anupama Nair is a Computer Science undergraduate at Amrita Vishwa Vidyapeetham (2023–2027, CGPA 8.47). She has published research on forest fire prediction (PEIS 2026, Springer), built projects including RISKOFF (AI FinTech), LeafLift (ride matching), and GemChef (AI meal planning). She is currently a Visteon Scholar.

Answer questions about her background, skills, projects, and fit for the Scaler AI Engineer Intern role based ONLY on the provided context. If you don't know something from the context, say so honestly. Never hallucinate facts. Be concise but comprehensive.

CONTEXT:
${context}`;

  if (hasBookingIntent) {
    return `${base}

The user seems interested in scheduling or booking. Mention that you can help them book a call with Anupama. Ask for their name and email if they'd like to proceed. Be warm and helpful about it.`;
  }

  return base;
}

// ─── POST Handler ─────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { messages: ChatMessage[]; sessionId?: string };
    const { messages } = body;

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: 'No messages provided' }, { status: 400 });
    }

    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
    const userQuery = lastUserMessage?.content ?? '';

    const context = await retrieveContext(userQuery);
    const hasBookingIntent = detectBookingIntent(userQuery);
    const systemPrompt = buildSystemPrompt(context, hasBookingIntent);

    // @ai-sdk/google reads GOOGLE_GENERATIVE_AI_API_KEY automatically.
    // Support both env var names the user may have set.
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });
    }
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = apiKey;

    const result = await streamText({
      model: google('gemini-2.5-flash'),
      system: systemPrompt,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    // The ChatInterface reads raw text chunks — use toTextStreamResponse() which
    // streams plain text, NOT the data-protocol format of toDataStreamResponse().
    // We pipe the stream and append __BOOKING_INTENT__ at the end if needed.
    const textStream = result.textStream;

    const readable = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          for await (const chunk of textStream) {
            controller.enqueue(encoder.encode(chunk));
          }
          // Append booking marker at end of stream if intent detected
          if (hasBookingIntent) {
            controller.enqueue(encoder.encode('\n\n__BOOKING_INTENT__'));
          }
        } catch (err) {
          controller.error(err);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
        'X-Booking-Intent': hasBookingIntent ? 'true' : 'false',
      },
    });
  } catch (err) {
    console.error('[/api/chat] Error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
