(() => {
  "use strict";

  if (window.WorldAtlasTravelHub) {
    return;
  }

  const MODE_CATALOG = "catalog";
  const MODE_GUIDE = "guide";
  const MODE_PLANNER = "planner";
  const CUSTOM_VALUE = "__custom__";
  const ENABLE_REMOTE_GUIDE_METRICS = window.WORLDATLAS_ENABLE_REMOTE_GUIDE_METRICS === true;
  const ENABLE_REMOTE_TRIP_PLANS = window.WORLDATLAS_ENABLE_TRIP_PLANS_REMOTE === true;
  const SOCIAL_GUIDE_CACHE_TTL_MS = 3 * 60 * 1000;
  const SOCIAL_GUIDE_WARMUP_COUNT = 20;
  const SOCIAL_GUIDE_FETCH_PAGE_SIZE = 120;
  const SOCIAL_GUIDE_FETCH_BATCH_DELAY_MS = 32;
  const SOCIAL_GUIDE_FETCH_MOTION_PAUSE_MS = 90;
  const SOCIAL_GUIDE_FETCH_MOTION_PAUSE_MAX_MS = 3600;
  const SOCIAL_GUIDE_INITIAL_CHUNK = 20;
  const SOCIAL_GUIDE_MAX_DOM_ITEMS = 28;
  const SOCIAL_GUIDE_OVERSCAN_ITEMS = 6;
  const SOCIAL_GUIDE_ROW_HEIGHT_ESTIMATE_PX = 92;
  const SOCIAL_GUIDE_QUERY_DEBOUNCE_MS = 140;
  const SOCIAL_GUIDE_IMAGE_CONCURRENCY = 1;
  const SOCIAL_GUIDE_IMAGE_LOAD_DELAY_MS = 140;
  const SOCIAL_GUIDE_IMAGE_TARGET_SIZE_PX = 96;
  const SOCIAL_GUIDE_IMAGE_QUALITY = 18;
  const SOCIAL_GUIDE_IMAGE_SCROLL_IDLE_MS = 220;
  const SOCIAL_GUIDE_IMAGE_ROOT_MARGIN = "24px 0px 24px 0px";
  const SOCIAL_GUIDE_IMAGE_OBSERVER_THRESHOLD = 0.01;
  const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  const socialGuideCache = {
    items: [],
    ts: 0,
    isComplete: false,
    warmupInflight: null,
    inflight: null
  };

  const KEYS = {
    collapse: "worldAtlasPro.travelHub.collapsed.v1",
    guide: "worldAtlasPro.travelHub.guide.v1",
    plans: "worldAtlasPro.tripPlans.v1",
    favorites: "worldAtlasPro.favorites.v1",
    feedback: "worldAtlasPro.placeFeedback.v1"
  };

  const MODE_META = {
    [MODE_CATALOG]: { title: "Travel Catalog", subtitle: "Places catalog and overview" },
    [MODE_GUIDE]: { title: "Social Guide", subtitle: "Top / Popular / New from real data" },
    [MODE_PLANNER]: { title: "Trip Planner", subtitle: "Route metrics and saved plans" }
  };

  const state = {
    mode: MODE_CATALOG,
    collapsed: false,
    store: null,
    snapshot: null,
    session: null,
    guide: {
      loading: false,
      complete: false,
      loadedAt: 0,
      places: [],
      metrics: new Map(),
      metricsInflight: null,
      sourceLabel: "Source: local activity",
      filters: { curated: "top", query: "" },
      queryTimerId: 0,
      appendToken: 0,
      renderedCount: 0,
      renderItems: [],
      renderToken: 0,
      scrollRafId: 0,
      mapMotionActive: false,
      imageObserver: null,
      imageObserverRoot: null,
      imageQueue: [],
      imageQueued: new Set(),
      imageInFlight: 0,
      imagePumpTimerId: 0,
      imageLastUiMotionAt: 0,
      imageLoadedUrls: new Set(),
      imageFailedUrls: new Set()
    },
    planner: {
      plans: [],
      syncLabel: "local",
      remoteAvailable: ENABLE_REMOTE_TRIP_PLANS,
      remoteError: ENABLE_REMOTE_TRIP_PLANS
        ? ""
        : "Remote planner sync is disabled in client config."
    }
  };

  const els = {};

  boot();

  function boot() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init, { once: true });
      return;
    }
    init();
  }

  async function init() {
    ensureRightSidebarStack();

    if (!resolveBaseElements()) {
      return;
    }

    buildPanels();
    bindBaseEvents();
    state.guide.mapMotionActive = isGuideMapMotionFlagActive();

    state.collapsed = Boolean(readJson(KEYS.collapse, true));
    applyCollapsedState();

    state.store = await waitForUiStore();
    if (state.store) {
      state.snapshot = state.store.getState();
      state.store.subscribe(onStoreUpdate);
      state.mode = normalizeMode(state.snapshot?.mode, MODE_CATALOG);
    }

    restoreGuideFilters();
    await refreshSession();
    attachGlobalEvents();

    renderModeUi();
    renderCatalogMetrics();
    renderPlannerSnapshot();
    observeRoutePanel();

    if (state.mode === MODE_GUIDE) {
      void primeSocialGuideDuringBoot();
      await openSocialGuideTab(false);
    }

    if (state.mode === MODE_PLANNER) {
      await loadPlannerPlans(false);
    }

    window.WorldAtlasTravelHub = Object.freeze({
      refreshGuide: () => openSocialGuideTab(true),
      openSocialGuideTab: () => openSocialGuideTab(false),
      warmupSocialGuide: () => warmupSocialGuide(SOCIAL_GUIDE_WARMUP_COUNT),
      prefetchSocialGuide: () => prefetchSocialGuide(false),
      refreshPlanner: () => loadPlannerPlans(true),
      savePlan: () => saveCurrentPlan()
    });
  }

  function ensureRightSidebarStack() {
    const travelHub = document.getElementById("travel-hub");
    if (!(travelHub instanceof HTMLElement)) {
      return;
    }

    const host = travelHub.parentElement;
    if (!(host instanceof HTMLElement)) {
      return;
    }

    let stack = document.getElementById("right-sidebar-stack");
    if (!(stack instanceof HTMLElement)) {
      stack = document.createElement("div");
      stack.id = "right-sidebar-stack";
      stack.className = "right-sidebar-stack";
      host.insertBefore(stack, travelHub);
    }

    if (travelHub.parentElement !== stack) {
      stack.append(travelHub);
    }

    const adminDrawer = document.getElementById("admin-drawer");
    if (adminDrawer instanceof HTMLElement && adminDrawer.parentElement !== stack) {
      stack.append(adminDrawer);
    }
  }

  function resolveBaseElements() {
    els.root = document.getElementById("travel-hub");
    els.title = document.getElementById("travel-hub-title");
    els.subtitle = document.getElementById("travel-hub-subtitle");
    els.toggle = document.getElementById("travel-hub-toggle");
    els.metrics = document.getElementById("travel-hub-metrics");
    els.modeButtons = Array.from(document.querySelectorAll(".travel-mode-switch__btn[data-mode]"));

    if (!(els.root instanceof HTMLElement) ||
      !(els.title instanceof HTMLElement) ||
      !(els.subtitle instanceof HTMLElement) ||
      !(els.toggle instanceof HTMLButtonElement) ||
      !(els.metrics instanceof HTMLElement) ||
      els.modeButtons.length === 0
    ) {
      console.warn("[travel-shell] travel hub is not ready.");
      return false;
    }

    return true;
  }

  function buildPanels() {
    els.panels = document.createElement("div");
    els.panels.className = "travel-hub__panels";
    els.root.append(els.panels);

    buildGuidePanel();
    buildPlannerPanel();
  }

  function buildGuidePanel() {
    const panel = document.createElement("section");
    panel.className = "travel-panel travel-panel--guide";
    panel.hidden = true;

    const curated = document.createElement("div");
    curated.className = "travel-guide__curated";
    const btnTop = createButton("travel-guide__curated-btn", "Top by rating");
    btnTop.dataset.curated = "top";
    const btnPopular = createButton("travel-guide__curated-btn", "Popular");
    btnPopular.dataset.curated = "popular";
    const btnNew = createButton("travel-guide__curated-btn", "New");
    btnNew.dataset.curated = "new";
    curated.append(btnTop, btnPopular, btnNew);

    const filters = document.createElement("div");
    filters.className = "travel-guide__filters";
    const query = document.createElement("input");
    query.type = "search";
    query.className = "text-input travel-guide__query";
    query.placeholder = "Tags / category / region";
    const refresh = createButton("app-btn app-btn--ghost travel-guide__refresh", "Refresh");
    filters.append(query, refresh);

    const status = document.createElement("div");
    status.className = "travel-guide__status";
    const source = document.createElement("p");
    source.className = "travel-guide__source";
    const counter = document.createElement("p");
    counter.className = "travel-guide__counter";
    status.append(source, counter);

    const list = document.createElement("ul");
    list.className = "travel-guide__cards";
    list.setAttribute("aria-live", "polite");

    panel.append(curated, filters, status, list);
    els.panels.append(panel);

    els.guide = {
      panel,
      curatedButtons: [btnTop, btnPopular, btnNew],
      query,
      refresh,
      source,
      counter,
      list
    };
  }

  function buildPlannerPanel() {
    const panel = document.createElement("section");
    panel.className = "travel-panel travel-panel--planner";
    panel.hidden = true;

    const summary = document.createElement("div");
    summary.className = "travel-planner__summary";
    const mMode = plannerMetric("Mode", "--");
    const mDistance = plannerMetric("Distance", "--");
    const mDuration = plannerMetric("Duration", "--");
    const mProvider = plannerMetric("Provider", "--");
    summary.append(mMode.root, mDistance.root, mDuration.root, mProvider.root);

    const pointsTitle = document.createElement("h3");
    pointsTitle.className = "travel-planner__points-title";
    pointsTitle.textContent = "Selected points";
    const points = document.createElement("ol");
    points.className = "travel-planner__points";

    const actions = document.createElement("div");
    actions.className = "travel-planner__actions";
    const actBuild = createButton("app-btn app-btn--primary travel-planner__action", "Build route");
    const actClear = createButton("app-btn app-btn--ghost travel-planner__action", "Clear");
    const actSave = createButton("app-btn app-btn--ghost travel-planner__action", "Save plan");
    const actReload = createButton("app-btn app-btn--ghost travel-planner__action", "Reload plans");
    actions.append(actBuild, actClear, actSave, actReload);

    const status = document.createElement("p");
    status.className = "travel-planner__status";
    status.setAttribute("role", "status");

    const savedHead = document.createElement("div");
    savedHead.className = "travel-planner__saved-head";
    const savedTitle = document.createElement("h3");
    savedTitle.className = "travel-planner__saved-title";
    savedTitle.textContent = "Saved plans";
    const sync = document.createElement("span");
    sync.className = "travel-planner__sync";
    savedHead.append(savedTitle, sync);
    const saved = document.createElement("ul");
    saved.className = "travel-planner__saved";

    panel.append(summary, pointsTitle, points, actions, status, savedHead, saved);
    els.panels.append(panel);

    els.planner = {
      panel,
      modeValue: mMode.value,
      distanceValue: mDistance.value,
      durationValue: mDuration.value,
      providerValue: mProvider.value,
      points,
      actBuild,
      actClear,
      actSave,
      actReload,
      status,
      sync,
      saved
    };

    els.route = {
      orderList: document.getElementById("route-order-list"),
      mode: document.getElementById("route-mode"),
      build: document.getElementById("route-build"),
      clear: document.getElementById("route-clear"),
      addWaypoint: document.getElementById("route-add-waypoint"),
      extraWrap: document.getElementById("route-extra-points"),
      start: document.getElementById("route-start-place"),
      end: document.getElementById("route-end-place"),
      startLat: document.getElementById("route-start-lat"),
      startLon: document.getElementById("route-start-lon"),
      endLat: document.getElementById("route-end-lat"),
      endLon: document.getElementById("route-end-lon"),
      distance: document.getElementById("route-distance"),
      duration: document.getElementById("route-duration"),
      type: document.getElementById("route-type"),
      provider: document.getElementById("route-provider")
    };
  }

  function createButton(className, text) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = text;
    return button;
  }

  function plannerMetric(label, value) {
    const root = document.createElement("div");
    root.className = "travel-planner__metric";
    const key = document.createElement("span");
    key.className = "travel-planner__metric-key";
    key.textContent = label;
    const val = document.createElement("strong");
    val.className = "travel-planner__metric-value";
    val.textContent = value;
    root.append(key, val);
    return { root, value: val };
  }

  function bindBaseEvents() {
    els.toggle.addEventListener("click", () => {
      state.collapsed = !state.collapsed;
      applyCollapsedState();
      writeJson(KEYS.collapse, state.collapsed);
    });

    for (const button of els.modeButtons) {
      button.addEventListener("click", async () => {
        const nextMode = normalizeMode(button.dataset.mode, MODE_CATALOG);
        await setMode(nextMode, true);
      });
    }

    els.guide.refresh.addEventListener("click", async () => {
      await ensureGuideData(true);
    });
    els.guide.query.addEventListener("input", () => {
      state.guide.filters.query = normalizeText(els.guide.query.value, "");
      persistGuideFilters();
      if (state.guide.queryTimerId) {
        window.clearTimeout(state.guide.queryTimerId);
        state.guide.queryTimerId = 0;
      }
      state.guide.queryTimerId = window.setTimeout(() => {
        state.guide.queryTimerId = 0;
        renderGuideCards();
      }, SOCIAL_GUIDE_QUERY_DEBOUNCE_MS);
    });
    for (const button of els.guide.curatedButtons) {
      button.addEventListener("click", () => {
        state.guide.filters.curated = normalizeText(button.dataset.curated, "top");
        persistGuideFilters();
        syncCuratedButtons();
        renderGuideCards();
      });
    }
    els.guide.list.addEventListener("click", (event) => {
      const target = event.target instanceof Element
        ? event.target.closest("button[data-place-id]")
        : null;
      if (!(target instanceof HTMLButtonElement)) {
        return;
      }
      const placeId = normalizeText(target.dataset.placeId, "");
      if (!placeId) {
        return;
      }
      window.dispatchEvent(new CustomEvent("worldatlas:travel-hub-select-place", { detail: { placeId } }));
    });
    els.guide.list.addEventListener("scroll", onGuideListScroll, { passive: true });

    els.planner.actBuild.addEventListener("click", () => els.route.build?.click());
    els.planner.actClear.addEventListener("click", () => {
      els.route.clear?.click();
      renderPlannerSnapshot();
      setPlannerStatus("Route cleared.", "success");
    });
    els.planner.actSave.addEventListener("click", async () => {
      await saveCurrentPlan();
    });
    els.planner.actReload.addEventListener("click", async () => {
      await loadPlannerPlans(true);
    });
    els.planner.saved.addEventListener("click", async (event) => {
      const button = event.target instanceof Element
        ? event.target.closest("button[data-plan-id][data-action]")
        : null;
      if (!(button instanceof HTMLButtonElement)) {
        return;
      }
      const planId = normalizeText(button.dataset.planId, "");
      const action = normalizeText(button.dataset.action, "");
      const plan = state.planner.plans.find((entry) => entry.id === planId);
      if (!plan) {
        return;
      }
      if (action === "apply") {
        await applyPlan(plan);
        return;
      }
      if (action === "delete") {
        await removePlan(plan);
      }
    });
  }

  function attachGlobalEvents() {
    window.addEventListener("worldatlas:map-motion", (event) => {
      const detail = event?.detail;
      if (detail && typeof detail === "object" && "isMoving" in detail) {
        state.guide.mapMotionActive = Boolean(detail.isMoving);
        return;
      }
      state.guide.mapMotionActive = isGuideMapMotionFlagActive();
    });

    window.addEventListener("worldatlas:auth-changed", async (event) => {
      state.session = event?.detail?.session || null;
      state.collapsed = true;
      writeJson(KEYS.collapse, true);
      applyCollapsedState();
      if (state.mode === MODE_GUIDE) {
        await ensureGuideData(true);
      }
      await loadPlannerPlans(true);
    });

    window.addEventListener("worldatlas:favorites-synced", async () => {
      if (!state.guide.places.length) {
        return;
      }
      await refreshGuideMetricsInBackground(true);
    });

    window.addEventListener("worldatlas:route-metrics-updated", () => {
      renderPlannerSnapshot();
    });

    window.addEventListener("storage", (event) => {
      if (!event || typeof event.key !== "string") {
        return;
      }
      if (event.key.startsWith(KEYS.plans)) {
        void loadPlannerPlans(false);
      }
      if (event.key === KEYS.favorites || event.key === KEYS.feedback) {
        void refreshGuideMetricsInBackground(true);
      }
    });
  }

  function onStoreUpdate(snapshot) {
    state.snapshot = snapshot;
    if (state.mode === MODE_GUIDE && toInt(snapshot?.places?.total, 0) > 0) {
      scheduleGuideIdle(() => {
        void prefetchSocialGuide(false);
      });
    }
    const nextMode = normalizeMode(snapshot?.mode, state.mode);
    if (nextMode !== state.mode) {
      void setMode(nextMode, false);
      return;
    }
    if (state.mode === MODE_CATALOG) {
      renderCatalogMetrics();
    }
  }

  async function setMode(nextMode, updateStore) {
    state.mode = normalizeMode(nextMode, MODE_CATALOG);
    if (updateStore && state.store && typeof state.store.setMode === "function") {
      state.store.setMode(state.mode);
    }
    renderModeUi();

    if (state.mode === MODE_CATALOG) {
      renderCatalogMetrics();
      return;
    }

    if (state.mode === MODE_GUIDE) {
      await openSocialGuideTab(false);
      return;
    }

    if (state.mode === MODE_PLANNER) {
      renderPlannerSnapshot();
      await loadPlannerPlans(false);
    }
  }

  function renderModeUi() {
    const meta = MODE_META[state.mode] || MODE_META[MODE_CATALOG];
    els.title.textContent = meta.title;
    els.subtitle.textContent = meta.subtitle;
    els.root.dataset.mode = state.mode;

    for (const button of els.modeButtons) {
      const active = normalizeMode(button.dataset.mode, "") === state.mode;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
    }

    els.metrics.hidden = state.mode !== MODE_CATALOG;
    els.guide.panel.hidden = state.mode !== MODE_GUIDE;
    els.planner.panel.hidden = state.mode !== MODE_PLANNER;
    applyCollapsedState();
  }

  function applyCollapsedState() {
    els.root.classList.toggle("is-collapsed", state.collapsed);
    els.root.classList.toggle("social-guide--collapsed", state.collapsed);
    els.toggle.textContent = state.collapsed ? "+" : "-";
    els.toggle.setAttribute("aria-expanded", String(!state.collapsed));
  }

  function renderCatalogMetrics() {
    const snapshot = state.snapshot || state.store?.getState() || {};
    const places = snapshot.places || {};
    const social = snapshot.social || {};
    const planner = snapshot.planner || {};

    const data = [
      { key: "Places", value: `${formatInt(places.visible)} / ${formatInt(places.total)}` },
      { key: "Regions", value: formatInt(places.regions) },
      { key: "Categories", value: formatInt(places.categories) },
      { key: "Favorites", value: formatInt(social.favorites) },
      { key: "Selected", value: normalizeText(social.selectedPlaceName, "--") },
      { key: "Route", value: `${normalizeText(planner.distanceLabel, "--")} | ${normalizeText(planner.modeLabel, "Car")}` }
    ];

    const fragment = document.createDocumentFragment();
    for (const itemData of data) {
      const item = document.createElement("li");
      item.className = "travel-hub__metric";
      const key = document.createElement("span");
      key.className = "travel-hub__metric-key";
      key.textContent = itemData.key;
      const value = document.createElement("span");
      value.className = "travel-hub__metric-value";
      value.textContent = itemData.value;
      if (itemData.value === "--") {
        value.classList.add("is-weak");
      }
      item.append(key, value);
      fragment.append(item);
    }
    els.metrics.replaceChildren(fragment);
  }

  function restoreGuideFilters() {
    const saved = readJson(KEYS.guide, {});
    if (!saved || typeof saved !== "object") {
      syncCuratedButtons();
      return;
    }
    state.guide.filters.curated = normalizeText(saved.curated, "top");
    state.guide.filters.query = normalizeText(saved.query, "");
    els.guide.query.value = state.guide.filters.query;
    syncCuratedButtons();
  }

  function persistGuideFilters() {
    writeJson(KEYS.guide, {
      curated: state.guide.filters.curated,
      query: state.guide.filters.query
    });
  }

  function syncCuratedButtons() {
    for (const button of els.guide.curatedButtons) {
      const active = normalizeText(button.dataset.curated, "") === state.guide.filters.curated;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    }
  }

  async function ensureGuideData(force) {
    await openSocialGuideTab(force);
  }

  function hasFreshGuideCache(requireComplete) {
    const ageMs = Date.now() - socialGuideCache.ts;
    if (ageMs < 0 || ageMs >= SOCIAL_GUIDE_CACHE_TTL_MS) {
      return false;
    }
    if (!Array.isArray(socialGuideCache.items) || socialGuideCache.items.length === 0) {
      return false;
    }
    if (requireComplete && !socialGuideCache.isComplete) {
      return false;
    }
    return true;
  }

  function applyGuidePlacesSnapshot(items, options = {}) {
    state.guide.places = Array.isArray(items) ? items.slice() : [];
    state.guide.complete = options.complete !== false;
    state.guide.loadedAt = Date.now();
    state.guide.metrics = localGuideMetrics(state.guide.places);
    state.guide.sourceLabel = normalizeText(options.sourceLabel, "Source: local activity");
    fillGuideFiltersFromPlaces();
  }

  function primeSocialGuideDuringBoot() {
    warmupSocialGuide(SOCIAL_GUIDE_WARMUP_COUNT)
      .then((warmItems) => {
        if (!Array.isArray(warmItems) || warmItems.length === 0) {
          return;
        }
        applyGuidePlacesSnapshot(warmItems, {
          complete: false,
          sourceLabel: "Source: local activity"
        });
        renderGuideCards();
      })
      .catch((error) => {
        console.debug("[travel-shell] guide boot warmup failed:", error);
      });

    void prefetchSocialGuide(false)
      .then((items) => {
        if (!Array.isArray(items) || items.length === 0) {
          return;
        }
        const hasChanged = (
          !state.guide.complete ||
          state.guide.places.length !== items.length
        );
        applyGuidePlacesSnapshot(items, {
          complete: true,
          sourceLabel: "Source: local activity"
        });
        if (hasChanged && state.mode === MODE_GUIDE) {
          renderGuideCards();
        }
      })
      .catch((error) => {
        console.debug("[travel-shell] guide boot prefetch failed:", error);
      });
  }

  async function warmupSocialGuide(count = SOCIAL_GUIDE_WARMUP_COUNT) {
    const safeCount = Math.max(1, Math.min(50, toInt(count, SOCIAL_GUIDE_WARMUP_COUNT)));

    if (hasFreshGuideCache(false) && socialGuideCache.items.length >= safeCount) {
      return socialGuideCache.items.slice(0, safeCount);
    }

    if (socialGuideCache.inflight) {
      return socialGuideCache.inflight
        .then((items) => (Array.isArray(items) ? items.slice(0, safeCount) : []))
        .catch(() => []);
    }

    if (socialGuideCache.warmupInflight) {
      return socialGuideCache.warmupInflight;
    }

    socialGuideCache.warmupInflight = fetchGuideWarmupPlaces(safeCount)
      .then((warmup) => {
        const warmItems = Array.isArray(warmup?.items) ? warmup.items.slice(0, safeCount) : [];
        if (warmItems.length === 0) {
          return [];
        }

        socialGuideCache.items = warmItems.slice();
        socialGuideCache.ts = Date.now();
        socialGuideCache.isComplete = warmup?.isComplete === true;
        return socialGuideCache.items.slice();
      })
      .catch((error) => {
        console.debug("[travel-shell] guide warmup failed:", error);
        return [];
      })
      .finally(() => {
        socialGuideCache.warmupInflight = null;
      });

    return socialGuideCache.warmupInflight;
  }

  async function prefetchSocialGuide(force = false) {
    if (!force && hasFreshGuideCache(true)) {
      return socialGuideCache.items.slice();
    }

    if (socialGuideCache.inflight) {
      return socialGuideCache.inflight;
    }

    if (!force && socialGuideCache.warmupInflight) {
      try {
        await socialGuideCache.warmupInflight;
      } catch {}
    }

    if (!force) {
      await waitForGuideFetchBudget();
    }

    socialGuideCache.inflight = fetchGuidePlaces()
      .then((items) => {
        socialGuideCache.items = Array.isArray(items) ? items.slice() : [];
        socialGuideCache.ts = Date.now();
        socialGuideCache.isComplete = true;
        return socialGuideCache.items.slice();
      })
      .catch((error) => {
        if (!hasFreshGuideCache(false)) {
          throw error;
        }
        return socialGuideCache.items.slice();
      })
      .finally(() => {
        socialGuideCache.inflight = null;
      });

    return socialGuideCache.inflight;
  }

  async function openSocialGuideTab(force = false) {
    const now = Date.now();
    const hasFreshState = (
      state.guide.places.length > 0 &&
      (now - state.guide.loadedAt) < SOCIAL_GUIDE_CACHE_TTL_MS
    );
    const hasFreshCompleteCache = hasFreshGuideCache(true);
    const hasWarmCache = hasFreshGuideCache(false) && !socialGuideCache.isComplete;

    if (!force && hasFreshState) {
      renderGuideCards();
      void refreshGuideMetricsInBackground(false);
      if (!state.guide.complete) {
        void prefetchSocialGuide(false)
          .then((payload) => {
            if (!Array.isArray(payload) || payload.length === 0) {
              return;
            }
            const hasChanged = (
              !state.guide.complete ||
              state.guide.places.length !== payload.length
            );
            applyGuidePlacesSnapshot(payload, {
              complete: true,
              sourceLabel: "Source: local activity"
            });
            if (hasChanged && state.mode === MODE_GUIDE) {
              renderGuideCards();
            }
            void refreshGuideMetricsInBackground(false);
          })
          .catch((error) => {
            console.error("[travel-shell] guide background hydrate failed:", error);
          });
      }
      return;
    }

    if (!force && hasFreshCompleteCache) {
      applyGuidePlacesSnapshot(socialGuideCache.items, {
        complete: true,
        sourceLabel: "Source: local activity"
      });
      renderGuideCards();
      void refreshGuideMetricsInBackground(false);
      return;
    }

    if (!force && hasWarmCache) {
      applyGuidePlacesSnapshot(socialGuideCache.items, {
        complete: false,
        sourceLabel: "Source: local activity"
      });
      renderGuideCards();
      void refreshGuideMetricsInBackground(false);
      void prefetchSocialGuide(false)
        .then((payload) => {
          if (!Array.isArray(payload) || payload.length === 0) {
            return;
          }
          applyGuidePlacesSnapshot(payload, {
            complete: true,
            sourceLabel: "Source: local activity"
          });
          if (state.mode === MODE_GUIDE) {
            renderGuideCards();
          }
          void refreshGuideMetricsInBackground(false);
        })
        .catch((error) => {
          console.error("[travel-shell] guide background hydrate failed:", error);
        });
      return;
    }

    if (state.guide.loading) {
      if (state.guide.places.length === 0) {
        renderGuideSkeletonList(8);
      }
      return;
    }

    state.guide.loading = true;
    els.guide.source.textContent = "Loading places...";

    try {
      if (state.guide.places.length === 0) {
        renderGuideSkeletonList(8);
      }

      const payload = await prefetchSocialGuide(force);
      applyGuidePlacesSnapshot(payload, {
        complete: true,
        sourceLabel: "Source: local activity"
      });
      renderGuideCards();
      void refreshGuideMetricsInBackground(force);
    } catch (error) {
      console.error("[travel-shell] guide load failed:", error);
      renderGuideEmpty("Guide data is unavailable.");
    } finally {
      state.guide.loading = false;
    }
  }

  async function fetchGuideWarmupPlaces(limit) {
    const safeLimit = clamp(toInt(limit, SOCIAL_GUIDE_WARMUP_COUNT), 1, 50);
    let apiError = null;

    try {
      const page = await fetchGuidePlacesApiPage(0, safeLimit);
      if (page.items.length > 0) {
        return {
          items: page.items.slice(0, safeLimit),
          isComplete: page.total <= page.items.length
        };
      }
    } catch (error) {
      apiError = error;
    }

    try {
      const staticItems = await fetchGuidePlacesFromStaticSources();
      const warmItems = staticItems.slice(0, safeLimit);
      return {
        items: warmItems,
        isComplete: staticItems.length <= warmItems.length
      };
    } catch (error) {
      throw error || apiError || new Error("Guide warmup source is unavailable.");
    }
  }

  async function fetchGuidePlaces() {
    let apiError = null;
    try {
      const apiItems = await fetchGuidePlacesFromApi();
      if (apiItems.length > 0) {
        return apiItems;
      }
    } catch (error) {
      apiError = error;
    }

    let staticError = null;
    try {
      const staticItems = await fetchGuidePlacesFromStaticSources();
      if (staticItems.length > 0) {
        return staticItems;
      }
    } catch (error) {
      staticError = error;
    }

    throw staticError || apiError || new Error("Guide places source is unavailable.");
  }

  async function fetchGuidePlacesFromApi() {
    const mergedByKey = new Map();
    const firstPage = await fetchGuidePlacesApiPage(0, SOCIAL_GUIDE_FETCH_PAGE_SIZE);
    if (firstPage.items.length === 0) {
      return [];
    }

    mergeGuidePlacesIntoMap(mergedByKey, firstPage.items);
    let total = Math.max(firstPage.total, firstPage.items.length);
    let offset = firstPage.items.length;

    while (offset < total) {
      await waitForGuideFetchBudget();
      await sleep(SOCIAL_GUIDE_FETCH_BATCH_DELAY_MS);
      const page = await fetchGuidePlacesApiPage(offset, SOCIAL_GUIDE_FETCH_PAGE_SIZE);
      if (page.items.length === 0) {
        break;
      }
      mergeGuidePlacesIntoMap(mergedByKey, page.items);
      offset += page.items.length;
      total = Math.max(total, page.total, offset);
    }

    return Array.from(mergedByKey.values());
  }

  async function fetchGuidePlacesApiPage(offset, limit) {
    const safeLimit = clamp(toInt(limit, SOCIAL_GUIDE_FETCH_PAGE_SIZE), 1, 800);
    const safeOffset = Math.max(0, toInt(offset, 0));
    const params = new URLSearchParams();
    params.set("limit", String(safeLimit));
    params.set("offset", String(safeOffset));
    params.set("sortBy", "updated");
    params.set("order", "desc");

    const response = await fetch(`/api/places?${params.toString()}`, {
      headers: { Accept: "application/json" },
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`Guide API failed: HTTP ${response.status}`);
    }

    const payload = await response.json();
    const rawItems = Array.isArray(payload?.items) ? payload.items : [];
    const mapped = rawItems
      .map((item) => normalizePlace(item))
      .filter(Boolean);
    const total = Math.max(
      mapped.length + safeOffset,
      toInt(payload?.total, mapped.length + safeOffset)
    );

    return { items: mapped, total };
  }

  async function fetchGuidePlacesFromStaticSources() {
    const urls = ["/places.json", "./places.json"];
    let lastError = null;

    for (const url of urls) {
      try {
        const response = await fetch(url, {
          headers: { Accept: "application/json" },
          cache: "no-store"
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const payload = await response.json();
        const rawItems = Array.isArray(payload)
          ? payload
          : (Array.isArray(payload?.items) ? payload.items : []);

        const mapped = rawItems
          .map((item) => normalizePlace(item))
          .filter(Boolean);
        if (mapped.length > 0) {
          const mergedByKey = new Map();
          mergeGuidePlacesIntoMap(mergedByKey, mapped);
          return Array.from(mergedByKey.values());
        }
      } catch (error) {
        lastError = error;
      }
    }

    if (lastError) {
      throw lastError;
    }
    return [];
  }

  function mergeGuidePlacesIntoMap(targetMap, places) {
    if (!(targetMap instanceof Map) || !Array.isArray(places)) {
      return;
    }

    for (const place of places) {
      const dedupeKey = createGuidePlaceDedupeKey(place);
      if (!dedupeKey) {
        continue;
      }
      const existing = targetMap.get(dedupeKey);
      targetMap.set(dedupeKey, mergeGuidePlace(existing, place));
    }
  }

  async function refreshGuideMetrics() {
    const localMetrics = localGuideMetrics(state.guide.places);
    const remote = await fetchGuideMetricsFromSupabase(state.guide.places.map((place) => place.id));
    if (!remote) {
      state.guide.metrics = localMetrics;
      state.guide.sourceLabel = "Source: local activity";
      return;
    }
    const merged = new Map(localMetrics);
    for (const [placeId, metric] of remote.map.entries()) {
      merged.set(placeId, { ...merged.get(placeId), ...metric });
    }
    state.guide.metrics = merged;
    state.guide.sourceLabel = remote.source;
  }

  function refreshGuideMetricsInBackground(force = false) {
    if (!force && state.guide.metricsInflight) {
      return state.guide.metricsInflight;
    }
    if (!force && state.guide.places.length === 0) {
      return Promise.resolve();
    }

    state.guide.metricsInflight = refreshGuideMetrics()
      .then(() => {
        if (state.mode === MODE_GUIDE) {
          els.guide.source.textContent = state.guide.sourceLabel;
          patchVisibleGuideMetricBadges();
        }
      })
      .catch((error) => {
        console.error("[travel-shell] guide metrics refresh failed:", error);
      })
      .finally(() => {
        state.guide.metricsInflight = null;
      });

    return state.guide.metricsInflight;
  }

  function patchVisibleGuideMetricBadges() {
    const list = els.guide.list;
    if (!(list instanceof HTMLElement)) {
      return;
    }

    const placeById = new Map();
    for (const place of state.guide.places) {
      placeById.set(place.id, place);
    }

    const cards = list.querySelectorAll("button.travel-guide__card[data-place-id]");
    for (const card of cards) {
      if (!(card instanceof HTMLButtonElement)) {
        continue;
      }
      const placeId = normalizeText(card.dataset.placeId, "");
      if (!placeId) {
        continue;
      }
      const metrics = state.guide.metrics.get(placeId) || { ratingAvg: 0, ratingCount: 0, favoritesCount: 0 };
      const place = placeById.get(placeId);
      const badges = card.querySelectorAll(".travel-guide__meta .travel-guide__badge");

      if (badges[0] instanceof HTMLElement) {
        badges[0].textContent = `* ${formatFloat(metrics.ratingAvg, 1)} (${formatInt(metrics.ratingCount)})`;
      }
      if (badges[1] instanceof HTMLElement) {
        badges[1].textContent = `fav ${formatInt(metrics.favoritesCount)}`;
      }
      if (badges[2] instanceof HTMLElement) {
        badges[2].textContent = normalizeText(place?.category, "General");
      }
    }
  }

  function localGuideMetrics(places) {
    const result = new Map();
    const favorites = readStringSet(KEYS.favorites);
    const feedback = readJson(KEYS.feedback, {});
    const reviews = feedback?.reviews && typeof feedback.reviews === "object" ? feedback.reviews : {};

    for (const place of places) {
      const placeReviews = Array.isArray(reviews[place.id])
        ? reviews[place.id]
          .map((entry) => Number(entry?.rating))
          .filter((rating) => Number.isFinite(rating) && rating > 0)
        : [];
      const count = placeReviews.length;
      const avg = count > 0
        ? placeReviews.reduce((acc, value) => acc + value, 0) / count
        : 0;
      result.set(place.id, {
        ratingAvg: avg,
        ratingCount: count,
        favoritesCount: favorites.has(place.id) ? 1 : 0
      });
    }
    return result;
  }

  async function fetchGuideMetricsFromSupabase(placeIds) {
    if (!ENABLE_REMOTE_GUIDE_METRICS) {
      return null;
    }

    if (!Array.isArray(placeIds) || placeIds.length === 0) {
      return null;
    }

    const remotePlaceIds = Array.from(new Set(
      placeIds
        .map((placeId) => normalizeText(placeId, ""))
        .filter(isUuidText)
    ));
    if (remotePlaceIds.length === 0) {
      return null;
    }

    const client = await waitForSupabaseClient(4000);
    if (!client) {
      return null;
    }

    const viewRows = await loadMetricsFromView(client, remotePlaceIds);
    if (viewRows instanceof Map) {
      return {
        map: viewRows,
        source: viewRows.size > 0
          ? "Source: Supabase aggregate view"
          : "Source: local activity"
      };
    }

    const rpcRows = await loadMetricsFromRpc(client, remotePlaceIds);
    if (rpcRows) {
      return { map: rpcRows, source: "Source: Supabase aggregate RPC" };
    }

    return null;
  }

  function isUuidText(value) {
    return UUID_PATTERN.test(normalizeText(value, ""));
  }

  async function loadMetricsFromView(client, placeIds) {
    const viewCandidates = [
      {
        name: "place_reviews_summary",
        select: "place_id,avg_rating,reviews_count"
      },
      {
        name: "place_metrics_public",
        select: "place_id,avg_rating,reviews_count,favorites_count"
      }
    ];

    for (const candidate of viewCandidates) {
      const mapped = new Map();
      let failed = false;

      for (const idsChunk of chunk(placeIds, 300)) {
        const { data, error, status } = await client
          .from(candidate.name)
          .select(candidate.select)
          .in("place_id", idsChunk);

        if (error) {
          failed = true;
          console.error(
            `[travel-shell] Supabase query failed for ${candidate.name}: ${formatSupabaseErrorMessage(error, status, "View query failed.")}`
          );
          break;
        }

        for (const row of Array.isArray(data) ? data : []) {
          const placeId = normalizeText(row?.place_id, "");
          if (!placeId) {
            continue;
          }
          mapped.set(placeId, {
            ratingAvg: clamp(toNumber(row?.avg_rating, 0), 0, 5),
            ratingCount: Math.max(0, toInt(row?.reviews_count, 0)),
            favoritesCount: Math.max(0, toInt(row?.favorites_count, 0))
          });
        }
      }

      if (!failed && mapped.size > 0) {
        return mapped;
      }
      if (!failed) {
        return mapped;
      }
    }

    return null;
  }

  async function loadMetricsFromRpc(client, placeIds) {
    const candidates = [
      { fn: "guide_place_metrics", args: { place_ids: placeIds } },
      { fn: "get_place_metrics", args: { place_ids: placeIds } },
      { fn: "guide_place_metrics", args: { ids: placeIds } }
    ];

    for (const entry of candidates) {
      try {
        const { data, error, status } = await client.rpc(entry.fn, entry.args);
        if (error) {
          console.error(
            `[travel-shell] Supabase RPC failed for ${entry.fn}: ${formatSupabaseErrorMessage(error, status, "RPC query failed.")}`
          );
          continue;
        }
        const rows = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);
        const mapped = new Map();
        for (const row of rows) {
          const placeId = normalizeText(row?.place_id ?? row?.id, "");
          if (!placeId) {
            continue;
          }
          mapped.set(placeId, {
            ratingAvg: clamp(toNumber(row?.avg_rating ?? row?.rating_avg, 0), 0, 5),
            ratingCount: Math.max(0, toInt(row?.reviews_count ?? row?.rating_count, 0)),
            favoritesCount: Math.max(0, toInt(row?.favorites_count ?? row?.favorites, 0))
          });
        }
        if (mapped.size > 0) {
          return mapped;
        }
      } catch (error) {
        console.error("[travel-shell] Supabase RPC threw exception:", error);
        continue;
      }
    }

    return null;
  }

  function formatSupabaseErrorMessage(error, statusHint, fallbackMessage) {
    const message = normalizeText(error?.message, fallbackMessage);
    const code = normalizeText(error?.code, "");
    const details = normalizeText(error?.details, "");
    const hint = normalizeText(error?.hint, "");
    const statusRaw = Number(error?.status ?? statusHint);
    const status = Number.isFinite(statusRaw) ? statusRaw : null;
    const prefix = [];

    if (status !== null) {
      prefix.push(`status ${status}`);
    }
    if (code) {
      prefix.push(code);
    }

    let result = prefix.length > 0
      ? `[${prefix.join(", ")}] ${message}`
      : message;
    if (details) {
      result += ` (${details})`;
    }
    if (hint) {
      result += ` Hint: ${hint}`;
    }
    return result;
  }

  function handlePlannerRemoteSupabaseError(error, statusHint, source) {
    const message = formatSupabaseErrorMessage(
      error,
      statusHint,
      "Trip planner Supabase request failed."
    );
    console.error(`[travel-shell] ${source}: ${message}`, error);

    if (!isTripPlansTableMissing(error, statusHint)) {
      return;
    }

    if (!state.planner.remoteAvailable) {
      return;
    }

    state.planner.remoteAvailable = false;
    state.planner.remoteError = message;
    setPlannerStatus(
      `Supabase planner storage is unavailable. Using local plans only. ${message}`,
      "error"
    );
  }

  function isTripPlansTableMissing(error, statusHint) {
    const code = normalizeText(error?.code, "").toUpperCase();
    const message = normalizeText(error?.message, "").toLowerCase();
    const details = normalizeText(error?.details, "").toLowerCase();
    const hint = normalizeText(error?.hint, "").toLowerCase();
    const statusRaw = Number(error?.status ?? statusHint);
    const status = Number.isFinite(statusRaw) ? statusRaw : null;

    if (code === "42P01" || code === "PGRST205") {
      return true;
    }

    if (status === 404) {
      const fullText = `${message} ${details} ${hint}`;
      if (fullText.includes("trip_plans")) {
        return true;
      }
    }

    return (
      (message.includes("relation") && message.includes("trip_plans")) ||
      (message.includes("could not find the table") && message.includes("trip_plans")) ||
      (message.includes("schema cache") && message.includes("trip_plans"))
    );
  }

  function fillGuideFiltersFromPlaces() {
    // Guide uses a lightweight search-only filter UI.
  }

  function renderGuideCards() {
    const filtered = getFilteredGuidePlaces();
    const sorted = sortGuidePlaces(filtered);
    const total = state.guide.places.length;
    els.guide.source.textContent = state.guide.sourceLabel;
    els.guide.counter.textContent = `${filtered.length} / ${total}`;

    if (sorted.length === 0) {
      renderGuideEmpty("No places found for selected filters.");
      return;
    }

    renderSocialGuideChunks(sorted);
  }

  function renderSocialGuideChunks(items) {
    const list = els.guide.list;
    if (!(list instanceof HTMLElement)) {
      return;
    }

    const safeItems = Array.isArray(items) ? items : [];
    const renderToken = state.guide.renderToken + 1;
    state.guide.renderToken = renderToken;
    state.guide.appendToken = renderToken;
    state.guide.renderItems = safeItems;
    state.guide.renderedCount = 0;
    cancelGuideAppendWork();
    resetGuideImagePipeline(null);
    list.scrollTop = 0;
    renderGuideVirtualWindow(renderToken, 0);
  }

  function renderGuideVirtualWindow(renderToken, requestedStart) {
    if (state.guide.appendToken !== renderToken) {
      return;
    }

    const list = els.guide.list;
    if (!(list instanceof HTMLElement)) {
      return;
    }

    const total = state.guide.renderItems.length;
    if (total === 0) {
      list.replaceChildren();
      state.guide.renderedCount = 0;
      return;
    }

    const rowHeight = getGuideEstimatedRowHeight();
    const visibleRows = Math.max(
      SOCIAL_GUIDE_INITIAL_CHUNK,
      Math.ceil(Math.max(1, list.clientHeight) / rowHeight) + (SOCIAL_GUIDE_OVERSCAN_ITEMS * 2)
    );
    const windowSize = Math.min(SOCIAL_GUIDE_MAX_DOM_ITEMS, visibleRows, total);
    const scrollStart = Math.floor(Math.max(0, list.scrollTop) / rowHeight) - SOCIAL_GUIDE_OVERSCAN_ITEMS;
    const start = clamp(
      Number.isFinite(requestedStart) ? requestedStart : scrollStart,
      0,
      Math.max(0, total - windowSize)
    );
    const end = Math.min(total, start + windowSize);
    const visibleItems = state.guide.renderItems.slice(start, end);
    const fragment = document.createDocumentFragment();
    const chunkImages = [];
    const topHeight = Math.max(0, start * rowHeight);
    const bottomHeight = Math.max(0, (total - end) * rowHeight);

    if (topHeight > 0) {
      fragment.append(createGuideVirtualSpacer(topHeight, "top"));
    }

    for (const place of visibleItems) {
      const item = createGuideCardItem(place, false);
      const image = item.querySelector("img.travel-guide__image[data-guide-image-state='idle']");
      if (image instanceof HTMLImageElement) {
        chunkImages.push(image);
      }
      fragment.append(item);
    }

    if (bottomHeight > 0) {
      fragment.append(createGuideVirtualSpacer(bottomHeight, "bottom"));
    }

    resetGuideImagePipeline(list);
    list.replaceChildren(fragment);
    state.guide.renderedCount = visibleItems.length;
    observeGuideImages(chunkImages, list);
  }

  function getGuideEstimatedRowHeight() {
    const firstItem = els.guide.list?.querySelector?.(".travel-guide__item");
    if (firstItem instanceof HTMLElement) {
      const rect = firstItem.getBoundingClientRect();
      if (rect.height > 24) {
        return clamp(Math.round(rect.height + 7), 72, 132);
      }
    }
    return SOCIAL_GUIDE_ROW_HEIGHT_ESTIMATE_PX;
  }

  function createGuideVirtualSpacer(heightPx, position) {
    const item = document.createElement("li");
    item.className = "travel-guide__virtual-spacer";
    item.dataset.position = position;
    item.style.height = `${Math.max(0, Math.round(heightPx))}px`;
    item.setAttribute("aria-hidden", "true");
    return item;
  }

  function cancelGuideAppendWork() {
    if (state.guide.scrollRafId) {
      window.cancelAnimationFrame(state.guide.scrollRafId);
      state.guide.scrollRafId = 0;
    }
  }

  function onGuideListScroll() {
    state.guide.imageLastUiMotionAt = Date.now();
    scheduleGuideImagePump(SOCIAL_GUIDE_IMAGE_SCROLL_IDLE_MS);

    if (state.guide.scrollRafId) {
      return;
    }

    state.guide.scrollRafId = window.requestAnimationFrame(() => {
      state.guide.scrollRafId = 0;
      if (isMapMotionActive()) {
        return;
      }
      renderGuideVirtualWindow(state.guide.renderToken);
    });
  }

  function createGuideCardItem(place, withEnterAnimation) {
    const item = document.createElement("li");
    item.className = withEnterAnimation ? "travel-guide__item is-enter" : "travel-guide__item";

    const card = createButton("travel-guide__card", "");
    card.dataset.placeId = place.id;
    card.setAttribute("aria-label", `Open ${place.name} on map`);

    const media = document.createElement("div");
    media.className = "travel-guide__media";
    const imageUrl = resolveGuideCardImage(place);
    const placeholder = createGuideImagePlaceholder({
      loading: Boolean(imageUrl),
      label: imageUrl ? "Loading image" : "No image"
    });

    if (imageUrl) {
      const image = document.createElement("img");
      image.className = "travel-guide__image is-loading";
      image.alt = `Photo: ${place.name}`;
      image.loading = "lazy";
      image.decoding = "async";
      image.fetchPriority = "low";
      image.referrerPolicy = "no-referrer";
      image.width = 70;
      image.height = 70;
      image.style.aspectRatio = "1 / 1";
      image.dataset.src = imageUrl;
      image.dataset.guideImageState = "idle";
      image.dataset.guideImageObserved = "0";

      media.append(placeholder, image);
    } else {
      placeholder.classList.add("travel-guide__image-placeholder--fallback");
      media.append(placeholder);
    }

    const body = document.createElement("div");
    body.className = "travel-guide__body";
    const title = document.createElement("h3");
    title.className = "travel-guide__card-title";
    title.textContent = place.name;
    const subtitle = document.createElement("p");
    subtitle.className = "travel-guide__card-subtitle";
    subtitle.textContent = join([place.region, place.country], " | ");
    const meta = document.createElement("div");
    meta.className = "travel-guide__meta";
    meta.append(
      guideTag(`* ${formatFloat(place.metrics.ratingAvg, 1)} (${formatInt(place.metrics.ratingCount)})`, "travel-guide__badge"),
      guideTag(`fav ${formatInt(place.metrics.favoritesCount)}`, "travel-guide__badge"),
      guideTag(place.category || "General", "travel-guide__badge")
    );
    const tags = document.createElement("div");
    tags.className = "travel-guide__tags";
    for (const tagText of place.tags.slice(0, 3)) {
      tags.append(guideTag(tagText, "travel-guide__tag"));
    }
    if (place.isFree) {
      tags.append(guideTag("Free", "travel-guide__flag"));
    }
    if (place.isFamily) {
      tags.append(guideTag("Family", "travel-guide__flag"));
    }
    body.append(title, subtitle, meta, tags);

    card.append(media, body);
    item.append(card);

    if (withEnterAnimation) {
      window.setTimeout(() => item.classList.remove("is-enter"), 260);
    }

    return item;
  }

  function resetGuideImagePipeline(root) {
    if (state.guide.imageObserver) {
      state.guide.imageObserver.disconnect();
      state.guide.imageObserver = null;
      state.guide.imageObserverRoot = null;
    }

    if (state.guide.imagePumpTimerId) {
      window.clearTimeout(state.guide.imagePumpTimerId);
      state.guide.imagePumpTimerId = 0;
    }

    state.guide.imageQueue.length = 0;
    state.guide.imageQueued.clear();
    state.guide.imageInFlight = 0;

    if (root instanceof HTMLElement) {
      ensureGuideImageObserver(root);
    }
  }

  function ensureGuideImageObserver(root) {
    if (!(root instanceof HTMLElement)) {
      return null;
    }

    if (typeof window.IntersectionObserver !== "function") {
      return null;
    }

    if (
      state.guide.imageObserver &&
      state.guide.imageObserverRoot === root
    ) {
      return state.guide.imageObserver;
    }

    if (state.guide.imageObserver) {
      state.guide.imageObserver.disconnect();
    }

    state.guide.imageObserver = new IntersectionObserver(
      (entries, observer) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            continue;
          }

          const image = entry.target;
          if (!(image instanceof HTMLImageElement)) {
            continue;
          }

          observer.unobserve(image);
          image.dataset.guideImageObserved = "0";
          enqueueGuideImage(image);
        }
      },
      {
        root,
        rootMargin: SOCIAL_GUIDE_IMAGE_ROOT_MARGIN,
        threshold: SOCIAL_GUIDE_IMAGE_OBSERVER_THRESHOLD
      }
    );
    state.guide.imageObserverRoot = root;
    return state.guide.imageObserver;
  }

  function observeGuideImages(images, root) {
    if (!(root instanceof HTMLElement) || !Array.isArray(images) || images.length === 0) {
      return;
    }

    const observer = ensureGuideImageObserver(root);
    for (const image of images) {
      if (!(image instanceof HTMLImageElement)) {
        continue;
      }

      if (normalizeText(image.dataset.guideImageState, "idle") !== "idle") {
        continue;
      }

      if (observer) {
        if (image.dataset.guideImageObserved === "1") {
          continue;
        }
        image.dataset.guideImageObserved = "1";
        observer.observe(image);
        continue;
      }

      enqueueGuideImage(image);
    }

    if (!observer) {
      pumpGuideImageQueue();
    }
  }

  function enqueueGuideImage(image) {
    if (!(image instanceof HTMLImageElement)) {
      return;
    }

    const currentState = normalizeText(image.dataset.guideImageState, "idle");
    if (
      currentState === "queued" ||
      currentState === "loading" ||
      currentState === "loaded" ||
      currentState === "error"
    ) {
      return;
    }

    if (state.guide.imageQueued.has(image)) {
      return;
    }

    image.dataset.guideImageState = "queued";
    state.guide.imageQueue.push(image);
    state.guide.imageQueued.add(image);
    logGuideImageQueueState();
    pumpGuideImageQueue();
  }

  function scheduleGuideImagePump(delayMs = 0) {
    if (state.guide.imagePumpTimerId) {
      return;
    }
    const delay = Math.max(0, toInt(delayMs, 0));
    state.guide.imagePumpTimerId = window.setTimeout(() => {
      state.guide.imagePumpTimerId = 0;
      pumpGuideImageQueue();
    }, delay);
  }

  function pumpGuideImageQueue() {
    if (isMapMotionActive()) {
      scheduleGuideImagePump(SOCIAL_GUIDE_IMAGE_LOAD_DELAY_MS);
      return;
    }

    const recentUiMotionMs = Date.now() - toInt(state.guide.imageLastUiMotionAt, 0);
    if (recentUiMotionMs < SOCIAL_GUIDE_IMAGE_SCROLL_IDLE_MS) {
      scheduleGuideImagePump(SOCIAL_GUIDE_IMAGE_SCROLL_IDLE_MS - recentUiMotionMs);
      return;
    }

    while (
      state.guide.imageInFlight < SOCIAL_GUIDE_IMAGE_CONCURRENCY &&
      state.guide.imageQueue.length > 0
    ) {
      const image = state.guide.imageQueue.shift();
      state.guide.imageQueued.delete(image);
      if (!(image instanceof HTMLImageElement) || !image.isConnected) {
        continue;
      }

      const imageUrl = normalizeHttp(image.dataset.src);
      if (!imageUrl) {
        handleGuideImageError(image, null, "invalid-src");
        continue;
      }

      if (state.guide.imageFailedUrls.has(imageUrl)) {
        handleGuideImageError(image, null, "cached-failure");
        continue;
      }

      state.guide.imageInFlight += 1;
      image.dataset.guideImageState = "loading";
      const placeholder = resolveGuideImagePlaceholder(image);

      applyGuideImageSrc(image, imageUrl, placeholder)
        .finally(() => {
          state.guide.imageInFlight = Math.max(0, state.guide.imageInFlight - 1);
          logGuideImageQueueState();
          scheduleGuideImagePump(SOCIAL_GUIDE_IMAGE_LOAD_DELAY_MS);
        });
    }
  }

  function applyGuideImageSrc(image, imageUrl, placeholder) {
    return new Promise((resolve) => {
      if (!(image instanceof HTMLImageElement) || !image.isConnected) {
        resolve();
        return;
      }

      if (normalizeText(image.dataset.guideImageState, "") === "loaded") {
        resolve();
        return;
      }

      const safeUrl = normalizeHttp(imageUrl);
      if (!safeUrl) {
        handleGuideImageError(image, placeholder, "invalid-src-apply");
        resolve();
        return;
      }

      let settled = false;
      const finish = () => {
        if (settled) {
          return;
        }
        settled = true;
        image.removeEventListener("load", onLoad);
        image.removeEventListener("error", onError);
        resolve();
      };
      const onLoad = () => {
        handleGuideImageLoad(image, placeholder);
        finish();
      };
      const onError = () => {
        handleGuideImageError(image, placeholder, "element-error");
        finish();
      };

      image.addEventListener("load", onLoad, { once: true });
      image.addEventListener("error", onError, { once: true });
      image.dataset.guideImageState = "loading";
      image.classList.add("is-loading");
      image.src = safeUrl;

      if (image.complete) {
        if (image.naturalWidth > 0) {
          onLoad();
          return;
        }
        onError();
      }
    });
  }

  function resolveGuideImagePlaceholder(image) {
    if (!(image instanceof HTMLImageElement)) {
      return null;
    }

    const media = image.closest(".travel-guide__media");
    if (!(media instanceof HTMLElement)) {
      return null;
    }

    const placeholder = media.querySelector(".travel-guide__image-placeholder");
    return placeholder instanceof HTMLElement ? placeholder : null;
  }

  function handleGuideImageLoad(image, placeholder) {
    if (!(image instanceof HTMLImageElement)) {
      return;
    }

    if (normalizeText(image.dataset.guideImageState, "") === "loaded") {
      return;
    }

    const safeUrl = normalizeHttp(image.currentSrc || image.src || image.dataset.src);
    if (safeUrl) {
      state.guide.imageLoadedUrls.add(safeUrl);
      state.guide.imageFailedUrls.delete(safeUrl);
    }

    image.dataset.guideImageState = "loaded";
    image.classList.remove("is-loading");

    const resolvedPlaceholder = placeholder instanceof HTMLElement
      ? placeholder
      : resolveGuideImagePlaceholder(image);
    if (resolvedPlaceholder) {
      resolvedPlaceholder.classList.add("is-hidden");
      resolvedPlaceholder.classList.remove("is-skeleton");
    }
  }

  function handleGuideImageError(image, placeholder, reason = "") {
    if (!(image instanceof HTMLImageElement)) {
      return;
    }

    if (normalizeText(image.dataset.guideImageState, "") === "error") {
      return;
    }

    const safeUrl = normalizeHttp(image.dataset.src || image.currentSrc || image.src);
    if (safeUrl) {
      state.guide.imageFailedUrls.add(safeUrl);
    }

    image.dataset.guideImageState = "error";
    image.classList.remove("is-loading");
    if (image.isConnected) {
      image.remove();
    }

    const resolvedPlaceholder = placeholder instanceof HTMLElement
      ? placeholder
      : resolveGuideImagePlaceholder(image);
    if (resolvedPlaceholder) {
      resolvedPlaceholder.classList.remove("is-hidden", "is-skeleton");
      resolvedPlaceholder.classList.add("travel-guide__image-placeholder--fallback");
      const label = resolvedPlaceholder.querySelector(".travel-guide__image-placeholder-label");
      if (label instanceof HTMLElement) {
        label.textContent = "No image";
      }
    }

    if (window.WORLDATLAS_DEBUG_GUIDE_IMAGES === true) {
      console.debug(
        `[travel-shell][guide-images] load-error url=${safeUrl || "unknown"} reason=${normalizeText(reason, "unknown")}`
      );
    }
  }

  function logGuideImageQueueState() {
    if (window.WORLDATLAS_DEBUG_GUIDE_IMAGES !== true) {
      return;
    }
    console.debug(
      `[travel-shell][guide-images] queue=${state.guide.imageQueue.length} inflight=${state.guide.imageInFlight}`
    );
  }

  function scheduleGuideIdle(callback) {
    if (typeof callback !== "function") {
      return;
    }
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(() => {
        callback();
      }, { timeout: 120 });
      return;
    }
    window.setTimeout(() => {
      callback();
    }, 0);
  }

  function scheduleGuideIdlePromise() {
    return new Promise((resolve) => {
      scheduleGuideIdle(resolve);
    });
  }

  function isGuideMapMotionFlagActive() {
    const root = els.root instanceof HTMLElement
      ? els.root
      : document.getElementById("travel-hub");
    return Boolean(root instanceof HTMLElement && root.dataset.mapMotion === "1");
  }

  function isMapMotionActive() {
    if (state.guide.mapMotionActive) {
      return true;
    }
    const nextState = isGuideMapMotionFlagActive();
    state.guide.mapMotionActive = nextState;
    return nextState;
  }

  async function waitForGuideFetchBudget() {
    let elapsed = 0;
    while (isMapMotionActive() && elapsed < SOCIAL_GUIDE_FETCH_MOTION_PAUSE_MAX_MS) {
      await sleep(SOCIAL_GUIDE_FETCH_MOTION_PAUSE_MS);
      elapsed += SOCIAL_GUIDE_FETCH_MOTION_PAUSE_MS;
    }
    await scheduleGuideIdlePromise();
  }

  function renderGuideSkeletonList(count) {
    cancelGuideAppendWork();
    resetGuideImagePipeline(null);
    state.guide.renderItems = [];
    state.guide.renderedCount = 0;
    state.guide.appendToken = state.guide.renderToken + 1;
    const total = state.guide.places.length > 0 ? state.guide.places.length : 52;
    const safeCount = Math.max(4, Math.min(12, toInt(count, 8)));
    const fragment = document.createDocumentFragment();

    for (let index = 0; index < safeCount; index += 1) {
      const item = document.createElement("li");
      item.className = "travel-guide__item travel-guide__item--skeleton";

      const card = document.createElement("div");
      card.className = "travel-guide__card travel-guide__card--skeleton";

      const media = document.createElement("div");
      media.className = "travel-guide__media";
      const mediaSkeleton = document.createElement("span");
      mediaSkeleton.className = "travel-guide__image-placeholder is-skeleton";
      mediaSkeleton.textContent = "";
      media.append(mediaSkeleton);

      const body = document.createElement("div");
      body.className = "travel-guide__body";
      const lineA = document.createElement("span");
      lineA.className = "travel-guide__skeleton-line";
      const lineB = document.createElement("span");
      lineB.className = "travel-guide__skeleton-line travel-guide__skeleton-line--short";
      const lineC = document.createElement("span");
      lineC.className = "travel-guide__skeleton-line travel-guide__skeleton-line--tiny";
      body.append(lineA, lineB, lineC);

      card.append(media, body);
      item.append(card);
      fragment.append(item);
    }

    els.guide.list.replaceChildren(fragment);
    els.guide.counter.textContent = `0 / ${total}`;
  }

  function renderGuideEmpty(message) {
    cancelGuideAppendWork();
    resetGuideImagePipeline(null);
    state.guide.renderItems = [];
    state.guide.renderedCount = 0;
    state.guide.appendToken = state.guide.renderToken + 1;
    const item = document.createElement("li");
    item.className = "travel-guide__empty";
    const title = document.createElement("strong");
    title.textContent = "No places found";
    const text = document.createElement("span");
    text.textContent = message;
    item.append(title, text);
    els.guide.list.replaceChildren(item);
    els.guide.counter.textContent = `0 / ${state.guide.places.length}`;
  }

  function getFilteredGuidePlaces() {
    const tokens = normalizeText(state.guide.filters.query, "")
      .toLowerCase()
      .split(/[\s,]+/)
      .map((token) => token.trim())
      .filter(Boolean);

    return state.guide.places
      .map((place) => {
        const metrics = state.guide.metrics.get(place.id) || { ratingAvg: 0, ratingCount: 0, favoritesCount: 0 };
        const tags = place.tags.map((entry) => entry.toLowerCase());
        return {
          ...place,
          metrics,
          isFree: tags.includes("free") || tags.includes("budget"),
          isFamily: tags.includes("family") || tags.includes("kids") || tags.includes("family-friendly")
        };
      })
      .filter((place) => {
        if (tokens.length === 0) {
          return true;
        }
        const haystack = [place.name, place.region, place.country, place.category, place.description, ...place.tags]
          .join(" ")
          .toLowerCase();
        return tokens.every((token) => haystack.includes(token));
      });
  }

  function sortGuidePlaces(places) {
    const curated = normalizeText(state.guide.filters.curated, "top");
    const sorted = places.slice();
    if (curated === "popular") {
      sorted.sort((a, b) => (
        (b.metrics.favoritesCount - a.metrics.favoritesCount) ||
        (b.metrics.ratingCount - a.metrics.ratingCount) ||
        (b.metrics.ratingAvg - a.metrics.ratingAvg)
      ));
      return sorted;
    }
    if (curated === "new") {
      sorted.sort((a, b) => (
        parseTime(b.updatedAt || b.createdAt) - parseTime(a.updatedAt || a.createdAt)
      ));
      return sorted;
    }
    sorted.sort((a, b) => (
      (b.metrics.ratingAvg - a.metrics.ratingAvg) ||
      (b.metrics.ratingCount - a.metrics.ratingCount) ||
      (b.metrics.favoritesCount - a.metrics.favoritesCount)
    ));
    return sorted;
  }

  function guideTag(text, className) {
    const node = document.createElement("span");
    node.className = className;
    node.textContent = text;
    return node;
  }

  function observeRoutePanel() {
    if (!(els.route.orderList instanceof HTMLElement)) {
      return;
    }
    const observer = new MutationObserver(() => {
      renderPlannerSnapshot();
    });
    observer.observe(els.route.orderList, {
      childList: true,
      subtree: true,
      characterData: true
    });
    for (const node of [els.route.distance, els.route.duration, els.route.type, els.route.provider]) {
      if (node instanceof HTMLElement) {
        observer.observe(node, {
          childList: true,
          subtree: true,
          characterData: true
        });
      }
    }
  }

  function renderPlannerSnapshot() {
    const snapshot = getRouteSnapshot();
    els.planner.modeValue.textContent = snapshot.modeLabel;
    els.planner.distanceValue.textContent = snapshot.distanceLabel;
    els.planner.durationValue.textContent = snapshot.durationLabel;
    els.planner.providerValue.textContent = snapshot.providerLabel;

    const fragment = document.createDocumentFragment();
    if (snapshot.points.length === 0) {
      const item = document.createElement("li");
      item.className = "travel-planner__point travel-planner__point--empty";
      item.textContent = "Select points in route panel to build a plan.";
      fragment.append(item);
    } else {
      for (let index = 0; index < snapshot.points.length; index += 1) {
        const point = snapshot.points[index];
        const item = document.createElement("li");
        item.className = "travel-planner__point";
        const badge = document.createElement("span");
        badge.className = "travel-planner__point-bullet";
        badge.textContent = letter(index);
        const label = document.createElement("span");
        label.className = "travel-planner__point-text";
        label.textContent = point.label;
        item.append(badge, label);
        fragment.append(item);
      }
    }
    els.planner.points.replaceChildren(fragment);
  }

  function getRouteSnapshot() {
    return {
      mode: normalizeText(els.route.mode?.value, "car"),
      modeLabel: normalizeText(els.route.type?.textContent, "Car"),
      distanceLabel: normalizeText(els.route.distance?.textContent, "--"),
      durationLabel: normalizeText(els.route.duration?.textContent, "--"),
      providerLabel: normalizeText(els.route.provider?.textContent, "--"),
      points: collectRoutePoints()
    };
  }

  function collectRoutePoints() {
    const rows = Array.from(els.route.orderList?.querySelectorAll(".route-panel__order-item") || []);
    const points = [];

    for (const row of rows) {
      const focus = row.querySelector(".route-panel__order-focus");
      const endpointId = focus instanceof HTMLElement
        ? normalizeText(focus.dataset.endpointId, "")
        : "";
      const endpoint = getEndpoint(endpointId);
      if (!endpoint) {
        continue;
      }
      const point = extractEndpointPoint(endpoint);
      if (point) {
        points.push(point);
      }
    }
    return points;
  }

  function getEndpoint(endpointId) {
    if (endpointId === "start") {
      return { select: els.route.start, lat: els.route.startLat, lon: els.route.startLon };
    }
    if (endpointId === "end") {
      return { select: els.route.end, lat: els.route.endLat, lon: els.route.endLon };
    }
    if (!(els.route.extraWrap instanceof HTMLElement) || !endpointId) {
      return null;
    }
    const escaped = cssEscape(endpointId);
    const group = els.route.extraWrap.querySelector(`.route-panel__group[data-endpoint-id="${escaped}"]`);
    if (!(group instanceof HTMLElement)) {
      return null;
    }
    const select = group.querySelector(".route-panel__select");
    const coords = Array.from(group.querySelectorAll(".route-panel__coord-input"));
    if (!(select instanceof HTMLSelectElement)) {
      return null;
    }
    return {
      select,
      lat: coords[0] instanceof HTMLInputElement ? coords[0] : null,
      lon: coords[1] instanceof HTMLInputElement ? coords[1] : null
    };
  }

  function extractEndpointPoint(endpoint) {
    if (!(endpoint?.select instanceof HTMLSelectElement)) {
      return null;
    }
    const value = normalizeText(endpoint.select.value, "");
    if (!value) {
      return null;
    }
    if (value === CUSTOM_VALUE) {
      const lat = toNumber(endpoint.lat?.value, NaN);
      const lon = toNumber(endpoint.lon?.value, NaN);
      return {
        source: "custom",
        placeId: "",
        label: Number.isFinite(lat) && Number.isFinite(lon)
          ? `${round(lat, 4)}, ${round(lon, 4)}`
          : "Custom coordinates",
        lat: Number.isFinite(lat) ? lat : null,
        lon: Number.isFinite(lon) ? lon : null
      };
    }
    return {
      source: "place",
      placeId: value,
      label: normalizeText(endpoint.select.selectedOptions?.[0]?.textContent, value),
      lat: null,
      lon: null
    };
  }

  async function saveCurrentPlan() {
    const snapshot = getRouteSnapshot();
    if (snapshot.points.length < 2) {
      setPlannerStatus("Choose at least 2 points before saving.", "error");
      return false;
    }

    let plan = {
      id: createId(),
      title: `${snapshot.points[0]?.label || "A"} -> ${snapshot.points[snapshot.points.length - 1]?.label || "B"}`,
      mode: snapshot.mode,
      modeLabel: snapshot.modeLabel,
      distanceLabel: snapshot.distanceLabel,
      durationLabel: snapshot.durationLabel,
      providerLabel: snapshot.providerLabel,
      points: snapshot.points,
      updatedAt: new Date().toISOString(),
      source: "local"
    };

    let savedRemote = false;
    if (await isAuthed()) {
      const remote = await savePlanRemote(plan);
      if (remote) {
        plan = remote;
        savedRemote = true;
      }
    }

    const key = plansKey();
    const plans = [plan, ...readPlans(key).filter((entry) => entry.id !== plan.id)].slice(0, 30);
    writeJson(key, plans);
    state.planner.plans = plans;
    state.planner.syncLabel = savedRemote ? "supabase" : "local";
    renderPlans();
    setPlannerStatus(savedRemote ? "Plan saved to Supabase." : "Plan saved locally.", "success");
    return true;
  }

  async function loadPlannerPlans(forceRemote) {
    const key = plansKey();
    let plans = readPlans(key);
    let syncLabel = "local";

    if (forceRemote && (await isAuthed())) {
      if (!state.planner.remoteAvailable) {
        if (state.planner.remoteError) {
          setPlannerStatus(
            `Supabase planner sync disabled: ${state.planner.remoteError}`,
            "error"
          );
        }
      } else {
        const remote = await loadPlansRemote();
        if (remote) {
          plans = mergePlans(remote, plans);
          writeJson(key, plans);
          syncLabel = "supabase";
        }
      }
    }

    state.planner.plans = plans;
    state.planner.syncLabel = syncLabel;
    renderPlans();
  }

  async function applyPlan(plan) {
    if (!plan || !Array.isArray(plan.points) || plan.points.length < 2) {
      setPlannerStatus("Invalid plan data.", "error");
      return;
    }

    const ok = await syncWaypointCount(plan.points.length);
    if (!ok) {
      setPlannerStatus("Cannot apply plan: waypoint controls mismatch.", "error");
      return;
    }

    if (els.route.mode instanceof HTMLSelectElement) {
      els.route.mode.value = normalizeText(plan.mode, "car");
      els.route.mode.dispatchEvent(new Event("change", { bubbles: true }));
    }

    const endpoints = sequentialEndpoints();
    if (endpoints.length < plan.points.length) {
      setPlannerStatus("Not enough route controls to apply this plan.", "error");
      return;
    }
    for (let index = 0; index < plan.points.length; index += 1) {
      applyPoint(plan.points[index], endpoints[index]);
    }

    els.route.build?.click();
    setPlannerStatus("Plan applied. Route is rebuilding.", "success");
  }

  async function removePlan(plan) {
    if (await isAuthed()) {
      await deletePlanRemote(plan);
    }
    const key = plansKey();
    const plans = readPlans(key).filter((entry) => entry.id !== plan.id);
    writeJson(key, plans);
    state.planner.plans = plans;
    renderPlans();
    setPlannerStatus("Plan removed.", "success");
  }

  function renderPlans() {
    els.planner.sync.textContent = state.planner.syncLabel;
    els.planner.sync.classList.toggle("is-remote", state.planner.syncLabel === "supabase");

    const plans = state.planner.plans;
    if (!plans.length) {
      const empty = document.createElement("li");
      empty.className = "travel-planner__saved-item travel-planner__saved-item--empty";
      empty.textContent = "No saved plans yet.";
      els.planner.saved.replaceChildren(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const plan of plans.slice(0, 20)) {
      const item = document.createElement("li");
      item.className = "travel-planner__saved-item";
      const head = document.createElement("div");
      head.className = "travel-planner__saved-item-head";
      const title = document.createElement("strong");
      title.className = "travel-planner__saved-item-title";
      title.textContent = normalizeText(plan.title, "Saved route");
      const meta = document.createElement("span");
      meta.className = "travel-planner__saved-item-meta";
      meta.textContent = join([normalizeText(plan.modeLabel, "Route"), normalizeText(plan.distanceLabel, "--"), shortDate(plan.updatedAt)], " | ");
      head.append(title, meta);
      const actions = document.createElement("div");
      actions.className = "travel-planner__saved-item-actions";
      const applyBtn = createButton("app-btn app-btn--ghost travel-planner__saved-btn", "Apply");
      applyBtn.dataset.planId = plan.id;
      applyBtn.dataset.action = "apply";
      const delBtn = createButton("app-btn app-btn--ghost travel-planner__saved-btn travel-planner__saved-btn--danger", "Delete");
      delBtn.dataset.planId = plan.id;
      delBtn.dataset.action = "delete";
      actions.append(applyBtn, delBtn);
      item.append(head, actions);
      fragment.append(item);
    }
    els.planner.saved.replaceChildren(fragment);
  }

  function setPlannerStatus(text, type) {
    els.planner.status.textContent = normalizeText(text, "");
    els.planner.status.classList.remove("is-info", "is-success", "is-error");
    els.planner.status.classList.add(type === "error" ? "is-error" : (type === "success" ? "is-success" : "is-info"));
  }

  async function syncWaypointCount(pointCount) {
    const required = Math.max(0, pointCount - 2);
    if (!(els.route.extraWrap instanceof HTMLElement) || !(els.route.addWaypoint instanceof HTMLButtonElement)) {
      return required === 0;
    }

    let guard = 24;
    while (extraGroups().length < required && guard > 0) {
      if (els.route.addWaypoint.disabled) {
        break;
      }
      els.route.addWaypoint.click();
      await sleep(16);
      guard -= 1;
    }

    guard = 24;
    while (extraGroups().length > required && guard > 0) {
      const groups = extraGroups();
      const remove = groups[groups.length - 1]?.querySelector(".route-panel__remove-waypoint");
      if (!(remove instanceof HTMLButtonElement)) {
        break;
      }
      remove.click();
      await sleep(16);
      guard -= 1;
    }

    return extraGroups().length === required;
  }

  function sequentialEndpoints() {
    const endpoints = [];
    if (els.route.start instanceof HTMLSelectElement) {
      endpoints.push({ select: els.route.start, lat: els.route.startLat, lon: els.route.startLon });
    }
    if (els.route.end instanceof HTMLSelectElement) {
      endpoints.push({ select: els.route.end, lat: els.route.endLat, lon: els.route.endLon });
    }
    for (const group of extraGroups()) {
      const select = group.querySelector(".route-panel__select");
      if (!(select instanceof HTMLSelectElement)) {
        continue;
      }
      const coords = Array.from(group.querySelectorAll(".route-panel__coord-input"));
      endpoints.push({
        select,
        lat: coords[0] instanceof HTMLInputElement ? coords[0] : null,
        lon: coords[1] instanceof HTMLInputElement ? coords[1] : null
      });
    }
    return endpoints;
  }

  function applyPoint(point, endpoint) {
    if (!(endpoint?.select instanceof HTMLSelectElement)) {
      return;
    }

    const placeId = normalizeText(point?.placeId, "");
    if (placeId && hasOption(endpoint.select, placeId)) {
      endpoint.select.value = placeId;
      endpoint.select.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }

    const lat = toNumber(point?.lat, NaN);
    const lon = toNumber(point?.lon, NaN);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      endpoint.select.value = CUSTOM_VALUE;
      endpoint.select.dispatchEvent(new Event("change", { bubbles: true }));
      if (endpoint.lat instanceof HTMLInputElement) {
        endpoint.lat.value = String(lat);
      }
      if (endpoint.lon instanceof HTMLInputElement) {
        endpoint.lon.value = String(lon);
      }
      return;
    }

    const label = normalizeText(point?.label, "").toLowerCase();
    if (!label) {
      return;
    }
    const match = Array.from(endpoint.select.options).find((option) => {
      return normalizeText(option.textContent, "").toLowerCase() === label;
    });
    if (match) {
      endpoint.select.value = match.value;
      endpoint.select.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  function hasOption(select, value) {
    return Array.from(select.options).some((option) => option.value === value);
  }

  function extraGroups() {
    if (!(els.route.extraWrap instanceof HTMLElement)) {
      return [];
    }
    return Array.from(els.route.extraWrap.querySelectorAll(".route-panel__group.route-panel__group--extra"));
  }

  function plansKey() {
    const userId = normalizeText(state.session?.user?.id, "guest");
    return `${KEYS.plans}:${userId}`;
  }

  function readPlans(key) {
    const raw = readJson(key, []);
    if (!Array.isArray(raw)) {
      return [];
    }
    return raw
      .map((entry) => sanitizePlan(entry))
      .filter(Boolean)
      .slice(0, 30);
  }

  function sanitizePlan(value) {
    if (!value || typeof value !== "object") {
      return null;
    }
    const id = normalizeText(value.id, "");
    const points = sanitizePoints(value.points);
    if (!id || points.length < 2) {
      return null;
    }
    return {
      id,
      remoteId: normalizeText(value.remoteId, ""),
      title: normalizeText(value.title, "Saved route"),
      mode: normalizeText(value.mode, "car"),
      modeLabel: normalizeText(value.modeLabel, "Route"),
      distanceLabel: normalizeText(value.distanceLabel, "--"),
      durationLabel: normalizeText(value.durationLabel, "--"),
      providerLabel: normalizeText(value.providerLabel, "--"),
      points,
      updatedAt: normalizeText(value.updatedAt, new Date().toISOString()),
      source: normalizeText(value.source, "local")
    };
  }

  function sanitizePoints(value) {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.map((point) => {
      const placeId = normalizeText(point?.placeId, "");
      const lat = toNumber(point?.lat, NaN);
      const lon = toNumber(point?.lon, NaN);
      if (!placeId && !(Number.isFinite(lat) && Number.isFinite(lon))) {
        return null;
      }
      return {
        source: normalizeText(point?.source, "place"),
        placeId,
        label: normalizeText(point?.label, "Point"),
        lat: Number.isFinite(lat) ? round(lat, 6) : null,
        lon: Number.isFinite(lon) ? round(lon, 6) : null
      };
    }).filter(Boolean).slice(0, 10);
  }

  function mergePlans(primary, secondary) {
    const map = new Map();
    for (const plan of primary) {
      map.set(plan.id, plan);
    }
    for (const plan of secondary) {
      if (!map.has(plan.id)) {
        map.set(plan.id, plan);
      }
    }
    return Array.from(map.values())
      .sort((a, b) => parseTime(b.updatedAt) - parseTime(a.updatedAt))
      .slice(0, 30);
  }

  async function savePlanRemote(plan) {
    if (!state.planner.remoteAvailable || !state.session?.user?.id) {
      return null;
    }
    const client = await waitForSupabaseClient(4000);
    if (!client) {
      return null;
    }
    const row = {
      user_id: state.session.user.id,
      title: normalizeText(plan.title, "Route"),
      mode: normalizeText(plan.mode, "car"),
      points: sanitizePoints(plan.points),
      summary: {
        distanceLabel: normalizeText(plan.distanceLabel, "--"),
        durationLabel: normalizeText(plan.durationLabel, "--"),
        providerLabel: normalizeText(plan.providerLabel, "--")
      },
      route_payload: {
        ...plan,
        points: sanitizePoints(plan.points)
      },
      updated_at: new Date().toISOString()
    };
    try {
      const { data, error, status } = await client
        .from("trip_plans")
        .insert(row)
        .select("*")
        .single();
      if (error || !data) {
        if (error) {
          handlePlannerRemoteSupabaseError(error, status, "savePlanRemote");
        }
        return null;
      }
      return sanitizePlan({
        id: data.id,
        remoteId: data.id,
        title: data.title,
        mode: data.mode,
        modeLabel: plan.modeLabel,
        distanceLabel: data.summary?.distanceLabel ?? data.distance_label ?? plan.distanceLabel,
        durationLabel: data.summary?.durationLabel ?? data.duration_label ?? plan.durationLabel,
        providerLabel: data.summary?.providerLabel ?? data.provider ?? plan.providerLabel,
        points: data.points ?? data.route_payload?.points ?? plan.points,
        updatedAt: data.updated_at ?? data.created_at ?? plan.updatedAt,
        source: "supabase"
      });
    } catch (error) {
      console.error("[travel-shell] savePlanRemote exception:", error);
      return null;
    }
  }

  async function loadPlansRemote() {
    if (!state.planner.remoteAvailable || !state.session?.user?.id) {
      return null;
    }
    const client = await waitForSupabaseClient(4000);
    if (!client) {
      return null;
    }
    try {
      const { data, error, status } = await client
        .from("trip_plans")
        .select("*")
        .eq("user_id", state.session.user.id)
        .order("updated_at", { ascending: false })
        .limit(30);
      if (error || !Array.isArray(data)) {
        if (error) {
          handlePlannerRemoteSupabaseError(error, status, "loadPlansRemote");
        }
        return null;
      }
      return data.map((row) => sanitizePlan({
        id: row.id,
        remoteId: row.id,
        title: row.title ?? row.name,
        mode: row.mode ?? row.route_payload?.mode,
        modeLabel: row.mode_label ?? row.route_payload?.modeLabel ?? row.mode,
        distanceLabel: row.summary?.distanceLabel ?? row.distance_label ?? row.route_payload?.distanceLabel,
        durationLabel: row.summary?.durationLabel ?? row.duration_label ?? row.route_payload?.durationLabel,
        providerLabel: row.summary?.providerLabel ?? row.provider ?? row.route_payload?.providerLabel,
        points: row.points ?? row.waypoints ?? row.route_payload?.points,
        updatedAt: row.updated_at ?? row.created_at,
        source: "supabase"
      })).filter(Boolean);
    } catch (error) {
      console.error("[travel-shell] loadPlansRemote exception:", error);
      return null;
    }
  }

  async function deletePlanRemote(plan) {
    if (!state.planner.remoteAvailable || !state.session?.user?.id) {
      return false;
    }
    const client = await waitForSupabaseClient(4000);
    if (!client) {
      return false;
    }
    const remoteId = normalizeText(plan?.remoteId ?? plan?.id, "");
    if (!remoteId) {
      return false;
    }
    try {
      const { error, status } = await client
        .from("trip_plans")
        .delete()
        .eq("id", remoteId)
        .eq("user_id", state.session.user.id);
      if (error) {
        handlePlannerRemoteSupabaseError(error, status, "deletePlanRemote");
      }
      return !error;
    } catch (error) {
      console.error("[travel-shell] deletePlanRemote exception:", error);
      return false;
    }
  }

  async function refreshSession() {
    const client = await waitForSupabaseClient(1500);
    if (!client || !client.auth || typeof client.auth.getSession !== "function") {
      state.session = null;
      return;
    }
    try {
      const { data } = await client.auth.getSession();
      state.session = data?.session || null;
    } catch {
      state.session = null;
    }
  }

  async function isAuthed() {
    if (state.session?.user) {
      return true;
    }
    await refreshSession();
    return Boolean(state.session?.user);
  }

  async function waitForUiStore() {
    if (window.WorldAtlasUiStateStore && typeof window.WorldAtlasUiStateStore.subscribe === "function") {
      return window.WorldAtlasUiStateStore;
    }
    return new Promise((resolve) => {
      let done = false;
      const finish = (value) => {
        if (done) {
          return;
        }
        done = true;
        window.removeEventListener("worldatlas:ui-store-ready", onReady);
        window.clearTimeout(timer);
        resolve(value || null);
      };
      const onReady = () => {
        if (window.WorldAtlasUiStateStore && typeof window.WorldAtlasUiStateStore.subscribe === "function") {
          finish(window.WorldAtlasUiStateStore);
        }
      };
      const timer = window.setTimeout(() => finish(null), 5000);
      window.addEventListener("worldatlas:ui-store-ready", onReady);
      onReady();
    });
  }

  async function waitForSupabaseClient(timeoutMs) {
    if (isSupabase(window.supabase)) {
      return window.supabase;
    }
    if (isSupabase(window.WorldAtlasSupabase?.client)) {
      return window.WorldAtlasSupabase.client;
    }
    if (window.supabaseReady && typeof window.supabaseReady.then === "function") {
      try {
        const timeout = new Promise((resolve) => window.setTimeout(() => resolve(null), timeoutMs));
        const value = await Promise.race([window.supabaseReady, timeout]);
        return isSupabase(value) ? value : null;
      } catch {
        return null;
      }
    }
    return null;
  }

  function isSupabase(value) {
    return Boolean(
      value &&
      typeof value === "object" &&
      typeof value.from === "function" &&
      value.auth &&
      typeof value.auth.getSession === "function"
    );
  }

  function normalizePlace(value) {
    if (!value || typeof value !== "object") {
      return null;
    }
    const id = normalizeText(value.id, "");
    const name = normalizeText(value.name ?? value.title, "");
    const lat = toNumber(value.lat, NaN);
    const lon = toNumber(value.lon ?? value.lng, NaN);
    if (!id || !name || !Number.isFinite(lat) || !Number.isFinite(lon)) {
      return null;
    }
    return {
      id,
      name,
      lat: round(lat, 6),
      lon: round(lon, 6),
      region: normalizeText(value.region, "Region"),
      country: normalizeText(value.country, ""),
      category: normalizeText(value.category ?? value.kind, "General"),
      tags: Array.isArray(value.tags) ? value.tags.map((entry) => normalizeText(entry, "")).filter(Boolean) : [],
      description: normalizeText(value.description, ""),
      image: resolvePlaceImageUrl(value),
      updatedAt: normalizeText(value.updatedAt ?? value.updated_at, ""),
      createdAt: normalizeText(value.createdAt ?? value.created_at, "")
    };
  }

  function createGuidePlaceDedupeKey(place) {
    if (!place || typeof place !== "object") {
      return "";
    }

    const name = normalizeText(place.name, "").toLowerCase();
    const region = normalizeText(place.region, "").toLowerCase();
    const country = normalizeText(place.country, "").toLowerCase();
    const lat = Number.isFinite(Number(place.lat))
      ? round(Number(place.lat), 3).toFixed(3)
      : "";
    const lon = Number.isFinite(Number(place.lon))
      ? round(Number(place.lon), 3).toFixed(3)
      : "";

    if (!name || !lat || !lon) {
      return "";
    }

    return `${name}|${region}|${country}|${lat}|${lon}`;
  }

  function mergeGuidePlace(existing, incoming) {
    if (!existing) {
      return incoming;
    }
    if (!incoming) {
      return existing;
    }

    const merged = { ...existing };
    if (!Number.isFinite(Number(merged.lat)) && Number.isFinite(Number(incoming.lat))) {
      merged.lat = round(Number(incoming.lat), 6);
    }
    if (!Number.isFinite(Number(merged.lon)) && Number.isFinite(Number(incoming.lon))) {
      merged.lon = round(Number(incoming.lon), 6);
    }
    if (!merged.image && incoming.image) {
      merged.image = incoming.image;
    }
    if (!merged.country && incoming.country) {
      merged.country = incoming.country;
    }
    if ((!merged.region || merged.region === "Region") && incoming.region) {
      merged.region = incoming.region;
    }
    if ((!merged.category || merged.category === "General") && incoming.category) {
      merged.category = incoming.category;
    }
    if (!merged.description && incoming.description) {
      merged.description = incoming.description;
    }
    if (!Array.isArray(merged.tags) || merged.tags.length === 0) {
      merged.tags = Array.isArray(incoming.tags) ? incoming.tags.slice() : [];
    }

    const mergedUpdatedAt = parseTime(merged.updatedAt);
    const incomingUpdatedAt = parseTime(incoming.updatedAt);
    if (incomingUpdatedAt > mergedUpdatedAt) {
      merged.updatedAt = incoming.updatedAt;
    }

    return merged;
  }

  function resolveGuideCardImage(place) {
    if (!place || typeof place !== "object") {
      return "";
    }
    const rawUrl = resolvePlaceImageUrl(place);
    return optimizeGuideImageUrl(rawUrl);
  }

  function createGuideImagePlaceholder(options = {}) {
    const { loading = false, label = "No image" } = options;
    const placeholder = document.createElement("span");
    placeholder.className = "travel-guide__image-placeholder travel-guide__image-placeholder--card";
    if (loading) {
      // Keep static placeholder to avoid continuous shimmer repaints.
      placeholder.classList.add("is-loading-static");
    }

    const icon = document.createElement("span");
    icon.className = "travel-guide__image-placeholder-icon";
    icon.setAttribute("aria-hidden", "true");

    const text = document.createElement("span");
    text.className = "travel-guide__image-placeholder-label";
    text.textContent = normalizeText(label, "No image");

    placeholder.append(icon, text);
    return placeholder;
  }

  function resolvePlaceImageUrl(value) {
    if (!value || typeof value !== "object") {
      return "";
    }

    const candidates = [
      value.image,
      value.image_url,
      value.imageUrl,
      value.photo,
      value.photo_url,
      value.photoUrl,
      value.cover_image,
      value.coverImage,
      value.thumbnail,
      value.thumbnail_url,
      value.thumbnailUrl
    ];

    candidates.push(...collectImageCandidatesFromList(value.photos));
    candidates.push(...collectImageCandidatesFromList(value.images));
    candidates.push(...collectImageCandidatesFromList(value.media));
    if (value.media && typeof value.media === "object" && !Array.isArray(value.media)) {
      candidates.push(
        value.media.url,
        value.media.image,
        value.media.image_url,
        value.media.imageUrl,
        value.media.src,
        value.media.secure_url
      );
    }

    for (const candidate of candidates) {
      const normalized = normalizeHttp(candidate);
      if (normalized) {
        return normalized;
      }
    }

    return "";
  }

  function optimizeGuideImageUrl(urlValue) {
    const safeUrl = normalizeHttp(urlValue);
    if (!safeUrl) {
      return "";
    }

    try {
      const url = new URL(safeUrl);
      const host = normalizeText(url.hostname, "").toLowerCase();
      const params = url.searchParams;
      const target = String(SOCIAL_GUIDE_IMAGE_TARGET_SIZE_PX);
      const quality = String(SOCIAL_GUIDE_IMAGE_QUALITY);

      if (host.includes("images.unsplash.com")) {
        params.set("w", target);
        params.set("h", target);
        params.set("fit", "crop");
        params.set("q", quality);
        params.set("auto", "format");
        params.set("fm", "webp");
        params.set("dpr", "1");
        return url.toString();
      }

      if (host.includes("pexels.com")) {
        params.set("w", target);
        params.set("h", target);
        params.set("fit", "crop");
        params.set("auto", "compress,format");
        params.set("q", quality);
        params.set("dpr", "1");
        return url.toString();
      }

      let changed = false;
      if (params.has("w")) {
        params.set("w", target);
        changed = true;
      }
      if (params.has("width")) {
        params.set("width", target);
        changed = true;
      }
      if (params.has("h")) {
        params.set("h", target);
        changed = true;
      }
      if (params.has("height")) {
        params.set("height", target);
        changed = true;
      }
      if (params.has("q")) {
        params.set("q", quality);
        changed = true;
      }
      if (params.has("fm")) {
        params.set("fm", "webp");
        changed = true;
      }
      if (params.has("format")) {
        params.set("format", "webp");
        changed = true;
      }
      if (params.has("dpr")) {
        params.set("dpr", "1");
        changed = true;
      }
      if (params.has("quality")) {
        params.set("quality", quality);
        changed = true;
      }

      return changed ? url.toString() : safeUrl;
    } catch {
      return safeUrl;
    }
  }

  function collectImageCandidatesFromList(input) {
    if (!Array.isArray(input)) {
      return [];
    }

    const result = [];
    for (const entry of input) {
      if (typeof entry === "string") {
        result.push(entry);
        continue;
      }
      if (!entry || typeof entry !== "object") {
        continue;
      }
      result.push(
        entry.url,
        entry.image,
        entry.image_url,
        entry.imageUrl,
        entry.src,
        entry.secure_url
      );
    }
    return result;
  }

  function normalizeHttp(value) {
    const text = normalizeText(value, "");
    if (!text) {
      return "";
    }
    try {
      const url = new URL(text);
      if (url.protocol === "http:" || url.protocol === "https:") {
        return sanitizeKnownImageUrl(url.toString());
      }
    } catch {}
    return "";
  }

  function sanitizeKnownImageUrl(url) {
    const safeUrl = normalizeText(url, "");
    if (safeUrl.includes("Puerto_Madero_-_Puente_de_la_mujer")) {
      return "https://images.unsplash.com/photo-1589909202802-8f4aadce1849?w=800&h=500&fit=crop&q=80";
    }
    return safeUrl;
  }

  function cssEscape(value) {
    const text = normalizeText(value, "");
    if (!text) {
      return "";
    }
    if (window.CSS && typeof window.CSS.escape === "function") {
      return window.CSS.escape(text);
    }
    return text.replace(/[^a-zA-Z0-9_-]/g, "");
  }

  function chunk(values, size) {
    const out = [];
    const safeSize = Math.max(1, Math.floor(Number(size) || 1));
    for (let index = 0; index < values.length; index += safeSize) {
      out.push(values.slice(index, index + safeSize));
    }
    return out;
  }

  function normalizeMode(value, fallback) {
    const mode = normalizeText(value, fallback).toLowerCase();
    if (mode === MODE_CATALOG || mode === MODE_GUIDE) {
      return mode;
    }
    return fallback;
  }

  function normalizeText(value, fallback) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) {
        return trimmed;
      }
    }
    return fallback;
  }

  function toNumber(value, fallback) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  }

  function toInt(value, fallback) {
    return Math.floor(toNumber(value, fallback));
  }

  function formatInt(value) {
    return new Intl.NumberFormat("en-US").format(Math.max(0, toInt(value, 0)));
  }

  function formatFloat(value, digits) {
    const numeric = toNumber(value, 0);
    return numeric > 0 ? numeric.toFixed(digits) : "0.0";
  }

  function parseTime(value) {
    const timestamp = Date.parse(String(value || ""));
    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  function shortDate(value) {
    const ts = parseTime(value);
    if (!ts) {
      return "recent";
    }
    return new Date(ts).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  }

  function round(value, digits) {
    const factor = 10 ** digits;
    return Math.round(Number(value) * factor) / factor;
  }

  function clamp(value, min, max) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return min;
    }
    return Math.max(min, Math.min(max, numeric));
  }

  function join(items, separator) {
    return items.map((entry) => normalizeText(entry, "")).filter(Boolean).join(separator);
  }

  function letter(index) {
    const n = Math.max(0, Math.floor(Number(index) || 0));
    return n < 26 ? String.fromCharCode(65 + n) : `P${n + 1}`;
  }

  function createId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return `plan-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  }

  function sleep(ms) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });
  }

  function readJson(key, fallback) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) {
        return fallback;
      }
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  function readStringSet(key) {
    const value = readJson(key, []);
    if (!Array.isArray(value)) {
      return new Set();
    }
    return new Set(value.map((entry) => normalizeText(entry, "")).filter(Boolean));
  }
})();
