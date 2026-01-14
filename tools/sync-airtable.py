#!/usr/bin/env python3
"""
Sync bounty tracker CSV to Airtable.

Usage: python3 tools/sync-airtable.py

Requires AIRTABLE_PAT in .env or environment.
Works locally and in GitHub Actions.
"""

import csv
import json
import os
import requests
from pathlib import Path

# Determine repo root (works in CI and locally)
SCRIPT_DIR = Path(__file__).parent.resolve()
REPO_ROOT = SCRIPT_DIR.parent

# Load token from .env if not in environment (local dev)
if not os.environ.get('AIRTABLE_PAT'):
    env_path = REPO_ROOT / '.env'
    if env_path.exists():
        with open(env_path) as f:
            for line in f:
                if line.startswith('AIRTABLE_PAT='):
                    os.environ['AIRTABLE_PAT'] = line.split('=', 1)[1].strip()

# Config
BASE_ID = "appmYMfPcb9lQ7MrF"
TABLE_ID = "tblmEZqioueV9Pd9h"
TOKEN = os.environ.get('AIRTABLE_PAT')
CSV_PATH = REPO_ROOT / '000-docs/002-PM-BKLG-bounty-tracker.csv'

if not TOKEN:
    print("Error: AIRTABLE_PAT not found in .env or environment")
    exit(1)

headers = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json"
}

def get_existing_records():
    """Fetch all existing records from Airtable."""
    url = f"https://api.airtable.com/v0/{BASE_ID}/{TABLE_ID}"
    records = []
    offset = None

    while True:
        params = {}
        if offset:
            params['offset'] = offset

        response = requests.get(url, headers=headers, params=params)
        data = response.json()
        records.extend(data.get('records', []))

        offset = data.get('offset')
        if not offset:
            break

    return records

def csv_to_record(row):
    """Convert CSV row to Airtable record fields."""
    fields = {
        "Repo": row['repo'],
        "Task": row['task'],
        "Bounty": row['bounty'],
        "Notes": row['notes'],
    }

    if row['issue']:
        fields["Issue"] = int(row['issue'])
    if row['pr_number']:
        fields["PR"] = int(row['pr_number'])
    if row['lines']:
        fields["Lines"] = int(row['lines'])

    status_map = {'Available': 'Available', 'In Progress': 'In Progress',
                  'Submitted': 'Submitted', 'Draft': 'Draft',
                  'MERGED': 'MERGED', 'CLOSED': 'CLOSED'}
    if row['status'] in status_map:
        fields["Status"] = status_map[row['status']]

    if row['competition'] in ['NONE', 'LOW', 'MEDIUM', 'HIGH']:
        fields["Competition"] = row['competition']

    if row['date_started']:
        fields["Started"] = row['date_started']
    if row['date_completed']:
        fields["Completed"] = row['date_completed']

    return fields

def record_key(fields):
    """Create unique key for a record (repo + task)."""
    return f"{fields.get('Repo', '')}|{fields.get('Task', '')}"

def sync():
    """Sync CSV to Airtable."""
    print("Fetching existing Airtable records...")
    existing = get_existing_records()
    existing_map = {record_key(r['fields']): r for r in existing}
    print(f"Found {len(existing)} existing records")

    print(f"Reading CSV from {CSV_PATH}...")
    csv_records = []
    with open(CSV_PATH, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            csv_records.append(csv_to_record(row))
    print(f"Found {len(csv_records)} CSV records")

    # Determine updates and creates
    to_create = []
    to_update = []

    for fields in csv_records:
        key = record_key(fields)
        if key in existing_map:
            record = existing_map[key]
            # Check if needs update
            if fields != {k: v for k, v in record['fields'].items() if k in fields}:
                to_update.append({"id": record['id'], "fields": fields})
        else:
            to_create.append({"fields": fields})

    url = f"https://api.airtable.com/v0/{BASE_ID}/{TABLE_ID}"

    # Create new records
    if to_create:
        print(f"Creating {len(to_create)} new records...")
        for i in range(0, len(to_create), 10):
            batch = to_create[i:i+10]
            response = requests.post(url, headers=headers, json={"records": batch})
            if response.status_code != 200:
                print(f"Error creating: {response.text}")

    # Update existing records
    if to_update:
        print(f"Updating {len(to_update)} records...")
        for i in range(0, len(to_update), 10):
            batch = to_update[i:i+10]
            response = requests.patch(url, headers=headers, json={"records": batch})
            if response.status_code != 200:
                print(f"Error updating: {response.text}")

    print(f"\n✓ Sync complete: {len(to_create)} created, {len(to_update)} updated")

if __name__ == '__main__':
    sync()
