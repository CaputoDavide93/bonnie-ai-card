# Bonnie AI Card

A native Home Assistant Lovelace card for chatting with a [Bonnie AI Chat](https://github.com/davide-caputo/BonnieAssistant) backend (Claude Code / FastAPI). Replaces the iframe approach with a proper custom element that uses HA's CSS variables and fonts, avoiding all mixed-content and cross-origin issues.

## Screenshots

![Bonnie AI Card — Desktop](docs/screenshot-wide.png)
![Bonnie AI Card — Mobile](docs/screenshot-narrow.png)

## Installation

<details>
<summary><b>HACS (recommended)</b></summary>

1. Make sure [HACS](https://hacs.xyz) is installed.
2. Go to **HACS → Frontend → + Explore & Download Repositories**.
3. Search for **Bonnie AI Card** and install it.
4. Reload the browser.
5. Add the card to your dashboard (see Configuration below).

</details>

<details>
<summary><b>Manual install</b></summary>

1. Download `bonnie-ai-card.js` from the [latest release](../../releases/latest).
2. Copy it to `/config/www/bonnie-ai-card.js` on your Home Assistant instance.
3. Go to **Settings → Dashboards → Resources** and add:
   - URL: `/local/bonnie-ai-card.js`
   - Resource type: `JavaScript module`
4. Reload the browser.

</details>

## Configuration

Add the card to any Lovelace dashboard in YAML mode:

```yaml
type: custom:bonnie-ai-card
backend_url: http://<your-bonnie-host>:7788
kiosk_token: "your-kiosk-token-here"
title: "Bonnie"
height: 600
```

### Configuration options

| Option | Type | Required | Default | Description |
|---|---|---|---|---|
| `backend_url` | `string` | Yes | — | URL of your Bonnie AI Chat backend, no trailing slash |
| `kiosk_token` | `string` | Yes | — | Kiosk token for the `/api/auth/kiosk-exchange` endpoint |
| `title` | `string` | No | `"Bonnie AI Chat"` | Card header title |
| `height` | `number \| string` | No | `auto` | Card height in px (number) or any CSS length (string) |
| `model` | `string` | No | — | Model name passed through to the chat API |

## Backend requirement

This card requires a running **Bonnie AI Chat** backend — a FastAPI server that wraps the Claude API and exposes the chat/session/stream endpoints. See the [BonnieAssistant project](https://github.com/davide-caputo/BonnieAssistant) for setup instructions.

The backend must have the kiosk-exchange auth endpoint enabled and a kiosk token configured.

## Development

```bash
# Clone the repo
git clone https://github.com/davide-caputo/bonnie-ai-card.git
cd bonnie-ai-card

# Install dependencies
npm install

# Build once
npm run build

# Watch mode (rebuilds on change)
npm run watch
```

The built file is output to `dist/bonnie-ai-card.js`. Copy this to your HA `/config/www/` for local testing.

## License

[MIT](LICENSE) — Davide Caputo
