'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { getAvailableSlots, createBooking } from '@/lib/calcom';
import type { Slot, BookingConfirmation } from '@/lib/calcom';

// ─── Types ────────────────────────────────────────────────────────
type WidgetState = 'loading' | 'slots' | 'form' | 'submitting' | 'success' | 'error';

// ─── Component ────────────────────────────────────────────────────
export default function BookingWidget() {
  const [state, setState] = useState<WidgetState>('loading');
  const [slots, setSlots] = useState<Slot[]>([]);
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
      setErrorMsg('No slots available in the next 7 days. Please try again later.');
      setState('error');
    } else {
      setSlots(result.slots);
      setState('slots');
    }
  }, []);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  const handleSlotSelect = (slot: Slot) => {
    setSelectedSlot(slot);
    setState('form');
  };

  const handleBack = () => {
    setSelectedSlot(null);
    setState('slots');
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

  // ─── Render States ─────────────────────────────────────────────
  return (
    <div className="booking-widget" role="region" aria-label="Schedule a meeting">
      {/* Loading */}
      {state === 'loading' && (
        <>
          <div className="booking-title">
            <div className="booking-title-icon">📅</div>
            Schedule a Call
          </div>
          <div className="booking-subtitle">Finding available slots…</div>
          <div className="booking-skeleton">
            <div className="skeleton-row">
              <div className="skeleton-block" />
              <div className="skeleton-block" />
              <div className="skeleton-block" />
            </div>
            <div className="skeleton-row">
              <div className="skeleton-block" />
              <div className="skeleton-block" />
            </div>
          </div>
        </>
      )}

      {/* Slots grid */}
      {state === 'slots' && (
        <>
          <div className="booking-title">
            <div className="booking-title-icon">📅</div>
            Schedule a Call with Anupama
          </div>
          <div className="booking-subtitle">
            Pick a time that works for you — 30-minute intro call
          </div>
          <div className="slots-grid" role="list">
            {slots.map((slot) => (
              <button
                key={slot.startIso}
                className={`slot-btn${selectedSlot?.startIso === slot.startIso ? ' selected' : ''}`}
                onClick={() => handleSlotSelect(slot)}
                role="listitem"
                type="button"
              >
                {slot.label}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Booking form */}
      {(state === 'form' || state === 'submitting') && selectedSlot && (
        <>
          <div className="booking-title">
            <div className="booking-title-icon">✏️</div>
            Confirm Your Booking
          </div>
          <div className="booking-subtitle">Fill in your details to confirm the slot</div>
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
              <button
                type="button"
                className="btn-back"
                onClick={handleBack}
                disabled={state === 'submitting'}
              >
                ← Back
              </button>
              <button
                type="submit"
                className="btn-confirm"
                disabled={
                  state === 'submitting' || !name.trim() || !email.trim()
                }
              >
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
            {confirmation?.name
              ? `Hey ${confirmation.name}, your call with Anupama is booked.`
              : 'Your call with Anupama is confirmed.'}
            <br />
            A confirmation has been sent to{' '}
            <strong style={{ color: 'var(--accent-violet-2)' }}>
              {confirmation?.email ?? email}
            </strong>
          </div>
          {confirmation?.start && (
            <div className="success-slot-badge">
              📅{' '}
              {new Date(confirmation.start).toLocaleString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
                timeZone: 'Asia/Kolkata',
              })}
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {state === 'error' && (
        <div className="booking-error">
          <div className="booking-title" style={{ justifyContent: 'center', marginBottom: 0 }}>
            <div className="booking-title-icon">📅</div>
            Schedule a Call
          </div>
          <div className="error-text">{errorMsg || 'Something went wrong. Please try again.'}</div>
          <button className="btn-retry" onClick={fetchSlots} type="button">
            ↺ Try Again
          </button>
        </div>
      )}
    </div>
  );
}
