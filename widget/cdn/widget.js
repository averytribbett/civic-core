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
    en: { openChat: "Open chat", closeChat: "Close chat", chatWidget: "Chat widget", closeTooltip: "Close", tooltipPrompt: "Need assistance? ", tooltipAsk: "Ask about ", tooltipDots: "...", tooltipWords: ["permits", "meetings", "services", "events"] },
    es: { openChat: "Abrir chat", closeChat: "Cerrar chat", chatWidget: "Widget de chat", closeTooltip: "Cerrar", tooltipPrompt: "¿Necesitas ayuda? ", tooltipAsk: "Pregunta sobre ", tooltipDots: "...", tooltipWords: ["permisos", "reuniones", "servicios", "eventos"] },
    fr: { openChat: "Ouvrir le chat", closeChat: "Fermer le chat", chatWidget: "Widget de chat", closeTooltip: "Fermer", tooltipPrompt: "Besoin d'aide ? ", tooltipAsk: "Renseignez-vous sur ", tooltipDots: "...", tooltipWords: ["permis", "réunions", "services", "événements"] },
    de: { openChat: "Chat öffnen", closeChat: "Chat schließen", chatWidget: "Chat-Widget", closeTooltip: "Schließen", tooltipPrompt: "Brauchen Sie Hilfe? ", tooltipAsk: "Fragen Sie nach ", tooltipDots: "...", tooltipWords: ["Genehmigungen", "Sitzungen", "Diensten", "Veranstaltungen"] },
    zh: { openChat: "打开聊天", closeChat: "关闭聊天", chatWidget: "聊天窗口", closeTooltip: "关闭", tooltipPrompt: "需要帮助？", tooltipAsk: "了解关于", tooltipDots: "...", tooltipWords: ["许可证", "会议", "服务", "活动"] },
    ja: { openChat: "チャットを開く", closeChat: "チャットを閉じる", chatWidget: "チャットウィジェット", closeTooltip: "閉じる", tooltipPrompt: "お困りですか？", tooltipAsk: "", tooltipDots: "...", tooltipWords: ["許可証", "会議", "サービス", "イベント"] },
    pt: { openChat: "Abrir chat", closeChat: "Fechar chat", chatWidget: "Widget de chat", closeTooltip: "Fechar", tooltipPrompt: "Precisa de ajuda? ", tooltipAsk: "Pergunte sobre ", tooltipDots: "...", tooltipWords: ["licenças", "reuniões", "serviços", "eventos"] },
    ar: { openChat: "فتح الدردشة", closeChat: "إغلاق الدردشة", chatWidget: "أداة الدردشة", closeTooltip: "إغلاق", tooltipPrompt: "هل تحتاج مساعدة؟ ", tooltipAsk: "اسأل عن ", tooltipDots: "...", tooltipWords: ["التصاريح", "الاجتماعات", "الخدمات", "الفعاليات"] },
    ko: { openChat: "채팅 열기", closeChat: "채팅 닫기", chatWidget: "채팅 위젯", closeTooltip: "닫기", tooltipPrompt: "도움이 필요하신가요? ", tooltipAsk: "", tooltipDots: "...", tooltipWords: ["허가", "회의", "서비스", "행사"] },
  };
  var loc = cdnLocales[lang] || cdnLocales.en;

  const themeColor = config.theme?.color || "#2563eb";
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
    background: themeColor,
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
  tooltip.id = "civiccore-widget-tooltip";
  tooltip.setAttribute("role", "tooltip");
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
    transform: prefersReducedMotion ? "none" : "translateY(6px)",
    transition: prefersReducedMotion ? "none" : "opacity 0.2s ease, transform 0.2s ease",
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
    top: "-8px",
    right: "-8px",
    width: "24px",
    height: "24px",
    padding: "4px",
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
  button.setAttribute("aria-describedby", "civiccore-widget-tooltip");

  const TOOLTIP_PROMPT = loc.tooltipPrompt;
  const TOOLTIP_ASK = loc.tooltipAsk;
  const TOOLTIP_DOTS = loc.tooltipDots;
  const TOOLTIP_WORDS = loc.tooltipWords;
  const TOOLTIP_STATIC = TOOLTIP_PROMPT + TOOLTIP_ASK + (TOOLTIP_WORDS[0] || "") + TOOLTIP_DOTS;
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
    button.removeAttribute("aria-describedby");
    tooltip.style.opacity = "0";
    if (!prefersReducedMotion) tooltip.style.transform = "translateY(6px)";
    setTimeout(() => tooltip.remove(), prefersReducedMotion ? 0 : 220);
  }

  button.addEventListener("focus", () => {
    if (!tooltipDismissed) dismissTooltip();
  });

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
      if (!prefersReducedMotion) tooltip.style.transform = "translateY(0)";
      if (prefersReducedMotion) {
        tooltipText.textContent = TOOLTIP_STATIC;
      } else {
        runTooltipTypewriter();
      }
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
  iframe.setAttribute("title", loc.chatWidget || loc.openChat);

  const iframeTransition = prefersReducedMotion
    ? "none"
    : "opacity 0.22s ease-out, transform 0.22s ease-out";
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
  let inertedElements = [];

  function trapFocus() {
    inertedElements = [];
    Array.from(document.body.children).forEach((child) => {
      if (child !== button && child !== iframe && child !== tooltip) {
        child.inert = true;
        inertedElements.push(child);
      }
    });
  }

  function releaseFocusTrap() {
    inertedElements.forEach((el) => {
      el.inert = false;
    });
    inertedElements = [];
  }

  const MOBILE_BREAKPOINT = 768;

  function isMobile() {
    return window.innerWidth <= MOBILE_BREAKPOINT;
  }

  function lockPageScroll() {
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
  }

  function unlockPageScroll() {
    document.documentElement.style.overflow = "";
    document.body.style.overflow = "";
  }

  function applyMobileLayout() {
    const vv = window.visualViewport;
    if (!vv) return;

    iframe.style.top = `${vv.offsetTop}px`;
    iframe.style.left = `${vv.offsetLeft}px`;
    iframe.style.width = `${vv.width}px`;
    iframe.style.height = `${vv.height}px`;
    iframe.style.bottom = "auto";
    iframe.style.right = "auto";
    iframe.style.maxWidth = "none";
    iframe.style.marginLeft = "0";
    iframe.style.marginRight = "0";
    iframe.style.borderRadius = "0";
    iframe.style.boxShadow = "none";
    button.style.visibility = "hidden";
    button.style.pointerEvents = "none";
    lockPageScroll();
  }

  function restoreDesktopLayout() {
    iframe.style.top = "";
    iframe.style.bottom = "90px";
    iframe.style.left = "16px";
    iframe.style.right = "16px";
    iframe.style.width = "520px";
    iframe.style.maxWidth = "calc(100vw - 32px)";
    iframe.style.height = "min(500px, 85vh)";
    iframe.style.marginLeft = align === "left" ? "" : "auto";
    iframe.style.marginRight = align === "left" ? "auto" : "";
    iframe.style.borderRadius = "12px";
    iframe.style.boxShadow = "0 12px 32px rgba(0,0,0,.25)";
    button.style.visibility = "";
    button.style.pointerEvents = "";
    unlockPageScroll();
  }

  function notifyIframeLayout() {
    try {
      iframe.contentWindow?.postMessage(
        { type: "LAYOUT", mobile: isMobile() },
        "*"
      );
    } catch (_) {}
  }

  function updateMobileLayout() {
    notifyIframeLayout();
    if (!open) return;
    if (isMobile()) {
      applyMobileLayout();
    } else {
      restoreDesktopLayout();
    }
  }

  function bindMobileViewportListeners() {
    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener("resize", updateMobileLayout);
      vv.addEventListener("scroll", updateMobileLayout);
    }
    window.addEventListener("resize", updateMobileLayout);
    window.addEventListener("orientationchange", () => {
      setTimeout(updateMobileLayout, 100);
    });
  }

  bindMobileViewportListeners();

  function focusChatInput() {
    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      const input = doc?.getElementById("input");
      if (input) input.focus();
    } catch (_) {}
  }

  function scheduleFocusChatInput() {
    if (iframe.contentDocument?.getElementById("input")) {
      focusChatInput();
    } else {
      iframe.addEventListener("load", focusChatInput, { once: true });
    }
    if (isMobile()) {
      setTimeout(focusChatInput, 150);
      setTimeout(focusChatInput, 350);
    }
  }

  function openChat() {
    open = true;
    button.setAttribute("aria-expanded", "true");
    button.setAttribute("aria-label", loc.closeChat);
    dismissTooltip();
    button.innerHTML = closeIconSvg;
    iframe.style.display = "block";
    trapFocus();
    if (prefersReducedMotion) {
      iframe.style.opacity = "1";
      iframe.style.transform = isMobile() ? "translateY(0)" : "scale(1) translateY(0)";
    } else {
      iframe.style.opacity = "0";
      if (isMobile()) {
        updateMobileLayout();
        iframe.style.transform = "translateY(100%)";
      } else {
        iframe.style.transform = "scale(0.92) translateY(8px)";
      }
      iframe.offsetHeight;
      iframe.style.opacity = "1";
      iframe.style.transform = isMobile() ? "translateY(0)" : "scale(1) translateY(0)";
    }
    if (isMobile()) updateMobileLayout();
    scheduleFocusChatInput();
  }

  function closeChat() {
    open = false;
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-label", loc.openChat);
    button.innerHTML = chatIconSvg;
    button.style.visibility = "";
    button.style.pointerEvents = "";
    releaseFocusTrap();
    if (prefersReducedMotion) {
      iframe.style.opacity = "0";
      onChatClosed();
    } else {
      iframe.style.opacity = "0";
      iframe.style.transform = isMobile() ? "translateY(100%)" : "scale(0.92) translateY(8px)";
    }
    unlockPageScroll();
    button.focus();
  }

  function onChatClosed() {
    iframe.style.display = "none";
    restoreDesktopLayout();
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

  window.CivicCore = {
    open: () => {
      if (!open) openChat();
    },
    close: () => {
      if (open) closeChat();
    },
    toggle,
  };

  window.addEventListener("message", (e) => {
    if (e.data.type === "CLOSE_WIDGET") {
      if (open) {
        closeChat();
      } else {
        onChatClosed();
      }
    } else if (e.data.type === "INPUT_FOCUSED") {
      updateMobileLayout();
      requestAnimationFrame(updateMobileLayout);
      setTimeout(updateMobileLayout, 150);
      setTimeout(updateMobileLayout, 350);
    } else if (e.data.type === "INPUT_BLURRED") {
      setTimeout(updateMobileLayout, 80);
    }
  });

  iframe.onload = () => {
    iframe.contentWindow.postMessage(
      { type: "INIT", config, mobile: isMobile() },
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
