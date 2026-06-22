"""
Srivani Stores — Order List Auto-Sync
======================================
Run this script on your Windows PC. It checks the ERP every 30 seconds for
new print-ready order lists and saves them to D:\\shop\\LIST\\new\\...

Usage:
    python srivani-sync.py

Requirements:
    pip install requests

Setup:
    1. Set ERP_URL and ERP_TOKEN below (or as environment variables)
    2. Run: python srivani-sync.py
    3. To run on startup: create a shortcut in Windows Startup folder
"""

import os
import time
import requests
import pathlib
import sys
from datetime import datetime

# ── Config (edit these) ──────────────────────────────────────────────────────

ERP_URL   = os.getenv('ERP_URL',   'http://localhost:4001')   # or https://erp.srivani.com
ERP_TOKEN = os.getenv('ERP_TOKEN', '')                         # paste your JWT token here
SAVE_DIR  = os.getenv('LISTS_DIR', r'D:\shop\LIST\new')
INTERVAL  = 30  # seconds between checks

# ─────────────────────────────────────────────────────────────────────────────

def log(msg: str):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")

def get_pending():
    try:
        r = requests.get(
            f'{ERP_URL}/lists/pending-downloads',
            headers={'Authorization': f'Bearer {ERP_TOKEN}'},
            timeout=10,
        )
        r.raise_for_status()
        return r.json()
    except Exception as e:
        log(f'Check failed: {e}')
        return []

def download_doc(list_id: str, sender_name: str, sender_phone: str, received_at: str):
    try:
        r = requests.get(
            f'{ERP_URL}/lists/{list_id}/download',
            headers={'Authorization': f'Bearer {ERP_TOKEN}'},
            timeout=30,
            stream=True,
        )
        r.raise_for_status()

        # Build folder: SAVE_DIR/YYYY/Month YYYY/YYYYMMDD/
        dt = datetime.fromisoformat(received_at.replace('Z', '+00:00'))
        month_name = dt.strftime('%B')  # June
        year       = dt.strftime('%Y')  # 2026
        date_str   = dt.strftime('%Y%m%d')  # 20260618

        folder = pathlib.Path(SAVE_DIR) / year / f'{month_name} {year}' / date_str
        folder.mkdir(parents=True, exist_ok=True)

        # Filename from Content-Disposition header or fallback
        cd  = r.headers.get('Content-Disposition', '')
        if 'filename=' in cd:
            import urllib.parse
            filename = urllib.parse.unquote(cd.split('filename=')[1].strip('"'))
        else:
            phone    = sender_phone.replace('91', '', 1) if sender_phone.startswith('91') else sender_phone
            filename = f'{sender_name}  {phone}.docx'

        filepath = folder / filename
        with open(filepath, 'wb') as f:
            for chunk in r.iter_content(chunk_size=8192):
                f.write(chunk)

        log(f'Saved: {filepath}')
        return True

    except Exception as e:
        log(f'Download failed for {list_id}: {e}')
        return False

def main():
    if not ERP_TOKEN:
        print('ERROR: Set ERP_TOKEN environment variable or edit this script.')
        print('  Windows: set ERP_TOKEN=your-jwt-token')
        print('  Then run: python srivani-sync.py')
        sys.exit(1)

    log(f'Srivani Sync started — checking every {INTERVAL}s')
    log(f'Saving to: {SAVE_DIR}')

    while True:
        pending = get_pending()
        if pending:
            log(f'{len(pending)} new list(s) to download')
            for item in pending:
                download_doc(
                    item['id'],
                    item.get('senderName') or item['senderPhone'],
                    item['senderPhone'],
                    item['receivedAt'],
                )
        time.sleep(INTERVAL)

if __name__ == '__main__':
    main()
