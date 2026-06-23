"""
book_meeting.py
---------------
FastAPI app that handles Vapi function-call webhooks.

Supports two functions:
  - get_available_slots : fetches next 5 open slots from Cal.com for the
                          'scalar-interview' event type.
  - book_meeting        : creates a Cal.com booking with the caller's details.

Run with:
    uvicorn book_meeting:app --host 0.0.0.0 --port 8001

Environment variables (loaded from ../../.env.local):
    CAL_COM_API_KEY    — Cal.com v2 API key
    CAL_COM_USERNAME   — Cal.com username (slug used in event URLs)
"""

import os
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse

# ---------------------------------------------------------------------------
# Environment
# ---------------------------------------------------------------------------
ENV_PATH = Path(__file__).resolve().parent.parent.parent / ".env.local"
if not ENV_PATH.exists():
    ENV_PATH = Path(__file__).resolve().parent.parent.parent / ".env"
load_dotenv(dotenv_path=ENV_PATH)


CAL_API_KEY = os.getenv("CAL_COM_API_KEY", "")
CAL_USERNAME = os.getenv("CAL_COM_USERNAME", "")
CAL_BASE = "https://api.cal.com/v2"
EVENT_SLUG = os.getenv("CAL_COM_EVENT_TYPE_SLUG", "scalar-interview")


CAL_HEADERS = {
    "Authorization": f"Bearer {CAL_API_KEY}",
    "Content-Type": "application/json",
    "cal-api-version": "2024-08-13",
}

# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------
app = FastAPI(title="Vapi Function Handler", version="1.0.0")


# ---------------------------------------------------------------------------
# Cal.com helpers
# ---------------------------------------------------------------------------

def _get_event_type_id() -> int | None:
    """Resolve the numeric event-type ID for EVENT_SLUG."""
    url = f"{CAL_BASE}/event-types"
    resp = requests.get(url, headers=CAL_HEADERS)
    if not resp.ok:
        return None
    data = resp.json()
    event_types = data.get("data", {}).get("eventTypeGroups", [])
    for group in event_types:
        for et in group.get("eventTypes", []):
            if et.get("slug") == EVENT_SLUG:
                return et["id"]
    # Fallback: flat list format
    flat = data.get("data", [])
    if isinstance(flat, list):
        for et in flat:
            if et.get("slug") == EVENT_SLUG:
                return et["id"]
    return None


def get_available_slots() -> str:
    """Return a human-readable list of the next 5 available slots."""
    event_type_id = _get_event_type_id()
    if not event_type_id:
        return f"Sorry, I couldn't find the '{EVENT_SLUG}' event type on the calendar."

    now = datetime.now(timezone.utc)
    start_time = now.strftime("%Y-%m-%dT%H:%M:%SZ")
    end_time = (now + timedelta(days=7)).strftime("%Y-%m-%dT%H:%M:%SZ")

    url = f"{CAL_BASE}/slots/available"
    params = {
        "eventTypeId": event_type_id,
        "startTime": start_time,
        "endTime": end_time,
    }
    resp = requests.get(url, headers=CAL_HEADERS, params=params)
    if not resp.ok:
        return f"Sorry, I couldn't fetch available slots right now (HTTP {resp.status_code})."

    data = resp.json()
    slots_by_date: dict[str, list[str]] = data.get("data", {}).get("slots", {})

    all_slots: list[str] = []
    for _date, slot_list in slots_by_date.items():
        for slot in slot_list:
            start = slot.get("time", "")
            if start:
                all_slots.append(start)
        if len(all_slots) >= 5:
            break

    all_slots = all_slots[:5]
    if not all_slots:
        return "There are no available slots in the next 7 days. Please try again later."

    lines = ["Here are the next available slots (all times UTC):"]
    for i, iso_str in enumerate(all_slots, 1):
        try:
            dt = datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
            formatted = dt.strftime("%A, %B %-d at %-I:%M %p UTC")
        except Exception:
            formatted = iso_str
        lines.append(f"  {i}. {formatted}  (start: {iso_str})")

    lines.append("Which slot would you like to book?")
    return "\n".join(lines)


def book_meeting(slot_start: str, caller_name: str, caller_email: str) -> str:
    """Create a Cal.com booking and return a confirmation message."""
    event_type_id = _get_event_type_id()
    if not event_type_id:
        return f"Sorry, I couldn't find the '{EVENT_SLUG}' event type to complete the booking."

    # Split caller_name into first / last (best-effort)
    parts = caller_name.strip().split(" ", 1)
    first_name = parts[0]
    last_name = parts[1] if len(parts) > 1 else ""

    payload: dict[str, Any] = {
        "eventTypeId": event_type_id,
        "start": slot_start,
        "attendee": {
            "name": caller_name,
            "email": caller_email,
            "timeZone": "UTC",
        },
        "metadata": {
            "source": "vapi-voice-agent",
        },
    }

    url = f"{CAL_BASE}/bookings"
    resp = requests.post(url, headers=CAL_HEADERS, json=payload)

    if not resp.ok:
        try:
            err = resp.json()
            msg = err.get("message") or err.get("error") or resp.text
        except Exception:
            msg = resp.text
        return f"Sorry, I couldn't complete the booking: {msg}"

    data = resp.json().get("data", {})
    booking_uid = data.get("uid", "N/A")

    try:
        dt = datetime.fromisoformat(slot_start.replace("Z", "+00:00"))
        formatted_time = dt.strftime("%A, %B %-d at %-I:%M %p UTC")
    except Exception:
        formatted_time = slot_start

    return (
        f"Great news! I've booked a meeting for {caller_name} on {formatted_time}. "
        f"A confirmation will be sent to {caller_email}. "
        f"Booking reference: {booking_uid}."
    )


# ---------------------------------------------------------------------------
# Webhook endpoint
# ---------------------------------------------------------------------------

@app.post("/vapi/webhook")
async def vapi_webhook(request: Request) -> JSONResponse:
    """
    Handle incoming Vapi webhook payloads.

    Expected payload shape:
    {
      "message": {
        "type": "function-call",
        "functionCall": {
          "name": "get_available_slots" | "book_meeting",
          "parameters": { ... }
        }
      }
    }
    """
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    message = body.get("message", {})
    msg_type = message.get("type", "")

    if msg_type != "function-call":
        # Acknowledge non-function-call messages silently
        return JSONResponse(content={"result": "ok"})

    function_call = message.get("functionCall", {})
    func_name = function_call.get("name", "")
    params: dict[str, Any] = function_call.get("parameters", {})

    if func_name == "get_available_slots":
        result_text = get_available_slots()

    elif func_name == "book_meeting":
        slot_start = params.get("slot_start", "")
        caller_name = params.get("caller_name", "")
        caller_email = params.get("caller_email", "")

        missing = [f for f, v in [("slot_start", slot_start), ("caller_name", caller_name), ("caller_email", caller_email)] if not v]
        if missing:
            result_text = f"Missing required parameters: {', '.join(missing)}. Please provide them and try again."
        else:
            result_text = book_meeting(slot_start, caller_name, caller_email)

    else:
        result_text = f"Unknown function '{func_name}'. I can only help with scheduling."

    # Vapi expects {"result": "<string>"}
    return JSONResponse(content={"result": result_text})


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/health")
async def health() -> JSONResponse:
    return JSONResponse(content={"status": "ok", "service": "vapi-function-handler"})


# ---------------------------------------------------------------------------
# Dev entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("book_meeting:app", host="0.0.0.0", port=8001, reload=True)
