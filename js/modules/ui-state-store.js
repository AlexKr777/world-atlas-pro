(() => {
  "use strict";

  if (window.WorldAtlasUiStateStore) {
    return;
  }

  const STORAGE_KEY = "worldAtlasPro.uiState.v1";
  const listeners = new Set();

  let state = createInitialState();

  attachEventBridges();
  restorePersistedState();
  notify();

  window.WorldAtlasUiStateStore = Object.freeze({
    getState,
    subscribe,
    setMode,
    patch,
    reset
  });
  window.dispatchEvent(new CustomEvent("worldatlas:ui-store-ready"));

  function createInitialState() {
    return {
      mode: "catalog",
      places: {
        total: 0,
        visible: 0,
        regions: 0,
        categories: 0
      },
      social: {
        favorites: 0,
        isAuthenticated: false,
        userEmail: "",
        selectedPlaceName: "-"
      },
      planner: {
        selectedPlaceName: "-",
        distanceLabel: "-",
        durationLabel: "-",
        modeLabel: "Car",
        provider: "-"
      }
    };
  }

  function getState() {
    return cloneState(state);
  }

  function subscribe(listener) {
    if (typeof listener !== "function") {
      throw new TypeError("UiStateStore listener must be a function.");
    }

    listeners.add(listener);
    try {
      listener(getState());
    } catch (error) {
      console.error("[ui-state-store] initial listener call failed:", error);
    }

    return () => {
      listeners.delete(listener);
    };
  }

  function setMode(nextMode) {
    const mode = normalizeMode(nextMode);
    if (state.mode === mode) {
      return false;
    }

    patch({ mode });
    persistState();
    return true;
  }

  function patch(partial) {
    if (!partial || typeof partial !== "object") {
      return false;
    }

    state = {
      ...state,
      ...partial,
      places: {
        ...state.places,
        ...(partial.places || {})
      },
      social: {
        ...state.social,
        ...(partial.social || {})
      },
      planner: {
        ...state.planner,
        ...(partial.planner || {})
      }
    };

    notify();
    return true;
  }

  function reset() {
    state = createInitialState();
    persistState();
    notify();
  }

  function notify() {
    const snapshot = getState();
    for (const listener of listeners) {
      try {
        listener(snapshot);
      } catch (error) {
        console.error("[ui-state-store] listener failed:", error);
      }
    }
  }

  function attachEventBridges() {
    window.addEventListener("worldatlas:places-updated", handlePlacesUpdated);
    window.addEventListener("worldatlas:selection-changed", handleSelectionChanged);
    window.addEventListener("worldatlas:favorites-synced", handleFavoritesSynced);
    window.addEventListener("worldatlas:auth-changed", handleAuthChanged);
    window.addEventListener("worldatlas:route-metrics-updated", handleRouteMetricsUpdated);
  }

  function handlePlacesUpdated(event) {
    const detail = event?.detail || {};
    patch({
      places: {
        total: asNonNegativeInt(detail.total),
        visible: asNonNegativeInt(detail.visible),
        regions: asNonNegativeInt(detail.regions),
        categories: asNonNegativeInt(detail.categories)
      },
      social: {
        favorites: asNonNegativeInt(detail.favorites)
      }
    });
  }

  function handleSelectionChanged(event) {
    const detail = event?.detail || {};
    const placeName = normalizeText(detail.placeName, "-");

    patch({
      social: {
        selectedPlaceName: placeName
      },
      planner: {
        selectedPlaceName: placeName
      }
    });
  }

  function handleFavoritesSynced(event) {
    const ids = Array.isArray(event?.detail?.ids) ? event.detail.ids : [];
    patch({
      social: {
        favorites: ids.length
      }
    });
  }

  function handleAuthChanged(event) {
    const session = event?.detail?.session || null;
    const email = normalizeText(session?.user?.email, "");

    patch({
      social: {
        isAuthenticated: Boolean(email),
        userEmail: email
      }
    });
  }

  function handleRouteMetricsUpdated(event) {
    const detail = event?.detail || {};
    patch({
      planner: {
        distanceLabel: normalizeText(detail.distanceLabel, "-"),
        durationLabel: normalizeText(detail.durationLabel, "-"),
        modeLabel: normalizeText(detail.modeLabel, "Car"),
        provider: normalizeText(detail.provider, "-")
      }
    });
  }

  function restorePersistedState() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw);
      const persistedMode = normalizeMode(parsed?.mode);
      state = {
        ...state,
        mode: persistedMode
      };
    } catch (error) {
      console.warn("[ui-state-store] Failed to restore persisted state:", error);
    }
  }

  function persistState() {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          mode: normalizeMode(state.mode)
        })
      );
    } catch (error) {
      console.warn("[ui-state-store] Failed to persist state:", error);
    }
  }

  function normalizeMode(value) {
    const mode = normalizeText(value, "").toLowerCase();
    if (mode === "catalog" || mode === "guide" || mode === "planner") {
      return mode;
    }
    return "catalog";
  }

  function asNonNegativeInt(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) {
      return 0;
    }
    return Math.floor(numeric);
  }

  function normalizeText(value, fallback = "") {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) {
        return trimmed;
      }
    }
    return fallback;
  }

  function cloneState(source) {
    return {
      mode: source.mode,
      places: { ...source.places },
      social: { ...source.social },
      planner: { ...source.planner }
    };
  }
})();
