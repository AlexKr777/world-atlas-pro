(() => {
  "use strict";

  const APP_SCRIPT_SRC = "./app.js?v=20260425d";
  const MAP_MODULE_SRC = "./map.js?v=20260409c";
  const POPUP_MODULE_SRC = "./popup.js?v=20260416d";
  const DEFERRED_MODULE_SCRIPTS = Object.freeze([
    Object.freeze({
      key: "supabase-config",
      src: "./config-supabase.js?v=20260425d",
      type: "module",
      check: () => Boolean(window.SUPABASE_CONFIG && window.supabaseReady),
      unavailableError: "config-supabase.js loaded but Supabase config is unavailable."
    })
  ]);
  const DEFERRED_RUNTIME_SCRIPTS = Object.freeze([
    Object.freeze({
      key: "supabase-data-sync",
      src: "./supabase-data-sync.js?v=20260425d"
    }),
    Object.freeze({
      key: "supabase-bridge",
      src: "./supabase-bridge-20260413a.js?v=20260425d"
    }),
    Object.freeze({
      key: "travel-shell",
      src: "./js/modules/travel-shell.js?v=20260425d"
    })
  ]);
  const APP_BOOT_WAIT_TIMEOUT_MS = 2600;
  const MAP_READY_TIMEOUT_MS = 30000;
  const LOADER_MIN_VISIBLE_MS = 420;
  const LOADER_FADE_OUT_MS = 260;
  const MAP_READY_EVENT_NAME = "wa:map-ready";
  const APP_BOOT_ERROR_EVENT_NAME = "worldatlas:boot-error";
  const DEFERRED_RUNTIME_IDLE_TIMEOUT_MS = 1800;
  const DEFERRED_RUNTIME_DELAY_MS = 9000;

  const LoaderStages = Object.freeze({
    MODULES: "Loading modules...",
    APP_INIT: "Initializing app...",
    PLACES: "Loading places...",
    MAP_RENDER: "Rendering map...",
    TILES: "Loading tiles...",
    READY: "Ready"
  });

  let started = false;
  let deferredRuntimeStarted = false;
  let deferredRuntimeLoaded = false;
  let deferredRuntimeReplayTarget = null;
  const scriptLoadPromises = new Map();
  const loader = {
    mounted: false,
    hidden: false,
    mountedAt: 0,
    progressDisplayed: 0,
    progressTarget: 0,
    progressTimerId: 0,
    overlayEl: null,
    fillEl: null,
    percentEl: null,
    stageEl: null,
    statusEl: null,
    errorEl: null,
    errorTitleEl: null,
    errorDetailsEl: null,
    retryButtonEl: null,
    htmlOverflow: "",
    bodyOverflow: ""
  };

  function clearLegacyCacheIfAny() {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations()
        .then((registrations) => {
          for (const registration of registrations) {
            registration.unregister().catch(() => {});
          }
        })
        .catch(() => {});
    }

    if ("caches" in window && typeof caches.keys === "function") {
      caches.keys()
        .then((cacheNames) => Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName))))
        .catch(() => {});
    }
  }

  function installNoClusterCompat() {
    if (window.__WORLD_ATLAS_NO_CLUSTER_COMPAT__ === true) {
      return;
    }

    const Leaflet = window.L;
    if (!Leaflet || typeof Leaflet.layerGroup !== "function") {
      return;
    }

    const createLayerGroup = Leaflet.layerGroup.bind(Leaflet);

    Leaflet.markerClusterGroup = function markerClusterGroupCompat(rawOptions = {}) {
      const layerGroup = createLayerGroup();
      const options = rawOptions && typeof rawOptions === "object"
        ? { ...rawOptions }
        : {};
      const chunkedLoading = options.chunkedLoading !== false;
      const chunkInterval = clamp(Number(options.chunkInterval), 50, 200);
      const chunkDelay = clamp(Number(options.chunkDelay), 0, 50);
      const chunkProgress = typeof options.chunkProgress === "function"
        ? options.chunkProgress
        : null;
      const chunkAddThreshold = Number.isFinite(Number(options.chunkAddThreshold))
        ? Math.max(1, Math.floor(Number(options.chunkAddThreshold)))
        : 24;

      const originalAddLayer = typeof layerGroup.addLayer === "function"
        ? layerGroup.addLayer.bind(layerGroup)
        : null;
      const originalRemoveLayer = typeof layerGroup.removeLayer === "function"
        ? layerGroup.removeLayer.bind(layerGroup)
        : null;
      const originalClearLayers = typeof layerGroup.clearLayers === "function"
        ? layerGroup.clearLayers.bind(layerGroup)
        : null;

      let pendingAddQueue = [];
      let pendingAddSet = new Set();
      let chunkTimerId = 0;
      let batchStartedAt = 0;
      let batchProcessed = 0;
      let batchTotal = 0;

      const normalizeLayersInput = (layersInput) => {
        if (!layersInput) {
          return [];
        }
        if (Array.isArray(layersInput)) {
          return layersInput.filter(Boolean);
        }
        if (typeof layersInput[Symbol.iterator] === "function") {
          const result = [];
          for (const layer of layersInput) {
            if (layer) {
              result.push(layer);
            }
          }
          return result;
        }
        return [];
      };

      const clearChunkTimer = () => {
        if (!chunkTimerId) {
          return;
        }
        window.clearTimeout(chunkTimerId);
        chunkTimerId = 0;
      };

      const resetChunkBatch = () => {
        batchStartedAt = 0;
        batchProcessed = 0;
        batchTotal = 0;
      };

      const updateBatchTotal = () => {
        if (!batchStartedAt) {
          return;
        }
        batchTotal = Math.max(batchProcessed, batchProcessed + pendingAddQueue.length);
      };

      const scheduleChunkRun = (useDelay) => {
        if (chunkTimerId) {
          return;
        }
        const delay = useDelay ? chunkDelay : 0;
        chunkTimerId = window.setTimeout(() => {
          chunkTimerId = 0;
          runChunk();
        }, delay);
      };

      const runChunk = () => {
        if (!originalAddLayer || pendingAddQueue.length === 0) {
          pendingAddQueue = [];
          pendingAddSet.clear();
          resetChunkBatch();
          return;
        }

        if (!batchStartedAt) {
          batchStartedAt = performance.now();
          batchProcessed = 0;
          batchTotal = pendingAddQueue.length;
        }

        const chunkStartedAt = performance.now();
        while (pendingAddQueue.length > 0 && (performance.now() - chunkStartedAt) < chunkInterval) {
          const nextLayer = pendingAddQueue.shift();
          if (!nextLayer) {
            continue;
          }
          pendingAddSet.delete(nextLayer);
          originalAddLayer(nextLayer);
          batchProcessed += 1;
        }

        if (chunkProgress) {
          try {
            chunkProgress(
              batchProcessed,
              Math.max(batchProcessed, batchTotal),
              performance.now() - batchStartedAt
            );
          } catch (_) {
            // Best-effort compatibility: chunkProgress errors should not break rendering.
          }
        }

        if (pendingAddQueue.length > 0) {
          scheduleChunkRun(true);
          return;
        }

        pendingAddSet.clear();
        resetChunkBatch();
      };

      const enqueueLayers = (layers) => {
        if (layers.length === 0) {
          return 0;
        }

        let queued = 0;
        for (const layer of layers) {
          if (pendingAddSet.has(layer)) {
            continue;
          }
          pendingAddSet.add(layer);
          pendingAddQueue.push(layer);
          queued += 1;
        }
        if (queued > 0) {
          updateBatchTotal();
        }
        return queued;
      };

      const removeQueuedLayer = (layer) => {
        if (!pendingAddSet.has(layer)) {
          return false;
        }
        pendingAddSet.delete(layer);
        pendingAddQueue = pendingAddQueue.filter((item) => item !== layer);
        updateBatchTotal();
        return true;
      };

      if (originalAddLayer) {
        layerGroup.addLayer = (layer) => {
          if (!layer) {
            return layerGroup;
          }

          if (!chunkedLoading) {
            originalAddLayer(layer);
            return layerGroup;
          }

          enqueueLayers([layer]);
          scheduleChunkRun(false);
          return layerGroup;
        };
      }

      layerGroup.addLayers = (layersInput) => {
        if (!originalAddLayer) {
          return layerGroup;
        }

        const layers = normalizeLayersInput(layersInput);
        if (layers.length === 0) {
          return layerGroup;
        }

        if (!chunkedLoading || layers.length <= chunkAddThreshold) {
          for (const layer of layers) {
            removeQueuedLayer(layer);
            originalAddLayer(layer);
          }
          return layerGroup;
        }

        enqueueLayers(layers);
        scheduleChunkRun(false);
        return layerGroup;
      };

      if (originalRemoveLayer) {
        layerGroup.removeLayer = (layer) => {
          if (!layer) {
            return layerGroup;
          }
          removeQueuedLayer(layer);
          originalRemoveLayer(layer);
          return layerGroup;
        };
      }

      layerGroup.removeLayers = (layersInput) => {
        if (!originalRemoveLayer) {
          return layerGroup;
        }

        const layers = normalizeLayersInput(layersInput);
        for (const layer of layers) {
          removeQueuedLayer(layer);
          originalRemoveLayer(layer);
        }
        return layerGroup;
      };

      if (originalClearLayers) {
        layerGroup.clearLayers = (...args) => {
          clearChunkTimer();
          pendingAddQueue = [];
          pendingAddSet.clear();
          resetChunkBatch();
          return originalClearLayers(...args);
        };
      }

      if (typeof layerGroup.refreshClusters !== "function") {
        layerGroup.refreshClusters = () => layerGroup;
      }

      if (typeof layerGroup.zoomToShowLayer !== "function") {
        layerGroup.zoomToShowLayer = (_, onShown) => {
          if (typeof onShown === "function") {
            onShown();
          }
          return layerGroup;
        };
      }

      if (typeof layerGroup.getAllChildMarkers !== "function") {
        layerGroup.getAllChildMarkers = () => {
          const markers = [];
          layerGroup.eachLayer((layer) => {
            markers.push(layer);
          });
          return markers;
        };
      }

      return layerGroup;
    };

    window.__WORLD_ATLAS_NO_CLUSTER_COMPAT__ = true;
  }

  function clamp(value, min, max) {
    if (!Number.isFinite(value)) {
      return min;
    }
    if (value < min) {
      return min;
    }
    if (value > max) {
      return max;
    }
    return value;
  }

  function delay(ms) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });
  }

  function setInteractionBlocked(blocked) {
    const htmlEl = document.documentElement;
    const bodyEl = document.body;

    if (!htmlEl || !bodyEl) {
      return;
    }

    if (blocked) {
      loader.htmlOverflow = htmlEl.style.overflow || "";
      loader.bodyOverflow = bodyEl.style.overflow || "";
      htmlEl.style.overflow = "hidden";
      bodyEl.style.overflow = "hidden";
      return;
    }

    htmlEl.style.overflow = loader.htmlOverflow;
    bodyEl.style.overflow = loader.bodyOverflow;
  }

  function mountLoaderUI() {
    if (loader.mounted) {
      return;
    }

    const overlay = document.createElement("div");
    overlay.id = "wa-loader";
    overlay.className = "worldatlas-loader";
    overlay.setAttribute("role", "status");
    overlay.setAttribute("aria-live", "polite");
    overlay.innerHTML = `
      <div class="worldatlas-loader__panel">
        <p class="worldatlas-loader__brand">World Atlas Pro</p>
        <p class="worldatlas-loader__subtitle">Preparing interactive map</p>
        <div class="worldatlas-loader__track" aria-hidden="true">
          <span class="worldatlas-loader__fill"></span>
        </div>
        <div class="worldatlas-loader__meta">
          <span class="worldatlas-loader__stage">${LoaderStages.MODULES}</span>
          <span class="worldatlas-loader__percent">0%</span>
        </div>
        <p class="worldatlas-loader__status">Loading modules...</p>
        <div class="worldatlas-loader__error" hidden>
          <p class="worldatlas-loader__error-title">Failed to load app</p>
          <p class="worldatlas-loader__error-details">Try reload / check network.</p>
          <button type="button" class="worldatlas-loader__retry">Retry</button>
        </div>
      </div>
    `;

    const target = document.body || document.documentElement;
    if (!target) {
      return;
    }

    target.append(overlay);
    setInteractionBlocked(true);

    loader.mounted = true;
    loader.hidden = false;
    loader.mountedAt = Date.now();
    loader.overlayEl = overlay;
    loader.fillEl = overlay.querySelector(".worldatlas-loader__fill");
    loader.percentEl = overlay.querySelector(".worldatlas-loader__percent");
    loader.stageEl = overlay.querySelector(".worldatlas-loader__stage");
    loader.statusEl = overlay.querySelector(".worldatlas-loader__status");
    loader.errorEl = overlay.querySelector(".worldatlas-loader__error");
    loader.errorTitleEl = overlay.querySelector(".worldatlas-loader__error-title");
    loader.errorDetailsEl = overlay.querySelector(".worldatlas-loader__error-details");
    loader.retryButtonEl = overlay.querySelector(".worldatlas-loader__retry");

    if (loader.retryButtonEl) {
      loader.retryButtonEl.addEventListener("click", () => {
        window.location.reload();
      });
    }

    loader.progressTimerId = window.setInterval(() => {
      if (loader.hidden) {
        return;
      }
      const diff = loader.progressTarget - loader.progressDisplayed;
      if (diff <= 0.01) {
        return;
      }
      const step = Math.max(0.9, diff * 0.24);
      loader.progressDisplayed = clamp(
        loader.progressDisplayed + step,
        0,
        loader.progressTarget
      );
      renderLoaderProgress();
    }, 70);

    setLoaderProgress(1, LoaderStages.MODULES);
  }

  function renderLoaderProgress() {
    if (!loader.mounted) {
      return;
    }
    const safePercent = clamp(loader.progressDisplayed, 0, 100);
    if (loader.fillEl) {
      loader.fillEl.style.transform = `scaleX(${safePercent / 100})`;
    }
    if (loader.percentEl) {
      loader.percentEl.textContent = `${Math.round(safePercent)}%`;
    }
  }

  function setLoaderProgress(percent, label) {
    if (!loader.mounted) {
      return;
    }

    if (typeof label === "string" && label.trim()) {
      if (loader.stageEl) {
        loader.stageEl.textContent = label.trim();
      }
      if (loader.statusEl) {
        loader.statusEl.textContent = label.trim();
      }
    }

    const nextTarget = clamp(Number(percent), 0, 100);
    loader.progressTarget = Math.max(loader.progressTarget, nextTarget);
    if (loader.progressTarget >= 100) {
      loader.progressDisplayed = Math.max(loader.progressDisplayed, 99);
      renderLoaderProgress();
    }
  }

  async function hideLoaderUI() {
    if (!loader.mounted || loader.hidden) {
      return;
    }

    loader.hidden = true;
    loader.progressTarget = 100;
    loader.progressDisplayed = 100;
    renderLoaderProgress();

    const elapsedMs = Date.now() - loader.mountedAt;
    const waitForMinimumVisibilityMs = Math.max(0, LOADER_MIN_VISIBLE_MS - elapsedMs);
    if (waitForMinimumVisibilityMs > 0) {
      await delay(waitForMinimumVisibilityMs);
    }

    if (loader.overlayEl) {
      loader.overlayEl.classList.add("is-hiding");
    }

    await delay(LOADER_FADE_OUT_MS);

    if (loader.progressTimerId) {
      window.clearInterval(loader.progressTimerId);
      loader.progressTimerId = 0;
    }
    if (loader.overlayEl && loader.overlayEl.parentNode) {
      loader.overlayEl.parentNode.removeChild(loader.overlayEl);
    }

    setInteractionBlocked(false);

    loader.mounted = false;
    loader.overlayEl = null;
    loader.fillEl = null;
    loader.percentEl = null;
    loader.stageEl = null;
    loader.statusEl = null;
    loader.errorEl = null;
    loader.errorTitleEl = null;
    loader.errorDetailsEl = null;
    loader.retryButtonEl = null;
  }

  function normalizeErrorMessage(error, fallbackText = "") {
    if (typeof error === "string" && error.trim()) {
      return error.trim();
    }
    if (error && typeof error === "object") {
      const message = typeof error.message === "string" ? error.message.trim() : "";
      if (message) {
        return message;
      }
    }
    return fallbackText;
  }

  function showLoaderError(message, detailsOptional) {
    if (!loader.mounted) {
      mountLoaderUI();
    }
    if (!loader.mounted) {
      return;
    }

    loader.hidden = false;

    const safeMessage = typeof message === "string" && message.trim()
      ? message.trim()
      : "Failed to load app";
    const safeDetails = typeof detailsOptional === "string" && detailsOptional.trim()
      ? detailsOptional.trim()
      : "Try reload / check network.";

    if (loader.stageEl) {
      loader.stageEl.textContent = "Failed";
    }
    if (loader.statusEl) {
      loader.statusEl.textContent = safeDetails;
    }
    if (loader.errorEl) {
      loader.errorEl.hidden = false;
    }
    if (loader.errorTitleEl) {
      loader.errorTitleEl.textContent = safeMessage;
    }
    if (loader.errorDetailsEl) {
      loader.errorDetailsEl.textContent = safeDetails;
    }
  }

  function shouldForceCacheBust() {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get("fresh") === "1" || params.get("cacheBust") === "1";
    } catch (_) {
      return false;
    }
  }

  function withOptionalCacheBust(src, force = false) {
    if (!force && !shouldForceCacheBust()) {
      return src;
    }
    const cacheBust = Date.now().toString(36);
    const joiner = src.includes("?") ? "&" : "?";
    return `${src}${joiner}cb=${cacheBust}`;
  }

  function resolveScriptTarget() {
    return document.head || document.documentElement || document.body || null;
  }

  function loadScriptWithCheck(options) {
    const {
      key,
      src,
      check,
      unavailableError
    } = options;

    if (typeof check === "function" && check()) {
      return Promise.resolve();
    }

    if (scriptLoadPromises.has(key)) {
      return scriptLoadPromises.get(key);
    }

    const promise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = withOptionalCacheBust(src, options.cacheBust === true);
      script.async = false;
      script.defer = true;
      if (options.type === "module") {
        script.type = "module";
      }
      script.dataset.injectedBy = `boot-app-${key}`;

      script.onload = () => {
        if (typeof check !== "function" || check()) {
          resolve();
          return;
        }
        reject(new Error(unavailableError));
      };

      script.onerror = () => {
        reject(new Error(`Failed to load ${src}.`));
      };

      const target = resolveScriptTarget();
      if (!target) {
        reject(new Error("Unable to append module script to document."));
        return;
      }
      target.append(script);
    }).catch((error) => {
      scriptLoadPromises.delete(key);
      throw error;
    });

    scriptLoadPromises.set(key, promise);
    return promise;
  }

  function startAppScript() {
    if (started && scriptLoadPromises.has("app-entry")) {
      return scriptLoadPromises.get("app-entry");
    }
    if (started) {
      return Promise.resolve();
    }

    started = true;
    const promise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = withOptionalCacheBust(APP_SCRIPT_SRC);
      script.async = false;
      script.defer = true;
      script.dataset.injectedBy = "boot-app";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load app.js."));

      const target = resolveScriptTarget();
      if (!target) {
        reject(new Error("Unable to append app.js script to document."));
        return;
      }
      target.append(script);
    }).catch((error) => {
      scriptLoadPromises.delete("app-entry");
      throw error;
    });

    scriptLoadPromises.set("app-entry", promise);
    return promise;
  }

  async function ensureCoreModulesLoaded() {
    const hasMapModule = () =>
      Boolean(
        window.WorldAtlasMapModule &&
        typeof window.WorldAtlasMapModule === "object" &&
        typeof window.WorldAtlasMapModule.initMap === "function"
      );

    const hasPopupModule = () =>
      Boolean(
        window.WorldAtlasPopup &&
        typeof window.WorldAtlasPopup === "object" &&
        typeof window.WorldAtlasPopup.createPlacePopupApi === "function"
      );

    await loadScriptWithCheck({
      key: "map-module",
      src: MAP_MODULE_SRC,
      check: hasMapModule,
      unavailableError: "map.js loaded but window.WorldAtlasMapModule.initMap is unavailable."
    });

    await loadScriptWithCheck({
      key: "popup-module",
      src: POPUP_MODULE_SRC,
      check: hasPopupModule,
      unavailableError: "popup.js loaded but window.WorldAtlasPopup.createPlacePopupApi is unavailable."
    });

    if (!hasMapModule() || !hasPopupModule()) {
      throw new Error("Core modules are unavailable after bootstrap.");
    }
  }

  function scheduleDeferredRuntimeScripts(reason = "idle") {
    const run = () => {
      loadDeferredRuntimeScripts(reason).catch((error) => {
        console.warn("[boot-app] Deferred runtime failed:", error);
      });
    };
    const scheduleIdleRun = () => {
      if (typeof window.requestIdleCallback === "function") {
        window.requestIdleCallback(run, { timeout: DEFERRED_RUNTIME_IDLE_TIMEOUT_MS });
        return;
      }

      window.setTimeout(run, 240);
    };

    if (reason !== "interaction") {
      window.setTimeout(scheduleIdleRun, DEFERRED_RUNTIME_DELAY_MS);
      return;
    }
    scheduleIdleRun();
  }

  async function loadDeferredRuntimeScripts(reason = "manual") {
    if (deferredRuntimeLoaded) {
      return;
    }
    if (deferredRuntimeStarted && scriptLoadPromises.has("deferred-runtime")) {
      return scriptLoadPromises.get("deferred-runtime");
    }

    deferredRuntimeStarted = true;
    const promise = (async () => {
      for (const entry of DEFERRED_MODULE_SCRIPTS) {
        await loadScriptWithCheck(entry);
      }

      await Promise.all(
        DEFERRED_RUNTIME_SCRIPTS.map((entry) => loadScriptWithCheck(entry))
      );
      deferredRuntimeLoaded = true;
      window.dispatchEvent(new CustomEvent("worldatlas:deferred-runtime-ready", {
        detail: { reason }
      }));
    })().catch((error) => {
      deferredRuntimeStarted = false;
      scriptLoadPromises.delete("deferred-runtime");
      throw error;
    });

    scriptLoadPromises.set("deferred-runtime", promise);
    return promise;
  }

  function installDeferredRuntimeWakeListeners() {
    const deferredSelectors = [
      "#auth-toggle",
      "#admin-toggle",
      "#travel-hub-toggle",
      ".travel-mode-switch__btn[data-mode]"
    ].join(",");

    const wakeHandler = (event) => {
      if (deferredRuntimeLoaded) {
        return;
      }

      const target = event.target instanceof Element
        ? event.target.closest(deferredSelectors)
        : null;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      if (!deferredRuntimeReplayTarget) {
        deferredRuntimeReplayTarget = target;
        void loadDeferredRuntimeScripts("interaction").then(async () => {
          const replayTarget = deferredRuntimeReplayTarget;
          deferredRuntimeReplayTarget = null;
          await waitForDeferredReplayTarget(replayTarget);
          const liveReplayTarget = resolveLiveReplayTarget(replayTarget);
          if (liveReplayTarget instanceof HTMLElement && liveReplayTarget.isConnected) {
            liveReplayTarget.click();
          }
        });
      } else {
        void loadDeferredRuntimeScripts("interaction");
      }
    };

    document.addEventListener("pointerdown", wakeHandler, true);
    document.addEventListener("click", wakeHandler, true);
    for (const element of document.querySelectorAll(deferredSelectors)) {
      element.addEventListener("pointerdown", wakeHandler, true);
      element.addEventListener("click", wakeHandler, true);
    }
  }

  async function waitForDeferredReplayTarget(target) {
    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (
      target.matches("#travel-hub-toggle") ||
      target.matches(".travel-mode-switch__btn[data-mode]")
    ) {
      await waitForCondition(
        () => Boolean(window.WorldAtlasTravelHub),
        5000
      );
    }
  }

  function resolveLiveReplayTarget(target) {
    if (!(target instanceof HTMLElement)) {
      return null;
    }

    if (target.matches(".travel-mode-switch__btn[data-mode]")) {
      const mode = String(target.dataset.mode || "").trim();
      if (mode) {
        const liveModeButton = document.querySelector(
          `.travel-mode-switch__btn[data-mode="${cssEscape(mode)}"]`
        );
        if (liveModeButton instanceof HTMLElement) {
          return liveModeButton;
        }
      }
    }

    if (target.id) {
      const liveById = document.getElementById(target.id);
      if (liveById instanceof HTMLElement) {
        return liveById;
      }
    }

    return target;
  }

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === "function") {
      return window.CSS.escape(value);
    }
    return String(value).replace(/["\\]/g, "\\$&");
  }

  function waitForCondition(check, timeoutMs) {
    if (typeof check !== "function") {
      return Promise.resolve(false);
    }

    return new Promise((resolve) => {
      const deadline = Date.now() + Math.max(0, Number(timeoutMs) || 0);
      const tick = () => {
        let passed = false;
        try {
          passed = Boolean(check());
        } catch (_) {
          passed = false;
        }
        if (passed) {
          resolve(true);
          return;
        }
        if (Date.now() >= deadline) {
          resolve(false);
          return;
        }
        window.setTimeout(tick, 50);
      };
      tick();
    });
  }

  async function waitForRuntimeAndStart() {
    const runtimeReady = window.WorldAtlasSupabaseRuntimeReady;
    if (!runtimeReady || typeof runtimeReady.then !== "function") {
      return;
    }

    const timeoutPromise = new Promise((resolve) => {
      window.setTimeout(resolve, APP_BOOT_WAIT_TIMEOUT_MS);
    });

    try {
      await Promise.race([runtimeReady, timeoutPromise]);
    } catch (_) {
      // Best-effort wait only.
    }
  }

  function waitForMapReady(timeoutMs) {
    if (window.__WA_MAP_READY__ === true) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      let settled = false;
      const safeTimeoutMs = Number.isFinite(Number(timeoutMs)) ? Number(timeoutMs) : MAP_READY_TIMEOUT_MS;
      const timeoutId = window.setTimeout(() => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        reject(new Error("Map tiles did not load within 30 seconds."));
      }, safeTimeoutMs);

      const onMapReady = () => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        resolve();
      };

      const onBootError = (event) => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        const detailMessage = normalizeErrorMessage(event?.detail?.message, "");
        const fallbackMessage = normalizeErrorMessage(window.__WORLD_ATLAS_APP_BOOT_ERROR__, "");
        reject(new Error(detailMessage || fallbackMessage || "App bootstrap failed."));
      };

      const cleanup = () => {
        window.clearTimeout(timeoutId);
        window.removeEventListener(MAP_READY_EVENT_NAME, onMapReady);
        window.removeEventListener(APP_BOOT_ERROR_EVENT_NAME, onBootError);
      };

      window.addEventListener(MAP_READY_EVENT_NAME, onMapReady);
      window.addEventListener(APP_BOOT_ERROR_EVENT_NAME, onBootError);
    });
  }

  async function runBootSequence() {
    mountLoaderUI();
    setLoaderProgress(10, LoaderStages.MODULES);
    window.__WA_MAP_READY__ = false;

    try {
      await waitForRuntimeAndStart();
      await ensureCoreModulesLoaded();
      setLoaderProgress(35, LoaderStages.APP_INIT);

      const mapReadyPromise = waitForMapReady(MAP_READY_TIMEOUT_MS);

      setLoaderProgress(55, LoaderStages.PLACES);
      await startAppScript();
      setLoaderProgress(75, LoaderStages.MAP_RENDER);
      setLoaderProgress(90, LoaderStages.TILES);

      await mapReadyPromise;
      setLoaderProgress(100, LoaderStages.READY);
      await hideLoaderUI();
      scheduleDeferredRuntimeScripts("post-map-ready");
    } catch (error) {
      console.error("[boot-app] Bootstrap failed:", error);
      showLoaderError("Failed to load app", normalizeErrorMessage(error, "Try reload / check network."));
    }
  }

  clearLegacyCacheIfAny();
  installNoClusterCompat();
  installDeferredRuntimeWakeListeners();
  void runBootSequence();
})();
