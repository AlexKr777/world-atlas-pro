(() => {
  "use strict";

  const refreshButton = document.getElementById("banned-refresh");
  const leadEl = document.getElementById("banned-lead");
  const statusEl = document.getElementById("banned-status");
  const sourceEl = document.getElementById("banned-source");
  const reasonEl = document.getElementById("banned-reason");
  const untilEl = document.getElementById("banned-until");
  const noteEl = document.getElementById("banned-note");

  if (!(refreshButton instanceof HTMLButtonElement)) {
    return;
  }

  const queryAccess = readAccessFromQuery();
  if (queryAccess) {
    renderAccess(queryAccess);
  }

  refreshButton.addEventListener("click", () => {
    void loadAccessState({ interactive: true });
  });

  void loadAccessState({ interactive: false });

  async function loadAccessState(options = {}) {
    const interactive = options.interactive === true;
    refreshButton.disabled = true;
    if (interactive) {
      refreshButton.textContent = "Checking...";
    }

    try {
      const response = await fetch("/api/access-state", {
        method: "GET",
        headers: {
          Accept: "application/json"
        }
      });
      const payload = await response.json().catch(() => null);
      const access = payload?.access && typeof payload.access === "object"
        ? payload.access
        : null;

      if (!response.ok || !access) {
        throw new Error(payload?.error || "Failed to load access status.");
      }

      if (access.isBanned !== true) {
        window.location.replace("/");
        return;
      }

      renderAccess(access);
    } catch (error) {
      leadEl.textContent = "Could not refresh the access status right now.";
      statusEl.textContent = "Unknown";
      sourceEl.textContent = "-";
      reasonEl.textContent = normalizeText(error?.message, "-");
      untilEl.textContent = "-";
      noteEl.textContent = "Please try again a little later.";
    } finally {
      refreshButton.disabled = false;
      refreshButton.textContent = "Check again";
    }
  }

  function renderAccess(access) {
    const source = normalizeText(
      access.source,
      access.isVisitorBanned === true ? "visitor" : "user"
    );
    const reason = normalizeText(access.reason, "Blocked by admin");
    const bannedUntil = normalizeText(access.bannedUntil, "");
    const isPermanent = access.isPermanent === true || !bannedUntil;

    leadEl.textContent = isPermanent
      ? "Access is blocked until an admin removes the restriction."
      : `Access is temporarily restricted until ${formatDate(bannedUntil)}.`;
    statusEl.textContent = isPermanent ? "Permanent ban" : "Temporary ban";
    sourceEl.textContent = source === "visitor" ? "Guest / browser" : "Registered user";
    reasonEl.textContent = reason;
    untilEl.textContent = isPermanent ? "Manual unban required" : formatDate(bannedUntil);
    noteEl.textContent = isPermanent
      ? "If this looks wrong, contact the site admin for a manual unban."
      : "When the timer ends, access returns automatically.";
  }

  function readAccessFromQuery() {
    const search = new URLSearchParams(window.location.search);
    const source = normalizeText(search.get("source"), "");
    const reason = normalizeText(search.get("reason"), "");
    const bannedUntil = normalizeText(search.get("until"), "");
    const isPermanent = normalizeText(search.get("permanent"), "") === "1";
    if (!source && !reason && !bannedUntil && !isPermanent) {
      return null;
    }

    return {
      isBanned: true,
      isVisitorBanned: source === "visitor",
      source,
      reason,
      bannedUntil,
      isPermanent
    };
  }

  function formatDate(value) {
    const timestamp = Date.parse(normalizeText(value, ""));
    if (!Number.isFinite(timestamp)) {
      return "Unknown time";
    }
    return new Date(timestamp).toLocaleString("en-US");
  }

  function normalizeText(value, fallback = "") {
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed || fallback;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value).trim() || fallback;
    }
    return fallback;
  }
})();
