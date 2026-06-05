// ─── Cal.com Utility Types & Functions ───────────────────────────

export interface Slot {
  /** ISO 8601 datetime string e.g. "2026-06-10T14:00:00.000Z" */
  startIso: string;
  /** Human-readable label e.g. "Mon Jun 10, 2:00 PM" */
  label: string;
}

export interface BookingConfirmation {
  uid?: string;
  start: string;
  name: string;
  email: string;
}

export interface GetSlotsResponse {
  slots: Slot[];
  error?: string;
}

export interface CreateBookingResponse {
  success: boolean;
  booking?: BookingConfirmation;
  error?: string;
}

// ─── Format a slot ISO string into a readable label ───────────────
export function formatSlotLabel(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata',
    });
  } catch {
    return isoString;
  }
}

// ─── Fetch available slots from /api/booking ──────────────────────
export async function getAvailableSlots(): Promise<GetSlotsResponse> {
  try {
    const res = await fetch('/api/booking', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });

    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      return { slots: [], error: data.error ?? `API error ${res.status}` };
    }

    const data = (await res.json()) as { slots?: string[]; error?: string };

    if (data.error) {
      return { slots: [], error: data.error };
    }

    const slots: Slot[] = (data.slots ?? []).map((iso: string) => ({
      startIso: iso,
      label: formatSlotLabel(iso),
    }));

    return { slots };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch slots';
    return { slots: [], error: message };
  }
}

// ─── Create a booking via /api/booking ───────────────────────────
export async function createBooking(
  slot: Slot,
  name: string,
  email: string,
  notes?: string
): Promise<CreateBookingResponse> {
  try {
    const res = await fetch('/api/booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slotStart: slot.startIso,
        name,
        email,
        notes,
      }),
    });

    const data = (await res.json()) as {
      success?: boolean;
      booking?: BookingConfirmation;
      error?: string;
    };

    if (!res.ok || !data.success) {
      return { success: false, error: data.error ?? `Booking failed (${res.status})` };
    }

    return { success: true, booking: data.booking };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create booking';
    return { success: false, error: message };
  }
}
