import { NextRequest, NextResponse } from 'next/server';

// ─── Cal.com helpers (same logic as /api/booking) ─────────────────
function getCalHeaders(version: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${process.env.CAL_COM_API_KEY ?? ''}`,
    'cal-api-version': version,
  };
}

async function getSlots(): Promise<string[]> {
  const username = process.env.CAL_COM_USERNAME ?? 'anupama-nair-3rv2pu';
  const eventTypeSlug = process.env.CAL_COM_EVENT_TYPE_SLUG ?? 'scalar-interview';
  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() + 7);

  const params = new URLSearchParams({
    username,
    eventTypeSlug,
    start: now.toISOString(),
    end: end.toISOString(),
  });

  const res = await fetch(`https://api.cal.com/v2/slots?${params}`, {
    headers: getCalHeaders('2024-09-04'),
  });

  if (!res.ok) return [];

  const data = (await res.json()) as { data?: Record<string, { start: string }[]> };
  const slots: string[] = [];
  for (const daySlots of Object.values(data.data ?? {})) {
    if (!Array.isArray(daySlots)) continue;
    for (const slot of daySlots) {
      slots.push(slot.start);
      if (slots.length >= 5) break;
    }
    if (slots.length >= 5) break;
  }
  return slots;
}

async function bookMeeting(slotStart: string, name: string, email: string) {
  const username = process.env.CAL_COM_USERNAME ?? 'anupama-nair-3rv2pu';
  const eventTypeSlug = process.env.CAL_COM_EVENT_TYPE_SLUG ?? 'scalar-interview';

  const res = await fetch('https://api.cal.com/v2/bookings', {
    method: 'POST',
    headers: getCalHeaders('2024-08-13'),
    body: JSON.stringify({
      start: slotStart,
      eventTypeSlug,
      username,
      attendee: {
        name,
        email,
        timeZone: 'Asia/Kolkata',
        language: 'en',
      },
      metadata: {},
    }),
  });

  return res.ok;
}

// ─── Format ISO to human-readable ─────────────────────────────────
function formatSlot(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  });
}

// ─── POST: Handle Vapi function calls ─────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      message?: {
        type: string;
        functionCall?: {
          name: string;
          parameters: Record<string, string>;
        };
      };
    };

    const message = body.message;

    // Vapi sends a "function-call" message type when it wants to execute a function
    if (message?.type === 'function-call' && message.functionCall) {
      const { name, parameters } = message.functionCall;

      if (name === 'get_available_slots') {
        const slots = await getSlots();
        if (slots.length === 0) {
          return NextResponse.json({
            result: 'No available slots found in the next 7 days. Please ask the caller to check back later.',
          });
        }
        const formatted = slots.map((s, i) => `${i + 1}. ${formatSlot(s)}`).join(', ');
        return NextResponse.json({
          result: `Here are the available slots: ${formatted}. Please ask the caller which one they prefer.`,
        });
      }

      if (name === 'book_meeting') {
        const { slot_start, caller_name, caller_email } = parameters;
        const success = await bookMeeting(slot_start, caller_name, caller_email);
        if (success) {
          return NextResponse.json({
            result: `Great! I've successfully booked a meeting for ${caller_name} at ${formatSlot(slot_start)}. A confirmation has been sent to ${caller_email}. Is there anything else I can help you with?`,
          });
        } else {
          return NextResponse.json({
            result: 'I was unable to book that slot. It may have just been taken. Would you like to try a different time?',
          });
        }
      }
    }

    // For all other Vapi events (call-start, call-end, etc.), just acknowledge
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('[/api/vapi/webhook] Error:', err);
    return NextResponse.json({ result: 'An error occurred. Please try again.' }, { status: 500 });
  }
}
