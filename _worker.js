const WEATHER_API_ENDPOINT = "https://api.weatherapi.com/v1/forecast.json";
const SUPABASE_URL_FALLBACK = "https://ruhgizowwafhyvtyrcuc.supabase.co";
const SUPABASE_PUBLISHABLE_KEY_FALLBACK = "sb_publishable_IoC3P4HXrhxZ-IO-dpm8eQ_hZhsdj_V";
const SUPABASE_SERVICE_ROLE_ENV_KEY = "SUPABASE_SERVICE_ROLE";
const ACCESS_COOKIE_SECRET_ENV_KEY = "APP_ACCESS_COOKIE_SECRET";
const WEATHER_CACHE_TTL_MS = 10 * 60 * 1000;
const WEATHER_CACHE_CONTROL = "public, max-age=300, s-maxage=600, stale-while-revalidate=120";
const WEATHER_TIMEOUT_MS = 5000;
const ROUTE_TIMEOUT_MS = 9000;
const ROUTE_MAX_POINTS = 10;
const REGISTER_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const REGISTER_RATE_LIMIT_MAX = 5;
const REGISTRATION_PASSWORD_MIN_LENGTH = 6;
const VISITOR_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{11,119}$/i;
const BANNED_PATHNAME = "/banned";
const BANNED_ASSET_PATH = "/banned-page.txt";
const ACCESS_STATE_PATH = "/api/access-state";
const SESSION_SYNC_PATH = "/api/session/sync";
const USER_PING_PATH = "/api/user/ping";
const PUBLIC_PLACES_QUERY_LIMIT = 1000;
const PUBLIC_REVIEWS_LIMIT = 5;
const PUBLIC_PLACES_CACHE_TTL_MS = 0;
const PUBLIC_COMMUNITY_CACHE_TTL_MS = 30 * 1000;
const VISITOR_COOKIE_NAME = "wa_vid";
const VISITOR_COOKIE_SIG_NAME = "wa_vid_sig";
const USER_COOKIE_NAME = "wa_uid";
const USER_COOKIE_SIG_NAME = "wa_uid_sig";
const VISITOR_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 180;
const USER_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 14;

const ROUTE_MODES = Object.freeze({
  walk: Object.freeze({
    key: "walk",
    label: "Walk",
    speedKmph: 5,
    flightOverheadMinutes: 0
  }),
  car: Object.freeze({
    key: "car",
    label: "Car",
    speedKmph: 70,
    flightOverheadMinutes: 0
  }),
  flight: Object.freeze({
    key: "flight",
    label: "Flight",
    speedKmph: 800,
    flightOverheadMinutes: 60
  })
});

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

const routeCache = new Map();
const weatherCache = new Map();
const registrationRateLimitCache = new Map();
const publicPlacesCache = new Map();
const publicCommunityCache = new Map();

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const normalizedPath = normalizePathname(url.pathname);

    if (url.pathname === "/api/health") {
      return jsonResponse({
        status: "ok",
        now: new Date().toISOString()
      });
    }

    if (url.pathname === SESSION_SYNC_PATH) {
      return handleSessionSync(request, url, env);
    }

    if (url.pathname === USER_PING_PATH) {
      return handleUserPing(request, url, env);
    }

    if (url.pathname === ACCESS_STATE_PATH) {
      return handleAccessState(request, url, env);
    }

    if (url.pathname === "/api/weather") {
      const access = await resolveProtectedRequestAccess(request, url, env);
      if (access.isBlocked) {
        return createAccessDeniedJsonResponse(access);
      }
      return withAccessCookies(
        await handleWeather(request, url, env),
        access
      );
    }

    if (url.pathname === "/api/register") {
      const access = await resolveProtectedRequestAccess(request, url, env, {
        allowAnonymousBootstrap: true
      });
      if (access.isBlocked) {
        return createAccessDeniedJsonResponse(access);
      }
      return withAccessCookies(
        await handleRegister(request, url, env, access),
        access
      );
    }

    if (url.pathname === "/api/visitor/ping") {
      return handleVisitorPing(request, url, env);
    }

    if (url.pathname === "/api/route") {
      const access = await resolveProtectedRequestAccess(request, url, env);
      if (access.isBlocked) {
        return createAccessDeniedJsonResponse(access);
      }
      return withAccessCookies(
        await handleRoute(url),
        access
      );
    }

    if (url.pathname === "/api/places") {
      const access = await resolveProtectedRequestAccess(request, url, env);
      if (access.isBlocked) {
        return createAccessDeniedJsonResponse(access);
      }
      return withAccessCookies(
        await handlePublicPlacesList(request, url, env),
        access
      );
    }

    if (url.pathname.startsWith("/api/places/")) {
      const access = await resolveProtectedRequestAccess(request, url, env);
      if (access.isBlocked) {
        return createAccessDeniedJsonResponse(access);
      }
      return withAccessCookies(
        await handlePublicPlaceByRef(request, url, env),
        access
      );
    }

    if (url.pathname === "/api/meta/regions") {
      const access = await resolveProtectedRequestAccess(request, url, env);
      if (access.isBlocked) {
        return createAccessDeniedJsonResponse(access);
      }
      return withAccessCookies(
        await handlePublicRegionsMeta(request, url, env),
        access
      );
    }

    if (url.pathname === "/api/community") {
      const access = await resolveProtectedRequestAccess(request, url, env);
      if (access.isBlocked) {
        return createAccessDeniedJsonResponse(access);
      }
      return withAccessCookies(
        await handlePublicCommunitySnapshot(request, url, env),
        access
      );
    }

    if (
      normalizedPath === BANNED_PATHNAME &&
      env.ASSETS &&
      typeof env.ASSETS.fetch === "function" &&
      isHtmlNavigationRequest(request)
    ) {
      const access = await resolveProtectedRequestAccess(request, url, env, {
        allowAnonymousBootstrap: true
      });
      const accessRedirect = createAccessRedirectResponse(request, url, access);
      if (accessRedirect) {
        return accessRedirect;
      }

      const bannedAssetUrl = new URL(url.toString());
      bannedAssetUrl.pathname = BANNED_ASSET_PATH;
      const bannedAssetResponse = await env.ASSETS.fetch(new Request(bannedAssetUrl.toString(), request));
      const bannedHeaders = new Headers(bannedAssetResponse.headers);
      bannedHeaders.set("content-type", "text/html; charset=utf-8");
      return withAccessCookies(
        new Response(bannedAssetResponse.body, {
          status: bannedAssetResponse.status,
          statusText: bannedAssetResponse.statusText,
          headers: bannedHeaders
        }),
        access
      );
    }

    const shouldGuardHtml = isHtmlNavigationRequest(request) || isProtectedStaticDataPath(url.pathname);
    if (shouldGuardHtml) {
      const access = await resolveProtectedRequestAccess(request, url, env, {
        allowAnonymousBootstrap: true
      });
      const accessRedirect = createAccessRedirectResponse(request, url, access);
      if (accessRedirect) {
        return accessRedirect;
      }

      if (env.ASSETS && typeof env.ASSETS.fetch === "function") {
        const assetResponse = await env.ASSETS.fetch(buildAssetRequest(request, url));
        return withAccessCookies(assetResponse, access);
      }
    }

    if (env.ASSETS && typeof env.ASSETS.fetch === "function") {
      return env.ASSETS.fetch(buildAssetRequest(request, url));
    }

    return jsonResponse({ error: "Not found." }, 404);
  }
};

async function handleWeather(_request, url, env) {
  const { query, errors } = normalizeWeatherQuery(url.searchParams);
  if (errors.length > 0) {
    return jsonResponse(
      {
        error: "Invalid weather query parameters",
        details: errors
      },
      400
    );
  }

  const apiKey = String(env.WEATHER_API_KEY || "").trim();
  if (!apiKey) {
    return jsonResponse({ error: "Weather API is not configured." }, 500);
  }

  const cacheKey = `${query.lat.toFixed(3)},${query.lon.toFixed(3)}`;
  const cached = readCache(weatherCache, cacheKey);
  if (cached) {
    return jsonResponse(
      {
        item: cached,
        cacheTtlMs: WEATHER_CACHE_TTL_MS
      },
      200,
      {
        "Cache-Control": WEATHER_CACHE_CONTROL
      }
    );
  }

  const endpoint = new URL(WEATHER_API_ENDPOINT);
  endpoint.searchParams.set("key", apiKey);
  endpoint.searchParams.set("q", `${query.lat},${query.lon}`);
  endpoint.searchParams.set("days", "1");
  endpoint.searchParams.set("aqi", "no");
  endpoint.searchParams.set("alerts", "no");

  try {
    const payload = await fetchJson(endpoint.toString(), {
      timeoutMs: WEATHER_TIMEOUT_MS
    });
    const normalized = mapWeatherPayload(payload, query);
    writeCache(weatherCache, cacheKey, normalized, WEATHER_CACHE_TTL_MS, 300);
    return jsonResponse(
      {
        item: normalized,
        cacheTtlMs: WEATHER_CACHE_TTL_MS
      },
      200,
      {
        "Cache-Control": WEATHER_CACHE_CONTROL
      }
    );
  } catch (error) {
    return jsonResponse(
      {
        item: null,
        unavailable: true,
        error: normalizeErrorMessage(error, "Weather provider request failed.")
      },
      200,
      {
        "Cache-Control": "no-store"
      }
    );
  }
}

async function handleRegister(request, url, env, accessState = null) {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405, {
      Allow: "POST"
    });
  }

  if (!isTrustedBrowserOrigin(request, url)) {
    return jsonResponse({ error: "Untrusted origin." }, 403);
  }

  if (accessState?.isBlocked) {
    return createAccessDeniedJsonResponse(accessState);
  }

  const ip = normalizeClientIp(request);
  if (!consumeRateLimit(registrationRateLimitCache, ip, REGISTER_RATE_LIMIT_MAX, REGISTER_RATE_LIMIT_WINDOW_MS)) {
    return jsonResponse(
      {
        error: "Too many registration attempts. Please try again later."
      },
      429
    );
  }

  const { body, error } = await readJsonBody(request);
  if (error) {
    return jsonResponse({ error }, 400);
  }

  const payload = normalizeRegistrationPayload(body);
  if (payload.errors.length > 0) {
    return jsonResponse(
      {
        error: "Invalid registration payload.",
        details: payload.errors
      },
      400
    );
  }

  const serviceRole = normalizeSupabaseServiceRole(env);
  if (!serviceRole) {
    return jsonResponse(
      {
        error: "Registration service is not configured."
      },
      503
    );
  }

  try {
    const response = await supabaseAdminRequest(env, serviceRole, {
      method: "POST",
      path: "/auth/v1/admin/users",
      body: {
        email: payload.email,
        password: payload.password,
        email_confirm: true,
        user_metadata: payload.displayName
          ? {
              display_name: payload.displayName
            }
          : {}
      }
    });

    const user = response?.payload?.user || response?.payload || null;
    return jsonResponse(
      {
        ok: true,
        user: {
          id: typeof user?.id === "string" ? user.id : "",
          email: typeof user?.email === "string" ? user.email : payload.email
        }
      },
      201
    );
  } catch (supabaseError) {
    const details = normalizeSupabaseErrorPayload(supabaseError);
    const errorText = `${details.message} ${details.details}`.trim().toLowerCase();
    if (
      errorText.includes("already") ||
      errorText.includes("registered") ||
      errorText.includes("exists") ||
      details.status === 409 ||
      details.status === 422
    ) {
      return jsonResponse(
        {
          error: "Account already exists."
        },
        409
      );
    }

    if (errorText.includes("password")) {
      return jsonResponse(
        {
          error: details.message || "Password does not meet requirements."
        },
        400
      );
    }

    if (details.status === 429) {
      return jsonResponse(
        {
          error: "Registration is temporarily rate-limited. Please try again later."
        },
        429
      );
    }

    return jsonResponse(
      {
        error: details.message || "Registration failed."
      },
      details.status >= 400 && details.status < 600 ? details.status : 502
    );
  }
}

async function handleVisitorPing(request, url, env) {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405, {
      Allow: "POST"
    });
  }

  if (!isTrustedBrowserOrigin(request, url)) {
    return jsonResponse({ error: "Untrusted origin." }, 403);
  }

  const serviceRole = normalizeSupabaseServiceRole(env);
  if (!serviceRole) {
    return jsonResponse(
      {
        error: "Visitor presence service is not configured."
      },
      503
    );
  }

  const { body, error } = await readJsonBody(request);
  if (error) {
    return jsonResponse({ error }, 400);
  }

  const payload = normalizeVisitorPingPayload(body, request);
  const requestGeo = extractRequestGeo(request);
  const visitorIdentity = await resolveVisitorIdentity(request, url, env, {
    requestedVisitorId: payload.visitorId
  });
  payload.visitorId = visitorIdentity.visitorId;
  payload.displayName = normalizeVisitorDisplayName(payload.displayName, payload.visitorId);

  if (!payload.visitorId) {
    payload.errors.push("visitorId is invalid.");
  }

  if (payload.errors.length > 0) {
    return jsonResponse(
      {
        error: "Invalid visitor payload.",
        details: payload.errors
      },
      400
    );
  }

  const accessState = await resolveProtectedRequestAccess(request, url, env, {
    allowAnonymousBootstrap: true,
    identityOverride: {
      visitorId: payload.visitorId,
      userId: payload.userId || ""
    }
  });

  try {
    await upsertVisitorStatus(env, serviceRole, {
      ...payload,
      ...requestGeo
    });
    return withAccessCookies(
      jsonResponse({
        ok: true,
        visitor: {
          visitorId: payload.visitorId,
          displayName: payload.displayName,
          role: payload.role,
          lastSeen: payload.lastSeen
        },
        access: accessState.publicAccess
      }),
      accessState
    );
  } catch (supabaseError) {
    const details = normalizeSupabaseErrorPayload(supabaseError);
    if (isSupabaseMissingRelationError(details)) {
      return withAccessCookies(
        jsonResponse({
          ok: false,
          unsupported: true,
          visitor: {
            visitorId: payload.visitorId,
            displayName: payload.displayName,
            role: payload.role,
            lastSeen: payload.lastSeen
          },
          access: accessState.publicAccess
        }),
        accessState
      );
    }
    return withAccessCookies(
      jsonResponse(
        {
          error: details.message || "Visitor presence update failed.",
          access: accessState.publicAccess
        },
        details.status >= 400 && details.status < 600 ? details.status : 502
      ),
      accessState
    );
  }
}

async function handleSessionSync(request, url, env) {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405, {
      Allow: "POST"
    });
  }

  if (!isTrustedBrowserOrigin(request, url)) {
    return jsonResponse({ error: "Untrusted origin." }, 403);
  }

  const { body, error } = await readJsonBody(request);
  if (error) {
    return jsonResponse({ error }, 400);
  }

  const payload = body && typeof body === "object" ? body : {};
  const clearSession = payload.clear === true || !normalizeText(payload.accessToken, "");
  const pathName = normalizeRequestPathName(payload.pathName || payload.pathname || payload.path);
  const userAgent = String(request.headers.get("user-agent") || "").trim().slice(0, 260);
  const lastIp = normalizeClientIp(request);
  const requestGeo = extractRequestGeo(request);
  const visitorIdentity = await resolveVisitorIdentity(request, url, env, {
    requestedVisitorId: normalizeText(payload.visitorId, "")
  });

  if (clearSession) {
    const accessState = await resolveProtectedRequestAccess(request, url, env, {
      allowAnonymousBootstrap: true,
      identityOverride: {
        visitorId: visitorIdentity.visitorId,
        userId: ""
      }
    });
    const response = jsonResponse({
      ok: true,
      cleared: true,
      visitor: {
        visitorId: visitorIdentity.visitorId
      },
      access: accessState.publicAccess
    });
    return withCookieHeaders(response, [
      ...visitorIdentity.setCookieHeaders,
      ...(await buildUserCookieHeaders("", url, env))
    ]);
  }

  const accessToken = normalizeText(payload.accessToken, "");
  if (!accessToken) {
    return jsonResponse({ error: "accessToken is required." }, 400);
  }

  const authUser = await resolveAuthUserFromAccessToken(env, accessToken);
  if (!authUser?.id) {
    return jsonResponse({ error: "Authentication failed." }, 401);
  }

  const accessState = await resolveProtectedRequestAccess(request, url, env, {
    allowAnonymousBootstrap: true,
    identityOverride: {
      visitorId: visitorIdentity.visitorId,
      userId: authUser.id
    }
  });

  const serviceRole = normalizeSupabaseServiceRole(env);
  if (serviceRole) {
    try {
      await upsertUserStatus(env, serviceRole, {
        userId: authUser.id,
        email: normalizeText(authUser.email, ""),
        role: "user",
        lastSeen: new Date().toISOString(),
        pathName,
        userAgent,
        lastIp,
        ...requestGeo
      });
    } catch (error) {
      console.warn("[worker] Failed to upsert user_status during session sync:", normalizeErrorMessage(error, "user_status upsert failed."));
    }
  }

  const response = jsonResponse({
    ok: true,
    user: {
      id: authUser.id,
      email: normalizeText(authUser.email, "")
    },
    visitor: {
      visitorId: visitorIdentity.visitorId
    },
    access: accessState.publicAccess
  });
  return withCookieHeaders(response, [
    ...visitorIdentity.setCookieHeaders,
    ...(await buildUserCookieHeaders(authUser.id, url, env))
  ]);
}

async function handleUserPing(request, url, env) {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405, {
      Allow: "POST"
    });
  }

  if (!isTrustedBrowserOrigin(request, url)) {
    return jsonResponse({ error: "Untrusted origin." }, 403);
  }

  const { body, error } = await readJsonBody(request);
  if (error) {
    return jsonResponse({ error }, 400);
  }

  const payload = body && typeof body === "object" ? body : {};
  const accessToken = normalizeText(payload.accessToken, "");
  const pathName = normalizeRequestPathName(payload.pathName || payload.pathname || payload.path);
  const userAgent = String(request.headers.get("user-agent") || "").trim().slice(0, 260);
  const lastIp = normalizeClientIp(request);
  const requestGeo = extractRequestGeo(request);
  if (!accessToken) {
    return jsonResponse({ error: "accessToken is required." }, 400);
  }

  const authUser = await resolveAuthUserFromAccessToken(env, accessToken);
  if (!authUser?.id) {
    return jsonResponse({ error: "Authentication failed." }, 401);
  }

  const visitorIdentity = await resolveVisitorIdentity(request, url, env, {
    requestedVisitorId: normalizeText(payload.visitorId, "")
  });
  const accessState = await resolveProtectedRequestAccess(request, url, env, {
    allowAnonymousBootstrap: true,
    identityOverride: {
      visitorId: visitorIdentity.visitorId,
      userId: authUser.id
    }
  });

  const serviceRole = normalizeSupabaseServiceRole(env);
  if (!serviceRole) {
    return withAccessCookies(
      jsonResponse({
        ok: false,
        error: "User presence service is not configured.",
        access: accessState.publicAccess
      }, 503),
      accessState
    );
  }

  try {
    await upsertUserStatus(env, serviceRole, {
      userId: authUser.id,
      email: normalizeText(authUser.email, ""),
      role: "user",
      lastSeen: new Date().toISOString(),
      pathName,
      userAgent,
      lastIp,
      ...requestGeo
    });
  } catch (supabaseError) {
    const details = normalizeSupabaseErrorPayload(supabaseError);
    return withAccessCookies(
      jsonResponse({
        ok: false,
        error: details.message || "User presence update failed.",
        access: accessState.publicAccess
      }, details.status >= 400 && details.status < 600 ? details.status : 502),
      accessState
    );
  }

  return withAccessCookies(
    jsonResponse({
      ok: true,
      user: {
        id: authUser.id,
        email: normalizeText(authUser.email, "")
      },
      visitor: {
        visitorId: visitorIdentity.visitorId
      },
      access: accessState.publicAccess
    }),
    accessState
  );
}

async function handleAccessState(request, url, env) {
  if (request.method !== "GET") {
    return jsonResponse({ error: "Method not allowed." }, 405, {
      Allow: "GET"
    });
  }

  const accessState = await resolveProtectedRequestAccess(request, url, env, {
    allowAnonymousBootstrap: true
  });
  return withAccessCookies(
    jsonResponse({
      ok: true,
      access: accessState.publicAccess
    }, 200, {
      "Cache-Control": "no-store"
    }),
    accessState
  );
}

async function handleRoute(url) {
  const { query, errors } = normalizeRouteQuery(url.searchParams);
  if (errors.length > 0) {
    return jsonResponse(
      {
        error: "Invalid route query parameters",
        details: errors
      },
      400,
      { "Cache-Control": "no-store" }
    );
  }

  try {
    const payload = await fetchRouteWithProviderFallback(query);
    return jsonResponse(payload, 200, { "Cache-Control": "no-store" });
  } catch (error) {
    return jsonResponse(
      {
        error: normalizeErrorMessage(error, "Route request failed.")
      },
      502,
      { "Cache-Control": "no-store" }
    );
  }
}

async function handlePublicPlacesList(_request, _url, env) {
  const serviceRole = normalizeSupabaseServiceRole(env);
  if (!serviceRole) {
    return jsonResponse({ error: "Public places service is not configured." }, 503);
  }

  try {
    const rows = await loadPublicPlaceRows(env, serviceRole);
    return jsonResponse({
      items: rows.map((row) => mapSupabasePlaceRowToApiPlace(row)).filter(Boolean),
      total: rows.length,
      limit: rows.length,
      offset: 0,
      source: "supabase"
    }, 200, {
      "Cache-Control": "no-store"
    });
  } catch (error) {
    const fallback = await loadFallbackPlacesFromStatic(env);
    if (fallback.length > 0) {
      return jsonResponse({
        items: fallback,
        total: fallback.length,
        limit: fallback.length,
        offset: 0,
        source: "static-fallback"
      }, 200, {
        "Cache-Control": "no-store"
      });
    }
    return jsonResponse({
      error: normalizeErrorMessage(error, "Failed to load places.")
    }, 502, {
      "Cache-Control": "no-store"
    });
  }
}

async function handlePublicPlaceByRef(_request, url, env) {
  const placeRef = decodeURIComponent(
    url.pathname.slice("/api/places/".length).trim()
  ).trim();
  if (!placeRef) {
    return jsonResponse({ error: "Place reference is required." }, 400);
  }

  const serviceRole = normalizeSupabaseServiceRole(env);
  if (!serviceRole) {
    return jsonResponse({ error: "Public places service is not configured." }, 503);
  }

  try {
    const row = await loadSinglePublicPlaceRow(env, serviceRole, placeRef);
    if (!row) {
      return jsonResponse({ error: "Place not found." }, 404);
    }

    const mapped = mapSupabasePlaceRowToApiPlace(row);
    if (!mapped) {
      return jsonResponse({ error: "Place data is invalid." }, 404);
    }

    return jsonResponse({
      item: mapped,
      source: "supabase"
    }, 200, {
      "Cache-Control": "no-store"
    });
  } catch (error) {
    return jsonResponse({
      error: normalizeErrorMessage(error, "Failed to load place.")
    }, 502, {
      "Cache-Control": "no-store"
    });
  }
}

async function handlePublicRegionsMeta(_request, _url, env) {
  const serviceRole = normalizeSupabaseServiceRole(env);
  if (!serviceRole) {
    return jsonResponse({ error: "Regions service is not configured." }, 503);
  }

  try {
    const rows = await loadPublicPlaceRows(env, serviceRole);
    const counters = new Map();
    rows.forEach((row) => {
      const place = mapSupabasePlaceRowToApiPlace(row);
      if (!place) {
        return;
      }
      const region = normalizeText(place.region, "Region unspecified");
      counters.set(region, (counters.get(region) || 0) + 1);
    });

    const items = Array.from(counters.entries())
      .map(([region, count]) => ({ region, count }))
      .sort((left, right) => right.count - left.count || left.region.localeCompare(right.region, "ru"));

    return jsonResponse({
      items,
      totalRegions: items.length
    }, 200, {
      "Cache-Control": "no-store"
    });
  } catch (error) {
    return jsonResponse({
      error: normalizeErrorMessage(error, "Failed to load regions.")
    }, 502, {
      "Cache-Control": "no-store"
    });
  }
}

async function handlePublicCommunitySnapshot(_request, url, env) {
  const placeRef = normalizeText(url.searchParams.get("placeId") || url.searchParams.get("placeRef"), "");
  if (!placeRef) {
    return jsonResponse({
      average: 0,
      count: 0,
      reviews: []
    }, 200, {
      "Cache-Control": "no-store"
    });
  }

  const serviceRole = normalizeSupabaseServiceRole(env);
  if (!serviceRole) {
    return jsonResponse({ error: "Community reviews service is not configured." }, 503);
  }

  try {
    const resolvedPlaceId = await resolvePublicPlaceId(env, serviceRole, placeRef);
    if (!resolvedPlaceId) {
      return jsonResponse({
        average: 0,
        count: 0,
        reviews: []
      }, 200, {
        "Cache-Control": "no-store"
      });
    }

    const [reviews, summary] = await Promise.all([
      loadPublicCommunityReviews(env, serviceRole, resolvedPlaceId),
      loadPublicCommunitySummary(env, serviceRole, resolvedPlaceId)
    ]);
    return jsonResponse({
      average: summary.average,
      count: summary.count,
      reviews
    }, 200, {
      "Cache-Control": "no-store"
    });
  } catch (error) {
    return jsonResponse({
      average: 0,
      count: 0,
      reviews: [],
      loadError: normalizeErrorMessage(error, "Failed to load community reviews.")
    }, 200, {
      "Cache-Control": "no-store"
    });
  }
}

async function resolveProtectedRequestAccess(request, url, env, options = {}) {
  const identityOverride = options.identityOverride && typeof options.identityOverride === "object"
    ? options.identityOverride
    : {};
  const visitorIdentity = await resolveVisitorIdentity(request, url, env, {
    requestedVisitorId: normalizeText(identityOverride.visitorId, "")
  });
  const serviceRole = normalizeSupabaseServiceRole(env);
  const cookieUserId = await readSignedCookieValue(
    request,
    USER_COOKIE_NAME,
    USER_COOKIE_SIG_NAME,
    env
  );
  const userId = normalizeUuid(identityOverride.userId || cookieUserId);

  let userBanState = createAccessSnapshot({
    userId,
    visitorId: visitorIdentity.visitorId
  });
  let visitorBanState = createAccessSnapshot({
    userId,
    visitorId: visitorIdentity.visitorId
  });

  if (serviceRole) {
    if (userId) {
      userBanState = await readUserBanState(env, serviceRole, userId);
    }
    if (visitorIdentity.visitorId) {
      visitorBanState = await readVisitorBanState(env, serviceRole, visitorIdentity.visitorId);
    }
  }

  const mergedAccess = mergeAccessSnapshots(
    createAccessSnapshot({
      userId,
      visitorId: visitorIdentity.visitorId
    }),
    userBanState,
    visitorBanState
  );

  return {
    ...mergedAccess,
    userId,
    visitorId: visitorIdentity.visitorId,
    setCookieHeaders: visitorIdentity.setCookieHeaders,
    publicAccess: toPublicAccessSnapshot(mergedAccess),
    isBlocked: mergedAccess.isBanned === true && options.skipBlock !== true
  };
}

function createAccessSnapshot(source = {}) {
  const safeSource = source && typeof source === "object" ? source : {};
  const bannedUntil = normalizeIsoTimestamp(safeSource.bannedUntil);
  const isBanned = safeSource.isBanned === true;
  const resolvedSource = normalizeText(safeSource.source, "").toLowerCase();
  const isUserBanned = safeSource.isUserBanned === true || (isBanned && resolvedSource === "user");
  const isVisitorBanned = safeSource.isVisitorBanned === true || (isBanned && resolvedSource === "visitor");

  return {
    userId: normalizeUuid(safeSource.userId),
    visitorId: normalizeVisitorId(safeSource.visitorId),
    isBanned,
    isUserBanned,
    isVisitorBanned,
    source: isBanned
      ? (resolvedSource === "user" ? "user" : "visitor")
      : "",
    reason: normalizeText(safeSource.reason, ""),
    bannedAt: normalizeIsoTimestamp(safeSource.bannedAt),
    bannedUntil,
    isPermanent: isBanned && !bannedUntil,
    checkedAt: normalizeIsoTimestamp(safeSource.checkedAt) || new Date().toISOString()
  };
}

function toPublicAccessSnapshot(snapshot) {
  const safeSnapshot = createAccessSnapshot(snapshot);
  return {
    userId: safeSnapshot.userId,
    visitorId: safeSnapshot.visitorId,
    isBanned: safeSnapshot.isBanned,
    isUserBanned: safeSnapshot.isUserBanned,
    isVisitorBanned: safeSnapshot.isVisitorBanned,
    source: safeSnapshot.source,
    reason: safeSnapshot.reason,
    bannedAt: safeSnapshot.bannedAt,
    bannedUntil: safeSnapshot.bannedUntil,
    isPermanent: safeSnapshot.isPermanent,
    checkedAt: safeSnapshot.checkedAt
  };
}

function mergeAccessSnapshots(...snapshots) {
  const normalized = snapshots
    .map((entry) => createAccessSnapshot(entry))
    .filter(Boolean);

  const merged = createAccessSnapshot({});
  for (const snapshot of normalized) {
    if (!merged.userId && snapshot.userId) {
      merged.userId = snapshot.userId;
    }
    if (!merged.visitorId && snapshot.visitorId) {
      merged.visitorId = snapshot.visitorId;
    }
  }

  const userBan = normalized.find((entry) => entry.isUserBanned === true);
  const visitorBan = normalized.find((entry) => entry.isVisitorBanned === true);
  const activeBan = userBan || visitorBan || null;
  if (!activeBan) {
    merged.checkedAt = new Date().toISOString();
    return merged;
  }

  return createAccessSnapshot({
    ...merged,
    ...activeBan,
    userId: merged.userId || activeBan.userId,
    visitorId: merged.visitorId || activeBan.visitorId,
    checkedAt: new Date().toISOString()
  });
}

async function resolveVisitorIdentity(request, url, env, options = {}) {
  const cookieState = await readSignedCookieState(
    request,
    VISITOR_COOKIE_NAME,
    VISITOR_COOKIE_SIG_NAME,
    env
  );
  let visitorId = cookieState.value || normalizeVisitorId(options.requestedVisitorId);
  if (!visitorId) {
    visitorId = createWorkerVisitorId();
  }

  const setCookieHeaders = (
    visitorId &&
    (cookieState.invalid === true || cookieState.value !== visitorId)
  )
    ? await buildSignedCookieHeaders(
        VISITOR_COOKIE_NAME,
        VISITOR_COOKIE_SIG_NAME,
        visitorId,
        VISITOR_COOKIE_MAX_AGE_SEC,
        url,
        env
      )
    : [];

  return {
    visitorId,
    setCookieHeaders
  };
}

function normalizeVisitorId(value) {
  const normalized = normalizeText(value, "");
  return VISITOR_ID_PATTERN.test(normalized) ? normalized : "";
}

function createWorkerVisitorId() {
  if (typeof crypto?.randomUUID === "function") {
    return `visitor_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
  }

  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return `visitor_${Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("")}`;
}

async function resolveAuthUserFromAccessToken(env, accessToken) {
  const safeAccessToken = normalizeText(accessToken, "");
  if (!safeAccessToken) {
    return null;
  }

  const supabaseUrl = String(env.SUPABASE_URL || SUPABASE_URL_FALLBACK || "").trim().replace(/\/+$/, "");
  const publishableKey = String(env.SUPABASE_PUBLISHABLE_KEY || SUPABASE_PUBLISHABLE_KEY_FALLBACK || "").trim();
  if (!supabaseUrl || !publishableKey) {
    return null;
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      apikey: publishableKey,
      Authorization: `Bearer ${safeAccessToken}`
    }
  });

  if (!response.ok) {
    return null;
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  const user = payload && typeof payload === "object" ? payload : null;
  const userId = normalizeUuid(user?.id);
  if (!userId) {
    return null;
  }

  return {
    id: userId,
    email: normalizeText(user?.email, "")
  };
}

async function readUserBanState(env, serviceRole, userId) {
  const safeUserId = normalizeUuid(userId);
  if (!safeUserId) {
    return createAccessSnapshot({});
  }

  try {
    const response = await supabaseAdminRequest(env, serviceRole, {
      method: "GET",
      path: `/rest/v1/user_bans?select=user_id,banned,reason,banned_at,banned_until,updated_at&user_id=eq.${encodeURIComponent(safeUserId)}&limit=1`
    });
    const entry = Array.isArray(response?.payload) ? response.payload[0] : null;
    return normalizeBanRow(entry, "user", {
      userId: safeUserId
    });
  } catch (error) {
    const details = normalizeSupabaseErrorPayload(error);
    if (isSupabaseMissingColumnError(details)) {
      const response = await supabaseAdminRequest(env, serviceRole, {
        method: "GET",
        path: `/rest/v1/user_bans?select=user_id,banned,reason,banned_at,updated_at&user_id=eq.${encodeURIComponent(safeUserId)}&limit=1`
      });
      const entry = Array.isArray(response?.payload) ? response.payload[0] : null;
      return normalizeBanRow(entry, "user", {
        userId: safeUserId
      });
    }
    throw error;
  }
}

function createAccessDeniedJsonResponse(accessState) {
  return withAccessCookies(
    jsonResponse(
      {
        error: "Access denied.",
        access: toPublicAccessSnapshot(accessState?.publicAccess || accessState)
      },
      403,
      {
        "Cache-Control": "no-store"
      }
    ),
    accessState
  );
}

function createAccessRedirectResponse(request, url, accessState) {
  const pathname = normalizePathname(url.pathname);
  const isBannedPage = pathname === BANNED_PATHNAME;
  const isBlocked = accessState?.publicAccess?.isBanned === true;

  if (isBannedPage && !isBlocked) {
    const redirectUrl = new URL("/", url);
    return withAccessCookies(Response.redirect(redirectUrl.toString(), 302), accessState);
  }

  if (!isBlocked) {
    return null;
  }

  if (isBannedPage) {
    return null;
  }

  if (isProtectedStaticDataPath(pathname)) {
    return withAccessCookies(
      new Response("Forbidden", {
        status: 403,
        headers: {
          "Cache-Control": "no-store",
          "content-type": "text/plain; charset=utf-8"
        }
      }),
      accessState
    );
  }

  if (!isHtmlNavigationRequest(request)) {
    return null;
  }

  const redirectUrl = new URL(BANNED_PATHNAME, url);
  const publicAccess = toPublicAccessSnapshot(accessState?.publicAccess || accessState);
  if (publicAccess.source) {
    redirectUrl.searchParams.set("source", publicAccess.source);
  }
  if (publicAccess.reason) {
    redirectUrl.searchParams.set("reason", publicAccess.reason);
  }
  if (publicAccess.bannedUntil) {
    redirectUrl.searchParams.set("until", publicAccess.bannedUntil);
  }
  if (publicAccess.isPermanent === true) {
    redirectUrl.searchParams.set("permanent", "1");
  }
  return withAccessCookies(Response.redirect(redirectUrl.toString(), 302), accessState);
}

function isHtmlNavigationRequest(request) {
  if (request.method !== "GET") {
    return false;
  }

  const accept = normalizeText(request.headers.get("accept"), "").toLowerCase();
  const mode = normalizeText(request.headers.get("sec-fetch-mode"), "").toLowerCase();
  const dest = normalizeText(request.headers.get("sec-fetch-dest"), "").toLowerCase();

  return (
    mode === "navigate" ||
    dest === "document" ||
    accept.includes("text/html")
  );
}

function isProtectedStaticDataPath(pathname) {
  const normalized = normalizePathname(pathname);
  return normalized === "/places.json" || normalized === "/data/places.json";
}

function buildAssetRequest(request, url) {
  const pathname = normalizePathname(url.pathname);
  if (pathname !== BANNED_PATHNAME) {
    return request;
  }

  const assetUrl = new URL(url.toString());
  assetUrl.pathname = "/banned/index.html";
  return new Request(assetUrl.toString(), request);
}

async function loadPublicPlaceRows(env, serviceRole) {
  const cacheKey = "places:all";
  const cached = PUBLIC_PLACES_CACHE_TTL_MS > 0
    ? readCache(publicPlacesCache, cacheKey)
    : null;
  if (cached) {
    return cached;
  }

  const response = await supabaseAdminRequest(env, serviceRole, {
    method: "GET",
    path: `/rest/v1/places?select=*&is_public=eq.true&order=created_at.desc&limit=${PUBLIC_PLACES_QUERY_LIMIT}`
  });
  const rows = (Array.isArray(response?.payload) ? response.payload : [])
    .filter((row) => isPublicPlacePublished(row));
  if (PUBLIC_PLACES_CACHE_TTL_MS > 0) {
    writeCache(publicPlacesCache, cacheKey, rows, PUBLIC_PLACES_CACHE_TTL_MS, 8);
  }
  return rows;
}

async function loadFallbackPlacesFromStatic(env) {
  if (!env.ASSETS || typeof env.ASSETS.fetch !== "function") {
    return [];
  }

  try {
    const request = new Request("https://assets.local/places.json");
    const response = await env.ASSETS.fetch(request);
    if (!response.ok) {
      return [];
    }
    const payload = await response.json();
    return Array.isArray(payload)
      ? payload.filter((entry) => entry && typeof entry === "object")
      : [];
  } catch {
    return [];
  }
}

function mapSupabasePlaceRowToApiPlace(row) {
  if (!row || typeof row !== "object") {
    return null;
  }

  const id = normalizeText(row.id, "");
  const name = normalizeText(row.title ?? row.name, "");
  const description = normalizeText(row.description, "Description unavailable.");
  const lat = Number(row.lat);
  const lon = Number(row.lng ?? row.lon);
  if (!id || !name || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }

  const tags = Array.isArray(row.tags)
    ? row.tags.map((entry) => normalizeText(entry, "")).filter(Boolean).slice(0, 12)
    : [];
  const image = normalizeHttpUrl(row.image_url ?? row.image) || "";
  const imagePath = normalizeStorageObjectPath(row.image_path ?? row.imagePath);
  const category = normalizeText(row.category ?? row.kind, "");
  const population = Number.isFinite(Number(row.population)) ? Number(row.population) : null;
  const areaKm2 = Number.isFinite(Number(row.area_km2 ?? row.areaKm2 ?? row.area))
    ? Number(row.area_km2 ?? row.areaKm2 ?? row.area)
    : null;
  const languages = Array.isArray(row.languages)
    ? row.languages.map((entry) => normalizeText(entry, "")).filter(Boolean).join(" / ")
    : normalizeText(row.languages, "");

  return {
    id,
    slug: normalizeText(row.slug, ""),
    name,
    title: name,
    country: normalizeText(row.country, ""),
    countryCode: normalizeText(row.country_code ?? row.countryCode, ""),
    region: normalizeText(row.region, "Region unspecified"),
    description,
    lat,
    lon,
    lng: lon,
    link: normalizeHttpUrl(row.link) || "",
    image,
    image_url: image,
    image_path: imagePath,
    category,
    kind: category,
    tags,
    highlights: tags.slice(0, 6),
    population,
    pop: population,
    areaKm2,
    area_km2: areaKm2,
    area: areaKm2,
    currency: normalizeText(row.currency, ""),
    languages,
    utcOffset: normalizeText(row.utc_offset ?? row.utcOffset, ""),
    utc_offset: normalizeText(row.utc_offset ?? row.utcOffset, ""),
    timezone: normalizeText(row.timezone ?? row.tz, ""),
    climate: normalizeText(row.climate, ""),
    founded: normalizeText(row.founded, ""),
    funFact: normalizeText(row.fun_fact ?? row.funFact, ""),
    isFree: resolveBooleanInput(row.is_free ?? row.free ?? row.only_free ?? row.onlyFree, false),
    familyFriendly: resolveBooleanInput(
      row.family_friendly ?? row.familyFriendly ?? row.family,
      false
    ),
    is_public: row.is_public !== false,
    place_scope: "public",
    visibility_status: "approved",
    publish_at: normalizeIsoTimestamp(row.publish_at ?? row.publishAt),
    publishAt: normalizeIsoTimestamp(row.publish_at ?? row.publishAt),
    seasonal_content:
      row.seasonal_content && typeof row.seasonal_content === "object"
        ? row.seasonal_content
        : {},
    seasonalContent:
      row.seasonal_content && typeof row.seasonal_content === "object"
        ? row.seasonal_content
        : {},
    created_by: normalizeUuid(row.created_by ?? row.createdBy),
    createdAt: normalizeIsoTimestamp(row.created_at ?? row.createdAt),
    updatedAt: normalizeIsoTimestamp(row.updated_at ?? row.updatedAt)
  };
}

function isPublicPlacePublished(row) {
  if (!row || row.is_public === false) {
    return false;
  }
  const publishAt = normalizeIsoTimestamp(row.publish_at ?? row.publishAt);
  if (!publishAt) {
    return true;
  }
  const timestamp = Date.parse(publishAt);
  return !Number.isFinite(timestamp) || timestamp <= Date.now();
}

async function loadSinglePublicPlaceRow(env, serviceRole, placeRef) {
  const rows = await loadPublicPlaceRows(env, serviceRole);
  const safeRef = normalizeText(placeRef, "");
  if (!safeRef) {
    return null;
  }
  const safeLoweredRef = safeRef.toLowerCase();
  return rows.find((entry) => {
    const entryId = normalizeText(entry?.id, "");
    const entrySlug = normalizeText(entry?.slug, "");
    return (
      entryId === safeRef ||
      entrySlug === safeRef ||
      entryId.toLowerCase() === safeLoweredRef ||
      entrySlug.toLowerCase() === safeLoweredRef
    );
  }) || null;
}

async function resolvePublicPlaceId(env, serviceRole, placeRef) {
  const safeRef = normalizeText(placeRef, "");
  if (!safeRef) {
    return "";
  }

  if (normalizeUuid(safeRef)) {
    return normalizeUuid(safeRef);
  }

  const row = await loadSinglePublicPlaceRow(env, serviceRole, safeRef);
  return normalizeUuid(row?.id);
}

async function loadPublicCommunityReviews(env, serviceRole, placeId) {
  const safePlaceId = normalizeUuid(placeId);
  if (!safePlaceId) {
    return [];
  }

  const cacheKey = `community:${safePlaceId}:reviews`;
  const cached = readCache(publicCommunityCache, cacheKey);
  if (cached) {
    return cached;
  }

  const response = await supabaseAdminRequest(env, serviceRole, {
    method: "GET",
    path: `/rest/v1/reviews?select=id,user_id,rating,comment,created_at,updated_at,is_deleted&place_id=eq.${encodeURIComponent(safePlaceId)}&is_deleted=eq.false&order=created_at.desc&limit=${PUBLIC_REVIEWS_LIMIT}`
  });
  const rows = Array.isArray(response?.payload) ? response.payload : [];
  const reviews = rows
    .map((entry) => {
      const rating = Math.max(0, Math.min(5, Math.round(Number(entry?.rating) || 0)));
      if (rating < 1) {
        return null;
      }
      const authorId = normalizeUuid(entry?.user_id);
      return {
        id: normalizeText(entry?.id, ""),
        authorId,
        authorName: authorId ? `User ${authorId.slice(0, 8)}` : "User",
        rating,
        comment: normalizeText(entry?.comment, ""),
        createdAt: normalizeIsoTimestamp(entry?.created_at ?? entry?.updated_at) || new Date().toISOString(),
        source: "supabase"
      };
    })
    .filter(Boolean);

  writeCache(publicCommunityCache, cacheKey, reviews, PUBLIC_COMMUNITY_CACHE_TTL_MS, 24);
  return reviews;
}

async function loadPublicCommunitySummary(env, serviceRole, placeId) {
  const safePlaceId = normalizeUuid(placeId);
  if (!safePlaceId) {
    return {
      average: 0,
      count: 0
    };
  }

  const cacheKey = `community:${safePlaceId}:summary`;
  const cached = readCache(publicCommunityCache, cacheKey);
  if (cached) {
    return cached;
  }

  const response = await supabaseAdminRequest(env, serviceRole, {
    method: "GET",
    path: `/rest/v1/place_reviews_summary?select=avg_rating,reviews_count&place_id=eq.${encodeURIComponent(safePlaceId)}&limit=1`
  });
  const entry = Array.isArray(response?.payload) ? response.payload[0] : null;
  const summary = {
    average: Number.isFinite(Number(entry?.avg_rating))
      ? Number(Number(entry.avg_rating).toFixed(1))
      : 0,
    count: Number.isFinite(Number(entry?.reviews_count))
      ? Math.max(0, Math.floor(Number(entry.reviews_count)))
      : 0
  };
  writeCache(publicCommunityCache, cacheKey, summary, PUBLIC_COMMUNITY_CACHE_TTL_MS, 24);
  return summary;
}

function normalizeBanRow(entry, source, identities = {}) {
  const safeEntry = entry && typeof entry === "object" ? entry : null;
  if (!safeEntry) {
    return createAccessSnapshot(identities);
  }

  const bannedFlag = safeEntry.banned !== false;
  const bannedUntil = normalizeIsoTimestamp(safeEntry.banned_until);
  const isActive = bannedFlag && (!bannedUntil || Date.parse(bannedUntil) > Date.now());
  return createAccessSnapshot({
    ...identities,
    isBanned: isActive,
    isUserBanned: isActive && source === "user",
    isVisitorBanned: isActive && source === "visitor",
    source: isActive ? source : "",
    reason: normalizeText(safeEntry.reason, ""),
    bannedAt: normalizeIsoTimestamp(
      safeEntry.banned_at ?? safeEntry.updated_at ?? safeEntry.created_at ?? safeEntry.banned_until
    ),
    bannedUntil
  });
}

function withAccessCookies(response, accessState) {
  return withCookieHeaders(response, accessState?.setCookieHeaders || []);
}

function withCookieHeaders(response, setCookieHeaders = []) {
  if (!(response instanceof Response) || !Array.isArray(setCookieHeaders) || setCookieHeaders.length === 0) {
    return response;
  }

  const headers = new Headers(response.headers);
  for (const value of setCookieHeaders) {
    if (typeof value === "string" && value.trim() !== "") {
      headers.append("Set-Cookie", value);
    }
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

async function buildUserCookieHeaders(userId, url, env) {
  const safeUserId = normalizeUuid(userId);
  if (!safeUserId) {
    return clearSignedCookieHeaders(USER_COOKIE_NAME, USER_COOKIE_SIG_NAME, url);
  }

  return buildSignedCookieHeaders(
    USER_COOKIE_NAME,
    USER_COOKIE_SIG_NAME,
    safeUserId,
    USER_COOKIE_MAX_AGE_SEC,
    url,
    env
  );
}

async function buildSignedCookieHeaders(name, sigName, value, maxAgeSeconds, url, env) {
  const safeValue = normalizeText(value, "");
  if (!safeValue) {
    return clearSignedCookieHeaders(name, sigName, url);
  }

  const signature = await signCookieValue(env, safeValue);
  if (!signature) {
    return [];
  }

  return [
    serializeCookie(name, safeValue, {
      maxAge: maxAgeSeconds,
      url,
      httpOnly: true
    }),
    serializeCookie(sigName, signature, {
      maxAge: maxAgeSeconds,
      url,
      httpOnly: true
    })
  ];
}

function clearSignedCookieHeaders(name, sigName, url) {
  return [
    serializeCookie(name, "", {
      maxAge: 0,
      url,
      httpOnly: true
    }),
    serializeCookie(sigName, "", {
      maxAge: 0,
      url,
      httpOnly: true
    })
  ];
}

async function readSignedCookieValue(request, name, sigName, env) {
  const cookieState = await readSignedCookieState(request, name, sigName, env);
  return cookieState.value;
}

async function readSignedCookieState(request, name, sigName, env) {
  const cookies = parseCookies(request);
  const rawValue = normalizeText(cookies.get(name), "");
  const rawSignature = normalizeText(cookies.get(sigName), "");
  if (!rawValue) {
    return {
      value: "",
      invalid: false
    };
  }
  if (!rawSignature) {
    return {
      value: "",
      invalid: true
    };
  }

  const expectedSignature = await signCookieValue(env, rawValue);
  if (!expectedSignature || !constantTimeEqual(rawSignature, expectedSignature)) {
    return {
      value: "",
      invalid: true
    };
  }

  return {
    value: rawValue,
    invalid: false
  };
}

function parseCookies(request) {
  const headerValue = normalizeText(request.headers.get("cookie"), "");
  const cookies = new Map();
  if (!headerValue) {
    return cookies;
  }

  const parts = headerValue.split(";");
  for (const part of parts) {
    const separatorIndex = part.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }
    const key = part.slice(0, separatorIndex).trim();
    const value = part.slice(separatorIndex + 1).trim();
    if (!key) {
      continue;
    }
    try {
      cookies.set(key, decodeURIComponent(value));
    } catch {
      cookies.set(key, value);
    }
  }

  return cookies;
}

async function signCookieValue(env, value) {
  const secret = getAccessCookieSecret(env);
  const safeValue = normalizeText(value, "");
  if (!secret || !safeValue) {
    return "";
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    {
      name: "HMAC",
      hash: "SHA-256"
    },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(safeValue));
  return base64UrlEncode(signature);
}

function getAccessCookieSecret(env) {
  const explicitSecret = normalizeText(
    env && typeof env === "object" ? env[ACCESS_COOKIE_SECRET_ENV_KEY] : "",
    ""
  );
  if (explicitSecret) {
    return explicitSecret;
  }
  return normalizeSupabaseServiceRole(env);
}

function constantTimeEqual(left, right) {
  const safeLeft = normalizeText(left, "");
  const safeRight = normalizeText(right, "");
  if (safeLeft.length !== safeRight.length) {
    return false;
  }

  let diff = 0;
  for (let index = 0; index < safeLeft.length; index += 1) {
    diff |= safeLeft.charCodeAt(index) ^ safeRight.charCodeAt(index);
  }
  return diff === 0;
}

function base64UrlEncode(value) {
  const bytes = value instanceof ArrayBuffer ? new Uint8Array(value) : new Uint8Array(value || []);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function serializeCookie(name, value, options = {}) {
  const parts = [
    `${name}=${encodeURIComponent(String(value || ""))}`
  ];
  const safeMaxAge = Number(options.maxAge);
  if (Number.isFinite(safeMaxAge)) {
    parts.push(`Max-Age=${Math.max(0, Math.floor(safeMaxAge))}`);
  }
  parts.push(`Path=${normalizeText(options.path, "/") || "/"}`);
  if (options.httpOnly !== false) {
    parts.push("HttpOnly");
  }
  parts.push("SameSite=Lax");
  const protocol = normalizeText(options.url?.protocol, "");
  if (protocol === "https:") {
    parts.push("Secure");
  }
  return parts.join("; ");
}

function normalizeWeatherQuery(searchParams) {
  const errors = [];
  const lat = parseBoundedFloat(searchParams.get("lat"), -90, 90);
  const lon = parseBoundedFloat(searchParams.get("lon"), -180, 180);
  const name = String(searchParams.get("name") || "").trim().slice(0, 140);
  const placeId = String(searchParams.get("placeId") || "").trim().slice(0, 120);

  if (lat === null) {
    errors.push("Query parameter 'lat' must be a number between -90 and 90.");
  }
  if (lon === null) {
    errors.push("Query parameter 'lon' must be a number between -180 and 180.");
  }

  return {
    query: { lat, lon, name, placeId },
    errors
  };
}

function mapWeatherPayload(payload, query) {
  const current = payload && typeof payload === "object" ? payload.current : null;
  const location = payload && typeof payload === "object" ? payload.location : null;
  const forecastDay = Array.isArray(payload?.forecast?.forecastday)
    ? payload.forecast.forecastday[0] || null
    : null;
  const astro = forecastDay && typeof forecastDay.astro === "object" ? forecastDay.astro : null;
  const condition = (
    current && current.condition && typeof current.condition === "object"
      ? String(current.condition.text || "").trim()
      : ""
  );
  const tempC = Number(current?.temp_c);
  const feelsLikeC = Number(current?.feelslike_c);
  const humidity = Number(current?.humidity);
  const windKph = Number(current?.wind_kph);
  const uvIndex = Number(current?.uv);
  const updatedAt = typeof current?.last_updated_epoch === "number"
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
    uvIndex: Number.isFinite(uvIndex) ? Number(uvIndex.toFixed(1)) : null,
    condition,
    isDay: Number(current?.is_day) === 1 ? 1 : 0,
    localTime: normalizeText(location?.localtime, ""),
    tzId: normalizeText(location?.tz_id, ""),
    sunrise: normalizeText(astro?.sunrise, ""),
    sunset: normalizeText(astro?.sunset, ""),
    updatedAt,
    provider: "WeatherAPI"
  };
}

function normalizeRouteQuery(searchParams) {
  const errors = [];
  const rawMode = String(searchParams.get("mode") || "").trim().toLowerCase();
  const mode = rawMode && ROUTE_MODES[rawMode] ? rawMode : "car";
  const points = [];

  const rawPoints = String(searchParams.get("points") || "").trim();
  if (rawPoints) {
    const pairs = rawPoints.split(";").map((entry) => entry.trim()).filter(Boolean);
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
    const fromLat = parseBoundedFloat(searchParams.get("fromLat"), -90, 90);
    const fromLon = parseBoundedFloat(searchParams.get("fromLon"), -180, 180);
    const toLat = parseBoundedFloat(searchParams.get("toLat"), -90, 90);
    const toLon = parseBoundedFloat(searchParams.get("toLon"), -180, 180);

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
      const distance = haversineDistanceMeters(
        points[index].lat,
        points[index].lon,
        points[index + 1].lat,
        points[index + 1].lon
      );
      if (!Number.isFinite(distance) || distance < 5) {
        errors.push(`Points ${index + 1} and ${index + 2} are too close to each other.`);
      }
    }
  }

  return {
    query: { mode, points },
    errors
  };
}

async function fetchRouteWithProviderFallback(query) {
  const modeConfig = ROUTE_MODES[query.mode] || ROUTE_MODES.car;
  if (query.mode === "flight") {
    return createFlightRoute(query.points, modeConfig);
  }

  const providerErrors = [];
  const segments = [];

  for (let index = 0; index < query.points.length - 1; index += 1) {
    const segment = await fetchSegmentWithProviderFallback({
      mode: query.mode,
      fromPoint: query.points[index],
      toPoint: query.points[index + 1],
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
  const cacheKey = `${mode}:${fromPoint.lat.toFixed(4)},${fromPoint.lon.toFixed(4)}:${toPoint.lat.toFixed(4)},${toPoint.lon.toFixed(4)}`;
  const cached = readCache(routeCache, cacheKey);
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
      writeCache(routeCache, cacheKey, segment, 3 * 60 * 1000, 200);
      return segment;
    } catch (error) {
      providerErrors.push(`${provider.name}: ${normalizeErrorMessage(error, "Request failed.")}`);
    }
  }

  const fallback = createFallbackSegment(fromPoint, toPoint, mode);
  writeCache(routeCache, cacheKey, fallback, 3 * 60 * 1000, 200);
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
  const payload = await fetchJson(providerUrl, {
    timeoutMs: ROUTE_TIMEOUT_MS
  });

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

function createFallbackSegment(fromPoint, toPoint, mode) {
  const distanceMeters = haversineDistanceMeters(
    fromPoint.lat,
    fromPoint.lon,
    toPoint.lat,
    toPoint.lon
  );
  return {
    coordinates: buildInterpolatedLineCoordinates(
      fromPoint.lat,
      fromPoint.lon,
      toPoint.lat,
      toPoint.lon
    ),
    distanceMeters,
    durationSeconds: estimateDurationByMode(distanceMeters, mode),
    provider: "Local fallback",
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
        if (Array.isArray(previous) && Array.isArray(current) && previous[0] === current[0] && previous[1] === current[1]) {
          continue;
        }
      }
      merged.push(coordinates[index]);
    }
  }
  return merged;
}

function resolveProviderLabel(segments) {
  const unique = [];
  for (const segment of segments) {
    const label = String(segment?.provider || "").trim();
    if (label && !unique.includes(label)) {
      unique.push(label);
    }
  }
  return unique.join(" + ") || "Local fallback";
}

function buildInterpolatedLineCoordinates(latA, lonA, latB, lonB) {
  const steps = 18;
  const coordinates = [];
  for (let index = 0; index <= steps; index += 1) {
    const ratio = index / steps;
    coordinates.push([
      roundCoordinate(lonA + ((lonB - lonA) * ratio)),
      roundCoordinate(latA + ((latB - latA) * ratio))
    ]);
  }
  return coordinates;
}

function estimateDurationByMode(distanceMeters, mode) {
  const distanceKm = Math.max(0, Number(distanceMeters) || 0) / 1000;
  if (mode === "walk") {
    return (distanceKm / ROUTE_MODES.walk.speedKmph) * 3600;
  }
  if (mode === "flight") {
    const flightSeconds = (distanceKm / ROUTE_MODES.flight.speedKmph) * 3600;
    return flightSeconds + (ROUTE_MODES.flight.flightOverheadMinutes * 60);
  }
  return (distanceKm / ROUTE_MODES.car.speedKmph) * 3600;
}

async function upsertVisitorStatus(env, serviceRole, payload) {
  const baseBody = {
    visitor_id: payload.visitorId,
    display_name: payload.displayName,
    user_id: payload.userId || null,
    email: payload.email || null,
    role: payload.role,
    last_seen: payload.lastSeen,
    last_path: payload.pathName,
    user_agent: payload.userAgent,
    last_ip: payload.lastIp || null,
    last_country: payload.country || null,
    last_region: payload.region || null,
    last_city: payload.city || null,
    last_lat: Number.isFinite(Number(payload.lat)) ? Number(payload.lat) : null,
    last_lng: Number.isFinite(Number(payload.lng)) ? Number(payload.lng) : null,
    geo_source: payload.geoSource || null
  };
  await upsertStatusWithSchemaFallback(env, serviceRole, `/rest/v1/visitor_status?on_conflict=visitor_id`, baseBody, [
    ["geo_source"],
    ["last_lat", "last_lng", "geo_source"],
    ["last_country", "last_region", "last_city", "last_lat", "last_lng", "geo_source"],
    ["last_ip"],
    ["user_agent", "last_ip"],
    ["last_path", "user_agent", "last_ip"],
    ["last_country", "last_region", "last_city", "last_lat", "last_lng", "geo_source", "last_path", "user_agent", "last_ip"]
  ]);
}

async function upsertUserStatus(env, serviceRole, payload) {
  const baseBody = {
    user_id: payload.userId,
    email: payload.email || null,
    role: payload.role || "user",
    last_seen: payload.lastSeen,
    last_path: payload.pathName || "/",
    user_agent: payload.userAgent || null,
    last_ip: payload.lastIp || null,
    last_country: payload.country || null,
    last_region: payload.region || null,
    last_city: payload.city || null,
    last_lat: Number.isFinite(Number(payload.lat)) ? Number(payload.lat) : null,
    last_lng: Number.isFinite(Number(payload.lng)) ? Number(payload.lng) : null,
    geo_source: payload.geoSource || null
  };
  await upsertStatusWithSchemaFallback(env, serviceRole, `/rest/v1/user_status?on_conflict=user_id`, baseBody, [
    ["geo_source"],
    ["last_lat", "last_lng", "geo_source"],
    ["last_country", "last_region", "last_city", "last_lat", "last_lng", "geo_source"],
    ["last_ip"],
    ["user_agent", "last_ip"],
    ["last_path", "user_agent", "last_ip"],
    ["last_country", "last_region", "last_city", "last_lat", "last_lng", "geo_source", "last_path", "user_agent", "last_ip"]
  ]);
}

async function upsertStatusWithSchemaFallback(env, serviceRole, path, baseBody, fallbackOmittedKeySets = []) {
  const attempts = [baseBody];
  (Array.isArray(fallbackOmittedKeySets) ? fallbackOmittedKeySets : []).forEach((keys) => {
    attempts.push(omitObjectKeys(baseBody, Array.isArray(keys) ? keys : []));
  });

  let lastError = null;
  for (const body of attempts) {
    try {
      await supabaseAdminRequest(env, serviceRole, {
        method: "POST",
        path,
        headers: {
          Prefer: "resolution=merge-duplicates,return=minimal"
        },
        body
      });
      return;
    } catch (error) {
      const details = normalizeSupabaseErrorPayload(error);
      lastError = error;
      if (!isSupabaseMissingColumnError(details)) {
        throw error;
      }
    }
  }

  throw lastError || new Error("Status upsert failed.");
}

function omitObjectKeys(source, keys = []) {
  const omitted = new Set(
    (Array.isArray(keys) ? keys : [])
      .map((value) => normalizeText(value, ""))
      .filter(Boolean)
  );
  const next = {};
  for (const [key, value] of Object.entries(source || {})) {
    if (!omitted.has(key)) {
      next[key] = value;
    }
  }
  return next;
}

async function readVisitorBanState(env, serviceRole, visitorId) {
  const safeVisitorId = normalizeVisitorId(visitorId);
  if (!safeVisitorId) {
    return createAccessSnapshot({});
  }

  try {
    const response = await supabaseAdminRequest(env, serviceRole, {
      method: "GET",
      path: `/rest/v1/visitor_bans?select=visitor_id,banned,reason,banned_at,banned_until,updated_at&visitor_id=eq.${encodeURIComponent(safeVisitorId)}&limit=1`
    });
    const entry = Array.isArray(response?.payload) ? response.payload[0] : null;
    return normalizeBanRow(entry, "visitor", {
      visitorId: safeVisitorId
    });
  } catch (error) {
    const details = normalizeSupabaseErrorPayload(error);
    if (isSupabaseMissingColumnError(details)) {
      const response = await supabaseAdminRequest(env, serviceRole, {
        method: "GET",
        path: `/rest/v1/visitor_bans?select=visitor_id,banned,reason,banned_at,updated_at&visitor_id=eq.${encodeURIComponent(safeVisitorId)}&limit=1`
      });
      const entry = Array.isArray(response?.payload) ? response.payload[0] : null;
      return normalizeBanRow(entry, "visitor", {
        visitorId: safeVisitorId
      });
    }
    throw error;
  }
}

async function fetchJson(rawUrl, options = {}) {
  const controller = new AbortController();
  const timeoutMs = Number.isFinite(Number(options.timeoutMs)) ? Number(options.timeoutMs) : 8000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(rawUrl, {
      method: "GET",
      headers: {
        Accept: "application/json"
      },
      signal: controller.signal
    });
    const text = await response.text();
    let payload = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        throw new Error("Provider returned invalid JSON.");
      }
    }
    if (!response.ok) {
      throw new Error(extractProviderErrorMessage(payload) || `Provider request failed with status ${response.status}.`);
    }
    return payload;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function readJsonBody(request) {
  try {
    const rawBody = await request.text();
    if (!rawBody) {
      return {
        body: {},
        error: ""
      };
    }

    return {
      body: JSON.parse(rawBody),
      error: ""
    };
  } catch {
    return {
      body: null,
      error: "Request body must be valid JSON."
    };
  }
}

function normalizeRegistrationPayload(body) {
  const source = body && typeof body === "object" ? body : {};
  const email = String(source.email || "").trim().toLowerCase();
  const password = String(source.password || "");
  const displayName = String(source.displayName || source.display_name || "").trim().slice(0, 80);
  const errors = [];

  if (!isLikelyEmail(email)) {
    errors.push("Email is invalid.");
  }
  if (password.length < REGISTRATION_PASSWORD_MIN_LENGTH) {
    errors.push(`Password must be at least ${REGISTRATION_PASSWORD_MIN_LENGTH} characters.`);
  }

  return {
    email,
    password,
    displayName,
    errors
  };
}

function normalizeVisitorPingPayload(body, request) {
  const source = body && typeof body === "object" ? body : {};
  const visitorId = String(source.visitorId || source.visitor_id || "").trim();
  const displayName = normalizeVisitorDisplayName(
    String(source.displayName || source.display_name || "").trim(),
    visitorId
  );
  const roleHint = String(source.roleHint || source.role_hint || source.role || "").trim().toLowerCase();
  const userId = normalizeUuid(source.userId || source.user_id || "");
  const email = String(source.email || "").trim().toLowerCase();
  const pathName = normalizeRequestPathName(source.pathName || source.pathname || source.path);
  const userAgent = String(request.headers.get("user-agent") || "").trim().slice(0, 260);
  const lastIp = normalizeClientIp(request);
  const errors = [];

  if (!VISITOR_ID_PATTERN.test(visitorId)) {
    errors.push("visitorId is invalid.");
  }
  if (email && !isLikelyEmail(email)) {
    errors.push("email is invalid.");
  }

  const role = roleHint === "admin"
    ? "admin"
    : (userId ? "user" : "guest");

  return {
    visitorId,
    displayName,
    role,
    userId,
    email,
    pathName,
    userAgent,
    lastIp,
    lastSeen: new Date().toISOString(),
    errors
  };
}

function extractRequestGeo(request) {
  const cf = request && typeof request === "object" ? request.cf : null;
  const lat = Number(cf?.latitude);
  const lng = Number(cf?.longitude);
  return {
    country: normalizeText(cf?.country, ""),
    region: normalizeText(cf?.region, ""),
    city: normalizeText(cf?.city, ""),
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    geoSource: "cloudflare-cf"
  };
}

function normalizeRequestPathName(value) {
  const safeValue = String(value || "/").trim().slice(0, 260) || "/";
  return safeValue.startsWith("/") ? safeValue : `/${safeValue}`;
}

function normalizeVisitorDisplayName(rawValue, visitorId) {
  const safeValue = String(rawValue || "").trim().replace(/\s+/g, " ").slice(0, 80);
  if (safeValue) {
    return safeValue;
  }

  const suffix = String(visitorId || "").trim().slice(-6).toUpperCase();
  return suffix ? `Guest ${suffix}` : "Guest";
}

async function supabaseAdminRequest(env, serviceRole, options = {}) {
  const method = String(options.method || "GET").trim().toUpperCase() || "GET";
  const headers = {
    Accept: "application/json",
    apikey: serviceRole,
    Authorization: `Bearer ${serviceRole}`,
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.headers && typeof options.headers === "object" ? options.headers : {})
  };
  const path = String(options.path || "").trim();
  const supabaseUrl = String(env.SUPABASE_URL || SUPABASE_URL_FALLBACK || "").trim().replace(/\/+$/, "");
  const response = await fetch(`${supabaseUrl}${path}`, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = {
        error: text
      };
    }
  }

  if (!response.ok) {
    const error = new Error(
      extractProviderErrorMessage(payload) || `Supabase request failed with status ${response.status}.`
    );
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return {
    status: response.status,
    payload
  };
}

function normalizeSupabaseErrorPayload(error) {
  const payload = error && typeof error === "object" ? error.payload : null;
  const message = extractProviderErrorMessage(payload) || normalizeErrorMessage(error, "");
  const details = payload && typeof payload === "object"
    ? String(payload.error_description || payload.msg || payload.details || "").trim()
    : "";
  return {
    status: Number(error?.status) || 0,
    message: message || "Supabase request failed.",
    details
  };
}

function isSupabaseMissingRelationError(details) {
  const message = String(details?.message || "").toLowerCase();
  const extra = String(details?.details || "").toLowerCase();
  return (
    message.includes("relation") && message.includes("does not exist") ||
    message.includes("could not find the table") ||
    extra.includes("relation") && extra.includes("does not exist")
  );
}

function isSupabaseMissingColumnError(details) {
  const message = String(details?.message || "").toLowerCase();
  const extra = String(details?.details || "").toLowerCase();
  return (
    message.includes("column") && message.includes("does not exist") ||
    message.includes("schema cache") ||
    extra.includes("column") && extra.includes("does not exist")
  );
}

function normalizeSupabaseServiceRole(env) {
  const rawValue = env && typeof env === "object"
    ? env[SUPABASE_SERVICE_ROLE_ENV_KEY]
    : "";
  return String(rawValue || "").trim();
}

function isTrustedBrowserOrigin(request, url) {
  const allowedHosts = new Set([
    url.host,
    "misterfreemanscoin.com",
    "www.misterfreemanscoin.com",
    "localhost:3000",
    "127.0.0.1:3000"
  ]);
  const candidateHeaders = [
    request.headers.get("origin"),
    request.headers.get("referer")
  ];

  for (const candidate of candidateHeaders) {
    const parsedHost = parseHeaderHost(candidate);
    if (parsedHost && allowedHosts.has(parsedHost)) {
      return true;
    }
  }

  return false;
}

function parseHeaderHost(rawValue) {
  const value = String(rawValue || "").trim();
  if (!value) {
    return "";
  }

  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return "";
  }
}

function consumeRateLimit(cache, key, maxRequests, windowMs) {
  const safeKey = String(key || "unknown").trim().slice(0, 160) || "unknown";
  const now = Date.now();
  const cached = cache.get(safeKey);
  const freshEntries = Array.isArray(cached)
    ? cached.filter((entry) => Number.isFinite(entry) && (now - entry) < windowMs)
    : [];
  if (freshEntries.length >= maxRequests) {
    cache.set(safeKey, freshEntries);
    return false;
  }
  freshEntries.push(now);
  cache.set(safeKey, freshEntries);
  return true;
}

function normalizeClientIp(request) {
  const candidates = [
    request.headers.get("cf-connecting-ip"),
    request.headers.get("x-forwarded-for")
  ];
  for (const candidate of candidates) {
    const value = String(candidate || "").split(",")[0].trim();
    if (value) {
      return value;
    }
  }
  return "unknown";
}

function normalizeUuid(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)
    ? normalized
    : "";
}

function isLikelyEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function extractProviderErrorMessage(payload) {
  if (!payload || typeof payload !== "object") {
    return "";
  }
  const candidates = [payload.message, payload.error, payload.code];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim() !== "") {
      return candidate.trim();
    }
  }
  return "";
}

function readCache(cache, key) {
  const cached = cache.get(key);
  if (!cached) {
    return null;
  }
  if (cached.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return cached.payload;
}

function writeCache(cache, key, payload, ttlMs, maxEntries) {
  cache.set(key, {
    expiresAt: Date.now() + ttlMs,
    payload
  });
  if (cache.size > maxEntries) {
    const firstKey = cache.keys().next().value;
    if (typeof firstKey === "string") {
      cache.delete(firstKey);
    }
  }
}

function parseBoundedFloat(rawValue, min, max) {
  const numeric = Number(String(rawValue ?? "").trim().replace(",", "."));
  if (!Number.isFinite(numeric) || numeric < min || numeric > max) {
    return null;
  }
  return numeric;
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

function normalizeErrorMessage(error, fallback) {
  return error instanceof Error && error.message ? error.message : fallback;
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

function normalizeIsoTimestamp(value) {
  const normalized = normalizeText(value, "");
  if (!normalized) {
    return "";
  }
  const timestamp = Date.parse(normalized);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : "";
}

function normalizePathname(pathname) {
  const normalized = normalizeText(pathname, "/");
  if (!normalized) {
    return "/";
  }
  const safePath = normalized.startsWith("/") ? normalized : `/${normalized}`;
  if (safePath.length > 1 && safePath.endsWith("/")) {
    return safePath.slice(0, -1);
  }
  return safePath;
}

function normalizeHttpUrl(value) {
  const normalized = normalizeText(value, "");
  if (!normalized) {
    return "";
  }

  try {
    const parsed = new URL(normalized);
    return /^https?:$/i.test(parsed.protocol)
      ? sanitizeKnownImageUrl(parsed.toString())
      : "";
  } catch {
    return "";
  }
}

function sanitizeKnownImageUrl(url) {
  const safeUrl = normalizeText(url, "");
  if (safeUrl.includes("Puerto_Madero_-_Puente_de_la_mujer")) {
    return "https://images.unsplash.com/photo-1589909202802-8f4aadce1849?w=800&h=500&fit=crop&q=80";
  }
  return safeUrl;
}

function normalizeStorageObjectPath(value) {
  return normalizeText(value, "")
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .replace(/\/{2,}/g, "/");
}

function resolveBooleanInput(value, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value !== 0 : fallback;
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
  return fallback;
}

function jsonResponse(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...headers
    }
  });
}
