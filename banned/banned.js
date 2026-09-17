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

  refreshButton.addEventListener("click", () => {
    void loadAccessState({ interactive: true });
  });

  void loadAccessState({ interactive: false });

  async function loadAccessState(options = {}) {
    const interactive = options.interactive === true;
    refreshButton.disabled = true;
    if (interactive) {
      refreshButton.textContent = "Проверяем...";
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
        throw new Error(payload?.error || "Не удалось получить статус блокировки.");
      }

      if (access.isBanned !== true) {
        window.location.replace("/");
        return;
      }

      renderAccess(access);
    } catch (error) {
      leadEl.textContent = "Не удалось обновить статус блокировки прямо сейчас.";
      statusEl.textContent = "Unknown";
      sourceEl.textContent = "-";
      reasonEl.textContent = normalizeText(error?.message, "-");
      untilEl.textContent = "-";
      noteEl.textContent = "Попробуйте повторить чуть позже.";
    } finally {
      refreshButton.disabled = false;
      refreshButton.textContent = "Проверить снова";
    }
  }

  function renderAccess(access) {
    const source = normalizeText(access.source, access.isVisitorBanned === true ? "visitor" : "user");
    const reason = normalizeText(access.reason, "Не указана");
    const bannedUntil = normalizeText(access.bannedUntil, "");
    const isPermanent = access.isPermanent === true || !bannedUntil;

    leadEl.textContent = isPermanent
      ? "Доступ закрыт до ручного разбана администратором."
      : `Доступ временно ограничен до ${formatDate(bannedUntil)}.`;
    statusEl.textContent = isPermanent ? "Permanent ban" : "Temporary ban";
    sourceEl.textContent = source === "visitor" ? "Guest / browser" : "Registered user";
    reasonEl.textContent = reason;
    untilEl.textContent = isPermanent ? "Manual unban required" : formatDate(bannedUntil);
    noteEl.textContent = isPermanent
      ? "Если это ошибка, обратитесь к администратору для ручного разбана."
      : "Когда срок временного бана закончится, доступ вернется автоматически.";
  }

  function formatDate(value) {
    const timestamp = Date.parse(normalizeText(value, ""));
    if (!Number.isFinite(timestamp)) {
      return "Unknown time";
    }
    return new Date(timestamp).toLocaleString();
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
