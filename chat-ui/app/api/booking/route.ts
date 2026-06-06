import { NextRequest, NextResponse } from 'next/server';

// ─── Types ────────────────────────────────────────────────────────
interface CalComSlot {
  start: string;
  end: string;
}

interface CalComSlotsResponse {
  status: string;
  data: {
    slots: Record<string, CalComSlot[]>;
  };
}

interface BookingRequestBody {
  slotStart: string;
  name: string;
  email: string;
  notes?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────
function getCalHeaders(version: string): HeadersInit {
  const apiKey = process.env.CAL_COM_API_KEY ?? '';
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
    'cal-api-version': version,
  };
}

function getNextNDays(n: number): { startTime: string; endTime: string } {
  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() + n);
  return {
    startTime: now.toISOString(),
    endTime: end.toISOString(),
  };
}

// ─── GET: Fetch available slots ───────────────────────────────────
export async function GET() {
  try {
    const username = process.env.CAL_COM_USERNAME ?? 'anupama-nair';
    const eventTypeSlug = process.env.CAL_COM_EVENT_TYPE_SLUG ?? 'scalar-interview';
    const { startTime, endTime } = getNextNDays(14);

    const params = new URLSearchParams({
      username,
      eventTypeSlug,
      start: startTime,
      end: endTime,
    });

    const url = `https://api.cal.com/v2/slots?${params.toString()}`;

    const res = await fetch(url, {
      method: 'GET',
      headers: getCalHeaders('2024-09-04'),
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('[/api/booking GET] Cal.com error:', res.status, errorText);
      return NextResponse.json(
        { error: `Cal.com API error: ${res.status}` },
        { status: res.status }
      );
    }

    const data = (await res.json()) as CalComSlotsResponse;

    // Return all available slots across all days
    const allSlots: string[] = [];
    for (const daySlots of Object.values(data.data ?? {})) {
      if (!Array.isArray(daySlots)) continue;
      for (const slot of daySlots as CalComSlot[]) {
        allSlots.push(slot.start);
      }
    }

    return NextResponse.json({ slots: allSlots });
  } catch (err) {
    console.error('[/api/booking GET] Error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─── POST: Create a booking ───────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as BookingRequestBody;
    const { slotStart, name, email, notes } = body;

    if (!slotStart || !name || !email) {
      return NextResponse.json(
        { error: 'slotStart, name, and email are required' },
        { status: 400 }
      );
    }

    const username = process.env.CAL_COM_USERNAME ?? 'anupama-nair';
    const eventTypeSlug = process.env.CAL_COM_EVENT_TYPE_SLUG ?? 'scalar-interview';

    const bookingPayload = {
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
      ...(notes ? { responses: { notes } } : {}),
    };

    const res = await fetch('https://api.cal.com/v2/bookings', {
      method: 'POST',
      headers: getCalHeaders('2024-08-13'),
      body: JSON.stringify(bookingPayload),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('[/api/booking POST] Cal.com error:', res.status, errorText);
      return NextResponse.json(
        { error: `Booking failed: ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();

    return NextResponse.json({
      success: true,
      booking: {
        uid: (data as { data?: { uid?: string } }).data?.uid,
        start: slotStart,
        name,
        email,
      },
    });
  } catch (err) {
    console.error('[/api/booking POST] Error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
