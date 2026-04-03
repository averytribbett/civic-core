```
<script>
  window.CivicCoreWidget = {
    apiBaseUrl: "http://localhost:4000",  // backend URL for chat API
    source: "chisago_county_mn",          // backend source type (required by /chat)
    theme: {
      color: "#2563eb"
    }
  };
</script>
<script async src="https://cdn.civiccore.com/widget.js"></script>
```

- **apiBaseUrl**: Base URL of the backend (e.g. `http://localhost:4000`). Required for the widget to send messages to the chat API. Omit or use `""` if the widget is served from the same origin as the backend.
- **source**: Value sent as `source` in POST `/chat` requests. Must match a backend `SourceType` (e.g. `chisago_county_mn`).

### Accessibility (WCAG 2.1 AA)

The widget is designed for ADA compliance. The default theme color (`#2563eb`) meets WCAG AA contrast requirements for white text. If using a custom `theme.color`, ensure it provides at least 4.5:1 contrast for text on colored backgrounds (e.g. user message bubbles). Run a contrast checker (e.g. WebAIM, axe DevTools) when customizing themes.
