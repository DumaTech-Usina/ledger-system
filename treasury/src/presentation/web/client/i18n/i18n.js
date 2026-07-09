/*
 * Minimal, dependency-free i18n runtime for the static client.
 *
 * A locale registers a nested catalog of message VALUES (the only translated content); every KEY,
 * identifier, and this file's code stays in English. `t()` resolves dotted keys with {var}
 * interpolation. Backend-provided display text is localized by the stable domain identifiers the
 * API already exposes (scenario id, slot key, status, audit type, economic effect, message), and
 * falls back to the backend's own (English) text when a catalog entry is missing.
 */
window.I18N = (function () {
  const locales = {};
  let current = "pt-BR";

  const register = (locale, catalog) => { locales[locale] = catalog; };
  const setLocale = (locale) => { if (locales[locale]) current = locale; };
  const cat = () => locales[current] || {};
  const get = (path) => path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), cat());
  const interpolate = (str, vars) =>
    String(str).replace(/\{(\w+)\}/g, (_, k) => (vars && k in vars ? vars[k] : `{${k}}`));

  /** UI string by dotted key, e.g. t("ui.confirm_submit"). */
  const t = (key, vars) => {
    const v = get(key);
    return v == null ? key : interpolate(v, vars);
  };

  // Domain resolvers — index the sub-catalog directly (ids/keys/enum values may contain dots, e.g.
  // the audit type "intent.submitted", so they must NOT go through the dotted-path resolver).
  // Fallback is the backend-provided text.
  const scenarioTitle = (id, fb) => cat().scenarios?.[id]?.title ?? fb ?? id;
  const scenarioDesc = (id, fb) => cat().scenarios?.[id]?.description ?? fb ?? "";
  const slotPrompt = (scenarioId, key, fb) => cat().slots?.[scenarioId]?.[key] ?? fb ?? key;
  const status = (s) => cat().status?.[s] ?? s;
  const event = (type) => cat().events?.[type] ?? type;
  const role = (r) => cat().roles?.[r] ?? r;
  const cashEffect = (e) => cat().cashEffects?.[e] ?? e;
  const positionStatus = (s) => cat().positionStatus?.[s] ?? s;

  /** Localize a backend-generated message (validation / rejection); pattern-match the dynamic ones. */
  const message = (msg) => {
    if (msg == null) return "";
    const map = cat().messages || {};
    if (map[msg]) return map[msg];
    if (/ is required\.$/.test(msg)) return t("ui.required");
    const choose = msg.match(/^Choose one of: (.+)\.$/);
    if (choose) return t("ui.choose_one", { options: choose[1] });
    return msg; // fallback: unchanged backend text
  };

  // Locale-aware formatting (display only; never alters the underlying data).
  const money = (amount, currency) => {
    const n = Number(amount);
    if (Number.isNaN(n)) return `${amount} ${currency}`;
    try { return new Intl.NumberFormat(current, { style: "currency", currency }).format(n); }
    catch { return `${amount} ${currency}`; }
  };
  const date = (iso) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    // Format in UTC: occurredAt is a date-only business value, so the calendar date must not
    // shift across timezones.
    return new Intl.DateTimeFormat(current, { dateStyle: "medium", timeZone: "UTC" }).format(d);
  };

  /** Apply catalog text to static markup: [data-i18n] → textContent, [data-i18n-html] → innerHTML. */
  const applyStatic = (root) => {
    (root || document).querySelectorAll("[data-i18n]").forEach((e) => {
      e.textContent = t(e.getAttribute("data-i18n"));
    });
    (root || document).querySelectorAll("[data-i18n-html]").forEach((e) => {
      e.innerHTML = t(e.getAttribute("data-i18n-html"));
    });
  };

  return {
    register, setLocale, t, scenarioTitle, scenarioDesc, slotPrompt, status, event, role,
    cashEffect, positionStatus, message, money, date, applyStatic,
    get locale() { return current; },
  };
})();
