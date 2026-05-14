#!/usr/bin/env python3
"""
One-shot OAuth flow to capture a refresh token for the Sheets API,
reusing the existing wet-ink-analytics Internal OAuth client.

Run this once. It opens a browser, asks you to sign in as
andrew@hollyrandallagency.com, and prints the refresh token. Copy the
output into Vercel env vars and you're done — the refresh token doesn't
expire (Internal-type OAuth clients in a Workspace org don't get the
7-day TTL that External-Testing clients have).

Usage:
    pip3 install --user google-auth-oauthlib
    python3 scripts/get-oauth-refresh-token.py

If google-auth-oauthlib refuses to install in /usr/lib/python (newer
macOS), use a venv:
    python3 -m venv /tmp/oauth-venv
    /tmp/oauth-venv/bin/pip install google-auth-oauthlib
    /tmp/oauth-venv/bin/python scripts/get-oauth-refresh-token.py
"""

import json
import sys
from pathlib import Path

try:
    from google_auth_oauthlib.flow import InstalledAppFlow
except ImportError:
    sys.exit(
        "google-auth-oauthlib is not installed.\n"
        "Run: pip3 install --user google-auth-oauthlib\n"
        "(or use a venv if pip refuses — see the docstring at the top of this file)"
    )

CLIENT_SECRETS = Path.home() / "Downloads" / "client_secret_933088981155-jq1hl02mqhdpeesl9ns4aug4rffps4g5.apps.googleusercontent.com.json"
SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]


def main() -> None:
    if not CLIENT_SECRETS.exists():
        sys.exit(f"client_secret JSON not found at {CLIENT_SECRETS}\n"
                 f"Update the CLIENT_SECRETS path in this script.")

    flow = InstalledAppFlow.from_client_secrets_file(str(CLIENT_SECRETS), SCOPES)
    creds = flow.run_local_server(
        port=0,
        prompt="consent",
        access_type="offline",
        authorization_prompt_message="A browser window has opened — sign in as andrew@hollyrandallagency.com.",
    )

    print("\n=============== VERCEL ENV VARS ===============")
    print(f"GOOGLE_OAUTH_CLIENT_ID={creds.client_id}")
    print(f"GOOGLE_OAUTH_CLIENT_SECRET={creds.client_secret}")
    print(f"GOOGLE_OAUTH_REFRESH_TOKEN={creds.refresh_token}")
    print("================================================\n")
    print("Paste the above into chat (or set them directly in Vercel project settings).")
    print(f"Token has scopes: {creds.scopes}")


if __name__ == "__main__":
    main()
