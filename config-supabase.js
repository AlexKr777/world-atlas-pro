(() => {
  "use strict";

  const SUPABASE_URL = normalizeSupabaseProjectUrl(
    "https://ruhgizowwafhyvtyrcuc.supabase.co"
  );
  const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_IoC3P4HXrhxZ-IO-dpm8eQ_hZhsdj_V";
  const SUPABASE_AUTH_MODE = "mvp_no_confirmation";
  const SUPABASE_EMAIL_REDIRECT_TO = resolveDefaultRedirectUrl();
  const SUPABASE_SDK_URLS = Object.freeze([
    "https://esm.sh/@supabase/supabase-js@2",
    "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm"
  ]);

  const CONFIG = Object.freeze({
    url: SUPABASE_URL,
    publishableKey: SUPABASE_PUBLISHABLE_KEY,
    authMode: SUPABASE_AUTH_MODE,
    emailRedirectTo: SUPABASE_EMAIL_REDIRECT_TO
  });

  window.SUPABASE_CONFIG = CONFIG;

  window.supabaseReady = (async () => {
    try {
      const configError = validateConfig(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
      if (configError) {
        throw new Error(configError);
      }

      const sdk = await loadSupabaseSdk(SUPABASE_SDK_URLS);
      if (!sdk || typeof sdk.createClient !== "function") {
        throw new Error("createClient is unavailable in Supabase SDK.");
      }

      const client = sdk.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });

      window.supabase = client;
      window.dispatchEvent(
        new CustomEvent("worldatlas:supabase-ready", { detail: { client } })
      );
      return client;
    } catch (error) {
      console.error("[config-supabase] Failed to initialize Supabase client.", error);
      window.dispatchEvent(
        new CustomEvent("worldatlas:supabase-error", { detail: { error } })
      );
      throw error;
    }
  })();

  function validateConfig(url, key) {
    const normalizedUrl = String(url || "").trim();
    const normalizedKey = String(key || "").trim();

    if (!normalizedUrl || !normalizedKey) {
      return "Supabase URL/key is missing.";
    }

    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(normalizedUrl)) {
      return `Invalid Supabase URL format: ${normalizedUrl}`;
    }

    if (normalizedUrl.includes("supabase_co")) {
      return `Invalid Supabase URL host: ${normalizedUrl}`;
    }

    return "";
  }

  function normalizeSupabaseProjectUrl(rawUrl) {
    const value = String(rawUrl || "").trim();
    if (!value) {
      return "";
    }

    try {
      const parsed = new URL(value);
      const host = normalizeHost(parsed.hostname);
      const dashboardMatch = /\/project\/([a-z0-9-]+)/i.exec(parsed.pathname || "");
      if ((host === "supabase.com" || host === "www.supabase.com") && dashboardMatch) {
        const projectRef = String(dashboardMatch[1] || "").trim().toLowerCase();
        if (projectRef) {
          const derivedUrl = `https://${projectRef}.supabase.co`;
          console.warn(
            `[config-supabase] Dashboard URL detected. Using project REST origin: ${derivedUrl}`
          );
          return derivedUrl;
        }
      }

      const normalizedOrigin = parsed.origin.replace(/\/$/, "");
      const hasUnexpectedPath = normalizePath(parsed.pathname) !== "/";
      const hasExtras = Boolean(parsed.search) || Boolean(parsed.hash);

      if (hasUnexpectedPath || hasExtras) {
        console.warn(
          `[config-supabase] SUPABASE_URL contained path/query/hash. Using origin only: ${normalizedOrigin}`
        );
      }

      return normalizedOrigin;
    } catch {
      return value;
    }
  }

  function normalizePath(pathname) {
    if (typeof pathname !== "string" || pathname.trim() === "") {
      return "/";
    }

    const normalized = pathname.trim().replace(/\/+/g, "/");
    return normalized.startsWith("/") ? normalized : `/${normalized}`;
  }

  function normalizeHost(hostname) {
    return String(hostname || "").trim().toLowerCase();
  }

  async function loadSupabaseSdk(urls) {
    let lastError = null;

    for (const url of urls) {
      try {
        return await import(url);
      } catch (error) {
        lastError = error;
      }
    }

    if (lastError) {
      throw lastError;
    }

    throw new Error("Supabase SDK URL list is empty.");
  }

  function resolveDefaultRedirectUrl() {
    const origin =
      typeof window.location?.origin === "string"
        ? window.location.origin.trim()
        : "";

    if (/^https?:\/\//i.test(origin)) {
      return `${origin.replace(/\/$/, "")}/`;
    }

    return "https://www.misterfreemanscoin.com/";
  }
})();
