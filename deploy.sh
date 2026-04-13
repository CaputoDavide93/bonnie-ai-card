#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# deploy.sh — Build + ship card to HA + bump resource + restart HA
# ─────────────────────────────────────────────────────────────
# Required env vars (set in .env.local or export in your shell):
#   HA_SSH       SSH target of your HA instance, e.g. root@192.168.10.250
#   HA_URL       HA base URL, e.g. http://192.168.10.250:8123
#   HA_TOKEN     HA long-lived access token (needed for restart)
# Optional:
#   CARD_PATH    Path inside HA to upload to (default: /config/www/bonnie-ai-card.js)
#
# HA's `reload_all` service does NOT re-read .storage/lovelace_resources,
# so a restart is the reliable way to pick up a bumped resource URL.
# ─────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Load .env.local if present (user-specific, gitignored)
if [ -f "$SCRIPT_DIR/.env.local" ]; then
  set -a; . "$SCRIPT_DIR/.env.local"; set +a
fi

: "${HA_SSH:?HA_SSH not set. See deploy.sh header for required env vars.}"
: "${HA_URL:?HA_URL not set. Example: http://192.168.10.250:8123}"
CARD_PATH="${CARD_PATH:-/config/www/bonnie-ai-card.js}"

echo "→ Building card..."
cd "$SCRIPT_DIR"
npm run build > /dev/null
SIZE=$(wc -c < dist/bonnie-ai-card.js)
echo "  ✓ dist/bonnie-ai-card.js ($SIZE bytes)"

echo "→ Uploading to $HA_SSH:$CARD_PATH..."
scp -q dist/bonnie-ai-card.js "$HA_SSH:$CARD_PATH"
echo "  ✓ Uploaded"

echo "→ Bumping resource URL in lovelace_resources..."
REMOTE_URL="/local/$(basename "$CARD_PATH")"
ssh "$HA_SSH" "python3 - << PY
import json, time, uuid
p = '/config/.storage/lovelace_resources'
d = json.load(open(p))
found = False
for i in d['data']['items']:
    if 'bonnie-ai-card' in i.get('url',''):
        i['url'] = '$REMOTE_URL?v=' + str(int(time.time()))
        found = True
if not found:
    d['data']['items'].append({'id': uuid.uuid4().hex[:22], 'url': '$REMOTE_URL?v=' + str(int(time.time())), 'type': 'module'})
json.dump(d, open(p,'w'), indent=2)
PY"
echo "  ✓ URL bumped"

if [ -n "${HA_TOKEN:-}" ]; then
  echo "→ Restarting HA core (required to re-read resources)..."
  curl -s -X POST -H "Authorization: Bearer $HA_TOKEN" \
    "$HA_URL/api/services/homeassistant/restart" > /dev/null
  echo "  ✓ Restart triggered — wait ~30s before reloading browser"
else
  echo "  ⚠ No HA_TOKEN — restart manually via Developer Tools → YAML → Restart"
fi

echo ""
echo "✓ Done. Hard-refresh your HA dashboard in ~30 seconds."
