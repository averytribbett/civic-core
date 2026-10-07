# Civic Core embeddable widget

## Deploy (Firebase Hosting)

Use a **dedicated Firebase project** for the widget (separate from the marketing site). That project’s **default** Hosting site serves `widget.js` and `app/*`.

1. [Firebase CLI](https://firebase.google.com/docs/cli): `firebase login`
2. Create a Firebase project (or pick an existing one used only for the widget).
3. From `widget/`: `cp .firebaserc.example .firebaserc` and set `YOUR_FIREBASE_PROJECT_ID` to that project’s id.
4. **Custom domain** (optional): Firebase Console → **Build → Hosting** → connect domain; add the DNS records your registrar shows.
5. Deploy: `yarn deploy:hosting` (runs `prepare-hosting`, `verify:hosting`, then `firebase deploy --only hosting`).

After deploy, the shell is at:

`https://<PROJECT_ID>.web.app/app/widget.html`

(or `https://<your-custom-domain>/app/widget.html` if you added one).

### Not using Firebase?

Run `yarn prepare-hosting`, then upload everything under `hosting/public/` to any HTTPS static host. For Google Cloud Storage bucket hosting, see [`scripts/deploy-gcs.example.sh`](scripts/deploy-gcs.example.sh). Do not set `X-Frame-Options` / CSP in a way that blocks embedding `widget.html` on client sites.

---

## Embed snippet

The embed only needs **`source`** and **`apiBaseUrl`**. Logo, display name, and theme color are loaded from the backend (`GET /widget/branding`) using the jurisdiction row in Postgres.

```html
<script>
  window.CivicCoreWidget = {
    source: "chisago_county_mn",
    apiBaseUrl: "https://YOUR_CLOUD_RUN_SERVICE.run.app",
    widgetUrl: "https://YOUR_WIDGET_HOST/app/widget.html",
    align: "right",
  };
</script>
<script async src="https://YOUR_WIDGET_HOST/widget.js"></script>
```

### Config fields

| Field | Required | Purpose |
|-------|----------|---------|
| `source` | Yes | Jurisdiction slug; sent on `POST /chat` and used to fetch branding |
| `apiBaseUrl` | Yes | Backend base URL (Cloud Run in prod, `http://localhost:4000` locally) |
| `widgetUrl` | Recommended | HTTPS URL of `app/widget.html` on your widget host. If omitted, the launcher resolves it from the script origin |
| `align` | No | Launcher position: `"left"` or `"right"` (default `"right"`) |

**Branding is not configured in the embed.** Set `logoPath` and `themeColor` in `secrets/jurisdictions.json`, then `yarn jurisdiction:sync` — see [`backend/README.md`](../backend/README.md#jurisdiction-logos-and-theme).

### Branding failure behavior

If `/widget/branding` is unavailable or a logo fails to load:

- Theme falls back to **`#2563eb`**
- Header logo is hidden
- Chat still works

Branding is cached in `sessionStorage` per source for the browser tab.

---

## Local development

1. Start the backend with `ENABLE_DEV_ROUTES=true` and `WIDGET_ALLOWED_ORIGINS` including your static server origin (e.g. `http://127.0.0.1:5500`).
2. Add logo files under `backend/secrets/logos/` and set `logoPath` / `themeColor` in `secrets/jurisdictions.json`, then `yarn jurisdiction:sync`.
3. Serve the `widget/` folder (e.g. Live Server) and open [`demo.html`](demo.html).

```html
<script>
  window.CivicCoreWidget = {
    source: "chisago_county_mn",
    widgetUrl: "app/widget.html",
    apiBaseUrl: "http://localhost:4000",
  };
</script>
<script src="cdn/widget.js"></script>
```

### Switching jurisdictions in `demo.html`

With the API running, click **Dev: jurisdiction** to pick a row from `GET /dev/jurisdictions`. Selection is stored in `localStorage` and restored on reload. Full onboarding: [root README](../README.md#add-a-jurisdiction-locally).

---

## Production layout (single origin)

Self-hosting uses one origin: launcher at **`/widget.js`**, shell at **`/app/widget.html`**, plus **`/app/*`** assets. Set `widgetUrl` to the same host’s `widget.html` URL.

If launcher and shell are on **split** domains, set `widgetUrl` to the **app** host’s `widget.html` URL; keep `script src` on the CDN/launcher host.

---

## Backend requirements

Set **`WIDGET_ALLOWED_ORIGINS`** on the API (comma-separated origins where `widget.html` is served). That is the iframe **`Origin`** for `fetch`, not the parent marketing site. See [`backend/cloud-run.env.yaml.example`](../backend/cloud-run.env.yaml.example).

Express uses permissive **`cors()`**; **`WIDGET_ALLOWED_ORIGINS`** enforces the allowlist for `POST /chat`, vote routes, and **`GET /widget/branding`**.

---

## Accessibility (WCAG 2.1 AA)

- Default theme `#2563eb` meets WCAG AA for white text on the launcher and send button.
- County theme colors come from `themeColor` in `jurisdictions.json` (synced via `yarn jurisdiction:sync`); choose sufficient contrast against white text.
- Test both the launcher (`cdn/widget.js`) and chat shell (`app/widget.html`).
- Arabic (`ar`) sets `dir="rtl"` on the chat shell.

### Automated check

```bash
cd widget
yarn install
yarn puppeteer browsers install chrome   # one-time
yarn test:a11y
```

Runs axe-core against `demo.html` and the chat shell. Branded logo/theme in the demo requires the backend running with uploaded logos; otherwise the default blue theme is tested.

### Manual test checklist

- [ ] **Keyboard only:** Tab to launcher → Enter to open → send a message → language list → Escape closes chat
- [ ] **Screen reader:** Launcher Open/Close; new messages announced; vote buttons report state
- [ ] **200% zoom:** Layout usable on desktop and mobile
- [ ] **Reduced motion:** Tooltip static text; minimal animations
- [ ] **Arabic:** Switch to العربية; RTL layout
- [ ] **County branding:** Confirm logo and theme from `/widget/branding` on launcher and send button
