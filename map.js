(() => {
  "use strict";

  function createMapEngine(options) {
    const {
      mapElement,
      onSelectPlace,
      onHoverPlace,
      onViewChange,
      onTileError,
      helpers = {}
    } = options || {};

    const {
      Config,
      validateMapEngineDependencies,
      normalizeView,
      round,
      isValidPlace,
      createPinIcon,
      clamp,
      computeFlyDurationSeconds,
      computeFlyEaseLinearity,
      normalizePlaceVisibilityState,
      resolvePlaceCategory,
      getRegionHue,
      normalizeText
    } = helpers;

    const requiredHelpers = {
      validateMapEngineDependencies,
      normalizeView,
      round,
      isValidPlace,
      createPinIcon,
      clamp,
      computeFlyDurationSeconds,
      computeFlyEaseLinearity,
      normalizePlaceVisibilityState,
      resolvePlaceCategory,
      getRegionHue,
      normalizeText
    };

    if (!Config || typeof Config !== "object") {
      throw new Error("Map module requires Config helper object.");
    }

    for (const [helperName, helperValue] of Object.entries(requiredHelpers)) {
      if (typeof helperValue !== "function") {
        throw new Error(`Map module helper is missing: ${helperName}.`);
      }
    }

    validateMapEngineDependencies({ mapElement, onSelectPlace, onViewChange, onTileError });

    if (!window.L) {
      throw new Error("Leaflet script is not loaded.");
    }

    const Leaflet = window.L;

    let map = null;
    let markersLayer = null;
    let tileLayer = null;
    let delegatedKeydownHandler = null;
    let mapClickHandler = null;
    let mapMotionStartHandler = null;
    let mapMotionStopHandler = null;
    let mapZoomDiagnosticsHandler = null;
    let mapZoomScaleHandler = null;
    let mapContainerEl = null;
    let flyTransitionToken = 0;
    let mapMotionClassTimerId = null;
    let markerHoverIntentTimerId = null;
    let markerHoverClearTimerId = null;
    let markerTooltipHideTimerId = null;
    let markerTapPrimeTimerId = null;
    let routeDrawMotionTimerId = null;
    let markerRefreshTimerId = null;
    let markerRefreshRafId = null;
    let zoomMarkerRefreshTimerId = null;
    let markerRefreshQueuedForce = false;
    let markerRefreshQueuedSource = "unspecified";
    let pendingDebouncedRefreshForce = false;
    let pendingDebouncedRefreshSource = "unspecified";
    let pendingMotionMarkerRefresh = null;
    let lastMarkerRefreshAt = 0;
    let lowPowerEffectsTimerId = null;
    let lowPowerEffectsActive = false;
    let lastZoomEndAt = 0;
    let isMapInMotion = false;
    let isZooming = false;
    const mapMotionSubscribers = new Set();
    const markerSpotlightTimers = new Map();
    const touchInteractionMediaQuery = window.matchMedia("(hover: none), (pointer: coarse)");

    const VIEWPORT_BUFFER_RATIO = 0.15;
    const MARKER_REFRESH_DEBOUNCE_MS = 96;
    const LOW_POWER_EFFECTS_RECOVERY_MS = 180;
    const MARKER_PULSE_DEFAULT_MS = 1450;
    const MARKER_LAYER_CHUNK_INTERVAL_MS = 120;
    const MARKER_LAYER_CHUNK_DELAY_MS = 12;
    const MARKER_LAYER_CHUNK_THRESHOLD = 28;
    const ZOOM_END_REFRESH_DEBOUNCE_MS = 96;
    const MARKER_REFRESH_MOTION_THROTTLE_MS = 160;
    const CLUSTER_ENABLE_THRESHOLD = 600;
    const CLUSTER_DISABLE_THRESHOLD = 420;
    const CLUSTER_DISABLE_AT_ZOOM = 8.8;
    const CLUSTER_GRID_SIZE_PX = 56;
    const MAX_CLUSTER_MARKER_POOL_SIZE = 640;
    const MARKER_ZOOM_SCALE_MIN = 0.82;
    const MARKER_ZOOM_SCALE_MAX = 1.22;
    const MARKER_ZOOM_SCALE_REFERENCE = 6;
    const PERF_RENDER_LOG_THRESHOLD_MS = 120;
    const MARKER_DECORATION_CHUNK_SIZE = 72;
    const TILE_ERROR_NOTIFY_COOLDOWN_MS = 4000;
    const BASE_TILE_LAYER_URL = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png";
    const BASE_TILE_SUBDOMAINS = "abcd";
    let lastTileErrorAt = 0;

    const allPlaces = [];
    const placeLookup = new Map();
    const markerCache = new Map();
    const markerRegistry = new Map();
    const clusterRegistry = new Map();
    const clusterMarkerPool = [];
    const pendingMarkerDecoration = new Map();
    const markerPulseTimers = new Map();
    let markerDecorationRafId = null;
    let clusterModeEnabled = false;
    let activePlaceId = null;
    let hoveredPlaceId = null;
    let activeTooltipPlaceId = null;
    let activeTooltipMarker = null;
    let markerTapPrimedPlaceId = null;
    let routeLayerGroup = null;
    let routeRenderer = null;
    let routeDrawLayers = [];
    let userLocationLayer = null;
    let userLocationMarker = null;
    let userAccuracyCircle = null;
    let draftLayer = null;
    let draftMarker = null;
    let coordinatePickSession = null;
    let markersVisible = true;
    let externalMapMotionState = false;

    function getPerfApi() {
      const perfApi = window.WorldAtlasPerf;
      if (!perfApi || perfApi.PERF_ENABLED !== true) {
        return null;
      }
      return perfApi;
    }

    function countPerfEvent(name) {
      const perfApi = getPerfApi();
      if (!perfApi || typeof perfApi.countEvents !== "function") {
        return;
      }
      perfApi.countEvents(name);
    }

    function measurePerfSync(name, callback) {
      if (typeof callback !== "function") {
        return null;
      }

      const perfApi = getPerfApi();
      if (!perfApi || typeof perfApi.mark !== "function" || typeof perfApi.measure !== "function") {
        return callback();
      }

      const uniqueToken = `${name}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
      const startMark = perfApi.mark(`${uniqueToken}:start`);
      try {
        return callback();
      } finally {
        const endMark = perfApi.mark(`${uniqueToken}:end`);
        perfApi.measure(name, startMark, endMark);
      }
    }

    function normalizePerfToken(value, fallback = "unknown") {
      const normalized = normalizeText(value, "").toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
      if (!normalized) {
        return fallback;
      }
      return normalized.replace(/-{2,}/g, "-");
    }

    function roundPerfMs(value) {
      return Math.round(Number(value) * 100) / 100;
    }

    function setMapMotionDataFlagById(elementId, isMoving) {
      const element = document.getElementById(elementId);
      if (!(element instanceof HTMLElement)) {
        return;
      }
      if (isMoving) {
        element.dataset.mapMotion = "1";
        return;
      }
      delete element.dataset.mapMotion;
    }

    function setGlobalMapMotionClass(shouldEnable) {
      const isMoving = Boolean(shouldEnable);
      if (externalMapMotionState === isMoving) {
        if (!isMoving) {
          const root = document.documentElement;
          if (root instanceof HTMLElement && root.classList.contains("wa-map-moving")) {
            root.classList.remove("wa-map-moving");
          }
        }
        return;
      }
      externalMapMotionState = isMoving;

      setMapMotionDataFlagById("travel-hub", isMoving);
      setMapMotionDataFlagById("popup-card", isMoving);

      if (!isMoving) {
        const root = document.documentElement;
        if (root instanceof HTMLElement && root.classList.contains("wa-map-moving")) {
          root.classList.remove("wa-map-moving");
        }
      }

      try {
        window.dispatchEvent(new CustomEvent("worldatlas:map-motion", {
          detail: { isMoving }
        }));
      } catch (_error) {
        window.dispatchEvent(new Event("worldatlas:map-motion"));
      }
    }

    function logMapPerf(name, payload) {
      if (!getPerfApi()) {
        return;
      }
      console.log(`[perf][map] ${name}`, payload);
    }

    function init(initialView) {
      const view = normalizeView(initialView, Config.DEFAULT_VIEW);
      window.__WA_MAP_READY__ = false;

      map = Leaflet.map(mapElement, {
        center: [view.lat, view.lng],
        zoom: view.zoom,
        minZoom: Config.MIN_ZOOM,
        maxZoom: Config.MAX_ZOOM,
        maxBounds: [
          [-85, -180],
          [85, 180]
        ],
        maxBoundsViscosity: 0.75,
        zoomSnap: 0,
        zoomDelta: 0.25,
        zoomControl: false,
        attributionControl: true,
        worldCopyJump: true,
        keyboard: true,
        scrollWheelZoom: true,
        preferCanvas: false,
        zoomAnimation: true,
        zoomAnimationThreshold: 8,
        fadeAnimation: false,
        markerZoomAnimation: true,
        inertia: true,
        inertiaDeceleration: 2480,
        inertiaMaxSpeed: 1920,
        wheelDebounceTime: 45,
        wheelPxPerZoomLevel: 120
      });

      if (map.scrollWheelZoom && typeof map.scrollWheelZoom.enable === "function") {
        map.scrollWheelZoom.enable();
      }

      Leaflet.control.zoom({ position: "bottomright" }).addTo(map);

      tileLayer = Leaflet.tileLayer(BASE_TILE_LAYER_URL, {
        maxZoom: 20,
        maxNativeZoom: 20,
        minZoom: 1,
        subdomains: BASE_TILE_SUBDOMAINS,
        detectRetina: false,
        crossOrigin: true,
        keepBuffer: 4,
        updateWhenZooming: false,
        updateInterval: 180,
        updateWhenIdle: true,
        // Ignored on newer Leaflet versions, kept as best-effort anti-blink hints.
        reuseTiles: true,
        unloadInvisibleTiles: false,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors ' +
          '&copy; <a href="https://carto.com/attributions">CARTO</a>'
      });

      tileLayer.once("load", () => {
        window.__WA_MAP_READY__ = true;
        try {
          window.dispatchEvent(new CustomEvent("wa:map-ready"));
        } catch (_) {
          window.dispatchEvent(new Event("wa:map-ready"));
        }
      });

      tileLayer.addTo(map);
      tileLayer.on("tileerror", () => {
        const now = Date.now();
        if ((now - lastTileErrorAt) < TILE_ERROR_NOTIFY_COOLDOWN_MS) {
          return;
        }
        lastTileErrorAt = now;
        onTileError();
      });

      markersLayer = createMarkerClusterLayer().addTo(map);
      routeLayerGroup = Leaflet.layerGroup().addTo(map);
      userLocationLayer = Leaflet.layerGroup().addTo(map);
      draftLayer = Leaflet.layerGroup().addTo(map);
      routeRenderer = Leaflet.canvas({ padding: 0.42 });
      applyMarkerZoomScale(map.getZoom());
      applyMarkersVisibilityClass();

      mapMotionStartHandler = (event) => {
        if (!mapElement) {
          return;
        }

        if (event?.type === "zoomstart") {
          isZooming = true;
          countPerfEvent("map.zoomstart");
          if (zoomMarkerRefreshTimerId) {
            window.clearTimeout(zoomMarkerRefreshTimerId);
            zoomMarkerRefreshTimerId = null;
          }
        }

        hideMarkerTooltip({ immediate: true });
        clearTapPrime();

        if (!isMapInMotion) {
          isMapInMotion = true;
          notifyMapMotionSubscribers();
        }

        if (mapMotionClassTimerId) {
          window.clearTimeout(mapMotionClassTimerId);
          mapMotionClassTimerId = null;
        }

        setLowPowerEffects(true);
        mapElement.classList.add("is-map-moving");
        setGlobalMapMotionClass(true);
      };

      mapMotionStopHandler = (event) => {
        if (!mapElement) {
          return;
        }

        const eventType = normalizePerfToken(event?.type, "");
        if (eventType === "zoomend") {
          isZooming = false;
          lastZoomEndAt = performance.now();
          countPerfEvent("map.zoomend");
        }

        if (isMapInMotion) {
          isMapInMotion = false;
          notifyMapMotionSubscribers();
        }

        if (mapMotionClassTimerId) {
          window.clearTimeout(mapMotionClassTimerId);
        }

        mapMotionClassTimerId = window.setTimeout(() => {
          mapMotionClassTimerId = null;
          mapElement.classList.remove("is-map-moving");
          setGlobalMapMotionClass(false);
        }, Config.MAP_MOTION_CLASS_GRACE_MS);

        setLowPowerEffects(false);

        if (eventType === "zoomend") {
          scheduleZoomEndMarkerRefresh();
          onViewChange(getView());
          return;
        }

        if (eventType === "moveend" && (performance.now() - lastZoomEndAt) <= 120) {
          flushDeferredMarkerRefresh({
            source: "moveend-after-zoom",
            force: true
          });
          onViewChange(getView());
          return;
        }

        if (eventType === "moveend") {
          const flushedMotionRefresh = flushDeferredMarkerRefresh({
            source: "moveend",
            force: false
          });
          if (!flushedMotionRefresh) {
            scheduleMarkerRefresh({ source: eventType || "motion-stop" });
          }
          onViewChange(getView());
          return;
        }

        scheduleMarkerRefresh({ source: eventType || "motion-stop" });
        onViewChange(getView());
      };

      map.on("movestart zoomstart", mapMotionStartHandler);
      map.on("moveend zoomend", mapMotionStopHandler);
      mapZoomScaleHandler = () => {
        if (!map) {
          return;
        }
        applyMarkerZoomScale(map.getZoom());
      };
      map.on("zoomstart zoom zoomend", mapZoomScaleHandler);
      mapZoomDiagnosticsHandler = (event) => {
        logTilePaneDiagnostics(event?.type || "zoom");
      };
      map.on("zoomstart zoom zoomend", mapZoomDiagnosticsHandler);
      mapContainerEl = map.getContainer();

      mapClickHandler = (event) => {
        if (!coordinatePickSession) {
          hideMarkerTooltip({ immediate: true });
          clearTapPrime();
          return;
        }

        const currentSession = coordinatePickSession;
        coordinatePickSession = null;
        updateCoordinatePickVisualState();

        if (!event?.latlng) {
          return;
        }

        const pickedPoint = {
          lat: round(event.latlng.lat, 6),
          lon: round(event.latlng.lng, 6)
        };

        if (typeof currentSession.onPick === "function") {
          currentSession.onPick(pickedPoint);
        }
      };

      map.on("click", mapClickHandler);

      delegatedKeydownHandler = (event) => {
        if (event.key === "Escape" && coordinatePickSession) {
          event.preventDefault();
          cancelCoordinatePick("escape");
          return;
        }

        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }

        const target = event.target;
        if (!(target instanceof Element)) {
          return;
        }

        const markerElement = target.closest(".map-pin-icon[data-place-id]");
        if (!(markerElement instanceof HTMLElement)) {
          return;
        }

        event.preventDefault();
        const placeId = markerElement.dataset.placeId;
        if (typeof placeId === "string" && placeId.trim() !== "") {
          if (coordinatePickSession) {
            return;
          }
          hideMarkerTooltip({ immediate: true });
          clearTapPrime();
          onSelectPlace(placeId, { source: "map-marker" });
        }
      };

      mapElement.addEventListener("keydown", delegatedKeydownHandler);
    }

    function setVisiblePlaces(places, selectedPlaceId) {
      countPerfEvent("map.setVisiblePlaces");
      clearHoverTimers();
      hideMarkerTooltip({ immediate: true });
      clearTapPrime();
      clearSpotlightTimers();
      allPlaces.length = 0;
      placeLookup.clear();

      if (Array.isArray(places)) {
        for (const place of places) {
          if (!isValidPlace(place)) {
            continue;
          }

          allPlaces.push(place);
          placeLookup.set(place.id, place);
        }
      }

      const normalizedSelectedPlaceId = typeof selectedPlaceId === "string" && selectedPlaceId.trim() !== ""
        ? selectedPlaceId.trim()
        : null;

      if (normalizedSelectedPlaceId && placeLookup.has(normalizedSelectedPlaceId)) {
        setActive(normalizedSelectedPlaceId);
      } else {
        clearActive();
      }

      if (hoveredPlaceId && !placeLookup.has(hoveredPlaceId)) {
        setHovered(null);
      }

      if (activeTooltipPlaceId && !placeLookup.has(activeTooltipPlaceId)) {
        closeActiveMarkerTooltip();
      }

      scheduleMarkerRefresh({ immediate: true, source: "setVisiblePlaces" });
      applyMarkersVisibilityClass();
    }

    function setMarkersVisible(isVisible) {
      const nextVisible = Boolean(isVisible);
      if (markersVisible === nextVisible) {
        return markersVisible;
      }

      markersVisible = nextVisible;
      if (!markersVisible) {
        hideMarkerTooltip({ immediate: true });
        clearTapPrime();
        if (markerRefreshTimerId) {
          window.clearTimeout(markerRefreshTimerId);
          markerRefreshTimerId = null;
        }
        if (markerRefreshRafId) {
          window.cancelAnimationFrame(markerRefreshRafId);
          markerRefreshRafId = null;
        }
        markerRefreshQueuedForce = false;
        markerRefreshQueuedSource = "unspecified";
        pendingDebouncedRefreshForce = false;
        pendingDebouncedRefreshSource = "unspecified";
        pendingMotionMarkerRefresh = null;
      }

      if (map && markersLayer) {
        if (markersVisible) {
          if (!map.hasLayer(markersLayer)) {
            markersLayer.addTo(map);
          }
          scheduleMarkerRefresh({ immediate: true, source: "setMarkersVisible" });
        } else if (map.hasLayer(markersLayer)) {
          map.removeLayer(markersLayer);
        }
      }

      applyMarkersVisibilityClass();
      return markersVisible;
    }

    function areMarkersVisible() {
      return markersVisible;
    }

    function setActive(placeId) {
      const normalizedPlaceId =
        typeof placeId === "string" && placeId.trim() !== ""
          ? placeId.trim()
          : null;
      const previousActivePlaceId = activePlaceId;
      if (previousActivePlaceId && previousActivePlaceId !== normalizedPlaceId) {
        toggleMarkerStateClass(previousActivePlaceId, "is-active", false);
        activePlaceId = null;
        syncMarkerVisualPriority(previousActivePlaceId);
      }

      if (normalizedPlaceId && placeLookup.has(normalizedPlaceId)) {
        activePlaceId = normalizedPlaceId;
        toggleMarkerStateClass(activePlaceId, "is-active", true);
        syncMarkerVisualPriority(activePlaceId);
        if (!markerRegistry.has(activePlaceId)) {
          scheduleMarkerRefresh({ immediate: true, source: "setActive" });
        }
      } else {
        activePlaceId = null;
      }
    }

    function clearActive() {
      if (!activePlaceId) {
        return;
      }
      const previousActivePlaceId = activePlaceId;
      toggleMarkerStateClass(previousActivePlaceId, "is-active", false);
      activePlaceId = null;
      syncMarkerVisualPriority(previousActivePlaceId);
    }

    function setHovered(placeId) {
      const normalizedPlaceId =
        typeof placeId === "string" && placeId.trim() !== ""
          ? placeId.trim()
          : null;
      const previousHoveredPlaceId = hoveredPlaceId;
      if (previousHoveredPlaceId && previousHoveredPlaceId !== normalizedPlaceId) {
        toggleMarkerStateClass(previousHoveredPlaceId, "is-hovered", false);
        hoveredPlaceId = null;
        syncMarkerVisualPriority(previousHoveredPlaceId);
      }

      if (normalizedPlaceId && placeLookup.has(normalizedPlaceId)) {
        hoveredPlaceId = normalizedPlaceId;
        toggleMarkerStateClass(hoveredPlaceId, "is-hovered", true);
        syncMarkerVisualPriority(hoveredPlaceId);
        if (markerRegistry.has(hoveredPlaceId)) {
          openMarkerTooltip(hoveredPlaceId);
        } else {
          hideMarkerTooltip({ immediate: true });
          scheduleMarkerRefresh({ immediate: true, source: "setHovered" });
        }
      } else {
        hoveredPlaceId = null;
        hideMarkerTooltip();
      }
    }

    function scheduleHoverSync(placeId, options = {}) {
      const { immediate = false } = options;
      clearHoverTimers();

      if (immediate) {
        applyHoverSync(placeId);
        return;
      }

      if (typeof placeId === "string" && placeId.trim() !== "") {
        markerHoverIntentTimerId = window.setTimeout(() => {
          markerHoverIntentTimerId = null;
          applyHoverSync(placeId);
        }, Config.MARKER_HOVER_INTENT_MS);
        return;
      }

      markerHoverClearTimerId = window.setTimeout(() => {
        markerHoverClearTimerId = null;
        applyHoverSync(null);
      }, Config.MARKER_HOVER_CLEAR_MS);
    }

    function applyHoverSync(placeId) {
      const normalizedPlaceId = typeof placeId === "string" ? placeId.trim() : "";
      const nextPlaceId = normalizedPlaceId !== "" ? normalizedPlaceId : null;

      setHovered(nextPlaceId);
      if (typeof onHoverPlace === "function") {
        onHoverPlace(nextPlaceId);
      }
    }

    function clearHoverTimers() {
      if (markerHoverIntentTimerId) {
        window.clearTimeout(markerHoverIntentTimerId);
        markerHoverIntentTimerId = null;
      }

      if (markerHoverClearTimerId) {
        window.clearTimeout(markerHoverClearTimerId);
        markerHoverClearTimerId = null;
      }
    }

    function resolveNearestPanLatLng(place) {
      if (!map || !place) {
        return Leaflet.latLng(0, 0);
      }

      const sourceLat = Number(place.lat);
      const sourceLon = Number(place.lon);
      return resolveNearestPanLatLngFromCoords(sourceLat, sourceLon);
    }

    function resolveNearestPanLatLngFromCoords(rawLat, rawLon) {
      if (!map) {
        return Leaflet.latLng(0, 0);
      }

      const currentCenter = map.getCenter();
      const sourceLat = Number(rawLat);
      const sourceLon = Number(rawLon);
      let nearestLon = Number.isFinite(sourceLon) ? sourceLon : 0;
      const centerLon = Number.isFinite(currentCenter?.lng) ? currentCenter.lng : 0;

      while (nearestLon - centerLon > 180) {
        nearestLon -= 360;
      }

      while (nearestLon - centerLon < -180) {
        nearestLon += 360;
      }

      return Leaflet.latLng(
        Number.isFinite(sourceLat) ? sourceLat : 0,
        nearestLon
      );
    }

    function flyTo(placeId, options = {}) {
      const {
        onComplete,
        source: rawSource = ""
      } = options;
      if (!map) {
        return false;
      }

      const place = placeLookup.get(placeId) || markerRegistry.get(placeId)?.place || null;
      if (!place) {
        return false;
      }

      const targetLatLng = resolveNearestPanLatLng(place);
      const centerNow = map.getCenter();
      const currentZoom = map.getZoom();
      const distanceMeters = map.distance(centerNow, targetLatLng);
      const distanceKm = distanceMeters / 1000;
      const isNearTransition = distanceKm <= Config.FLY_PAN_ONLY_DISTANCE_KM;
      const interactionSource = normalizeText(rawSource, "").toLowerCase();
      const isMarkerFocusTransition = interactionSource === "map-marker";

      let targetZoom = currentZoom;
      if (isMarkerFocusTransition) {
        const distanceRatio = clamp(distanceKm / Config.MARKER_FOCUS_DISTANCE_KM, 0, 1);
        const focusedZoom =
          Config.MARKER_FOCUS_TARGET_ZOOM_MAX -
          (
            (Config.MARKER_FOCUS_TARGET_ZOOM_MAX - Config.MARKER_FOCUS_TARGET_ZOOM_MIN) *
            distanceRatio
          );
        const nearZoomBoost = distanceKm <= Config.MARKER_FOCUS_NEAR_DISTANCE_KM
          ? Config.MARKER_FOCUS_NEAR_ZOOM_BOOST
          : 0;
        targetZoom = clamp(
          Math.max(currentZoom + nearZoomBoost, focusedZoom),
          Config.MIN_ZOOM,
          Config.MARKER_FOCUS_TARGET_ZOOM_MAX
        );
      } else if (!isNearTransition) {
        const distanceRatio = clamp(distanceKm / Config.FLY_EASE_DISTANCE_KM, 0, 1);
        const interpolatedFarZoom =
          Config.FLY_FAR_TARGET_ZOOM_MAX -
          ((Config.FLY_FAR_TARGET_ZOOM_MAX - Config.FLY_FAR_TARGET_ZOOM_MIN) * distanceRatio);
        targetZoom = clamp(
          Math.max(currentZoom, interpolatedFarZoom),
          Config.MIN_ZOOM,
          Config.FLY_FAR_TARGET_ZOOM_MAX
        );
      }

      const noMovementNeeded =
        Math.abs(centerNow.lat - targetLatLng.lat) < 0.00001 &&
        Math.abs(centerNow.lng - targetLatLng.lng) < 0.00001 &&
        Math.abs(map.getZoom() - targetZoom) < 0.001;

      if (noMovementNeeded) {
        pulseMarkerSoon(placeId);
        if (typeof onComplete === "function") {
          onComplete();
        }
        return false;
      }

      const durationSeconds = computeFlyDurationSeconds(map, targetLatLng, targetZoom);
      const easeLinearity = computeFlyEaseLinearity(map, targetLatLng);
      const thisFlight = ++flyTransitionToken;

      map.once("moveend", () => {
        if (thisFlight !== flyTransitionToken) {
          return;
        }

        scheduleMarkerRefresh({ immediate: true, source: "flyTo-moveend" });
        pulseMarkerSoon(placeId);
        if (typeof onComplete === "function") {
          onComplete();
        }
      });

      hideMarkerTooltip({ immediate: true });
      clearTapPrime();
      map.stop();
      const shouldUsePanOnly = (
        isNearTransition &&
        !isMarkerFocusTransition &&
        Math.abs(targetZoom - currentZoom) < 0.08
      );
      if (shouldUsePanOnly) {
        map.panTo(targetLatLng, {
          animate: true,
          duration: Math.max(Config.FLY_DURATION_MIN_S, durationSeconds * 0.84),
          easeLinearity: clamp(easeLinearity + 0.04, 0.16, 0.26),
          noMoveStart: false
        });
      } else {
        const targetDuration = isMarkerFocusTransition
          ? clamp(durationSeconds * 0.82, Config.FLY_DURATION_MIN_S, Config.FLY_DURATION_MAX_S)
          : durationSeconds;
        const targetEaseLinearity = isMarkerFocusTransition
          ? clamp(easeLinearity + 0.02, 0.18, 0.28)
          : easeLinearity;
        map.flyTo(targetLatLng, targetZoom, {
          animate: true,
          duration: targetDuration,
          easeLinearity: targetEaseLinearity,
          noMoveStart: false
        });
      }

      return true;
    }

    function flyToCoordinates(lat, lon, options = {}) {
      const {
        targetZoom: rawTargetZoom = Config.NEAR_ME_TARGET_ZOOM,
        onComplete
      } = options;

      if (!map) {
        return false;
      }

      const latNumber = Number(lat);
      const lonNumber = Number(lon);
      if (!Number.isFinite(latNumber) || !Number.isFinite(lonNumber)) {
        return false;
      }

      const targetLatLng = resolveNearestPanLatLngFromCoords(latNumber, lonNumber);
      const currentZoom = map.getZoom();
      const targetZoom = clamp(
        Number.isFinite(Number(rawTargetZoom)) ? Number(rawTargetZoom) : currentZoom,
        Config.MIN_ZOOM,
        Config.MAX_ZOOM
      );

      const centerNow = map.getCenter();
      const noMovementNeeded =
        Math.abs(centerNow.lat - targetLatLng.lat) < 0.00001 &&
        Math.abs(centerNow.lng - targetLatLng.lng) < 0.00001 &&
        Math.abs(currentZoom - targetZoom) < 0.001;

      if (noMovementNeeded) {
        if (typeof onComplete === "function") {
          onComplete();
        }
        return false;
      }

      const durationSeconds = computeFlyDurationSeconds(map, targetLatLng, targetZoom);
      const easeLinearity = computeFlyEaseLinearity(map, targetLatLng);
      const thisFlight = ++flyTransitionToken;

      map.once("moveend", () => {
        if (thisFlight !== flyTransitionToken) {
          return;
        }
        scheduleMarkerRefresh({ immediate: true, source: "flyToCoordinates-moveend" });
        if (typeof onComplete === "function") {
          onComplete();
        }
      });

      hideMarkerTooltip({ immediate: true });
      clearTapPrime();
      map.stop();
      map.flyTo(targetLatLng, targetZoom, {
        animate: true,
        duration: durationSeconds,
        easeLinearity,
        noMoveStart: false
      });

      return true;
    }

    function fitToPlaces(places) {
      if (!Array.isArray(places) || places.length === 0 || !map) {
        return;
      }

      const coords = places.map((place) => [place.lat, place.lon]);
      const bounds = Leaflet.latLngBounds(coords);

      map.fitBounds(bounds.pad(0.28), {
        animate: true,
        duration: 1.26,
        easeLinearity: 0.19,
        maxZoom: 5
      });
    }

    function resetView() {
      if (!map) {
        return;
      }

      map.stop();
      map.setView([Config.DEFAULT_VIEW.lat, Config.DEFAULT_VIEW.lng], Config.DEFAULT_VIEW.zoom, {
        animate: true,
        duration: Config.RESET_FLY_DURATION_S,
        easeLinearity: 0.19
      });
    }

    function setZoom(targetZoom, options = {}) {
      const { animate = false } = options;
      if (!map) {
        return false;
      }

      const numericZoom = Number(targetZoom);
      if (!Number.isFinite(numericZoom)) {
        return false;
      }

      const nextZoom = clamp(numericZoom, Config.MIN_ZOOM, Config.MAX_ZOOM);
      if (Math.abs(map.getZoom() - nextZoom) < 0.001) {
        return false;
      }

      map.setZoom(nextZoom, { animate: Boolean(animate) });
      return true;
    }

    function scaleForZoom(zoomValue) {
      const numericZoom = Number(zoomValue);
      if (!Number.isFinite(numericZoom)) {
        return 1;
      }
      const zoomDelta = numericZoom - MARKER_ZOOM_SCALE_REFERENCE;
      const exponentialScale = Math.pow(2, -zoomDelta / 10);
      return clamp(exponentialScale, MARKER_ZOOM_SCALE_MIN, MARKER_ZOOM_SCALE_MAX);
    }

    function applyMarkerZoomScale(zoomValue) {
      if (!(mapElement instanceof HTMLElement)) {
        return;
      }
      const scale = round(scaleForZoom(zoomValue), 3);
      mapElement.style.setProperty("--map-marker-zoom-scale", String(scale));
    }

    function scheduleZoomEndMarkerRefresh() {
      if (zoomMarkerRefreshTimerId) {
        window.clearTimeout(zoomMarkerRefreshTimerId);
        zoomMarkerRefreshTimerId = null;
      }

      zoomMarkerRefreshTimerId = window.setTimeout(() => {
        zoomMarkerRefreshTimerId = null;
        scheduleMarkerRefresh({ immediate: true, force: true, source: "zoomend-batched" });
      }, ZOOM_END_REFRESH_DEBOUNCE_MS);
    }

    function logTilePaneDiagnostics(eventName) {
      if (!Boolean(window.__WAP_DEBUG_TILE_PANE__) || !(mapContainerEl instanceof HTMLElement)) {
        return;
      }

      const tilePaneEl = mapContainerEl.querySelector(".leaflet-tile-pane");
      const tileCount = tilePaneEl instanceof HTMLElement
        ? tilePaneEl.querySelectorAll(".leaflet-tile").length
        : 0;
      const computedStyle = tilePaneEl instanceof HTMLElement
        ? window.getComputedStyle(tilePaneEl)
        : null;
      const opacity = computedStyle?.opacity || "n/a";
      const visibility = computedStyle?.visibility || "n/a";
      console.debug(`[zoom] ${eventName} tileCount=${tileCount} opacity=${opacity} visibility=${visibility}`);
    }

    function setLowPowerEffects(shouldEnable, options = {}) {
      const { immediate = false } = options;

      if (!(mapElement instanceof HTMLElement)) {
        return;
      }

      if (lowPowerEffectsTimerId) {
        window.clearTimeout(lowPowerEffectsTimerId);
        lowPowerEffectsTimerId = null;
      }

      if (Boolean(shouldEnable)) {
        if (!lowPowerEffectsActive) {
          lowPowerEffectsActive = true;
          mapElement.classList.add("is-effects-low-power");
          setParticleEffectsPaused(true);
        }
        return;
      }

      const disableLowPowerEffects = () => {
        lowPowerEffectsTimerId = null;
        if (!(mapElement instanceof HTMLElement)) {
          lowPowerEffectsActive = false;
          return;
        }

        if (!lowPowerEffectsActive) {
          mapElement.classList.remove("is-effects-low-power");
          return;
        }

        lowPowerEffectsActive = false;
        mapElement.classList.remove("is-effects-low-power");
        setParticleEffectsPaused(false);
      };

      if (immediate) {
        disableLowPowerEffects();
        return;
      }

      lowPowerEffectsTimerId = window.setTimeout(disableLowPowerEffects, LOW_POWER_EFFECTS_RECOVERY_MS);
    }

    function setParticleEffectsPaused(shouldPause) {
      const controllers = collectParticleEffectsControllers();
      if (controllers.length === 0) {
        return;
      }

      for (const controller of controllers) {
        if (Boolean(shouldPause)) {
          try {
            controller.pause();
          } catch {}
          continue;
        }

        try {
          controller.resume();
        } catch {}
      }
    }

    function collectParticleEffectsControllers() {
      const controllers = [];
      collectParticlesJsControllers(controllers);
      collectTsParticlesControllers(controllers);
      return controllers;
    }

    function collectParticlesJsControllers(controllers) {
      if (!Array.isArray(window.pJSDom)) {
        return;
      }

      for (const entry of window.pJSDom) {
        const vendors = entry?.pJS?.fn?.vendors;
        if (!vendors || typeof vendors !== "object") {
          continue;
        }

        if (typeof vendors.stop !== "function" || typeof vendors.start !== "function") {
          continue;
        }

        controllers.push({
          pause: () => vendors.stop.call(vendors),
          resume: () => vendors.start.call(vendors)
        });
      }
    }

    function collectTsParticlesControllers(controllers) {
      const tsParticles = window.tsParticles;
      if (!tsParticles || typeof tsParticles !== "object") {
        return;
      }

      const rawContainers = typeof tsParticles.dom === "function"
        ? tsParticles.dom()
        : tsParticles.domArray;
      const containers = Array.isArray(rawContainers) ? rawContainers : [];
      for (const container of containers) {
        if (
          !container ||
          typeof container.pause !== "function" ||
          typeof container.play !== "function"
        ) {
          continue;
        }

        controllers.push({
          pause: () => container.pause(),
          resume: () => container.play()
        });
      }
    }

    function triggerRouteDrawMotion() {
      if (!mapElement) {
        return;
      }

      if (routeDrawMotionTimerId) {
        window.clearTimeout(routeDrawMotionTimerId);
        routeDrawMotionTimerId = null;
      }

      mapElement.classList.remove("is-route-drawing");
      requestAnimationFrame(() => {
        mapElement.classList.add("is-route-drawing");
      });

      routeDrawMotionTimerId = window.setTimeout(() => {
        routeDrawMotionTimerId = null;
        mapElement.classList.remove("is-route-drawing");
      }, Config.ROUTE_DRAW_MOTION_MS);
    }

    function drawRoute(routeInput, startPoint, endPoint) {
      if (!map || !routeLayerGroup) {
        return false;
      }

      const model = normalizeRouteModel(routeInput, startPoint, endPoint);
      if (!model || !Array.isArray(model.segments) || model.segments.length === 0) {
        return false;
      }

      clearRoute();
      triggerRouteDrawMotion();

      const haloToAnimate = [];
      const mainToAnimate = [];
      const allLatLngs = [];
      const routeMode = model.mode;
      const routeStyle = resolveRouteStyle(routeMode);

      for (const segment of model.segments) {
        const latLngs = normalizeRouteCoordinates(segment.coordinates);
        if (latLngs.length < 2) {
          continue;
        }

        for (const point of latLngs) {
          allLatLngs.push(point);
        }

        const haloLine = window.L.polyline(latLngs, {
          className: `route-line-halo route-line-halo--${routeMode}${segment.isFallback ? " is-fallback" : ""}`,
          color: routeStyle.haloColor,
          weight: routeStyle.haloWeight,
          opacity: 0.02,
          lineCap: "round",
          lineJoin: "round",
          smoothFactor: 1.4,
          renderer: routeRenderer || undefined,
          interactive: false
        });
        addRouteLayer(haloLine);
        haloToAnimate.push(haloLine);

        const mainLine = window.L.polyline(latLngs, {
          className: `route-line-main route-line-main--${routeMode}${segment.isFallback ? " is-fallback" : ""}`,
          color: routeStyle.mainColor,
          weight: routeStyle.mainWeight,
          opacity: 0.06,
          dashArray: routeStyle.dashArray,
          lineCap: "round",
          lineJoin: "round",
          smoothFactor: 1.3,
          renderer: routeRenderer || undefined,
          interactive: false
        });
        addRouteLayer(mainLine);
        mainToAnimate.push(mainLine);

        const arrows = buildRouteDirectionMarkers(latLngs, routeMode);
        for (const arrowMarker of arrows) {
          addRouteLayer(arrowMarker);
        }
      }

      const routePoints = Array.isArray(model.points) ? model.points : [];
      for (let index = 0; index < routePoints.length; index += 1) {
        const point = routePoints[index];
        const lat = Number(point?.lat);
        const lon = Number(point?.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
          continue;
        }

        const label = index < 26 ? String.fromCharCode(65 + index) : `${index + 1}`;
        const pointKind = index === 0
          ? "start"
          : (index === routePoints.length - 1 ? "end" : "mid");

        const marker = window.L.marker([lat, lon], {
          interactive: false,
          keyboard: false,
          icon: createRoutePointIcon(label, pointKind)
        });
        addRouteLayer(marker);
      }

      requestAnimationFrame(() => {
        for (const haloLine of haloToAnimate) {
          haloLine.setStyle({ opacity: routeStyle.haloOpacity });
        }
        for (const mainLine of mainToAnimate) {
          mainLine.setStyle({ opacity: routeStyle.mainOpacity });
        }
      });

      if (allLatLngs.length >= 2) {
        const bounds = window.L.latLngBounds(allLatLngs);
        map.fitBounds(bounds.pad(0.2), {
          animate: true,
          duration: Config.ROUTE_FIT_DURATION_S,
          easeLinearity: 0.2,
          maxZoom: model.maxZoom
        });
      }

      return routeDrawLayers.length > 0;
    }

    function drawDirectRoute(startPoint, endPoint) {
      return drawRoute(
        {
          mode: "car",
          points: [
            { lat: startPoint.lat, lon: startPoint.lon },
            { lat: endPoint.lat, lon: endPoint.lon }
          ],
          segments: [
            {
              coordinates: [
                [startPoint.lon, startPoint.lat],
                [endPoint.lon, endPoint.lat]
              ],
              isFallback: true
            }
          ]
        },
        startPoint,
        endPoint
      );
    }

    function normalizeRouteModel(routeInput, startPoint, endPoint) {
      if (Array.isArray(routeInput)) {
        const points = [];
        if (startPoint && Number.isFinite(Number(startPoint.lat)) && Number.isFinite(Number(startPoint.lon))) {
          points.push({ lat: Number(startPoint.lat), lon: Number(startPoint.lon) });
        }
        if (endPoint && Number.isFinite(Number(endPoint.lat)) && Number.isFinite(Number(endPoint.lon))) {
          points.push({ lat: Number(endPoint.lat), lon: Number(endPoint.lon) });
        }

        return {
          mode: "car",
          maxZoom: 7,
          points,
          segments: [
            {
              coordinates: routeInput,
              isFallback: true
            }
          ]
        };
      }

      if (!routeInput || typeof routeInput !== "object") {
        return null;
      }

      const modeRaw = normalizeText(routeInput.mode, "car").toLowerCase();
      const mode = (modeRaw === "walk" || modeRaw === "flight") ? modeRaw : "car";
      const maxZoom = mode === "walk" ? 8.8 : (mode === "flight" ? 5.6 : 7);
      const points = Array.isArray(routeInput.points) ? routeInput.points : [];
      const segments = Array.isArray(routeInput.segments) ? routeInput.segments : [];

      return {
        mode,
        maxZoom,
        points,
        segments
      };
    }

    function resolveRouteStyle(mode) {
      if (mode === "walk") {
        return {
          mainColor: "#7fc9f3",
          haloColor: "#214c67",
          mainWeight: 2.8,
          haloWeight: 7,
          dashArray: "3 8",
          mainOpacity: 0.96,
          haloOpacity: 0.38
        };
      }

      if (mode === "flight") {
        return {
          mainColor: "#9ab4ff",
          haloColor: "#2c3d6f",
          mainWeight: 3.4,
          haloWeight: 8,
          dashArray: "11 10",
          mainOpacity: 0.94,
          haloOpacity: 0.44
        };
      }

      return {
        mainColor: "#72cbbc",
        haloColor: "#27475f",
        mainWeight: 4.1,
        haloWeight: 9,
        dashArray: "",
        mainOpacity: 0.95,
        haloOpacity: 0.46
      };
    }

    function createRoutePointIcon(label, kind) {
      return window.L.divIcon({
        className: "route-point-icon",
        html:
          `<span class=\"route-point route-point--${kind}\">` +
          `<span class=\"route-point__label\">${label}</span>` +
          "</span>",
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });
    }

    function createRouteArrowIcon(angleDeg, mode) {
      const safeAngle = Number.isFinite(Number(angleDeg)) ? round(Number(angleDeg), 2) : 0;
      return window.L.divIcon({
        className: "route-direction-arrow-icon",
        html:
          `<span class=\"route-direction-arrow route-direction-arrow--${mode}\" style=\"--route-arrow-rotation:${safeAngle}deg\"></span>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      });
    }

    function buildRouteDirectionMarkers(latLngs, mode) {
      if (!map || !Array.isArray(latLngs) || latLngs.length < 2) {
        return [];
      }

      const markers = [];
      let carryPx = 0;
      const spacingPx = clamp(Number(Config.ROUTE_ARROW_SPACING_PX) || 170, 120, 240);
      const maxMarkers = Math.max(8, Number(Config.ROUTE_ARROW_MAX_MARKERS) || 72);

      for (let index = 0; index < latLngs.length - 1; index += 1) {
        if (markers.length >= maxMarkers) {
          break;
        }

        const startLatLng = latLngs[index];
        const endLatLng = latLngs[index + 1];
        let startLayerPoint = map.latLngToLayerPoint(startLatLng);
        const endLayerPoint = map.latLngToLayerPoint(endLatLng);
        let segmentPx = startLayerPoint.distanceTo(endLayerPoint);
        if (!Number.isFinite(segmentPx) || segmentPx <= 0.001) {
          continue;
        }

        const deltaX = endLayerPoint.x - startLayerPoint.x;
        const deltaY = endLayerPoint.y - startLayerPoint.y;
        const angle = (Math.atan2(deltaY, deltaX) * 180) / Math.PI;
        const vectorX = deltaX / segmentPx;
        const vectorY = deltaY / segmentPx;

        while ((carryPx + segmentPx) >= spacingPx && markers.length < maxMarkers) {
          const needPx = spacingPx - carryPx;
          const arrowPoint = window.L.point(
            startLayerPoint.x + (vectorX * needPx),
            startLayerPoint.y + (vectorY * needPx)
          );
          const arrowLatLng = map.layerPointToLatLng(arrowPoint);

          const marker = window.L.marker([arrowLatLng.lat, arrowLatLng.lng], {
            interactive: false,
            keyboard: false,
            icon: createRouteArrowIcon(angle, mode)
          });
          markers.push(marker);

          startLayerPoint = arrowPoint;
          segmentPx = startLayerPoint.distanceTo(endLayerPoint);
          carryPx = 0;
        }

        carryPx += segmentPx;
      }

      return markers;
    }

    function addRouteLayer(layer) {
      if (!layer || !routeLayerGroup) {
        return;
      }

      layer.addTo(routeLayerGroup);
      routeDrawLayers.push(layer);
    }

    function clearRoute() {
      if (!routeLayerGroup) {
        routeDrawLayers = [];
        return;
      }

      for (const layer of routeDrawLayers) {
        routeLayerGroup.removeLayer(layer);
      }
      routeDrawLayers = [];
    }

    function setDraftPlace(draftInput, options = {}) {
      if (!map || !draftLayer) {
        return false;
      }

      const lat = Number(draftInput?.lat);
      const lon = Number(draftInput?.lon ?? draftInput?.lng);
      if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
        return false;
      }
      if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
        return false;
      }

      const visibility = normalizePlaceVisibilityState(options.visibility ?? draftInput?.visibility_status);
      clearDraftPlace();

      const markerPlace = {
        id: "__draft_place__",
        region: normalizeText(draftInput?.region, ""),
        visibility_status: visibility
      };

      draftMarker = Leaflet.marker([lat, lon], {
        icon: createPinIcon(Leaflet, markerPlace, { isDraft: true }),
        keyboard: false,
        interactive: false
      });
      draftLayer.addLayer(draftMarker);

      const markerElement = draftMarker.getElement?.();
      if (markerElement instanceof HTMLElement) {
        markerElement.classList.add("is-mounted");
      }

      return true;
    }

    function clearDraftPlace() {
      if (!draftLayer) {
        draftMarker = null;
        return;
      }

      if (draftMarker) {
        draftLayer.removeLayer(draftMarker);
        draftMarker = null;
      }
    }

    function setUserLocation(location) {
      if (!map || !userLocationLayer) {
        return false;
      }

      const lat = Number(location?.lat);
      const lon = Number(location?.lon);
      const accuracy = Number(location?.accuracy);
      const label = normalizeText(location?.label, "");

      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        clearUserLocation();
        return false;
      }

      const latLng = window.L.latLng(lat, lon);
      const safeAccuracy = Number.isFinite(accuracy)
        ? clamp(accuracy, 40, 1800)
        : 0;

      if (!userAccuracyCircle && safeAccuracy > 0) {
        userAccuracyCircle = window.L.circle(latLng, {
          radius: safeAccuracy,
          color: "rgba(114, 203, 188, 0.45)",
          weight: 1.2,
          opacity: 0.62,
          fillColor: "rgba(114, 203, 188, 0.14)",
          fillOpacity: 0.2,
          interactive: false
        }).addTo(userLocationLayer);
      } else if (userAccuracyCircle) {
        if (safeAccuracy > 0) {
          userAccuracyCircle.setLatLng(latLng);
          userAccuracyCircle.setRadius(safeAccuracy);
        } else {
          userLocationLayer.removeLayer(userAccuracyCircle);
          userAccuracyCircle = null;
        }
      }

      if (!userLocationMarker) {
        userLocationMarker = window.L.circleMarker(latLng, {
          radius: 7.5,
          color: "rgba(206, 247, 239, 0.94)",
          weight: 2,
          opacity: 0.95,
          fillColor: "rgba(114, 203, 188, 0.96)",
          fillOpacity: 0.88,
          interactive: false
        }).addTo(userLocationLayer);
      } else {
        userLocationMarker.setLatLng(latLng);
      }
      syncUserLocationTooltip(label);

      if (typeof userLocationMarker.bringToFront === "function") {
        userLocationMarker.bringToFront();
      }

      return true;
    }

    function syncUserLocationTooltip(label) {
      if (!userLocationMarker) {
        return;
      }

      const tooltip = typeof userLocationMarker.getTooltip === "function"
        ? userLocationMarker.getTooltip()
        : null;

      if (!label) {
        if (tooltip && typeof userLocationMarker.unbindTooltip === "function") {
          userLocationMarker.unbindTooltip();
        }
        return;
      }

      if (!tooltip && typeof userLocationMarker.bindTooltip === "function") {
        userLocationMarker.bindTooltip(label, {
          permanent: true,
          direction: "top",
          offset: [0, -12],
          opacity: 0.98,
          className: "map-user-location-tooltip"
        });
        return;
      }

      if (tooltip && typeof tooltip.setContent === "function") {
        tooltip.setContent(label);
      }
    }

    function clearUserLocation() {
      if (!userLocationLayer) {
        userLocationMarker = null;
        userAccuracyCircle = null;
        return;
      }

      if (userLocationMarker) {
        userLocationLayer.removeLayer(userLocationMarker);
        userLocationMarker = null;
      }

      if (userAccuracyCircle) {
        userLocationLayer.removeLayer(userAccuracyCircle);
        userAccuracyCircle = null;
      }
    }

    function armCoordinatePick(options = {}) {
      const {
        onPick,
        onCancel,
        target = "point",
        hint = ""
      } = options;

      if (typeof onPick !== "function") {
        throw new TypeError("Coordinate pick requires onPick callback.");
      }

      if (coordinatePickSession) {
        cancelCoordinatePick("replaced");
      }

      coordinatePickSession = {
        target,
        onPick,
        onCancel,
        hint: normalizeText(hint, "")
      };
      updateCoordinatePickVisualState();
    }

    function cancelCoordinatePick(reason = "cancelled") {
      if (!coordinatePickSession) {
        return false;
      }

      const previousSession = coordinatePickSession;
      coordinatePickSession = null;
      updateCoordinatePickVisualState();

      if (typeof previousSession.onCancel === "function") {
        previousSession.onCancel({
          reason,
          target: previousSession.target
        });
      }

      return true;
    }

    function isCoordinatePickActive(target = "") {
      if (!coordinatePickSession) {
        return false;
      }

      if (!target) {
        return true;
      }

      return coordinatePickSession.target === target;
    }

    function focusMarker(placeId) {
      const markerElement = getMarkerElement(placeId);
      if (!(markerElement instanceof HTMLElement)) {
        return false;
      }

      markerElement.focus();
      return true;
    }

    function getMarkerElement(placeId) {
      const entry = markerRegistry.get(placeId);
      if (!entry) {
        return null;
      }

      const markerElement = entry.marker.getElement();
      return markerElement instanceof HTMLElement ? markerElement : null;
    }

    function getPopupAnchor(placeId) {
      if (!map) {
        return null;
      }

      const place = markerRegistry.get(placeId)?.place || placeLookup.get(placeId);
      if (place) {
        const mapContainer = map.getContainer();
        const mapRect = mapContainer.getBoundingClientRect();
        const anchorLatLng = resolveNearestPanLatLng(place);
        const anchorPoint = map.latLngToContainerPoint(anchorLatLng);

        return {
          x: round(mapRect.left + anchorPoint.x, 2),
          y: round(mapRect.top + anchorPoint.y - 8, 2)
        };
      }

      const markerElement = getMarkerElement(placeId);
      if (!(markerElement instanceof HTMLElement)) {
        return null;
      }

      const markerRect = markerElement.getBoundingClientRect();
      return {
        x: round(markerRect.left + (markerRect.width / 2), 2),
        y: round(markerRect.top + Math.max(6, markerRect.height * 0.22), 2)
      };
    }

    function pulseMarkerSoon(placeId, options = {}) {
      const normalizedPlaceId = typeof placeId === "string" ? placeId.trim() : "";
      if (!normalizedPlaceId) {
        return false;
      }

      const attemptsRaw = Number(options.attempts);
      const attempts = Number.isFinite(attemptsRaw)
        ? clamp(Math.round(attemptsRaw), 1, 6)
        : 4;

      const runAttempt = (remaining) => {
        if (pulseMarker(normalizedPlaceId, options)) {
          return;
        }
        if (remaining <= 0) {
          return;
        }
        window.requestAnimationFrame(() => {
          runAttempt(remaining - 1);
        });
      };

      runAttempt(attempts);
      return true;
    }

    function pulseMarker(placeId, options = {}) {
      const markerElement = getMarkerElement(placeId);
      if (!(markerElement instanceof HTMLElement)) {
        return false;
      }

      const rawDurationMs = Number(options.durationMs);
      const durationMs = Number.isFinite(rawDurationMs)
        ? clamp(Math.round(rawDurationMs), 700, 2200)
        : MARKER_PULSE_DEFAULT_MS;

      const previousTimerId = markerPulseTimers.get(placeId);
      if (previousTimerId) {
        window.clearTimeout(previousTimerId);
      }

      markerElement.classList.remove("map-pin-icon--pulse");
      window.requestAnimationFrame(() => {
        if (markerElement.isConnected) {
          markerElement.classList.add("map-pin-icon--pulse");
        }
      });

      const cleanupTimerId = window.setTimeout(() => {
        markerPulseTimers.delete(placeId);
        markerElement.classList.remove("map-pin-icon--pulse");
      }, durationMs + 90);

      markerPulseTimers.set(placeId, cleanupTimerId);
      return true;
    }

    function spotlight(placeId, options = {}) {
      const markerElement = getMarkerElement(placeId);
      if (!(markerElement instanceof HTMLElement)) {
        return false;
      }

      const rawCycles = Number(options.cycles);
      const cycles = Number.isFinite(rawCycles)
        ? clamp(Math.round(rawCycles), 1, 3)
        : Config.MARKER_SPOTLIGHT_CYCLES;
      const cycleMs = Math.max(360, Number(Config.MARKER_SPOTLIGHT_CYCLE_MS) || 600);
      const totalDurationMs = Math.max(420, cycles * cycleMs);

      markerElement.style.setProperty("--pin-spotlight-cycles", String(cycles));
      markerElement.style.setProperty("--pin-spotlight-cycle-ms", `${cycleMs}ms`);
      markerElement.classList.remove("is-spotlight");
      window.requestAnimationFrame(() => {
        if (markerElement.isConnected) {
          markerElement.classList.add("is-spotlight");
        }
      });

      const previousTimerId = markerSpotlightTimers.get(placeId);
      if (previousTimerId) {
        window.clearTimeout(previousTimerId);
      }

      const cleanupTimerId = window.setTimeout(() => {
        markerSpotlightTimers.delete(placeId);
        markerElement.classList.remove("is-spotlight");
        markerElement.style.removeProperty("--pin-spotlight-cycles");
        markerElement.style.removeProperty("--pin-spotlight-cycle-ms");
      }, totalDurationMs + 80);

      markerSpotlightTimers.set(placeId, cleanupTimerId);
      return true;
    }

    function clearPulseTimers() {
      for (const timerId of markerPulseTimers.values()) {
        window.clearTimeout(timerId);
      }
      markerPulseTimers.clear();
    }

    function clearSpotlightTimers() {
      for (const timerId of markerSpotlightTimers.values()) {
        window.clearTimeout(timerId);
      }
      markerSpotlightTimers.clear();
    }

    function shouldPrimeTapSelection(placeId) {
      if (!isTouchInteractionMode()) {
        return false;
      }

      if (markerTapPrimedPlaceId === placeId) {
        clearTapPrime();
        return false;
      }

      markerTapPrimedPlaceId = placeId;

      if (markerTapPrimeTimerId) {
        window.clearTimeout(markerTapPrimeTimerId);
      }

      markerTapPrimeTimerId = window.setTimeout(() => {
        markerTapPrimeTimerId = null;
        markerTapPrimedPlaceId = null;
      }, Config.MARKER_TAP_PRIME_TIMEOUT_MS);

      return true;
    }

    function clearTapPrime() {
      markerTapPrimedPlaceId = null;
      if (markerTapPrimeTimerId) {
        window.clearTimeout(markerTapPrimeTimerId);
        markerTapPrimeTimerId = null;
      }
    }

    function openMarkerTooltip(placeId) {
      if (!map || !markersLayer || !placeId) {
        return false;
      }

      const entry = markerRegistry.get(placeId);
      if (!entry) {
        return false;
      }

      if (!(entry.marker.getElement() instanceof HTMLElement)) {
        return false;
      }

      if (markerTooltipHideTimerId) {
        window.clearTimeout(markerTooltipHideTimerId);
        markerTooltipHideTimerId = null;
      }

      if (activeTooltipPlaceId && activeTooltipPlaceId !== placeId) {
        closeActiveMarkerTooltip();
      }

      const tooltipDirection = resolveMarkerTooltipDirection(entry.place);
      const tooltipOffset = resolveMarkerTooltipOffset(tooltipDirection);
      const tooltipCategory = resolvePlaceCategory(entry.place);
      const tooltipContent = buildMarkerTooltipContent(entry.place, tooltipCategory);

      if (entry.marker.getTooltip()) {
        entry.marker.unbindTooltip();
      }

      entry.marker.bindTooltip(tooltipContent, {
        direction: tooltipDirection,
        offset: tooltipOffset,
        className: `map-marker-tooltip map-marker-tooltip--light map-marker-tooltip--${tooltipCategory.tone}`,
        opacity: 1,
        sticky: false,
        permanent: false,
        interactive: false
      });

      entry.marker.openTooltip();
      activeTooltipMarker = entry.marker;
      activeTooltipPlaceId = placeId;

      return true;
    }

    function hideMarkerTooltip(options = {}) {
      const { immediate = false } = options;
      if (!activeTooltipMarker) {
        return;
      }

      if (markerTooltipHideTimerId) {
        window.clearTimeout(markerTooltipHideTimerId);
        markerTooltipHideTimerId = null;
      }

      if (immediate) {
        closeActiveMarkerTooltip();
        return;
      }

      markerTooltipHideTimerId = window.setTimeout(() => {
        markerTooltipHideTimerId = null;
        closeActiveMarkerTooltip();
      }, Config.MARKER_TOOLTIP_HIDE_DELAY_MS);
    }

    function closeActiveMarkerTooltip() {
      if (!activeTooltipMarker) {
        activeTooltipPlaceId = null;
        return;
      }

      try {
        activeTooltipMarker.closeTooltip();
      } catch (error) {
        console.error("Tooltip close error:", error);
      }

      activeTooltipMarker = null;
      activeTooltipPlaceId = null;
    }

    function isTouchInteractionMode() {
      return Boolean(
        touchInteractionMediaQuery.matches ||
        (typeof navigator.maxTouchPoints === "number" && navigator.maxTouchPoints > 0)
      );
    }

    function resolveMarkerTooltipDirection(place) {
      if (!map || !place) {
        return "top";
      }

      const containerSize = map.getSize();
      const markerPoint = map.latLngToContainerPoint(resolveNearestPanLatLng(place));

      if (markerPoint.y <= containerSize.y * 0.24) {
        return "bottom";
      }
      if (markerPoint.y >= containerSize.y * 0.8) {
        return "top";
      }
      if (markerPoint.x <= containerSize.x * 0.22) {
        return "right";
      }
      if (markerPoint.x >= containerSize.x * 0.78) {
        return "left";
      }

      return "top";
    }

    function resolveMarkerTooltipOffset(direction) {
      if (direction === "bottom") {
        return [0, 22];
      }
      if (direction === "left") {
        return [-22, -2];
      }
      if (direction === "right") {
        return [22, -2];
      }
      return [0, -24];
    }

    function buildMarkerTooltipContent(place, category) {
      const container = document.createElement("span");
      container.className = "map-marker-tooltip__content";

      const title = document.createElement("strong");
      title.className = "map-marker-tooltip__title";
      title.textContent = normalizeText(place?.name ?? place?.title, "Place");
      container.append(title);

      const meta = document.createElement("span");
      meta.className = "map-marker-tooltip__meta";
      const countryLabel = normalizeText(place?.country, "");
      const regionLabel = normalizeText(place?.region, "Регион не указан");
      meta.textContent = countryLabel || regionLabel;
      container.append(meta);

      const kindBadge = document.createElement("span");
      kindBadge.className = "map-marker-tooltip__kind";
      kindBadge.textContent = `${category.icon} ${category.label}`;
      container.append(kindBadge);

      return container;
    }

    function invalidateSize() {
      if (map) {
        map.invalidateSize();
      }
    }

    function getView() {
      if (!map) {
        return { ...Config.DEFAULT_VIEW };
      }

      const center = map.getCenter();
      return {
        lat: round(center.lat, 5),
        lng: round(center.lng, 5),
        zoom: round(map.getZoom(), 2)
      };
    }

    function createMarkerClusterLayer() {
      if (typeof Leaflet.markerClusterGroup === "function") {
        try {
          return Leaflet.markerClusterGroup({
            chunkedLoading: true,
            chunkInterval: MARKER_LAYER_CHUNK_INTERVAL_MS,
            chunkDelay: MARKER_LAYER_CHUNK_DELAY_MS,
            chunkAddThreshold: MARKER_LAYER_CHUNK_THRESHOLD,
            animate: false,
            animateAddingMarkers: false,
            showCoverageOnHover: false,
            spiderfyOnMaxZoom: false
          });
        } catch (error) {
          console.warn("Marker cluster fallback to LayerGroup:", error);
        }
      }

      return Leaflet.layerGroup();
    }

    function addLayersBatch(layers) {
      if (!markersLayer || !Array.isArray(layers) || layers.length === 0) {
        return;
      }

      const safeLayers = layers.filter(Boolean);
      if (safeLayers.length === 0) {
        return;
      }

      if (typeof markersLayer.addLayers === "function") {
        markersLayer.addLayers(safeLayers);
        return;
      }

      for (const layer of safeLayers) {
        markersLayer.addLayer(layer);
      }
    }

    function removeLayersBatch(layers) {
      if (!markersLayer || !Array.isArray(layers) || layers.length === 0) {
        return;
      }

      const safeLayers = layers.filter(Boolean);
      if (safeLayers.length === 0) {
        return;
      }

      if (typeof markersLayer.removeLayers === "function") {
        markersLayer.removeLayers(safeLayers);
        return;
      }

      for (const layer of safeLayers) {
        markersLayer.removeLayer(layer);
      }
    }

    function queueMarkerDecoration(marker, place) {
      if (!marker || !place || !place.id) {
        return;
      }

      pendingMarkerDecoration.set(place.id, { marker, place });
      scheduleMarkerDecorationFlush();
    }

    function scheduleMarkerDecorationFlush() {
      if (markerDecorationRafId) {
        return;
      }
      markerDecorationRafId = window.requestAnimationFrame(() => {
        markerDecorationRafId = null;
        flushPendingMarkerDecorations();
      });
    }

    function flushPendingMarkerDecorations() {
      if (pendingMarkerDecoration.size === 0) {
        return;
      }

      let processed = 0;
      const iterator = pendingMarkerDecoration.entries();
      while (processed < MARKER_DECORATION_CHUNK_SIZE) {
        const next = iterator.next();
        if (next.done) {
          break;
        }

        const [placeId, payload] = next.value;
        pendingMarkerDecoration.delete(placeId);
        processed += 1;

        if (!payload) {
          continue;
        }

        decorateMarkerElement(payload.marker, payload.place);
      }

      if (pendingMarkerDecoration.size > 0) {
        scheduleMarkerDecorationFlush();
      }
    }

    function buildPlaceVisualKey(place) {
      const visibility = normalizePlaceVisibilityState(place?.visibility_status ?? place?.visibility);
      const scope = normalizeText(
        place?.place_scope ?? place?.scope ?? place?.source_scope,
        "public"
      ).toLowerCase();
      const region = normalizeText(place?.region, "world").toLowerCase();
      return `${visibility}|${scope}|${region}`;
    }

    function mergeMarkerRefreshSource(currentSource, nextSource) {
      const leftToken = normalizePerfToken(currentSource, "");
      const rightToken = normalizePerfToken(nextSource, "");
      const left = leftToken === "unspecified" ? "" : leftToken;
      const right = rightToken === "unspecified" ? "" : rightToken;
      if (!left) {
        return right || "unspecified";
      }
      if (!right) {
        return left;
      }
      if (left === right) {
        return left;
      }

      const sourceSet = new Set([
        ...left.split("+"),
        ...right.split("+")
      ]);
      return Array.from(sourceSet).filter(Boolean).join("+") || "unspecified";
    }

    function deferMarkerRefreshWhileMotion(source, force) {
      const sourceToken = normalizePerfToken(source, "unspecified");
      if (!pendingMotionMarkerRefresh) {
        pendingMotionMarkerRefresh = {
          force: false,
          source: "unspecified"
        };
      }

      pendingMotionMarkerRefresh.force = pendingMotionMarkerRefresh.force || Boolean(force);
      pendingMotionMarkerRefresh.source = mergeMarkerRefreshSource(
        pendingMotionMarkerRefresh.source,
        sourceToken
      );
      countPerfEvent("map.markerRefresh.deferredWhileMotion");
    }

    function flushDeferredMarkerRefresh(options = {}) {
      const {
        source = "motion-end",
        force = false
      } = options;
      if (!pendingMotionMarkerRefresh) {
        return false;
      }

      const mergedForce = pendingMotionMarkerRefresh.force || Boolean(force);
      const mergedSource = mergeMarkerRefreshSource(
        pendingMotionMarkerRefresh.source,
        source
      );
      pendingMotionMarkerRefresh = null;

      scheduleMarkerRefresh({
        immediate: true,
        force: mergedForce,
        source: mergedSource,
        allowDuringMotion: true
      });
      return true;
    }

    function scheduleMarkerRefresh(options = {}) {
      const {
        immediate = false,
        force = false,
        source = "unspecified",
        allowDuringMotion = false
      } = options;
      if (!map || !markersLayer || !markersVisible) {
        return;
      }

      const sourceToken = normalizePerfToken(source, "unspecified");
      countPerfEvent(`map.markerRefresh.scheduled.${sourceToken}`);

      if (isMapInMotion && !allowDuringMotion) {
        deferMarkerRefreshWhileMotion(sourceToken, force);
        return;
      }

      if (isZooming && !force) {
        countPerfEvent("map.markerRefresh.skippedWhileZooming");
        return;
      }

      const now = performance.now();
      if (isMapInMotion && !force && (now - lastMarkerRefreshAt) < MARKER_REFRESH_MOTION_THROTTLE_MS) {
        deferMarkerRefreshWhileMotion(sourceToken, force);
        countPerfEvent("map.markerRefresh.throttledWhileMotion");
        return;
      }

      if (immediate) {
        if (markerRefreshTimerId) {
          window.clearTimeout(markerRefreshTimerId);
          markerRefreshTimerId = null;
        }
        pendingDebouncedRefreshForce = false;
        pendingDebouncedRefreshSource = "unspecified";
        queueMarkerRefreshFrame({ force, source: sourceToken });
        return;
      }

      pendingDebouncedRefreshForce = pendingDebouncedRefreshForce || Boolean(force);
      pendingDebouncedRefreshSource = mergeMarkerRefreshSource(
        pendingDebouncedRefreshSource,
        sourceToken
      );

      if (markerRefreshTimerId) {
        countPerfEvent("map.markerRefresh.debounceMerged");
        return;
      }

      markerRefreshTimerId = window.setTimeout(() => {
        markerRefreshTimerId = null;
        const nextForce = pendingDebouncedRefreshForce;
        const nextSource = pendingDebouncedRefreshSource;
        pendingDebouncedRefreshForce = false;
        pendingDebouncedRefreshSource = "unspecified";
        queueMarkerRefreshFrame({ force: nextForce, source: nextSource });
      }, MARKER_REFRESH_DEBOUNCE_MS);
    }

    function queueMarkerRefreshFrame(options = {}) {
      const { force = false, source = "unspecified" } = options;
      if (!map || !markersLayer) {
        return;
      }
      if (isZooming && !force) {
        countPerfEvent("map.markerRefresh.frameSkippedWhileZooming");
        return;
      }

      markerRefreshQueuedForce = markerRefreshQueuedForce || Boolean(force);
      markerRefreshQueuedSource = mergeMarkerRefreshSource(
        markerRefreshQueuedSource,
        source
      );

      if (markerRefreshRafId) {
        countPerfEvent("map.markerRefresh.rafMerged");
        return;
      }

      markerRefreshRafId = window.requestAnimationFrame(() => {
        markerRefreshRafId = null;
        const nextForce = markerRefreshQueuedForce;
        const nextSource = markerRefreshQueuedSource;
        markerRefreshQueuedForce = false;
        markerRefreshQueuedSource = "unspecified";
        lastMarkerRefreshAt = performance.now();
        renderVisibleMarkers({ force: nextForce, source: nextSource });
      });
    }

    function renderVisibleMarkers(options = {}) {
      const { force = false, source = "unspecified" } = options;
      if (!map || !markersLayer || !markersVisible) {
        return;
      }
      if (isZooming && !force) {
        countPerfEvent("map.renderVisibleMarkers.skippedWhileZooming");
        return;
      }

      const sourceToken = normalizePerfToken(source, "unspecified");
      countPerfEvent("map.renderVisibleMarkers");
      countPerfEvent(`map.renderVisibleMarkers.source.${sourceToken}`);
      const renderStartedAt = performance.now();

      const visibleEntries = measurePerfSync(
        "map.renderVisibleMarkers.computeVisibleEntries",
        () => computeVisibleEntries()
      );
      const useClusterMode = resolveClusterMode(visibleEntries.length);
      const renderPlan = measurePerfSync(
        "map.renderVisibleMarkers.buildRenderPlan",
        () => buildRenderPlan(visibleEntries, useClusterMode)
      );
      clusterModeEnabled = useClusterMode;

      const placeLayersToAdd = [];
      const placeLayersToRemove = [];
      const clusterLayersToAdd = [];
      const clusterLayersToRemove = [];
      const clusterLayersToRecycle = [];
      const nextPlaceIds = new Set();
      const nextPlaceMap = new Map();
      const reconcileStartedAt = performance.now();
      measurePerfSync("map.renderVisibleMarkers.reconcile", () => {
        for (const entry of renderPlan.places) {
          const placeId = entry.place.id;
          nextPlaceIds.add(placeId);
          nextPlaceMap.set(placeId, entry);
        }

        for (const [placeId, markerEntry] of markerRegistry) {
          if (!nextPlaceIds.has(placeId)) {
            removePlaceMarker(placeId, { deferLayerRemoval: placeLayersToRemove });
            continue;
          }

          const nextEntry = nextPlaceMap.get(placeId);
          const placeChanged = markerEntry.place !== nextEntry.place;
          markerEntry.place = nextEntry.place;
          markerEntry.marker.__placeData = nextEntry.place;
          syncPlaceMarkerLatLng(markerEntry.marker, nextEntry.latLng);
          const nextVisualKey = buildPlaceVisualKey(nextEntry.place);
          if (markerEntry.visualKey !== nextVisualKey && typeof markerEntry.marker.setIcon === "function") {
            markerEntry.marker.setIcon(createPinIcon(Leaflet, nextEntry.place));
            markerEntry.visualKey = nextVisualKey;
            const cachedMarker = markerCache.get(placeId);
            if (cachedMarker) {
              cachedMarker.visualKey = nextVisualKey;
            }
            queueMarkerDecoration(markerEntry.marker, nextEntry.place);
            continue;
          }

          if (placeChanged) {
            queueMarkerDecoration(markerEntry.marker, nextEntry.place);
          }
        }

        for (const entry of renderPlan.places) {
          const placeId = entry.place.id;
          if (markerRegistry.has(placeId)) {
            continue;
          }

          const nextVisualKey = buildPlaceVisualKey(entry.place);
          let cachedMarker = markerCache.get(placeId);
          if (!cachedMarker) {
            const marker = createPlaceMarker(entry.place, entry.latLng);
            cachedMarker = { marker, visualKey: nextVisualKey };
            markerCache.set(placeId, cachedMarker);
          } else if (
            cachedMarker.visualKey !== nextVisualKey &&
            typeof cachedMarker.marker.setIcon === "function"
          ) {
            cachedMarker.marker.setIcon(createPinIcon(Leaflet, entry.place));
            cachedMarker.visualKey = nextVisualKey;
          }

          cachedMarker.marker.__placeData = entry.place;
          syncPlaceMarkerLatLng(cachedMarker.marker, entry.latLng);
          markerRegistry.set(placeId, {
            marker: cachedMarker.marker,
            place: entry.place,
            visualKey: cachedMarker.visualKey
          });
          placeLayersToAdd.push(cachedMarker.marker);
          queueMarkerDecoration(cachedMarker.marker, entry.place);
        }

        const nextClusterKeys = new Set();
        for (const clusterData of renderPlan.clusters) {
          nextClusterKeys.add(clusterData.key);

          const existingCluster = clusterRegistry.get(clusterData.key);
          if (existingCluster) {
            existingCluster.marker.__clusterMeta = clusterData;
            syncPlaceMarkerLatLng(existingCluster.marker, clusterData.latLng);
            if (existingCluster.memberCount !== clusterData.memberCount) {
              existingCluster.marker.setIcon(createClusterIcon(clusterData.memberCount));
              existingCluster.memberCount = clusterData.memberCount;
            }
            continue;
          }

          let clusterMarker = null;
          if (clusterMarkerPool.length > 0) {
            clusterMarker = clusterMarkerPool.pop();
            clusterMarker.__clusterMeta = clusterData;
            syncPlaceMarkerLatLng(clusterMarker, clusterData.latLng);
            clusterMarker.setIcon(createClusterIcon(clusterData.memberCount));
          } else {
            clusterMarker = createClusterMarker(clusterData);
          }

          clusterRegistry.set(clusterData.key, {
            marker: clusterMarker,
            memberCount: clusterData.memberCount
          });
          clusterLayersToAdd.push(clusterMarker);
        }

        for (const clusterKey of Array.from(clusterRegistry.keys())) {
          if (nextClusterKeys.has(clusterKey)) {
            continue;
          }
          removeClusterMarker(clusterKey, {
            deferLayerRemoval: clusterLayersToRemove,
            recyclePool: clusterLayersToRecycle
          });
        }
      });
      const reconcileDurationMs = performance.now() - reconcileStartedAt;

      const layerApplyStartedAt = performance.now();
      measurePerfSync("map.renderVisibleMarkers.applyLayers", () => {
        removeLayersBatch(placeLayersToRemove);
        removeLayersBatch(clusterLayersToRemove);
        for (const clusterMarker of clusterLayersToRecycle) {
          recycleClusterMarker(clusterMarker);
        }
        addLayersBatch(placeLayersToAdd);
        addLayersBatch(clusterLayersToAdd);
      });
      const layerApplyDurationMs = performance.now() - layerApplyStartedAt;

      if (activeTooltipPlaceId && !markerRegistry.has(activeTooltipPlaceId)) {
        closeActiveMarkerTooltip();
      }

      if (hoveredPlaceId && !markerRegistry.has(hoveredPlaceId)) {
        hideMarkerTooltip({ immediate: true });
      }

      if (activePlaceId) {
        toggleMarkerStateClass(activePlaceId, "is-active", markerRegistry.has(activePlaceId));
        syncMarkerVisualPriority(activePlaceId);
      }

      if (hoveredPlaceId) {
        toggleMarkerStateClass(hoveredPlaceId, "is-hovered", markerRegistry.has(hoveredPlaceId));
        syncMarkerVisualPriority(hoveredPlaceId);
      }

      const renderDurationMs = performance.now() - renderStartedAt;
      if (renderDurationMs >= PERF_RENDER_LOG_THRESHOLD_MS) {
        logMapPerf("renderVisibleMarkers", {
          source: sourceToken,
          durationMs: roundPerfMs(renderDurationMs),
          reconcileMs: roundPerfMs(reconcileDurationMs),
          applyLayersMs: roundPerfMs(layerApplyDurationMs),
          visibleEntries: visibleEntries.length,
          placesPlanned: renderPlan.places.length,
          clustersPlanned: renderPlan.clusters.length,
          placeAdd: placeLayersToAdd.length,
          placeRemove: placeLayersToRemove.length,
          clusterAdd: clusterLayersToAdd.length,
          clusterRemove: clusterLayersToRemove.length
        });
        countPerfEvent("map.renderVisibleMarkers.slow");
      }
    }

    function computeVisibleEntries() {
      if (!map || allPlaces.length === 0) {
        return [];
      }

      const bounds = map.getBounds();
      const mapCenter = map.getCenter();
      const centerLng = Number.isFinite(mapCenter?.lng) ? mapCenter.lng : 0;
      const shouldFilterByLongitude = !isGlobalLongitudeViewport(bounds);
      const south = bounds.getSouth();
      const north = bounds.getNorth();
      const west = resolveWrappedLongitudeNear(bounds.getWest(), centerLng);
      const east = resolveWrappedLongitudeNear(bounds.getEast(), centerLng);
      const minLng = Math.min(west, east);
      const maxLng = Math.max(west, east);

      const latSpan = Math.max(0.01, north - south);
      const lngSpan = Math.max(0.01, maxLng - minLng);
      const latPadding = latSpan * VIEWPORT_BUFFER_RATIO;
      const lngPadding = lngSpan * VIEWPORT_BUFFER_RATIO;
      const minLat = Math.max(-90, south - latPadding);
      const maxLat = Math.min(90, north + latPadding);
      const minBufferedLng = minLng - lngPadding;
      const maxBufferedLng = maxLng + lngPadding;

      const visibleEntries = [];
      for (const place of allPlaces) {
        const lat = Number(place.lat);
        const lon = Number(place.lon);

        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
          continue;
        }
        if (lat < minLat || lat > maxLat) {
          continue;
        }

        const wrappedLon = resolveWrappedLongitudeNear(lon, centerLng);
        if (shouldFilterByLongitude && (wrappedLon < minBufferedLng || wrappedLon > maxBufferedLng)) {
          continue;
        }

        visibleEntries.push({
          place,
          latLng: Leaflet.latLng(lat, wrappedLon)
        });
      }

      return visibleEntries;
    }

    function isGlobalLongitudeViewport(bounds) {
      if (!map) {
        return false;
      }

      const west = Number(bounds?.getWest?.());
      const east = Number(bounds?.getEast?.());
      let longitudeSpan = 0;

      if (Number.isFinite(west) && Number.isFinite(east)) {
        longitudeSpan = east - west;
        if (longitudeSpan < 0) {
          longitudeSpan += 360;
        }
        if (longitudeSpan > 360) {
          longitudeSpan = 360;
        }
      }

      if (longitudeSpan >= 340) {
        return true;
      }

      const zoom = Number(map.getZoom());
      const worldWidthPx =
        Number.isFinite(zoom) && map.options?.crs && typeof map.options.crs.scale === "function"
          ? Number(map.options.crs.scale(zoom))
          : NaN;
      const viewportWidthPx = Number(map.getSize?.()?.x);

      if (!Number.isFinite(worldWidthPx) || worldWidthPx <= 0 || !Number.isFinite(viewportWidthPx)) {
        return false;
      }

      return viewportWidthPx >= (worldWidthPx * 0.98);
    }

    function resolveWrappedLongitudeNear(rawLon, referenceLon) {
      let nextLon = Number.isFinite(Number(rawLon)) ? Number(rawLon) : 0;
      const targetLon = Number.isFinite(Number(referenceLon)) ? Number(referenceLon) : 0;

      while ((nextLon - targetLon) > 180) {
        nextLon -= 360;
      }

      while ((nextLon - targetLon) < -180) {
        nextLon += 360;
      }

      return nextLon;
    }

    function resolveClusterMode(visibleCount) {
      if (!map || map.getZoom() > CLUSTER_DISABLE_AT_ZOOM) {
        return false;
      }

      if (clusterModeEnabled) {
        return visibleCount >= CLUSTER_DISABLE_THRESHOLD;
      }

      return visibleCount >= CLUSTER_ENABLE_THRESHOLD;
    }

    function buildRenderPlan(visibleEntries, useClusterMode) {
      if (!useClusterMode || !map || visibleEntries.length === 0) {
        return {
          places: visibleEntries,
          clusters: []
        };
      }

      const groups = new Map();
      const zoom = map.getZoom();
      const pinnedPlaceIds = new Set();
      const individualPlaces = [];

      if (activePlaceId && placeLookup.has(activePlaceId)) {
        pinnedPlaceIds.add(activePlaceId);
      }
      if (hoveredPlaceId && placeLookup.has(hoveredPlaceId)) {
        pinnedPlaceIds.add(hoveredPlaceId);
      }

      for (const entry of visibleEntries) {
        if (pinnedPlaceIds.has(entry.place.id)) {
          individualPlaces.push(entry);
          continue;
        }

        const projectedPoint = map.project(entry.latLng, zoom);
        const cellX = Math.floor(projectedPoint.x / CLUSTER_GRID_SIZE_PX);
        const cellY = Math.floor(projectedPoint.y / CLUSTER_GRID_SIZE_PX);
        const key = `${Math.round(zoom * 10)}:${cellX}:${cellY}`;
        const existingGroup = groups.get(key);

        if (existingGroup) {
          existingGroup.entries.push(entry);
          existingGroup.latSum += entry.latLng.lat;
          existingGroup.lonSum += entry.latLng.lng;
          continue;
        }

        groups.set(key, {
          entries: [entry],
          latSum: entry.latLng.lat,
          lonSum: entry.latLng.lng
        });
      }

      const clusters = [];

      for (const [key, group] of groups) {
        const memberCount = group.entries.length;
        if (memberCount <= 1) {
          individualPlaces.push(group.entries[0]);
          continue;
        }

        const lat = group.latSum / memberCount;
        const lon = group.lonSum / memberCount;
        clusters.push({
          key,
          memberCount,
          latLng: Leaflet.latLng(lat, lon)
        });
      }

      return {
        places: individualPlaces,
        clusters
      };
    }

    function createPlaceMarker(place, latLng) {
      const marker = Leaflet.marker(latLng, {
        icon: createPinIcon(Leaflet, place),
        keyboard: true,
        autoPanOnFocus: true,
        title: place.name,
        riseOnHover: true
      });
      marker.__placeData = place;

      if (typeof marker.setZIndexOffset === "function") {
        marker.setZIndexOffset(Config.MARKER_Z_DEFAULT);
      }

      marker.on("click", () => {
        if (coordinatePickSession) {
          return;
        }

        if (shouldPrimeTapSelection(place.id)) {
          openMarkerTooltip(place.id);
          return;
        }

        clearTapPrime();
        hideMarkerTooltip({ immediate: true });
        onSelectPlace(place.id, { source: "map-marker" });
      });

      marker.on("mouseover", () => {
        openMarkerTooltip(place.id);
        scheduleHoverSync(place.id);
      });

      marker.on("mouseout", () => {
        hideMarkerTooltip();
        scheduleHoverSync(null);
      });

      marker.on("focus", () => {
        openMarkerTooltip(place.id);
        scheduleHoverSync(place.id, { immediate: true });
      });

      marker.on("blur", () => {
        hideMarkerTooltip({ immediate: true });
        scheduleHoverSync(null);
      });

      marker.on("add", () => {
        decorateMarkerElement(marker, marker.__placeData || place);
      });

      return marker;
    }

    function createClusterMarker(clusterData) {
      const marker = Leaflet.marker(clusterData.latLng, {
        icon: createClusterIcon(clusterData.memberCount),
        keyboard: false,
        autoPanOnFocus: false,
        riseOnHover: true,
        interactive: true
      });

      marker.__clusterMeta = clusterData;
      marker.on("click", (event) => {
        if (!map) {
          return;
        }

        const meta = event?.target?.__clusterMeta;
        if (!meta?.latLng) {
          return;
        }

        hideMarkerTooltip({ immediate: true });
        clearTapPrime();
        const nextZoom = Math.min(Config.MAX_ZOOM, map.getZoom() + 2);
        map.flyTo(meta.latLng, nextZoom, {
          animate: true,
          duration: Math.max(0.35, Config.FLY_DURATION_MIN_S * 0.84),
          easeLinearity: 0.2,
          noMoveStart: false
        });
      });

      return marker;
    }

    function createClusterIcon(memberCount) {
      const size = memberCount >= 100 ? 52 : memberCount >= 30 ? 46 : 40;
      const fontSize = memberCount >= 1000 ? 12 : 13;
      const safeCount = Math.max(2, Math.floor(Number(memberCount) || 2));

      return Leaflet.divIcon({
        className: "map-cluster-icon",
        html:
          `<span class="map-cluster-icon__inner" style="display:flex;align-items:center;justify-content:center;` +
          `width:${size}px;height:${size}px;border-radius:999px;` +
          `background:rgba(28,43,57,0.9);border:2px solid rgba(244,249,255,0.86);` +
          `color:#f4f9ff;font-weight:700;font-size:${fontSize}px;` +
          `box-shadow:0 6px 18px rgba(0,0,0,0.3);">${safeCount}</span>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2]
      });
    }

    function syncPlaceMarkerLatLng(marker, latLng) {
      if (!marker || !latLng || typeof marker.setLatLng !== "function") {
        return;
      }

      const currentLatLng = marker.getLatLng?.();
      const targetLat = Number(latLng.lat);
      const sourceLng = Number(latLng.lng);
      const targetLng =
        currentLatLng && Number.isFinite(Number(currentLatLng.lng))
          ? resolveWrappedLongitudeNear(sourceLng, Number(currentLatLng.lng))
          : sourceLng;
      if (
        currentLatLng &&
        Math.abs(currentLatLng.lat - targetLat) < 0.000001 &&
        Math.abs(currentLatLng.lng - targetLng) < 0.000001
      ) {
        return;
      }

      marker.setLatLng(Leaflet.latLng(targetLat, targetLng));
    }

    function removePlaceMarker(placeId, options = {}) {
      const {
        dropFromCache = false,
        deferLayerRemoval = null
      } = options;
      const entry = markerRegistry.get(placeId) || null;
      const cachedEntry = markerCache.get(placeId) || null;
      const marker = entry?.marker || cachedEntry?.marker || null;
      if (!marker) {
        if (dropFromCache) {
          markerCache.delete(placeId);
        }
        return null;
      }

      const pulseTimerId = markerPulseTimers.get(placeId);
      if (pulseTimerId) {
        window.clearTimeout(pulseTimerId);
        markerPulseTimers.delete(placeId);
      }

      const markerElement = marker.getElement?.();
      if (markerElement instanceof HTMLElement) {
        markerElement.classList.remove("map-pin-icon--pulse");
      }

      if (activeTooltipMarker === marker || activeTooltipPlaceId === placeId) {
        closeActiveMarkerTooltip();
      }

      if (entry && markersLayer) {
        if (Array.isArray(deferLayerRemoval)) {
          deferLayerRemoval.push(marker);
        } else {
          markersLayer.removeLayer(marker);
        }
      }

      markerRegistry.delete(placeId);
      pendingMarkerDecoration.delete(placeId);
      if (dropFromCache) {
        markerCache.delete(placeId);
      }
      return marker;
    }

    function recycleClusterMarker(marker) {
      if (!marker) {
        return;
      }
      marker.__clusterMeta = null;
      if (clusterMarkerPool.length < MAX_CLUSTER_MARKER_POOL_SIZE) {
        clusterMarkerPool.push(marker);
      }
    }

    function removeClusterMarker(clusterKey, options = {}) {
      const {
        deferLayerRemoval = null,
        recyclePool = null
      } = options;
      const clusterEntry = clusterRegistry.get(clusterKey);
      if (!clusterEntry) {
        return null;
      }

      if (markersLayer) {
        if (Array.isArray(deferLayerRemoval)) {
          deferLayerRemoval.push(clusterEntry.marker);
        } else {
          markersLayer.removeLayer(clusterEntry.marker);
        }
      }
      clusterRegistry.delete(clusterKey);

      if (Array.isArray(recyclePool)) {
        recyclePool.push(clusterEntry.marker);
      } else {
        recycleClusterMarker(clusterEntry.marker);
      }
      return clusterEntry.marker;
    }

    function clearRenderedMarkers() {
      const placeLayersToRemove = [];
      for (const placeId of Array.from(markerRegistry.keys())) {
        removePlaceMarker(placeId, {
          dropFromCache: true,
          deferLayerRemoval: placeLayersToRemove
        });
      }

      const clusterLayersToRemove = [];
      const clusterLayersToRecycle = [];
      for (const clusterKey of Array.from(clusterRegistry.keys())) {
        removeClusterMarker(clusterKey, {
          deferLayerRemoval: clusterLayersToRemove,
          recyclePool: clusterLayersToRecycle
        });
      }

      removeLayersBatch(placeLayersToRemove);
      removeLayersBatch(clusterLayersToRemove);
      for (const clusterMarker of clusterLayersToRecycle) {
        recycleClusterMarker(clusterMarker);
      }

      markerCache.clear();
      clusterMarkerPool.length = 0;
      pendingMarkerDecoration.clear();
      pendingMotionMarkerRefresh = null;
      if (markerDecorationRafId) {
        window.cancelAnimationFrame(markerDecorationRafId);
        markerDecorationRafId = null;
      }
    }

    function subscribeToMotion(callback) {
      if (typeof callback !== "function") {
        return () => {};
      }

      mapMotionSubscribers.add(callback);
      try {
        callback(isMapInMotion);
      } catch (error) {
        console.error("Map motion subscriber error:", error);
      }

      return () => {
        mapMotionSubscribers.delete(callback);
      };
    }

    function destroy() {
      if (mapElement && delegatedKeydownHandler) {
        mapElement.removeEventListener("keydown", delegatedKeydownHandler);
      }

      if (map && mapClickHandler) {
        map.off("click", mapClickHandler);
      }

      if (map && mapMotionStartHandler) {
        map.off("movestart zoomstart", mapMotionStartHandler);
      }

      if (map && mapMotionStopHandler) {
        map.off("moveend zoomend", mapMotionStopHandler);
      }

      if (map && mapZoomDiagnosticsHandler) {
        map.off("zoomstart zoom zoomend", mapZoomDiagnosticsHandler);
      }

      if (map && mapZoomScaleHandler) {
        map.off("zoomstart zoom zoomend", mapZoomScaleHandler);
      }

      clearRoute();
      clearDraftPlace();
      clearUserLocation();
      cancelCoordinatePick("destroy");
      clearHoverTimers();
      hideMarkerTooltip({ immediate: true });
      clearTapPrime();
      clearPulseTimers();
      clearSpotlightTimers();
      clearRenderedMarkers();
      allPlaces.length = 0;
      placeLookup.clear();
      clusterModeEnabled = false;
      activePlaceId = null;
      hoveredPlaceId = null;

      if (mapMotionClassTimerId) {
        window.clearTimeout(mapMotionClassTimerId);
        mapMotionClassTimerId = null;
      }

      if (lowPowerEffectsTimerId) {
        window.clearTimeout(lowPowerEffectsTimerId);
        lowPowerEffectsTimerId = null;
      }

      setLowPowerEffects(false, { immediate: true });

      if (routeDrawMotionTimerId) {
        window.clearTimeout(routeDrawMotionTimerId);
        routeDrawMotionTimerId = null;
      }

      if (markerRefreshTimerId) {
        window.clearTimeout(markerRefreshTimerId);
        markerRefreshTimerId = null;
      }

      if (markerRefreshRafId) {
        window.cancelAnimationFrame(markerRefreshRafId);
        markerRefreshRafId = null;
      }
      markerRefreshQueuedForce = false;
      markerRefreshQueuedSource = "unspecified";
      pendingDebouncedRefreshForce = false;
      pendingDebouncedRefreshSource = "unspecified";
      pendingMotionMarkerRefresh = null;
      lastMarkerRefreshAt = 0;

      if (zoomMarkerRefreshTimerId) {
        window.clearTimeout(zoomMarkerRefreshTimerId);
        zoomMarkerRefreshTimerId = null;
      }

      if (markerTooltipHideTimerId) {
        window.clearTimeout(markerTooltipHideTimerId);
        markerTooltipHideTimerId = null;
      }

      if (mapElement) {
        mapElement.classList.remove(
          "is-map-moving",
          "is-route-drawing",
          "is-markers-hidden",
          "is-effects-low-power"
        );
        mapElement.style.removeProperty("--map-marker-zoom-scale");
      }
      setGlobalMapMotionClass(false);

      isMapInMotion = false;
      mapMotionSubscribers.clear();
      isZooming = false;
      lowPowerEffectsActive = false;
      lastZoomEndAt = 0;

      if (map) {
        map.remove();
        map = null;
      }

      mapMotionStartHandler = null;
      mapMotionStopHandler = null;
      mapZoomDiagnosticsHandler = null;
      mapZoomScaleHandler = null;
      mapContainerEl = null;
      markersLayer = null;
      tileLayer = null;
      routeLayerGroup = null;
      routeRenderer = null;
      userLocationLayer = null;
      draftLayer = null;
    }

    return {
      init,
      setVisiblePlaces,
      setMarkersVisible,
      areMarkersVisible,
      setActive,
      spotlight,
      clearActive,
      setHovered,
      flyTo,
      flyToCoordinates,
      setZoom,
      fitToPlaces,
      resetView,
      drawRoute,
      drawDirectRoute,
      clearRoute,
      setDraftPlace,
      clearDraftPlace,
      setUserLocation,
      clearUserLocation,
      armCoordinatePick,
      cancelCoordinatePick,
      isCoordinatePickActive,
      focusMarker,
      getMarkerElement,
      getPopupAnchor,
      invalidateSize,
      getView,
      subscribeToMotion,
      destroy
    };

    function toggleMarkerStateClass(placeId, className, isEnabled) {
      const markerElement = getMarkerElement(placeId);
      if (!(markerElement instanceof HTMLElement)) {
        return;
      }

      markerElement.classList.toggle(className, isEnabled);
    }

    function applyMarkersVisibilityClass() {
      if (!(mapElement instanceof HTMLElement)) {
        return;
      }

      mapElement.classList.toggle("is-markers-hidden", !markersVisible);
    }

    function syncMarkerVisualPriority(placeId) {
      if (!placeId) {
        return;
      }

      const entry = markerRegistry.get(placeId);
      if (!entry || typeof entry.marker?.setZIndexOffset !== "function") {
        return;
      }

      let nextOffset = Config.MARKER_Z_DEFAULT;
      if (placeId === activePlaceId) {
        nextOffset = Config.MARKER_Z_ACTIVE;
      } else if (placeId === hoveredPlaceId) {
        nextOffset = Config.MARKER_Z_HOVER;
      }

      entry.marker.setZIndexOffset(nextOffset);
    }

    function decorateMarkerElement(marker, place) {
      const markerElement = marker.getElement();
      if (!(markerElement instanceof HTMLElement)) {
        return;
      }

      const regionHue = getRegionHue(place.region);
      markerElement.dataset.placeId = place.id;
      markerElement.dataset.region = normalizeText(place.region, "world");
      markerElement.style.setProperty("--pin-hue", String(regionHue));
      markerElement.setAttribute("role", "button");
      markerElement.setAttribute("tabindex", "0");
      markerElement.setAttribute("aria-label", `Открыть информацию: ${place.name}`);
      markerElement.title = place.name;

      if (markerElement.dataset.pinMounted !== "1") {
        markerElement.dataset.pinMounted = "1";
        markerElement.classList.remove("is-mounted");
        requestAnimationFrame(() => {
          markerElement.classList.add("is-mounted");
        });
      } else {
        markerElement.classList.add("is-mounted");
      }

      markerElement.classList.toggle("is-active", place.id === activePlaceId);
      markerElement.classList.toggle("is-hovered", place.id === hoveredPlaceId);
      syncMarkerVisualPriority(place.id);
    }

    function updateCoordinatePickVisualState() {
      if (!mapElement) {
        return;
      }

      const isActive = Boolean(coordinatePickSession);
      mapElement.classList.toggle("is-coordinate-pick-mode", isActive);
      if (isActive) {
        mapElement.dataset.coordinatePickHint = normalizeText(
          coordinatePickSession?.hint,
          "Click on map to choose point."
        );
      } else {
        mapElement.removeAttribute("data-coordinate-pick-hint");
      }

      if (map?.getContainer) {
        const container = map.getContainer();
        container.style.cursor = isActive ? "crosshair" : "";
      }
    }

    function normalizeRouteCoordinates(coordinates) {
      if (!Array.isArray(coordinates)) {
        return [];
      }

      const latLngs = [];
      for (const point of coordinates) {
        if (!Array.isArray(point) || point.length < 2) {
          continue;
        }

        const lon = Number(point[0]);
        const lat = Number(point[1]);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
          continue;
        }

        latLngs.push(Leaflet.latLng(lat, lon));
      }

      return downsampleLatLngSeries(latLngs, Config.ROUTE_RENDER_MAX_POINTS);
    }

    function downsampleLatLngSeries(points, maxPoints) {
      if (!Array.isArray(points) || points.length <= 2) {
        return Array.isArray(points) ? points : [];
      }

      const safeMaxPoints = Number.isFinite(maxPoints)
        ? Math.max(2, Math.floor(maxPoints))
        : 720;

      if (points.length <= safeMaxPoints) {
        return points;
      }

      const lastIndex = points.length - 1;
      const sampled = [];
      const usedIndexes = new Set();

      for (let i = 0; i < safeMaxPoints; i += 1) {
        const ratio = i / (safeMaxPoints - 1);
        const index = Math.round(ratio * lastIndex);
        if (usedIndexes.has(index)) {
          continue;
        }
        usedIndexes.add(index);
        sampled.push(points[index]);
      }

      if (sampled[0] !== points[0]) {
        sampled.unshift(points[0]);
      }
      if (sampled[sampled.length - 1] !== points[lastIndex]) {
        sampled.push(points[lastIndex]);
      }

      return sampled;
    }

    function notifyMapMotionSubscribers() {
      if (mapMotionSubscribers.size === 0) {
        return;
      }

      for (const callback of mapMotionSubscribers) {
        try {
          callback(isMapInMotion);
        } catch (error) {
          console.error("Map motion subscriber error:", error);
        }
      }
    }
  }

  function initMap(options) {
    return createMapEngine(options);
  }

  window.WorldAtlasMapModule = window.WorldAtlasMapModule || {};
  window.WorldAtlasMapModule.initMap = initMap;
})();
