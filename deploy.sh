#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# deploy.sh — Build card + ship to HA + bump resource + restart HA
# ─────────────────────────────────────────────────────────────
# Without the HA restart, the bumped resource URL sits in .storage but HA's
# in-memory list keeps serving the previous URL. reload_all doesn't re-read
# lovelace_resources. The only reliable refresh is a core restart.
# ─────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HA_HOST="root@192.168.10.250"
HA_API="http://192.168.10.250:8123"

# Fetch HA token from Bonnie's .env on FigaroServer
HA_TOKEN=$(ssh -o BatchMode=yes davide.caputo@192.168.10.100 \
  "grep ^HA_API_TOKEN ~/Portainer/ClaudeHA/.env | cut -d= -f2" 2>/dev/null || true)

echo "→ Building card..."
cd "$SCRIPT_DIR"
npm run build > /dev/null
SIZE=$(wc -c < dist/bonnie-ai-card.js)
echo "  ✓ dist/bonnie-ai-card.js ($SIZE bytes)"

echo "→ Uploading to HA..."
scp -q dist/bonnie-ai-card.js "$HA_HOST:/config/www/bonnie-ai-card.js"
echo "  ✓ Uploaded"

echo "→ Bumping resource URL in lovelace_resources..."
ssh "$HA_HOST" "python3 - << 'PY'
import json, time
p = '/config/.storage/lovelace_resources'
d = json.load(open(p))
added = False
for i in d['data']['items']:
    if 'bonnie-ai-card' in i.get('url',''):
        i['url'] = '/local/bonnie-ai-card.js?v=' + str(int(time.time()))
        added = True
if not added:
    import uuid
    d['data']['items'].append({
        'id': uuid.uuid4().hex[:22],
        'url': '/local/bonnie-ai-card.js?v=' + str(int(time.time())),
        'type': 'module',
    })
json.dump(d, open(p,'w'), indent=2)
PY"
echo "  ✓ URL bumped"

echo "→ Restarting HA core (required to re-read resources)..."
if [ -n "$HA_TOKEN" ]; then
  curl -s -X POST -H "Authorization: Bearer $HA_TOKEN" \
    "$HA_API/api/services/homeassistant/restart" > /dev/null
  echo "  ✓ Restart triggered — wait ~30s before reloading browser"
else
  echo "  ⚠ No HA token — restart via Developer Tools → Reload → Restart"
fi

echo ""
echo "✓ Done. Hard-refresh the TouchKio Bonnie tab in ~30 seconds."
