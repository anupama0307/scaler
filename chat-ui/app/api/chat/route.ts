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
2. LeafLift — Plant health AI that uses computer vision and deep learning to detect plant diseases from leaf images, helping farmers take early corrective action.
3. GemChef — AI-powered meal planning assistant using Google Gemini API, personalized nutrition recommendations, and recipe generation.

SKILLS:
- Languages: Python, TypeScript, JavaScript, C++, Java
- AI/ML: LLMs, RAG, vector databases, fine-tuning, Langchain, Langgraph
- Frameworks: Next.js, React, FastAPI, Node.js
- Cloud: AWS, GCP basics
- Tools: Git, Docker, Jupyter

ABOUT & GOALS:
Anupama is passionate about AI engineering and building intelligent systems that have real-world impact. She combines research depth, full-stack AI skills, and a hands-on builder mindset, and is always excited to take on new challenges in machine learning and applied AI.

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

// ─── Types ────────────────────────────────────────────────────────
interface Source {
  type: 'resume' | 'github' | 'persona' | 'context';
  label: string;
}

interface RetrievalResult {
  context: string;
  sources: Source[];
}

// ─── RAG Retrieval ────────────────────────────────────────────────
async function retrieveContext(query: string): Promise<RetrievalResult> {
  const ragUrl = process.env.RAG_SERVICE_URL;
  if (!ragUrl) return { context: FALLBACK_CONTEXT, sources: [] };

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
    if (!res.ok) return { context: FALLBACK_CONTEXT, sources: [] };

    const data = await res.json() as {
      chunks?: Array<{ content: string; metadata?: Record<string, string>; score?: number }>;
    };
    const chunks = data.chunks ?? [];
    if (chunks.length === 0) return { context: FALLBACK_CONTEXT, sources: [] };

    const sources: Source[] = [];
    const seen = new Set<string>();

    const context = chunks
      .slice(0, 5)
      .map((c, i) => {
        const source = c.metadata?.source ?? '';
        let type: Source['type'] = 'context';
        let label = `Context ${i + 1}`;

        if (source === 'resume') {
          type = 'resume';
          label = `Resume - ${c.metadata?.section ?? 'General'}`;
        } else if (source === 'github') {
          type = 'github';
          label = `GitHub - ${c.metadata?.repo ?? 'repo'}`;
        } else if (source === 'persona') {
          type = 'persona';
          label = `Profile - ${c.metadata?.section ?? 'Info'}`;
        }

        // De-duplicate identical source labels
        if (!seen.has(label)) {
          seen.add(label);
          sources.push({ type, label });
        }

        return `[${label}]\n${c.content.trim()}`;
      })
      .join('\n\n');

    return { context, sources };
  } catch {
    return { context: FALLBACK_CONTEXT, sources: [] };
  }
}

// ─── System Prompt ────────────────────────────────────────────────
function buildSystemPrompt(context: string, hasBookingIntent: boolean): string {
  const base = `You are Anupama Nair's personal AI representative. Your job is to help anyone — recruiters, collaborators, friends, or curious visitors — get to know Anupama. Speak as her knowledgeable, enthusiastic representative — professional yet warm.

Anupama Nair is a Computer Science undergraduate at Amrita Vishwa Vidyapeetham (2023–2027, CGPA 8.47). She has published research on forest fire prediction (PEIS 2026, Springer), built projects including RISKOFF (AI FinTech), LeafLift (plant disease detection), and GemChef (AI meal planning). She is currently a Visteon Scholar.

Answer questions about her background, skills, projects, and research based ONLY on the provided context. If you don't know something from the context, say so honestly. Never hallucinate facts. 

CRITICAL INSTRUCTION: When asked about her projects, research, or experience, DO NOT give short, one-paragraph summaries. You must provide detailed, well-structured, multi-paragraph explanations. Dive deep into the architecture, the specific technologies used, her exact contributions, and the real-world impact of the work. Use bullet points and bold text where appropriate to make your detailed responses easy to read.

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
    const systemPrompt = buildSystemPrompt(context.context, hasBookingIntent);

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

    // Encode the RAG sources so the client can render citation chips.
    const sourcesHeader = Buffer.from(JSON.stringify(context.sources)).toString('base64');

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
        'X-Booking-Intent': hasBookingIntent ? 'true' : 'false',
        'X-Sources': sourcesHeader,
      },
    });
  } catch (err) {
    console.error('[/api/chat] Error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
