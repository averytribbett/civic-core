# Civic Core embeddable widget

## Deploy (Firebase Hosting)

Use a **dedicated Firebase project** for the widget (separate from the marketing site). That project’s **default** Hosting site serves `widget.js` and `app/*`; nothing special is required in `firebase.json`.

1. [Firebase CLI](https://firebase.google.com/docs/cli): `firebase login`
2. Create a Firebase project (or pick an existing one used only for the widget).
3. From `widget/`: `cp .firebaserc.example .firebaserc` and set `YOUR_FIREBASE_PROJECT_ID` to that project’s id.
4. **Custom domain** (optional, e.g. `app.civiccore.ai`): Firebase Console → **Build → Hosting** → connect domain; add the DNS records your registrar shows (same idea as any static site).
5. Deploy: `npm run deploy:hosting` (runs `prepare-hosting`, `verify:hosting`, then `firebase deploy --only hosting`).

After deploy, the shell is at:

`https://<PROJECT_ID>.web.app/app/widget.html`

(or `https://<your-custom-domain>/app/widget.html` if you added one).

### Not using Firebase?

You can still ship the same files: run `npm run prepare-hosting`, then upload everything under `hosting/public/` to any HTTPS static host. For Google Cloud Storage + bucket hosting, see [`scripts/deploy-gcs.example.sh`](scripts/deploy-gcs.example.sh). Do not set `X-Frame-Options` / CSP in a way that blocks embedding `widget.html` on client sites.

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

`Jurisdiction.origins` in Postgres is **not** used for chat auth anymore (you can leave the column for other use or clear it).

### Terms link

[`app/widget.html`](app/widget.html) links to `/terms` on the widget host. Host a small terms page there or change the link later to a full URL.

### Accessibility (WCAG 2.1 AA)

The widget targets ADA-friendly behavior. Default theme `#2563eb` meets WCAG AA for white text on the launcher. Custom `theme.color` should maintain contrast (e.g. WebAIM contrast checker).
