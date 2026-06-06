'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { getAvailableSlots, createBooking } from '@/lib/calcom';
import type { Slot, BookingConfirmation } from '@/lib/calcom';

// ─── Types ────────────────────────────────────────────────────────
type WidgetState = 'loading' | 'date' | 'time' | 'form' | 'submitting' | 'success' | 'error';

// ─── Group slots by date ──────────────────────────────────────────
function groupByDate(slots: Slot[]): Record<string, Slot[]> {
  const groups: Record<string, Slot[]> = {};
  for (const slot of slots) {
    const date = new Date(slot.startIso).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', timeZone: 'Asia/Kolkata',
    });
    if (!groups[date]) groups[date] = [];
    groups[date].push(slot);
  }
  return groups;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata',
  });
}

// ─── Component ────────────────────────────────────────────────────
export default function BookingWidget() {
  const [state, setState] = useState<WidgetState>('loading');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [confirmation, setConfirmation] = useState<BookingConfirmation | null>(null);

  const fetchSlots = useCallback(async () => {
    setState('loading');
    setErrorMsg('');
    const result = await getAvailableSlots();
    if (result.error) {
      setErrorMsg(result.error);
      setState('error');
    } else if (result.slots.length === 0) {
      setErrorMsg('No slots available in the next 14 days. Please try again later.');
      setState('error');
    } else {
      setSlots(result.slots);
      setState('date');
    }
  }, []);

  useEffect(() => { fetchSlots(); }, [fetchSlots]);

  const grouped = groupByDate(slots);
  const dateKeys = Object.keys(grouped);
  const timeSlotsForDate = selectedDate ? grouped[selectedDate] ?? [] : [];

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    setSelectedSlot(null);
    setState('time');
  };

  const handleTimeSelect = (slot: Slot) => {
    setSelectedSlot(slot);
    setState('form');
  };

  const handleBackToDate = () => {
    setSelectedSlot(null);
    setState('date');
  };

  const handleBackToTime = () => {
    setSelectedSlot(null);
    setState('time');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot || !name.trim() || !email.trim()) return;
    setState('submitting');
    const result = await createBooking(selectedSlot, name.trim(), email.trim());
    if (result.error) {
      setErrorMsg(result.error);
      setState('error');
    } else {
      setConfirmation(result.booking ?? null);
      setState('success');
    }
  };

  // ─── Render ────────────────────────────────────────────────────
  return (
    <div className="booking-widget" role="region" aria-label="Schedule a meeting">

      {/* Loading */}
      {state === 'loading' && (
        <>
          <div className="booking-title"><div className="booking-title-icon">📅</div>Schedule a Call</div>
          <div className="booking-subtitle">Finding available slots…</div>
          <div className="booking-skeleton">
            <div className="skeleton-row"><div className="skeleton-block" /><div className="skeleton-block" /><div className="skeleton-block" /></div>
            <div className="skeleton-row"><div className="skeleton-block" /><div className="skeleton-block" /></div>
          </div>
        </>
      )}

      {/* Step 1: Pick a Date */}
      {state === 'date' && (
        <>
          <div className="booking-title"><div className="booking-title-icon">📅</div>Schedule a Call with Anupama</div>
          <div className="booking-subtitle">Step 1 of 3 — Pick a date that works for you</div>
          <div className="date-grid" role="list">
            {dateKeys.map((date) => (
              <button
                key={date}
                className={`date-btn${selectedDate === date ? ' selected' : ''}`}
                onClick={() => handleDateSelect(date)}
                role="listitem"
                type="button"
              >
                <span className="date-btn-day">{date.split(',')[0]}</span>
                <span className="date-btn-date">{date.split(',').slice(1).join(',').trim()}</span>
                <span className="date-btn-count">{grouped[date].length} slot{grouped[date].length !== 1 ? 's' : ''}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Step 2: Pick a Time */}
      {state === 'time' && selectedDate && (
        <>
          <div className="booking-title"><div className="booking-title-icon">🕐</div>{selectedDate}</div>
          <div className="booking-subtitle">Step 2 of 3 — Pick a time slot</div>
          <div className="slots-grid" role="list">
            {timeSlotsForDate.map((slot) => (
              <button
                key={slot.startIso}
                className="slot-btn"
                onClick={() => handleTimeSelect(slot)}
                role="listitem"
                type="button"
              >
                {formatTime(slot.startIso)}
              </button>
            ))}
          </div>
          <button className="btn-back" type="button" onClick={handleBackToDate} style={{ marginTop: 10 }}>← Back to dates</button>
        </>
      )}

      {/* Step 3: Confirm Booking */}
      {(state === 'form' || state === 'submitting') && selectedSlot && (
        <>
          <div className="booking-title"><div className="booking-title-icon">✏️</div>Confirm Your Booking</div>
          <div className="booking-subtitle">Step 3 of 3 — Enter your details</div>
          <form className="booking-form" onSubmit={handleSubmit} noValidate>
            <div className="booking-selected-slot">
              <span>📅</span>
              <span>{selectedSlot.label}</span>
            </div>
            <input
              className="booking-input"
              type="text"
              placeholder="Your full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
              disabled={state === 'submitting'}
            />
            <input
              className="booking-input"
              type="email"
              placeholder="Your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              disabled={state === 'submitting'}
            />
            <div className="booking-btn-row">
              <button type="button" className="btn-back" onClick={handleBackToTime} disabled={state === 'submitting'}>← Back</button>
              <button type="submit" className="btn-confirm" disabled={state === 'submitting' || !name.trim() || !email.trim()}>
                {state === 'submitting' ? 'Booking…' : 'Confirm Booking'}
              </button>
            </div>
          </form>
        </>
      )}

      {/* Success */}
      {state === 'success' && (
        <div className="booking-success fade-in">
          <div className="success-icon" aria-hidden="true">✓</div>
          <div className="success-title">Meeting Confirmed!</div>
          <div className="success-detail">
            {confirmation?.name ? `Hey ${confirmation.name}, your call with Anupama is booked.` : 'Your call with Anupama is confirmed.'}
            <br />A confirmation has been sent to{' '}
            <strong style={{ color: 'var(--accent-violet-2)' }}>{confirmation?.email ?? email}</strong>
          </div>
          {confirmation?.start && (
            <div className="success-slot-badge">
              📅{' '}
              {new Date(confirmation.start).toLocaleString('en-US', {
                weekday: 'short', month: 'short', day: 'numeric',
                hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata',
              })}
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {state === 'error' && (
        <div className="booking-error">
          <div className="booking-title" style={{ justifyContent: 'center', marginBottom: 0 }}>
            <div className="booking-title-icon">📅</div>Schedule a Call
          </div>
          <div className="error-text">{errorMsg || 'Something went wrong. Please try again.'}</div>
          <button className="btn-retry" onClick={fetchSlots} type="button">↺ Try Again</button>
        </div>
      )}
    </div>
  );
}
