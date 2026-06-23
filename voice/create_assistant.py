"""
create_assistant.py
-------------------
Creates (or updates) a Vapi assistant and optionally buys a US phone number,
then saves the results to assistant_info.json.

Usage:
    python create_assistant.py           # create new assistant + buy number
    python create_assistant.py --update  # PATCH existing assistant (reads ID from assistant_info.json)
"""

import argparse
import json
import os
import sys
from pathlib import Path

import requests
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Load environment
# ---------------------------------------------------------------------------
ENV_PATH = Path(__file__).resolve().parent.parent / ".env.local"
if not ENV_PATH.exists():
    ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=ENV_PATH)


VAPI_API_KEY = os.getenv("VAPI_API_KEY")
VOICE_FUNCTIONS_URL = os.getenv("VOICE_FUNCTIONS_URL", "")

if not VAPI_API_KEY:
    print("ERROR: VAPI_API_KEY is not set. Check your .env.local file.")
    sys.exit(1)

if not VOICE_FUNCTIONS_URL:
    print("WARNING: VOICE_FUNCTIONS_URL is not set. The webhook URL will be empty.")

VAPI_BASE = "https://api.vapi.ai"
HEADERS = {
    "Authorization": f"Bearer {VAPI_API_KEY}",
    "Content-Type": "application/json",
}

CONFIG_PATH = Path(__file__).resolve().parent / "vapi_config.json"
INFO_PATH = Path(__file__).resolve().parent / "assistant_info.json"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def load_config() -> dict:
    """Load vapi_config.json and substitute env vars."""
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        raw = f.read()

    # Substitute ${VOICE_FUNCTIONS_URL} placeholder
    raw = raw.replace("${VOICE_FUNCTIONS_URL}", VOICE_FUNCTIONS_URL)
    config_dict = json.loads(raw)
    
    # If no functions URL was provided, remove the serverUrl so Vapi doesn't crash on validation
    if not VOICE_FUNCTIONS_URL and "serverUrl" in config_dict:
        del config_dict["serverUrl"]
        
    return config_dict


def load_info() -> dict:
    """Load assistant_info.json if it exists."""
    if INFO_PATH.exists():
        with open(INFO_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_info(data: dict) -> None:
    """Persist assistant_info.json."""
    with open(INFO_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    print(f"Saved assistant info → {INFO_PATH}")


def handle_response(resp: requests.Response, action: str) -> dict:
    """Raise a helpful error on non-2xx responses."""
    if not resp.ok:
        print(f"ERROR during {action}: HTTP {resp.status_code}")
        try:
            print(json.dumps(resp.json(), indent=2))
        except Exception:
            print(resp.text)
        sys.exit(1)
    return resp.json()


# ---------------------------------------------------------------------------
# Core actions
# ---------------------------------------------------------------------------

def create_assistant(config: dict) -> dict:
    """POST /assistant — create a new Vapi assistant."""
    print("Creating Vapi assistant …")
    resp = requests.post(f"{VAPI_BASE}/assistant", headers=HEADERS, json=config)
    data = handle_response(resp, "create assistant")
    assistant_id = data.get("id")
    print(f"✓ Assistant created. ID: {assistant_id}")
    return data


def update_assistant(assistant_id: str, config: dict) -> dict:
    """PATCH /assistant/:id — update an existing Vapi assistant."""
    print(f"Updating Vapi assistant {assistant_id} …")
    resp = requests.patch(
        f"{VAPI_BASE}/assistant/{assistant_id}", headers=HEADERS, json=config
    )
    data = handle_response(resp, "update assistant")
    print(f"✓ Assistant updated. ID: {data.get('id')}")
    return data


def buy_phone_number(assistant_id: str) -> dict:
    """POST /phone-number — purchase a US number and attach it to the assistant."""
    print("Purchasing US phone number …")
    payload = {
        "provider": "vapi",  # 'twilio' with areaCode is deprecated
        "assistantId": assistant_id,
    }
    resp = requests.post(f"{VAPI_BASE}/phone-number", headers=HEADERS, json=payload)
    if not resp.ok:
        print("\n⚠️  Vapi API changed how phone numbers are purchased.")
        print("To get your phone number, please do the following:")
        print("1. Go to https://dashboard.vapi.ai/phone-numbers")
        print("2. Click 'Buy Number'")
        print("3. Attach it to your new assistant ('Anupama Nair — AI Representative')")
        return {}
    
    data = resp.json()
    number = data.get("number") or data.get("phoneNumber") or "(unknown)"
    print(f"✓ Phone number purchased: {number}")
    return data


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="Manage Vapi assistant for Anupama Nair's AI persona.")
    parser.add_argument(
        "--update",
        action="store_true",
        help="PATCH the existing assistant instead of creating a new one.",
    )
    args = parser.parse_args()

    config = load_config()
    info = load_info()

    if args.update:
        # ---- UPDATE mode ------------------------------------------------
        assistant_id = info.get("assistant_id")
        if not assistant_id:
            print("ERROR: No assistant_id found in assistant_info.json. Run without --update first.")
            sys.exit(1)

        assistant_data = update_assistant(assistant_id, config)
        info["assistant_id"] = assistant_data.get("id", assistant_id)
        info["assistant_name"] = assistant_data.get("name", "")
        save_info(info)

    else:
        # ---- CREATE mode ------------------------------------------------
        assistant_data = create_assistant(config)
        assistant_id = assistant_data["id"]

        phone_data = buy_phone_number(assistant_id)
        phone_number = phone_data.get("number") or phone_data.get("phoneNumber", "")

        result = {
            "assistant_id": assistant_id,
            "assistant_name": assistant_data.get("name", ""),
            "phone_number_id": phone_data.get("id", ""),
            "phone_number": phone_number,
        }
        save_info(result)

        print("\n=== Summary ===")
        print(f"  Assistant ID  : {assistant_id}")
        print(f"  Phone Number  : {phone_number}")
        print(f"  Webhook URL   : {VOICE_FUNCTIONS_URL}/api/vapi/webhook")


if __name__ == "__main__":
    main()
