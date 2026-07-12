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
  const locales = Object.keys(window.__CHAT_LOCALES || {}).sort();

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
  const { messageId, vote: initialVote } = options;
  const div = document.createElement("div");
  div.className = `message ${from}`;
  if (messageId) div.dataset.messageId = messageId;

  const body = document.createElement("div");
  body.className = "message-body";
  if (from === "agent") {
    const rawHtml = await markdownToHtml(text);
    const safeHtml =
      typeof DOMPurify !== "undefined"
        ? DOMPurify.sanitize(rawHtml, { ADD_ATTR: ["target"] })
        : rawHtml;
    body.innerHTML = safeHtml;
    body.querySelectorAll("a").forEach((a) => {
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener noreferrer");
    });
    body.querySelectorAll("img:not([alt])").forEach((img) => {
      img.setAttribute("alt", "");
    });
  } else {
    body.textContent = text;
  }
  div.appendChild(body);

  if (from === "agent" && messageId) {
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

  messagesEl.appendChild(div);
  animateMessageIn(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function setLoading(loading) {
  sendBtn.disabled = loading;
  form.setAttribute("aria-busy", loading ? "true" : "false");
}

function showLoadingIndicator() {
  const el = document.createElement("div");
  el.className = "message agent loading-indicator";
  el.setAttribute("role", "status");
  const label = document.createElement("span");
  label.className = "sr-only";
  label.textContent = i18n.t("loadingResponse");
  el.appendChild(label);
  const dotsWrap = document.createElement("span");
  dotsWrap.className = "loading-dots";
  dotsWrap.setAttribute("aria-hidden", "true");
  for (let i = 0; i < 3; i++) {
    dotsWrap.appendChild(document.createElement("span"));
  }
  el.appendChild(dotsWrap);
  messagesEl.appendChild(el);
  animateMessageIn(el);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return el;
}

function removeLoadingIndicator() {
  const el = messagesEl.querySelector(".loading-indicator");
  if (!el) return Promise.resolve();
  return animateMessageOut(el);
}

async function sendToBackend(message) {
  const base = (config.apiBaseUrl || "").replace(/\/$/, "");
  const url = base ? `${base}/chat` : "/chat";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      source: config.source,
      history: getHistoryForRequest(),
      conversationId: conversationId || undefined,
      language: i18n.locale,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || `Request failed (${res.status})`);
  }
  const data = await res.json();
  return data;
}

form.onsubmit = async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;

  addMessage(text, "user");
  input.value = "";
  resetFormSize();
  setLoading(true);
  showLoadingIndicator();

  try {
    const data = await sendToBackend(text);
    await removeLoadingIndicator();
    const response = data.response;
    if (data.conversationId) conversationId = data.conversationId;
    await addMessage(response, "agent", { messageId: data.agentMessageId });
    messageHistory.push({ role: "user", content: text });
    messageHistory.push({ role: "agent", content: response });
    messageHistory = messageHistory.slice(-20);
  } catch (err) {
    await removeLoadingIndicator();
    await addMessage(i18n.t("errorMessage"), "agent");
    console.error("Chat error:", err);
  } finally {
    setLoading(false);
  }
};

if (closeBtn) {
  closeBtn.onclick = () => {
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
