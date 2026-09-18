const express = require("express");
const compression = require("compression");
const fs = require("fs/promises");
const http = require("http");
const https = require("https");
const path = require("path");
const crypto = require("crypto");
const zlib = require("zlib");

const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, "data");
const DATA_FILE = path.join(DATA_DIR, "places.json");
const PORT = parsePort(process.env.PORT, 3000);
const ROUTE_TIMEOUT_MS = parseInteger(process.env.ROUTE_TIMEOUT_MS, 9000);
const ROUTE_MAX_POINTS = 10;
const ROUTE_CACHE_TTL_MS = 3 * 60 * 1000;
const INDEX_HTML_PATH = path.join(ROOT_DIR, "index.html");
const CACHE_CONTROL_HTML = "no-cache";
const CACHE_CONTROL_API = "no-store";
const CACHE_CONTROL_IMMUTABLE = "public, max-age=31536000, immutable";
const CACHE_CONTROL_SHORT_TTL = "public, max-age=300, must-revalidate";
const CACHE_CONTROL_DEFAULT_STATIC = "public, max-age=600";
const CACHE_CONTROL_WEATHER = "public, max-age=300, s-maxage=600, stale-while-revalidate=120";
const IMMUTABLE_STATIC_EXTENSIONS = new Set([
  ".css",
  ".js",
  ".mjs",
  ".svg",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".avif",
  ".ico",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".map"
]);
const SHORT_TTL_STATIC_EXTENSIONS = new Set([".json", ".xml", ".txt"]);

const ROUTE_MODES = Object.freeze({
  walk: Object.freeze({
    key: "walk",
    label: "Пешком",
    speedKmph: 5,
    flightOverheadMinutes: 0
  }),
  car: Object.freeze({
    key: "car",
    label: "Авто",
    speedKmph: 70,
    flightOverheadMinutes: 0
  }),
  flight: Object.freeze({
    key: "flight",
    label: "Самолёт",
    speedKmph: 800,
    flightOverheadMinutes: 60
  })
});

const SORT_FIELDS = new Set([
  "name",
  "region",
  "country",
  "category",
  "population",
  "createdAt",
  "updatedAt",
  "lat",
  "lon"
]);
const ORDER_FIELDS = new Set(["asc", "desc"]);
const ROUTE_PROVIDERS = Object.freeze([
  Object.freeze({
    id: "osrm-project",
    name: "OSRM Project",
    mode: "car",
    baseUrl: "https://router.project-osrm.org/route/v1/driving"
  }),
  Object.freeze({
    id: "osrm-osmde-car",
    name: "OSM DE Car",
    mode: "car",
    baseUrl: "https://routing.openstreetmap.de/routed-car/route/v1/driving"
  }),
  Object.freeze({
    id: "osrm-osmde-foot",
    name: "OSM DE Foot",
    mode: "walk",
    baseUrl: "https://routing.openstreetmap.de/routed-foot/route/v1/driving"
  })
]);
const WEATHER_API_ENDPOINT = "https://api.weatherapi.com/v1/current.json";
const WEATHER_API_KEY = String(process.env.WEATHER_API_KEY || "").trim();
const WEATHER_TIMEOUT_MS = parseInteger(process.env.WEATHER_TIMEOUT_MS, 5000);
const WEATHER_CACHE_TTL_MS = parseInteger(process.env.WEATHER_CACHE_TTL_MS, 10 * 60 * 1000);

const app = express();
app.disable("x-powered-by");
app.set("etag", "strong");
app.use(
  compression({
    threshold: 1024,
    level: 6,
    brotli: {
      enabled: true,
      zlib: {
        params: {
          [zlib.constants.BROTLI_PARAM_QUALITY]: 5
        }
      }
    }
  })
);
app.use(express.json({ limit: "256kb" }));
app.use(requestLogger);

let placesCache = [];
let writeQueue = Promise.resolve();
const routeSegmentCache = new Map();
const weatherCache = new Map();
const localPresenceCache = new Map();

async function start(port = PORT) {
  placesCache = await readPlacesFromDisk();

  registerApiRoutes();
  registerStaticRoutes();
  registerNotFoundAndErrorHandlers();

  return app.listen(port, () => {
    console.log(`[server] listening on http://localhost:${port}`);
    console.log(`[server] places loaded: ${placesCache.length}`);
  });
}

if (require.main === module) {
  start().catch((error) => {
    console.error("[startup] fatal", error);
    process.exit(1);
  });
}

function registerApiRoutes() {
  app.use("/api", (req, res, next) => {
    res.setHeader("Cache-Control", CACHE_CONTROL_API);
    next();
  });

  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      now: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime())
    });
  });

  app.get(
    "/api/weather",
    asyncHandler(async (req, res) => {
      const { query, errors } = normalizeWeatherQuery(req.query);
      if (errors.length > 0) {
        return res.status(400).json({
          error: "Invalid weather query parameters",
          details: errors
        });
      }

      const weather = await fetchWeatherSnapshot(query);
      res.setHeader("Cache-Control", CACHE_CONTROL_WEATHER);
      return res.json({
        item: weather,
        cacheTtlMs: WEATHER_CACHE_TTL_MS
      });
    })
  );

  app.get(
    "/api/route",
    asyncHandler(async (req, res) => {
      const { query, errors } = normalizeRouteQuery(req.query);
      if (errors.length > 0) {
        return res.status(400).json({
          error: "Invalid route query parameters",
          details: errors
        });
      }

      const routeResult = await fetchRouteWithProviderFallback(query);
      return res.json(routeResult);
    })
  );

  app.get("/api/access-state", (req, res) => {
    return res.json({
      access: createLocalAccessSnapshot()
    });
  });

  app.post("/api/session/sync", (req, res) => {
    const snapshot = upsertLocalPresenceSnapshot(req.body, req);
    return res.json({
      ok: true,
      access: createLocalAccessSnapshot(snapshot),
      visitor: snapshot
    });
  });

  app.post("/api/visitor/ping", (req, res) => {
    const snapshot = upsertLocalPresenceSnapshot(req.body, req);
    return res.json({
      ok: true,
      access: createLocalAccessSnapshot(snapshot),
      visitor: snapshot
    });
  });

  app.post("/api/user/ping", (req, res) => {
    const snapshot = upsertLocalPresenceSnapshot(req.body, req);
    return res.json({
      ok: true,
      access: createLocalAccessSnapshot(snapshot),
      visitor: snapshot
    });
  });

  app.get("/api/places", (req, res) => {
    const { query, errors } = normalizePlacesListQuery(req.query);
    if (errors.length > 0) {
      return res.status(400).json({
        error: "Invalid query parameters",
        details: errors
      });
    }

    const filtered = applyPlacesListQuery(placesCache, query);
    const total = filtered.length;
    const paged = filtered.slice(query.offset, query.offset + query.limit);

    return res.json({
      items: paged,
      total,
      limit: query.limit,
      offset: query.offset
    });
  });

  app.get("/api/meta/regions", (req, res) => {
    const counters = new Map();

    for (const place of placesCache) {
      const region = place.region || "Регион не указан";
      counters.set(region, (counters.get(region) || 0) + 1);
    }

    const items = Array.from(counters.entries())
      .map(([region, count]) => ({ region, count }))
      .sort((left, right) => right.count - left.count || left.region.localeCompare(right.region, "ru"));

    return res.json({
      items,
      totalRegions: items.length
    });
  });

  app.get("/api/community", (req, res) => {
    const placeRef = normalizeText(req.query.placeId || req.query.placeRef, "");
    if (!placeRef) {
      return res.json({
        average: 0,
        count: 0,
        reviews: []
      });
    }

    const place = placesCache.find((entry) => entry.id === placeRef || entry.slug === placeRef);
    return res.json({
      placeId: place?.id || placeRef,
      average: 0,
      count: 0,
      reviews: []
    });
  });

  app.get("/api/places/:id", (req, res) => {
    const place = placesCache.find((entry) => entry.id === req.params.id);
    if (!place) {
      return res.status(404).json({ error: "Place not found." });
    }

    return res.json({ item: place });
  });

  app.post(
    "/api/places",
    asyncHandler(async (req, res) => {
      const { value, errors } = validatePlacePayload(req.body, { partial: false });
      if (errors.length > 0) {
        return res.status(400).json({ error: "Validation failed", details: errors });
      }

      const now = new Date().toISOString();
      const nextPlace = {
        ...value,
        id: generatePlaceId(value.name, placesCache),
        createdAt: now,
        updatedAt: now
      };

      const nextPlaces = [nextPlace, ...placesCache];
      await persistPlaces(nextPlaces);

      return res.status(201).json({ item: nextPlace });
    })
  );

  app.put(
    "/api/places/:id",
    asyncHandler(async (req, res) => {
      const index = placesCache.findIndex((entry) => entry.id === req.params.id);
      if (index < 0) {
        return res.status(404).json({ error: "Place not found." });
      }

      const { value, errors } = validatePlacePayload(req.body, { partial: false });
      if (errors.length > 0) {
        return res.status(400).json({ error: "Validation failed", details: errors });
      }

      const current = placesCache[index];
      const updated = {
        ...current,
        ...value,
        id: current.id,
        updatedAt: new Date().toISOString()
      };

      const nextPlaces = [...placesCache];
      nextPlaces[index] = updated;
      await persistPlaces(nextPlaces);

      return res.json({ item: updated });
    })
  );

  app.patch(
    "/api/places/:id",
    asyncHandler(async (req, res) => {
      const index = placesCache.findIndex((entry) => entry.id === req.params.id);
      if (index < 0) {
        return res.status(404).json({ error: "Place not found." });
      }

      const { value, errors } = validatePlacePayload(req.body, { partial: true });
      if (errors.length > 0) {
        return res.status(400).json({ error: "Validation failed", details: errors });
      }

      const current = placesCache[index];
      const updated = {
        ...current,
        ...value,
        id: current.id,
        updatedAt: new Date().toISOString()
      };

      const nextPlaces = [...placesCache];
      nextPlaces[index] = updated;
      await persistPlaces(nextPlaces);

      return res.json({ item: updated });
    })
  );

  app.delete(
    "/api/places/:id",
    asyncHandler(async (req, res) => {
      const index = placesCache.findIndex((entry) => entry.id === req.params.id);
      if (index < 0) {
        return res.status(404).json({ error: "Place not found." });
      }

      const nextPlaces = placesCache.filter((entry) => entry.id !== req.params.id);
      await persistPlaces(nextPlaces);
      return res.status(204).send();
    })
  );

  app.use("/api", (req, res) => {
    res.status(404).json({ error: "API route not found." });
  });
}

function registerStaticRoutes() {
  const htmlSendOptions = {
    headers: {
      "Cache-Control": CACHE_CONTROL_HTML
    }
  };

  app.use("/data", (req, res) => {
    res.status(403).json({ error: "Forbidden." });
  });

  app.use(
    express.static(ROOT_DIR, {
      index: false,
      etag: true,
      lastModified: true,
      maxAge: 0,
      dotfiles: "ignore",
      setHeaders: (res, filePath) => {
        res.setHeader("Cache-Control", resolveStaticCacheControl(filePath));
      }
    })
  );

  app.get("/", (req, res) => {
    res.sendFile(INDEX_HTML_PATH, htmlSendOptions);
  });

  app.get(/^\/(?!api\/).*/, (req, res, next) => {
    if (path.extname(req.path)) {
      next();
      return;
    }

    res.sendFile(INDEX_HTML_PATH, htmlSendOptions);
  });
}

function resolveStaticCacheControl(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".html") {
    return CACHE_CONTROL_HTML;
  }
  if (IMMUTABLE_STATIC_EXTENSIONS.has(extension)) {
    return CACHE_CONTROL_IMMUTABLE;
  }
  if (SHORT_TTL_STATIC_EXTENSIONS.has(extension)) {
    return CACHE_CONTROL_SHORT_TTL;
  }
  return CACHE_CONTROL_DEFAULT_STATIC;
}

function registerNotFoundAndErrorHandlers() {
  app.use((req, res) => {
    res.status(404).json({ error: "Route not found." });
  });

  app.use((error, req, res, next) => {
    const message = error instanceof Error ? error.message : String(error || "Unknown error");
    console.error("[error]", message);

    if (res.headersSent) {
      next(error);
      return;
    }

    res.status(500).json({
      error: "Internal server error",
      message: "Unexpected failure while processing request."
    });
  });
}

function upsertLocalPresenceSnapshot(body, req) {
  const source = body && typeof body === "object" ? body : {};
  const nowIso = new Date().toISOString();
  const visitorId = normalizeText(source.visitorId || source.visitor_id, "");
  const userId = normalizeText(source.userId || source.user_id, "");
  const cacheKey = visitorId || userId || "anonymous";
  const previous = localPresenceCache.get(cacheKey) || {};
  const displayName = normalizeText(
    source.displayName || source.display_name,
    previous.displayName || (visitorId ? `Guest ${visitorId.slice(-6).toUpperCase()}` : "Guest")
  );
  const roleHint = normalizeText(source.roleHint || source.role_hint || source.role, "");
  const role = roleHint || (userId ? "user" : "guest");
  const snapshot = {
    visitorId: visitorId || normalizeText(previous.visitorId, ""),
    userId: userId || normalizeText(previous.userId, ""),
    displayName,
    email: normalizeText(source.email, normalizeText(previous.email, "")),
    role,
    lastSeen: nowIso,
    lastPath: normalizeLocalPathName(source.pathName || source.pathname || source.path || req?.path || "/")
  };
  localPresenceCache.set(cacheKey, snapshot);
  return snapshot;
}

function createLocalAccessSnapshot(snapshot = null) {
  return {
    userId: normalizeText(snapshot?.userId, ""),
    visitorId: normalizeText(snapshot?.visitorId, ""),
    isBanned: false,
    isUserBanned: false,
    isVisitorBanned: false,
    source: "",
    reason: "",
    bannedAt: "",
    bannedUntil: "",
    isPermanent: false,
    checkedAt: new Date().toISOString()
  };
}

function normalizeLocalPathName(value) {
  const safeValue = normalizeText(value, "/");
  return safeValue.startsWith("/") ? safeValue : `/${safeValue}`;
}

function normalizeText(value, fallback = "") {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || fallback;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    const normalized = String(value).trim();
    return normalized || fallback;
  }
  return fallback;
}

function normalizePlacesListQuery(rawQuery) {
  const errors = [];
  const rawSortBy = typeof rawQuery.sortBy === "string" ? rawQuery.sortBy.trim().toLowerCase() : "name";
  const sortTokenParts = rawSortBy.split("-");
  const hasInlineOrder = sortTokenParts.length >= 2 && ORDER_FIELDS.has(sortTokenParts[sortTokenParts.length - 1]);
  const sortFieldToken = hasInlineOrder
    ? sortTokenParts.slice(0, -1).join("-")
    : rawSortBy;
  const normalizedSortBy = normalizeSortFieldToken(sortFieldToken);
  const normalizedOrder = hasInlineOrder
    ? sortTokenParts[sortTokenParts.length - 1]
    : (typeof rawQuery.order === "string" ? rawQuery.order.trim().toLowerCase() : "asc");

  const tags = typeof rawQuery.tagsFilter === "string"
    ? rawQuery.tagsFilter
        .split(",")
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean)
    : [];

  const query = {
    q: typeof rawQuery.q === "string" ? rawQuery.q.trim() : "",
    region: typeof rawQuery.region === "string" ? rawQuery.region.trim() : "",
    categoryFilter:
      typeof rawQuery.categoryFilter === "string"
        ? rawQuery.categoryFilter.trim().toLowerCase()
        : "all",
    tagsFilter: tags.slice(0, 12),
    onlyFree: parseBooleanQueryValue(rawQuery.onlyFree),
    familyFriendly: parseBooleanQueryValue(rawQuery.familyFriendly),
    limit: parseInteger(rawQuery.limit, 200),
    offset: parseInteger(rawQuery.offset, 0),
    sortBy: normalizedSortBy,
    order: normalizedOrder
  };

  if (query.q.length > 200) {
    errors.push("Query parameter 'q' must contain up to 200 characters.");
  }

  if (query.limit < 1 || query.limit > 2000) {
    errors.push("Query parameter 'limit' must be between 1 and 2000.");
  }

  if (query.offset < 0 || query.offset > 1_000_000) {
    errors.push("Query parameter 'offset' must be between 0 and 1000000.");
  }

  if (!SORT_FIELDS.has(query.sortBy)) {
    errors.push(
      "Query parameter 'sortBy' must be one of: name, region, country, category, population, createdAt, updatedAt, lat, lon."
    );
  }

  if (!ORDER_FIELDS.has(query.order)) {
    errors.push("Query parameter 'order' must be 'asc' or 'desc'.");
  }

  if (query.region.toLowerCase() === "all") {
    query.region = "";
  }
  if (query.categoryFilter === "") {
    query.categoryFilter = "all";
  }

  return { query, errors };
}

function applyPlacesListQuery(sourceItems, query) {
  let items = [...sourceItems];

  if (query.region) {
    const regionNeedle = query.region.toLowerCase();
    items = items.filter((place) => String(place.region || "").toLowerCase() === regionNeedle);
  }

  if (query.categoryFilter && query.categoryFilter !== "all") {
    const categoryNeedle = query.categoryFilter.toLowerCase();
    items = items.filter((place) => String(place.category || place.kind || "").toLowerCase() === categoryNeedle);
  }

  if (Array.isArray(query.tagsFilter) && query.tagsFilter.length > 0) {
    items = items.filter((place) => {
      const placeTags = Array.isArray(place.tags)
        ? place.tags
            .map((entry) => String(entry || "").trim().toLowerCase())
            .filter(Boolean)
        : [];
      if (placeTags.length === 0) {
        return false;
      }
      return query.tagsFilter.every((tag) => placeTags.includes(tag));
    });
  }

  if (query.onlyFree) {
    items = items.filter((place) =>
      resolveBooleanField(place, ["isFree", "is_free", "free", "onlyFree"])
    );
  }

  if (query.familyFriendly) {
    items = items.filter((place) =>
      resolveBooleanField(place, ["familyFriendly", "family_friendly", "family"])
    );
  }

  if (query.q) {
    const needle = query.q.toLowerCase();
    items = items.filter((place) => {
      const highlightsText = Array.isArray(place.highlights) ? place.highlights.join(" ") : "";
      const tagsText = Array.isArray(place.tags) ? place.tags.join(" ") : "";
      const haystack = [
        place.name,
        place.category,
        place.region,
        place.description,
        place.country,
        place.countryCode,
        place.timezone,
        Number.isFinite(Number(place.population)) ? String(place.population) : "",
        place.climate,
        place.founded,
        place.funFact,
        highlightsText,
        tagsText
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }

  items.sort((left, right) => comparePlaces(left, right, query.sortBy, query.order));

  return items;
}

function comparePlaces(left, right, sortBy, order) {
  let result = 0;

  if (sortBy === "lat" || sortBy === "lon" || sortBy === "population") {
    const leftValue = Number(left?.[sortBy]);
    const rightValue = Number(right?.[sortBy]);
    result = (Number.isFinite(leftValue) ? leftValue : 0) - (Number.isFinite(rightValue) ? rightValue : 0);
  } else {
    result = String(left?.[sortBy] ?? "").localeCompare(String(right?.[sortBy] ?? ""), "ru", {
      sensitivity: "base"
    });
  }

  if (result === 0) {
    result = left.id.localeCompare(right.id, "ru", { sensitivity: "base" });
  }

  return order === "desc" ? -result : result;
}

function normalizeRouteQuery(rawQuery) {
  const errors = [];
  const rawMode = typeof rawQuery.mode === "string"
    ? rawQuery.mode.trim().toLowerCase()
    : "";
  const mode = normalizeRouteMode(rawMode);
  if (rawMode && !Object.prototype.hasOwnProperty.call(ROUTE_MODES, rawMode)) {
    errors.push("Query parameter 'mode' must be one of: walk, car, flight.");
  }
  const points = [];

  if (typeof rawQuery.points === "string" && rawQuery.points.trim() !== "") {
    const pairs = rawQuery.points
      .split(";")
      .map((entry) => entry.trim())
      .filter(Boolean);

    if (pairs.length < 2) {
      errors.push("Query parameter 'points' must contain at least 2 points.");
    }
    if (pairs.length > ROUTE_MAX_POINTS) {
      errors.push(`Query parameter 'points' can contain up to ${ROUTE_MAX_POINTS} points.`);
    }

    for (const [index, pair] of pairs.entries()) {
      const [latRaw, lonRaw] = pair.split(",");
      const lat = parseBoundedFloat(latRaw, -90, 90);
      const lon = parseBoundedFloat(lonRaw, -180, 180);
      if (lat === null || lon === null) {
        errors.push(`Point ${index + 1} in 'points' must be 'lat,lon' within valid ranges.`);
        continue;
      }

      points.push({ lat, lon });
    }
  } else {
    const fromLat = parseBoundedFloat(rawQuery.fromLat, -90, 90);
    const fromLon = parseBoundedFloat(rawQuery.fromLon, -180, 180);
    const toLat = parseBoundedFloat(rawQuery.toLat, -90, 90);
    const toLon = parseBoundedFloat(rawQuery.toLon, -180, 180);

    if (fromLat === null) {
      errors.push("Query parameter 'fromLat' must be a number between -90 and 90.");
    }
    if (fromLon === null) {
      errors.push("Query parameter 'fromLon' must be a number between -180 and 180.");
    }
    if (toLat === null) {
      errors.push("Query parameter 'toLat' must be a number between -90 and 90.");
    }
    if (toLon === null) {
      errors.push("Query parameter 'toLon' must be a number between -180 and 180.");
    }

    if (errors.length === 0) {
      points.push(
        { lat: fromLat, lon: fromLon },
        { lat: toLat, lon: toLon }
      );
    }
  }

  if (points.length >= 2) {
    for (let index = 0; index < points.length - 1; index += 1) {
      const fromPoint = points[index];
      const toPoint = points[index + 1];
      const distance = haversineDistanceMeters(
        fromPoint.lat,
        fromPoint.lon,
        toPoint.lat,
        toPoint.lon
      );
      if (!Number.isFinite(distance) || distance < 5) {
        errors.push(`Points ${index + 1} and ${index + 2} are too close to each other.`);
      }
    }
  }

  return { query: { mode, points }, errors };
}

async function fetchRouteWithProviderFallback(query) {
  const modeConfig = ROUTE_MODES[query.mode] || ROUTE_MODES.car;
  if (query.mode === "flight") {
    return createFlightRoute(query.points, modeConfig);
  }

  const providerErrors = [];
  const segments = [];

  for (let index = 0; index < query.points.length - 1; index += 1) {
    const fromPoint = query.points[index];
    const toPoint = query.points[index + 1];
    const segment = await fetchSegmentWithProviderFallback({
      mode: query.mode,
      fromPoint,
      toPoint,
      providerErrors
    });
    segments.push({
      index,
      ...segment
    });
  }

  const distanceMeters = segments.reduce((sum, segment) => sum + Number(segment.distanceMeters || 0), 0);
  const durationSeconds = segments.reduce((sum, segment) => sum + Number(segment.durationSeconds || 0), 0);

  return {
    mode: query.mode,
    modeLabel: modeConfig.label,
    points: query.points.map((point) => ({
      lat: roundCoordinate(point.lat),
      lon: roundCoordinate(point.lon)
    })),
    segments,
    coordinates: mergeSegmentCoordinates(segments),
    distanceMeters,
    durationSeconds,
    provider: resolveProviderLabel(segments),
    isFallback: segments.some((segment) => segment.isFallback),
    providerErrors: providerErrors.length > 0 ? providerErrors : undefined
  };
}

async function fetchSegmentWithProviderFallback({ mode, fromPoint, toPoint, providerErrors }) {
  const cacheKey = buildRouteCacheKey(mode, fromPoint, toPoint);
  const cached = readRouteCache(cacheKey);
  if (cached) {
    return cached;
  }

  const providers = getProvidersForMode(mode);
  for (const provider of providers) {
    try {
      const fetched = await fetchRouteFromProvider(provider, fromPoint, toPoint);
      const segment = {
        coordinates: fetched.coordinates,
        distanceMeters: fetched.distanceMeters,
        durationSeconds: estimateDurationByMode(fetched.distanceMeters, mode),
        provider: provider.name,
        isFallback: false
      };
      writeRouteCache(cacheKey, segment);
      return segment;
    } catch (error) {
      providerErrors.push(`${provider.name}: ${error.message}`);
    }
  }

  const fallback = createFallbackSegment(fromPoint, toPoint, mode);
  writeRouteCache(cacheKey, fallback);
  return fallback;
}

function getProvidersForMode(mode) {
  if (mode === "walk") {
    return ROUTE_PROVIDERS.filter((provider) => provider.mode === "walk" || provider.mode === "car");
  }

  return ROUTE_PROVIDERS.filter((provider) => provider.mode === "car");
}

async function fetchRouteFromProvider(provider, fromPoint, toPoint) {
  const providerUrl = buildProviderRouteUrl(provider.baseUrl, fromPoint, toPoint);
  const payload = await requestJsonFromUrl(providerUrl, { timeoutMs: ROUTE_TIMEOUT_MS });

  const route = payload?.routes?.[0];
  const coordinates = route?.geometry?.coordinates;
  if (!route || !Array.isArray(coordinates) || coordinates.length < 2) {
    throw new Error("Route response has no valid geometry.");
  }

  const straightDistance = haversineDistanceMeters(
    fromPoint.lat,
    fromPoint.lon,
    toPoint.lat,
    toPoint.lon
  );

  const distanceMeters = Number(route.distance);
  return {
    coordinates,
    distanceMeters: Number.isFinite(distanceMeters) && distanceMeters > 0
      ? distanceMeters
      : straightDistance
  };
}

function buildProviderRouteUrl(baseUrl, fromPoint, toPoint) {
  const pointA = `${roundCoordinate(fromPoint.lon)},${roundCoordinate(fromPoint.lat)}`;
  const pointB = `${roundCoordinate(toPoint.lon)},${roundCoordinate(toPoint.lat)}`;
  const url = new URL(`${baseUrl}/${pointA};${pointB}`);

  url.searchParams.set("overview", "simplified");
  url.searchParams.set("geometries", "geojson");
  url.searchParams.set("alternatives", "false");
  url.searchParams.set("steps", "false");

  return url.toString();
}

function requestJsonFromUrl(rawUrl, options = {}) {
  const timeoutMs = Number.isFinite(Number(options.timeoutMs))
    ? Number(options.timeoutMs)
    : ROUTE_TIMEOUT_MS;

  return new Promise((resolve, reject) => {
    let parsedUrl;
    try {
      parsedUrl = new URL(rawUrl);
    } catch {
      reject(new Error("Invalid provider URL."));
      return;
    }

    const transport = parsedUrl.protocol === "https:" ? https : http;
    const request = transport.request(
      parsedUrl,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "identity",
          "User-Agent": "WorldAtlasProRouteProxy/1.0"
        }
      },
      (response) => {
        const chunks = [];
        let totalBytes = 0;

        response.on("data", (chunk) => {
          totalBytes += chunk.length;
          if (totalBytes > 6_000_000) {
            request.destroy(new Error("Provider response is too large."));
            return;
          }

          chunks.push(chunk);
        });

        response.on("end", () => {
          const rawText = Buffer.concat(chunks).toString("utf8");
          let payload = null;

          if (rawText.length > 0) {
            try {
              payload = JSON.parse(rawText);
            } catch {
              reject(new Error("Provider returned invalid JSON."));
              return;
            }
          }

          if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
            const providerMessage = extractProviderErrorMessage(payload);
            reject(
              new Error(providerMessage || `Provider request failed with status ${response.statusCode}.`)
            );
            return;
          }

          resolve(payload);
        });
      }
    );

    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error("Provider request timeout."));
    });

    request.on("error", (error) => {
      reject(error);
    });

    request.end();
  });
}

function extractProviderErrorMessage(payload) {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const candidates = [
    payload.message,
    payload.error,
    payload.code
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim() !== "") {
      return candidate.trim();
    }
  }

  return "";
}

function normalizeWeatherQuery(rawQuery) {
  const errors = [];
  const lat = parseBoundedFloat(rawQuery.lat, -90, 90);
  const lon = parseBoundedFloat(rawQuery.lon, -180, 180);
  const name = typeof rawQuery.name === "string" ? rawQuery.name.trim().slice(0, 140) : "";
  const placeId = typeof rawQuery.placeId === "string" ? rawQuery.placeId.trim().slice(0, 120) : "";

  if (lat === null) {
    errors.push("Query parameter 'lat' must be a number between -90 and 90.");
  }
  if (lon === null) {
    errors.push("Query parameter 'lon' must be a number between -180 and 180.");
  }

  return {
    query: {
      lat,
      lon,
      name,
      placeId
    },
    errors
  };
}

function buildWeatherCacheKey(query) {
  const lat = Number(query?.lat);
  const lon = Number(query?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return "";
  }
  return `${lat.toFixed(3)},${lon.toFixed(3)}`;
}

function readWeatherCache(cacheKey) {
  if (!cacheKey) {
    return null;
  }
  const cached = weatherCache.get(cacheKey);
  if (!cached) {
    return null;
  }
  if (cached.expiresAt <= Date.now()) {
    weatherCache.delete(cacheKey);
    return null;
  }
  return cached.payload;
}

function writeWeatherCache(cacheKey, payload) {
  if (!cacheKey || !payload || typeof payload !== "object") {
    return;
  }

  weatherCache.set(cacheKey, {
    expiresAt: Date.now() + WEATHER_CACHE_TTL_MS,
    payload
  });

  if (weatherCache.size > 300) {
    const firstKey = weatherCache.keys().next().value;
    if (typeof firstKey === "string") {
      weatherCache.delete(firstKey);
    }
  }
}

async function fetchWeatherSnapshot(query) {
  if (!WEATHER_API_KEY) {
    throw new Error("WEATHER_API_KEY is not configured.");
  }

  const cacheKey = buildWeatherCacheKey(query);
  const cached = readWeatherCache(cacheKey);
  if (cached) {
    return cached;
  }

  const url = new URL(WEATHER_API_ENDPOINT);
  url.searchParams.set("key", WEATHER_API_KEY);
  url.searchParams.set("q", `${query.lat},${query.lon}`);
  url.searchParams.set("aqi", "no");

  const payload = await requestJsonFromUrl(url.toString(), {
    timeoutMs: WEATHER_TIMEOUT_MS
  });
  const normalized = mapWeatherPayload(payload, query);
  writeWeatherCache(cacheKey, normalized);
  return normalized;
}

function mapWeatherPayload(payload, query) {
  const current = payload && typeof payload === "object" ? payload.current : null;
  if (!current || typeof current !== "object") {
    throw new Error("Weather provider payload is invalid.");
  }

  const tempC = Number(current.temp_c);
  const feelsLikeC = Number(current.feelslike_c);
  const humidity = Number(current.humidity);
  const windKph = Number(current.wind_kph);
  const isDay = Number(current.is_day) === 1 ? 1 : 0;
  const condition = (
    current.condition && typeof current.condition === "object"
      ? String(current.condition.text || "").trim()
      : ""
  );
  const updatedAt = typeof current.last_updated_epoch === "number"
    ? new Date(current.last_updated_epoch * 1000).toISOString()
    : new Date().toISOString();

  if (!Number.isFinite(tempC) || !condition) {
    throw new Error("Weather provider returned incomplete data.");
  }

  return {
    placeId: query.placeId || "",
    name: query.name || "",
    lat: roundCoordinate(query.lat),
    lon: roundCoordinate(query.lon),
    tempC,
    feelsLikeC: Number.isFinite(feelsLikeC) ? feelsLikeC : null,
    humidity: Number.isFinite(humidity) ? humidity : null,
    windKph: Number.isFinite(windKph) ? windKph : null,
    condition,
    isDay,
    updatedAt,
    provider: "WeatherAPI"
  };
}

function createFallbackSegment(fromPoint, toPoint, mode) {
  const coordinates = buildInterpolatedLineCoordinates(
    fromPoint.lat,
    fromPoint.lon,
    toPoint.lat,
    toPoint.lon
  );

  const distanceMeters = haversineDistanceMeters(
    fromPoint.lat,
    fromPoint.lon,
    toPoint.lat,
    toPoint.lon
  );

  return {
    coordinates,
    distanceMeters,
    durationSeconds: estimateDurationByMode(distanceMeters, mode),
    provider: "Локальная модель",
    isFallback: true
  };
}

function createFlightRoute(points, modeConfig) {
  const segments = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const fromPoint = points[index];
    const toPoint = points[index + 1];
    const distanceMeters = haversineDistanceMeters(
      fromPoint.lat,
      fromPoint.lon,
      toPoint.lat,
      toPoint.lon
    );

    segments.push({
      index,
      coordinates: buildInterpolatedLineCoordinates(
        fromPoint.lat,
        fromPoint.lon,
        toPoint.lat,
        toPoint.lon
      ),
      distanceMeters,
      durationSeconds: estimateDurationByMode(distanceMeters, "flight"),
      provider: "Great-circle model",
      isFallback: false
    });
  }

  return {
    mode: "flight",
    modeLabel: modeConfig.label,
    points: points.map((point) => ({
      lat: roundCoordinate(point.lat),
      lon: roundCoordinate(point.lon)
    })),
    segments,
    coordinates: mergeSegmentCoordinates(segments),
    distanceMeters: segments.reduce((sum, segment) => sum + Number(segment.distanceMeters || 0), 0),
    durationSeconds: segments.reduce((sum, segment) => sum + Number(segment.durationSeconds || 0), 0),
    provider: "Great-circle model",
    isFallback: false
  };
}

function mergeSegmentCoordinates(segments) {
  const merged = [];
  for (const segment of segments) {
    const coordinates = Array.isArray(segment?.coordinates) ? segment.coordinates : [];
    for (let index = 0; index < coordinates.length; index += 1) {
      if (merged.length > 0 && index === 0) {
        const previous = merged[merged.length - 1];
        const current = coordinates[index];
        if (previous[0] === current[0] && previous[1] === current[1]) {
          continue;
        }
      }
      merged.push(coordinates[index]);
    }
  }
  return merged;
}

function resolveProviderLabel(segments) {
  const uniqueProviders = Array.from(
    new Set(
      segments
        .map((segment) => (typeof segment.provider === "string" ? segment.provider.trim() : ""))
        .filter(Boolean)
    )
  );

  if (uniqueProviders.length === 0) {
    return "Локальная модель";
  }
  if (uniqueProviders.length === 1) {
    return uniqueProviders[0];
  }
  return "Смешанный провайдер";
}

function estimateDurationByMode(distanceMeters, mode) {
  const modeConfig = ROUTE_MODES[mode] || ROUTE_MODES.car;
  const pureTravelSeconds = estimateDurationSeconds(distanceMeters, modeConfig.speedKmph);
  if (!Number.isFinite(pureTravelSeconds) || pureTravelSeconds <= 0) {
    return 0;
  }

  const overheadSeconds = Number(modeConfig.flightOverheadMinutes || 0) * 60;
  return pureTravelSeconds + overheadSeconds;
}

function normalizeRouteMode(rawMode) {
  const normalized = typeof rawMode === "string"
    ? rawMode.trim().toLowerCase()
    : "";
  if (normalized === "walk" || normalized === "car" || normalized === "flight") {
    return normalized;
  }
  return "car";
}

function buildRouteCacheKey(mode, fromPoint, toPoint) {
  return [
    mode,
    roundCoordinate(fromPoint.lat),
    roundCoordinate(fromPoint.lon),
    roundCoordinate(toPoint.lat),
    roundCoordinate(toPoint.lon)
  ].join("|");
}

function readRouteCache(cacheKey) {
  const cached = routeSegmentCache.get(cacheKey);
  if (!cached) {
    return null;
  }

  if (cached.expiresAt < Date.now()) {
    routeSegmentCache.delete(cacheKey);
    return null;
  }

  return cached.value;
}

function writeRouteCache(cacheKey, value) {
  routeSegmentCache.set(cacheKey, {
    value,
    expiresAt: Date.now() + ROUTE_CACHE_TTL_MS
  });

  if (routeSegmentCache.size > 800) {
    const now = Date.now();
    for (const [key, entry] of routeSegmentCache.entries()) {
      if (!entry || entry.expiresAt < now) {
        routeSegmentCache.delete(key);
      }
    }

    if (routeSegmentCache.size > 600) {
      let pruneCount = routeSegmentCache.size - 600;
      for (const key of routeSegmentCache.keys()) {
        routeSegmentCache.delete(key);
        pruneCount -= 1;
        if (pruneCount <= 0) {
          break;
        }
      }
    }
  }
}

function buildInterpolatedLineCoordinates(fromLat, fromLon, toLat, toLon) {
  const distanceMeters = haversineDistanceMeters(fromLat, fromLon, toLat, toLon);
  const segments = clamp(Math.round(distanceMeters / 28_000), 10, 64);
  const lonDelta = shortestLongitudeDelta(fromLon, toLon);

  const coordinates = [];
  for (let index = 0; index <= segments; index += 1) {
    const t = index / segments;
    const lat = fromLat + (toLat - fromLat) * t;
    const lon = normalizeLongitude(fromLon + lonDelta * t);
    coordinates.push([roundCoordinate(lon), roundCoordinate(lat)]);
  }

  return coordinates;
}

function shortestLongitudeDelta(fromLon, toLon) {
  let delta = Number(toLon) - Number(fromLon);
  while (delta > 180) {
    delta -= 360;
  }
  while (delta < -180) {
    delta += 360;
  }
  return delta;
}

function normalizeLongitude(value) {
  let lon = Number(value);
  while (lon > 180) {
    lon -= 360;
  }
  while (lon < -180) {
    lon += 360;
  }
  return lon;
}

function roundCoordinate(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Number(numeric.toFixed(6));
}

function haversineDistanceMeters(latA, lonA, latB, lonB) {
  const rad = Math.PI / 180;
  const earthRadiusM = 6_371_000;

  const phi1 = Number(latA) * rad;
  const phi2 = Number(latB) * rad;
  const deltaPhi = (Number(latB) - Number(latA)) * rad;
  const deltaLambda = (Number(lonB) - Number(lonA)) * rad;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) *
      Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusM * c;
}

function estimateDurationSeconds(distanceMeters, speedKmph) {
  const numericDistance = Number(distanceMeters);
  const numericSpeed = Number(speedKmph);

  if (!Number.isFinite(numericDistance) || numericDistance <= 0) {
    return null;
  }
  if (!Number.isFinite(numericSpeed) || numericSpeed <= 0) {
    return null;
  }

  const speedMetersPerSecond = (numericSpeed * 1000) / 3600;
  return numericDistance / speedMetersPerSecond;
}

function parseBoundedFloat(rawValue, min, max) {
  const numeric = Number(rawValue);
  if (!Number.isFinite(numeric) || numeric < min || numeric > max) {
    return null;
  }
  return numeric;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function validatePlacePayload(payload, options = {}) {
  const partial = options.partial === true;
  const errors = [];

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {
      value: null,
      errors: ["Payload must be an object."]
    };
  }

  const source = { ...payload };
  if (!Object.prototype.hasOwnProperty.call(source, "name") && typeof source.title === "string") {
    source.name = source.title;
  }
  if (!Object.prototype.hasOwnProperty.call(source, "lon") && Object.prototype.hasOwnProperty.call(source, "lng")) {
    source.lon = source.lng;
  }
  if (!Object.prototype.hasOwnProperty.call(source, "image") && typeof source.image_url === "string") {
    source.image = source.image_url;
  }
  if (!Object.prototype.hasOwnProperty.call(source, "category") && typeof source.kind === "string") {
    source.category = source.kind;
  }
  if (!Object.prototype.hasOwnProperty.call(source, "tags") && Array.isArray(source.highlights)) {
    source.tags = source.highlights;
  }

  const allowedKeys = new Set([
    "id",
    "name",
    "title",
    "region",
    "description",
    "lat",
    "lon",
    "lng",
    "link",
    "image",
    "image_url",
    "country",
    "countryCode",
    "timezone",
    "utcOffset",
    "population",
    "areaKm2",
    "climate",
    "founded",
    "funFact",
    "highlights",
    "category",
    "kind",
    "city",
    "currency",
    "languages",
    "tags",
    "createdAt",
    "updatedAt",
    "is_public",
    "isPublic",
    "is_free",
    "isFree",
    "family_friendly",
    "familyFriendly"
  ]);
  const keys = Object.keys(source);

  for (const key of keys) {
    if (!allowedKeys.has(key)) {
      errors.push(`Field '${key}' is not allowed.`);
    }
  }

  if (partial && keys.length === 0) {
    errors.push("PATCH payload cannot be empty.");
  }

  const value = {};

  normalizeTextField(source, value, "name", { min: 2, max: 120, partial, errors });
  normalizeTextField(source, value, "region", { min: 2, max: 80, partial, errors });
  normalizeOptionalTextField(source, value, "description", { min: 0, max: 600, partial, errors });
  normalizeNumberField(source, value, "lat", { min: -90, max: 90, partial, errors });
  normalizeNumberField(source, value, "lon", { min: -180, max: 180, partial, errors });
  normalizeLinkField(source, value, { partial, errors });
  normalizeImageField(source, value, { partial, errors });
  normalizeOptionalTextField(source, value, "country", { min: 2, max: 80, partial, errors });
  normalizeCountryCodeField(source, value, { partial, errors });
  normalizeOptionalTextField(source, value, "timezone", { min: 2, max: 80, partial, errors });
  normalizeOptionalIntegerField(source, value, "population", {
    min: 1,
    max: 60_000_000,
    partial,
    errors
  });
  normalizeOptionalTextField(source, value, "climate", { min: 2, max: 120, partial, errors });
  normalizeOptionalTextField(source, value, "founded", { min: 2, max: 60, partial, errors });
  normalizeOptionalTextField(source, value, "funFact", { min: 0, max: 260, partial, errors });
  normalizeOptionalTextField(source, value, "category", { min: 2, max: 40, partial, errors });
  normalizeStringArrayField(source, value, "highlights", {
    minItems: 0,
    maxItems: 6,
    minLength: 2,
    maxLength: 64,
    partial,
    errors
  });
  normalizeStringArrayField(source, value, "tags", {
    minItems: 0,
    maxItems: 20,
    minLength: 2,
    maxLength: 48,
    partial,
    errors
  });
  normalizeOptionalBooleanField(
    source,
    value,
    {
      targetKey: "is_public",
      sourceKeys: ["is_public", "isPublic"],
      defaultValue: true
    },
    { partial, errors }
  );
  normalizeOptionalBooleanField(
    source,
    value,
    {
      targetKey: "isFree",
      sourceKeys: ["isFree", "is_free"],
      defaultValue: false
    },
    { partial, errors }
  );
  normalizeOptionalBooleanField(
    source,
    value,
    {
      targetKey: "familyFriendly",
      sourceKeys: ["familyFriendly", "family_friendly"],
      defaultValue: false
    },
    { partial, errors }
  );

  if (!Object.prototype.hasOwnProperty.call(value, "tags") && Array.isArray(value.highlights)) {
    value.tags = [...value.highlights];
  }
  if (!Object.prototype.hasOwnProperty.call(value, "highlights") && Array.isArray(value.tags)) {
    value.highlights = value.tags.slice(0, 6);
  }

  return { value, errors };
}

function normalizeTextField(payload, target, key, options) {
  const { min, max, partial, errors } = options;
  const hasKey = Object.prototype.hasOwnProperty.call(payload, key);

  if (!hasKey) {
    if (!partial) {
      errors.push(`Field '${key}' is required.`);
    }
    return;
  }

  const rawValue = payload[key];
  if (typeof rawValue !== "string") {
    errors.push(`Field '${key}' must be a string.`);
    return;
  }

  const normalized = rawValue.trim();
  if (normalized.length < min || normalized.length > max) {
    errors.push(`Field '${key}' must contain ${min}-${max} characters.`);
    return;
  }

  target[key] = normalized;
}

function normalizeNumberField(payload, target, key, options) {
  const { min, max, partial, errors } = options;
  const hasKey = Object.prototype.hasOwnProperty.call(payload, key);

  if (!hasKey) {
    if (!partial) {
      errors.push(`Field '${key}' is required.`);
    }
    return;
  }

  const numeric = Number(payload[key]);
  if (!Number.isFinite(numeric) || numeric < min || numeric > max) {
    errors.push(`Field '${key}' must be between ${min} and ${max}.`);
    return;
  }

  target[key] = numeric;
}

function normalizeLinkField(payload, target, options) {
  const { partial, errors } = options;
  const hasKey = Object.prototype.hasOwnProperty.call(payload, "link");

  if (!hasKey) {
    if (!partial) {
      target.link = "";
    }
    return;
  }

  const rawLink = payload.link;
  if (rawLink === null || rawLink === "") {
    target.link = "";
    return;
  }

  if (typeof rawLink !== "string") {
    errors.push("Field 'link' must be a string or empty value.");
    return;
  }

  const normalized = normalizeHttpUrl(rawLink);
  if (!normalized) {
    errors.push("Field 'link' must contain valid http/https URL.");
    return;
  }

  target.link = normalized;
}

function normalizeImageField(payload, target, options) {
  const { partial, errors } = options;
  const hasKey = Object.prototype.hasOwnProperty.call(payload, "image");

  if (!hasKey) {
    if (!partial) {
      target.image = "";
    }
    return;
  }

  const rawImage = payload.image;
  if (rawImage === null || rawImage === "") {
    target.image = "";
    return;
  }

  if (typeof rawImage !== "string") {
    errors.push("Field 'image' must be a string or empty value.");
    return;
  }

  const normalized = normalizeHttpUrl(rawImage);
  if (!normalized) {
    errors.push("Field 'image' must contain valid http/https URL.");
    return;
  }

  target.image = normalized;
}

function normalizeOptionalTextField(payload, target, key, options) {
  const { min, max, partial, errors } = options;
  const hasKey = Object.prototype.hasOwnProperty.call(payload, key);

  if (!hasKey) {
    if (!partial) {
      target[key] = "";
    }
    return;
  }

  const rawValue = payload[key];
  if (rawValue === null || rawValue === "") {
    target[key] = "";
    return;
  }

  if (typeof rawValue !== "string") {
    errors.push(`Field '${key}' must be a string or empty value.`);
    return;
  }

  const normalized = rawValue.trim();
  if (normalized.length < min || normalized.length > max) {
    errors.push(`Field '${key}' must contain ${min}-${max} characters.`);
    return;
  }

  target[key] = normalized;
}

function normalizeCountryCodeField(payload, target, options) {
  const { partial, errors } = options;
  const hasKey = Object.prototype.hasOwnProperty.call(payload, "countryCode");

  if (!hasKey) {
    if (!partial) {
      target.countryCode = "";
    }
    return;
  }

  const rawValue = payload.countryCode;
  if (rawValue === null || rawValue === "") {
    target.countryCode = "";
    return;
  }

  if (typeof rawValue !== "string") {
    errors.push("Field 'countryCode' must be a string or empty value.");
    return;
  }

  const normalized = rawValue.trim().toUpperCase();
  if (!/^[A-Z]{2,3}$/.test(normalized)) {
    errors.push("Field 'countryCode' must contain 2-3 latin letters.");
    return;
  }

  target.countryCode = normalized;
}

function normalizeOptionalIntegerField(payload, target, key, options) {
  const { min, max, partial, errors } = options;
  const hasKey = Object.prototype.hasOwnProperty.call(payload, key);

  if (!hasKey) {
    if (!partial) {
      target[key] = null;
    }
    return;
  }

  const rawValue = payload[key];
  if (rawValue === null || rawValue === "") {
    target[key] = null;
    return;
  }

  const numeric = Number(rawValue);
  if (!Number.isInteger(numeric) || numeric < min || numeric > max) {
    errors.push(`Field '${key}' must be an integer between ${min} and ${max}.`);
    return;
  }

  target[key] = numeric;
}

function normalizeOptionalBooleanField(payload, target, config, options) {
  const { targetKey, sourceKeys, defaultValue = false } = config;
  const { partial, errors } = options;
  const keys = Array.isArray(sourceKeys) ? sourceKeys : [];
  const existingKey = keys.find((key) => Object.prototype.hasOwnProperty.call(payload, key));

  if (!existingKey) {
    if (!partial) {
      target[targetKey] = Boolean(defaultValue);
    }
    return;
  }

  const value = payload[existingKey];
  const normalized = parseBooleanLike(value);
  if (normalized === null) {
    errors.push(`Field '${existingKey}' must be boolean.`);
    return;
  }

  target[targetKey] = normalized;
}

function normalizeStringArrayField(payload, target, key, options) {
  const { minItems, maxItems, minLength, maxLength, partial, errors } = options;
  const hasKey = Object.prototype.hasOwnProperty.call(payload, key);

  if (!hasKey) {
    if (!partial) {
      target[key] = [];
    }
    return;
  }

  const rawValue = payload[key];
  if (rawValue === null) {
    target[key] = [];
    return;
  }

  if (!Array.isArray(rawValue)) {
    errors.push(`Field '${key}' must be an array.`);
    return;
  }

  if (rawValue.length < minItems || rawValue.length > maxItems) {
    errors.push(`Field '${key}' must contain ${minItems}-${maxItems} items.`);
    return;
  }

  const normalized = [];
  for (const [index, item] of rawValue.entries()) {
    if (typeof item !== "string") {
      errors.push(`Field '${key}[${index}]' must be a string.`);
      continue;
    }

    const text = item.trim();
    if (text.length < minLength || text.length > maxLength) {
      errors.push(
        `Field '${key}[${index}]' must contain ${minLength}-${maxLength} characters.`
      );
      continue;
    }

    normalized.push(text);
  }

  if (normalized.length > 0) {
    target[key] = normalized;
  } else if (errors.every((entry) => !entry.startsWith(`Field '${key}[`))) {
    target[key] = [];
  }
}

function normalizeHttpUrl(rawUrl) {
  try {
    const parsed = new URL(String(rawUrl).trim());
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.href;
    }
    return null;
  } catch {
    return null;
  }
}

async function readPlacesFromDisk() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      throw new Error("places.json must contain an array.");
    }

    const normalized = [];
    const ids = new Set();

    for (const candidate of parsed) {
      const normalizedPlace = normalizeStoredPlace(candidate, ids);
      if (normalizedPlace) {
        normalized.push(normalizedPlace);
        ids.add(normalizedPlace.id);
      }
    }

    return normalized;
  } catch (error) {
    if (error.code === "ENOENT") {
      await fs.writeFile(DATA_FILE, "[]\n", "utf8");
      return [];
    }

    throw error;
  }
}

function normalizeStoredPlace(candidate, existingIds) {
  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  const { value, errors } = validatePlacePayload(candidate, { partial: false });
  if (errors.length > 0) {
    return null;
  }

  const id =
    typeof candidate.id === "string" && candidate.id.trim() !== "" && !existingIds.has(candidate.id.trim())
      ? candidate.id.trim()
      : generatePlaceId(value.name, Array.from(existingIds).map((idValue) => ({ id: idValue })));

  const createdAt =
    typeof candidate.createdAt === "string" && candidate.createdAt.trim() !== ""
      ? candidate.createdAt
      : new Date().toISOString();

  const updatedAt =
    typeof candidate.updatedAt === "string" && candidate.updatedAt.trim() !== ""
      ? candidate.updatedAt
      : new Date().toISOString();

  return {
    ...value,
    id,
    createdAt,
    updatedAt
  };
}

async function persistPlaces(nextPlaces) {
  writeQueue = writeQueue
    .catch((error) => {
      console.error("[persist] previous write failed", error);
    })
    .then(async () => {
      const payload = `${JSON.stringify(nextPlaces, null, 2)}\n`;
      await fs.writeFile(DATA_FILE, payload, "utf8");
      placesCache = nextPlaces;
    });

  await writeQueue;
}

function generatePlaceId(placeName, places) {
  const base = slugify(placeName);
  const used = new Set(places.map((entry) => entry.id));

  if (!used.has(base)) {
    return base;
  }

  let candidate = base;
  do {
    candidate = `${base}-${crypto.randomBytes(2).toString("hex")}`;
  } while (used.has(candidate));

  return candidate;
}

function slugify(value) {
  const normalized = String(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);

  return normalized || "place";
}

function parseInteger(rawValue, fallback) {
  const numeric = Number(rawValue);
  if (!Number.isInteger(numeric)) {
    return fallback;
  }
  return numeric;
}

function parseBooleanLike(value) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value === 1 ? true : (value === 0 ? false : null);
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) {
      return true;
    }
    if (["false", "0", "no", "off"].includes(normalized)) {
      return false;
    }
  }
  return null;
}

function parseBooleanQueryValue(rawValue) {
  return parseBooleanLike(rawValue) === true;
}

function normalizeSortFieldToken(value) {
  const token = String(value || "").trim().toLowerCase();
  if (token === "updated") {
    return "updatedAt";
  }
  if (token === "created") {
    return "createdAt";
  }
  if (token === "lng") {
    return "lon";
  }
  return token || "name";
}

function resolveBooleanField(source, keys) {
  if (!source || typeof source !== "object" || !Array.isArray(keys)) {
    return false;
  }

  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) {
      continue;
    }
    const normalized = parseBooleanLike(source[key]);
    if (normalized !== null) {
      return normalized;
    }
  }

  return false;
}

function parsePort(rawPort, fallbackPort) {
  const numeric = Number(rawPort);
  if (Number.isInteger(numeric) && numeric > 0 && numeric <= 65535) {
    return numeric;
  }
  return fallbackPort;
}

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function requestLogger(req, res, next) {
  const startedAt = process.hrtime.bigint();

  res.on("finish", () => {
    const endedAt = process.hrtime.bigint();
    const durationMs = Number(endedAt - startedAt) / 1_000_000;

    const logRecord = {
      ts: new Date().toISOString(),
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Number(durationMs.toFixed(1)),
      ip: req.ip
    };

    console.log(JSON.stringify(logRecord));
  });

  next();
}

module.exports = { app, start, parsePort };
