# Civic Core embeddable widget

## Deploy (Firebase Hosting)

Use a **dedicated Firebase project** for the widget (separate from the marketing site). That project’s **default** Hosting site serves `widget.js` and `app/*`; nothing special is required in `firebase.json`.

1. [Firebase CLI](https://firebase.google.com/docs/cli): `firebase login`
2. Create a Firebase project (or pick an existing one used only for the widget).
3. From `widget/`: `cp .firebaserc.example .firebaserc` and set `YOUR_FIREBASE_PROJECT_ID` to that project’s id.
4. **Custom domain** (optional, e.g. `app.civiccore.ai`): Firebase Console → **Build → Hosting** → connect domain; add the DNS records your registrar shows (same idea as any static site).
5. Deploy: `yarn deploy:hosting` (runs `prepare-hosting`, `verify:hosting`, then `firebase deploy --only hosting`).

After deploy, the shell is at:

`https://<PROJECT_ID>.web.app/app/widget.html`

(or `https://<your-custom-domain>/app/widget.html` if you added one).

### Not using Firebase?

You can still ship the same files: run `yarn prepare-hosting`, then upload everything under `hosting/public/` to any HTTPS static host. For Google Cloud Storage + bucket hosting, see [`scripts/deploy-gcs.example.sh`](scripts/deploy-gcs.example.sh). Do not set `X-Frame-Options` / CSP in a way that blocks embedding `widget.html` on client sites.

## Local development

Point `widgetUrl` at the shell on the same origin as your static server (e.g. Live Server), and set `apiBaseUrl` to your API.

```html
<script>
  window.CivicCoreWidget = {
    widgetUrl: "app/widget.html",
    apiBaseUrl: "http://localhost:4000",
    source: "chisago_county_mn",
    theme: { color: "#2563eb" },
  };
</script>
<script src="cdn/widget.js"></script>
```

See [`demo.html`](demo.html) for a fuller example (`name`, `logo`, etc.).

### Switching jurisdictions in `demo.html`

With the API running and **`ENABLE_DEV_ROUTES=true`** in `backend/.env`, open `demo.html` and use **Dev: jurisdiction** to pick any row from `GET /dev/jurisdictions`. The choice is stored in `localStorage` (`civiccore.dev.jurisdiction`) and restored on reload. Full onboarding steps: [root README](../README.md#add-a-jurisdiction-locally).

### Config fields

- **apiBaseUrl**: Base URL of the backend (e.g. `https://your-api-xxxxx.run.app`). Required unless the widget shell is same-origin as the API.
- **source**: Sent as `source` on `POST /chat`. Must match a `jurisdiction.source` value in your database.
- **widgetUrl** (recommended for production): Full HTTPS URL of `widget.html` (see below). If omitted, the launcher defaults to `https://app.civiccore.com/widget.html` ([`cdn/widget.js`](cdn/widget.js)).
- **name**, **logo**, **theme**, **align**: Optional branding and launcher position (`left` | `right`).

## Production layout (single origin)

Self-hosting uses one origin: launcher at **`/widget.js`**, shell at **`/app/widget.html`**, plus **`/app/*`** assets. Embed snippets load `widget.js` from that origin and set `widgetUrl` to the same host’s `widget.html` URL.

## Client embed snippet (production)

Replace placeholders with your deployed widget origin, Cloud Run API URL, and jurisdiction `source`.

```html
<script>
  window.CivicCoreWidget = {
    widgetUrl: "https://YOUR_WIDGET_HOST/app/widget.html",
    apiBaseUrl: "https://YOUR_CLOUD_RUN_SERVICE.run.app",
    source: "your_jurisdiction_source",
    name: "County name",
    logo: "https://example.gov/logo.png",
    theme: { color: "#2563eb" },
  };
</script>
<script async src="https://YOUR_WIDGET_HOST/widget.js"></script>
```

If you use **split** domains (launcher on `cdn.example.com`, shell on `app.example.com`), set `widgetUrl` to the **app** host’s `widget.html` URL; `script src` stays on the CDN host.

## Backend: chat origin (required)

Set **`WIDGET_ALLOWED_ORIGINS`** on the API (comma-separated origins where `widget.html` is served). That is the browser **`Origin`** for `fetch` from inside the iframe, not the parent marketing site. See [`backend/cloud-run.env.yaml.example`](../backend/cloud-run.env.yaml.example) and [`backend/README.md`](../backend/README.md).

Express uses permissive **`cors()`** (no origin allowlist at the middleware layer); **`requireOrigin`** enforces the widget list for `POST /chat` and vote routes.

### Terms link

[`app/widget.html`](app/widget.html) links to `/terms` on the widget host. Host a small terms page there or change the link later to a full URL.

### Accessibility (WCAG 2.1 AA)

The widget targets ADA-friendly behavior aligned with **WCAG 2.1 Level AA**.

- Default theme `#2563eb` meets WCAG AA for white text on the launcher and send button.
- Counties can set `theme.color` to match their branding; choose a color with sufficient contrast against white text on the launcher and send button.
- The embed has two layers: the CDN launcher (`cdn/widget.js`) and the chat shell (`app/widget.html`). Test both when validating accessibility.
- Arabic (`ar`) sets `dir="rtl"` on the chat shell.

#### Automated check

```bash
cd widget
yarn install
# one-time if Chrome for Testing is missing:
yarn puppeteer browsers install chrome
yarn test:a11y
```

Runs axe-core against `demo.html`, the open chat iframe, and the standalone shell. Requires Puppeteer’s Chrome for Testing binary (downloaded into `~/.cache/puppeteer`).

#### Manual test checklist

- [ ] **Keyboard only:** Tab to launcher → Enter to open → type and send a message → open language list (arrows/Home/End) → Escape to close dropdown → Escape to close chat
- [ ] **Screen reader:** Launcher announces Open/Close correctly; new messages announced in chat log; loading state announced; vote buttons report pressed state
- [ ] **200% zoom:** Layout remains usable on desktop and mobile widths
- [ ] **Reduced motion:** Enable OS “reduce motion”; tooltip shows static text; message/iframe animations minimized
- [ ] **Arabic:** Switch language to العربية; layout mirrors (RTL)
- [ ] **Custom theme:** Confirm county brand color renders correctly on launcher and send button
