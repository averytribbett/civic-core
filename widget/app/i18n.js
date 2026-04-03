/**
 * Lightweight i18n for the chat widget.
 *
 * Locale files (locales/*.js) register themselves on window.__CHAT_LOCALES
 * before this script runs.  This module exposes a global `i18n` object with:
 *   - i18n.locale        current language code (e.g. "en")
 *   - i18n.setLocale(l)  switch language + update DOM elements marked with data-i18n
 *   - i18n.t(key, params) translate a key, with optional {{param}} interpolation
 */
window.i18n = (function () {
  const locales = window.__CHAT_LOCALES || {};

  function detectLocale() {
    const browserLang = (navigator.language || navigator.userLanguage || "en").split("-")[0];
    return locales[browserLang] ? browserLang : "en";
  }

  let currentLocale = detectLocale();
  document.documentElement.lang = currentLocale;

  function resolve(key) {
    const dict = locales[currentLocale] || locales.en || {};
    const fallback = locales.en || {};
    return key in dict ? dict[key] : fallback[key];
  }

  function t(key, params) {
    let value = resolve(key);
    if (value === undefined) return key;

    if (Array.isArray(value)) return value;

    if (params) {
      Object.keys(params).forEach(function (k) {
        value = value.replace(new RegExp("\\{\\{" + k + "\\}\\}", "g"), params[k]);
      });
    }
    return value;
  }

  function applyDomTranslations() {
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var key = el.getAttribute("data-i18n");
      var attr = el.getAttribute("data-i18n-attr");
      var paramsSrc = el.getAttribute("data-i18n-params");
      var params = paramsSrc ? JSON.parse(paramsSrc) : undefined;
      var translated = t(key, params);

      var attrs = attr ? attr.split(",").map(function (a) { return a.trim(); }) : [];
      if (attrs.length > 0) {
        attrs.forEach(function (a) {
          if (a === "placeholder") {
            el.placeholder = translated;
          } else if (a === "aria-label") {
            el.setAttribute("aria-label", translated);
          } else if (a === "title") {
            el.title = translated;
          } else if (a === "innerHTML") {
            el.innerHTML = translated;
          }
        });
      } else {
        el.textContent = translated;
      }
    });
  }

  function setLocale(lang) {
    currentLocale = locales[lang] ? lang : "en";
    document.documentElement.lang = currentLocale;
    applyDomTranslations();
  }

  return {
    get locale() { return currentLocale; },
    setLocale: setLocale,
    t: t,
    applyDomTranslations: applyDomTranslations,
  };
})();
