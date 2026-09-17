(() => {
  "use strict";

  const FAVORITES_STORAGE_KEY = "worldAtlasPro.favorites.v1";
  const SUPABASE_READY_TIMEOUT_MS = 12000;
  const SUPABASE_QUERY_TIMEOUT_MS = 12000;
  const FAVORITES_PUSH_DEBOUNCE_MS = 260;
  const APP_API_PREFIX = "/api";
  const ROUTE_API_PREFIX = "/api/route";
  const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const PLACE_SELECT_COLUMNS =
    "id,title,country,region,description,lat,lng,category,tags,image_url,is_public,is_free,family_friendly,created_by,created_at,updated_at";

  const nativeFetch = window.fetch.bind(window);

  const runtime = {
    client: null,
    user: null,
    pushTimerId: null,
    isApplyingRemoteFavorites: false,
    isSyncRunning: false,
    storagePatched: false,
    authSubscriptionAttached: false
  };

  installFetchProxy();
  window.WorldAtlasSupabaseRuntimeReady = initializeRuntime();

  async function initializeRuntime() {
    try {
      const client = await waitForSupabaseClient(SUPABASE_READY_TIMEOUT_MS);
      runtime.client = client;
      patchStorageForFavoritesSync();
      attachAuthSubscription(client);
      await hydrateFavoritesFromSupabase({ mergeLocal: false });
      exposeDebugApi();
    } catch (error) {
      console.warn("[supabase-data-sync] Runtime init skipped:", error);
    }
  }

  function exposeDebugApi() {
    window.WorldAtlasSupabaseSync = Object.freeze({
      async syncFavoritesNow() {
        await pushLocalFavoritesToSupabase();
      },
      async refreshFavoritesNow() {
        await hydrateFavoritesFromSupabase({ mergeLocal: false });
      },
      async isAuthenticated() {
        if (!runtime.client) {
          return false;
        }
        const user = await getCurrentUser(runtime.client);
        runtime.user = user;
        return Boolean(user);
      },
      async getFavoriteIds() {
        if (!runtime.client) {
          return [];
        }
        const authUserId = await resolveCurrentAuthUserId(runtime.client);
        if (!authUserId) {
          return [];
        }

        const remoteSet = await fetchRemoteFavorites(runtime.client, authUserId);
        writeLocalFavorites(remoteSet, { silent: true });
        notifyFavoritesSynced(remoteSet);
        return Array.from(remoteSet);
      },
      async setFavorite(placeId, shouldFavorite) {
        const normalizedPlaceId = normalizeUuid(placeId);
        if (!normalizedPlaceId) {
          throw new Error("placeId must be UUID.");
        }
        if (!runtime.client) {
          throw new Error("Supabase client is unavailable.");
        }

        const authUserId = await resolveCurrentAuthUserId(runtime.client);
        if (!authUserId) {
          throw new Error("Not authenticated.");
        }

        if (shouldFavorite) {
          const { error } = await withTimeout(
            runtime.client
              .from("favorites")
              .upsert(
                {
                  user_id: authUserId,
                  place_id: normalizedPlaceId
                },
                {
                  onConflict: "user_id,place_id"
                }
              ),
            SUPABASE_QUERY_TIMEOUT_MS
          );
          if (error) {
            throw createErrorFromSupabase(error, 403, "Failed to add favorite.");
          }
        } else {
          const { error } = await withTimeout(
            runtime.client
              .from("favorites")
              .delete()
              .eq("user_id", authUserId)
              .eq("place_id", normalizedPlaceId),
            SUPABASE_QUERY_TIMEOUT_MS
          );
          if (error) {
            throw createErrorFromSupabase(error, 403, "Failed to remove favorite.");
          }
        }

        const remoteSet = await fetchRemoteFavorites(runtime.client, authUserId);
        writeLocalFavorites(remoteSet, { silent: true });
        notifyFavoritesSynced(remoteSet);
        return Array.from(remoteSet);
      },
      getCurrentUserId() {
        return normalizeUuid(runtime.user?.id);
      }
    });
  }

  function installFetchProxy() {
    if (window.__WORLD_ATLAS_FETCH_PROXY_INSTALLED__) {
      return;
    }
    window.__WORLD_ATLAS_FETCH_PROXY_INSTALLED__ = true;

    window.fetch = async (input, init) => {
      const request = new Request(input, init);
      const requestUrl = new URL(request.url, window.location.origin);

      if (!shouldProxyRequest(requestUrl)) {
        return nativeFetch(input, init);
      }

      if (requestUrl.pathname.startsWith(ROUTE_API_PREFIX)) {
        return nativeFetch(input, init);
      }

      let client;
      try {
        client = await waitForSupabaseClient(SUPABASE_READY_TIMEOUT_MS);
      } catch (error) {
        console.warn("[supabase-data-sync] Supabase unavailable for API proxy:", error);
        return nativeFetch(input, init);
      }

      try {
        return await handleSupabaseApiRequest(client, request, requestUrl);
      } catch (error) {
        const normalizedError = normalizeProxyError(error);
        return jsonResponse(
          {
            error: normalizedError.message,
            ...(normalizedError.details.length > 0
              ? { details: normalizedError.details }
              : {})
          },
          normalizedError.status
        );
      }
    };
  }

  function shouldProxyRequest(url) {
    void url;
    // Public and protected place routes are now served by the Cloudflare worker.
    // Keeping the old client-side Supabase proxy enabled causes anonymous 401 noise
    // and bypasses the newer worker-side access controls.
    return false;
  }

  async function handleSupabaseApiRequest(client, request, requestUrl) {
    const pathname = requestUrl.pathname;
    const method = (request.method || "GET").toUpperCase();

    if (pathname === "/api/places") {
      if (method === "GET") {
        return handleGetPlaces(client, requestUrl.searchParams);
      }
      if (method === "POST") {
        return handleCreatePlace(client, request);
      }
      return jsonResponse({ error: "Method not allowed." }, 405);
    }

    if (pathname.startsWith("/api/places/")) {
      const placeId = decodeURIComponent(pathname.slice("/api/places/".length));
      if (!placeId) {
        return jsonResponse({ error: "Place id is required." }, 400);
      }

      if (method === "GET") {
        return handleGetPlace(client, placeId);
      }

      if (method === "PUT" || method === "PATCH") {
        return handleUpdatePlace(client, placeId, request);
      }

      if (method === "DELETE") {
        return handleDeletePlace(client, placeId);
      }

      return jsonResponse({ error: "Method not allowed." }, 405);
    }

    if (pathname === "/api/meta/regions") {
      if (method !== "GET") {
        return jsonResponse({ error: "Method not allowed." }, 405);
      }
      return handleGetRegionsMeta(client);
    }

    return jsonResponse({ error: "Not found." }, 404);
  }

  async function handleGetPlaces(client, searchParams) {
    const query = parsePlacesQuery(searchParams);
    const user = await getCurrentUser(client);
    const currentUserId = normalizeSupabaseUserIdForFilter(user?.id);
    let builder = client.from("places").select(PLACE_SELECT_COLUMNS, { count: "exact" });
    if (!currentUserId) {
      builder = builder.eq("is_public", true);
    }

    if (query.region !== "all") {
      builder = builder.eq("region", query.region);
    }

    if (query.categoryFilter !== "all") {
      builder = builder.eq("category", query.categoryFilter);
    }

    if (query.tagsFilter.length > 0) {
      builder = builder.contains("tags", query.tagsFilter);
    }

    if (query.onlyFree) {
      builder = builder.eq("is_free", true);
    }

    if (query.familyFriendly) {
      builder = builder.eq("family_friendly", true);
    }

    if (query.q) {
      const pattern = `%${escapeLikePattern(query.q)}%`;
      builder = builder.or(
        `title.ilike.${pattern},country.ilike.${pattern},region.ilike.${pattern},description.ilike.${pattern}`
      );
    }

    builder = builder.order(resolvePlacesSortColumn(query.sortBy), {
      ascending: query.order !== "desc",
      nullsFirst: false
    });
    builder = builder.range(query.offset, query.offset + query.limit - 1);

    const { data, error, count } = await withTimeout(builder, SUPABASE_QUERY_TIMEOUT_MS);
    if (error) {
      throw createErrorFromSupabase(error, 400, "Failed to fetch places.");
    }

    const items = Array.isArray(data)
      ? data
          .map(mapSupabasePlaceToAppPlace)
          .filter((place) => canReadPlaceByVisibility(place, currentUserId))
      : [];

    return jsonResponse({
      items,
      total: Number.isFinite(Number(count)) ? Number(count) : items.length,
      limit: query.limit,
      offset: query.offset
    });
  }

  async function handleGetPlace(client, placeId) {
    const user = await getCurrentUser(client);
    const currentUserId = normalizeSupabaseUserIdForFilter(user?.id);

    const { data, error } = await withTimeout(
      client
        .from("places")
        .select(PLACE_SELECT_COLUMNS)
        .eq("id", placeId)
        .maybeSingle(),
      SUPABASE_QUERY_TIMEOUT_MS
    );

    if (error) {
      throw createErrorFromSupabase(error, 400, "Failed to fetch place.");
    }

    if (!data) {
      return jsonResponse({ error: "Place not found." }, 404);
    }

    const mapped = mapSupabasePlaceToAppPlace(data);
    if (!mapped) {
      return jsonResponse({ error: "Place data is invalid." }, 422);
    }
    if (!canReadPlaceByVisibility(mapped, currentUserId)) {
      return jsonResponse({ error: "Place not found." }, 404);
    }

    return jsonResponse(mapped);
  }

  async function handleCreatePlace(client, request) {
    const authState = await requireAuthenticatedUser(client, "Authentication is required.");
    if (authState.errorResponse) {
      return authState.errorResponse;
    }

    const payload = await parseRequestJson(request);
    const rowPayload = buildSupabasePlacePayload(payload, { partial: false });
    const validationErrors = validatePlacePayload(rowPayload, { partial: false });
    if (validationErrors.length > 0) {
      return jsonResponse(
        { error: "Invalid place payload.", details: validationErrors },
        400
      );
    }

    const { data, error } = await withTimeout(
      client
        .from("places")
        .insert(rowPayload)
        .select(PLACE_SELECT_COLUMNS)
        .single(),
      SUPABASE_QUERY_TIMEOUT_MS
    );

    if (error) {
      throw createErrorFromSupabase(error, 403, "Failed to create place.");
    }

    const mapped = mapSupabasePlaceToAppPlace(data);
    if (!mapped) {
      return jsonResponse({ error: "Created place is invalid." }, 422);
    }

    return jsonResponse(mapped, 201);
  }

  async function handleUpdatePlace(client, placeId, request) {
    const authState = await requireAuthenticatedUser(client, "Authentication is required.");
    if (authState.errorResponse) {
      return authState.errorResponse;
    }

    const payload = await parseRequestJson(request);
    const rowPayload = buildSupabasePlacePayload(payload, { partial: true });
    const validationErrors = validatePlacePayload(rowPayload, { partial: true });
    if (validationErrors.length > 0) {
      return jsonResponse(
        { error: "Invalid place payload.", details: validationErrors },
        400
      );
    }

    if (Object.keys(rowPayload).length === 0) {
      return jsonResponse({ error: "No fields provided for update." }, 400);
    }

    const { data, error } = await withTimeout(
      client
        .from("places")
        .update(rowPayload)
        .eq("id", placeId)
        .select(PLACE_SELECT_COLUMNS)
        .maybeSingle(),
      SUPABASE_QUERY_TIMEOUT_MS
    );

    if (error) {
      throw createErrorFromSupabase(error, 403, "Failed to update place.");
    }

    if (!data) {
      return jsonResponse({ error: "Place not found or access denied." }, 404);
    }

    const mapped = mapSupabasePlaceToAppPlace(data);
    if (!mapped) {
      return jsonResponse({ error: "Updated place is invalid." }, 422);
    }

    return jsonResponse(mapped);
  }

  async function handleDeletePlace(client, placeId) {
    const authState = await requireAuthenticatedUser(client, "Authentication is required.");
    if (authState.errorResponse) {
      return authState.errorResponse;
    }

    const { data, error } = await withTimeout(
      client
        .from("places")
        .delete()
        .eq("id", placeId)
        .select("id")
        .maybeSingle(),
      SUPABASE_QUERY_TIMEOUT_MS
    );

    if (error) {
      throw createErrorFromSupabase(error, 403, "Failed to delete place.");
    }

    if (!data) {
      return jsonResponse({ error: "Place not found or access denied." }, 404);
    }

    return jsonResponse({ ok: true, id: placeId });
  }

  async function handleGetRegionsMeta(client) {
    const user = await getCurrentUser(client);
    const currentUserId = normalizeSupabaseUserIdForFilter(user?.id);
    let builder = client.from("places").select("region");
    builder = applyPlaceVisibilityConstraint(builder, currentUserId);

    const { data, error } = await withTimeout(
      builder,
      SUPABASE_QUERY_TIMEOUT_MS
    );

    if (error) {
      throw createErrorFromSupabase(error, 400, "Failed to fetch regions.");
    }

    const counters = new Map();
    for (const row of Array.isArray(data) ? data : []) {
      const region = normalizeText(row?.region, "Region unspecified");
      counters.set(region, (counters.get(region) || 0) + 1);
    }

    const items = Array.from(counters.entries())
      .map(([region, count]) => ({ region, count }))
      .sort((left, right) => {
        if (right.count !== left.count) {
          return right.count - left.count;
        }
        return left.region.localeCompare(right.region, "ru");
      });

    return jsonResponse({
      items,
      totalRegions: items.length
    });
  }

  function applyPlaceVisibilityConstraint(builder, currentUserId) {
    if (!builder) {
      return builder;
    }

    if (currentUserId) {
      return builder.or(`is_public.eq.true,created_by.eq.${currentUserId}`);
    }

    return builder.eq("is_public", true);
  }

  function normalizeSupabaseUserIdForFilter(rawUserId) {
    const normalized = normalizeText(rawUserId, "").toLowerCase();
    return /^[0-9a-f-]{36}$/i.test(normalized)
      ? normalized
      : "";
  }

  function canReadPlaceByVisibility(place, currentUserId) {
    if (!place || typeof place !== "object") {
      return false;
    }

    if (place.is_public !== false) {
      return true;
    }

    const ownerId = normalizeSupabaseUserIdForFilter(place.created_by);
    return Boolean(ownerId && currentUserId && ownerId === currentUserId);
  }

  function parsePlacesQuery(params) {
    const limitRaw = Number(params.get("limit"));
    const offsetRaw = Number(params.get("offset"));
    const sortByRaw = normalizeText(params.get("sortBy"), "name").toLowerCase();
    const orderRaw = normalizeText(params.get("order"), "asc").toLowerCase();
    const q = normalizeText(params.get("q"), "");
    const region = normalizeText(params.get("region"), "all");
    const categoryFilter = normalizeText(params.get("categoryFilter"), "all").toLowerCase();
    const tagsFilter = parseTagsFilterQueryValue(params);
    const onlyFree = parseBooleanQueryValue(params.get("onlyFree"));
    const familyFriendly = parseBooleanQueryValue(params.get("familyFriendly"));

    return {
      limit: clampInteger(limitRaw, 1, 5000, 2000),
      offset: clampInteger(offsetRaw, 0, 100000, 0),
      sortBy: sortByRaw,
      order: orderRaw === "desc" ? "desc" : "asc",
      q,
      region,
      categoryFilter: categoryFilter || "all",
      tagsFilter,
      onlyFree,
      familyFriendly
    };
  }

  function parseTagsFilterQueryValue(params) {
    if (!params || typeof params.getAll !== "function") {
      return [];
    }

    const rawValues = [
      ...params.getAll("tagsFilter"),
      ...params.getAll("tags")
    ];

    const tokens = rawValues.flatMap((value) =>
      normalizeText(value, "")
        .split(/[,\n;]+/g)
    );

    return normalizeTagsFilterArray(tokens, 12);
  }

  function normalizeTagsFilterArray(value, maxLength = 12) {
    if (!Array.isArray(value)) {
      return [];
    }

    const maxItems = Math.max(1, Math.floor(Number(maxLength) || 12));
    const unique = [];

    for (const entry of value) {
      const normalized = normalizeFilterTagValue(entry);
      if (!normalized || unique.includes(normalized)) {
        continue;
      }
      unique.push(normalized);
      if (unique.length >= maxItems) {
        break;
      }
    }

    return unique;
  }

  function normalizeFilterTagValue(value) {
    return normalizeText(value, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function resolvePlacesSortColumn(sortBy) {
    const normalized = normalizeText(sortBy, "name").toLowerCase();
    if (normalized === "name" || normalized === "title") {
      return "title";
    }
    if (normalized === "createdat" || normalized === "created_at") {
      return "created_at";
    }
    if (normalized === "updatedat" || normalized === "updated_at") {
      return "updated_at";
    }
    if (normalized === "region") {
      return "region";
    }
    if (normalized === "country") {
      return "country";
    }
    if (normalized === "category") {
      return "category";
    }
    if (normalized === "population") {
      return "population";
    }
    if (normalized === "lat") {
      return "lat";
    }
    if (normalized === "lon" || normalized === "lng") {
      return "lng";
    }
    return "title";
  }

  function mapSupabasePlaceToAppPlace(row) {
    if (!row || typeof row !== "object") {
      return null;
    }

    const id = normalizeText(row.id, "");
    const name = normalizeText(row.title, "Untitled");
    const description = normalizeText(row.description, "Description unavailable.");
    const lat = Number(row.lat);
    const lon = Number(row.lng);

    if (!id || !Number.isFinite(lat) || !Number.isFinite(lon) || !name) {
      return null;
    }

    const region = normalizeText(row.region, "Region unspecified");
    const imageUrl = normalizeHttpUrl(row.image_url) || "";
    const tags = normalizeStringArray(row.tags, 12);
    const isPublicRaw = row.is_public;
    const isPublic = isPublicRaw !== false;
    const hasPendingReviewTag = tags.some(
      (entry) => normalizeText(entry, "").toLowerCase() === "pending-review"
    );
    const visibilityStatus = isPublic
      ? "approved"
      : (hasPendingReviewTag ? "pending" : "private");
    const languageValue = Array.isArray(row.languages)
      ? row.languages
          .map((entry) => normalizeText(entry, ""))
          .filter(Boolean)
          .join(" / ")
      : normalizeText(row.languages, "");

    return {
      id,
      name,
      title: name,
      country: normalizeText(row.country, ""),
      countryCode: normalizeText(row.country_code ?? row.countryCode, ""),
      region,
      description,
      lat,
      lon,
      lng: lon,
      category: normalizeText(row.category, ""),
      kind: normalizeText(row.category, ""),
      tags,
      highlights: tags.slice(0, 6),
      population: Number.isFinite(Number(row.population)) ? Number(row.population) : null,
      areaKm2: Number.isFinite(Number(row.area_km2 ?? row.areaKm2))
        ? Number(row.area_km2 ?? row.areaKm2)
        : null,
      currency: normalizeText(row.currency, ""),
      languages: languageValue,
      utcOffset: normalizeText(row.utc_offset ?? row.utcOffset, ""),
      climate: normalizeText(row.climate, ""),
      founded: normalizeText(row.founded, ""),
      funFact: normalizeText(row.fun_fact ?? row.funFact, ""),
      image: imageUrl,
      image_url: imageUrl,
      link: "",
      isFree: resolveBooleanInput(row.is_free ?? row.free ?? row.only_free ?? row.onlyFree, false),
      familyFriendly: resolveBooleanInput(
        row.family_friendly ?? row.familyFriendly ?? row.family,
        false
      ),
      is_public: isPublic,
      visibility_status: visibilityStatus,
      created_by: normalizeText(row.created_by, ""),
      createdAt: normalizeText(row.created_at, ""),
      updatedAt: normalizeText(row.updated_at, "")
    };
  }

  function buildSupabasePlacePayload(payload, options = {}) {
    const source = (payload && typeof payload === "object") ? payload : {};
    const partial = options.partial === true;
    const next = {};

    const title = normalizeText(source.title ?? source.name, "");
    if (title || !partial) {
      next.title = title;
    }

    if (Object.prototype.hasOwnProperty.call(source, "country") || !partial) {
      next.country = normalizeNullableText(source.country);
    }
    if (Object.prototype.hasOwnProperty.call(source, "region") || !partial) {
      next.region = normalizeNullableText(source.region);
    }
    if (Object.prototype.hasOwnProperty.call(source, "description") || !partial) {
      next.description = normalizeNullableText(source.description, "Description unavailable.");
    }

    const hasLat = Object.prototype.hasOwnProperty.call(source, "lat");
    const hasLng =
      Object.prototype.hasOwnProperty.call(source, "lng") ||
      Object.prototype.hasOwnProperty.call(source, "lon");
    if (hasLat || !partial) {
      next.lat = Number(source.lat);
    }
    if (hasLng || !partial) {
      next.lng = Number(source.lng ?? source.lon);
    }

    if (
      Object.prototype.hasOwnProperty.call(source, "category") ||
      Object.prototype.hasOwnProperty.call(source, "kind") ||
      !partial
    ) {
      next.category = normalizeNullableText(source.category ?? source.kind);
    }

    if (
      Object.prototype.hasOwnProperty.call(source, "tags") ||
      Object.prototype.hasOwnProperty.call(source, "highlights") ||
      !partial
    ) {
      const rawTags = Array.isArray(source.tags) ? source.tags : source.highlights;
      next.tags = normalizeStringArray(rawTags, 20);
    }

    if (
      Object.prototype.hasOwnProperty.call(source, "image_url") ||
      Object.prototype.hasOwnProperty.call(source, "image") ||
      !partial
    ) {
      next.image_url = normalizeHttpUrl(source.image_url ?? source.image);
    }

    if (
      Object.prototype.hasOwnProperty.call(source, "is_public") ||
      Object.prototype.hasOwnProperty.call(source, "isPublic")
    ) {
      next.is_public = Boolean(source.is_public ?? source.isPublic);
    }

    if (
      Object.prototype.hasOwnProperty.call(source, "is_free") ||
      Object.prototype.hasOwnProperty.call(source, "isFree") ||
      Object.prototype.hasOwnProperty.call(source, "free") ||
      Object.prototype.hasOwnProperty.call(source, "onlyFree") ||
      !partial
    ) {
      next.is_free = resolveBooleanInput(
        source.is_free ?? source.isFree ?? source.free ?? source.onlyFree,
        false
      );
    }

    if (
      Object.prototype.hasOwnProperty.call(source, "family_friendly") ||
      Object.prototype.hasOwnProperty.call(source, "familyFriendly") ||
      Object.prototype.hasOwnProperty.call(source, "family") ||
      !partial
    ) {
      next.family_friendly = resolveBooleanInput(
        source.family_friendly ?? source.familyFriendly ?? source.family,
        false
      );
    }

    if (partial) {
      for (const key of Object.keys(next)) {
        const value = next[key];
        if (value === undefined) {
          delete next[key];
        }
      }
    }

    return next;
  }

  function validatePlacePayload(payload, options = {}) {
    const partial = options.partial === true;
    const errors = [];

    if (!partial || Object.prototype.hasOwnProperty.call(payload, "title")) {
      if (normalizeText(payload.title, "") === "") {
        errors.push("title is required");
      }
    }

    if (!partial || Object.prototype.hasOwnProperty.call(payload, "lat")) {
      if (!Number.isFinite(Number(payload.lat)) || Number(payload.lat) < -90 || Number(payload.lat) > 90) {
        errors.push("lat must be in range [-90, 90]");
      }
    }

    if (!partial || Object.prototype.hasOwnProperty.call(payload, "lng")) {
      if (!Number.isFinite(Number(payload.lng)) || Number(payload.lng) < -180 || Number(payload.lng) > 180) {
        errors.push("lng must be in range [-180, 180]");
      }
    }

    if (Object.prototype.hasOwnProperty.call(payload, "image_url")) {
      const imageUrl = payload.image_url;
      if (imageUrl !== null && imageUrl !== "" && !normalizeHttpUrl(imageUrl)) {
        errors.push("image_url must be http/https");
      }
    }

    if (Object.prototype.hasOwnProperty.call(payload, "is_free")) {
      if (typeof payload.is_free !== "boolean") {
        errors.push("is_free must be boolean");
      }
    }

    if (Object.prototype.hasOwnProperty.call(payload, "family_friendly")) {
      if (typeof payload.family_friendly !== "boolean") {
        errors.push("family_friendly must be boolean");
      }
    }

    return errors;
  }

  async function parseRequestJson(request) {
    try {
      return await request.json();
    } catch {
      return {};
    }
  }

  async function requireAuthenticatedUser(client, message) {
    const user = await getCurrentUser(client);
    if (!user) {
      return {
        user: null,
        errorResponse: jsonResponse(
          { error: normalizeText(message, "Authentication required.") },
          401
        )
      };
    }

    return {
      user,
      errorResponse: null
    };
  }

  function normalizeProxyError(error) {
    const defaultResult = {
      status: 500,
      message: "Internal proxy error.",
      details: []
    };

    if (!error || typeof error !== "object") {
      return defaultResult;
    }

    const status = Number.isFinite(Number(error.status)) ? Number(error.status) : 500;
    const message = normalizeText(error.message, defaultResult.message);
    const details = Array.isArray(error.details)
      ? error.details
          .map((item) => normalizeText(item, ""))
          .filter(Boolean)
      : [];

    return {
      status: clampInteger(status, 400, 599, 500),
      message,
      details
    };
  }

  function createErrorFromSupabase(error, fallbackStatus, fallbackMessage) {
    const message = normalizeText(error?.message, fallbackMessage);
    const code = normalizeText(error?.code, "");
    const statusHint = Number(error?.status);

    let status = Number.isFinite(statusHint)
      ? statusHint
      : (Number.isFinite(Number(fallbackStatus)) ? Number(fallbackStatus) : 500);

    if (code === "42501") {
      status = 403;
    } else if (code === "PGRST116") {
      status = 404;
    }

    return {
      status: clampInteger(status, 400, 599, 500),
      message,
      details: [
        ...(
          code
            ? [`supabase_code=${code}`]
            : []
        )
      ]
    };
  }

  async function withTimeout(target, timeoutMs) {
    const timeoutPromise = new Promise((_, reject) => {
      window.setTimeout(() => {
        reject({
          status: 504,
          message: "Supabase request timeout."
        });
      }, timeoutMs);
    });
    return Promise.race([target, timeoutPromise]);
  }

  async function waitForSupabaseClient(timeoutMs) {
    const immediateClient = getSupabaseClientSync();
    if (immediateClient) {
      return immediateClient;
    }

    if (window.supabaseReady && typeof window.supabaseReady.then === "function") {
      const timeoutPromise = new Promise((_, reject) => {
        window.setTimeout(() => {
          reject(new Error("Timed out while waiting for Supabase client."));
        }, timeoutMs);
      });
      const client = await Promise.race([window.supabaseReady, timeoutPromise]);
      if (isSupabaseClient(client)) {
        return client;
      }
      const fallback = getSupabaseClientSync();
      if (fallback) {
        return fallback;
      }
      throw new Error("Supabase client promise resolved without a valid client.");
    }

    return new Promise((resolve, reject) => {
      let settled = false;

      const settle = (value, isError) => {
        if (settled) {
          return;
        }
        settled = true;
        window.removeEventListener("worldatlas:supabase-ready", onReady);
        window.removeEventListener("worldatlas:supabase-error", onError);
        if (timeoutId) {
          window.clearTimeout(timeoutId);
        }
        if (isError) {
          reject(value);
        } else {
          resolve(value);
        }
      };

      const onReady = () => {
        const client = getSupabaseClientSync();
        if (client) {
          settle(client, false);
        }
      };

      const onError = (event) => {
        settle(event?.detail?.error || new Error("Supabase init error."), true);
      };

      const timeoutId = window.setTimeout(() => {
        settle(new Error("Timed out while waiting for Supabase client."), true);
      }, timeoutMs);

      window.addEventListener("worldatlas:supabase-ready", onReady);
      window.addEventListener("worldatlas:supabase-error", onError);

      onReady();
    });
  }

  function getSupabaseClientSync() {
    if (isSupabaseClient(window.supabase)) {
      return window.supabase;
    }
    if (isSupabaseClient(window.WorldAtlasSupabase?.client)) {
      return window.WorldAtlasSupabase.client;
    }
    return null;
  }

  function isSupabaseClient(value) {
    return Boolean(
      value &&
      typeof value === "object" &&
      typeof value.from === "function" &&
      value.auth &&
      typeof value.auth.getSession === "function"
    );
  }

  function patchStorageForFavoritesSync() {
    if (runtime.storagePatched) {
      return;
    }
    runtime.storagePatched = true;

    const nativeSetItem = Storage.prototype.setItem;
    const nativeRemoveItem = Storage.prototype.removeItem;

    Storage.prototype.setItem = function patchedSetItem(key, value) {
      nativeSetItem.call(this, key, value);
    };

    Storage.prototype.removeItem = function patchedRemoveItem(key) {
      nativeRemoveItem.call(this, key);
    };
  }

  function attachAuthSubscription(client) {
    if (runtime.authSubscriptionAttached) {
      return;
    }
    runtime.authSubscriptionAttached = true;

    client.auth.onAuthStateChange((_event, session) => {
      runtime.user = session?.user || null;
      if (runtime.user) {
        void hydrateFavoritesFromSupabase({ mergeLocal: false });
      }
    });
  }

  function scheduleFavoritesPush() {
    if (runtime.pushTimerId) {
      window.clearTimeout(runtime.pushTimerId);
      runtime.pushTimerId = null;
    }

    runtime.pushTimerId = window.setTimeout(() => {
      runtime.pushTimerId = null;
      void pushLocalFavoritesToSupabase();
    }, FAVORITES_PUSH_DEBOUNCE_MS);
  }

  async function hydrateFavoritesFromSupabase(options = {}) {
    if (!runtime.client || runtime.isSyncRunning) {
      return;
    }

    runtime.isSyncRunning = true;
    try {
      const authUserId = await resolveCurrentAuthUserId(runtime.client);
      if (!authUserId) {
        return;
      }

      const localSet = readLocalFavorites();
      const safeLocalSet = sanitizeFavoriteIdSet(localSet);
      const remoteSet = await fetchRemoteFavorites(runtime.client, authUserId);
      const mergedSet = options.mergeLocal === false
        ? remoteSet
        : mergeSets(safeLocalSet, remoteSet);

      await syncFavoritesDiff(runtime.client, authUserId, remoteSet, mergedSet);
      writeLocalFavorites(mergedSet, { silent: true });
      notifyFavoritesSynced(mergedSet);
    } catch (error) {
      console.warn("[supabase-data-sync] hydrateFavoritesFromSupabase failed:", error);
    } finally {
      runtime.isSyncRunning = false;
    }
  }

  async function pushLocalFavoritesToSupabase() {
    if (!runtime.client || runtime.isSyncRunning) {
      return;
    }

    runtime.isSyncRunning = true;
    try {
      const authUserId = await resolveCurrentAuthUserId(runtime.client);
      if (!authUserId) {
        return;
      }

      const localSet = readLocalFavorites();
      const safeLocalSet = sanitizeFavoriteIdSet(localSet);
      const remoteSet = await fetchRemoteFavorites(runtime.client, authUserId);
      await syncFavoritesDiff(runtime.client, authUserId, remoteSet, safeLocalSet);
      notifyFavoritesSynced(safeLocalSet);
    } catch (error) {
      console.warn("[supabase-data-sync] pushLocalFavoritesToSupabase failed:", error);
    } finally {
      runtime.isSyncRunning = false;
    }
  }

  async function resolveCurrentAuthUserId(client) {
    const user = await getCurrentUser(client);
    runtime.user = user;
    return normalizeUuid(user?.id);
  }

  async function getCurrentUser(client) {
    const { data, error } = await client.auth.getUser();
    if (error) {
      return null;
    }
    return data?.user || null;
  }

  async function fetchRemoteFavorites(client, authUserId) {
    const safeUserId = normalizeUuid(authUserId);
    if (!safeUserId) {
      return new Set();
    }

    const { data, error } = await withTimeout(
      client
        .from("favorites")
        .select("place_id")
        .eq("user_id", safeUserId),
      SUPABASE_QUERY_TIMEOUT_MS
    );

    if (error) {
      throw createErrorFromSupabase(error, 400, "Failed to fetch favorites.");
    }

    const result = new Set();
    for (const row of Array.isArray(data) ? data : []) {
      const placeId = normalizeUuid(row?.place_id);
      if (placeId) {
        result.add(placeId);
      }
    }
    return result;
  }

  async function syncFavoritesDiff(client, userId, currentRemoteSet, targetSet) {
    const safeUserId = normalizeUuid(userId);
    if (!safeUserId) {
      return;
    }

    const safeCurrentRemoteSet = sanitizeFavoriteIdSet(currentRemoteSet);
    const safeTargetSet = sanitizeFavoriteIdSet(targetSet);
    const toInsert = [];
    const toDelete = [];

    for (const placeId of safeTargetSet) {
      if (!safeCurrentRemoteSet.has(placeId)) {
        toInsert.push(placeId);
      }
    }

    for (const placeId of safeCurrentRemoteSet) {
      if (!safeTargetSet.has(placeId)) {
        toDelete.push(placeId);
      }
    }

    if (toInsert.length > 0) {
      const rows = toInsert.map((placeId) => ({
        user_id: safeUserId,
        place_id: placeId
      }));
      const { error } = await withTimeout(
        client.from("favorites").upsert(rows, {
          onConflict: "user_id,place_id"
        }),
        SUPABASE_QUERY_TIMEOUT_MS
      );
      if (error) {
        throw createErrorFromSupabase(error, 403, "Failed to insert favorites.");
      }
    }

    if (toDelete.length > 0) {
      const { error } = await withTimeout(
        client
          .from("favorites")
          .delete()
          .eq("user_id", safeUserId)
          .in("place_id", toDelete),
        SUPABASE_QUERY_TIMEOUT_MS
      );
      if (error) {
        throw createErrorFromSupabase(error, 403, "Failed to delete favorites.");
      }
    }
  }

  function notifyFavoritesSynced(setValue) {
    window.dispatchEvent(
      new CustomEvent("worldatlas:favorites-synced", {
        detail: {
          ids: Array.from(setValue)
        }
      })
    );
  }

  function readLocalFavorites() {
    try {
      const rawValue = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
      if (!rawValue) {
        return new Set();
      }
      const parsed = JSON.parse(rawValue);
      if (!Array.isArray(parsed)) {
        return new Set();
      }
      return new Set(
        parsed
          .map((value) => normalizeText(value, ""))
          .filter(Boolean)
      );
    } catch {
      return new Set();
    }
  }

  function writeLocalFavorites(favoritesSet, options = {}) {
    const values = Array.isArray(favoritesSet)
      ? favoritesSet
      : Array.from(favoritesSet instanceof Set ? favoritesSet : []);

    runtime.isApplyingRemoteFavorites = options.silent === true;
    try {
      window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(values));
    } catch (error) {
      console.warn("[supabase-data-sync] Failed to write favorites to localStorage:", error);
    } finally {
      runtime.isApplyingRemoteFavorites = false;
    }
  }

  function mergeSets(leftSet, rightSet) {
    const merged = new Set();
    for (const item of leftSet instanceof Set ? leftSet : []) {
      merged.add(item);
    }
    for (const item of rightSet instanceof Set ? rightSet : []) {
      merged.add(item);
    }
    return merged;
  }

  function sanitizeFavoriteIdSet(rawSet) {
    const result = new Set();
    for (const value of rawSet instanceof Set ? rawSet : []) {
      const placeId = normalizeUuid(value);
      if (placeId) {
        result.add(placeId);
      }
    }
    return result;
  }

  function normalizeNullableText(value, fallbackValue = null) {
    const normalized = normalizeText(value, "");
    return normalized || fallbackValue;
  }

  function normalizeStringArray(value, maxLength) {
    if (!Array.isArray(value)) {
      return [];
    }

    const normalized = value
      .map((item) => normalizeText(item, ""))
      .filter(Boolean);

    if (!Number.isFinite(Number(maxLength))) {
      return normalized;
    }

    return normalized.slice(0, Math.max(0, Math.floor(Number(maxLength))));
  }

  function normalizeHttpUrl(value) {
    const normalized = normalizeText(value, "");
    if (!normalized) {
      return null;
    }

    try {
      const url = new URL(normalized);
      if (url.protocol === "http:" || url.protocol === "https:") {
        return url.toString();
      }
      return null;
    } catch {
      return null;
    }
  }

  function escapeLikePattern(value) {
    return normalizeText(value, "")
      .replace(/[,%]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function clampInteger(value, min, max, fallback) {
    if (!Number.isFinite(Number(value))) {
      return fallback;
    }
    const normalized = Math.floor(Number(value));
    return Math.min(max, Math.max(min, normalized));
  }

  function parseBooleanQueryValue(rawValue) {
    if (typeof rawValue !== "string") {
      return false;
    }
    const normalized = rawValue.trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes";
  }

  function resolveBooleanInput(value, fallback = false) {
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "number") {
      return value === 1;
    }
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (normalized === "true" || normalized === "1" || normalized === "yes") {
        return true;
      }
      if (normalized === "false" || normalized === "0" || normalized === "no") {
        return false;
      }
    }
    return Boolean(fallback);
  }

  function normalizeText(value, fallbackValue) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed !== "") {
        return trimmed;
      }
    }
    return fallbackValue;
  }

  function normalizeUuid(value) {
    const normalized = normalizeText(value, "").toLowerCase();
    return UUID_PATTERN.test(normalized) ? normalized : "";
  }

  function jsonResponse(payload, status = 200) {
    return new Response(JSON.stringify(payload), {
      status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      }
    });
  }
})();
