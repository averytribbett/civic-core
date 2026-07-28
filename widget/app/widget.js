const messagesEl = document.getElementById("messages");
const form = document.getElementById("form");
const input = document.getElementById("input");
const closeBtn = document.getElementById("close");
const sendBtn = form.querySelector(".send-btn");
const textarea = document.getElementById("input");
const gradientTop = document.querySelector(".gradient-top");
const gradientBottom = document.querySelector(".gradient-bottom");

/** Locale code to display name for the language dropdown */
const LOCALE_NAMES = {
  en: "English", es: "Español", fr: "Français", de: "Deutsch",
  zh: "中文", ja: "日本語", pt: "Português", ar: "العربية", ko: "한국어"
};

// Build and wire custom language dropdown (avoids native select overflow on mobile)
const langTrigger = document.getElementById("lang-trigger");
const langDropdown = document.getElementById("lang-dropdown");
let langOptions = [];

function updateLangTriggerLabel() {
  if (!langTrigger) return;
  const name = LOCALE_NAMES[i18n.locale] || i18n.locale;
  langTrigger.textContent = name;
  langTrigger.setAttribute("aria-label", `${i18n.t("languageLabel")}, ${name}`);
}

function closeLangDropdown() {
  if (!langDropdown || !langTrigger) return;
  langDropdown.setAttribute("aria-hidden", "true");
  langTrigger.setAttribute("aria-expanded", "false");
}

function openLangDropdown() {
  if (!langDropdown || !langTrigger) return;
  langDropdown.setAttribute("aria-hidden", "false");
  langTrigger.setAttribute("aria-expanded", "true");
  const selectedIdx = langOptions.findIndex((opt) => opt.dataset.lang === i18n.locale);
  const focusIdx = selectedIdx >= 0 ? selectedIdx : 0;
  langOptions[focusIdx]?.focus();
}

if (langTrigger && langDropdown) {
  const PINNED_LOCALES = ["en", "es"];
  const locales = (() => {
    const all = Object.keys(window.__CHAT_LOCALES || {});
    const pinned = PINNED_LOCALES.filter((code) => all.includes(code));
    const rest = all
      .filter((code) => !PINNED_LOCALES.includes(code))
      .sort();
    return [...pinned, ...rest];
  })();

  function selectLocale(code) {
    i18n.setLocale(code);
    updateLangTriggerLabel();
    closeLangDropdown();
    const nameEl = document.getElementById("chat-name");
    if (nameEl) {
      nameEl.textContent = config.name || i18n.t("headerDefaultName");
    }
    const welcomeEl = document.getElementById("welcome-message");
    if (welcomeEl) {
      const displayName = config.name || i18n.t("defaultName");
      welcomeEl.innerHTML = i18n.t("welcomeMessage", { name: displayName });
    }
    langDropdown.querySelectorAll("[role='option']").forEach((opt) => {
      opt.setAttribute("aria-selected", opt.dataset.lang === code ? "true" : "false");
    });
  }

  locales.forEach((code) => {
    const opt = document.createElement("button");
    opt.type = "button";
    opt.className = "chat-header-lang-option";
    opt.role = "option";
    opt.id = `lang-option-${code}`;
    opt.dataset.lang = code;
    opt.textContent = LOCALE_NAMES[code] || code;
    opt.setAttribute("aria-selected", code === i18n.locale ? "true" : "false");
    opt.addEventListener("click", () => selectLocale(code));
    langDropdown.appendChild(opt);
    langOptions.push(opt);
  });

  updateLangTriggerLabel();

  langTrigger.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = langDropdown.getAttribute("aria-hidden") === "false";
    if (isOpen) {
      closeLangDropdown();
    } else {
      openLangDropdown();
    }
  });

  langTrigger.addEventListener("keydown", (e) => {
    if (
      langDropdown.getAttribute("aria-hidden") === "true" &&
      (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ")
    ) {
      e.preventDefault();
      openLangDropdown();
    }
  });

  langDropdown.addEventListener("keydown", (e) => {
    const idx = langOptions.indexOf(document.activeElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      langOptions[Math.min(idx + 1, langOptions.length - 1)]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      langOptions[Math.max(idx - 1, 0)]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      langOptions[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      langOptions[langOptions.length - 1]?.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeLangDropdown();
      langTrigger.focus();
    } else if ((e.key === "Enter" || e.key === " ") && document.activeElement?.dataset?.lang) {
      e.preventDefault();
      selectLocale(document.activeElement.dataset.lang);
    }
  });

  document.addEventListener("click", () => closeLangDropdown());
  langDropdown.addEventListener("click", (e) => e.stopPropagation());
}

// Auto resize with multiline detection
function autoResize() {
  textarea.style.height = "auto";
  textarea.style.height = textarea.scrollHeight + "px";

  const formWidth = form.offsetWidth;
  const textareaWidth = textarea.offsetWidth;

  if (textarea.scrollHeight > 36 || textareaWidth > formWidth - 60) {
    form.classList.add("multiline");
    gradientTop?.classList.remove("hidden");
    gradientBottom?.classList.remove("hidden");
  } else {
    form.classList.remove("multiline");
    gradientTop?.classList.add("hidden");
    gradientBottom?.classList.add("hidden");
  }
}

function resetFormSize() {
  textarea.style.height = "36px";
  form.classList.remove("multiline");
  gradientTop?.classList.add("hidden");
  gradientBottom?.classList.add("hidden");
}

textarea.addEventListener("input", autoResize);
resetFormSize();

function scrollMessagesToEnd() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function notifyParentInputFocus(focused) {
  window.parent.postMessage({ type: focused ? "INPUT_FOCUSED" : "INPUT_BLURRED" }, "*");
}

input.addEventListener("focus", () => {
  scrollMessagesToEnd();
  notifyParentInputFocus(true);
});

input.addEventListener("blur", () => {
  notifyParentInputFocus(false);
});

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    form.requestSubmit();
  }
});

let config = {
  apiBaseUrl: "",
  source: "chisago_county_mn",
  name: "",
  logo: "",
  theme: { color: "#2563eb" },
  align: "right", // "right" | "left" — position of widget on screen
};

/** Last 20 messages (up to 10 user + 10 agent) for context. Each item: { role: "user" | "agent", content: string } */
let messageHistory = [];

/** Current conversation id from backend; sent with each request so messages are stored in the same thread. */
let conversationId = null;

const MAX_HISTORY_LENGTH = 20;

/** Build request payload history: array of { role, content } for backend parseHistory (last 20 only). */
function getHistoryForRequest() {
  return messageHistory
    .filter((m) => m && (m.role === "user" || m.role === "agent") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: String(m.content) }))
    .slice(-MAX_HISTORY_LENGTH);
}

function applyTheme(themeColor) {
  const hex = themeColor || "#2563eb";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  document.documentElement.style.setProperty("--chat-primary", hex);
  document.documentElement.style.setProperty("--chat-primary-rgb", `${r}, ${g}, ${b}`);
  const darken = (n, pct) => Math.max(0, Math.round(n * (1 - pct)));
  document.documentElement.style.setProperty(
    "--chat-primary-hover",
    `rgb(${darken(r, 0.12)}, ${darken(g, 0.12)}, ${darken(b, 0.12)})`
  );
}

function applyConfig(c) {
  config.apiBaseUrl = c.apiBaseUrl ?? config.apiBaseUrl;
  config.source = c.source ?? config.source;
  config.name = c.name ?? config.name;
  config.logo = c.logo ?? config.logo;
  config.theme = c.theme ?? config.theme;
  config.align = c.align ?? config.align;
  applyTheme(config.theme?.color);

  const displayName = config.name || i18n.t("defaultName");

  const logoEl = document.getElementById("chat-logo");
  const nameEl = document.getElementById("chat-name");
  const welcomeEl = document.getElementById("welcome-message");

  if (logoEl) {
    if (config.logo) {
      logoEl.src = config.logo;
      logoEl.alt = config.name ? i18n.t("headerLogoAlt", { name: config.name }) : "";
      logoEl.style.display = "block";
    } else {
      logoEl.style.display = "none";
    }
  }
  if (nameEl) nameEl.textContent = config.name || i18n.t("headerDefaultName");
  if (welcomeEl) welcomeEl.innerHTML = i18n.t("welcomeMessage", { name: displayName });
}

/** Host page tells us mobile vs desktop (iframe width is not the browser width). */
function setMobileLayout(mobile) {
  document.documentElement.classList.toggle("is-mobile", !!mobile);
}

// Standalone fallback when not embedded (e.g. widget.html opened directly)
if (window.parent === window) {
  const mq = window.matchMedia("(max-width: 768px)");
  setMobileLayout(mq.matches);
  mq.addEventListener("change", (e) => setMobileLayout(e.matches));
}

window.addEventListener("message", (e) => {
  if (!e.data || typeof e.data !== "object") return;
  if (e.data.type === "INIT" && e.data.config) {
    applyConfig(e.data.config);
    if (typeof e.data.mobile === "boolean") setMobileLayout(e.data.mobile);
  } else if (e.data.type === "LAYOUT" && typeof e.data.mobile === "boolean") {
    setMobileLayout(e.data.mobile);
  }
});

async function markdownToHtml(text) {
  if (typeof marked !== "undefined") {
    const parse = typeof marked.parse === "function" ? marked.parse : marked;
    const raw = parse(text, { gfm: true, breaks: true });
    return raw && typeof raw.then === "function" ? await raw : raw;
  }
  return text;
}

/** Remove citation markers like [1] from display text (chips carry the links). */
function stripCitationMarkers(text) {
  if (typeof text !== "string" || !text) return text;
  return text
    .replace(/\s*\[(\d+)\]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/ {2,}/g, " ")
    .trim();
}

async function renderMarkdownInto(bodyEl, text, { stabilize = false } = {}) {
  const withoutCitations = stripCitationMarkers(text);
  const source =
    stabilize && typeof stabilizeIncompleteMarkdown === "function"
      ? stabilizeIncompleteMarkdown(withoutCitations)
      : withoutCitations;
  const rawHtml = await markdownToHtml(source);
  const safeHtml =
    typeof DOMPurify !== "undefined"
      ? DOMPurify.sanitize(rawHtml, { ADD_ATTR: ["target"] })
      : rawHtml;
  bodyEl.innerHTML = safeHtml;
  bodyEl.querySelectorAll("a").forEach((a) => {
    a.setAttribute("target", "_blank");
    a.setAttribute("rel", "noopener noreferrer");
  });
  bodyEl.querySelectorAll("img:not([alt])").forEach((img) => {
    img.setAttribute("alt", "");
  });
}

function attachVoteActions(div, messageId, initialVote) {
  if (div.querySelector(".message-actions")) return;
  const actions = document.createElement("div");
  actions.className = "message-actions";
  const thumbsUpSvg =
    '<svg class="vote-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>';
  const upBtn = document.createElement("button");
  upBtn.type = "button";
  upBtn.className = "vote-btn vote-up" + (initialVote === "up" ? " active" : "");
  upBtn.setAttribute("aria-label", i18n.t("upvote"));
  upBtn.innerHTML = thumbsUpSvg;
  const downBtn = document.createElement("button");
  downBtn.type = "button";
  downBtn.className = "vote-btn vote-down" + (initialVote === "down" ? " active" : "");
  downBtn.setAttribute("aria-label", i18n.t("downvote"));
  downBtn.innerHTML = '<span class="vote-icon-wrap vote-icon-down">' + thumbsUpSvg + "</span>";

  const setVote = (v) => {
    upBtn.classList.toggle("active", v === "up");
    downBtn.classList.toggle("active", v === "down");
    upBtn.setAttribute("aria-pressed", v === "up" ? "true" : "false");
    downBtn.setAttribute("aria-pressed", v === "down" ? "true" : "false");
    div.dataset.vote = v || "";
  };
  setVote(initialVote || "");

  const submitVote = async (v) => {
    const prev = div.dataset.vote;
    setVote(v);
    const base = (config.apiBaseUrl || "").replace(/\/$/, "");
    const url = base ? `${base}/chat/message/${messageId}/vote` : `/chat/message/${messageId}/vote`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vote: v, source: config.source }),
      });
      if (!res.ok) setVote(prev);
    } catch {
      setVote(prev);
    }
  };

  upBtn.addEventListener("click", () => submitVote("up"));
  downBtn.addEventListener("click", () => submitVote("down"));
  actions.appendChild(upBtn);
  actions.appendChild(downBtn);
  div.appendChild(actions);
}

const MESSAGE_EXIT_MS = 420;

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function animateMessageIn(el) {
  el.classList.add("message--enter");
  if (prefersReducedMotion()) {
    el.classList.add("message--visible");
    return;
  }
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      el.classList.add("message--visible");
    });
  });
}

function animateMessageOut(el) {
  return new Promise((resolve) => {
    if (prefersReducedMotion()) {
      el.remove();
      resolve();
      return;
    }
    el.classList.remove("message--visible");
    el.classList.add("message--exit");
    const done = () => {
      el.remove();
      resolve();
    };
    el.addEventListener("transitionend", done, { once: true });
    setTimeout(done, MESSAGE_EXIT_MS + 40);
  });
}

async function addMessage(text, from, options = {}) {
  const { messageId, vote: initialVote, sources } = options;
  const div = document.createElement("div");
  div.className = `message ${from}`;
  if (messageId) div.dataset.messageId = messageId;

  const body = document.createElement("div");
  body.className = "message-body";
  if (from === "agent") {
    await renderMarkdownInto(body, text, { stabilize: false });
  } else {
    body.textContent = text;
  }
  div.appendChild(body);

  if (from === "agent") {
    attachSources(div, sources);
  }

  if (from === "agent" && messageId) {
    attachVoteActions(div, messageId, initialVote);
  }

  messagesEl.appendChild(div);
  animateMessageIn(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return div;
}

function sourceChipLabel(source) {
  return source.title || source.heading || source.url || "Source";
}

let sourcesLabelSeq = 0;

function attachSources(div, sources) {
  const existing = div.querySelector(".message-sources");
  if (existing) existing.remove();
  if (!Array.isArray(sources) || sources.length === 0) return;

  const wrap = document.createElement("nav");
  wrap.className = "message-sources";

  const labelId = `message-sources-label-${++sourcesLabelSeq}`;
  const label = document.createElement("h3");
  label.className = "message-sources-label";
  label.id = labelId;
  label.textContent =
    typeof i18n !== "undefined" ? i18n.t("sourcesLabel") : "Sources";
  wrap.setAttribute("aria-labelledby", labelId);
  wrap.appendChild(label);

  const list = document.createElement("ul");
  list.className = "message-sources-list";
  list.setAttribute("aria-labelledby", labelId);

  const opensInNewTab =
    typeof i18n !== "undefined" ? i18n.t("opensInNewTab") : "Opens in a new tab";

  for (const source of sources) {
    const href = source.href || source.url;
    if (!href || typeof href !== "string") continue;

    const item = document.createElement("li");
    item.className = "message-sources-item";

    const a = document.createElement("a");
    a.className = "message-source-chip";
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener noreferrer";

    const visibleLabel = sourceChipLabel(source);
    a.textContent = visibleLabel;

    const srHint = document.createElement("span");
    srHint.className = "sr-only";
    srHint.textContent = ` (${opensInNewTab})`;
    a.appendChild(srHint);

    item.appendChild(a);
    list.appendChild(item);
  }
  if (!list.childElementCount) return;
  wrap.appendChild(list);

  const actions = div.querySelector(".message-actions");
  if (actions) div.insertBefore(wrap, actions);
  else div.appendChild(wrap);
}

function createStreamingAgentMessage() {
  const div = document.createElement("div");
  div.className = "message agent message--streaming";
  div.setAttribute("aria-live", "polite");
  const body = document.createElement("div");
  body.className = "message-body";
  div.appendChild(body);
  messagesEl.appendChild(div);
  animateMessageIn(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return { div, body };
}

function setLoading(loading) {
  sendBtn.disabled = loading;
  form.setAttribute("aria-busy", loading ? "true" : "false");
}

const STATUS_SEARCH_DELAY_MS = 1100;
let statusPhaseTimer = null;

function showStatusIndicator() {
  clearStatusPhaseTimer();
  const el = document.createElement("div");
  el.className = "chat-status";
  el.id = "chat-status";
  el.setAttribute("role", "status");
  el.setAttribute("aria-live", "polite");

  const label = document.createElement("span");
  label.className = "chat-status-label";
  label.textContent = i18n.t("thinkingStatus");

  const ellipsis = document.createElement("span");
  ellipsis.className = "chat-status-ellipsis";
  ellipsis.setAttribute("aria-hidden", "true");

  el.appendChild(label);
  el.appendChild(ellipsis);
  messagesEl.appendChild(el);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  // RAG turns often search before the first token — name the wait after a short beat
  statusPhaseTimer = setTimeout(() => {
    statusPhaseTimer = null;
    const current = document.getElementById("chat-status");
    const labelEl = current?.querySelector(".chat-status-label");
    if (labelEl) labelEl.textContent = i18n.t("searchingStatus");
  }, STATUS_SEARCH_DELAY_MS);

  return el;
}

function clearStatusPhaseTimer() {
  if (statusPhaseTimer != null) {
    clearTimeout(statusPhaseTimer);
    statusPhaseTimer = null;
  }
}

function removeStatusIndicator() {
  clearStatusPhaseTimer();
  const el = document.getElementById("chat-status");
  if (!el) return;
  el.remove();
}

async function sendToBackendStreaming(message, { onToken, signal } = {}) {
  const base = (config.apiBaseUrl || "").replace(/\/$/, "");
  const url = base ? `${base}/chat` : "/chat";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({
      message,
      source: config.source,
      history: getHistoryForRequest(),
      conversationId: conversationId || undefined,
      language: i18n.locale,
      stream: true,
    }),
    signal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || `Request failed (${res.status})`);
  }

  if (!res.body) {
    throw new Error("Streaming not supported by this browser");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let donePayload = null;
  let streamError = null;

  const handleEvent = (eventName, dataStr) => {
    let data;
    try {
      data = JSON.parse(dataStr);
    } catch {
      return;
    }
    if (eventName === "token" && data.text) {
      onToken?.(data.text);
    } else if (eventName === "done") {
      donePayload = data;
    } else if (eventName === "error") {
      streamError = new Error(data.message || "Stream error");
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() || "";
    for (const part of parts) {
      if (!part.trim()) continue;
      let eventName = "message";
      const dataLines = [];
      for (const line of part.split("\n")) {
        if (line.startsWith("event:")) {
          eventName = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          dataLines.push(line.slice(5).trim());
        }
      }
      if (dataLines.length) {
        handleEvent(eventName, dataLines.join("\n"));
      }
    }
  }

  if (streamError) throw streamError;
  if (!donePayload) {
    throw new Error("Stream ended without a complete response");
  }
  return donePayload;
}

form.onsubmit = async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;

  addMessage(text, "user");
  input.value = "";
  resetFormSize();
  setLoading(true);
  showStatusIndicator();

  const abortController = new AbortController();
  activeChatAbort = abortController;
  let streamUi = null;
  let rawMarkdown = "";
  let rafPending = false;
  let destroyed = false;
  let statusCleared = false;

  const clearStatusOnce = () => {
    if (statusCleared) return;
    statusCleared = true;
    removeStatusIndicator();
  };

  const ensureStreamUi = () => {
    if (streamUi || destroyed) return;
    clearStatusOnce();
    streamUi = createStreamingAgentMessage();
  };

  const scheduleRender = () => {
    if (rafPending || destroyed) return;
    rafPending = true;
    requestAnimationFrame(async () => {
      rafPending = false;
      if (destroyed) return;
      ensureStreamUi();
      if (!streamUi) return;
      await renderMarkdownInto(streamUi.body, rawMarkdown, { stabilize: true });
      messagesEl.scrollTop = messagesEl.scrollHeight;
    });
  };

  try {
    const data = await sendToBackendStreaming(text, {
      signal: abortController.signal,
      onToken: (delta) => {
        rawMarkdown += delta;
        scheduleRender();
      },
    });

    clearStatusOnce();
    if (data.conversationId) conversationId = data.conversationId;
    const response = data.response || rawMarkdown;
    const sources = Array.isArray(data.sources) ? data.sources : [];

    if (!streamUi && !rawMarkdown) {
      await addMessage(response, "agent", {
        messageId: data.agentMessageId,
        sources,
      });
    } else {
      ensureStreamUi();
      streamUi.div.classList.remove("message--streaming");
      await renderMarkdownInto(streamUi.body, response, { stabilize: false });
      attachSources(streamUi.div, sources);
      if (data.agentMessageId) {
        streamUi.div.dataset.messageId = data.agentMessageId;
        attachVoteActions(streamUi.div, data.agentMessageId);
      }
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    messageHistory.push({ role: "user", content: text });
    messageHistory.push({ role: "agent", content: response });
    messageHistory = messageHistory.slice(-20);
  } catch (err) {
    destroyed = true;
    clearStatusOnce();
    if (streamUi?.div) {
      streamUi.div.remove();
    }
    const aborted =
      (err && typeof err === "object" && "name" in err && err.name === "AbortError") ||
      (typeof DOMException !== "undefined" && err instanceof DOMException && err.name === "AbortError");
    if (!aborted) {
      await addMessage(i18n.t("errorMessage"), "agent");
      console.error("Chat error:", err);
    }
  } finally {
    if (activeChatAbort === abortController) activeChatAbort = null;
    setLoading(false);
  }
};

let activeChatAbort = null;

if (closeBtn) {
  closeBtn.onclick = () => {
    if (activeChatAbort) {
      activeChatAbort.abort();
      activeChatAbort = null;
    }
    window.parent.postMessage({ type: "CLOSE_WIDGET" }, "*");
  };
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const dropdown = document.getElementById("lang-dropdown");
    const trigger = document.getElementById("lang-trigger");
    if (dropdown?.getAttribute("aria-hidden") === "false") {
      closeLangDropdown();
      trigger?.focus();
      return;
    }
    window.parent.postMessage({ type: "CLOSE_WIDGET" }, "*");
  }
});

// Apply default theme so colors work before INIT
applyTheme(config.theme?.color);

// Apply browser-detected locale translations to static DOM elements
i18n.applyDomTranslations();
updateLangTriggerLabel();

const welcomeMessage = messagesEl?.querySelector(".message.agent");
if (welcomeMessage) animateMessageIn(welcomeMessage);
