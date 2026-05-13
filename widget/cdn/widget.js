(function () {
  if (window.__CIVICCORE__) return;
  window.__CIVICCORE__ = true;

  const launcherScriptEl = document.currentScript;
  const launcherOrigin =
    launcherScriptEl && launcherScriptEl.src
      ? new URL(launcherScriptEl.src, document.baseURI || undefined).origin
      : "";

  const userCfg = window.CivicCoreWidget || {};
  if (!userCfg.source) return;

  const DEFAULT_API_BASE = "https://civic-core-api-672197054224.us-central1.run.app";
  const config = { apiBaseUrl: DEFAULT_API_BASE, ...userCfg };

  function startWidget() {
  const align = (config.align === "left" ? "left" : "right");
  const supportedLangs = ["en","es","fr","de","zh","ja","pt","ar","ko"];
  const browserLang = (navigator.language || "en").split("-")[0];
  const lang = supportedLangs.includes(browserLang) ? browserLang : "en";

  // Inline translations for the CDN-hosted elements (button, tooltip)
  var cdnLocales = {
    en: { openChat: "Open chat", closeTooltip: "Close", tooltipPrompt: "Need assistance? ", tooltipAsk: "Ask about ", tooltipDots: "...", tooltipWords: ["permits", "meetings", "services", "events"] },
    es: { openChat: "Abrir chat", closeTooltip: "Cerrar", tooltipPrompt: "¿Necesitas ayuda? ", tooltipAsk: "Pregunta sobre ", tooltipDots: "...", tooltipWords: ["permisos", "reuniones", "servicios", "eventos"] },
    fr: { openChat: "Ouvrir le chat", closeTooltip: "Fermer", tooltipPrompt: "Besoin d'aide ? ", tooltipAsk: "Renseignez-vous sur ", tooltipDots: "...", tooltipWords: ["permis", "réunions", "services", "événements"] },
    de: { openChat: "Chat öffnen", closeTooltip: "Schließen", tooltipPrompt: "Brauchen Sie Hilfe? ", tooltipAsk: "Fragen Sie nach ", tooltipDots: "...", tooltipWords: ["Genehmigungen", "Sitzungen", "Diensten", "Veranstaltungen"] },
    zh: { openChat: "打开聊天", closeTooltip: "关闭", tooltipPrompt: "需要帮助？", tooltipAsk: "了解关于", tooltipDots: "...", tooltipWords: ["许可证", "会议", "服务", "活动"] },
    ja: { openChat: "チャットを開く", closeTooltip: "閉じる", tooltipPrompt: "お困りですか？", tooltipAsk: "", tooltipDots: "...", tooltipWords: ["許可証", "会議", "サービス", "イベント"] },
    pt: { openChat: "Abrir chat", closeTooltip: "Fechar", tooltipPrompt: "Precisa de ajuda? ", tooltipAsk: "Pergunte sobre ", tooltipDots: "...", tooltipWords: ["licenças", "reuniões", "serviços", "eventos"] },
    ar: { openChat: "فتح الدردشة", closeTooltip: "إغلاق", tooltipPrompt: "هل تحتاج مساعدة؟ ", tooltipAsk: "اسأل عن ", tooltipDots: "...", tooltipWords: ["التصاريح", "الاجتماعات", "الخدمات", "الفعاليات"] },
    ko: { openChat: "채팅 열기", closeTooltip: "닫기", tooltipPrompt: "도움이 필요하신가요? ", tooltipAsk: "", tooltipDots: "...", tooltipWords: ["허가", "회의", "서비스", "행사"] },
  };
  var loc = cdnLocales[lang] || cdnLocales.en;

  // Focus-visible styles for launcher and tooltip (ADA)
  const style = document.createElement("style");
  style.textContent = ".civiccore-widget-btn:focus-visible,.civiccore-tooltip-close:focus-visible{outline:2px solid #fff;outline-offset:2px}";
  document.head.appendChild(style);

  // Chat button with SVG icon (chat bubble)
  const button = document.createElement("button");
  button.className = "civiccore-widget-btn";
  const chatIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="28" height="28" aria-hidden="true"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/></svg>`;
  const closeIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="28" height="28" aria-hidden="true"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`;
  button.innerHTML = chatIconSvg;
  button.setAttribute("aria-label", loc.openChat);
  button.setAttribute("aria-expanded", "false");

  Object.assign(button.style, {
    position: "fixed",
    bottom: "20px",
    ...(align === "left" ? { left: "20px" } : { right: "20px" }),
    width: "56px",
    height: "56px",
    borderRadius: "50%",
    border: "none",
    background: config.theme?.color || "#2563eb",
    color: "#fff",
    fontSize: "24px",
    cursor: "pointer",
    boxShadow: "0 8px 24px rgba(0,0,0,.2)",
    zIndex: 2147483647,
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  });

  // Floating tooltip with typewriter animation — removed after first open
  let tooltipDismissed = false;
  const tooltip = document.createElement("div");
  tooltip.setAttribute("role", "tooltip");
  const themeColor = config.theme?.color || "#2563eb";
  Object.assign(tooltip.style, {
    position: "fixed",
    bottom: "86px",
    ...(align === "left" ? { left: "20px" } : { right: "20px" }),
    padding: "10px 14px",
    background: themeColor,
    color: "#fff",
    fontSize: "14px",
    lineHeight: "1.4",
    borderRadius: "8px",
    boxShadow: "0 4px 12px rgba(0,0,0,.2)",
    zIndex: 2147483647,
    maxWidth: "260px",
    minHeight: "20px",
    opacity: "0",
    transform: "translateY(6px)",
    transition: "opacity 0.2s ease, transform 0.2s ease",
    display: "flex",
    alignItems: "flex-start",
    gap: "8px"
  });
  const tooltipText = document.createElement("span");
  tooltipText.style.flex = "1";
  tooltip.appendChild(tooltipText);
  const tooltipClose = document.createElement("button");
  tooltipClose.className = "civiccore-tooltip-close";
  tooltipClose.setAttribute("type", "button");
  tooltipClose.setAttribute("aria-label", loc.closeTooltip);
  tooltipClose.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16" aria-hidden="true"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`;
  Object.assign(tooltipClose.style, {
    position: "absolute",
    top: "-6px",
    right: "-6px",
    padding: "2px",
    border: "none",
    background: themeColor,
    color: "#fff",
    cursor: "pointer",
    borderRadius: "50%",
    boxShadow: "0 2px 6px rgba(0,0,0,.2)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0
  });
  tooltipClose.addEventListener("mouseenter", () => { tooltipClose.style.filter = "brightness(1.1)"; });
  tooltipClose.addEventListener("mouseleave", () => { tooltipClose.style.filter = ""; });
  tooltip.appendChild(tooltipClose);
  document.body.appendChild(tooltip);

  const TOOLTIP_PROMPT = loc.tooltipPrompt;
  const TOOLTIP_ASK = loc.tooltipAsk;
  const TOOLTIP_DOTS = loc.tooltipDots;
  const TOOLTIP_WORDS = loc.tooltipWords;
  const TYPING_MS_PER_CHAR = 55;
  const HOLD_MS_AFTER_TYPING = 1000;
  const DELETING_MS_PER_CHAR = 35;
  const PAUSE_BETWEEN_MS = 400;
  let tooltipTimeoutId = null;

  function dismissTooltip() {
    if (tooltipDismissed) return;
    tooltipDismissed = true;
    if (tooltipTimeoutId !== null) {
      clearTimeout(tooltipTimeoutId);
      tooltipTimeoutId = null;
    }
    tooltip.style.opacity = "0";
    tooltip.style.transform = "translateY(6px)";
    setTimeout(() => tooltip.remove(), 220);
  }

  tooltipClose.onclick = (e) => {
    e.stopPropagation();
    dismissTooltip();
  };

  function runTooltipTypewriter() {
    if (tooltipDismissed || TOOLTIP_WORDS.length === 0) return;
    let wordIndex = 0;
    let phase = "holding";
    let cursor = 0;

    function scheduleNext(ms, fn) {
      tooltipTimeoutId = setTimeout(fn, ms);
    }

    function getFullLine() {
      return TOOLTIP_PROMPT + TOOLTIP_ASK + TOOLTIP_WORDS[wordIndex] + TOOLTIP_DOTS;
    }

    function tick() {
      if (tooltipDismissed) return;

      if (phase === "holding") {
        tooltipText.textContent = getFullLine();
        phase = "deleting_dots";
        cursor = TOOLTIP_DOTS.length;
        scheduleNext(HOLD_MS_AFTER_TYPING, tick);
        return;
      }

      if (phase === "deleting_dots") {
        cursor -= 1;
        tooltipText.textContent = TOOLTIP_PROMPT + TOOLTIP_ASK + TOOLTIP_WORDS[wordIndex] + TOOLTIP_DOTS.slice(0, cursor);
        if (cursor <= 0) {
          phase = "deleting_word";
          cursor = TOOLTIP_WORDS[wordIndex].length;
          tick();
        } else {
          scheduleNext(DELETING_MS_PER_CHAR, tick);
        }
        return;
      }

      if (phase === "deleting_word") {
        cursor -= 1;
        tooltipText.textContent = TOOLTIP_PROMPT + TOOLTIP_ASK + TOOLTIP_WORDS[wordIndex].slice(0, cursor);
        if (cursor <= 0) {
          wordIndex = (wordIndex + 1) % TOOLTIP_WORDS.length;
          phase = "typing_word";
          cursor = 0;
          scheduleNext(PAUSE_BETWEEN_MS, tick);
        } else {
          scheduleNext(DELETING_MS_PER_CHAR, tick);
        }
        return;
      }

      if (phase === "typing_word") {
        cursor += 1;
        const word = TOOLTIP_WORDS[wordIndex];
        tooltipText.textContent = TOOLTIP_PROMPT + TOOLTIP_ASK + word.slice(0, cursor);
        if (cursor >= word.length) {
          phase = "typing_dots";
          cursor = 0;
          tick();
        } else {
          scheduleNext(TYPING_MS_PER_CHAR, tick);
        }
        return;
      }

      if (phase === "typing_dots") {
        cursor += 1;
        tooltipText.textContent = TOOLTIP_PROMPT + TOOLTIP_ASK + TOOLTIP_WORDS[wordIndex] + TOOLTIP_DOTS.slice(0, cursor);
        if (cursor >= TOOLTIP_DOTS.length) {
          phase = "holding";
          scheduleNext(HOLD_MS_AFTER_TYPING, tick);
        } else {
          scheduleNext(TYPING_MS_PER_CHAR, tick);
        }
      }
    }

    tooltipText.textContent = TOOLTIP_PROMPT + TOOLTIP_ASK + TOOLTIP_WORDS[0] + TOOLTIP_DOTS;
    phase = "holding";
    scheduleNext(HOLD_MS_AFTER_TYPING, tick);
  }

  requestAnimationFrame(() => {
    if (!tooltipDismissed) {
      tooltip.style.opacity = "1";
      tooltip.style.transform = "translateY(0)";
      runTooltipTypewriter();
    }
  });

  // Chat iframe: absolute https base (e.g. https://PROJECT.web.app/) → /app/widget.html on that host
  function resolveChatShellUrl(raw) {
    const fallback = "https://app.civiccore.ai/app/widget.html";
    if (!raw || !String(raw).trim()) return fallback;
    const u = String(raw).trim();
    if (!/^https?:\/\//i.test(u)) return u;
    try {
      const parsed = new URL(u);
      const lastSeg = parsed.pathname.split("/").filter(Boolean).pop() || "";
      if (/\.html?$/i.test(lastSeg)) return u;
      return new URL("app/widget.html", parsed.origin + "/").toString();
    } catch (_) {
      return u;
    }
  }

  const iframe = document.createElement("iframe");
  const shellFromLauncher =
    launcherOrigin && new URL("app/widget.html", launcherOrigin + "/").toString();
  const shellRaw = (config.widgetUrl && String(config.widgetUrl).trim()) || shellFromLauncher || "";
  iframe.src = shellRaw ? resolveChatShellUrl(shellRaw) : "https://app.civiccore.ai/app/widget.html";
  iframe.setAttribute("title", loc.openChat);

  const iframeTransition = "opacity 0.22s ease-out, transform 0.22s ease-out";
  // Responsive: on mobile use most of the viewport so the chat isn't tiny
  Object.assign(iframe.style, {
    position: "fixed",
    bottom: "90px",
    left: "16px",
    right: "16px",
    width: "520px",
    maxWidth: "calc(100vw - 32px)",
    height: "min(500px, 85vh)",
    ...(align === "left" ? { marginRight: "auto" } : { marginLeft: "auto" }),
    border: "none",
    borderRadius: "12px",
    boxShadow: "0 12px 32px rgba(0,0,0,.25)",
    display: "none",
    opacity: "0",
    transform: "scale(0.92) translateY(8px)",
    transition: iframeTransition,
    zIndex: 2147483647,
    background: "white"
  });

  document.body.appendChild(button);
  document.body.appendChild(iframe);

  let open = false;

  function focusChatInput() {
    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      const input = doc?.getElementById("input");
      if (input) input.focus();
    } catch (_) {}
  }

  function openChat() {
    open = true;
    button.setAttribute("aria-expanded", "true");
    dismissTooltip();
    button.innerHTML = closeIconSvg;
    iframe.style.display = "block";
    iframe.style.opacity = "0";
    iframe.style.transform = "scale(0.92) translateY(8px)";
    iframe.offsetHeight; // force reflow so transition runs
    iframe.style.opacity = "1";
    iframe.style.transform = "scale(1) translateY(0)";
    if (iframe.contentDocument?.getElementById("input")) {
      focusChatInput();
    } else {
      iframe.addEventListener("load", focusChatInput, { once: true });
    }
  }

  function closeChat() {
    open = false;
    button.setAttribute("aria-expanded", "false");
    button.innerHTML = chatIconSvg;
    iframe.style.opacity = "0";
    iframe.style.transform = "scale(0.92) translateY(8px)";
    button.focus();
  }

  function onChatClosed() {
    iframe.style.display = "none";
  }

  iframe.addEventListener("transitionend", (e) => {
    if (e.target === iframe && e.propertyName === "opacity" && !open) {
      onChatClosed();
    }
  });

  function toggle() {
    if (open) {
      closeChat();
    } else {
      openChat();
    }
  }

  button.onclick = toggle;

  window.addEventListener("message", (e) => {
    if (e.data.type === "CLOSE_WIDGET") {
      if (open) {
        closeChat();
      } else {
        onChatClosed();
      }
    }
  });

  iframe.onload = () => {
    iframe.contentWindow.postMessage(
      { type: "INIT", config },
      "*"
    );
  };
  }

  function runWhenBodyReady() {
    if (document.body) {
      startWidget();
      return;
    }
    requestAnimationFrame(runWhenBodyReady);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", runWhenBodyReady);
  } else {
    runWhenBodyReady();
  }
})();
