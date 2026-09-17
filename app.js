
(() => {
  "use strict";

  if (window.__WORLD_ATLAS_PRO_INITIALIZED__) {
    return;
  }
  window.__WORLD_ATLAS_PRO_INITIALIZED__ = true;
  const PERF_QUERY_KEY = "perf";
  const PERF_QUERY_ENABLED_VALUE = "1";
  maybeLoadPerfScript();

  function maybeLoadPerfScript() {
    const params = new URLSearchParams(window.location.search);
    if (params.get(PERF_QUERY_KEY) !== PERF_QUERY_ENABLED_VALUE) {
      return;
    }
    if (window.__WORLD_ATLAS_PERF_LOADER_STARTED__) {
      return;
    }
    window.__WORLD_ATLAS_PERF_LOADER_STARTED__ = true;

    // Variant B: loader in app.js avoids new inline HTML script and is safer for strict CSP setups.
    const perfUrl = new URL("./assets/perf.js?v=20260425c", window.location.href);
    const script = document.createElement("script");
    script.src = perfUrl.toString();
    script.async = true;
    script.defer = true;
    script.dataset.injectedBy = "app-perf-loader";
    script.onload = () => {
      if (window.WorldAtlasPerf?.PERF_ENABLED === true || window.PERF_ENABLED === true) {
        return;
      }
      console.warn("[perf] perf.js loaded but PERF_ENABLED=false.");
    };
    script.onerror = () => {
      console.warn("[perf] perf.js was not loaded (404/CSP/network). App continues.", {
        src: perfUrl.toString()
      });
    };

    const target = document.head || document.documentElement || document.body;
    if (!target) {
      console.warn("[perf] unable to append perf.js loader script. App continues.");
      return;
    }
    target.append(script);
  }

  const Config = Object.freeze({
    API_BASE: "/api",
    PLACE_LIMIT: 2000,
    DEFAULT_VIEW: Object.freeze({ lat: 24.5, lng: 11, zoom: 2.25 }),
    MIN_ZOOM: 2,
    MAX_ZOOM: 18,
    URL_SYNC_DEBOUNCE_MS: 260,
    SEARCH_DEBOUNCE_MS: 180,
    STATUS_CLEAR_MS: 3800,
    POPUP_TRANSITION_MS: 220,
    POPUP_SWITCH_TRANSITION_MS: 210,
    POPUP_IMAGE_MAX_WIDTH_PX: 1200,
    POPUP_IMAGE_TIMEOUT_MS: 6000,
    POPUP_IMAGE_BAD_URL_TTL_MS: 10 * 60 * 1000,
    FEATURE_TWO_STEP_POPUP: true,
    POPUP_ANCHOR_GAP_PX: 11,
    POPUP_VIEWPORT_PADDING_PX: 12,
    POPUP_DEFERRED_RENDER_DELAY_MS: 18,
    POPUP_NON_CRITICAL_RENDER_DELAY_MS: 120,
    POPUP_NON_CRITICAL_IDLE_TIMEOUT_MS: 320,
    POPUP_NON_CRITICAL_WHILE_MOVING_RETRY_MS: 96,
    POPUP_WEATHER_CACHE_TTL_MS: 10 * 60 * 1000,
    POPUP_TRACK_LERP: 0.32,
    POPUP_TRACK_SNAP_PX: 0.42,
    POPUP_TRACK_REMEASURE_EVERY_FRAMES: 8,
    POPUP_TRACK_MAX_HEIGHT_RATIO: 0.8,
    POPUP_TRACK_ACTIVE_INTERVAL_MS: 16,
    POPUP_TRACK_IDLE_INTERVAL_MS: 72,
    POPUP_TRACK_IDLE_FRAME_THRESHOLD: 9,
    FLY_DURATION_MIN_S: 0.6,
    FLY_DURATION_MAX_S: 0.9,
    FLY_DISTANCE_FACTOR_KM: 2800,
    FLY_ZOOM_FACTOR_S: 0.04,
    FLY_EASE_NEAR: 0.22,
    FLY_EASE_FAR: 0.16,
    FLY_EASE_DISTANCE_KM: 6200,
    FLY_PAN_ONLY_DISTANCE_KM: 540,
    FLY_FAR_TARGET_ZOOM_MIN: 4.75,
    FLY_FAR_TARGET_ZOOM_MAX: 8.6,
    MARKER_FOCUS_NEAR_DISTANCE_KM: 240,
    MARKER_FOCUS_DISTANCE_KM: 5200,
    MARKER_FOCUS_TARGET_ZOOM_MIN: 5.2,
    MARKER_FOCUS_TARGET_ZOOM_MAX: 7.35,
    MARKER_FOCUS_NEAR_ZOOM_BOOST: 0.72,
    RESET_FLY_DURATION_S: 1.42,
    POPUP_OPEN_AFTER_FLY_MS: 40,
    MAP_MOTION_CLASS_GRACE_MS: 150,
    UI_PANEL_TRANSITION_MS: 240,
    MARKER_HOVER_INTENT_MS: 34,
    MARKER_HOVER_CLEAR_MS: 80,
    MARKER_TOOLTIP_HIDE_DELAY_MS: 96,
    MARKER_TAP_PRIME_TIMEOUT_MS: 1400,
    MARKER_SPOTLIGHT_CYCLES: 2,
    MARKER_SPOTLIGHT_CYCLE_MS: 600,
    ROUTE_API_BASE: "/api/route",
    ROUTE_TIMEOUT_MS: 12000,
    ROUTE_MAX_POINTS: 10,
    ROUTE_MODE_DEFAULT: "car",
    ROUTE_DIRECT_SPEED_KMPH: 62,
    ROUTE_WALK_SPEED_KMPH: 5,
    ROUTE_CAR_SPEED_KMPH: 70,
    ROUTE_FLIGHT_SPEED_KMPH: 800,
    ROUTE_FLIGHT_OVERHEAD_MINUTES: 60,
    ROUTE_RENDER_MAX_POINTS: 720,
    ROUTE_ARROW_SPACING_PX: 172,
    ROUTE_ARROW_MAX_MARKERS: 36,
    ROUTE_FIT_DURATION_S: 1.2,
    ROUTE_DRAW_MOTION_MS: 920,
    NEAR_ME_RESULTS_LIMIT: 10,
    NEAR_ME_TARGET_ZOOM: 7.2,
    GEOLOCATION_TIMEOUT_MS: 12000,
    GEOLOCATION_MAX_AGE_MS: 120000,
    FAVORITES_STORAGE_KEY: "worldAtlasPro.favorites.v1",
    PLACE_FEEDBACK_STORAGE_KEY: "worldAtlasPro.placeFeedback.v1",
    TOAST_CLEAR_MS: 1700,
    ONBOARDING_STORAGE_KEY: "worldAtlasPro.onboardingSeen.v1",
    ONBOARDING_START_DELAY_MS: 520,
    SPARSE_REMOTE_POINTS_THRESHOLD: 10,
    LOCAL_SEED_SOURCE_PATHS: Object.freeze([
      "/places.json",
      "./places.json"
    ]),
    SUPABASE_PLACE_IMAGES_BUCKET: "place-images",
    SUPABASE_SIGNED_IMAGE_TTL_SEC: 3600,
    ADD_PLACE_IMAGE_MAX_BYTES: 8 * 1024 * 1024,
    ADD_PLACE_IMAGE_ALLOWED_TYPES: Object.freeze([
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/avif"
    ]),
    PLACES_SYNC_INTERVAL_MS: 15000,
    PLACES_SYNC_MIN_GAP_MS: 5000,
    MARKER_Z_DEFAULT: 0,
    MARKER_Z_HOVER: 760,
    MARKER_Z_ACTIVE: 1280
  });

  const PLACE_SEASON_ORDER = Object.freeze(["spring", "summer", "autumn", "winter"]);
  const PLACE_BASE_VIEW_KEY = "base";
  const PLACE_BASE_VIEW_LABEL = "Base";
  const PLACE_SEASON_LABELS = Object.freeze({
    spring: "Spring",
    summer: "Summer",
    autumn: "Autumn",
    winter: "Winter"
  });
  const PLACE_SEASON_ALIASES = Object.freeze({
    spring: "spring",
    summer: "summer",
    autumn: "autumn",
    fall: "autumn",
    winter: "winter"
  });

  function normalizeSeasonKey(rawValue, fallbackValue = "") {
    const normalized = normalizeText(rawValue, "").toLowerCase();
    return PLACE_SEASON_ALIASES[normalized] || normalizeText(fallbackValue, "");
  }

  function isBaseSeasonViewKey(rawValue) {
    const normalized = normalizeText(rawValue, "").toLowerCase();
    return normalized === PLACE_BASE_VIEW_KEY || normalized === "default";
  }

  function formatSeasonLabel(seasonKey) {
    const safeSeasonKey = normalizeSeasonKey(seasonKey);
    return PLACE_SEASON_LABELS[safeSeasonKey] || "Season";
  }

  function resolveCurrentSeasonKey(dateValue = new Date()) {
    const currentDate = dateValue instanceof Date ? dateValue : new Date(dateValue);
    const month = Number(currentDate.getMonth());
    if (!Number.isFinite(month)) {
      return "summer";
    }
    if (month <= 1 || month === 11) {
      return "winter";
    }
    if (month <= 4) {
      return "spring";
    }
    if (month <= 7) {
      return "summer";
    }
    return "autumn";
  }

  function normalizeStorageSegment(rawValue, fallbackValue = "") {
    const normalized = normalizeText(rawValue, "")
      .replace(/[^A-Za-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return normalized || normalizeText(fallbackValue, "");
  }

  function normalizeStorageObjectPath(rawPath) {
    const normalized = normalizeText(rawPath, "")
      .replace(/\\/g, "/")
      .replace(/^\/+|\/+$/g, "")
      .replace(/\/{2,}/g, "/");
    if (!normalized) {
      return "";
    }

    return normalized
      .split("/")
      .map((entry) => normalizeStorageSegment(entry))
      .filter(Boolean)
      .join("/");
  }

  function normalizeSeasonalItemValue(rawValue) {
    if (!rawValue || typeof rawValue !== "object") {
      return null;
    }

    const title = normalizeText(rawValue.title ?? rawValue.name, "");
    const description = normalizeText(rawValue.description, "");
    const imagePath = normalizeStorageObjectPath(
      rawValue.image_path ?? rawValue.imagePath ?? rawValue.path
    );
    const imageUrl = normalizeHttpUrl(
      rawValue.image_url ?? rawValue.imageUrl ?? rawValue.image
    );

    if (!title && !description && !imagePath && !imageUrl) {
      return null;
    }

    return {
      title,
      description,
      image_path: imagePath || "",
      image_url: imageUrl || "",
      image: imageUrl || ""
    };
  }

  function normalizeSeasonalContentValue(rawValue) {
    let source = rawValue;
    if (typeof source === "string") {
      try {
        source = JSON.parse(source);
      } catch {
        source = null;
      }
    }

    if (!source || typeof source !== "object") {
      return {
        enabled: false,
        defaultSeason: "",
        activeSeasons: [],
        items: {}
      };
    }

    const rawItems = (
      source.items && typeof source.items === "object"
        ? source.items
        : source
    );
    const items = {};
    for (const seasonKey of PLACE_SEASON_ORDER) {
      const normalizedItem = normalizeSeasonalItemValue(rawItems?.[seasonKey]);
      if (normalizedItem) {
        items[seasonKey] = normalizedItem;
      }
    }

    const requestedSeasons = Array.isArray(source.activeSeasons)
      ? source.activeSeasons
      : (
        Array.isArray(source.active_seasons)
          ? source.active_seasons
          : []
      );
    const activeSeasons = [];
    for (const rawSeason of requestedSeasons) {
      const normalizedSeason = normalizeSeasonKey(rawSeason);
      if (
        normalizedSeason &&
        items[normalizedSeason] &&
        !activeSeasons.includes(normalizedSeason)
      ) {
        activeSeasons.push(normalizedSeason);
      }
    }

    if (activeSeasons.length === 0) {
      for (const seasonKey of PLACE_SEASON_ORDER) {
        if (items[seasonKey]) {
          activeSeasons.push(seasonKey);
        }
      }
    }

    const enabledFlag = Boolean(
      source.enabled === true ||
      source.isSeasonal === true ||
      source.is_seasonal === true ||
      activeSeasons.length > 0
    );

    if (!enabledFlag || activeSeasons.length === 0) {
      return {
        enabled: false,
        defaultSeason: "",
        activeSeasons: [],
        items: {}
      };
    }

    const normalizedDefaultSeason = normalizeSeasonKey(
      source.defaultSeason ?? source.default_season ?? source.initialSeason
    );
    const defaultSeason = activeSeasons.includes(normalizedDefaultSeason)
      ? normalizedDefaultSeason
      : activeSeasons[0];

    return {
      enabled: true,
      defaultSeason,
      activeSeasons,
      items
    };
  }

  function createSeasonalContentPayload(rawValue) {
    const normalized = normalizeSeasonalContentValue(rawValue);
    if (!normalized.enabled) {
      return {};
    }

    const items = {};
    for (const seasonKey of normalized.activeSeasons) {
      const item = normalizeSeasonalItemValue(normalized.items?.[seasonKey]);
      if (!item) {
        continue;
      }
      items[seasonKey] = {
        title: normalizeText(item.title, ""),
        description: normalizeText(item.description, ""),
        image_path: normalizeText(item.image_path, ""),
        image_url: normalizeHttpUrl(item.image_url ?? item.image) || ""
      };
    }

    const activeSeasons = normalized.activeSeasons.filter((seasonKey) => Boolean(items[seasonKey]));
    if (activeSeasons.length === 0) {
      return {};
    }

    return {
      enabled: true,
      defaultSeason: activeSeasons.includes(normalized.defaultSeason)
        ? normalized.defaultSeason
        : activeSeasons[0],
      activeSeasons,
      items
    };
  }

  function buildPlaceSeasonView(place, preferredSeason = "") {
    if (!place || typeof place !== "object") {
      return place;
    }

    const seasonalContent = normalizeSeasonalContentValue(
      place.seasonal_content ?? place.seasonalContent
    );
    if (!seasonalContent.enabled) {
      return {
        ...place,
        seasonal_content: seasonalContent,
        active_season: "",
        active_season_label: ""
      };
    }

    if (isBaseSeasonViewKey(preferredSeason)) {
      const baseImage = normalizeHttpUrl(place.image ?? place.image_url) || "";
      return {
        ...place,
        image: baseImage,
        image_url: baseImage,
        seasonal_content: seasonalContent,
        active_season: PLACE_BASE_VIEW_KEY,
        active_season_label: PLACE_BASE_VIEW_LABEL,
        seasonal_item: null
      };
    }

    const requestedSeason = normalizeSeasonKey(
      preferredSeason,
      seasonalContent.defaultSeason || resolveCurrentSeasonKey()
    );
    const activeSeason = seasonalContent.activeSeasons.includes(requestedSeason)
      ? requestedSeason
      : seasonalContent.defaultSeason;
    const seasonalItem = seasonalContent.items?.[activeSeason] || null;
    const seasonalImage = normalizeHttpUrl(
      seasonalItem?.image_url ?? seasonalItem?.image
    ) || "";
    const baseImage = normalizeHttpUrl(place.image ?? place.image_url) || "";
    const seasonalTitle = normalizeText(seasonalItem?.title, "");
    const seasonalDescription = normalizeText(seasonalItem?.description, "");

    return {
      ...place,
      name: seasonalTitle || normalizeText(place.name ?? place.title, "Untitled"),
      title: seasonalTitle || normalizeText(place.title ?? place.name, "Untitled"),
      description: seasonalDescription || normalizeText(place.description, "Description unavailable."),
      image: seasonalImage || baseImage,
      image_url: seasonalImage || baseImage,
      image_path: normalizeStorageObjectPath(
        seasonalItem?.image_path ?? seasonalItem?.imagePath ?? place.image_path ?? place.imagePath
      ),
      seasonal_content: seasonalContent,
      active_season: activeSeason,
      active_season_label: formatSeasonLabel(activeSeason),
      seasonal_item: seasonalItem
    };
  }

  const BaseSeedPlaces = Object.freeze([
    {
      id: "new-york",
      name: "Нью-Йорк, США",
      region: "Северная Америка",
      lat: 40.7128,
      lon: -74.006,
      description: "Крупный финансовый и культурный центр с активной городской экосистемой.",
      link: "https://www.nyc.gov/",
      image:
        "https://upload.wikimedia.org/wikipedia/commons/7/7a/View_of_Empire_State_Building_from_Rockefeller_Center_New_York_City_dllu_%28cropped%29.jpg",
      createdAt: "2026-02-12T00:00:00.000Z",
      updatedAt: "2026-02-12T00:00:00.000Z"
    },
    {
      id: "san-francisco",
      name: "Сан-Франциско, США",
      region: "Северная Америка",
      lat: 37.7749,
      lon: -122.4194,
      description: "Ключевой технологический хаб и важный порт Тихоокеанского побережья.",
      link: "https://sf.gov/",
      image:
        "https://upload.wikimedia.org/wikipedia/commons/f/f9/San_Francisco_Downtown_Aerial%2C_August_2025.jpg",
      createdAt: "2026-02-12T00:00:00.000Z",
      updatedAt: "2026-02-12T00:00:00.000Z"
    },
    {
      id: "london",
      name: "Лондон, Великобритания",
      region: "Европа",
      lat: 51.5074,
      lon: -0.1278,
      description: "Один из глобальных центров финансов, образования, медиа и международной политики.",
      link: "https://www.london.gov.uk/",
      image:
        "https://upload.wikimedia.org/wikipedia/commons/6/67/London_Skyline_%28125508655%29.jpeg",
      createdAt: "2026-02-12T00:00:00.000Z",
      updatedAt: "2026-02-12T00:00:00.000Z"
    },
    {
      id: "cairo",
      name: "Каир, Египет",
      region: "Африка",
      lat: 30.0444,
      lon: 31.2357,
      description: "Крупнейший мегаполис региона с богатым историческим и культурным наследием.",
      link: "https://www.egypt.travel/",
      image:
        "https://upload.wikimedia.org/wikipedia/commons/c/ca/Cairo_Skyline_%282020%29.jpg",
      createdAt: "2026-02-12T00:00:00.000Z",
      updatedAt: "2026-02-12T00:00:00.000Z"
    },
    {
      id: "cape-town",
      name: "Кейптаун, ЮАР",
      region: "Африка",
      lat: -33.9249,
      lon: 18.4241,
      description: "Важный морской узел и центр туризма с разнообразной природной географией.",
      link: "https://www.capetown.travel/",
      image:
        "https://upload.wikimedia.org/wikipedia/commons/8/8d/Camps_bay_%2853460319478%29_%28cropped%29.jpg",
      createdAt: "2026-02-12T00:00:00.000Z",
      updatedAt: "2026-02-12T00:00:00.000Z"
    },
    {
      id: "dubai",
      name: "Дубай, ОАЭ",
      region: "Ближний Восток",
      lat: 25.2048,
      lon: 55.2708,
      description: "Глобальный транспортный и деловой хаб с интенсивным городским развитием.",
      link: "https://www.visitdubai.com/",
      image: "https://upload.wikimedia.org/wikipedia/en/c/c7/Burj_Khalifa_2021.jpg",
      createdAt: "2026-02-12T00:00:00.000Z",
      updatedAt: "2026-02-12T00:00:00.000Z"
    },
    {
      id: "tokyo",
      name: "Токио, Япония",
      region: "Азия",
      lat: 35.6762,
      lon: 139.6503,
      description: "Один из крупнейших мегаполисов мира с сильной технологической и культурной экосистемой.",
      link: "https://www.metro.tokyo.lg.jp/english/",
      image:
        "https://upload.wikimedia.org/wikipedia/commons/b/b2/Skyscrapers_of_Shinjuku_2009_January.jpg",
      createdAt: "2026-02-12T00:00:00.000Z",
      updatedAt: "2026-02-12T00:00:00.000Z"
    },
    {
      id: "singapore",
      name: "Сингапур",
      region: "Азия",
      lat: 1.3521,
      lon: 103.8198,
      description: "Высокотехнологичный город-государство и значимый международный логистический центр.",
      link: "https://www.visitsingapore.com/",
      image: "https://upload.wikimedia.org/wikipedia/commons/c/c7/Marina_Bay_Sands_%28I%29.jpg",
      createdAt: "2026-02-12T00:00:00.000Z",
      updatedAt: "2026-02-12T00:00:00.000Z"
    },
    {
      id: "sydney",
      name: "Сидней, Австралия",
      region: "Океания",
      lat: -33.8688,
      lon: 151.2093,
      description: "Один из ключевых городов Австралии с сильной портовой и сервисной экономикой.",
      link: "https://www.cityofsydney.nsw.gov.au/",
      image:
        "https://upload.wikimedia.org/wikipedia/commons/5/53/Sydney_Opera_House_and_Harbour_Bridge_Dusk_%282%29_2019-06-21.jpg",
      createdAt: "2026-02-12T00:00:00.000Z",
      updatedAt: "2026-02-12T00:00:00.000Z"
    },
    {
      id: "rio-de-janeiro",
      name: "Рио-де-Жанейро, Бразилия",
      region: "Южная Америка",
      lat: -22.9068,
      lon: -43.1729,
      description: "Крупный прибрежный мегаполис Латинской Америки с яркой культурной средой.",
      link: "https://riotur.rio/en/welcome/",
      image: "https://upload.wikimedia.org/wikipedia/commons/9/98/Cidade_Maravilhosa.jpg",
      createdAt: "2026-02-12T00:00:00.000Z",
      updatedAt: "2026-02-12T00:00:00.000Z"
    },
    {
      id: "buenos-aires",
      name: "Буэнос-Айрес, Аргентина",
      region: "Южная Америка",
      lat: -34.6037,
      lon: -58.3816,
      description: "Крупный культурный, образовательный и экономический центр Южной Америки.",
      link: "https://turismo.buenosaires.gob.ar/en",
      image:
        "https://images.unsplash.com/photo-1589909202802-8f4aadce1849?w=800&h=500&fit=crop&q=80",
      createdAt: "2026-02-12T00:00:00.000Z",
      updatedAt: "2026-02-12T00:00:00.000Z"
    }
  ]);

  const SeedPlaceDetails = Object.freeze({
    "new-york": {
      country: "США",
      countryCode: "US",
      timezone: "UTC-5 (ET)",
      utcOffset: "UTC-5",
      population: 8336817,
      areaKm2: 783.8,
      currency: "USD",
      languages: "English",
      climate: "Влажный субтропический",
      founded: "1624",
      funFact: "В городе более 470 станций метро, а система работает круглосуточно.",
      highlights: [
        "Финансовый центр: Wall Street",
        "Знаковые музеи и театры Бродвея",
        "Международный транспортный хаб"
      ]
    },
    "san-francisco": {
      country: "США",
      countryCode: "US",
      timezone: "UTC-8 (PT)",
      utcOffset: "UTC-8",
      population: 808437,
      areaKm2: 121.4,
      currency: "USD",
      languages: "English",
      climate: "Средиземноморский",
      founded: "1776",
      funFact: "Летний туман здесь настолько характерный, что у него есть имя Karl the Fog.",
      highlights: [
        "Сильная технологическая экосистема",
        "Крупные университеты и R&D",
        "Порт и логистика Тихого океана"
      ]
    },
    london: {
      country: "Великобритания",
      countryCode: "GB",
      timezone: "UTC+0",
      utcOffset: "UTC+0",
      population: 8961989,
      areaKm2: 1572,
      currency: "GBP",
      languages: "English",
      climate: "Умеренный океанический",
      founded: "43 AD",
      funFact: "Лондонское метро — старейшая подземка в мире, запущена в 1863 году.",
      highlights: [
        "Глобальный финансовый центр",
        "Крупные медиа и креативные индустрии",
        "Международные образовательные кластеры"
      ]
    },
    cairo: {
      country: "Египет",
      countryCode: "EG",
      timezone: "UTC+2",
      utcOffset: "UTC+2",
      population: 10230350,
      areaKm2: 528,
      currency: "EGP",
      languages: "Arabic",
      climate: "Пустынный",
      founded: "969",
      funFact: "Каир считается одним из крупнейших мегаполисов Африки и Ближнего Востока.",
      highlights: [
        "Богатое историческое наследие",
        "Сильный торгово-логистический узел",
        "Культурный центр региона"
      ]
    },
    "cape-town": {
      country: "ЮАР",
      countryCode: "ZA",
      timezone: "UTC+2",
      utcOffset: "UTC+2",
      population: 4618000,
      areaKm2: 2446,
      currency: "ZAR",
      languages: "English / Afrikaans",
      climate: "Средиземноморский",
      founded: "1652",
      funFact: "Город расположен между океаном и Столовой горой, что формирует уникальный ландшафт.",
      highlights: [
        "Крупный порт и морская логистика",
        "Туризм мирового уровня",
        "Развитый сервисный сектор"
      ]
    },
    dubai: {
      country: "ОАЭ",
      countryCode: "AE",
      timezone: "UTC+4",
      utcOffset: "UTC+4",
      population: 3650000,
      areaKm2: 4114,
      currency: "AED",
      languages: "Arabic / English",
      climate: "Жаркий пустынный",
      founded: "1833",
      funFact: "В Дубае один из самых загруженных международных аэропортов мира.",
      highlights: [
        "Глобальный авиационный хаб",
        "Сильный сектор недвижимости и услуг",
        "Крупный центр международной торговли"
      ]
    },
    tokyo: {
      country: "Япония",
      countryCode: "JP",
      timezone: "UTC+9",
      utcOffset: "UTC+9",
      population: 13960000,
      areaKm2: 2194,
      currency: "JPY",
      languages: "Japanese",
      climate: "Влажный субтропический",
      founded: "1603",
      funFact: "Токио объединяет ультрасовременную инфраструктуру и исторические районы.",
      highlights: [
        "Один из крупнейших мегаполисов мира",
        "Высокий уровень технологий и автоматизации",
        "Сильная транспортная сеть"
      ]
    },
    singapore: {
      country: "Сингапур",
      countryCode: "SG",
      timezone: "UTC+8",
      utcOffset: "UTC+8",
      population: 5917600,
      areaKm2: 734.3,
      currency: "SGD",
      languages: "English / Mandarin",
      climate: "Экваториальный",
      founded: "1819",
      funFact: "Сингапур стабильно входит в лидеры по качеству городской инфраструктуры.",
      highlights: [
        "Глобальный финансовый узел",
        "Один из крупнейших контейнерных портов",
        "Высокая плотность инновационных компаний"
      ]
    },
    sydney: {
      country: "Австралия",
      countryCode: "AU",
      timezone: "UTC+10",
      utcOffset: "UTC+10",
      population: 5312000,
      areaKm2: 12368,
      currency: "AUD",
      languages: "English",
      climate: "Влажный субтропический",
      founded: "1788",
      funFact: "Гавань Сиднея считается одной из самых узнаваемых естественных бухт в мире.",
      highlights: [
        "Ключевая экономика Австралии",
        "Крупный образовательный и сервисный центр",
        "Развитая портовая инфраструктура"
      ]
    },
    "rio-de-janeiro": {
      country: "Бразилия",
      countryCode: "BR",
      timezone: "UTC-3",
      utcOffset: "UTC-3",
      population: 6748000,
      areaKm2: 1182.3,
      currency: "BRL",
      languages: "Portuguese",
      climate: "Тропический саванный",
      founded: "1565",
      funFact: "Рио известен масштабной набережной и одной из самых посещаемых городских бухт.",
      highlights: [
        "Крупный центр туризма и креативных индустрий",
        "Сильный портовый потенциал",
        "Яркая культурная сцена"
      ]
    },
    "buenos-aires": {
      country: "Аргентина",
      countryCode: "AR",
      timezone: "UTC-3",
      utcOffset: "UTC-3",
      population: 3120612,
      areaKm2: 203,
      currency: "ARS",
      languages: "Spanish",
      climate: "Влажный субтропический",
      founded: "1536",
      funFact: "Город часто называют культурной столицей Латинской Америки.",
      highlights: [
        "Финансовый и деловой центр Аргентины",
        "Сильные образовательные учреждения",
        "Насыщенная театральная и гастрономическая сцена"
      ]
    }
  });

  const SeedPlaces = Object.freeze(
    BaseSeedPlaces.map((place) => ({
      ...place,
      ...(SeedPlaceDetails[place.id] || {})
    }))
  );
  const SeedPlaceDetailIndex = buildSeedPlaceDetailIndex();

  const DefaultSmartFilters = Object.freeze({
    category: "all",
    tags: [],
    onlyFree: false,
    familyFriendly: false,
    sortBy: "name-asc"
  });

  const State = {
    allPlaces: [],
    filteredPlaces: [],
    selectedPlaceId: null,
    hoveredPlaceId: null,
    searchQuery: "",
    regionFilter: "all",
    favoritesOnly: false,
    smartFilters: { ...DefaultSmartFilters },
    favoritePlaceIds: new Set(),
    markersVisible: true,
    mapView: { ...Config.DEFAULT_VIEW }
  };

  const Runtime = {
    isBootstrapping: false,
    statusTimerId: null,
    toastTimerId: null,
    urlTimerId: null,
    placeDeleteZoomRafId: null,
    placeDeleteZoomNestedRafId: null,
    pointsToggleLabelTimerId: null,
    filterMotionTimerId: null,
    sparseSupabaseNotified: false,
    localSeedLoadWarned: false,
    localSeedPlacesCache: null,
    localSeedPlacesPromise: null,
    placesLoadWarned: false,
    supabasePlacesSchemaMissing: false,
    supabaseReviewSchemaMissing: false,
    placeFactsSchemaDebugged: new Set(),
    supabaseUnsupportedPlaceColumns: new Set(),
    placesReloadPromise: null,
    placesReloadLastAt: 0,
    addPlaceAccessState: {
      isAuthenticated: false,
      isAdmin: false,
      isBanned: false,
      isFrozen: false,
      freezeReason: "",
      frozenUntil: "",
      isFreezePermanent: false,
      userId: ""
    },
    userBanState: {
      userId: "",
      isBanned: false,
      checkedAt: 0
    },
    cleanupFns: []
  };

  function buildSeedPlaceDetailIndex() {
    const byId = new Map();
    const byNameKey = new Map();
    const points = [];

    for (const place of SeedPlaces) {
      if (!place || typeof place !== "object") {
        continue;
      }

      const details = SeedPlaceDetails[place.id];
      if (!details || typeof details !== "object") {
        continue;
      }

      byId.set(place.id, details);

      addSeedDetailName(byNameKey, place.name, details);
      addSeedDetailName(byNameKey, place.title, details);

      const cityToken = normalizeText(place.name, "").split(",")[0];
      addSeedDetailName(byNameKey, cityToken, details);

      const lat = Number(place.lat);
      const lon = Number(place.lon ?? place.lng);
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        points.push({
          lat,
          lon,
          details
        });
      }
    }

    return Object.freeze({
      byId,
      byNameKey,
      points
    });
  }

  function addSeedDetailName(indexMap, rawName, details) {
    const lookupKey = normalizePlaceLookupKey(rawName);
    if (!lookupKey || indexMap.has(lookupKey)) {
      return;
    }
    indexMap.set(lookupKey, details);
  }

  function normalizePlaceLookupKey(value) {
    const text = normalizeText(value, "");
    if (!text) {
      return "";
    }

    return text
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9а-яё']+/gi, " ")
      .trim()
      .replace(/\s+/g, " ");
  }

  const CYRILLIC_SLUG_CHAR_MAP = Object.freeze({
    а: "a",
    б: "b",
    в: "v",
    г: "g",
    д: "d",
    е: "e",
    ё: "e",
    ж: "zh",
    з: "z",
    и: "i",
    й: "y",
    к: "k",
    л: "l",
    м: "m",
    н: "n",
    о: "o",
    п: "p",
    р: "r",
    с: "s",
    т: "t",
    у: "u",
    ф: "f",
    х: "h",
    ц: "ts",
    ч: "ch",
    ш: "sh",
    щ: "sch",
    ъ: "",
    ы: "y",
    ь: "",
    э: "e",
    ю: "yu",
    я: "ya"
  });

  function normalizePlaceSlugBase(value) {
    const text = normalizeText(value, "");
    if (!text) {
      return "";
    }

    const transliterated = Array.from(
      text
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, ""),
      (char) => CYRILLIC_SLUG_CHAR_MAP[char] ?? char
    ).join("");

    return transliterated
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-{2,}/g, "-")
      .slice(0, 72);
  }

  function appendPlaceSlugSuffix(baseSlug, suffix) {
    const safeSuffix = normalizeText(suffix, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 12);
    const fallbackBase = normalizeText(baseSlug, "").replace(/^-+|-+$/g, "") || "place";
    if (!safeSuffix) {
      return fallbackBase;
    }

    const maxBaseLength = Math.max(12, 95 - safeSuffix.length);
    const trimmedBase = fallbackBase
      .slice(0, maxBaseLength)
      .replace(/-+$/g, "") || "place";
    return `${trimmedBase}-${safeSuffix}`;
  }

  function buildClientPlaceSlug(value, options = {}) {
    const baseSlug = normalizePlaceSlugBase(value);
    const alwaysUnique = options.alwaysUnique === true;
    if (baseSlug && !alwaysUnique) {
      return baseSlug;
    }

    const lat = Number(options.lat);
    const lng = Number(options.lng ?? options.lon);
    const coordinateToken = Number.isFinite(lat) && Number.isFinite(lng)
      ? `${Math.round((lat + 90) * 100)}${Math.round((lng + 180) * 100)}`
      : "";
    const timestampToken = Math.abs(Math.floor(Number(options.timestamp) || Date.now())).toString(36);
    const suffix = `${coordinateToken}${timestampToken}`.slice(-10) || Math.random().toString(36).slice(2, 10);

    return appendPlaceSlugSuffix(baseSlug || "place", suffix);
  }

  function resolveSeedDetailsForPlace(place) {
    if (!place || typeof place !== "object") {
      return null;
    }

    const byId = SeedPlaceDetailIndex.byId;
    const byNameKey = SeedPlaceDetailIndex.byNameKey;
    const seedPoints = SeedPlaceDetailIndex.points;

    const placeId = normalizeText(place.id, "");
    if (placeId && byId.has(placeId)) {
      return byId.get(placeId);
    }

    const nameCandidates = [
      place.name,
      place.title
    ];
    for (const candidate of nameCandidates) {
      const lookupKey = normalizePlaceLookupKey(candidate);
      if (lookupKey && byNameKey.has(lookupKey)) {
        return byNameKey.get(lookupKey);
      }
    }

    const lat = Number(place.lat);
    const lon = Number(place.lon ?? place.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return null;
    }

    let nearestDetails = null;
    let nearestDistanceMeters = Number.POSITIVE_INFINITY;
    for (const point of seedPoints) {
      const distanceMeters = haversineDistanceMeters(lat, lon, point.lat, point.lon);
      if (!Number.isFinite(distanceMeters)) {
        continue;
      }

      if (distanceMeters < nearestDistanceMeters) {
        nearestDistanceMeters = distanceMeters;
        nearestDetails = point.details;
      }
    }

    if (nearestDistanceMeters <= 40_000) {
      return nearestDetails;
    }

    return null;
  }

  function enrichPlaceWithSeedDetails(place) {
    if (!place || typeof place !== "object") {
      return place;
    }

    const details = resolveSeedDetailsForPlace(place);
    if (!details) {
      return place;
    }

    const enriched = { ...place };

    const textFields = [
      "country",
      "countryCode",
      "timezone",
      "utcOffset",
      "currency",
      "languages",
      "climate",
      "founded",
      "funFact"
    ];

    for (const field of textFields) {
      if (normalizeText(enriched[field], "") !== "") {
        continue;
      }

      const nextValue = normalizeText(details[field], "");
      if (nextValue !== "") {
        enriched[field] = nextValue;
      }
    }

    if (!Number.isFinite(Number(enriched.population)) || Number(enriched.population) <= 0) {
      const population = Number(details.population);
      if (Number.isFinite(population) && population > 0) {
        enriched.population = population;
      }
    }

    if (
      !Number.isFinite(Number(enriched.areaKm2 ?? enriched.area_km2)) ||
      Number(enriched.areaKm2 ?? enriched.area_km2) <= 0
    ) {
      const areaKm2 = Number(details.areaKm2 ?? details.area_km2);
      if (Number.isFinite(areaKm2) && areaKm2 > 0) {
        enriched.areaKm2 = areaKm2;
      }
    }

    if (
      (!Array.isArray(enriched.highlights) || enriched.highlights.length === 0) &&
      Array.isArray(details.highlights)
    ) {
      enriched.highlights = details.highlights
        .map((entry) => normalizeText(entry, ""))
        .filter(Boolean)
        .slice(0, 6);
    }

    return enriched;
  }

  const Elements = getRequiredElements();
  const ApiClient = createApiClient(Config.API_BASE);
  const UrlState = createUrlState();
  const FavoritesStore = createFavoritesStore(Config.FAVORITES_STORAGE_KEY);
  const PlaceFeedbackStore = createPlaceFeedbackStore(Config.PLACE_FEEDBACK_STORAGE_KEY);

  let mapEngine = null;
  let popupController = null;
  let sidebarController = null;
  let nearMeController = null;
  let addPlaceController = null;
  let routeController = null;
  let onboardingController = null;
  let mapZoomSliderController = null;
  let addPlaceAuthProbeToken = 0;
  let leafletRightControlsMeasureRafId = 0;
  let leafletControlsSafeAreaMutationObserver = null;
  let leafletControlsSafeAreaResizeObserver = null;

  function queueLeafletRightControlsMeasure() {
    if (leafletRightControlsMeasureRafId) {
      window.cancelAnimationFrame(leafletRightControlsMeasureRafId);
    }
    leafletRightControlsMeasureRafId = window.requestAnimationFrame(() => {
      leafletRightControlsMeasureRafId = 0;
      syncLeafletRightControlsWidth();
    });
  }

  function collectLeafletControlsSafeAreaWatchTargets() {
    const targets = [];
    const seen = new Set();
    const addTarget = (element, options) => {
      if (!(element instanceof HTMLElement) || seen.has(element)) {
        return;
      }
      seen.add(element);
      targets.push({ element, options });
    };

    addTarget(document.body, {
      attributes: true,
      attributeFilter: ["class", "style"]
    });
    addTarget(document.getElementById("travel-hub"), {
      attributes: true,
      attributeFilter: ["class", "style", "hidden", "aria-hidden"]
    });
    addTarget(document.getElementById("admin-drawer"), {
      attributes: true,
      attributeFilter: ["class", "style", "hidden", "aria-hidden", "open"]
    });
    addTarget(document.querySelector(".leaflet-control-container"), {
      attributes: true,
      attributeFilter: ["class", "style", "hidden"],
      childList: true,
      subtree: true
    });
    for (const element of document.querySelectorAll(".leaflet-right, .leaflet-control-zoom")) {
      addTarget(element, {
        attributes: true,
        attributeFilter: ["class", "style", "hidden"],
        childList: true,
        subtree: true
      });
    }
    addTarget(Elements.mapZoomSlider, {
      attributes: true,
      attributeFilter: ["class", "style", "hidden", "aria-hidden"]
    });

    return targets;
  }

  function installLeafletControlsSafeAreaWatchers() {
    const watchTargets = collectLeafletControlsSafeAreaWatchTargets();
    if (typeof MutationObserver === "function") {
      if (!leafletControlsSafeAreaMutationObserver) {
        leafletControlsSafeAreaMutationObserver = new MutationObserver(() => {
          queueLeafletRightControlsMeasure();
        });
      } else {
        leafletControlsSafeAreaMutationObserver.disconnect();
      }
      for (const target of watchTargets) {
        leafletControlsSafeAreaMutationObserver.observe(target.element, target.options);
      }
    }

    if (typeof ResizeObserver === "function") {
      if (!leafletControlsSafeAreaResizeObserver) {
        leafletControlsSafeAreaResizeObserver = new ResizeObserver(() => {
          queueLeafletRightControlsMeasure();
        });
      }
      leafletControlsSafeAreaResizeObserver.disconnect();
      for (const target of watchTargets) {
        if (target.element === document.body) {
          continue;
        }
        leafletControlsSafeAreaResizeObserver.observe(target.element);
      }
    }
  }

  function syncLeafletRightControlsWidth() {
    const docEl = document.documentElement;
    if (!(docEl instanceof HTMLElement)) {
      return;
    }

    const viewportWidth = Math.max(
      0,
      Number(window.innerWidth) || Number(docEl.clientWidth) || 0
    );
    if (viewportWidth <= 0) {
      return;
    }

    const computedStyles = window.getComputedStyle(docEl);
    const fallbackWidthPx = Number.parseFloat(
      computedStyles.getPropertyValue("--leaflet-right-controls-w")
    );
    const safeFallbackWidthPx = Number.isFinite(fallbackWidthPx) && fallbackWidthPx > 0
      ? fallbackWidthPx
      : 72;
    const configuredSafeGapPx = Number.parseFloat(
      computedStyles.getPropertyValue("--leaflet-controls-safe-gap")
    );
    const legacySafeGapPx = Number.parseFloat(
      computedStyles.getPropertyValue("--leaflet-right-controls-gap")
    );
    const rawSafeGapPx = Number.isFinite(configuredSafeGapPx) && configuredSafeGapPx > 0
      ? configuredSafeGapPx
      : (
        Number.isFinite(legacySafeGapPx) && legacySafeGapPx > 0
          ? legacySafeGapPx
          : 14
      );
    const safeGapPx = Math.min(16, Math.max(12, rawSafeGapPx));

    const measureRightControlBox = (element) => {
      if (!(element instanceof HTMLElement)) {
        return 0;
      }
      if (element.hidden) {
        return 0;
      }
      const styles = window.getComputedStyle(element);
      if (styles.display === "none" || styles.visibility === "hidden") {
        return 0;
      }
      const rect = element.getBoundingClientRect();
      if (
        !Number.isFinite(rect.right) ||
        !Number.isFinite(rect.width) ||
        !Number.isFinite(rect.height) ||
        rect.width <= 0 ||
        rect.height <= 0
      ) {
        return 0;
      }
      const rightOffsetPx = Math.max(0, viewportWidth - rect.right);
      return Math.max(0, rect.width + rightOffsetPx);
    };

    const measuredLeafletRightControls = Array.from(
      document.querySelectorAll(".leaflet-right, .leaflet-control-zoom")
    ).map((element) => measureRightControlBox(element));
    const measuredRightControlsWidthPx = Math.max(
      measureRightControlBox(Elements.mapZoomSlider),
      ...(measuredLeafletRightControls.length > 0 ? measuredLeafletRightControls : [0])
    );
    const resolvedControlsWidthPx = measuredRightControlsWidthPx > 0
      ? measuredRightControlsWidthPx
      : safeFallbackWidthPx;
    const resolvedSafeWidthPx = Math.max(0, resolvedControlsWidthPx + safeGapPx);
    const nextWidthValue = `${Math.round(resolvedControlsWidthPx)}px`;
    const nextSafeWidthValue = `${Math.round(resolvedSafeWidthPx)}px`;
    const currentWidthValue = docEl.style.getPropertyValue("--leaflet-right-controls-w");
    const currentSafeWidthValue = docEl.style.getPropertyValue("--leaflet-controls-safe-w");

    if (currentWidthValue === nextWidthValue && currentSafeWidthValue === nextSafeWidthValue) {
      return;
    }
    if (currentWidthValue !== nextWidthValue) {
      docEl.style.setProperty("--leaflet-right-controls-w", nextWidthValue);
    }
    if (currentSafeWidthValue !== nextSafeWidthValue) {
      docEl.style.setProperty("--leaflet-controls-safe-w", nextSafeWidthValue);
    }
  }

  applyAddPlaceToggleAvailability(Runtime.addPlaceAccessState, { animate: false });
  applyUserBanUiState({
    userId: "",
    isBanned: false
  });
  installFavoritesBridge();
  installLeafletControlsSafeAreaWatchers();
  queueLeafletRightControlsMeasure();
  window.addEventListener("resize", queueLeafletRightControlsMeasure, { passive: true });
  window.addEventListener("load", queueLeafletRightControlsMeasure, { once: true });
  window.addEventListener("wa:map-ready", () => {
    installLeafletControlsSafeAreaWatchers();
    queueLeafletRightControlsMeasure();
  });
  window.addEventListener("worldatlas:ready", () => {
    installLeafletControlsSafeAreaWatchers();
    queueLeafletRightControlsMeasure();
  });
  void bootstrap();

  async function bootstrap() {
    if (Runtime.isBootstrapping) {
      return;
    }

    Runtime.isBootstrapping = true;
    window.__WORLD_ATLAS_APP_READY__ = false;
    window.__WORLD_ATLAS_APP_BOOT_ERROR__ = "";

    try {
      await ensureMapModuleLoaded();
      const createPlacePopupApi = await loadPopupApiFactory();

      const initialUrlState = UrlState.read();
      State.searchQuery = initialUrlState.searchQuery;
      State.regionFilter = initialUrlState.regionFilter;
      State.favoritePlaceIds = FavoritesStore.read();

      mapEngine = createMapEngine({
        mapElement: Elements.mapRoot,
        onSelectPlace: (placeId, interaction = {}) => {
          const interactionSource =
            typeof interaction?.source === "string" && interaction.source.trim() !== ""
              ? interaction.source.trim().toLowerCase()
              : "map-marker";
          selectPlace(placeId, {
            panToPlace: true,
            openPopup: true,
            updateUrl: true,
            source: interactionSource
          });
        },
        onHoverPlace: (placeId) => {
          setHoveredPlace(placeId);
        },
        onViewChange: (nextView) => {
          State.mapView = nextView;
          if (mapZoomSliderController && typeof mapZoomSliderController.syncFromView === "function") {
            mapZoomSliderController.syncFromView(nextView);
          }
          scheduleUrlSync();
        },
        onTileError: () => {
          setStatus(
            "Часть тайлов карты временно недоступна. Попробуйте обновить страницу.",
            { type: "error", timeoutMs: Config.STATUS_CLEAR_MS }
          );
        }
      });

      mapEngine.init(initialUrlState.mapView || Config.DEFAULT_VIEW);
      mapZoomSliderController = createMapZoomSliderController({
        rootEl: Elements.mapZoomSlider,
        rangeEl: Elements.mapZoomRange,
        zoomInButtonEl: Elements.mapZoomInButton,
        zoomOutButtonEl: Elements.mapZoomOutButton,
        mapEngine,
        minZoom: Config.MIN_ZOOM,
        maxZoom: Config.MAX_ZOOM
      });
      queueLeafletRightControlsMeasure();
      window.requestAnimationFrame(() => {
        queueLeafletRightControlsMeasure();
      });
      setMapMarkersVisibility(true, { animateLabel: false });

      popupController = createPlacePopupApi({
        backdropEl: Elements.popupBackdrop,
        popupEl: Elements.popupCard,
        closeButtonEl: Elements.popupClose,
        contentEl: Elements.popupContent,
        loadingStateEl: Elements.popupLoading,
        errorStateEl: Elements.popupError,
        errorMessageEl: Elements.popupErrorMessage,
        retryButtonEl: Elements.popupRetry,
        mediaEl: Elements.popupMedia,
        mediaSkeletonEl: Elements.popupMediaSkeleton,
        mediaErrorEl: Elements.popupMediaError,
        imageEl: Elements.popupImage,
        regionLineEl: Elements.popupRegionLine,
        countryEl: Elements.popupCountry,
        titleEl: Elements.popupTitle,
        trustSignalsEl: Elements.popupTrustSignals,
        descriptionEl: Elements.popupDescription,
        seasonSectionEl: Elements.popupSeasonSection,
        seasonStatusEl: Elements.popupSeasonStatus,
        seasonTabsEl: Elements.popupSeasonTabs,
        seasonCopyEl: Elements.popupSeasonCopy,
        summaryListEl: Elements.popupSummary,
        highlightsEl: Elements.popupHighlights,
        factEl: Elements.popupFact,
        coordinatesEl: Elements.popupCoordinates,
        routeFromButtonEl: Elements.popupRouteFromButton,
        favoriteToggleButtonEl: Elements.popupFavoriteButton,
        shareButtonEl: Elements.popupShareButton,
        deleteButtonEl: Elements.popupDeletePlaceButton,
        navigationEl: Elements.popupNavigation,
        previousPlaceButtonEl: Elements.popupPreviousPlaceButton,
        nextPlaceButtonEl: Elements.popupNextPlaceButton,
        statusWantButtonEl: Elements.popupStatusWantButton,
        statusVisitedButtonEl: Elements.popupStatusVisitedButton,
        ratingStarsEl: Elements.popupRatingStars,
        reviewCommentEl: Elements.popupReviewComment,
        reviewSaveButtonEl: Elements.popupReviewSaveButton,
        feedbackAuthHintEl: Elements.popupFeedbackAuthHint,
        communityAverageEl: Elements.popupCommunityAverage,
        communityCountEl: Elements.popupCommunityCount,
        communityReviewsEl: Elements.popupCommunityReviews,
        sourcesEl: Elements.popupSources,
        sourcesInfoEl: Elements.popupSourcesInfo,
        updatedEl: Elements.popupUpdated,
        linkRowEl: Elements.popupLinkRow,
        linkEl: Elements.popupLink,
        weatherSectionEl: Elements.popupWeatherSection,
        weatherStatusEl: Elements.popupWeatherStatus,
        weatherIconEl: Elements.popupWeatherIcon,
        weatherTempEl: Elements.popupWeatherTemp,
        weatherConditionEl: Elements.popupWeatherCondition,
        weatherLocalEl: Elements.popupWeatherLocal,
        weatherMetaEl: Elements.popupWeatherMeta,
        weatherUpdatedEl: Elements.popupWeatherUpdated,
        subscribeToMapMotion: mapEngine.subscribeToMotion,
        onVisibilityChange: setTopToolbarPopupState,
        onRouteFromPlace: handlePopupRouteFrom,
        onToggleFavorite: toggleFavoritePlace,
        isFavoritePlace,
        getCurrentUserId: resolveCurrentUserId,
        isAuthenticated: async () => Boolean(await resolveCurrentUserId()),
        onFavoritesChanged: () => {
          applyFilters({ updateUrl: false, preserveSelection: true });
        },
        onSharePlace: sharePlace,
        canDeletePlace,
        onDeletePlace: handlePopupDeletePlace,
        getAdjacentPlaces: resolvePopupAdjacentPlaces,
        onNavigatePlace: handlePopupNavigatePlace,
        onClose: handlePopupClose,
        onLoadPlaceFacts: async (place) => {
          const placeRef = normalizeText(place?.id, "") || normalizeText(place?.slug, "");
          if (!placeRef) {
            return null;
          }
          return ApiClient.getPlace(placeRef, { scope: resolvePlaceScope(place) });
        },
        onLoadPlaceWeather: async (place) => {
          return ApiClient.getPlaceWeather(place);
        },
        config: Config,
        placeFeedbackStore: PlaceFeedbackStore,
        helpers: {
          isValidPlace,
          normalizeText,
          clamp,
          round,
          formatCoordinates,
          normalizeHttpUrl,
          buildPlaceDetails,
          normalizePlaceFacts,
          formatCountryLine,
          formatCompactPopulation,
          formatArea,
          resolvePlaceSources,
          getPlaceImageUrl,
          getPopupImageCandidates,
          normalizeSeasonKey,
          formatSeasonLabel,
          normalizeSeasonalContentValue,
          buildPlaceSeasonView,
          resolveCurrentSeasonKey,
          normalizeFeedbackStatus,
          normalizeFeedbackRating,
          normalizeFeedbackCommentDraft,
          normalizeFeedbackComment,
          buildStarsString,
          formatReviewDate,
          setStatus,
          showToast
        }
      });

      sidebarController = createSidebarController({
        listElement: Elements.pointsList,
        emptyElement: Elements.listEmpty,
        searchInput: Elements.searchInput,
        regionFilter: Elements.regionFilter,
        favoritesFilterButton: Elements.favoritesFilterButton,
        smartFiltersOpenButton: Elements.smartFiltersOpenButton,
        smartFiltersBackdrop: Elements.smartFiltersBackdrop,
        smartFiltersPanel: Elements.smartFiltersPanel,
        smartFiltersCloseButton: Elements.smartFiltersCloseButton,
        smartCategoryFilter: Elements.smartCategoryFilter,
        smartTagInput: Elements.smartTagInput,
        smartTagAddButton: Elements.smartTagAddButton,
        smartTagsChips: Elements.smartTagsChips,
        smartOnlyFreeButton: Elements.smartOnlyFreeButton,
        smartFamilyFriendlyButton: Elements.smartFamilyFriendlyButton,
        smartSortFilter: Elements.smartSortFilter,
        smartFiltersApplyButton: Elements.smartFiltersApplyButton,
        smartFiltersResetButton: Elements.smartFiltersResetButton,
        totalCounter: Elements.pointsTotal,
        visibleCounter: Elements.pointsVisible,
        sidebarElement: Elements.sidebarPanel,
        revealButton: Elements.sidebarRevealButton,
        onSelectPlace: (placeId) => {
          selectPlace(placeId, {
            panToPlace: true,
            openPopup: true,
            updateUrl: true,
            source: "sidebar-list"
          });
        },
        onHoverPlace: (placeId) => {
          setHoveredPlace(placeId);
        },
        onSearchChange: (value) => {
          State.searchQuery = value;
          applyFilters({ updateUrl: true, preserveSelection: true });
        },
        onRegionChange: (value) => {
          State.regionFilter = value;
          applyFilters({ updateUrl: true, preserveSelection: true });
        },
        onFavoritesToggle: (enabled) => {
          State.favoritesOnly = Boolean(enabled);
          applyFilters({ updateUrl: true, preserveSelection: true });
        },
        onSmartApply: (filters) => {
          State.smartFilters = normalizeSmartFiltersState(filters);
          applyFilters({ updateUrl: true, preserveSelection: true });
        },
        onClearFilters: () => {
          State.searchQuery = "";
          State.regionFilter = "all";
          State.favoritesOnly = false;
          State.smartFilters = { ...DefaultSmartFilters };
          sidebarController.setFilterValues(
            State.searchQuery,
            State.regionFilter,
            State.favoritesOnly,
            State.smartFilters
          );
          applyFilters({ updateUrl: true, preserveSelection: true });
          setStatus("Фильтры сброшены.", {
            type: "success",
            timeoutMs: 1600
          });
        }
      });

      sidebarController.setFilterValues(
        State.searchQuery,
        State.regionFilter,
        State.favoritesOnly,
        State.smartFilters
      );

      nearMeController = createNearMeController({
        toggleButtonEl: Elements.nearMeToggleButton,
        panelEl: Elements.nearMePanel,
        closeButtonEl: Elements.nearMeCloseButton,
        statusEl: Elements.nearMeStatus,
        coordsEl: Elements.nearMeCoords,
        listEl: Elements.nearMeList,
        getPlaces: () => (
          Array.isArray(State.filteredPlaces) && State.filteredPlaces.length > 0
            ? State.filteredPlaces
            : State.allPlaces
        ),
        mapEngine,
        onSelectPlace: (placeId) => {
          selectPlace(placeId, {
            panToPlace: true,
            openPopup: true,
            updateUrl: true,
            source: "near-me-list"
          });
        },
        onHoverPlace: (placeId) => {
          setHoveredPlace(placeId);
        },
        setStatus
      });

      addPlaceController = createAddPlaceController({
        controlsEl: Elements.addPlaceControls,
        publicToggleButtonEl: Elements.addPlacePublicToggleButton,
        myToggleButtonEl: Elements.addPlaceMyToggleButton,
        mapRootEl: Elements.mapRoot,
        bannerEl: Elements.addPlaceBanner,
        bannerTextEl: Elements.addPlaceBannerText,
        bannerCancelButtonEl: Elements.addPlaceBannerCancelButton,
        drawerEl: Elements.addPlaceDrawer,
        drawerCloseButtonEl: Elements.addPlaceCloseButton,
        statusEl: Elements.addPlaceStatus,
        coordsEl: Elements.addPlaceCoords,
        modeBadgeEl: Elements.addPlaceModeBadge,
        formEl: Elements.addPlaceForm,
        nameInputEl: Elements.addPlaceNameInput,
        descriptionInputEl: Elements.addPlaceDescriptionInput,
        photoInputEl: Elements.addPlacePhotoInput,
        photoClearButtonEl: Elements.addPlacePhotoClearButton,
        photoPreviewEl: Elements.addPlacePhotoPreview,
        photoPreviewImageEl: Elements.addPlacePhotoPreviewImage,
        photoMetaEl: Elements.addPlacePhotoMeta,
        photoAuthHintEl: Elements.addPlacePhotoAuthHint,
        categorySelectEl: Elements.addPlaceCategorySelect,
        tagInputEl: Elements.addPlaceTagInput,
        tagAddButtonEl: Elements.addPlaceTagAddButton,
        tagsWrapEl: Elements.addPlaceTagsWrap,
        priceSelectEl: Elements.addPlacePriceSelect,
        freeCheckboxEl: Elements.addPlaceFreeCheckbox,
        familyCheckboxEl: Elements.addPlaceFamilyCheckbox,
        visibilitySectionEl: Elements.addPlaceVisibilitySection,
        visibilityPrivateButtonEl: Elements.addPlaceVisibilityPrivateButton,
        visibilityPublicButtonEl: Elements.addPlaceVisibilityPublicButton,
        visibilityReviewButtonEl: Elements.addPlaceVisibilityReviewButton,
        scheduleWrapEl: Elements.addPlaceScheduleWrap,
        scheduleEnabledInputEl: Elements.addPlaceScheduleEnabled,
        scheduleAtInputEl: Elements.addPlaceScheduleAt,
        scheduleHintEl: Elements.addPlaceScheduleHint,
        seasonalSectionEl: Elements.addPlaceSeasonalSection,
        seasonalEnabledInputEl: Elements.addPlaceSeasonalEnabled,
        seasonalHintEl: Elements.addPlaceSeasonalHint,
        seasonalCardsEl: Elements.addPlaceSeasonalCards,
        cancelButtonEl: Elements.addPlaceCancelButton,
        submitButtonEl: Elements.addPlaceSubmitButton,
        mapEngine,
        apiClient: ApiClient,
        getAccessState: () => Runtime.addPlaceAccessState,
        setStatus,
        showToast,
        onPlaceCreated: (place) => {
          upsertPlaceInState(place);
          refreshDerivedUiFromPlaces();
          applyFilters({ updateUrl: false, preserveSelection: true });
          selectPlace(place.id, {
            panToPlace: true,
            openPopup: true,
            updateUrl: true,
            source: "add-place"
          });
        }
      });
      void syncAddPlaceToggleAvailability(null, { animate: false });

      routeController = createAdvancedRouteController({
        startPlaceSelect: Elements.routeStartPlaceSelect,
        endPlaceSelect: Elements.routeEndPlaceSelect,
        modeSelect: Elements.routeModeSelect,
        addWaypointButton: Elements.routeAddWaypointButton,
        extraPointsWrap: Elements.routeExtraPointsWrap,
        orderListElement: Elements.routeOrderList,
        startPickButton: Elements.routeStartPickButton,
        endPickButton: Elements.routeEndPickButton,
        startMyLocationButton: Elements.routeStartMyLocationButton,
        startCustomWrap: Elements.routeStartCustomWrap,
        endCustomWrap: Elements.routeEndCustomWrap,
        startLatInput: Elements.routeStartLatInput,
        startLonInput: Elements.routeStartLonInput,
        endLatInput: Elements.routeEndLatInput,
        endLonInput: Elements.routeEndLonInput,
        buildButton: Elements.routeBuildButton,
        clearButton: Elements.routeClearButton,
        inlineStatusElement: Elements.routeInlineStatus,
        inlineStatusTextElement: Elements.routeInlineStatusText,
        inlineStatusSpinnerElement: Elements.routeInlineStatusSpinner,
        distanceValueElement: Elements.routeDistanceValue,
        durationValueElement: Elements.routeDurationValue,
        typeValueElement: Elements.routeTypeValue,
        providerValueElement: Elements.routeProviderValue,
        segmentsListElement: Elements.routeSegmentsList,
        mapEngine,
        setStatus,
        showToast,
        onMetricsChange: (metrics) => {
          emitUiEvent("worldatlas:route-metrics-updated", metrics);
        }
      });

      registerGlobalUiEvents();
      registerTravelHubModeBridge();
      installConsoleTools();
      await syncUserBanState();

      const { places, regionsMeta, source } = await loadPlacesAndMeta();
      State.allPlaces = places;

      const derivedRegions = normalizeRegionsMeta(regionsMeta, places);
      sidebarController.renderRegionOptions(derivedRegions, State.regionFilter);
      sidebarController.renderCategoryOptions(deriveCategoryOptions(places), State.smartFilters.category);

      if (!derivedRegions.some((entry) => entry.value === State.regionFilter)) {
        State.regionFilter = "all";
        sidebarController.setFilterValues(
          State.searchQuery,
          State.regionFilter,
          State.favoritesOnly,
          State.smartFilters
        );
      }

      routeController.setPlaces(places);
      await refreshFavoritesForCurrentSession({ preserveSelection: false });

      applyFilters({ updateUrl: false, preserveSelection: false });
      Runtime.placesReloadLastAt = Date.now();
      startPlacesBackgroundSync();

      onboardingController = createOnboardingController({
        overlayEl: Elements.onboardingOverlay,
        panelEl: Elements.onboardingPanel,
        stepEl: Elements.onboardingStep,
        titleEl: Elements.onboardingTitle,
        textEl: Elements.onboardingText,
        nextButtonEl: Elements.onboardingNextButton,
        skipButtonEl: Elements.onboardingSkipButton,
        neverCheckboxEl: Elements.onboardingNeverCheckbox,
        routePanelEl: Elements.routePanelRoot,
        routeBuildButtonEl: Elements.routeBuildButton,
        popupCardEl: Elements.popupCard,
        popupSummaryEl: Elements.popupSummary,
        popupActionsEl: Elements.popupActions,
        storageKey: Config.ONBOARDING_STORAGE_KEY,
        getPlaces: () => State.allPlaces,
        mapEngine,
        popupController,
        sidebarController,
        selectPlaceById: (placeId) => {
          return selectPlace(placeId, {
            panToPlace: false,
            openPopup: true,
            updateUrl: false,
            source: "onboarding"
          });
        },
        setStatus
      });

      if (initialUrlState.selectedPlaceId) {
        const selectionOk = selectPlace(initialUrlState.selectedPlaceId, {
          panToPlace: false,
          openPopup: true,
          updateUrl: false
        });

        if (!selectionOk) {
          setStatus("Точка из URL не найдена в текущем наборе данных.", {
            type: "error",
            timeoutMs: Config.STATUS_CLEAR_MS
          });
        }
      }

      mapEngine.invalidateSize();
      State.mapView = mapEngine.getView();
      scheduleUrlSync();

      if (source === "api") {
        setStatus("Данные точек загружены с API.", {
          type: "success",
          timeoutMs: 1500
        });
      } else if (source === "api+seed" || source === "local-seed") {
        setStatus("Загружены локальные точки и фото (fallback).", {
          type: "success",
          timeoutMs: Config.STATUS_CLEAR_MS
        });
      }

      window.setTimeout(() => {
        if (onboardingController) {
          onboardingController.maybeStart();
        }
      }, Config.ONBOARDING_START_DELAY_MS);

      window.__WORLD_ATLAS_APP_READY__ = true;
      window.__WORLD_ATLAS_APP_BOOT_ERROR__ = "";
      window.dispatchEvent(new Event("worldatlas:ready"));
    } catch (error) {
      console.error(error);
      setStatus(
        "Критическая ошибка инициализации. Проверьте консоль разработчика.",
        { type: "error" }
      );

      const bootErrorMessage = normalizeText(error?.message, "App bootstrap failed.");
      window.__WORLD_ATLAS_APP_READY__ = false;
      window.__WORLD_ATLAS_APP_BOOT_ERROR__ = bootErrorMessage;
      try {
        window.dispatchEvent(new CustomEvent("worldatlas:boot-error", {
          detail: { message: bootErrorMessage }
        }));
      } catch (_) {
        window.dispatchEvent(new Event("worldatlas:boot-error"));
      }
    } finally {
      Runtime.isBootstrapping = false;
    }
  }

  function installConsoleTools() {
    const runImport = async (options = {}) => {
      try {
        const result = await ApiClient.importPlacesFromJson(options);
        await reloadPlacesStateAfterImport();

        const importedCount = Number(result?.inserted || 0);
        const preparedCount = Number(result?.prepared || 0);
        const statusMessage = `Импорт завершён: ${importedCount}/${preparedCount} точек добавлено.`;
        setStatus(statusMessage, {
          type: "success",
          timeoutMs: Config.STATUS_CLEAR_MS
        });
        showToast("Импорт точек завершён.");
        return result;
      } catch (error) {
        const errorMessage = normalizeText(error?.message, "Импорт точек не выполнен.");
        setStatus(errorMessage, {
          type: "error",
          timeoutMs: Config.STATUS_CLEAR_MS
        });
        throw error;
      }
    };

    window.importPlacesFromJson = runImport;

    const previousTools =
      window.WorldAtlasProTools && typeof window.WorldAtlasProTools === "object"
        ? window.WorldAtlasProTools
        : {};
    window.WorldAtlasProTools = Object.freeze({
      ...previousTools,
      importPlacesFromJson: runImport,
      reloadPlacesState: (options = {}) => reloadPlacesStateAfterImport(options)
    });
  }

  async function reloadPlacesStateAfterImport(options = {}) {
    const {
      updateUrl = true,
      allowFallback = true
    } = options;

    if (Runtime.placesReloadPromise) {
      return Runtime.placesReloadPromise;
    }

    const reloadTask = (async () => {
      const selectedPlaceId = State.selectedPlaceId;
      const { places, regionsMeta } = await loadPlacesAndMeta({ allowFallback });
      State.allPlaces = places;

      const derivedRegions = normalizeRegionsMeta(regionsMeta, places);
      sidebarController.renderRegionOptions(derivedRegions, State.regionFilter);
      sidebarController.renderCategoryOptions(deriveCategoryOptions(places), State.smartFilters.category);

      if (!derivedRegions.some((entry) => entry.value === State.regionFilter)) {
        State.regionFilter = "all";
        sidebarController.setFilterValues(
          State.searchQuery,
          State.regionFilter,
          State.favoritesOnly,
          State.smartFilters
        );
      }

      routeController.setPlaces(places);
      await refreshFavoritesForCurrentSession({ preserveSelection: true });
      applyFilters({ updateUrl, preserveSelection: true });

      if (
        selectedPlaceId &&
        State.allPlaces.some((entry) => entry.id === selectedPlaceId)
      ) {
        selectPlace(selectedPlaceId, {
          panToPlace: false,
          openPopup: false,
          updateUrl: false
        });
      }

      Runtime.placesReloadLastAt = Date.now();
    })();

    Runtime.placesReloadPromise = reloadTask.finally(() => {
      Runtime.placesReloadPromise = null;
    });

    return Runtime.placesReloadPromise;
  }

  function startPlacesBackgroundSync() {
    const syncPlaces = async (reason = "interval", options = {}) => {
      const {
        force = false
      } = options;
      if (Runtime.isBootstrapping || document.visibilityState === "hidden") {
        return false;
      }
      if (Runtime.placesReloadPromise) {
        return Runtime.placesReloadPromise;
      }

      const now = Date.now();
      if (
        !force &&
        Runtime.placesReloadLastAt > 0 &&
        now - Runtime.placesReloadLastAt < Config.PLACES_SYNC_MIN_GAP_MS
      ) {
        return false;
      }

      try {
        await reloadPlacesStateAfterImport({
          updateUrl: false,
          allowFallback: false
        });
        return true;
      } catch (error) {
        console.warn(`[places-sync] ${reason} refresh skipped:`, error);
        return false;
      }
    };

    const intervalId = window.setInterval(() => {
      void syncPlaces("interval");
    }, Config.PLACES_SYNC_INTERVAL_MS);

    const focusHandler = () => {
      void syncPlaces("focus");
    };
    const visibilityHandler = () => {
      if (document.visibilityState === "visible") {
        void syncPlaces("visibility");
      }
    };

    window.addEventListener("focus", focusHandler, { passive: true });
    document.addEventListener("visibilitychange", visibilityHandler);

    Runtime.cleanupFns.push(() => window.clearInterval(intervalId));
    Runtime.cleanupFns.push(() => window.removeEventListener("focus", focusHandler));
    Runtime.cleanupFns.push(() => document.removeEventListener("visibilitychange", visibilityHandler));
  }

  function refreshDerivedUiFromPlaces() {
    const places = Array.isArray(State.allPlaces) ? State.allPlaces : [];
    const derivedRegions = deriveRegionsMeta(places);
    sidebarController.renderRegionOptions(derivedRegions, State.regionFilter);
    sidebarController.renderCategoryOptions(
      deriveCategoryOptions(places),
      State.smartFilters.category
    );

    if (!derivedRegions.some((entry) => entry.value === State.regionFilter)) {
      State.regionFilter = "all";
      sidebarController.setFilterValues(
        State.searchQuery,
        State.regionFilter,
        State.favoritesOnly,
        State.smartFilters
      );
    }

    routeController.setPlaces(places);
    emitPlacesUpdated();
  }

  function upsertPlaceInState(place) {
    if (!isValidPlace(place)) {
      return false;
    }

    const existingIndex = State.allPlaces.findIndex((entry) => entry.id === place.id);
    if (existingIndex >= 0) {
      State.allPlaces[existingIndex] = place;
      return true;
    }

    State.allPlaces.push(place);
    return true;
  }

  function removePlaceFromState(placeId) {
    const normalizedPlaceId = normalizeText(placeId, "");
    if (!normalizedPlaceId) {
      return null;
    }

    const index = State.allPlaces.findIndex((entry) => entry.id === normalizedPlaceId);
    if (index < 0) {
      return null;
    }

    const [removed] = State.allPlaces.splice(index, 1);
    if (State.selectedPlaceId === normalizedPlaceId) {
      State.selectedPlaceId = null;
    }
    if (State.hoveredPlaceId === normalizedPlaceId) {
      State.hoveredPlaceId = null;
    }

    return removed || null;
  }

  function removePlaceFromStateByReference(placeRef) {
    const normalizedRef = normalizeText(placeRef, "").toLowerCase();
    if (!normalizedRef) {
      return null;
    }

    const index = State.allPlaces.findIndex((entry) => {
      const entryId = normalizeText(entry?.id, "").toLowerCase();
      const entrySlug = normalizeText(entry?.slug, "").toLowerCase();
      return entryId === normalizedRef || entrySlug === normalizedRef;
    });

    if (index < 0) {
      return null;
    }

    const [removed] = State.allPlaces.splice(index, 1);
    const removedId = normalizeText(removed?.id, "");
    if (removedId && State.selectedPlaceId === removedId) {
      State.selectedPlaceId = null;
    }
    if (removedId && State.hoveredPlaceId === removedId) {
      State.hoveredPlaceId = null;
    }

    return removed || null;
  }

  function emitUiEvent(eventName, detail = {}) {
    const name = normalizeText(eventName, "");
    if (!name) {
      return false;
    }

    try {
      window.dispatchEvent(
        new CustomEvent(name, {
          detail: detail && typeof detail === "object" ? detail : {}
        })
      );
      return true;
    } catch (error) {
      console.warn(`Failed to dispatch event "${name}".`, error);
      return false;
    }
  }

  function emitPlacesUpdated() {
    const allPlaces = Array.isArray(State.allPlaces) ? State.allPlaces : [];
    const filteredPlaces = Array.isArray(State.filteredPlaces) ? State.filteredPlaces : [];
    const regions = new Set();
    const categories = new Set();

    for (const place of allPlaces) {
      if (!isValidPlace(place)) {
        continue;
      }

      const region = normalizeText(place.region, "");
      if (region) {
        regions.add(region.toLowerCase());
      }

      const category = normalizeText(place.category ?? place.kind, "");
      if (category) {
        categories.add(category.toLowerCase());
      }
    }

    emitUiEvent("worldatlas:places-updated", {
      total: allPlaces.length,
      visible: filteredPlaces.length,
      regions: regions.size,
      categories: categories.size,
      favorites: State.favoritePlaceIds.size
    });
  }

  function emitSelectionChanged(place) {
    const selectedPlace = isValidPlace(place) ? place : null;
    emitUiEvent("worldatlas:selection-changed", {
      placeId: selectedPlace ? selectedPlace.id : "",
      placeName: selectedPlace ? normalizeText(selectedPlace.name, "—") : "—",
      region: selectedPlace ? normalizeText(selectedPlace.region, "") : "",
      country: selectedPlace ? normalizeText(selectedPlace.country, "") : ""
    });
  }

  function isUserWriteBlocked() {
    return (
      Runtime.userBanState?.isBanned === true ||
      Runtime.addPlaceAccessState?.isFrozen === true
    );
  }

  function buildFrozenStateMessage(state = {}) {
    if (state.isFrozen !== true) {
      return "";
    }

    const safeReason = normalizeText(state.freezeReason, "");
    const safeUntil = normalizeText(state.frozenUntil, "");
    const reasonLine = safeReason ? ` Причина: ${safeReason}.` : "";
    const untilLine = safeUntil
      ? ` Ограничение действует до ${formatBanEndsAt(safeUntil)}.`
      : (state.isFreezePermanent === true
        ? " Ограничение действует до ручного снятия."
        : "");
    return `Для аккаунта включён read-only режим.${reasonLine}${untilLine} Просмотр сайта доступен, но писать, редактировать и загружать фото нельзя.`;
  }

  function buildWriteRestrictionMessage(state = {}) {
    if (state.isBanned === true) {
      return buildBanStateMessage(state);
    }
    if (state.isFrozen === true) {
      return buildFrozenStateMessage(state);
    }
    return "";
  }

  function applyUserBanUiState(nextState = {}) {
    const nextUserId = normalizeUserId(nextState.userId);
    const nextVisitorId = normalizeText(nextState.visitorId, "");
    const nextIsBanned = Boolean(
      nextState.isBanned && (nextUserId || nextVisitorId || nextState.source === "visitor")
    );
    const nextSource = normalizeText(nextState.source, nextVisitorId ? "visitor" : "user");
    const nextReason = normalizeText(nextState.reason, "");
    const nextBannedUntil = normalizeText(nextState.bannedUntil, "");
    const nextIsPermanent = nextIsBanned && (
      nextState.isPermanent === true ||
      nextBannedUntil === ""
    );
    const nextMessage = normalizeText(
      nextState.message,
      buildBanStateMessage({
        isBanned: nextIsBanned,
        source: nextSource,
        reason: nextReason,
        bannedUntil: nextBannedUntil,
        isPermanent: nextIsPermanent
      })
    );
    const previousUserId = normalizeUserId(Runtime.userBanState?.userId);
    const previousVisitorId = normalizeText(Runtime.userBanState?.visitorId, "");
    const previousIsBanned = Runtime.userBanState?.isBanned === true;
    const previousSource = normalizeText(Runtime.userBanState?.source, "");
    const hasChanged = (
      previousUserId !== nextUserId ||
      previousVisitorId !== nextVisitorId ||
      previousIsBanned !== nextIsBanned ||
      previousSource !== nextSource
    );

    Runtime.userBanState = {
      userId: nextUserId,
      visitorId: nextVisitorId,
      isBanned: nextIsBanned,
      source: nextSource,
      reason: nextReason,
      bannedUntil: nextBannedUntil,
      isPermanent: nextIsPermanent,
      message: nextIsBanned ? nextMessage : "",
      checkedAt: Date.now()
    };

    const bodyEl = document.body;
    if (bodyEl instanceof HTMLBodyElement) {
      bodyEl.classList.toggle("is-user-banned", nextIsBanned);
      bodyEl.dataset.userBanned = nextIsBanned ? "true" : "false";
      bodyEl.dataset.userBanSource = nextIsBanned ? nextSource : "";
    }

    const overlayEl = Elements.userBannedOverlay;
    const messageEl = Elements.userBannedMessage;
    if (overlayEl instanceof HTMLElement) {
      overlayEl.hidden = !nextIsBanned;
      overlayEl.classList.toggle("is-visible", nextIsBanned);
    }
    if (messageEl instanceof HTMLElement) {
      messageEl.textContent = nextIsBanned
        ? nextMessage
        : "";
    }

    if (hasChanged) {
      emitUiEvent("worldatlas:ban-state-changed", {
        userId: nextUserId,
        visitorId: nextVisitorId,
        isBanned: nextIsBanned,
        source: nextSource,
        reason: nextReason,
        bannedUntil: nextBannedUntil,
        isPermanent: nextIsPermanent,
        message: nextIsBanned ? nextMessage : ""
      });
    }
  }

  async function syncUserBanState(event = null) {
    const accessState = readVisitorAccessState();
    const sessionFromEvent = resolveAuthSessionFromEvent(event);
    const baseState = {
      userId: accessState.userId,
      visitorId: accessState.visitorId,
      isBanned: accessState.isBanned,
      source: accessState.source,
      reason: accessState.reason,
      bannedUntil: accessState.bannedUntil,
      isPermanent: accessState.isPermanent,
      message: accessState.message
    };
    if (sessionFromEvent === null) {
      applyUserBanUiState(baseState);
      return baseState.isBanned;
    }
    const sessionUserId = normalizeUserId(sessionFromEvent?.user?.id);
    const userId = sessionUserId || (await resolveCurrentUserId());

    if (!userId) {
      applyUserBanUiState(baseState);
      return baseState.isBanned;
    }

    const normalizedAccessState = normalizeAddPlaceAccessState(Runtime.addPlaceAccessState);
    if (
      normalizedAccessState.userId === userId &&
      typeof normalizedAccessState.isBanned === "boolean"
    ) {
      applyUserBanUiState({
        userId,
        visitorId: accessState.visitorId,
        isBanned: normalizedAccessState.isBanned || accessState.isBanned,
        source: accessState.isBanned ? accessState.source : "user",
        reason: accessState.reason,
        bannedUntil: accessState.bannedUntil,
        isPermanent: accessState.isPermanent,
        message: accessState.message
      });
      return normalizedAccessState.isBanned || accessState.isBanned;
    }

    let isBanned = false;
    try {
      const result = await ApiClient.getAddPlaceAccess({ session: sessionFromEvent });
      const access = normalizeAddPlaceAccessState(result);
      isBanned = access.userId === userId && access.isBanned === true;
    } catch {
      isBanned = false;
    }

    applyUserBanUiState({
      userId,
      visitorId: accessState.visitorId,
      isBanned: isBanned || accessState.isBanned,
      source: accessState.isBanned ? accessState.source : "user",
      reason: accessState.reason,
      bannedUntil: accessState.bannedUntil,
      isPermanent: accessState.isPermanent,
      message: accessState.message
    });
    return isBanned || accessState.isBanned;
  }

  async function syncAddPlaceToggleAvailability(event = null, options = {}) {
    const probeToken = ++addPlaceAuthProbeToken;
    const sessionFromEvent = resolveAuthSessionFromEvent(event);
    let accessState = {
      isAuthenticated: false,
      isAdmin: false,
      isBanned: false,
      isFrozen: false,
      freezeReason: "",
      frozenUntil: "",
      isFreezePermanent: false,
      userId: ""
    };

    try {
      if (sessionFromEvent === null) {
        accessState = {
          isAuthenticated: false,
          isAdmin: false,
          isBanned: false,
          isFrozen: false,
          freezeReason: "",
          frozenUntil: "",
          isFreezePermanent: false,
          userId: ""
        };
      } else if (ApiClient && typeof ApiClient.getAddPlaceAccess === "function") {
        accessState = normalizeAddPlaceAccessState(
          await ApiClient.getAddPlaceAccess({ session: sessionFromEvent })
        );
      } else if (ApiClient && typeof ApiClient.isAuthenticated === "function") {
        accessState = {
          isAuthenticated: Boolean(await ApiClient.isAuthenticated()),
          isAdmin: false,
          isBanned: false,
          isFrozen: false,
          freezeReason: "",
          frozenUntil: "",
          isFreezePermanent: false,
          userId: ""
        };
      }
    } catch {
      accessState = {
        isAuthenticated: false,
        isAdmin: false,
        isBanned: false,
        isFrozen: false,
        freezeReason: "",
        frozenUntil: "",
        isFreezePermanent: false,
        userId: ""
      };
    }

    if (probeToken !== addPlaceAuthProbeToken) {
      return;
    }

    const visitorAccess = readVisitorAccessState();
    if (visitorAccess.isVisitorBanned) {
      accessState.isBanned = true;
    }

    Runtime.addPlaceAccessState = accessState;
    applyAddPlaceToggleAvailability(accessState, options);
    if (addPlaceController && typeof addPlaceController.syncAccessState === "function") {
      addPlaceController.syncAccessState(accessState);
    }
  }

  function readVisitorAccessState() {
    let source = null;
    try {
      source = (
        window.WorldAtlasSupabase &&
        typeof window.WorldAtlasSupabase.getAccessState === "function"
      )
        ? window.WorldAtlasSupabase.getAccessState()
        : null;
    } catch {
      source = null;
    }
    const safeSource = source && typeof source === "object" ? source : {};
    const isBanned = (
      safeSource.isBanned === true ||
      safeSource.isVisitorBanned === true ||
      safeSource.isUserBanned === true
    );
    const banSource = normalizeText(
      safeSource.source,
      safeSource.isVisitorBanned === true
        ? "visitor"
        : (safeSource.isUserBanned === true ? "user" : "")
    );
    return {
      visitorId: normalizeText(safeSource.visitorId, ""),
      userId: normalizeUserId(safeSource.userId),
      isBanned,
      isVisitorBanned: safeSource.isVisitorBanned === true,
      isUserBanned: safeSource.isUserBanned === true,
      source: banSource,
      reason: normalizeText(safeSource.reason, ""),
      bannedUntil: normalizeText(safeSource.bannedUntil, ""),
      isPermanent: safeSource.isPermanent === true,
      message: buildBanStateMessage({
        isBanned,
        source: banSource,
        reason: normalizeText(safeSource.reason, ""),
        bannedUntil: normalizeText(safeSource.bannedUntil, ""),
        isPermanent: safeSource.isPermanent === true
      })
    };
  }

  function buildBanStateMessage(state = {}) {
    if (state.isBanned !== true) {
      return "";
    }

    const safeReason = normalizeText(state.reason, "");
    const safeUntil = normalizeText(state.bannedUntil, "");
    const prefix = normalizeText(state.source, "user") === "visitor"
      ? "Для этого браузера ограничен доступ."
      : "Ваш доступ ограничен.";
    const reasonLine = safeReason ? ` Причина: ${safeReason}.` : "";
    const untilLine = safeUntil
      ? ` Бан действует до ${formatBanEndsAt(safeUntil)}.`
      : (state.isPermanent === true
        ? " Доступ закрыт до ручного разбана."
        : "");
    return `${prefix}${reasonLine}${untilLine} Отзывы, точки и загрузка фото недоступны.`;
  }

  function formatBanEndsAt(value) {
    const timestamp = Date.parse(normalizeText(value, ""));
    if (!Number.isFinite(timestamp)) {
      return "неизвестного времени";
    }
    return new Date(timestamp).toLocaleString();
  }

  function redirectToBannedPage() {
    const pathname = normalizeText(window.location?.pathname, "/");
    if (pathname === "/banned" || pathname === "/banned/") {
      return;
    }
    window.location.replace("/banned");
  }

  function resolveAuthSessionFromEvent(event) {
    if (!event || typeof event !== "object") {
      return undefined;
    }
    const detail = event.detail;
    if (!detail || typeof detail !== "object") {
      return undefined;
    }
    if (!Object.prototype.hasOwnProperty.call(detail, "session")) {
      return undefined;
    }
    return detail.session || null;
  }

  function normalizeAddPlaceAccessState(state) {
    const safeState = state && typeof state === "object" ? state : {};
    return {
      isAuthenticated: Boolean(safeState.isAuthenticated),
      isAdmin: Boolean(safeState.isAdmin),
      isBanned: Boolean(safeState.isBanned),
      isFrozen: Boolean(safeState.isFrozen),
      freezeReason: normalizeText(safeState.freezeReason, ""),
      frozenUntil: normalizeText(safeState.frozenUntil, ""),
      isFreezePermanent: safeState.isFreezePermanent === true,
      userId: normalizeUserId(safeState.userId)
    };
  }

  function applyAddPlaceToggleAvailability(accessState, options = {}) {
    const controlsEl = Elements.addPlaceControls;
    const publicButtonEl = Elements.addPlacePublicToggleButton;
    const myButtonEl = Elements.addPlaceMyToggleButton;
    if (!(controlsEl instanceof HTMLElement) || !(publicButtonEl instanceof HTMLButtonElement) || !(myButtonEl instanceof HTMLButtonElement)) {
      return;
    }

    const safeAccessState = normalizeAddPlaceAccessState(accessState);
    const { animate = true } = options;
    const canShowPublicButton = true;
    const bodyEl = document.body;

    if (!animate) {
      controlsEl.classList.add("add-place-segmented--no-transition");
    }

    controlsEl.classList.toggle("is-admin-visible", canShowPublicButton);
    controlsEl.classList.toggle("is-admin-hidden", !canShowPublicButton);
    controlsEl.dataset.authenticated = safeAccessState.isAuthenticated ? "true" : "false";
    controlsEl.dataset.admin = safeAccessState.isAdmin ? "true" : "false";
    controlsEl.dataset.banned = safeAccessState.isBanned ? "true" : "false";
    controlsEl.dataset.frozen = safeAccessState.isFrozen ? "true" : "false";

    if (bodyEl instanceof HTMLBodyElement) {
      bodyEl.dataset.authenticated = safeAccessState.isAuthenticated ? "true" : "false";
      bodyEl.dataset.admin = safeAccessState.isAdmin ? "true" : "false";
      bodyEl.classList.toggle("is-admin", safeAccessState.isAdmin);
      bodyEl.classList.toggle("is-authenticated", safeAccessState.isAuthenticated);
    }

    const isWriteBlocked = safeAccessState.isBanned || safeAccessState.isFrozen;
    publicButtonEl.hidden = !canShowPublicButton;
    publicButtonEl.disabled = !canShowPublicButton || isWriteBlocked;
    if (canShowPublicButton) {
      publicButtonEl.removeAttribute("aria-hidden");
      publicButtonEl.removeAttribute("tabindex");
    } else {
      publicButtonEl.classList.remove("is-active");
      publicButtonEl.setAttribute("aria-hidden", "true");
      publicButtonEl.setAttribute("tabindex", "-1");
      publicButtonEl.setAttribute("aria-expanded", "false");
    }

    myButtonEl.disabled = isWriteBlocked;
    if (!safeAccessState.isAuthenticated) {
      myButtonEl.setAttribute("data-auth-required", "true");
    } else if (isWriteBlocked) {
      myButtonEl.setAttribute("data-auth-required", "false");
    } else {
      myButtonEl.removeAttribute("data-auth-required");
    }

    if (!animate) {
      requestAnimationFrame(() => {
        controlsEl.classList.remove("add-place-segmented--no-transition");
      });
    }
  }

  function registerGlobalUiEvents() {
    const onResetClick = () => {
      mapEngine.resetView();
      scheduleUrlSync();
    };

    const onFitClick = () => {
      mapEngine.fitToPlaces(State.filteredPlaces);
      scheduleUrlSync();
    };

    const onSidebarToggleClick = () => {
      toggleMapMarkersVisibility();
    };

    const onWindowResize = debounce(() => {
      if (mapEngine) {
        mapEngine.invalidateSize();
      }
    }, 140);

    const onBeforeUnload = () => {
      cleanup();
    };

    const onFavoritesSynced = (event) => {
      const ids = Array.isArray(event?.detail?.ids)
        ? event.detail.ids
        : [];
      State.favoritePlaceIds = new Set(
        ids
          .map((entry) => normalizeText(entry, ""))
          .filter(Boolean)
      );
      applyFilters({ updateUrl: false, preserveSelection: true });
    };

    const onAuthChanged = (event) => {
      void refreshFavoritesForCurrentSession({ preserveSelection: true });
      void syncUserBanState(event);
      void syncAddPlaceToggleAvailability(event);
    };

    const onVisitorAccessChanged = () => {
      void syncUserBanState();
      void syncAddPlaceToggleAvailability(null, { animate: false });
    };

    const onBanStateChanged = (event) => {
      if (event?.detail?.isBanned === true) {
        redirectToBannedPage();
      }
    };

    const onServerAccessRefresh = () => {
      void syncUserBanState();
      void syncAddPlaceToggleAvailability(null, { animate: false });
    };

    const onPlacesMutated = (event) => {
      const detail = event?.detail && typeof event.detail === "object"
        ? event.detail
        : {};
      const mutationAction = normalizeText(detail.action, "").toLowerCase();
      const removedIds = Array.isArray(detail.removedPlaceIds) ? detail.removedPlaceIds : [];
      const removedRefs = Array.isArray(detail.removedPlaceRefs) ? detail.removedPlaceRefs : [];
      let changed = false;

      for (const placeId of removedIds) {
        const removed = removePlaceFromState(placeId);
        if (removed) {
          changed = true;
          State.favoritePlaceIds.delete(normalizeText(removed.id, ""));
        }
      }

      for (const placeRef of removedRefs) {
        const removed = removePlaceFromStateByReference(placeRef);
        if (removed) {
          changed = true;
          State.favoritePlaceIds.delete(normalizeText(removed.id, ""));
        }
      }

      if (changed) {
        FavoritesStore.write(State.favoritePlaceIds);
        refreshDerivedUiFromPlaces();
        applyFilters({ updateUrl: false, preserveSelection: false });
        if (mutationAction === "delete") {
          animateMapAfterPlaceDeletion();
        }
      }

      void reloadPlacesStateAfterImport({
        updateUrl: false,
        allowFallback: false
      }).catch((error) => {
        console.warn("[places] Failed to reload places after mutation event:", error);
      });
    };

    const onTravelHubSelectPlace = (event) => {
      const placeId = normalizeText(event?.detail?.placeId, "");
      if (!placeId) {
        return;
      }

      selectPlace(placeId, {
        panToPlace: true,
        openPopup: true,
        updateUrl: true,
        source: "travel-hub"
      });
    };

    Elements.resetViewButton.addEventListener("click", onResetClick);
    Elements.fitPointsButton.addEventListener("click", onFitClick);
    Elements.sidebarToggleButton.addEventListener("click", onSidebarToggleClick);
    window.addEventListener("resize", onWindowResize, { passive: true });
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("worldatlas:favorites-synced", onFavoritesSynced);
    window.addEventListener("worldatlas:auth-changed", onAuthChanged);
    window.addEventListener("worldatlas:visitor-access-changed", onVisitorAccessChanged);
    window.addEventListener("worldatlas:ban-state-changed", onBanStateChanged);
    window.addEventListener("worldatlas:server-access-refresh", onServerAccessRefresh);
    window.addEventListener("worldatlas:places-mutated", onPlacesMutated);
    window.addEventListener("worldatlas:travel-hub-select-place", onTravelHubSelectPlace);

    Runtime.cleanupFns.push(() =>
      Elements.resetViewButton.removeEventListener("click", onResetClick)
    );
    Runtime.cleanupFns.push(() =>
      Elements.fitPointsButton.removeEventListener("click", onFitClick)
    );
    Runtime.cleanupFns.push(() =>
      Elements.sidebarToggleButton.removeEventListener("click", onSidebarToggleClick)
    );
    Runtime.cleanupFns.push(() => window.removeEventListener("resize", onWindowResize));
    Runtime.cleanupFns.push(() => window.removeEventListener("beforeunload", onBeforeUnload));
    Runtime.cleanupFns.push(() =>
      window.removeEventListener("worldatlas:favorites-synced", onFavoritesSynced)
    );
    Runtime.cleanupFns.push(() =>
      window.removeEventListener("worldatlas:auth-changed", onAuthChanged)
    );
    Runtime.cleanupFns.push(() =>
      window.removeEventListener("worldatlas:visitor-access-changed", onVisitorAccessChanged)
    );
    Runtime.cleanupFns.push(() =>
      window.removeEventListener("worldatlas:ban-state-changed", onBanStateChanged)
    );
    Runtime.cleanupFns.push(() =>
      window.removeEventListener("worldatlas:server-access-refresh", onServerAccessRefresh)
    );
    Runtime.cleanupFns.push(() =>
      window.removeEventListener("worldatlas:places-mutated", onPlacesMutated)
    );
    Runtime.cleanupFns.push(() =>
      window.removeEventListener("worldatlas:travel-hub-select-place", onTravelHubSelectPlace)
    );
    Runtime.cleanupFns.push(() => cancelPendingDeleteOverviewAnimation());
  }

  function registerTravelHubModeBridge() {
    const modeSwitchEl = document.getElementById("travel-mode-switch");
    if (!(modeSwitchEl instanceof HTMLElement)) {
      return;
    }

    const buttons = Array.from(
      modeSwitchEl.querySelectorAll(".travel-mode-switch__btn[data-mode]")
    ).filter((button) => button instanceof HTMLButtonElement);
    if (buttons.length === 0) {
      return;
    }

    const titleEl = document.getElementById("travel-hub-title");
    const subtitleEl = document.getElementById("travel-hub-subtitle");
    const modeMeta = {
      catalog: {
        title: "Travel Catalog",
        subtitle: "Каталог и обзор точек"
      },
      guide: {
        title: "Social Guide",
        subtitle: "Top / Popular / New from real data"
      },
      planner: {
        title: "Trip Planner",
        subtitle: "Route metrics and saved plans"
      }
    };

    const applyModeUi = (rawMode) => {
      const mode = normalizeText(rawMode, "catalog").toLowerCase();
      const safeMode = mode === "guide" || mode === "planner" ? mode : "catalog";
      const meta = modeMeta[safeMode];

      if (titleEl instanceof HTMLElement) {
        titleEl.textContent = meta.title;
      }
      if (subtitleEl instanceof HTMLElement) {
        subtitleEl.textContent = meta.subtitle;
      }

      for (const button of buttons) {
        const isActive = normalizeText(button.dataset.mode, "") === safeMode;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-selected", String(isActive));
      }
    };

    const modeClickHandler = (event) => {
      const button = event.target instanceof Element
        ? event.target.closest(".travel-mode-switch__btn[data-mode]")
        : null;
      if (!(button instanceof HTMLButtonElement)) {
        return;
      }

      const mode = normalizeText(button.dataset.mode, "catalog").toLowerCase();
      applyModeUi(mode);

      if (mode === "catalog") {
        applyFilters({ updateUrl: false, preserveSelection: true });
        return;
      }

      if (mode === "guide") {
        if (window.WorldAtlasTravelHub) {
          // travel-shell handles guide activation itself; avoid duplicate render/load path
          return;
        }
        const listEl = document.querySelector(".travel-guide__cards");
        const hasRenderedGuide = listEl instanceof HTMLElement && listEl.children.length > 0;
        if (!hasRenderedGuide && typeof window.WorldAtlasTravelHub?.refreshGuide === "function") {
          void window.WorldAtlasTravelHub.refreshGuide();
        }
        return;
      }

      if (mode === "planner") {
        if (window.WorldAtlasTravelHub) {
          // travel-shell handles planner activation itself; avoid duplicate refresh path
          return;
        }
        const savedPlansEl = document.querySelector(".travel-planner__saved");
        const hasRenderedPlanner = savedPlansEl instanceof HTMLElement && savedPlansEl.children.length > 0;
        if (!hasRenderedPlanner && typeof window.WorldAtlasTravelHub?.refreshPlanner === "function") {
          void window.WorldAtlasTravelHub.refreshPlanner();
        }
      }
    };

    modeSwitchEl.addEventListener("click", modeClickHandler);
    Runtime.cleanupFns.push(() => modeSwitchEl.removeEventListener("click", modeClickHandler));

    const activeButton = buttons.find((button) => button.classList.contains("is-active"));
    applyModeUi(activeButton?.dataset.mode || "catalog");
  }

  function cleanup() {
    while (Runtime.cleanupFns.length > 0) {
      const disposer = Runtime.cleanupFns.pop();
      try {
        disposer();
      } catch (error) {
        console.error("Cleanup error:", error);
      }
    }

    if (popupController) {
      popupController.destroyPopup();
      popupController = null;
    }

    if (sidebarController) {
      sidebarController.destroy();
      sidebarController = null;
    }

    if (nearMeController) {
      nearMeController.destroy();
      nearMeController = null;
    }

    if (addPlaceController) {
      addPlaceController.destroy();
      addPlaceController = null;
    }

    if (routeController) {
      routeController.destroy();
      routeController = null;
    }

    if (onboardingController) {
      onboardingController.destroy();
      onboardingController = null;
    }

    if (mapZoomSliderController) {
      mapZoomSliderController.destroy();
      mapZoomSliderController = null;
    }

    if (mapEngine) {
      mapEngine.destroy();
      mapEngine = null;
    }

    if (Runtime.statusTimerId) {
      window.clearTimeout(Runtime.statusTimerId);
      Runtime.statusTimerId = null;
    }

    if (Runtime.toastTimerId) {
      window.clearTimeout(Runtime.toastTimerId);
      Runtime.toastTimerId = null;
    }

    Elements.appToast.classList.remove("is-visible");
    Elements.appToast.hidden = true;

    if (Runtime.urlTimerId) {
      window.clearTimeout(Runtime.urlTimerId);
      Runtime.urlTimerId = null;
    }

    if (Runtime.pointsToggleLabelTimerId) {
      window.clearTimeout(Runtime.pointsToggleLabelTimerId);
      Runtime.pointsToggleLabelTimerId = null;
    }

    if (Runtime.filterMotionTimerId) {
      window.clearTimeout(Runtime.filterMotionTimerId);
      Runtime.filterMotionTimerId = null;
    }
  }

  function toggleMapMarkersVisibility() {
    setMapMarkersVisibility(!State.markersVisible);
  }

  function setMapMarkersVisibility(isVisible, options = {}) {
    const { animateLabel = true } = options;
    const nextVisible = Boolean(isVisible);
    if (!mapEngine) {
      State.markersVisible = nextVisible;
      updatePointsToggleButtonUi(nextVisible, { animateLabel });
      return nextVisible;
    }

    State.markersVisible = mapEngine.setMarkersVisible(nextVisible);
    updatePointsToggleButtonUi(State.markersVisible, { animateLabel });
    return State.markersVisible;
  }

  function updatePointsToggleButtonUi(isMarkersVisible, options = {}) {
    const { animateLabel = true } = options;
    const nextLabel = isMarkersVisible ? "Скрыть точки" : "Показать точки";
    const nextAriaLabel = isMarkersVisible
      ? "Скрыть маркеры точек на карте"
      : "Показать маркеры точек на карте";

    Elements.sidebarToggleButton.setAttribute("aria-label", nextAriaLabel);
    Elements.sidebarToggleButton.setAttribute("aria-pressed", String(!isMarkersVisible));
    Elements.sidebarToggleButton.classList.toggle("is-points-hidden", !isMarkersVisible);

    const labelNode = Elements.sidebarToggleButton.querySelector(".app-btn__label");
    if (!(labelNode instanceof HTMLElement)) {
      Elements.sidebarToggleButton.textContent = nextLabel;
      return;
    }

    const currentLabel = normalizeText(labelNode.dataset.label, labelNode.textContent || "");
    if (currentLabel === nextLabel) {
      return;
    }

    const applyLabel = () => {
      labelNode.textContent = nextLabel;
      labelNode.dataset.label = nextLabel;
      labelNode.classList.remove("is-switching");
    };

    if (!animateLabel) {
      applyLabel();
      return;
    }

    labelNode.classList.add("is-switching");

    if (Runtime.pointsToggleLabelTimerId) {
      window.clearTimeout(Runtime.pointsToggleLabelTimerId);
      Runtime.pointsToggleLabelTimerId = null;
    }

    Runtime.pointsToggleLabelTimerId = window.setTimeout(() => {
      Runtime.pointsToggleLabelTimerId = null;
      applyLabel();
    }, 130);
  }

  function triggerFilterRefreshMotion() {
    Elements.mapRoot.classList.add("is-filtering");
    if (Runtime.filterMotionTimerId) {
      window.clearTimeout(Runtime.filterMotionTimerId);
    }
    Runtime.filterMotionTimerId = window.setTimeout(() => {
      Runtime.filterMotionTimerId = null;
      Elements.mapRoot.classList.remove("is-filtering");
    }, 240);
  }

  async function loadPlacesAndMeta(options = {}) {
    const {
      allowFallback = true
    } = options;
    try {
      const [placesResponse, metaResponse] = await Promise.all([
        ApiClient.getPlaces({
          limit: Config.PLACE_LIMIT,
          offset: 0,
          sortBy: "name",
          order: "asc"
        }),
        ApiClient.getRegionsMeta()
      ]);

      const apiPlaces = Array.isArray(placesResponse.items)
        ? placesResponse.items
            .filter(isValidPlace)
            .map((place) => enrichPlaceWithSeedDetails(place))
        : [];
      const uniqueApiPlaces = dedupePlaces(apiPlaces);

      if (uniqueApiPlaces.length !== apiPlaces.length) {
        console.info(`[places] API duplicates removed: ${apiPlaces.length - uniqueApiPlaces.length}`);
      }

      if (uniqueApiPlaces.length === 0) {
        throw new Error("API returned empty places list.");
      }

      console.info(`API places: ${uniqueApiPlaces.length}, source: api`);

      return {
        places: uniqueApiPlaces,
        regionsMeta: Array.isArray(metaResponse.items) ? metaResponse.items : [],
        source: "api"
      };
    } catch (error) {
      if (!allowFallback) {
        throw error;
      }

      if (!shouldAllowLocalSeedFallback()) {
        if (!Runtime.placesLoadWarned) {
          Runtime.placesLoadWarned = true;
          console.warn("API places loading failed. Local seed fallback is disabled on this host.", error);
        }
        setStatus("Не удалось загрузить актуальные точки с сервера.", {
          type: "error",
          timeoutMs: Config.STATUS_CLEAR_MS
        });
        return {
          places: [],
          regionsMeta: [],
          source: "api-error"
        };
      }

      if (!Runtime.placesLoadWarned) {
        Runtime.placesLoadWarned = true;
        console.warn("API places loading failed. Falling back to local seed JSON.", error);
      }

      const localSeedPlaces = await loadLocalSeedPlaces();
      if (Array.isArray(localSeedPlaces) && localSeedPlaces.length > 0) {
        const uniqueSeedPlaces = dedupePlaces(localSeedPlaces);
        return {
          places: uniqueSeedPlaces,
          regionsMeta: deriveRegionsMeta(uniqueSeedPlaces),
          source: "local-seed"
        };
      }

      setStatus("Не удалось загрузить точки ни из API, ни из /places.json.", {
        type: "error",
        timeoutMs: Config.STATUS_CLEAR_MS
      });
      return {
        places: [],
        regionsMeta: [],
        source: "api-error"
      };
    }
  }

  function shouldAllowLocalSeedFallback() {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("seedFallback") === "1") {
        return true;
      }
    } catch (_) {
      // ignore
    }

    const protocol = normalizeText(window.location?.protocol, "").toLowerCase();
    const host = normalizeText(window.location?.hostname, "").toLowerCase();

    if (protocol === "file:") {
      return true;
    }

    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host.endsWith(".local")
    );
  }

  function applyFilters(options = {}) {
    const {
      updateUrl = false,
      preserveSelection = true
    } = options;

    triggerFilterRefreshMotion();

    State.filteredPlaces = filterPlaces(
      State.allPlaces,
      State.searchQuery,
      State.regionFilter,
      {
        favoritesOnly: State.favoritesOnly,
        favoritePlaceIds: State.favoritePlaceIds,
        categoryFilter: State.smartFilters.category,
        tagsFilter: State.smartFilters.tags,
        onlyFree: State.smartFilters.onlyFree,
        familyFriendly: State.smartFilters.familyFriendly,
        sortBy: State.smartFilters.sortBy
      }
    );

    sidebarController.renderList(
      State.filteredPlaces,
      State.selectedPlaceId,
      State.favoritePlaceIds
    );
    sidebarController.setCounters(State.allPlaces.length, State.filteredPlaces.length);
    sidebarController.setFavoritesState(State.favoritesOnly, State.favoritePlaceIds.size);

    mapEngine.setVisiblePlaces(State.filteredPlaces, State.selectedPlaceId);

    const hasSelected =
      typeof State.selectedPlaceId === "string" &&
      State.filteredPlaces.some((entry) => entry.id === State.selectedPlaceId);

    if (!preserveSelection || !hasSelected) {
      if (State.selectedPlaceId && !hasSelected) {
        popupController.closePopup("selection-filtered-out");
      }
      clearSelection({ closePopup: false, updateUrl: false });
    } else {
      mapEngine.setActive(State.selectedPlaceId);
      sidebarController.setActive(State.selectedPlaceId);
    }

    setHoveredPlace(State.hoveredPlaceId);

    if (nearMeController && typeof nearMeController.refreshPlaces === "function") {
      nearMeController.refreshPlaces();
    }

    emitPlacesUpdated();

    if (updateUrl) {
      scheduleUrlSync();
    }
  }

  function resolvePlaceByReference(placeRef) {
    const safeRef = normalizeText(placeRef, "");
    if (!safeRef) {
      return null;
    }

    const byId = State.allPlaces.find((entry) => normalizeText(entry?.id, "") === safeRef);
    if (byId) {
      return byId;
    }

    const safeRefLower = safeRef.toLowerCase();
    return (
      State.allPlaces.find((entry) => {
        const slug = normalizeText(entry?.slug, "");
        return Boolean(
          slug &&
          (slug === safeRef || slug.toLowerCase() === safeRefLower)
        );
      }) ||
      null
    );
  }

  function selectPlace(placeId, options = {}) {
    const {
      panToPlace = true,
      openPopup = true,
      updateUrl = true,
      source = ""
    } = options;

    if (typeof placeId !== "string" || placeId.trim() === "") {
      return false;
    }

    const place = resolvePlaceByReference(placeId);
    if (!place) {
      return false;
    }
    const resolvedPlaceId = normalizeText(place.id, "");
    if (!resolvedPlaceId) {
      return false;
    }

    const normalizedSource = normalizeText(source, "").toLowerCase();
    const isMarkerDrivenSelection = normalizedSource === "map-marker";
    const isSidebarDrivenSelection = normalizedSource === "sidebar-list";
    const shouldAnimateSelection = panToPlace;
    const hasSameSelection = State.selectedPlaceId === resolvedPlaceId;

    const renderPopup = () => {
      if (!openPopup) {
        return;
      }
      const markerElement = mapEngine.getMarkerElement(resolvedPlaceId);
      popupController.openPlacePopup(place, {
        placeId: resolvedPlaceId,
        markerElement,
        resolveAnchor: () => mapEngine.getPopupAnchor(resolvedPlaceId)
      });
    };

    if (hasSameSelection) {
      mapEngine.setActive(resolvedPlaceId);
      sidebarController.setActive(resolvedPlaceId);
      setHoveredPlace(resolvedPlaceId);

      if (isMarkerDrivenSelection && openPopup) {
        if (popupController.isOpen) {
          popupController.closePopup("same-marker-toggle");
        } else {
          renderPopup();
        }
      } else if (openPopup && !popupController.isOpen) {
        renderPopup();
      }

      if (updateUrl) {
        scheduleUrlSync();
      }

      emitSelectionChanged(place);

      return true;
    }

    State.selectedPlaceId = resolvedPlaceId;

    mapEngine.setActive(resolvedPlaceId);
    sidebarController.setActive(resolvedPlaceId);
    setHoveredPlace(resolvedPlaceId);

    const triggerSpotlight = () => {
      if (isSidebarDrivenSelection) {
        mapEngine.spotlight(resolvedPlaceId);
      }
    };

    const renderPopupAfterMotionFrame = () => {
      if (!openPopup) {
        return;
      }

      // Give Leaflet one paint tick after motion completes, but do not add extra lag.
      window.requestAnimationFrame(() => {
        if (State.selectedPlaceId === resolvedPlaceId) {
          renderPopup();
        }
      });
    };

    const shouldResetPopupBeforeAnimatedSelection =
      openPopup &&
      shouldAnimateSelection &&
      popupController.isOpen;
    if (shouldResetPopupBeforeAnimatedSelection) {
      popupController.closePopup("selection-transition");
    }

    if (shouldAnimateSelection) {
      const animated = mapEngine.flyTo(resolvedPlaceId, {
        source: normalizedSource,
        onComplete: () => {
          triggerSpotlight();
          renderPopupAfterMotionFrame();
        }
      });

      if (!animated) {
        triggerSpotlight();
        renderPopup();
      }
    } else {
      triggerSpotlight();
      renderPopup();
    }

    if (updateUrl) {
      scheduleUrlSync();
    }

    emitSelectionChanged(place);

    return true;
  }

  function resolvePopupAdjacentPlaces(placeRef) {
    const safeRef = normalizeText(placeRef, "");
    const candidateLists = [];

    if (Array.isArray(State.filteredPlaces) && State.filteredPlaces.length > 0) {
      candidateLists.push(State.filteredPlaces);
    }
    if (Array.isArray(State.allPlaces) && State.allPlaces.length > 0) {
      candidateLists.push(State.allPlaces);
    }

    for (const candidateList of candidateLists) {
      const validPlaces = candidateList.filter((entry) => isValidPlace(entry));
      const activeIndex = validPlaces.findIndex((entry) => {
        const placeId = normalizeText(entry?.id, "");
        const placeSlug = normalizeText(entry?.slug, "");
        return placeId === safeRef || placeSlug === safeRef;
      });
      if (activeIndex >= 0) {
        return {
          previous: validPlaces[activeIndex - 1] ?? null,
          next: validPlaces[activeIndex + 1] ?? null,
          index: activeIndex,
          total: validPlaces.length
        };
      }
    }

    return {
      previous: null,
      next: null,
      index: -1,
      total: 0
    };
  }

  function handlePopupNavigatePlace(placeRef, direction = "next") {
    const safeDirection = normalizeText(direction, "next").toLowerCase() === "previous"
      ? "previous"
      : "next";
    const navigation = resolvePopupAdjacentPlaces(placeRef);
    const targetPlace = safeDirection === "previous"
      ? navigation.previous
      : navigation.next;
    const targetRef = normalizeText(targetPlace?.id, "") || normalizeText(targetPlace?.slug, "");
    if (!targetRef) {
      return false;
    }

    return selectPlace(targetRef, {
      panToPlace: true,
      openPopup: true,
      updateUrl: true,
      source: "popup-nav"
    });
  }

  function clearSelection(options = {}) {
    const {
      closePopup = false,
      updateUrl = true
    } = options;

    State.selectedPlaceId = null;
    mapEngine.clearActive();
    sidebarController.setActive(null);

    if (closePopup) {
      popupController.closePopup("clear-selection");
    }

    if (updateUrl) {
      scheduleUrlSync();
    }

    emitSelectionChanged(null);
  }

  function setHoveredPlace(placeId) {
    const normalizedPlaceId = typeof placeId === "string" && placeId.trim() !== ""
      ? placeId.trim()
      : null;

    if (State.hoveredPlaceId === normalizedPlaceId) {
      return;
    }

    State.hoveredPlaceId = normalizedPlaceId;

    if (mapEngine && typeof mapEngine.setHovered === "function") {
      mapEngine.setHovered(normalizedPlaceId);
    }

    if (sidebarController && typeof sidebarController.setHovered === "function") {
      sidebarController.setHovered(normalizedPlaceId);
    }
  }

  function handlePopupClose(payload) {
    const context = payload?.context;

    if (context?.markerElement instanceof HTMLElement) {
      context.markerElement.focus();
      return;
    }

    if (typeof context?.placeId === "string") {
      mapEngine.focusMarker(context.placeId);
    }
  }

  function handlePopupRouteFrom(place) {
    if (!routeController || !place || typeof place.id !== "string") {
      return false;
    }

    if (sidebarController && typeof sidebarController.setPanelVisible === "function") {
      sidebarController.setPanelVisible(true);
    }

    const applied = routeController.setStartPlace(place.id, { focusEnd: true });
    if (!applied) {
      setStatus("Не удалось подставить точку в маршрут.", {
        type: "error",
        timeoutMs: Config.STATUS_CLEAR_MS
      });
      return false;
    }

    showToast("Точка A заполнена. Выберите точку B.");
    return true;
  }

  function normalizeUserId(value) {
    const normalized = normalizeText(value, "").toLowerCase();
    return /^[0-9a-f-]{36}$/i.test(normalized) ? normalized : "";
  }

  function normalizeUuid(value) {
    return normalizeUserId(value);
  }

  function createClientUuid() {
    const cryptoApi = globalThis.crypto;
    if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
      return normalizeUserId(cryptoApi.randomUUID());
    }

    if (cryptoApi && typeof cryptoApi.getRandomValues === "function") {
      const bytes = new Uint8Array(16);
      cryptoApi.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
      const uuid = [
        hex.slice(0, 8),
        hex.slice(8, 12),
        hex.slice(12, 16),
        hex.slice(16, 20),
        hex.slice(20)
      ].join("-");
      return normalizeUserId(uuid);
    }

    return "";
  }

  async function resolveCurrentUserId() {
    try {
      if (window.WorldAtlasSupabase && typeof window.WorldAtlasSupabase.getUser === "function") {
        const user = await window.WorldAtlasSupabase.getUser();
        return normalizeUserId(user?.id);
      }
    } catch {
      // fallback below
    }

    try {
      if (window.supabase && window.supabase.auth && typeof window.supabase.auth.getUser === "function") {
        const { data } = await window.supabase.auth.getUser();
        return normalizeUserId(data?.user?.id);
      }
    } catch {
      // fallback below
    }

    try {
      if (window.supabaseReady && typeof window.supabaseReady.then === "function") {
        const client = await Promise.resolve(window.supabaseReady);
        if (client && client.auth && typeof client.auth.getUser === "function") {
          const { data } = await client.auth.getUser();
          return normalizeUserId(data?.user?.id);
        }
      }
    } catch {
      // noop
    }

    return "";
  }

  async function canDeletePlace(place) {
    if (!place || typeof place !== "object") {
      return false;
    }

    if (Runtime.addPlaceAccessState?.isAdmin) {
      return true;
    }

    const scope = resolvePlaceScope(place);
    if (scope === "public") {
      const publicPlaceId = normalizeUserId(place.id);
      return Boolean(publicPlaceId && Runtime.addPlaceAccessState?.isAdmin);
    }

    const ownerId = normalizeUserId(place.created_by ?? place.createdBy);
    if (!ownerId) {
      return false;
    }

    const currentUserId = await resolveCurrentUserId();
    return Boolean(currentUserId && currentUserId === ownerId);
  }

  async function handlePopupDeletePlace(place) {
    const placeId = normalizeText(place?.id, "");
    if (!placeId) {
      return false;
    }

    if (isUserWriteBlocked()) {
      const bannedMessage = "Вы забанены. Запись и удаление данных недоступны.";
      setStatus(bannedMessage, {
        type: "error",
        timeoutMs: Config.STATUS_CLEAR_MS
      });
      showToast(bannedMessage);
      return false;
    }

    const placeScope = resolvePlaceScope(place);
    const allowed = await canDeletePlace(place);
    if (!allowed) {
      const deniedMessage = placeScope === "public"
        ? "Only admins can delete public places."
        : "Удалять можно только точки, созданные вашим аккаунтом.";
      setStatus(deniedMessage, {
        type: "error",
        timeoutMs: Config.STATUS_CLEAR_MS
      });
      showToast(deniedMessage);
      return false;
    }

    const placeName = normalizeText(place?.name, "эту точку");
    const confirmed = window.confirm(`Удалить точку "${placeName}"?`);
    if (!confirmed) {
      return false;
    }

    const adminDeleteBridge =
      placeScope === "public" &&
      Runtime.addPlaceAccessState?.isAdmin === true &&
      typeof window.WorldAtlasSupabase?.adminDeletePlaceByRef === "function";

    try {
      if (adminDeleteBridge) {
        await window.WorldAtlasSupabase.adminDeletePlaceByRef(placeId);
      } else {
        await ApiClient.deletePlace(placeId, { scope: placeScope });
      }
    } catch (error) {
      const rawMessage = normalizeText(error?.message, "Не удалось удалить точку.");
      const lowered = rawMessage.toLowerCase();
      const isPermissionError = (
        lowered.includes("permission") ||
        lowered.includes("rls") ||
        lowered.includes("not allowed") ||
        lowered.includes("denied") ||
        lowered.includes("42501")
      );
      const message = (placeScope === "public" && isPermissionError)
        ? "Only admins can delete public places."
        : rawMessage;
      setStatus(message, {
        type: "error",
        timeoutMs: Config.STATUS_CLEAR_MS
      });
      showToast(message);
      return false;
    }

    removePlaceFromState(placeId);
    State.favoritePlaceIds.delete(placeId);
    FavoritesStore.write(State.favoritePlaceIds);
    refreshDerivedUiFromPlaces();
    applyFilters({ updateUrl: true, preserveSelection: false });
    if (!adminDeleteBridge) {
      animateMapAfterPlaceDeletion();
    }

    showToast("Точка удалена");
    setStatus("Точка удалена.", {
      type: "success",
      timeoutMs: 1600
    });

    try {
      await reloadPlacesStateAfterImport({
        updateUrl: false,
        allowFallback: false
      });
    } catch (error) {
      console.warn("[places-delete] Failed to refresh places after delete:", error);
    }

    return true;
  }

  function installFavoritesBridge() {
    window.WorldAtlasAppBridge = window.WorldAtlasAppBridge || {};
    window.WorldAtlasAppBridge.toggleFavoritePlace = toggleFavoritePlace;
    window.WorldAtlasAppBridge.isFavoritePlace = isFavoritePlace;
    window.WorldAtlasAppBridge.refreshFavoritesForCurrentSession = refreshFavoritesForCurrentSession;
    window.WorldAtlasAppBridge.isWriteBlocked = isUserWriteBlocked;
    window.WorldAtlasAppBridge.selectPlace = (placeId, options = {}) => selectPlace(placeId, options);
    window.WorldAtlasAppBridge.reloadPlacesState = (options = {}) => reloadPlacesStateAfterImport(options);
    window.WorldAtlasAppBridge.showToast = (message) => showToast(message);
    window.WorldAtlasAppBridge.previewCoordinates = (lat, lon, options = {}) => {
      const numericLat = Number(lat);
      const numericLon = Number(lon);
      if (!Number.isFinite(numericLat) || !Number.isFinite(numericLon) || !mapEngine) {
        return false;
      }

      if (typeof mapEngine.setDraftPlace === "function") {
        mapEngine.setDraftPlace(
          {
            lat: round(numericLat, 6),
            lon: round(numericLon, 6)
          },
          {
            visibility: normalizePlaceVisibilityState(options.visibility ?? "pending")
          }
        );
      }

      if (typeof mapEngine.flyToCoordinates === "function") {
        mapEngine.flyToCoordinates(numericLat, numericLon, {
          targetZoom: clamp(Math.floor(Number(options.targetZoom) || 6), 2, 12)
        });
      }

      return true;
    };
    window.WorldAtlasAppBridge.clearPreviewCoordinates = () => {
      if (!mapEngine || typeof mapEngine.clearDraftPlace !== "function") {
        return false;
      }
      mapEngine.clearDraftPlace();
      return true;
    };

    // Compatibility bridge for old popup integrations and runtime debugging.
    window.toggleFavoritePlace = toggleFavoritePlace;
    window.isFavoritePlace = isFavoritePlace;
  }

  function isFavoritePlace(placeId) {
    const normalizedPlaceId = normalizeText(placeId, "");
    if (!normalizedPlaceId) {
      return false;
    }

    if (State.favoritePlaceIds.has(normalizedPlaceId)) {
      return true;
    }

    const normalizedUuidPlaceId = normalizeUserId(normalizedPlaceId);
    return Boolean(normalizedUuidPlaceId && State.favoritePlaceIds.has(normalizedUuidPlaceId));
  }

  async function toggleFavoritePlace(placeId) {
    const normalizedPlaceId = normalizeText(placeId, "");
    if (!normalizedPlaceId) {
      return false;
    }

    if (isUserWriteBlocked()) {
      const bannedMessage = "Вы забанены. Изменение данных недоступно.";
      setStatus(bannedMessage, {
        type: "error",
        timeoutMs: Config.STATUS_CLEAR_MS
      });
      showToast(bannedMessage);
      return false;
    }

    const remoteFavoritePlaceId = normalizeUserId(normalizedPlaceId);
    const currentlyFavorite = isFavoritePlace(normalizedPlaceId);
    const nextFavoriteState = !currentlyFavorite;
    const syncBridge = getFavoritesSyncBridge();
    const authContext = await resolveFavoritesAuthContext(syncBridge);

    if (authContext.isAuthed) {
      if (!remoteFavoritePlaceId) {
        console.warn("[favorites] place_id is not UUID, remote sync skipped.", {
          placeId: normalizedPlaceId
        });
        setStatus(
          "Нельзя синхронизировать избранное: идентификатор места не является UUID.",
          { type: "error", timeoutMs: Config.STATUS_CLEAR_MS }
        );
        return currentlyFavorite;
      }

      try {
        let remoteIds = [];

        if (
          authContext.syncBridge &&
          typeof authContext.syncBridge.setFavorite === "function"
        ) {
          const bridgeResult = await authContext.syncBridge.setFavorite(
            remoteFavoritePlaceId,
            nextFavoriteState
          );
          remoteIds = Array.isArray(bridgeResult) ? bridgeResult : [];
          if (
            remoteIds.length === 0 &&
            typeof authContext.syncBridge.getFavoriteIds === "function"
          ) {
            remoteIds = await authContext.syncBridge.getFavoriteIds();
          }
        } else if (authContext.client && authContext.userId) {
          await setFavoriteViaSupabaseClient(
            authContext.client,
            authContext.userId,
            remoteFavoritePlaceId,
            nextFavoriteState
          );
          remoteIds = await fetchFavoriteIdsViaSupabaseClient(
            authContext.client,
            authContext.userId
          );
        } else {
          throw new Error("Supabase favorites sync is unavailable.");
        }

        State.favoritePlaceIds = new Set(
          (Array.isArray(remoteIds) ? remoteIds : [])
            .map((entry) => normalizeUserId(entry))
            .filter(Boolean)
        );
        FavoritesStore.write(State.favoritePlaceIds);
        applyFilters({ updateUrl: false, preserveSelection: true });
        showToast(nextFavoriteState ? "Добавлено в избранное" : "Удалено из избранного");
        return State.favoritePlaceIds.has(remoteFavoritePlaceId);
      } catch (error) {
        console.error("Remote favorite sync failed:", error);
        setStatus(
          normalizeText(error?.message, "Не удалось синхронизировать избранное с аккаунтом."),
          { type: "error", timeoutMs: Config.STATUS_CLEAR_MS }
        );
        return currentlyFavorite;
      }
    }

    if (nextFavoriteState) {
      State.favoritePlaceIds.add(normalizedPlaceId);
    } else {
      State.favoritePlaceIds.delete(normalizedPlaceId);
    }

    FavoritesStore.write(State.favoritePlaceIds);
    applyFilters({ updateUrl: false, preserveSelection: true });
    showToast(nextFavoriteState ? "Добавлено в избранное" : "Удалено из избранного");
    return nextFavoriteState;
  }

  async function refreshFavoritesForCurrentSession(options = {}) {
    const {
      preserveSelection = true
    } = options;

    const syncBridge = getFavoritesSyncBridge();
    try {
      const authContext = await resolveFavoritesAuthContext(syncBridge);
      if (!authContext.isAuthed) {
        State.favoritePlaceIds = FavoritesStore.read();
      } else if (
        authContext.syncBridge &&
        typeof authContext.syncBridge.getFavoriteIds === "function"
      ) {
        const ids = await authContext.syncBridge.getFavoriteIds();
        State.favoritePlaceIds = new Set(
          (Array.isArray(ids) ? ids : [])
            .map((entry) => normalizeUserId(entry))
            .filter(Boolean)
        );
        FavoritesStore.write(State.favoritePlaceIds);
      } else if (authContext.client && authContext.userId) {
        const ids = await fetchFavoriteIdsViaSupabaseClient(
          authContext.client,
          authContext.userId
        );
        State.favoritePlaceIds = new Set(
          ids
            .map((entry) => normalizeUserId(entry))
            .filter(Boolean)
        );
        FavoritesStore.write(State.favoritePlaceIds);
      } else {
        State.favoritePlaceIds = FavoritesStore.read();
      }
    } catch (error) {
      console.warn("Favorites refresh fallback to local storage:", error);
      State.favoritePlaceIds = FavoritesStore.read();
    }

    if (State.allPlaces.length > 0) {
      applyFilters({ updateUrl: false, preserveSelection });
    }

    return State.favoritePlaceIds;
  }

  function getFavoritesSyncBridge() {
    const candidate = window.WorldAtlasSupabaseSync;
    if (
      candidate &&
      typeof candidate === "object" &&
      typeof candidate.isAuthenticated === "function" &&
      typeof candidate.getFavoriteIds === "function" &&
      typeof candidate.setFavorite === "function"
    ) {
      return candidate;
    }
    return null;
  }

  async function safeIsAuthenticated(syncBridge) {
    try {
      return Boolean(await syncBridge.isAuthenticated());
    } catch {
      return false;
    }
  }

  async function resolveFavoritesAuthContext(syncBridge) {
    const bridge = syncBridge || getFavoritesSyncBridge();
    if (bridge) {
      const isAuthedViaBridge = await safeIsAuthenticated(bridge);
      if (isAuthedViaBridge) {
        const bridgeUserId = typeof bridge.getCurrentUserId === "function"
          ? normalizeUserId(bridge.getCurrentUserId())
          : "";
        return {
          isAuthed: true,
          userId: bridgeUserId,
          syncBridge: bridge,
          client: null
        };
      }
    }

    const client = await resolveSupabaseClientForFavorites();
    if (!client) {
      return {
        isAuthed: false,
        userId: "",
        syncBridge: bridge,
        client: null
      };
    }

    const userId = await resolveSupabaseAuthUserIdForFavorites(client);
    return {
      isAuthed: Boolean(userId),
      userId,
      syncBridge: null,
      client
    };
  }

  async function resolveSupabaseClientForFavorites() {
    if (isSupabaseClientForFavorites(window.supabase)) {
      return window.supabase;
    }

    if (window.supabaseReady && typeof window.supabaseReady.then === "function") {
      try {
        const client = await withFavoritesTimeout(
          Promise.resolve(window.supabaseReady),
          9000,
          "Supabase favorites client timeout"
        );
        if (isSupabaseClientForFavorites(client)) {
          return client;
        }
      } catch {
        // fallback below
      }
    }

    return null;
  }

  function isSupabaseClientForFavorites(value) {
    return Boolean(
      value &&
      typeof value === "object" &&
      typeof value.from === "function" &&
      value.auth &&
      typeof value.auth.getUser === "function"
    );
  }

  async function resolveSupabaseAuthUserIdForFavorites(client) {
    try {
      const { data, error } = await withFavoritesTimeout(
        client.auth.getUser(),
        10000,
        "Supabase favorites auth timeout"
      );
      if (error) {
        return "";
      }
      return normalizeUserId(data?.user?.id);
    } catch {
      return "";
    }
  }

  async function fetchFavoriteIdsViaSupabaseClient(client, userId) {
    const safeUserId = normalizeUserId(userId);
    if (!safeUserId) {
      return [];
    }

    const { data, error } = await withFavoritesTimeout(
      client
        .from("favorites")
        .select("place_id")
        .eq("user_id", safeUserId),
      12000,
      "Supabase favorites fetch timeout"
    );
    if (error) {
      throw new Error(normalizeText(error?.message, "Failed to fetch favorites."));
    }

    const ids = [];
    for (const row of Array.isArray(data) ? data : []) {
      const favoriteId = normalizeUserId(row?.place_id);
      if (favoriteId) {
        ids.push(favoriteId);
      }
    }
    return ids;
  }

  async function setFavoriteViaSupabaseClient(client, userId, placeId, shouldFavorite) {
    const safeUserId = normalizeUserId(userId);
    const safePlaceId = normalizeUserId(placeId);
    if (!safeUserId) {
      throw new Error("Not authenticated.");
    }
    if (!safePlaceId) {
      throw new Error("placeId must be UUID.");
    }

    if (shouldFavorite) {
      const { error } = await withFavoritesTimeout(
        client
          .from("favorites")
          .upsert(
            {
              user_id: safeUserId,
              place_id: safePlaceId
            },
            {
              onConflict: "user_id,place_id"
            }
          ),
        12000,
        "Supabase favorites upsert timeout"
      );
      if (error) {
        throw new Error(normalizeText(error?.message, "Failed to add favorite."));
      }
      return;
    }

    const { error } = await withFavoritesTimeout(
      client
        .from("favorites")
        .delete()
        .eq("user_id", safeUserId)
        .eq("place_id", safePlaceId),
      12000,
      "Supabase favorites delete timeout"
    );
    if (error) {
      throw new Error(normalizeText(error?.message, "Failed to remove favorite."));
    }
  }

  async function withFavoritesTimeout(promiseLike, timeoutMs, timeoutMessage) {
    const timeout = Number(timeoutMs);
    if (!Number.isFinite(timeout) || timeout <= 0) {
      return Promise.resolve(promiseLike);
    }

    let timeoutId = null;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = window.setTimeout(() => {
        reject(new Error(normalizeText(timeoutMessage, "Favorites request timed out.")));
      }, timeout);
    });

    try {
      return await Promise.race([
        Promise.resolve(promiseLike),
        timeoutPromise
      ]);
    } finally {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    }
  }

  async function sharePlace(place) {
    if (!place || typeof place !== "object") {
      return false;
    }

    const placeId = normalizeText(place.id, "");
    if (!placeId) {
      return false;
    }

    const shareUrl = buildShareUrl(placeId);
    const shareTitle = normalizeText(place.name, "World Atlas Pro");
    const shareText = `${shareTitle} на карте World Atlas Pro`;

    if (navigator.share && (navigator.maxTouchPoints > 0 || window.matchMedia("(hover: none)").matches)) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl
        });
        showToast("Ссылка отправлена.");
        return true;
      } catch (error) {
        if (error && error.name === "AbortError") {
          return false;
        }
      }
    }

    const copied = await copyTextToClipboard(shareUrl);
    if (copied) {
      showToast("Ссылка скопирована");
      return true;
    }

    setStatus("Не удалось скопировать ссылку.", {
      type: "error",
      timeoutMs: Config.STATUS_CLEAR_MS
    });
    return false;
  }

  function setTopToolbarPopupState(isPopupVisible) {
    const shouldMute = Boolean(isPopupVisible);
    Elements.topToolbar.classList.toggle("is-muted-by-popup", shouldMute);
    Elements.appStatus.classList.toggle("is-muted-by-popup", shouldMute);
  }

  function scheduleUrlSync() {
    if (Runtime.urlTimerId) {
      window.clearTimeout(Runtime.urlTimerId);
      Runtime.urlTimerId = null;
    }

    Runtime.urlTimerId = window.setTimeout(() => {
      Runtime.urlTimerId = null;

      const nextState = {
        searchQuery: State.searchQuery,
        regionFilter: State.regionFilter,
        selectedPlaceId: State.selectedPlaceId,
        mapView: mapEngine ? mapEngine.getView() : State.mapView
      };

      UrlState.write(nextState);
    }, Config.URL_SYNC_DEBOUNCE_MS);
  }

  function cancelPendingDeleteOverviewAnimation() {
    if (Runtime.placeDeleteZoomRafId) {
      window.cancelAnimationFrame(Runtime.placeDeleteZoomRafId);
      Runtime.placeDeleteZoomRafId = null;
    }

    if (Runtime.placeDeleteZoomNestedRafId) {
      window.cancelAnimationFrame(Runtime.placeDeleteZoomNestedRafId);
      Runtime.placeDeleteZoomNestedRafId = null;
    }
  }

  function animateMapAfterPlaceDeletion() {
    if (!mapEngine) {
      return false;
    }

    cancelPendingDeleteOverviewAnimation();

    Runtime.placeDeleteZoomRafId = window.requestAnimationFrame(() => {
      Runtime.placeDeleteZoomRafId = null;

      Runtime.placeDeleteZoomNestedRafId = window.requestAnimationFrame(() => {
        Runtime.placeDeleteZoomNestedRafId = null;

        if (!mapEngine) {
          return;
        }

        const filteredPlaces = Array.isArray(State.filteredPlaces)
          ? State.filteredPlaces.filter((entry) => isValidPlace(entry))
          : [];
        const allPlaces = Array.isArray(State.allPlaces)
          ? State.allPlaces.filter((entry) => isValidPlace(entry))
          : [];
        const overviewPlaces = filteredPlaces.length > 0 ? filteredPlaces : allPlaces;

        if (overviewPlaces.length > 0) {
          mapEngine.fitToPlaces(overviewPlaces);
        } else {
          mapEngine.resetView();
        }

        scheduleUrlSync();
      });
    });

    return true;
  }

  function setStatus(message, options = {}) {
    const {
      type = "info",
      timeoutMs = 0
    } = options;

    Elements.appStatus.textContent = typeof message === "string" ? message : "";
    Elements.appStatus.classList.remove("app-status--error", "app-status--success");

    if (type === "error") {
      Elements.appStatus.classList.add("app-status--error");
    }
    if (type === "success") {
      Elements.appStatus.classList.add("app-status--success");
    }

    if (Runtime.statusTimerId) {
      window.clearTimeout(Runtime.statusTimerId);
      Runtime.statusTimerId = null;
    }

    if (timeoutMs > 0 && message) {
      Runtime.statusTimerId = window.setTimeout(() => {
        Runtime.statusTimerId = null;
        Elements.appStatus.textContent = "";
        Elements.appStatus.classList.remove("app-status--error", "app-status--success");
      }, timeoutMs);
    }
  }

  function isSupabaseRelationMissing(error, tableName = "") {
    const code = normalizeText(error?.code, "").toUpperCase();
    const message = normalizeText(error?.message, "");
    const details = normalizeText(error?.details, "");
    const hint = normalizeText(error?.hint, "");
    const source = `${message} ${details} ${hint}`.toLowerCase();
    const safeTableName = normalizeText(tableName, "").toLowerCase();

    if (code === "42P01" || code === "PGRST205") {
      return true;
    }
    if (source.includes("could not find the table")) {
      return true;
    }
    if (source.includes("relation") && source.includes("does not exist")) {
      return true;
    }
    if (safeTableName && source.includes(safeTableName) && source.includes("schema cache")) {
      return true;
    }

    return false;
  }

  function markSupabasePlacesSchemaMissing(error) {
    if (Runtime.supabasePlacesSchemaMissing) {
      return;
    }
    Runtime.supabasePlacesSchemaMissing = true;
    console.warn(
      "[supabase] public places schema is unavailable, falling back to local API.",
      error
    );
  }

  function markSupabaseReviewSchemaMissing(error) {
    if (Runtime.supabaseReviewSchemaMissing) {
      return;
    }
    Runtime.supabaseReviewSchemaMissing = true;
    console.warn(
      "[supabase] reviews schema is unavailable, falling back to local popup feedback.",
      error
    );
  }

  function createApiClient(baseUrl) {
    const SUPABASE_WAIT_TIMEOUT_MS = 9000;
    const SUPABASE_QUERY_TIMEOUT_MS = 11000;
    const OPTIONAL_PLACE_COLUMNS = Object.freeze(["is_free", "family_friendly"]);
    const SIGNED_URL_MIN_TTL_SEC = 60;
    const SIGNED_URL_MAX_TTL_SEC = 604800;
    const USER_PLACE_IMAGE_PREFIX = "user-places";
    const PUBLIC_PLACE_IMAGE_PREFIX = "places";
    const BANNED_WRITE_MESSAGE = "Your account is banned. You cannot create content or upload photos.";
    const FROZEN_WRITE_MESSAGE = "Your account is in read-only mode. You cannot create content or upload photos.";
    const signedImageUrlCache = new Map();

    function isPlaceColumnUnsupported(columnName) {
      const safeColumnName = normalizeText(columnName, "").toLowerCase();
      if (!safeColumnName) {
        return false;
      }
      return Runtime.supabaseUnsupportedPlaceColumns.has(safeColumnName);
    }

    function markPlaceColumnUnsupported(columnName) {
      const safeColumnName = normalizeText(columnName, "").toLowerCase();
      if (!safeColumnName) {
        return;
      }
      if (!OPTIONAL_PLACE_COLUMNS.includes(safeColumnName)) {
        return;
      }
      if (Runtime.supabaseUnsupportedPlaceColumns.has(safeColumnName)) {
        return;
      }

      Runtime.supabaseUnsupportedPlaceColumns.add(safeColumnName);
      console.info(`[supabase] places.${safeColumnName} is unavailable, fallback enabled.`);
    }

    function isOptionalPlaceColumn(columnName) {
      const safeColumnName = normalizeText(columnName, "").toLowerCase();
      return OPTIONAL_PLACE_COLUMNS.includes(safeColumnName);
    }

    function pruneUnsupportedPlaceColumns(payload) {
      if (!payload || typeof payload !== "object") {
        return payload;
      }

      const next = { ...payload };
      for (const columnName of OPTIONAL_PLACE_COLUMNS) {
        if (isPlaceColumnUnsupported(columnName)) {
          delete next[columnName];
        }
      }
      return next;
    }

    function extractMissingPlaceColumn(error) {
      const code = normalizeText(error?.code, "").toUpperCase();
      const message = normalizeText(error?.message, "");
      const details = normalizeText(error?.details, "");
      const hint = normalizeText(error?.hint, "");
      const source = `${message} ${details} ${hint}`.toLowerCase();

      const hasKnownMissingCode =
        code === "PGRST204" ||
        code === "PGRST205" ||
        code === "42703";
      const hasMissingColumnHint =
        source.includes("schema cache") ||
        source.includes("column") ||
        source.includes("does not exist");

      if (!hasKnownMissingCode && !hasMissingColumnHint) {
        return "";
      }

      const pgrstMatch = /could not find the ['"]?([a-z0-9_]+)['"]?\s+column of ['"]?[a-z0-9_]+['"]?/i
        .exec(`${message} ${details}`);
      if (pgrstMatch) {
        return normalizeText(pgrstMatch[1], "").toLowerCase();
      }

      const pgMatch = /column\s+(?:["']?[a-z0-9_]+["']?\.)?["']?([a-z0-9_]+)["']?\s+does not exist/i
        .exec(source);
      if (pgMatch) {
        return normalizeText(pgMatch[1], "").toLowerCase();
      }

      for (const candidate of OPTIONAL_PLACE_COLUMNS) {
        if (source.includes(candidate)) {
          return candidate;
        }
      }

      return "";
    }

    function isSupabaseRelationMissing(error, tableName = "") {
      const code = normalizeText(error?.code, "").toUpperCase();
      const message = normalizeText(error?.message, "");
      const details = normalizeText(error?.details, "");
      const hint = normalizeText(error?.hint, "");
      const source = `${message} ${details} ${hint}`.toLowerCase();
      const safeTableName = normalizeText(tableName, "").toLowerCase();

      if (code === "42P01" || code === "PGRST205") {
        return true;
      }
      if (source.includes("could not find the table")) {
        return true;
      }
      if (source.includes("relation") && source.includes("does not exist")) {
        return true;
      }
      if (safeTableName && source.includes(safeTableName) && source.includes("schema cache")) {
        return true;
      }

      return false;
    }

    function markSupabasePlacesSchemaMissing(error) {
      if (Runtime.supabasePlacesSchemaMissing) {
        return;
      }
      Runtime.supabasePlacesSchemaMissing = true;
      console.warn(
        "[supabase] public places schema is unavailable, falling back to local API.",
        error
      );
    }

    function markSupabaseReviewSchemaMissing(error) {
      if (Runtime.supabaseReviewSchemaMissing) {
        return;
      }
      Runtime.supabaseReviewSchemaMissing = true;
      console.warn(
        "[supabase] reviews schema is unavailable, falling back to local popup feedback.",
        error
      );
    }

    function normalizeSubmitScopeForApi(rawScope) {
      return normalizeText(rawScope, "public").toLowerCase() === "my"
        ? "my"
        : "public";
    }

    function normalizeStorageSegment(rawValue, fallbackValue = "") {
      const normalized = normalizeText(rawValue, "")
        .replace(/[^A-Za-z0-9._-]+/g, "-")
        .replace(/^-+|-+$/g, "");
      return normalized || normalizeText(fallbackValue, "");
    }

    function normalizeStorageObjectPath(rawPath) {
      const normalized = normalizeText(rawPath, "")
        .replace(/\\/g, "/")
        .replace(/^\/+|\/+$/g, "")
        .replace(/\/{2,}/g, "/");
      if (!normalized) {
        return "";
      }

      return normalized
        .split("/")
        .map((entry) => normalizeStorageSegment(entry))
        .filter(Boolean)
        .join("/");
    }

    function clampSignedImageTtlSeconds(rawValue) {
      const fallbackTtl = clamp(
        Math.floor(Number(Config.SUPABASE_SIGNED_IMAGE_TTL_SEC) || 3600),
        SIGNED_URL_MIN_TTL_SEC,
        SIGNED_URL_MAX_TTL_SEC
      );
      const parsed = Math.floor(Number(rawValue));
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return fallbackTtl;
      }
      return clamp(parsed, SIGNED_URL_MIN_TTL_SEC, SIGNED_URL_MAX_TTL_SEC);
    }

    function isPrivateUserPlacePath(path, userId) {
      const safePath = normalizeStorageObjectPath(path);
      const safeUserId = normalizeUserId(userId);
      if (!safePath || !safeUserId) {
        return false;
      }
      const parts = safePath.split("/");
      return (
        parts.length >= 3 &&
        normalizeText(parts[0], "").toLowerCase() === USER_PLACE_IMAGE_PREFIX &&
        normalizeText(parts[1], "").toLowerCase() === safeUserId
      );
    }

    function isPublicPlacePath(path) {
      const safePath = normalizeStorageObjectPath(path);
      if (!safePath) {
        return false;
      }
      const parts = safePath.split("/");
      return (
        parts.length >= 3 &&
        normalizeText(parts[0], "").toLowerCase() === PUBLIC_PLACE_IMAGE_PREFIX
      );
    }

    async function resolveUserBanState(client, userId) {
      const safeUserId = normalizeUserId(userId);
      if (!safeUserId) {
        return false;
      }

      try {
        const rpcResult = await withTimeout(
          client.rpc("is_banned", {
            target_user_id: safeUserId
          }),
          SUPABASE_QUERY_TIMEOUT_MS,
          "Supabase is_banned RPC timeout"
        );
        if (!rpcResult?.error) {
          const directValue = Array.isArray(rpcResult.data) ? rpcResult.data[0] : rpcResult.data;
          if (typeof directValue === "boolean") {
            return directValue;
          }
          if (typeof directValue === "number") {
            return directValue === 1;
          }
        }
      } catch {
        // fallback below
      }

      try {
        const { data, error } = await withTimeout(
          client
            .from("user_bans")
            .select("user_id,banned,banned_until")
            .eq("user_id", safeUserId)
            .limit(1)
            .maybeSingle(),
          SUPABASE_QUERY_TIMEOUT_MS,
          "Supabase user_bans fallback timeout"
        );
        if (error) {
          return false;
        }
        const bannedUntil = normalizeText(data?.banned_until, "");
        if (data?.banned === false) {
          return false;
        }
        if (bannedUntil) {
          const timestamp = Date.parse(bannedUntil);
          if (Number.isFinite(timestamp) && timestamp <= Date.now()) {
            return false;
          }
        }
        return Boolean(data?.user_id);
      } catch {
        return false;
      }
    }

    async function resolveUserFreezeState(client, userId) {
      const safeUserId = normalizeUserId(userId);
      if (!safeUserId) {
        return false;
      }

      try {
        const rpcResult = await withTimeout(
          client.rpc("is_soft_frozen", {
            target_user_id: safeUserId
          }),
          SUPABASE_QUERY_TIMEOUT_MS,
          "Supabase is_soft_frozen RPC timeout"
        );
        if (!rpcResult?.error) {
          const directValue = Array.isArray(rpcResult.data) ? rpcResult.data[0] : rpcResult.data;
          if (typeof directValue === "boolean") {
            return directValue;
          }
          if (typeof directValue === "number") {
            return directValue === 1;
          }
        }
      } catch {
        // fallback below
      }

      try {
        const { data, error } = await withTimeout(
          client
            .from("user_freezes")
            .select("user_id,frozen,frozen_until")
            .eq("user_id", safeUserId)
            .limit(1)
            .maybeSingle(),
          SUPABASE_QUERY_TIMEOUT_MS,
          "Supabase user_freezes fallback timeout"
        );
        if (error) {
          return false;
        }
        const frozenUntil = normalizeText(data?.frozen_until, "");
        if (data?.frozen === false) {
          return false;
        }
        if (frozenUntil) {
          const timestamp = Date.parse(frozenUntil);
          if (Number.isFinite(timestamp) && timestamp <= Date.now()) {
            return false;
          }
        }
        return Boolean(data?.user_id);
      } catch {
        return false;
      }
    }

    async function resolveUserWriteRestrictionState(client, userId) {
      const [isBanned, isFrozen] = await Promise.all([
        resolveUserBanState(client, userId),
        resolveUserFreezeState(client, userId)
      ]);
      return {
        isBanned,
        isFrozen
      };
    }

    async function assertUserCanWrite(client, userId) {
      const restrictionState = await resolveUserWriteRestrictionState(client, userId);
      if (restrictionState.isBanned) {
        throw new Error(BANNED_WRITE_MESSAGE);
      }
      if (restrictionState.isFrozen) {
        throw new Error(FROZEN_WRITE_MESSAGE);
      }
    }

    return {
      getPlaces,
      getPlace,
      createPlace,
      updatePlace,
      patchPlace,
      deletePlace,
      getRegionsMeta,
      getPlaceWeather,
      getAddPlaceAccess,
      importPlacesFromJson,
      isAuthenticated,
      uploadPlaceImage
    };

    async function getPlaces(query = {}) {
      const normalizedTags = Array.isArray(query.tagsFilter)
        ? query.tagsFilter
        : (typeof query.tagsFilter === "string" ? query.tagsFilter.split(/[,\n;]+/g) : []);
      const normalized = {
        limit: query.limit ?? Config.PLACE_LIMIT,
        offset: query.offset ?? 0,
        q: query.q ?? "",
        region: query.region ?? "all",
        categoryFilter: query.categoryFilter ?? "all",
        tagsFilter: normalizeSmartTags(normalizedTags),
        onlyFree: Boolean(query.onlyFree),
        familyFriendly: Boolean(query.familyFriendly),
        sortBy: query.sortBy ?? "name",
        order: query.order ?? "asc"
      };
      const requestPlacesFromServer = async () => {
        const response = await requestJson("GET", "/places", { query: normalized });
        if (!supabaseClient || !Array.isArray(response?.items) || response.items.length === 0) {
          return response;
        }

        const hydratedItems = await hydratePublicPlaceImageRows(supabaseClient, response.items);
        return {
          ...response,
          items: hydratedItems
        };
      };

      const supabaseClient = await resolveSupabaseClient();
      if (supabaseClient) {
        const { user } = await getSupabaseAuthContext(supabaseClient);
        if (!user) {
          return requestPlacesFromServer();
        }
      }
      if (supabaseClient && !Runtime.supabasePlacesSchemaMissing) {
        try {
          return await getPlacesFromSupabase(supabaseClient, normalized);
        } catch (error) {
          if (isSupabaseRelationMissing(error, "places")) {
            markSupabasePlacesSchemaMissing(error);
          }
          console.warn("[places] Direct Supabase places load failed. Falling back to server API.", error);
          return requestPlacesFromServer();
        }
      }

      return requestPlacesFromServer();
    }

    async function getPlace(placeId, options = {}) {
      const normalizedPlaceId = normalizeText(placeId, "");
      const supabaseClient = await resolveSupabaseClient();
      if (supabaseClient) {
        const { user } = await getSupabaseAuthContext(supabaseClient);
        if (!user) {
          const response = await requestJson("GET", `/places/${encodeURIComponent(placeId)}`);
          if (!response?.item || !supabaseClient) {
            return response;
          }

          const hydratedItem = await hydratePublicPlaceImageRow(supabaseClient, response.item);
          return {
            ...response,
            item: hydratedItem
          };
        }
      }
      if (supabaseClient && normalizedPlaceId && !Runtime.supabasePlacesSchemaMissing) {
        try {
          return await getPlaceFromSupabase(supabaseClient, normalizedPlaceId, options);
        } catch (error) {
          if (!isSupabaseRelationMissing(error, "places")) {
            throw error;
          }
          markSupabasePlacesSchemaMissing(error);
        }
      }

      const response = await requestJson("GET", `/places/${encodeURIComponent(placeId)}`);
      if (!response?.item || !supabaseClient) {
        return response;
      }

      const hydratedItem = await hydratePublicPlaceImageRow(supabaseClient, response.item);
      return {
        ...response,
        item: hydratedItem
      };
    }

    async function createPlace(payload, options = {}) {
      const supabaseClient = await resolveSupabaseClient();
      if (supabaseClient) {
        const { user } = await getSupabaseAuthContext(supabaseClient);
        if (!user) {
          throw new Error("Please log in");
        }
        await assertUserCanWrite(supabaseClient, user.id);
        const scope = normalizeSubmitScopeForApi(options.scope ?? payload?.place_scope);
        if (scope === "public" && options.isAdmin !== true) {
          return createPublicPlaceSubmissionInSupabase(supabaseClient, payload, {
            userId: user.id
          });
        }
        return createPlaceInSupabase(supabaseClient, payload, {
          scope,
          user
        });
      }

      return requestJson("POST", "/places", { body: payload });
    }

    async function isAuthenticated() {
      const supabaseClient = await resolveSupabaseClient();
      if (!supabaseClient) {
        return false;
      }
      const { user } = await getSupabaseAuthContext(supabaseClient);
      return Boolean(user);
    }

    async function uploadPlaceImage(file, options = {}) {
      if (!(file instanceof File)) {
        throw new Error("Не выбран файл изображения.");
      }

      const supabaseClient = await resolveSupabaseClient();
      if (!supabaseClient) {
        throw new Error("Загрузка фото доступна только при активном Supabase.");
      }

      const { user } = await getSupabaseAuthContext(supabaseClient);
      if (!user) {
        throw new Error("Для загрузки фото требуется вход в аккаунт.");
      }
      await assertUserCanWrite(supabaseClient, user.id);

      const bucket = normalizeText(options.bucket, Config.SUPABASE_PLACE_IMAGES_BUCKET);
      if (!bucket) {
        throw new Error("Не задан bucket для хранения изображений.");
      }

      const authUserId = normalizeUserId(user.id);
      if (!authUserId) {
        throw new Error("Не удалось определить uid текущего пользователя.");
      }

      const requestedUserId = normalizeUserId(options.userId);
      if (requestedUserId && requestedUserId !== authUserId) {
        throw new Error("Загрузка доступна только в папку текущего пользователя.");
      }
      const ownerUserId = requestedUserId || authUserId;
      const pathPrefix = normalizeStorageObjectPath(
        options.pathPrefix || (normalizeText(options.access, "public").toLowerCase() === "private"
          ? USER_PLACE_IMAGE_PREFIX
          : PUBLIC_PLACE_IMAGE_PREFIX)
      );
      if (!pathPrefix) {
        throw new Error("Не задан префикс пути для Storage.");
      }

      const safeBaseName = normalizeText(file.name, "place-photo")
        .toLowerCase()
        .replace(/\.[a-z0-9]+$/i, "")
        .replace(/[^a-z0-9_-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48) || "place-photo";
      const extensionByMime = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "image/avif": "avif"
      };
      const extensionFromName = normalizeText(file.name, "")
        .toLowerCase()
        .match(/\.([a-z0-9]{2,6})$/)?.[1] || "";
      const extension = extensionByMime[file.type] || extensionFromName || "jpg";
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeBaseName}.${extension}`;
      const placeIdSegment = normalizeStorageSegment(options.placeId);
      const objectPathSegments = [pathPrefix, ownerUserId];
      if (placeIdSegment) {
        objectPathSegments.push(placeIdSegment);
      }
      objectPathSegments.push(fileName);
      const objectPath = objectPathSegments.join("/");

      const storage = supabaseClient.storage.from(bucket);
      const { error: uploadError } = await withTimeout(
        storage.upload(objectPath, file, {
          upsert: false,
          cacheControl: "3600",
          contentType: normalizeText(file.type, "application/octet-stream")
        }),
        SUPABASE_QUERY_TIMEOUT_MS,
        "Supabase image upload timeout"
      );

      if (uploadError) {
        const errorText = normalizeText(uploadError.message, "Не удалось загрузить фото.");
        const lowered = errorText.toLowerCase();
        if (lowered.includes("bucket") && lowered.includes("not found")) {
          throw new Error(`Bucket '${bucket}' не найден в Supabase Storage.`);
        }
        if (lowered.includes("permission") || lowered.includes("not allowed") || lowered.includes("unauthorized")) {
          throw new Error("Нет прав на загрузку фото. Проверьте Storage policies в Supabase.");
        }
        throw new Error(errorText);
      }

      const access = normalizeText(options.access, "public").toLowerCase() === "private"
        ? "private"
        : "public";
      const signedUrlExpiresInSeconds = clampSignedImageTtlSeconds(
        options.signedUrlExpiresInSeconds
      );

      let resolvedUrl = "";
      if (access === "private") {
        const { data: signedData, error: signedError } = await withTimeout(
          storage.createSignedUrl(objectPath, signedUrlExpiresInSeconds),
          SUPABASE_QUERY_TIMEOUT_MS,
          "Supabase create signed URL timeout"
        );
        if (signedError) {
          throw new Error(
            normalizeText(signedError.message, "Фото загружено, но не удалось создать signed URL.")
          );
        }
        resolvedUrl = normalizeHttpUrl(signedData?.signedUrl);
        if (!resolvedUrl) {
          throw new Error("Фото загружено, но signed URL пустой.");
        }
      } else {
        const { data: publicData } = storage.getPublicUrl(objectPath);
        resolvedUrl = normalizeHttpUrl(publicData?.publicUrl);
        if (!resolvedUrl) {
          throw new Error(
            "Фото загружено, но не удалось получить публичную ссылку. Проверьте настройки bucket."
          );
        }
      }

      return {
        url: resolvedUrl,
        path: objectPath,
        bucket,
        access,
        signedUrlExpiresInSeconds: access === "private" ? signedUrlExpiresInSeconds : null
      };
    }

    async function updatePlace(placeId, payload) {
      const supabaseClient = await resolveSupabaseClient();
      if (supabaseClient) {
        const { user } = await getSupabaseAuthContext(supabaseClient);
        if (!user) {
          throw new Error("Для редактирования точки требуется вход в аккаунт.");
        }
        await assertUserCanWrite(supabaseClient, user.id);
        return updatePlaceInSupabase(supabaseClient, placeId, payload, { partial: false });
      }

      return requestJson("PUT", `/places/${encodeURIComponent(placeId)}`, { body: payload });
    }

    async function patchPlace(placeId, payload) {
      const supabaseClient = await resolveSupabaseClient();
      if (supabaseClient) {
        const { user } = await getSupabaseAuthContext(supabaseClient);
        if (!user) {
          throw new Error("Для редактирования точки требуется вход в аккаунт.");
        }
        await assertUserCanWrite(supabaseClient, user.id);
        return updatePlaceInSupabase(supabaseClient, placeId, payload, { partial: true });
      }

      return requestJson("PATCH", `/places/${encodeURIComponent(placeId)}`, {
        body: payload
      });
    }

    async function deletePlace(placeId, options = {}) {
      const supabaseClient = await resolveSupabaseClient();
      if (supabaseClient) {
        const { user } = await getSupabaseAuthContext(supabaseClient);
        if (!user) {
          throw new Error("Please log in");
        }
        await assertUserCanWrite(supabaseClient, user.id);
        return deletePlaceInSupabase(supabaseClient, placeId, options);
      }

      return requestJson("DELETE", `/places/${encodeURIComponent(placeId)}`);
    }

    async function getRegionsMeta() {
      const requestRegionsMetaFromServer = () => requestJson("GET", "/meta/regions");
      const supabaseClient = await resolveSupabaseClient();
      if (supabaseClient) {
        const { user } = await getSupabaseAuthContext(supabaseClient);
        if (!user) {
          return requestRegionsMetaFromServer();
        }
      }
      if (supabaseClient && !Runtime.supabasePlacesSchemaMissing) {
        try {
          return await getRegionsMetaFromSupabase(supabaseClient);
        } catch (error) {
          if (isSupabaseRelationMissing(error, "places")) {
            markSupabasePlacesSchemaMissing(error);
          }
          console.warn("[places] Direct Supabase regions meta load failed. Falling back to server API.", error);
          return requestRegionsMetaFromServer();
        }
      }

      return requestRegionsMetaFromServer();
    }

    async function getPlaceWeather(place) {
      const safePlace = place && typeof place === "object" ? place : {};
      const lat = Number(safePlace.lat);
      const lon = Number(safePlace.lon ?? safePlace.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        throw new Error("Weather is unavailable for this place.");
      }

      const query = {
        lat: round(lat, 5),
        lon: round(lon, 5),
        name: normalizeText(safePlace.name ?? safePlace.title, ""),
        placeId: normalizeText(safePlace.id, "")
      };

      return requestJson("GET", "/weather", { query });
    }

    async function getAddPlaceAccess(options = {}) {
      const supabaseClient = await resolveSupabaseClient();
      if (!supabaseClient) {
        return {
          isAuthenticated: false,
          isAdmin: false,
          isBanned: false,
          isFrozen: false,
          freezeReason: "",
          frozenUntil: "",
          isFreezePermanent: false,
          userId: ""
        };
      }

      const sessionUser = options?.session?.user ?? null;
      const user = sessionUser || (await getSupabaseAuthContext(supabaseClient)).user;
      const userId = normalizeUserId(user?.id);
      if (!user || !userId) {
        return {
          isAuthenticated: false,
          isAdmin: false,
          isBanned: false,
          isFrozen: false,
          freezeReason: "",
          frozenUntil: "",
          isFreezePermanent: false,
          userId: ""
        };
      }

      let isAdmin = false;
      try {
        const rpcResult = await withTimeout(
          supabaseClient.rpc("is_active_admin"),
          SUPABASE_QUERY_TIMEOUT_MS,
          "Supabase is_active_admin RPC timeout"
        );
        if (!rpcResult?.error) {
          const rpcData = Array.isArray(rpcResult.data) ? rpcResult.data[0] : rpcResult.data;
          isAdmin = resolveBooleanInput(
            rpcData?.is_active_admin ?? rpcData?.isActiveAdmin ?? rpcData,
            false
          );
        }
      } catch {
        isAdmin = false;
      }

      if (!isAdmin) {
        try {
          const rpcResult = await withTimeout(
            supabaseClient.rpc("is_admin"),
          SUPABASE_QUERY_TIMEOUT_MS,
          "Supabase is_admin RPC timeout"
        );
          if (!rpcResult?.error) {
            const rpcData = Array.isArray(rpcResult.data) ? rpcResult.data[0] : rpcResult.data;
            isAdmin = resolveBooleanInput(
              rpcData?.is_admin ?? rpcData?.isAdmin ?? rpcData,
              false
            );
          }
        } catch {
          isAdmin = false;
        }
      }

      if (!isAdmin) {
        try {
          const profileResult = await withTimeout(
            supabaseClient
              .from("profiles")
              .select("role")
              .eq("id", userId)
              .maybeSingle(),
            SUPABASE_QUERY_TIMEOUT_MS,
            "Supabase profiles role query timeout"
          );
          const role = normalizeText(profileResult?.data?.role, "").toLowerCase();
          isAdmin = role === "admin";
        } catch {
          isAdmin = false;
        }
      }

      let isBanned = false;
      try {
        isBanned = await resolveUserBanState(supabaseClient, userId);
      } catch {
        isBanned = false;
      }

      let freezeReason = "";
      let frozenUntil = "";
      let isFreezePermanent = false;
      let isFrozen = false;
      try {
        const freezeResult = await withTimeout(
          supabaseClient
            .from("user_freezes")
            .select("user_id,frozen,reason,frozen_until")
            .eq("user_id", userId)
            .limit(1)
            .maybeSingle(),
          SUPABASE_QUERY_TIMEOUT_MS,
          "Supabase user_freezes query timeout"
        );
        const data = freezeResult?.data || null;
        const frozenFlag = data?.frozen !== false && Boolean(data?.user_id);
        const parsedUntil = normalizeText(data?.frozen_until, "");
        if (frozenFlag) {
          if (parsedUntil) {
            const freezeTimestamp = Date.parse(parsedUntil);
            if (Number.isFinite(freezeTimestamp) && freezeTimestamp > Date.now()) {
              isFrozen = true;
              frozenUntil = parsedUntil;
            }
          } else {
            isFrozen = true;
          }
          if (isFrozen) {
            freezeReason = normalizeText(data?.reason, "");
            isFreezePermanent = frozenUntil === "";
          }
        }
      } catch {
        isFrozen = false;
      }

      return {
        isAuthenticated: true,
        isAdmin,
        isBanned,
        isFrozen,
        freezeReason,
        frozenUntil,
        isFreezePermanent,
        userId
      };
    }

    async function importPlacesFromJson(options = {}) {
      const supabaseClient = await resolveSupabaseClient();
      if (!supabaseClient) {
        throw new Error("Supabase client is unavailable for import.");
      }

      const { user } = await getSupabaseAuthContext(supabaseClient);
      if (!user) {
        throw new Error("Для импорта требуется вход в аккаунт.");
      }

      const sourceCandidates = buildImportSourceCandidates(options.sourcePath);
      const { sourcePath, places } = await fetchPlacesImportSource(sourceCandidates);

      const chunkSize = clamp(
        Math.floor(Number(options.chunkSize) || 100),
        1,
        500
      );
      const summary = {
        sourcePath,
        total: places.length,
        prepared: 0,
        inserted: 0,
        skippedInvalid: 0,
        errors: []
      };

      const rows = [];
      for (let index = 0; index < places.length; index += 1) {
        const place = places[index];
        const payload = buildSupabasePlacePayload(place, { partial: false });
        const validationErrors = validateSupabasePlacePayload(payload, { partial: false });

        if (validationErrors.length > 0) {
          summary.skippedInvalid += 1;
          if (summary.errors.length < 30) {
            summary.errors.push(
              `row ${index + 1}: ${validationErrors.join(", ")}`
            );
          }
          continue;
        }

        rows.push(payload);
      }

      summary.prepared = rows.length;
      if (rows.length === 0) {
        return summary;
      }

      for (let offset = 0; offset < rows.length; offset += chunkSize) {
        let chunk = rows.slice(offset, offset + chunkSize);
        let data = null;
        let error = null;

        for (let attempt = 0; attempt < 3; attempt += 1) {
          const response = await withTimeout(
            supabaseClient
              .from("places")
              .insert(chunk)
              .select("id"),
            SUPABASE_QUERY_TIMEOUT_MS,
            "Supabase import places timeout"
          );
          data = response?.data || null;
          error = response?.error || null;
          if (!error) {
            break;
          }

          const missingColumn = extractMissingPlaceColumn(error);
          if (missingColumn && isOptionalPlaceColumn(missingColumn)) {
            markPlaceColumnUnsupported(missingColumn);
            chunk = chunk.map((row) => {
              const nextRow = { ...row };
              delete nextRow[missingColumn];
              return nextRow;
            });
            continue;
          }

          break;
        }

        if (error) {
          throw new Error(
            formatSupabaseWriteError(error, "Не удалось импортировать точки в Supabase.")
          );
        }

        summary.inserted += Array.isArray(data) ? data.length : chunk.length;
      }

      return summary;
    }

    async function getPlacesFromSupabase(client, query, retryAttempt = 0) {
      const limit = clamp(Math.floor(Number(query.limit) || Config.PLACE_LIMIT), 1, Config.PLACE_LIMIT);
      const offset = Math.max(0, Math.floor(Number(query.offset) || 0));
      const normalizedQuery = {
        q: normalizeText(query.q, ""),
        region: normalizeText(query.region, "all"),
        categoryFilter: normalizeSmartCategoryValue(query.categoryFilter),
        tagsFilter: normalizeSmartTags(query.tagsFilter),
        onlyFree: Boolean(query.onlyFree),
        familyFriendly: Boolean(query.familyFriendly),
        sortBy: query.sortBy ?? "name"
      };

      const { user } = await getSupabaseAuthContext(client);
      const currentUserId = normalizeSupabaseUserIdForFilter(user?.id);

      let publicRows = [];
      {
        let publicQuery = client
          .from("places")
          .select("*");
        publicQuery = applySupabaseVisibilityConstraint(publicQuery, currentUserId);
        publicQuery = publicQuery.range(0, Config.PLACE_LIMIT - 1);

        const { data, error } = await withTimeout(
          publicQuery,
          SUPABASE_QUERY_TIMEOUT_MS,
          "Supabase places query timeout"
        );
        if (error) {
          const missingColumn = extractMissingPlaceColumn(error);
          if (missingColumn && isOptionalPlaceColumn(missingColumn) && retryAttempt < 3) {
            markPlaceColumnUnsupported(missingColumn);
            return getPlacesFromSupabase(client, query, retryAttempt + 1);
          }
          if (isSupabaseRelationMissing(error, "places")) {
            markSupabasePlacesSchemaMissing(error);
            throw error;
          }
          throw new Error(
            normalizeText(error.message, "Supabase places request failed.")
          );
        }
        publicRows = Array.isArray(data) ? data : [];
        publicRows = await hydratePublicPlaceImageRows(client, publicRows);
      }

      let myRows = [];
      if (currentUserId) {
        const { data, error } = await withTimeout(
          client
            .from("user_places")
            .select("*")
            .eq("user_id", currentUserId)
            .range(0, Config.PLACE_LIMIT - 1),
          SUPABASE_QUERY_TIMEOUT_MS,
          "Supabase user_places query timeout"
        );

        if (error) {
          const relationMissing =
            normalizeText(error?.code, "").toUpperCase() === "42P01" ||
            (
              normalizeText(error?.message, "").toLowerCase().includes("relation") &&
              normalizeText(error?.message, "").toLowerCase().includes("does not exist")
            );
          if (!relationMissing) {
            throw new Error(normalizeText(error.message, "Supabase user places request failed."));
          }
        } else {
          myRows = Array.isArray(data) ? data : [];
          myRows = await hydrateUserPlaceImageRows(client, myRows, {
            currentUserId
          });
        }
      }

      const merged = dedupePlaces([
        ...publicRows
          .map((row) => mapSupabasePlaceToAppPlace(row, { scope: "public" }))
          .filter((place) => canReadPlaceByVisibility(place, currentUserId)),
        ...myRows
          .map((row) => mapSupabasePlaceToAppPlace(row, { scope: "my" }))
          .filter(Boolean)
      ]);

      const filtered = filterPlaces(
        merged,
        normalizedQuery.q,
        normalizedQuery.region,
        {
          categoryFilter: normalizedQuery.categoryFilter,
          tagsFilter: normalizedQuery.tagsFilter,
          onlyFree: normalizedQuery.onlyFree,
          familyFriendly: normalizedQuery.familyFriendly,
          sortBy: normalizedQuery.sortBy,
          favoritesOnly: false,
          favoritePlaceIds: new Set()
        }
      );

      return {
        items: filtered.slice(offset, offset + limit),
        total: filtered.length,
        limit,
        offset
      };
    }

    async function getPlaceFromSupabase(client, placeIdOrSlug, options = {}) {
      const safePlaceRef = normalizeText(placeIdOrSlug, "");
      if (!safePlaceRef) {
        throw new Error("Не указан идентификатор точки.");
      }

      const { user } = await getSupabaseAuthContext(client);
      const currentUserId = normalizeSupabaseUserIdForFilter(user?.id);
      const requestedScope = normalizeSubmitScopeForApi(options?.scope);
      const isUuidRef = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        .test(safePlaceRef);

      const slugCandidates = Array.from(
        new Set(
          [safePlaceRef, safePlaceRef.toLowerCase()]
            .map((entry) => normalizeText(entry, ""))
            .filter(Boolean)
        )
      );

      const lookupOrder = requestedScope === "my"
        ? ["my", "public"]
        : ["public", "my"];

      for (const scope of lookupOrder) {
        if (scope === "my" && !currentUserId) {
          continue;
        }

        const tableName = scope === "my" ? "user_places" : "places";
        const scopeSelect = scope === "my" ? "*" : "*";

        let data = null;
        let error = null;
        if (isUuidRef) {
          const idLookup = await withTimeout(
            client
              .from(tableName)
              .select(scopeSelect)
              .eq("id", safePlaceRef)
              .maybeSingle(),
            SUPABASE_QUERY_TIMEOUT_MS,
            "Supabase place query timeout"
          );
          data = idLookup?.data || null;
          error = idLookup?.error || null;
        }

        if (!data && !error && slugCandidates.length > 0 && scope === "public") {
          const slugLookup = await withTimeout(
            client
              .from(tableName)
              .select(scopeSelect)
              .in("slug", slugCandidates)
              .limit(1)
              .maybeSingle(),
            SUPABASE_QUERY_TIMEOUT_MS,
            "Supabase place query by slug timeout"
          );
          data = slugLookup?.data || null;
          error = slugLookup?.error || null;
        }

        if (error) {
          const relationMissing = isSupabaseRelationMissing(error, tableName);
          if (relationMissing && scope === "my") {
            continue;
          }
          if (relationMissing && scope === "public") {
            markSupabasePlacesSchemaMissing(error);
            throw error;
          }
          throw new Error(normalizeText(error.message, "Supabase place request failed."));
        }

        if (!data) {
          continue;
        }

        const sourceRow = scope === "my"
          ? await hydrateUserPlaceImageRow(client, data, { currentUserId })
          : await hydratePublicPlaceImageRow(client, data);
        const mappedPlace = mapSupabasePlaceToAppPlace(sourceRow, { scope });
        if (!mappedPlace) {
          continue;
        }
        if (!canReadPlaceByVisibility(mappedPlace, currentUserId)) {
          continue;
        }

        return mappedPlace;
      }

      throw new Error("Place not found.");
    }

    async function getRegionsMetaFromSupabase(client) {
      const counters = new Map();
      const placesResponse = await getPlacesFromSupabase(client, {
        limit: Config.PLACE_LIMIT,
        offset: 0,
        q: "",
        region: "all",
        categoryFilter: "all",
        tagsFilter: [],
        onlyFree: false,
        familyFriendly: false,
        sortBy: "name",
        order: "asc"
      });

      for (const place of Array.isArray(placesResponse?.items) ? placesResponse.items : []) {
        const region = normalizeText(place?.region, "Region unspecified");
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

      return {
        items,
        totalRegions: items.length
      };
    }

    function applySupabaseVisibilityConstraint(queryBuilder, currentUserId) {
      if (!queryBuilder) {
        return queryBuilder;
      }

      if (currentUserId) {
        return queryBuilder.or(`is_public.eq.true,created_by.eq.${currentUserId}`);
      }

      return queryBuilder.eq("is_public", true);
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

      if (resolvePlaceScope(place) === "my") {
        return true;
      }

      const ownerId = normalizeSupabaseUserIdForFilter(place.created_by);
      const isOwner = Boolean(ownerId && currentUserId && ownerId === currentUserId);
      const visibilityStatus = normalizeText(place.visibility_status ?? place.visibility, "").toLowerCase();
      const publishAtText = normalizeText(place.publish_at ?? place.publishAt, "");
      const publishAtMs = Date.parse(publishAtText);
      const isScheduledFuture = Number.isFinite(publishAtMs) && publishAtMs > Date.now();

      if (
        visibilityStatus === "pending" ||
        visibilityStatus === "rejected" ||
        visibilityStatus === "withdrawn" ||
        visibilityStatus === "scheduled" ||
        isScheduledFuture
      ) {
        return isOwner;
      }

      if (place.is_public !== false) {
        return true;
      }

      return isOwner;
    }

    async function createPlaceInSupabase(client, payload, options = {}) {
      const scope = normalizeSubmitScopeForApi(options.scope ?? payload?.place_scope);
      const userId = normalizeUserId(options?.user?.id);
      if (scope === "my") {
        return createUserPlaceInSupabase(client, payload, { userId });
      }

      const nextPayload = pruneUnsupportedPlaceColumns(
        buildSupabasePlacePayload(payload, { partial: false })
      );
      nextPayload.slug = buildClientPlaceSlug(
        nextPayload.slug || payload?.title || payload?.name,
        {
          lat: nextPayload.lat,
          lng: nextPayload.lng,
          alwaysUnique: true
        }
      );
      const validationErrors = validateSupabasePlacePayload(nextPayload, { partial: false });
      if (validationErrors.length > 0) {
        throw new Error(`Invalid place payload: ${validationErrors.join("; ")}`);
      }

      let data = null;
      let error = null;
      let payloadForInsert = { ...nextPayload, is_public: true };
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const response = await withTimeout(
          client
            .from("places")
            .insert(payloadForInsert)
            .select("*")
            .single(),
          SUPABASE_QUERY_TIMEOUT_MS,
          "Supabase create place timeout"
        );
        data = response?.data || null;
        error = response?.error || null;
        if (!error) {
          break;
        }

        const missingColumn = extractMissingPlaceColumn(error);
        if (
          missingColumn &&
          isOptionalPlaceColumn(missingColumn) &&
          Object.prototype.hasOwnProperty.call(payloadForInsert, missingColumn)
        ) {
          markPlaceColumnUnsupported(missingColumn);
          delete payloadForInsert[missingColumn];
          continue;
        }

        break;
      }

      if (error) {
        throw new Error(formatSupabaseWriteError(error, "Unable to create place."));
      }

      const hydratedData = await hydratePublicPlaceImageRow(client, data);
      const mappedPlace = mapSupabasePlaceToAppPlace(hydratedData, { scope: "public" });
      if (!mappedPlace) {
        throw new Error("Created place payload is invalid.");
      }

      return mappedPlace;
    }

    async function createPublicPlaceSubmissionInSupabase(client, payload, options = {}) {
      const userId = normalizeUserId(options.userId);
      if (!userId) {
        throw new Error("Please log in");
      }

      const nextPayload = pruneUnsupportedPlaceColumns(
        buildSupabasePlacePayload(payload, { partial: false })
      );
      delete nextPayload.is_public;
      nextPayload.slug = buildClientPlaceSlug(
        nextPayload.slug || payload?.title || payload?.name,
        {
          lat: nextPayload.lat,
          lng: nextPayload.lng,
          alwaysUnique: true
        }
      );

      const validationErrors = validateSupabasePlacePayload(nextPayload, { partial: false });
      if (validationErrors.length > 0) {
        throw new Error(`Invalid place payload: ${validationErrors.join("; ")}`);
      }

      const response = await withTimeout(
        client
          .from("place_submissions")
          .insert({
            ...nextPayload,
            submitter_user_id: userId,
            target_visibility: "public",
            submission_state: "pending"
          })
          .select("*")
          .single(),
        SUPABASE_QUERY_TIMEOUT_MS,
        "Supabase create place submission timeout"
      );

      if (response?.error) {
        throw new Error(
          formatSupabaseWriteError(response.error, "Unable to submit public place.")
        );
      }

      const hydratedData = await hydrateSubmissionImageRow(client, response?.data || null);
      const mappedPlace = mapSupabasePlaceToAppPlace(hydratedData, { scope: "public" });
      if (!mappedPlace) {
        throw new Error("Created submission payload is invalid.");
      }

      return mappedPlace;
    }

    async function createUserPlaceInSupabase(client, payload, options = {}) {
      const userId = normalizeUserId(options.userId);
      if (!userId) {
        throw new Error("Please log in");
      }

      const requestedPlaceId = normalizeUserId(payload?.id);
      const imageUrl = normalizeHttpUrl(payload?.image_url ?? payload?.image);
      const imagePath = normalizeStorageObjectPath(payload?.image_path ?? payload?.imagePath);
      const lat = Number(payload?.lat);
      const lng = Number(payload?.lng ?? payload?.lon);
      const basePayload = {
        title: normalizeText(payload?.title ?? payload?.name, ""),
        description: normalizeNullableText(payload?.description, ""),
        lat,
        lng,
        tags: normalizeTagArray(payload?.tags ?? payload?.highlights),
        category: normalizeNullableText(payload?.category ?? payload?.kind),
        region: normalizeNullableText(payload?.region),
        country: normalizeNullableText(payload?.country),
        is_free: resolveBooleanInput(payload?.is_free ?? payload?.isFree, false),
        family_friendly: resolveBooleanInput(payload?.family_friendly ?? payload?.familyFriendly, false),
        slug: buildClientPlaceSlug(payload?.slug || payload?.title || payload?.name, {
          lat,
          lng
        }),
        user_id: userId,
        ...(requestedPlaceId ? { id: requestedPlaceId } : {}),
        ...(imageUrl ? { image_url: imageUrl } : {}),
        ...(imagePath ? { image_path: imagePath } : {})
      };

      const requiredChecks = validateSupabasePlacePayload(
        {
          title: basePayload.title,
          lat: basePayload.lat,
          lng: basePayload.lng
        },
        { partial: false }
      );
      if (requiredChecks.length > 0) {
        throw new Error(`Invalid place payload: ${requiredChecks.join("; ")}`);
      }

      let lastError = null;
      let payloadForInsert = { ...basePayload };
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const response = await withTimeout(
          client
            .from("user_places")
            .insert(payloadForInsert)
            .select("*")
            .single(),
          SUPABASE_QUERY_TIMEOUT_MS,
          "Supabase create user place timeout"
        );

        const data = response?.data || null;
        const error = response?.error || null;
        if (!error) {
          const hydratedData = await hydrateUserPlaceImageRow(client, data, {
            currentUserId: userId
          });
          const mappedPlace = mapSupabasePlaceToAppPlace(hydratedData, { scope: "my" });
          if (!mappedPlace) {
            throw new Error("Created place payload is invalid.");
          }
          return mappedPlace;
        }

        lastError = error;
        const missingColumn = extractMissingPlaceColumn(error);
        if (!missingColumn) {
          break;
        }
        if (missingColumn === "user_id") {
          throw new Error("Schema error: user_places.user_id is required for strict RLS.");
        }
        if (
          isOptionalPlaceColumn(missingColumn) &&
          Object.prototype.hasOwnProperty.call(payloadForInsert, missingColumn)
        ) {
          markPlaceColumnUnsupported(missingColumn);
          delete payloadForInsert[missingColumn];
          continue;
        }
        break;
      }

      if (lastError) {
        throw new Error(formatSupabaseWriteError(lastError, "Unable to create place."));
      }
      throw new Error("Unable to create place.");
    }

    async function updatePlaceInSupabase(client, placeId, payload, options = {}) {
      const { partial = false } = options;
      const normalizedPlaceId = normalizeText(placeId, "");
      if (!normalizedPlaceId) {
        throw new Error("Не указан id точки.");
      }

      const nextPayload = pruneUnsupportedPlaceColumns(
        buildSupabasePlacePayload(payload, { partial })
      );
      const validationErrors = validateSupabasePlacePayload(nextPayload, { partial });
      if (validationErrors.length > 0) {
        throw new Error(`Некорректные данные точки: ${validationErrors.join("; ")}`);
      }

      let data = null;
      let error = null;
      let payloadForUpdate = { ...nextPayload };
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const response = await withTimeout(
          client
            .from("places")
            .update(payloadForUpdate)
            .eq("id", normalizedPlaceId)
            .select("*")
            .maybeSingle(),
          SUPABASE_QUERY_TIMEOUT_MS,
          "Supabase update place timeout"
        );
        data = response?.data || null;
        error = response?.error || null;
        if (!error) {
          break;
        }

        const missingColumn = extractMissingPlaceColumn(error);
        if (
          missingColumn &&
          isOptionalPlaceColumn(missingColumn) &&
          Object.prototype.hasOwnProperty.call(payloadForUpdate, missingColumn)
        ) {
          markPlaceColumnUnsupported(missingColumn);
          delete payloadForUpdate[missingColumn];
          continue;
        }

        break;
      }

      if (error) {
        throw new Error(formatSupabaseWriteError(error, "Не удалось изменить точку."));
      }

      if (!data) {
        throw new Error("Точка не найдена или нет прав на изменение.");
      }

      const mappedPlace = mapSupabasePlaceToAppPlace(data);
      if (!mappedPlace) {
        throw new Error("Обновлённая точка содержит некорректные поля.");
      }

      return mappedPlace;
    }

    async function deletePlaceInSupabase(client, placeId, options = {}) {
      const normalizedPlaceId = normalizeText(placeId, "");
      if (!normalizedPlaceId) {
        throw new Error("Не указан id точки.");
      }

      const requestedScope = normalizeSubmitScopeForApi(options?.scope);
      const hasExplicitScope = Object.prototype.hasOwnProperty.call(options || {}, "scope");
      const tableOrder = hasExplicitScope
        ? (requestedScope === "my" ? ["user_places"] : ["places"])
        : (requestedScope === "my" ? ["user_places", "places"] : ["places", "user_places"]);
      let lastError = null;

      for (const tableName of tableOrder) {
        const { data, error } = await withTimeout(
          client
            .from(tableName)
            .delete()
            .eq("id", normalizedPlaceId)
            .select("id")
            .maybeSingle(),
          SUPABASE_QUERY_TIMEOUT_MS,
          "Supabase delete place timeout"
        );

        if (error) {
          const relationMissing =
            normalizeText(error?.code, "").toUpperCase() === "42P01" ||
            (
              normalizeText(error?.message, "").toLowerCase().includes("relation") &&
              normalizeText(error?.message, "").toLowerCase().includes("does not exist")
            );
          if (relationMissing && tableName === "user_places") {
            continue;
          }
          lastError = error;
          continue;
        }

        if (data) {
          return {
            ok: true,
            id: normalizedPlaceId
          };
        }
      }

      if (lastError) {
        throw new Error(formatSupabaseWriteError(lastError, "Unable to delete place."));
      }
      throw new Error("Place not found.");
    }

    async function getSupabaseAuthContext(client) {
      const { data, error } = await withTimeout(
        client.auth.getUser(),
        SUPABASE_QUERY_TIMEOUT_MS,
        "Supabase auth user timeout"
      );

      if (error) {
        return { user: null };
      }

      return {
        user: data?.user || null
      };
    }

    async function hydrateUserPlaceImageRows(client, rows, options = {}) {
      if (!Array.isArray(rows) || rows.length === 0) {
        return Array.isArray(rows) ? rows : [];
      }

      const hydratedRows = await Promise.all(
        rows.map((row) => hydrateUserPlaceImageRow(client, row, options))
      );
      return hydratedRows;
    }

    async function hydratePublicPlaceImageRows(client, rows) {
      if (!Array.isArray(rows) || rows.length === 0) {
        return Array.isArray(rows) ? rows : [];
      }

      const hydratedRows = await Promise.all(
        rows.map((row) => hydratePublicPlaceImageRow(client, row))
      );
      return hydratedRows;
    }

    async function hydrateSubmissionImageRows(client, rows) {
      if (!Array.isArray(rows) || rows.length === 0) {
        return Array.isArray(rows) ? rows : [];
      }

      return Promise.all(rows.map((row) => hydrateSubmissionImageRow(client, row)));
    }

    function resolveStorageImagePathFromRow(row, matcher) {
      if (!row || typeof row !== "object") {
        return "";
      }

      const imagePathCandidates = [
        row.image_path,
        row.imagePath,
        row.photo_path,
        row.photoPath,
        row.image_url,
        row.image
      ];

      for (const candidate of imagePathCandidates) {
        const rawCandidate = normalizeText(candidate, "");
        if (!rawCandidate || normalizeHttpUrl(rawCandidate)) {
          continue;
        }
        const normalizedCandidate = normalizeStorageObjectPath(rawCandidate);
        if (!normalizedCandidate) {
          continue;
        }
        if (typeof matcher === "function" && !matcher(normalizedCandidate)) {
          continue;
        }
        return normalizedCandidate;
      }

      return "";
    }

    async function hydrateUserPlaceImageRow(client, row, options = {}) {
      if (!row || typeof row !== "object") {
        return row;
      }

      const ownerId = normalizeUserId(
        options.currentUserId ??
        row.user_id ??
        row.created_by ??
        row.createdBy
      );
      if (!ownerId) {
        return row;
      }

      const objectPath = resolveStorageImagePathFromRow(
        row,
        (candidatePath) => isPrivateUserPlacePath(candidatePath, ownerId)
      );
      if (!objectPath) {
        return hydrateSeasonalContentRow(client, row);
      }

      const signedUrl = await createSignedImageUrl(client, objectPath);
      if (!signedUrl) {
        return hydrateSeasonalContentRow(client, row);
      }

      return hydrateSeasonalContentRow(client, {
        ...row,
        image_path: objectPath,
        image_url: signedUrl,
        image: signedUrl
      });
    }

    async function hydratePublicPlaceImageRow(client, row) {
      if (!row || typeof row !== "object") {
        return row;
      }

      const objectPath = resolveStorageImagePathFromRow(row, (candidatePath) => (
        isPublicPlacePath(candidatePath)
      ));
      if (!objectPath) {
        return hydrateSeasonalContentRow(client, row);
      }

      const signedUrl = await createSignedImageUrl(client, objectPath);
      if (!signedUrl) {
        return hydrateSeasonalContentRow(client, row);
      }

      return hydrateSeasonalContentRow(client, {
        ...row,
        image_path: objectPath,
        image_url: signedUrl,
        image: signedUrl
      });
    }

    async function hydrateSubmissionImageRow(client, row) {
      if (!row || typeof row !== "object") {
        return row;
      }

      const objectPath = resolveStorageImagePathFromRow(
        row,
        (candidatePath) => Boolean(normalizeStorageObjectPath(candidatePath))
      );
      if (!objectPath) {
        return hydrateSeasonalContentRow(client, row);
      }

      const signedUrl = await createSignedImageUrl(client, objectPath);
      if (!signedUrl) {
        return hydrateSeasonalContentRow(client, row);
      }

      return hydrateSeasonalContentRow(client, {
        ...row,
        image_path: objectPath,
        image_url: signedUrl,
        image: signedUrl
      });
    }

    async function hydrateSeasonalContentRow(client, row) {
      if (!row || typeof row !== "object") {
        return row;
      }

      const seasonalContent = createSeasonalContentPayload(
        row.seasonal_content ?? row.seasonalContent
      );
      if (Object.keys(seasonalContent).length === 0) {
        return row;
      }

      const items = {};
      let changed = false;
      for (const seasonKey of seasonalContent.activeSeasons) {
        const item = normalizeSeasonalItemValue(seasonalContent.items?.[seasonKey]);
        if (!item) {
          continue;
        }

        const nextItem = {
          title: normalizeText(item.title, ""),
          description: normalizeText(item.description, ""),
          image_path: normalizeText(item.image_path, ""),
          image_url: normalizeHttpUrl(item.image_url ?? item.image) || ""
        };

        const objectPath = resolveStorageImagePathFromRow(nextItem, (candidatePath) => (
          Boolean(normalizeStorageObjectPath(candidatePath))
        ));
        if (objectPath) {
          const signedUrl = await createSignedImageUrl(client, objectPath);
          if (signedUrl) {
            nextItem.image_path = objectPath;
            nextItem.image_url = signedUrl;
            changed = true;
          }
        }

        items[seasonKey] = nextItem;
      }

      const nextSeasonalContent = {
        ...seasonalContent,
        items
      };

      if (!changed) {
        return {
          ...row,
          seasonal_content: nextSeasonalContent
        };
      }

      return {
        ...row,
        seasonal_content: nextSeasonalContent
      };
    }

    async function createSignedImageUrl(client, objectPath) {
      const safePath = normalizeStorageObjectPath(objectPath);
      if (!safePath) {
        return "";
      }

      const cacheEntry = signedImageUrlCache.get(safePath);
      const nowMs = Date.now();
      if (
        cacheEntry &&
        typeof cacheEntry.url === "string" &&
        cacheEntry.url &&
        Number.isFinite(cacheEntry.expiresAtMs) &&
        cacheEntry.expiresAtMs > nowMs + 30 * 1000
      ) {
        return cacheEntry.url;
      }

      const expiresIn = clampSignedImageTtlSeconds();
      const storage = client.storage.from(Config.SUPABASE_PLACE_IMAGES_BUCKET);
      const { data, error } = await withTimeout(
        storage.createSignedUrl(safePath, expiresIn),
        SUPABASE_QUERY_TIMEOUT_MS,
        "Supabase create signed image URL timeout"
      );
      if (error) {
        console.warn("[supabase] createSignedUrl failed for user place image:", error);
      }

      let resolvedUrl = normalizeHttpUrl(data?.signedUrl);
      if (!resolvedUrl) {
        const { data: publicData } = storage.getPublicUrl(safePath);
        resolvedUrl = normalizeHttpUrl(publicData?.publicUrl);
      }
      if (!resolvedUrl) {
        return "";
      }

      signedImageUrlCache.set(safePath, {
        url: resolvedUrl,
        expiresAtMs: nowMs + expiresIn * 1000
      });
      if (signedImageUrlCache.size > 400) {
        const firstKey = signedImageUrlCache.keys().next().value;
        if (typeof firstKey === "string") {
          signedImageUrlCache.delete(firstKey);
        }
      }

      return resolvedUrl;
    }

    function buildImportSourceCandidates(rawSourcePath) {
      const candidates = [];
      const pushUnique = (value) => {
        const normalized = normalizeText(value, "");
        if (normalized && !candidates.includes(normalized)) {
          candidates.push(normalized);
        }
      };

      pushUnique(rawSourcePath);
      pushUnique("/places.json");
      pushUnique("./places.json");

      return candidates;
    }

    async function fetchPlacesImportSource(sourceCandidates) {
      const candidates = Array.isArray(sourceCandidates) ? sourceCandidates : [];
      let lastError = null;

      for (const candidate of candidates) {
        try {
          const response = await fetch(candidate, {
            method: "GET",
            headers: {
              Accept: "application/json"
            },
            cache: "no-store"
          });

          if (!response.ok) {
            lastError = new Error(`Import source is unavailable: ${candidate}`);
            continue;
          }

          const json = await response.json();
          if (!Array.isArray(json)) {
            throw new Error(`Import source must contain an array: ${candidate}`);
          }

          return {
            sourcePath: candidate,
            places: json
          };
        } catch (error) {
          lastError = error;
        }
      }

      throw new Error(
        normalizeText(lastError?.message, "Не удалось загрузить источник импорта places.json.")
      );
    }

    function buildSupabasePlacePayload(payload, options = {}) {
      const { partial = false } = options;
      const source = (payload && typeof payload === "object") ? payload : {};
      const next = {};

      const hasTitle = Object.prototype.hasOwnProperty.call(source, "title");
      const hasName = Object.prototype.hasOwnProperty.call(source, "name");
      if (!partial || hasTitle || hasName) {
        next.title = normalizeText(source.title ?? source.name, "");
      }

      if (!partial || Object.prototype.hasOwnProperty.call(source, "country")) {
        next.country = normalizeNullableText(source.country);
      }
      if (!partial || Object.prototype.hasOwnProperty.call(source, "region")) {
        next.region = normalizeNullableText(source.region);
      }
      if (!partial || Object.prototype.hasOwnProperty.call(source, "description")) {
        next.description = normalizeNullableText(
          source.description,
          "Description unavailable."
        );
      }

      const hasLat = Object.prototype.hasOwnProperty.call(source, "lat");
      const hasLng =
        Object.prototype.hasOwnProperty.call(source, "lng") ||
        Object.prototype.hasOwnProperty.call(source, "lon");
      if (!partial || hasLat) {
        next.lat = Number(source.lat);
      }
      if (!partial || hasLng) {
        next.lng = Number(source.lng ?? source.lon);
      }

      const hasCategory = Object.prototype.hasOwnProperty.call(source, "category");
      const hasKind = Object.prototype.hasOwnProperty.call(source, "kind");
      if (!partial || hasCategory || hasKind) {
        next.category = normalizeNullableText(source.category ?? source.kind);
      }

      const hasTags = Object.prototype.hasOwnProperty.call(source, "tags");
      const hasHighlights = Object.prototype.hasOwnProperty.call(source, "highlights");
      if (!partial || hasTags || hasHighlights) {
        const rawTags = hasTags ? source.tags : source.highlights;
        next.tags = normalizeTagArray(rawTags);
      }

      const hasIsFree =
        Object.prototype.hasOwnProperty.call(source, "is_free") ||
        Object.prototype.hasOwnProperty.call(source, "isFree") ||
        Object.prototype.hasOwnProperty.call(source, "free") ||
        Object.prototype.hasOwnProperty.call(source, "onlyFree");
      if ((!partial || hasIsFree) && !isPlaceColumnUnsupported("is_free")) {
        next.is_free = resolveBooleanInput(
          source.is_free ?? source.isFree ?? source.free ?? source.onlyFree,
          false
        );
      }

      const hasFamilyFriendly =
        Object.prototype.hasOwnProperty.call(source, "family_friendly") ||
        Object.prototype.hasOwnProperty.call(source, "familyFriendly") ||
        Object.prototype.hasOwnProperty.call(source, "family");
      if ((!partial || hasFamilyFriendly) && !isPlaceColumnUnsupported("family_friendly")) {
        next.family_friendly = resolveBooleanInput(
          source.family_friendly ?? source.familyFriendly ?? source.family,
          false
        );
      }

      const hasImageUrl = Object.prototype.hasOwnProperty.call(source, "image_url");
      const hasImage = Object.prototype.hasOwnProperty.call(source, "image");
      if (!partial || hasImageUrl || hasImage) {
        next.image_url = normalizeHttpUrl(source.image_url ?? source.image);
      }
      const hasImagePath =
        Object.prototype.hasOwnProperty.call(source, "image_path") ||
        Object.prototype.hasOwnProperty.call(source, "imagePath");
      if (!partial || hasImagePath) {
        next.image_path = normalizeStorageObjectPath(source.image_path ?? source.imagePath) || null;
      }

      if (!partial || Object.prototype.hasOwnProperty.call(source, "slug")) {
        next.slug = normalizeText(source.slug, "");
      }

      const hasPublishAt =
        Object.prototype.hasOwnProperty.call(source, "publish_at") ||
        Object.prototype.hasOwnProperty.call(source, "publishAt");
      if (!partial || hasPublishAt) {
        next.publish_at = normalizeIsoTimestamp(source.publish_at ?? source.publishAt) || null;
      }

      const hasSeasonalContent =
        Object.prototype.hasOwnProperty.call(source, "seasonal_content") ||
        Object.prototype.hasOwnProperty.call(source, "seasonalContent");
      if (hasSeasonalContent) {
        next.seasonal_content = createSeasonalContentPayload(
          source.seasonal_content ?? source.seasonalContent
        );
      }

      const hasIsPublic =
        Object.prototype.hasOwnProperty.call(source, "is_public") ||
        Object.prototype.hasOwnProperty.call(source, "isPublic");
      if (hasIsPublic) {
        next.is_public = Boolean(source.is_public ?? source.isPublic);
      }

      if (partial) {
        for (const key of Object.keys(next)) {
          if (next[key] === undefined) {
            delete next[key];
          }
        }
      }

      return next;
    }

    function validateSupabasePlacePayload(payload, options = {}) {
      const { partial = false } = options;
      const errors = [];

      if (partial && Object.keys(payload).length === 0) {
        errors.push("отсутствуют поля для изменения");
        return errors;
      }

      if (!partial || Object.prototype.hasOwnProperty.call(payload, "title")) {
        if (normalizeText(payload.title, "") === "") {
          errors.push("title обязателен");
        }
      }

      if (!partial || Object.prototype.hasOwnProperty.call(payload, "lat")) {
        const lat = Number(payload.lat);
        if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
          errors.push("lat должен быть в диапазоне [-90, 90]");
        }
      }

      if (!partial || Object.prototype.hasOwnProperty.call(payload, "lng")) {
        const lng = Number(payload.lng);
        if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
          errors.push("lng должен быть в диапазоне [-180, 180]");
        }
      }

      if (Object.prototype.hasOwnProperty.call(payload, "image_url")) {
        const imageUrl = payload.image_url;
        if (imageUrl !== null && imageUrl !== "" && !normalizeHttpUrl(imageUrl)) {
          errors.push("image_url должен быть http/https URL");
        }
      }

      if (Object.prototype.hasOwnProperty.call(payload, "seasonal_content")) {
        const seasonalContent = createSeasonalContentPayload(payload.seasonal_content);
        if (
          seasonalContent &&
          Object.keys(seasonalContent).length > 0 &&
          (!Array.isArray(seasonalContent.activeSeasons) || seasonalContent.activeSeasons.length === 0)
        ) {
          errors.push("seasonal_content должен содержать хотя бы один активный сезон");
        }
      }

      return errors;
    }

    function normalizeTagArray(value) {
      if (!Array.isArray(value)) {
        return [];
      }

      return value
        .map((entry) => normalizeText(entry, ""))
        .filter(Boolean)
        .slice(0, 20);
    }

    function normalizeNullableText(value, fallbackValue = null) {
      const normalized = normalizeText(value, "");
      return normalized || fallbackValue;
    }

    function formatSupabaseWriteError(error, fallbackMessage) {
      const code = normalizeText(error?.code, "");
      const message = normalizeText(error?.message, fallbackMessage);
      const missingColumn = extractMissingPlaceColumn(error);
      const loweredMessage = message.toLowerCase();
      const details = normalizeText(error?.details, "").toLowerCase();
      const hint = normalizeText(error?.hint, "").toLowerCase();
      const source = `${loweredMessage} ${details} ${hint}`;

      if (source.includes("banned")) {
        return BANNED_WRITE_MESSAGE;
      }
      if (source.includes("freeze") || source.includes("read-only") || source.includes("read only")) {
        return FROZEN_WRITE_MESSAGE;
      }

      if (code === "42501") {
        if (loweredMessage.includes("row-level security") || loweredMessage.includes("rls")) {
          return "Permission denied by RLS policy.";
        }
        return "Permission denied.";
      }
      if (missingColumn) {
        if (missingColumn === "seasonal_content") {
          return "Seasonal points need the latest Supabase SQL patch.";
        }
        markPlaceColumnUnsupported(missingColumn);
        return "Server schema is updating. Please retry.";
      }

      return message;
    }

    function mapSupabasePlaceToAppPlace(row, options = {}) {
      if (!row || typeof row !== "object") {
        return null;
      }

      const scope = normalizeSubmitScopeForApi(
        options.scope ??
        row.place_scope ??
        row.scope ??
        (row.is_public === false ? "my" : "public")
      );
      const id = normalizeText(row.id, "");
      const name = normalizeText(row.title ?? row.name, "");
      const description = normalizeText(row.description, "Description unavailable.");
      const lat = Number(row.lat);
      const lon = Number(row.lng ?? row.lon);

      if (!id || !name || !Number.isFinite(lat) || !Number.isFinite(lon)) {
        return null;
      }

      const tags = Array.isArray(row.tags)
        ? row.tags
            .map((entry) => normalizeText(entry, ""))
            .filter(Boolean)
            .slice(0, 12)
        : [];
      const explicitVisibility = normalizeText(
        row.submission_state ?? row.visibility_status ?? row.visibility,
        ""
      ).toLowerCase();
      const isPublicRaw = row.is_public;
      const isPublic = scope === "my"
        ? false
        : (
          explicitVisibility === "approved" ||
          explicitVisibility === "public" ||
          (explicitVisibility === "" && isPublicRaw !== false)
        );
      const hasPendingReviewTag = tags.some(
        (entry) => normalizeText(entry, "").toLowerCase() === "pending-review"
      );
      const visibilityStatus = scope === "my"
        ? "private"
        : (
          explicitVisibility === "pending" ||
          explicitVisibility === "approved" ||
          explicitVisibility === "rejected" ||
          explicitVisibility === "scheduled" ||
          explicitVisibility === "withdrawn" ||
          explicitVisibility === "private"
            ? explicitVisibility
            : (
              isPublic
                ? "approved"
                : (hasPendingReviewTag ? "pending" : "private")
            )
        );

      const image = normalizeHttpUrl(row.image_url ?? row.image) || "";
      const imagePath = normalizeStorageObjectPath(row.image_path ?? row.imagePath);
      const link = normalizeHttpUrl(row.link) || "";
      const category = normalizeText(row.category ?? row.kind, "");
      const ownerId = normalizeText(row.created_by ?? row.createdBy ?? row.user_id, "");
      const seasonalContent = normalizeSeasonalContentValue(
        row.seasonal_content ?? row.seasonalContent
      );
      const populationValue = Number.isFinite(Number(row.population ?? row.pop))
        ? Number(row.population ?? row.pop)
        : null;
      const areaKm2Value = Number.isFinite(Number(row.area_km2 ?? row.areaKm2 ?? row.area))
        ? Number(row.area_km2 ?? row.areaKm2 ?? row.area)
        : null;
      const languageValue = Array.isArray(row.languages)
        ? row.languages
            .map((entry) => normalizeText(entry, ""))
            .filter(Boolean)
            .join(" / ")
        : normalizeText(row.languages, "");
      const mapped = {
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
        link,
        image,
        image_url: image,
        image_path: imagePath,
        category,
        kind: category,
        tags,
        highlights: tags.slice(0, 6),
        population: populationValue,
        pop: Number.isFinite(Number(row.pop)) ? Number(row.pop) : populationValue,
        areaKm2: areaKm2Value,
        area_km2: areaKm2Value,
        area: Number.isFinite(Number(row.area)) ? Number(row.area) : areaKm2Value,
        currency: normalizeText(row.currency, ""),
        currencies: row.currencies ?? null,
        language: row.language ?? null,
        languages: languageValue,
        utc: normalizeText(row.utc, ""),
        utcOffset: normalizeText(row.utc_offset ?? row.utcOffset, ""),
        utc_offset: normalizeText(row.utc_offset ?? row.utcOffset, ""),
        timezone: normalizeText(row.timezone ?? row.tz, ""),
        climate: normalizeText(row.climate, ""),
        founded: normalizeText(row.founded, ""),
        funFact: normalizeText(row.fun_fact ?? row.funFact, ""),
        isFree: resolveSupabaseBooleanField(row, ["is_free", "free", "only_free", "onlyFree"]),
        familyFriendly: resolveSupabaseBooleanField(row, ["family_friendly", "familyFriendly", "family"]),
        is_public: isPublic,
        place_scope: scope,
        visibility_status: visibilityStatus,
        publish_at: normalizeText(row.publish_at ?? row.publishAt, ""),
        publishAt: normalizeText(row.publish_at ?? row.publishAt, ""),
        seasonal_content: seasonalContent,
        review_reason: normalizeText(row.review_reason ?? row.reviewReason, ""),
        submission_state: normalizeText(row.submission_state, ""),
        created_by: ownerId,
        createdAt: normalizeText(row.created_at ?? row.createdAt, ""),
        updatedAt: normalizeText(row.updated_at ?? row.updatedAt, "")
      };

      return enrichPlaceWithSeedDetails(mapped);
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

    function resolveSupabaseSortColumn(sortBy) {
      const normalized = normalizeText(sortBy, "name").toLowerCase();
      if (normalized === "name" || normalized === "title") {
        return "title";
      }
      if (normalized === "country") {
        return "country";
      }
      if (normalized === "region") {
        return "region";
      }
      if (normalized === "category") {
        return "category";
      }
      if (normalized === "population") {
        return "population";
      }
      if (normalized === "createdat" || normalized === "created_at") {
        return "created_at";
      }
      if (normalized === "updatedat" || normalized === "updated_at") {
        return "updated_at";
      }
      if (normalized === "lat") {
        return "lat";
      }
      if (normalized === "lon" || normalized === "lng") {
        return "lng";
      }
      return "title";
    }

    function resolveSupabaseBooleanField(row, keys) {
      if (!row || typeof row !== "object" || !Array.isArray(keys)) {
        return false;
      }

      for (const key of keys) {
        if (!Object.prototype.hasOwnProperty.call(row, key)) {
          continue;
        }
        const value = row[key];
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
      }

      return false;
    }

    function buildSupabaseSearchPattern(rawQuery) {
      const normalized = normalizeText(rawQuery, "")
        .replace(/[%(),]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      if (!normalized) {
        return "";
      }

      return `%${normalized}%`;
    }

    async function resolveSupabaseClient() {
      const syncClient = resolveSupabaseClientSync();
      if (syncClient) {
        return syncClient;
      }

      if (window.supabaseReady && typeof window.supabaseReady.then === "function") {
        try {
          const readyClient = await withTimeout(
            Promise.resolve(window.supabaseReady),
            SUPABASE_WAIT_TIMEOUT_MS,
            "Supabase client init timeout"
          );
          if (isSupabaseClient(readyClient)) {
            return readyClient;
          }
        } catch {
          return resolveSupabaseClientSync();
        }
      }

      return resolveSupabaseClientSync();
    }

    function resolveSupabaseClientSync() {
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

    async function withTimeout(promiseLike, timeoutMs, timeoutMessage) {
      const timeoutPromise = new Promise((_, reject) => {
        window.setTimeout(() => {
          reject(new Error(timeoutMessage));
        }, timeoutMs);
      });

      return Promise.race([promiseLike, timeoutPromise]);
    }

    async function requestJson(method, path, options = {}) {
      const {
        query,
        body
      } = options;

      const requestUrl = buildUrl(`${baseUrl}${path}`, query);

      const response = await fetch(requestUrl, {
        method,
        cache: "no-store",
        headers: {
          Accept: "application/json",
          ...(body ? { "Content-Type": "application/json" } : {})
        },
        body: body ? JSON.stringify(body) : undefined
      });

      if (response.status === 204) {
        return null;
      }

      const payload = await parseJsonResponse(response);

      if (!response.ok) {
        const access = payload?.access && typeof payload.access === "object"
          ? payload.access
          : null;
        if (response.status === 403 && access?.isBanned === true) {
          applyUserBanUiState({
            userId: normalizeUserId(access.userId),
            visitorId: normalizeText(access.visitorId, ""),
            isBanned: true,
            source: normalizeText(access.source, ""),
            reason: normalizeText(access.reason, ""),
            bannedUntil: normalizeText(access.bannedUntil, ""),
            isPermanent: access.isPermanent === true,
            message: buildBanStateMessage({
              isBanned: true,
              source: normalizeText(access.source, ""),
              reason: normalizeText(access.reason, ""),
              bannedUntil: normalizeText(access.bannedUntil, ""),
              isPermanent: access.isPermanent === true
            })
          });
          redirectToBannedPage();
        }
        const message = payload?.error || `Request failed with status ${response.status}`;
        const details = Array.isArray(payload?.details) ? payload.details.join("; ") : "";
        throw new Error(details ? `${message}: ${details}` : message);
      }

      return payload;
    }
  }

  function createMapEngine(options) {
    if (!window.WorldAtlasMapModule || typeof window.WorldAtlasMapModule.initMap !== "function") {
      throw new Error("Map module is not loaded.");
    }

    return window.WorldAtlasMapModule.initMap({
      ...options,
      helpers: {
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
      }
    });
  }

  let mapModuleLoadPromise = null;

  function ensureMapModuleLoaded() {
    if (window.WorldAtlasMapModule && typeof window.WorldAtlasMapModule.initMap === "function") {
      return Promise.resolve(window.WorldAtlasMapModule);
    }

    if (mapModuleLoadPromise) {
      return mapModuleLoadPromise;
    }

    mapModuleLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      const cacheBust = Date.now().toString(36);
      script.src = `./map.js?v=20260409c&cb=${cacheBust}`;
      script.async = false;
      script.defer = true;
      script.dataset.worldAtlasMapModule = "1";

      script.onload = () => {
        if (window.WorldAtlasMapModule && typeof window.WorldAtlasMapModule.initMap === "function") {
          resolve(window.WorldAtlasMapModule);
          return;
        }

        mapModuleLoadPromise = null;
        reject(new Error("Map module loaded but initMap is unavailable."));
      };

      script.onerror = () => {
        mapModuleLoadPromise = null;
        reject(new Error("Failed to load map module script."));
      };

      document.body.append(script);
    });

    return mapModuleLoadPromise;
  }

  function createMapZoomSliderController(options) {
    const {
      rootEl,
      rangeEl,
      zoomInButtonEl = null,
      zoomOutButtonEl = null,
      mapEngine,
      minZoom = Config.MIN_ZOOM,
      maxZoom = Config.MAX_ZOOM
    } = options;

    if (!(rootEl instanceof HTMLElement) || !(rangeEl instanceof HTMLInputElement)) {
      return {
        syncFromView() {},
        destroy() {}
      };
    }

    const safeMinZoom = Number.isFinite(Number(minZoom))
      ? Number(minZoom)
      : Config.MIN_ZOOM;
    const safeMaxZoom = Number.isFinite(Number(maxZoom))
      ? Number(maxZoom)
      : Config.MAX_ZOOM;
    const sliderStep = 0.05;
    const zoomButtonStep = 0.26;
    const applyThrottleMs = 48;
    const hasZoomInButton = zoomInButtonEl instanceof HTMLButtonElement;
    const hasZoomOutButton = zoomOutButtonEl instanceof HTMLButtonElement;

    let rafId = null;
    let pendingZoom = null;
    let lastApplyAt = 0;
    let isPointerActive = false;

    rangeEl.min = String(safeMinZoom);
    rangeEl.max = String(safeMaxZoom);
    rangeEl.step = String(sliderStep);

    const clampZoom = (value) => clamp(Number(value), safeMinZoom, safeMaxZoom);

    const readMapZoom = () => {
      if (mapEngine && typeof mapEngine.getView === "function") {
        const view = mapEngine.getView();
        const zoomValue = Number(view?.zoom);
        if (Number.isFinite(zoomValue)) {
          return clampZoom(zoomValue);
        }
      }
      return clampZoom(rangeEl.value);
    };

    const setRangeValue = (value) => {
      const nextValue = clampZoom(value).toFixed(2);
      if (rangeEl.value !== nextValue) {
        rangeEl.value = nextValue;
      }
    };

    const stopLoop = () => {
      if (!rafId) {
        return;
      }
      window.cancelAnimationFrame(rafId);
      rafId = null;
    };

    const applyPendingZoom = (timestamp) => {
      rafId = null;
      if (pendingZoom === null) {
        return;
      }

      if (timestamp - lastApplyAt < applyThrottleMs) {
        ensureLoop();
        return;
      }

      const nextZoom = pendingZoom;
      pendingZoom = null;
      lastApplyAt = timestamp;
      if (mapEngine && typeof mapEngine.setZoom === "function") {
        mapEngine.setZoom(nextZoom, { animate: true });
      }
    };

    const ensureLoop = () => {
      if (!rafId) {
        rafId = window.requestAnimationFrame((timestamp) => {
          applyPendingZoom(timestamp);
          if (pendingZoom !== null) {
            ensureLoop();
          }
        });
      }
    };

    const queueZoom = (value, options = {}) => {
      const { syncRange = true } = options;
      pendingZoom = clampZoom(value);
      if (syncRange) {
        setRangeValue(pendingZoom);
      }
      ensureLoop();
    };

    const nudgeZoomBy = (delta) => {
      const baseZoom = pendingZoom !== null ? pendingZoom : readMapZoom();
      queueZoom(baseZoom + delta, { syncRange: true });
    };

    const handleInput = () => {
      queueZoom(rangeEl.value, { syncRange: false });
    };

    const handleChange = () => {
      queueZoom(rangeEl.value, { syncRange: false });
    };

    const handlePointerDown = () => {
      isPointerActive = true;
      rootEl.classList.add("is-dragging");
    };

    const handlePointerUp = () => {
      isPointerActive = false;
      rootEl.classList.remove("is-dragging");
      if (pendingZoom !== null) {
        setRangeValue(pendingZoom);
      }
    };

    const handleZoomInClick = () => {
      nudgeZoomBy(zoomButtonStep);
    };

    const handleZoomOutClick = () => {
      nudgeZoomBy(-zoomButtonStep);
    };

    rangeEl.addEventListener("input", handleInput);
    rangeEl.addEventListener("change", handleChange);
    rangeEl.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    if (hasZoomInButton) {
      zoomInButtonEl.addEventListener("click", handleZoomInClick);
    }
    if (hasZoomOutButton) {
      zoomOutButtonEl.addEventListener("click", handleZoomOutClick);
    }

    const syncFromView = (view) => {
      if (isPointerActive) {
        return;
      }
      if (pendingZoom !== null && rafId !== null) {
        setRangeValue(pendingZoom);
        return;
      }

      const sourceView = view && typeof view === "object"
        ? view
        : (mapEngine && typeof mapEngine.getView === "function" ? mapEngine.getView() : null);
      const nextZoom = clampZoom(sourceView?.zoom ?? safeMinZoom);
      setRangeValue(nextZoom);
    };

    syncFromView();

    return {
      syncFromView,
      destroy() {
        rangeEl.removeEventListener("input", handleInput);
        rangeEl.removeEventListener("change", handleChange);
        rangeEl.removeEventListener("pointerdown", handlePointerDown);
        window.removeEventListener("pointerup", handlePointerUp);
        window.removeEventListener("pointercancel", handlePointerUp);
        if (hasZoomInButton) {
          zoomInButtonEl.removeEventListener("click", handleZoomInClick);
        }
        if (hasZoomOutButton) {
          zoomOutButtonEl.removeEventListener("click", handleZoomOutClick);
        }
        rootEl.classList.remove("is-dragging");
        isPointerActive = false;
        pendingZoom = null;
        stopLoop();
      }
    };
  }

  function createOnboardingController(options) {
    const {
      overlayEl,
      panelEl,
      stepEl,
      titleEl,
      textEl,
      nextButtonEl,
      skipButtonEl,
      neverCheckboxEl,
      routePanelEl,
      routeBuildButtonEl,
      popupCardEl,
      popupSummaryEl,
      popupActionsEl,
      storageKey,
      getPlaces,
      mapEngine,
      popupController,
      sidebarController,
      selectPlaceById,
      setStatus
    } = options;

    const steps = [
      {
        id: "markers",
        title: "Выберите точку",
        text: "Наведите курсор на маркер — увидите подсказку. Клик открывает подробную карточку."
      },
      {
        id: "popup",
        title: "Откройте карточку",
        text: "Здесь блоки «Коротко» и «Действия»: быстрые факты, маршрут, избранное и шаринг."
      },
      {
        id: "route",
        title: "Постройте маршрут",
        text: "Выберите точки A и B, нажмите «Построить» — увидите дистанцию, время и тип маршрута."
      }
    ];

    const highlighted = [];
    const cleanupFns = [];
    let stepIndex = 0;
    let isActive = false;
    let isDestroyed = false;
    let stepTimerId = null;

    bindEvents();

    return {
      maybeStart,
      destroy
    };

    function bindEvents() {
      const nextHandler = () => {
        if (!isActive) {
          return;
        }

        if (stepIndex >= steps.length - 1) {
          finish("completed");
          return;
        }

        stepIndex += 1;
        applyCurrentStep();
      };

      const skipHandler = () => {
        if (!isActive) {
          return;
        }
        finish("skipped");
      };

      const keydownHandler = (event) => {
        if (!isActive) {
          return;
        }

        if (event.key === "Escape") {
          event.preventDefault();
          finish("skipped");
        }
      };

      nextButtonEl.addEventListener("click", nextHandler);
      skipButtonEl.addEventListener("click", skipHandler);
      document.addEventListener("keydown", keydownHandler);

      cleanupFns.push(() => nextButtonEl.removeEventListener("click", nextHandler));
      cleanupFns.push(() => skipButtonEl.removeEventListener("click", skipHandler));
      cleanupFns.push(() => document.removeEventListener("keydown", keydownHandler));
    }

    function maybeStart() {
      if (isDestroyed || isActive) {
        return false;
      }

      if (readSeenFlag()) {
        return false;
      }

      start();
      return true;
    }

    function start() {
      isActive = true;
      stepIndex = 0;
      overlayEl.hidden = false;
      document.body.classList.add("onboarding-active");
      applyCurrentStep();
      setStatus("Быстрый тур по интерфейсу запущен.", {
        type: "success",
        timeoutMs: 1500
      });
    }

    function applyCurrentStep() {
      if (!isActive) {
        return;
      }

      clearHighlights();
      clearStepTimer();

      const step = steps[stepIndex];
      if (!step) {
        finish("completed");
        return;
      }

      stepEl.textContent = `Шаг ${stepIndex + 1} из ${steps.length}`;
      titleEl.textContent = step.title;
      textEl.textContent = step.text;
      nextButtonEl.textContent = stepIndex === (steps.length - 1) ? "Готово" : "Далее";

      if (step.id === "markers") {
        applyMarkersStep();
        return;
      }

      if (step.id === "popup") {
        applyPopupStep();
        return;
      }

      applyRouteStep();
    }

    function applyMarkersStep() {
      ensureSidebarVisible();

      const candidateIds = getCandidatePlaceIds();
      let highlightedCount = 0;

      for (const placeId of candidateIds) {
        const markerElement = mapEngine?.getMarkerElement(placeId);
        if (!(markerElement instanceof HTMLElement)) {
          continue;
        }

        markerElement.classList.add("onboarding-focus-marker");
        highlighted.push({
          element: markerElement,
          className: "onboarding-focus-marker"
        });
        highlightedCount += 1;
      }

      if (highlightedCount === 0) {
        const retryToken = stepIndex;
        stepTimerId = window.setTimeout(() => {
          if (!isActive || stepIndex !== retryToken) {
            return;
          }
          applyMarkersStep();
        }, 220);
      }
    }

    function applyPopupStep() {
      const candidateId = getCandidatePlaceIds()[0];
      if (candidateId) {
        try {
          ensureSidebarVisible();
          selectPlaceById(candidateId);
        } catch (error) {
          console.warn("Onboarding popup selection failed:", error);
        }
      }

      const renderToken = stepIndex;
      stepTimerId = window.setTimeout(() => {
        if (!isActive || stepIndex !== renderToken) {
          return;
        }

        if (popupController && !popupController.isOpen && candidateId) {
          try {
            selectPlaceById(candidateId);
          } catch (error) {
            console.warn("Onboarding popup re-open failed:", error);
          }
        }

        addFocus(popupCardEl, "onboarding-focus");
        addFocus(popupSummaryEl, "onboarding-focus-soft");
        addFocus(popupActionsEl, "onboarding-focus-soft");
      }, 210);
    }

    function applyRouteStep() {
      ensureSidebarVisible();
      addFocus(routePanelEl, "onboarding-focus");
      addFocus(routeBuildButtonEl, "onboarding-focus-soft");
    }

    function addFocus(element, className) {
      if (!(element instanceof HTMLElement)) {
        return;
      }

      element.classList.add(className);
      highlighted.push({ element, className });
    }

    function clearHighlights() {
      while (highlighted.length > 0) {
        const item = highlighted.pop();
        if (!item || !(item.element instanceof HTMLElement)) {
          continue;
        }
        item.element.classList.remove(item.className);
      }
    }

    function clearStepTimer() {
      if (stepTimerId) {
        window.clearTimeout(stepTimerId);
        stepTimerId = null;
      }
    }

    function getCandidatePlaceIds() {
      const places = typeof getPlaces === "function" ? getPlaces() : [];
      if (!Array.isArray(places) || places.length === 0) {
        return [];
      }

      return places
        .filter(isValidPlace)
        .slice(0, 2)
        .map((place) => place.id)
        .filter((id) => typeof id === "string" && id.trim() !== "");
    }

    function ensureSidebarVisible() {
      return;
    }

    function finish(reason) {
      const closeReason = normalizeText(reason, "completed");
      const persistSeen = neverCheckboxEl.checked || closeReason === "completed";
      if (persistSeen) {
        writeSeenFlag(true);
      }

      isActive = false;
      clearStepTimer();
      clearHighlights();
      overlayEl.hidden = true;
      document.body.classList.remove("onboarding-active");

      if (closeReason === "completed") {
        showToast("Онбординг завершён");
      } else {
        showToast("Онбординг пропущен");
      }
    }

    function readSeenFlag() {
      try {
        const rawValue = window.localStorage.getItem(storageKey);
        return rawValue === "true";
      } catch {
        return false;
      }
    }

    function writeSeenFlag(value) {
      try {
        window.localStorage.setItem(storageKey, value ? "true" : "false");
      } catch (error) {
        console.warn("Onboarding storage write failed:", error);
      }
    }

    function destroy() {
      if (isDestroyed) {
        return;
      }

      isDestroyed = true;
      isActive = false;
      clearStepTimer();
      clearHighlights();
      overlayEl.hidden = true;
      document.body.classList.remove("onboarding-active");

      while (cleanupFns.length > 0) {
        const cleanupFn = cleanupFns.pop();
        try {
          cleanupFn();
        } catch (error) {
          console.error("Onboarding cleanup error:", error);
        }
      }
    }
  }

  function createSidebarController(options) {
    const {
      listElement,
      emptyElement,
      searchInput,
      regionFilter,
      favoritesFilterButton,
      smartFiltersOpenButton,
      smartFiltersBackdrop,
      smartFiltersPanel,
      smartFiltersCloseButton,
      smartCategoryFilter,
      smartTagInput,
      smartTagAddButton,
      smartTagsChips,
      smartOnlyFreeButton,
      smartFamilyFriendlyButton,
      smartSortFilter,
      smartFiltersApplyButton,
      smartFiltersResetButton,
      totalCounter,
      visibleCounter,
      sidebarElement,
      revealButton,
      onSelectPlace,
      onHoverPlace,
      onSearchChange,
      onRegionChange,
      onFavoritesToggle,
      onSmartApply,
      onClearFilters
    } = options;

    const PANEL_DRAG_STORAGE_KEY = "worldAtlasPro.sidebarDragOffsetY.v1";
    const PANEL_DRAG_EDGE_GAP_PX = 8;
    const desktopMediaQuery = window.matchMedia("(min-width: 1080px)");
    const cleanupFns = [];
    let panelVisible = false;
    let revealHideTimerId = null;
    let favoritesOnly = false;
    let smartPanelOpen = false;
    let smartPanelCloseTimerId = null;
    let smartTags = [];
    let smartCategory = DefaultSmartFilters.category;
    let smartSortBy = DefaultSmartFilters.sortBy;
    let smartOnlyFree = DefaultSmartFilters.onlyFree;
    let smartFamilyFriendly = DefaultSmartFilters.familyFriendly;
    // Sidebar drag is disabled: handles are visual-only and list scroll is the only movement.
    const panelDragHandles = [];
    let panelDragOffsetPx = 0;
    let panelDragPointerId = null;
    let panelDragStartClientY = 0;
    let panelDragStartOffsetPx = panelDragOffsetPx;
    let panelDragLastClientY = null;
    let panelDragRafId = null;
    let panelDragActive = false;
    let panelDragCaptureEl = null;
    const listButtonIndex = new Map();
    let activeListButton = null;
    let activeListPlaceId = "";
    let hoveredListButton = null;
    let hoveredListPlaceId = "";
    const LIST_INITIAL_RENDER_COUNT = 80;
    const LIST_CHUNK_SIZE = 40;
    const LIST_SCROLL_PRELOAD_PX = 420;
    let listPlacesSnapshot = [];
    let listFavoritePlaceIdsSnapshot = new Set();
    let listSelectedPlaceIdSnapshot = "";
    let listRenderedCount = 0;
    let listAppendRafId = 0;

    updatePanelVisibilityDom();
    applyPanelDragOffset(panelDragOffsetPx, { persist: false });
    const listDelegatedClick = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const button = target.closest(".point-item__button[data-place-id]");
      if (!(button instanceof HTMLButtonElement)) {
        return;
      }

      const placeId = button.dataset.placeId;
      if (typeof placeId === "string" && placeId.trim() !== "") {
        onSelectPlace(placeId);
        if (!desktopMediaQuery.matches) {
          setOpen(false);
        }
      }
    };

    listElement.addEventListener("click", listDelegatedClick);
    cleanupFns.push(() => listElement.removeEventListener("click", listDelegatedClick));

    const listAppendScrollHandler = () => {
      scheduleListAppendIfNeeded();
    };
    sidebarElement.addEventListener("scroll", listAppendScrollHandler, { passive: true });
    listElement.addEventListener("scroll", listAppendScrollHandler, { passive: true });
    cleanupFns.push(() => sidebarElement.removeEventListener("scroll", listAppendScrollHandler));
    cleanupFns.push(() => listElement.removeEventListener("scroll", listAppendScrollHandler));

    const listHoverHandler = (event) => {
      if (typeof onHoverPlace !== "function") {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const button = target.closest(".point-item__button[data-place-id]");
      if (!(button instanceof HTMLButtonElement)) {
        return;
      }

      const placeId = button.dataset.placeId;
      onHoverPlace(typeof placeId === "string" ? placeId : null);
    };

    const listLeaveHandler = () => {
      if (typeof onHoverPlace === "function") {
        onHoverPlace(null);
      }
    };

    const listFocusInHandler = (event) => {
      if (typeof onHoverPlace !== "function") {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const button = target.closest(".point-item__button[data-place-id]");
      if (!(button instanceof HTMLButtonElement)) {
        return;
      }

      const placeId = button.dataset.placeId;
      onHoverPlace(typeof placeId === "string" ? placeId : null);
    };

    const listFocusOutHandler = (event) => {
      if (typeof onHoverPlace !== "function") {
        return;
      }

      const nextFocused = event.relatedTarget;
      if (nextFocused instanceof Element && listElement.contains(nextFocused)) {
        return;
      }

      onHoverPlace(null);
    };

    listElement.addEventListener("pointerover", listHoverHandler);
    listElement.addEventListener("pointerleave", listLeaveHandler);
    listElement.addEventListener("focusin", listFocusInHandler);
    listElement.addEventListener("focusout", listFocusOutHandler);
    cleanupFns.push(() => listElement.removeEventListener("pointerover", listHoverHandler));
    cleanupFns.push(() => listElement.removeEventListener("pointerleave", listLeaveHandler));
    cleanupFns.push(() => listElement.removeEventListener("focusin", listFocusInHandler));
    cleanupFns.push(() => listElement.removeEventListener("focusout", listFocusOutHandler));

    const debouncedSearch = debounce(() => {
      onSearchChange(searchInput.value.trim());
    }, Config.SEARCH_DEBOUNCE_MS);

    const searchInputHandler = () => {
      debouncedSearch();
    };

    searchInput.addEventListener("input", searchInputHandler);
    cleanupFns.push(() => searchInput.removeEventListener("input", searchInputHandler));

    const regionChangeHandler = () => {
      onRegionChange(regionFilter.value);
    };

    regionFilter.addEventListener("change", regionChangeHandler);
    cleanupFns.push(() => regionFilter.removeEventListener("change", regionChangeHandler));

    const favoritesToggleHandler = () => {
      favoritesOnly = !favoritesOnly;
      applyFavoritesFilterUiState();
      if (typeof onFavoritesToggle === "function") {
        onFavoritesToggle(favoritesOnly);
      }
    };

    favoritesFilterButton.addEventListener("click", favoritesToggleHandler);
    cleanupFns.push(() => favoritesFilterButton.removeEventListener("click", favoritesToggleHandler));

    const clearFiltersHandler = () => {
      onClearFilters();
    };

    Elements.clearFiltersButton.addEventListener("click", clearFiltersHandler);
    cleanupFns.push(() => Elements.clearFiltersButton.removeEventListener("click", clearFiltersHandler));

    const closeSidebarHandler = () => {
      setPanelVisible(false);
      closeSmartFiltersPanel();
    };

    Elements.sidebarCloseButton.addEventListener("click", closeSidebarHandler);
    cleanupFns.push(() => Elements.sidebarCloseButton.removeEventListener("click", closeSidebarHandler));

    const revealClickHandler = () => {
      setPanelVisible(true);
    };

    revealButton.addEventListener("click", revealClickHandler);
    cleanupFns.push(() => revealButton.removeEventListener("click", revealClickHandler));

    const mediaQueryChangeHandler = () => {
      updatePanelVisibilityDom();
      applyPanelDragOffset(panelDragOffsetPx, { persist: false });
    };

    if (typeof desktopMediaQuery.addEventListener === "function") {
      desktopMediaQuery.addEventListener("change", mediaQueryChangeHandler);
      cleanupFns.push(() => desktopMediaQuery.removeEventListener("change", mediaQueryChangeHandler));
    } else {
      desktopMediaQuery.addListener(mediaQueryChangeHandler);
      cleanupFns.push(() => desktopMediaQuery.removeListener(mediaQueryChangeHandler));
    }

    const panelDragPointerDownHandler = (event) => {
      if (!panelVisible) {
        return;
      }
      if (event.button !== undefined && event.button !== 0) {
        return;
      }
      const target = event.currentTarget;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      panelDragActive = true;
      panelDragPointerId = Number.isFinite(Number(event.pointerId)) ? Number(event.pointerId) : null;
      panelDragStartClientY = Number.isFinite(Number(event.clientY)) ? Number(event.clientY) : 0;
      panelDragStartOffsetPx = panelDragOffsetPx;
      panelDragLastClientY = panelDragStartClientY;
      panelDragCaptureEl = target;
      sidebarElement.classList.add("is-panel-dragging");

      if (
        panelDragPointerId !== null &&
        typeof panelDragCaptureEl.setPointerCapture === "function"
      ) {
        try {
          panelDragCaptureEl.setPointerCapture(panelDragPointerId);
        } catch {}
      }

      if (panelDragRafId !== null) {
        window.cancelAnimationFrame(panelDragRafId);
        panelDragRafId = null;
      }

      window.addEventListener("pointermove", panelDragPointerMoveHandler, { passive: false });
      window.addEventListener("pointerup", panelDragPointerUpHandler, { passive: true });
      window.addEventListener("pointercancel", panelDragPointerCancelHandler, { passive: true });
      event.preventDefault();
    };

    const panelDragPointerMoveHandler = (event) => {
      if (!panelDragActive) {
        return;
      }
      if (panelDragPointerId !== null && Number(event.pointerId) !== panelDragPointerId) {
        return;
      }

      const currentClientY = Number.isFinite(Number(event.clientY)) ? Number(event.clientY) : panelDragStartClientY;
      panelDragLastClientY = currentClientY;

      if (panelDragRafId === null) {
        panelDragRafId = window.requestAnimationFrame(() => {
          panelDragRafId = null;
          if (!panelDragActive) {
            return;
          }

          const rafClientY = Number.isFinite(panelDragLastClientY)
            ? panelDragLastClientY
            : panelDragStartClientY;
          const deltaY = rafClientY - panelDragStartClientY;
          applyPanelDragOffset(panelDragStartOffsetPx + deltaY, { persist: false });
        });
      }

      event.preventDefault();
    };

    const panelDragPointerUpHandler = (event) => {
      if (panelDragPointerId !== null && Number(event.pointerId) !== panelDragPointerId) {
        return;
      }
      stopPanelDrag({ persist: true });
    };

    const panelDragPointerCancelHandler = (event) => {
      if (panelDragPointerId !== null && Number(event.pointerId) !== panelDragPointerId) {
        return;
      }
      stopPanelDrag({ persist: true });
    };

    const panelDragResizeHandler = () => {
      applyPanelDragOffset(panelDragOffsetPx, { persist: false });
    };

    for (const handleEl of panelDragHandles) {
      handleEl.addEventListener("pointerdown", panelDragPointerDownHandler);
      cleanupFns.push(() => handleEl.removeEventListener("pointerdown", panelDragPointerDownHandler));
    }

    window.addEventListener("resize", panelDragResizeHandler, { passive: true });
    cleanupFns.push(() => window.removeEventListener("resize", panelDragResizeHandler));

    const smartOpenHandler = () => {
      if (smartPanelOpen) {
        closeSmartFiltersPanel({ returnFocusToTrigger: true });
      } else {
        openSmartFiltersPanel();
      }
    };
    smartFiltersOpenButton.addEventListener("click", smartOpenHandler);
    cleanupFns.push(() => smartFiltersOpenButton.removeEventListener("click", smartOpenHandler));

    const smartCloseHandler = () => {
      closeSmartFiltersPanel();
    };
    smartFiltersCloseButton.addEventListener("click", smartCloseHandler);
    cleanupFns.push(() => smartFiltersCloseButton.removeEventListener("click", smartCloseHandler));

    const smartBackdropHandler = () => {
      closeSmartFiltersPanel();
    };
    smartFiltersBackdrop.addEventListener("click", smartBackdropHandler);
    cleanupFns.push(() => smartFiltersBackdrop.removeEventListener("click", smartBackdropHandler));

    const smartCategoryChangeHandler = () => {
      smartCategory = normalizeSmartCategoryValue(smartCategoryFilter.value);
      updateSmartTriggerUi();
    };
    smartCategoryFilter.addEventListener("change", smartCategoryChangeHandler);
    cleanupFns.push(() => smartCategoryFilter.removeEventListener("change", smartCategoryChangeHandler));

    const smartSortChangeHandler = () => {
      smartSortBy = normalizeSmartSortValue(smartSortFilter.value);
      updateSmartTriggerUi();
    };
    smartSortFilter.addEventListener("change", smartSortChangeHandler);
    cleanupFns.push(() => smartSortFilter.removeEventListener("change", smartSortChangeHandler));

    const areSmartTagListsEqual = (left, right) => {
      if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
        return false;
      }
      return left.every((entry, index) => entry === right[index]);
    };

    const commitSmartTagsFromInput = () => {
      const rawInput = normalizeText(smartTagInput.value, "");
      smartTagInput.value = "";
      if (!rawInput) {
        return false;
      }

      const parsedInputTags = rawInput
        .split(/[,\n;]+/g)
        .map((entry) => normalizeSmartTagValue(entry))
        .filter(Boolean);

      if (parsedInputTags.length === 0) {
        return false;
      }

      const nextTags = normalizeSmartTags([...smartTags, ...parsedInputTags]);
      if (areSmartTagListsEqual(nextTags, smartTags)) {
        return false;
      }

      smartTags = nextTags;
      renderSmartTagChips();
      updateSmartTriggerUi();
      return true;
    };

    const addTagFromInput = () => {
      commitSmartTagsFromInput();
    };

    const smartTagAddHandler = () => {
      addTagFromInput();
    };
    smartTagAddButton.addEventListener("click", smartTagAddHandler);
    cleanupFns.push(() => smartTagAddButton.removeEventListener("click", smartTagAddHandler));

    const smartTagInputKeydownHandler = (event) => {
      if (event.key !== "Enter" && event.key !== ",") {
        return;
      }
      event.preventDefault();
      addTagFromInput();
    };
    smartTagInput.addEventListener("keydown", smartTagInputKeydownHandler);
    cleanupFns.push(() => smartTagInput.removeEventListener("keydown", smartTagInputKeydownHandler));

    const smartTagsDelegatedClickHandler = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      const button = target.closest(".smart-tag-chip__remove[data-tag]");
      if (!(button instanceof HTMLButtonElement)) {
        return;
      }
      const tag = normalizeSmartTagValue(button.dataset.tag);
      if (!tag) {
        return;
      }
      smartTags = smartTags.filter((entry) => entry !== tag);
      renderSmartTagChips();
      updateSmartTriggerUi();
    };
    smartTagsChips.addEventListener("click", smartTagsDelegatedClickHandler);
    cleanupFns.push(() => smartTagsChips.removeEventListener("click", smartTagsDelegatedClickHandler));

    const smartOnlyFreeToggleHandler = () => {
      smartOnlyFree = !smartOnlyFree;
      syncSmartSwitchUi();
      updateSmartTriggerUi();
    };
    smartOnlyFreeButton.addEventListener("click", smartOnlyFreeToggleHandler);
    cleanupFns.push(() => smartOnlyFreeButton.removeEventListener("click", smartOnlyFreeToggleHandler));

    const smartFamilyToggleHandler = () => {
      smartFamilyFriendly = !smartFamilyFriendly;
      syncSmartSwitchUi();
      updateSmartTriggerUi();
    };
    smartFamilyFriendlyButton.addEventListener("click", smartFamilyToggleHandler);
    cleanupFns.push(() => smartFamilyFriendlyButton.removeEventListener("click", smartFamilyToggleHandler));

    const smartApplyHandler = () => {
      commitSmartTagsFromInput();
      const normalizedTags = normalizeSmartTags(smartTags);
      if (!areSmartTagListsEqual(normalizedTags, smartTags)) {
        smartTags = normalizedTags;
        renderSmartTagChips();
        updateSmartTriggerUi();
      }
      if (typeof onSmartApply === "function") {
        onSmartApply({
          category: smartCategory,
          tags: [...normalizedTags],
          onlyFree: smartOnlyFree,
          familyFriendly: smartFamilyFriendly,
          sortBy: smartSortBy
        });
      }
      closeSmartFiltersPanel({ returnFocusToTrigger: true });
    };
    smartFiltersApplyButton.addEventListener("click", smartApplyHandler);
    cleanupFns.push(() => smartFiltersApplyButton.removeEventListener("click", smartApplyHandler));

    const smartResetHandler = () => {
      setSmartFilterValues(DefaultSmartFilters);
      if (typeof onSmartApply === "function") {
        onSmartApply({ ...DefaultSmartFilters });
      }
    };
    smartFiltersResetButton.addEventListener("click", smartResetHandler);
    cleanupFns.push(() => smartFiltersResetButton.removeEventListener("click", smartResetHandler));

    const smartEscapeHandler = (event) => {
      if (event.key !== "Escape" || !smartPanelOpen) {
        return;
      }
      event.preventDefault();
      closeSmartFiltersPanel({ returnFocusToTrigger: true });
    };
    document.addEventListener("keydown", smartEscapeHandler);
    cleanupFns.push(() => document.removeEventListener("keydown", smartEscapeHandler));

    setSmartFilterValues(DefaultSmartFilters);

    return {
      renderList,
      renderRegionOptions,
      renderCategoryOptions,
      setCounters,
      setFavoritesState,
      setActive,
      setHovered,
      setFilterValues,
      setSmartFilterValues,
      setOpen,
      setPanelVisible,
      togglePanelVisibility,
      isPanelVisible,
      destroy
    };

    function renderList(places, selectedPlaceId, favoritePlaceIds = new Set()) {
      const fragment = document.createDocumentFragment();
      listButtonIndex.clear();
      activeListButton = null;
      activeListPlaceId = "";
      hoveredListButton = null;
      hoveredListPlaceId = "";
      const normalizedSelectedPlaceId = normalizeText(selectedPlaceId, "");
      listPlacesSnapshot = Array.isArray(places) ? places.slice() : [];
      listFavoritePlaceIdsSnapshot = favoritePlaceIds instanceof Set
        ? new Set(favoritePlaceIds)
        : new Set();
      listSelectedPlaceIdSnapshot = normalizedSelectedPlaceId;
      listRenderedCount = 0;

      appendListItemsToFragment(fragment, 0, Math.min(listPlacesSnapshot.length, LIST_INITIAL_RENDER_COUNT));
      listElement.replaceChildren(fragment);
      emptyElement.hidden = places.length !== 0;
      scheduleListAppendIfNeeded();
    }

    function scheduleListAppendIfNeeded() {
      if (listAppendRafId) {
        return;
      }
      listAppendRafId = window.requestAnimationFrame(() => {
        listAppendRafId = 0;
        appendListChunkIfNeeded();
      });
    }

    function appendListChunkIfNeeded() {
      if (listRenderedCount >= listPlacesSnapshot.length) {
        return false;
      }

      const scroller = sidebarElement;
      const distanceToEnd = Math.max(
        0,
        scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight
      );
      if (distanceToEnd > LIST_SCROLL_PRELOAD_PX && listRenderedCount > 0) {
        return false;
      }

      const fragment = document.createDocumentFragment();
      appendListItemsToFragment(
        fragment,
        listRenderedCount,
        Math.min(listPlacesSnapshot.length, listRenderedCount + LIST_CHUNK_SIZE)
      );
      if (fragment.childNodes.length > 0) {
        listElement.append(fragment);
      }
      return true;
    }

    function appendListItemsToFragment(fragment, startIndex, endIndex) {
      const safeStart = Math.max(0, Math.floor(Number(startIndex) || 0));
      const safeEnd = Math.max(safeStart, Math.floor(Number(endIndex) || safeStart));
      for (let index = safeStart; index < safeEnd; index += 1) {
        const place = listPlacesSnapshot[index];
        if (!place) {
          continue;
        }
        fragment.append(createPointListItem(place, index));
        listRenderedCount = Math.max(listRenderedCount, index + 1);
      }
    }

    function createPointListItem(place, index) {
      const item = document.createElement("li");
      item.className = "point-item";
      item.style.setProperty("--entry-index", String(index));

      const button = document.createElement("button");
      button.type = "button";
      button.className = "point-item__button";
      button.dataset.placeId = place.id;
      button.setAttribute("aria-label", `Открыть точку: ${place.name}`);
      if (typeof place.id === "string" && place.id) {
        listButtonIndex.set(place.id, button);
      }

      if (place.id === listSelectedPlaceIdSnapshot) {
        button.classList.add("is-active");
        button.setAttribute("aria-current", "true");
        activeListButton = button;
        activeListPlaceId = listSelectedPlaceIdSnapshot;
      }

      const layout = document.createElement("span");
      layout.className = "point-item__layout";

      const imageWrap = document.createElement("span");
      imageWrap.className = "point-item__thumb-wrap";

      const imageUrl = getPlaceImageUrl(place);
      const imageThumbUrl = imageUrl
        ? getPopupImageCandidates(imageUrl, 240)[0] || imageUrl
        : "";
      const shouldRenderThumbImage =
        Boolean(imageThumbUrl) &&
        typeof place.id === "string" &&
        place.id === listSelectedPlaceIdSnapshot;
      if (shouldRenderThumbImage) {
        const image = document.createElement("img");
        image.className = "point-item__thumb";
        image.src = imageThumbUrl;
        image.alt = `Фото: ${normalizeText(place.name, "Локация")}`;
        image.loading = "lazy";
        image.decoding = "async";
        image.referrerPolicy = "strict-origin-when-cross-origin";

        image.addEventListener("error", () => {
          image.remove();
          const imageFallback = document.createElement("span");
          imageFallback.className = "point-item__thumb-fallback";
          imageFallback.textContent = getPlaceInitials(place.name);
          imageWrap.append(imageFallback);
        }, { once: true });

        imageWrap.append(image);
      } else {
        const imageFallback = document.createElement("span");
        imageFallback.className = "point-item__thumb-fallback";
        imageFallback.textContent = getPlaceInitials(place.name);
        imageWrap.append(imageFallback);
      }

      const content = document.createElement("span");
      content.className = "point-item__content";

      const name = document.createElement("span");
      name.className = "point-item__name";
      const namePrefix = listFavoritePlaceIdsSnapshot.has(place.id) ? "★ " : "";
      name.textContent = `${namePrefix}${normalizeText(place.name, "Без названия")}`;

      const region = document.createElement("span");
      region.className = "point-item__meta";
      region.textContent = normalizeText(place.region, "Регион не указан");

      const quickFacts = document.createElement("span");
      quickFacts.className = "point-item__facts";

      const scope = resolvePlaceScope(place);
      const sourceChip = document.createElement("span");
      sourceChip.className = `point-item__fact-chip point-item__fact-chip--source-${scope}`;
      sourceChip.textContent = formatPlaceScopeLabel(place);
      quickFacts.append(sourceChip);

      const country = normalizeText(place.country, "");
      if (country) {
        const countryChip = document.createElement("span");
        countryChip.className = "point-item__fact-chip";
        countryChip.textContent = `${resolveCountryFlagEmoji(place?.countryCode)} ${country}`;
        quickFacts.append(countryChip);
      }

      const timezone = normalizeText(place.timezone, "");
      if (timezone) {
        const timezoneChip = document.createElement("span");
        timezoneChip.className = "point-item__fact-chip";
        timezoneChip.textContent = `🕒 ${timezone}`;
        quickFacts.append(timezoneChip);
      }

      const population = formatPopulation(place.population);
      if (population !== "—") {
        const populationChip = document.createElement("span");
        populationChip.className = "point-item__fact-chip";
        populationChip.textContent = `👥 ${population}`;
        quickFacts.append(populationChip);
      }

      if (listFavoritePlaceIdsSnapshot.has(place.id)) {
        const favoriteChip = document.createElement("span");
        favoriteChip.className = "point-item__fact-chip point-item__fact-chip--favorite";
        favoriteChip.textContent = "★ Избранное";
        quickFacts.append(favoriteChip);
      }

      const description = document.createElement("span");
      description.className = "point-item__description";
      description.textContent = truncate(
        normalizeText(place.description, "Описание отсутствует."),
        120
      );

      content.append(name, region);
      if (quickFacts.childElementCount > 0) {
        content.append(quickFacts);
      }
      content.append(description);

      const funFact = normalizeText(place.funFact, "");
      if (funFact) {
        const hint = document.createElement("span");
        hint.className = "point-item__hint";
        hint.textContent = truncate(`💡 ${funFact}`, 96);
        content.append(hint);
      }

      layout.append(imageWrap, content);
      button.append(layout);
      item.append(button);
      return item;
    }

    function renderRegionOptions(items, selectedValue) {
      const previous = typeof selectedValue === "string" ? selectedValue : "all";

      const fragment = document.createDocumentFragment();

      const allOption = document.createElement("option");
      allOption.value = "all";
      allOption.textContent = "Все регионы";
      fragment.append(allOption);

      for (const item of items) {
        const option = document.createElement("option");
        option.value = item.value;
        option.textContent = `${item.label} (${item.count})`;
        fragment.append(option);
      }

      regionFilter.replaceChildren(fragment);
      regionFilter.value = previous;
      if (regionFilter.value !== previous) {
        regionFilter.value = "all";
      }
    }

    function renderCategoryOptions(items, selectedValue = "all") {
      const previous = normalizeSmartCategoryValue(selectedValue);
      const fragment = document.createDocumentFragment();

      const allOption = document.createElement("option");
      allOption.value = "all";
      allOption.textContent = "All categories";
      fragment.append(allOption);

      for (const item of Array.isArray(items) ? items : []) {
        if (!item || typeof item !== "object") {
          continue;
        }
        const value = normalizeSmartCategoryValue(item.value);
        const label = normalizeText(item.label, "");
        const count = Number(item.count);
        if (!value || value === "all" || !label) {
          continue;
        }

        const option = document.createElement("option");
        option.value = value;
        option.textContent = Number.isFinite(count) && count > 0
          ? `${label} (${count})`
          : label;
        fragment.append(option);
      }

      smartCategoryFilter.replaceChildren(fragment);
      smartCategoryFilter.value = previous;
      if (smartCategoryFilter.value !== previous) {
        smartCategoryFilter.value = "all";
      }
      smartCategory = smartCategoryFilter.value;
    }

    function setCounters(total, visible) {
      totalCounter.textContent = String(total);
      visibleCounter.textContent = String(visible);
    }

    function setFavoritesState(isEnabled, favoritesCount) {
      favoritesOnly = Boolean(isEnabled);
      applyFavoritesFilterUiState();

      const safeCount = Number.isFinite(Number(favoritesCount))
        ? Math.max(0, Math.floor(Number(favoritesCount)))
        : 0;
      favoritesFilterButton.setAttribute(
        "aria-label",
        favoritesOnly
          ? `Показываются только избранные точки. Всего избранных: ${safeCount}.`
          : `Показывать только избранные точки. Сейчас избранных: ${safeCount}.`
      );
    }

    function setActive(placeId) {
      const normalizedPlaceId = normalizeText(placeId, "");
      if (
        normalizedPlaceId === activeListPlaceId &&
        activeListButton instanceof HTMLButtonElement &&
        activeListButton.isConnected
      ) {
        return;
      }

      if (activeListButton instanceof HTMLButtonElement) {
        activeListButton.classList.remove("is-active");
        activeListButton.removeAttribute("aria-current");
      }

      activeListButton = null;
      activeListPlaceId = "";

      const nextButton = normalizedPlaceId
        ? listButtonIndex.get(normalizedPlaceId)
        : null;
      if (nextButton instanceof HTMLButtonElement && nextButton.isConnected) {
        nextButton.classList.add("is-active");
        nextButton.setAttribute("aria-current", "true");
        activeListButton = nextButton;
        activeListPlaceId = normalizedPlaceId;
      }
    }

    function setHovered(placeId) {
      const normalizedPlaceId = normalizeText(placeId, "");
      if (
        normalizedPlaceId === hoveredListPlaceId &&
        hoveredListButton instanceof HTMLButtonElement &&
        hoveredListButton.isConnected
      ) {
        return;
      }

      if (hoveredListButton instanceof HTMLButtonElement) {
        hoveredListButton.classList.remove("is-hovered");
      }

      hoveredListButton = null;
      hoveredListPlaceId = "";

      const nextButton = normalizedPlaceId
        ? listButtonIndex.get(normalizedPlaceId)
        : null;
      if (nextButton instanceof HTMLButtonElement && nextButton.isConnected) {
        nextButton.classList.add("is-hovered");
        hoveredListButton = nextButton;
        hoveredListPlaceId = normalizedPlaceId;
      }
    }

    function setFilterValues(searchQuery, regionValue, favoritesValue = false, smartFilters = null) {
      searchInput.value = typeof searchQuery === "string" ? searchQuery : "";
      regionFilter.value = typeof regionValue === "string" ? regionValue : "all";
      if (regionFilter.value === "") {
        regionFilter.value = "all";
      }

      favoritesOnly = Boolean(favoritesValue);
      applyFavoritesFilterUiState();

      if (smartFilters && typeof smartFilters === "object") {
        setSmartFilterValues(smartFilters);
      }
    }

    function setSmartFilterValues(nextState) {
      const normalized = normalizeSmartFiltersState(nextState);
      smartCategory = normalized.category;
      smartTags = [...normalized.tags];
      smartOnlyFree = normalized.onlyFree;
      smartFamilyFriendly = normalized.familyFriendly;
      smartSortBy = normalized.sortBy;

      smartCategoryFilter.value = smartCategory;
      if (smartCategoryFilter.value !== smartCategory) {
        smartCategoryFilter.value = "all";
        smartCategory = "all";
      }
      smartSortFilter.value = smartSortBy;
      if (smartSortFilter.value !== smartSortBy) {
        smartSortFilter.value = DefaultSmartFilters.sortBy;
        smartSortBy = DefaultSmartFilters.sortBy;
      }

      smartTagInput.value = "";
      renderSmartTagChips();
      syncSmartSwitchUi();
      updateSmartTriggerUi();
    }

    function setOpen(isOpen) {
      if (!desktopMediaQuery.matches) {
        setPanelVisible(Boolean(isOpen));
      }
    }

    function setPanelVisible(isVisible) {
      panelVisible = Boolean(isVisible);
      if (!panelVisible) {
        stopPanelDrag({ persist: true });
      }
      updatePanelVisibilityDom();
    }

    function togglePanelVisibility() {
      setPanelVisible(!panelVisible);
    }

    function isPanelVisible() {
      return panelVisible;
    }

    function updatePanelVisibilityDom() {
      sidebarElement.classList.toggle("is-closed", !panelVisible);
      sidebarElement.classList.toggle("is-open", panelVisible && !desktopMediaQuery.matches);

      if (panelVisible) {
        revealButton.classList.remove("is-visible");

        if (revealHideTimerId) {
          window.clearTimeout(revealHideTimerId);
          revealHideTimerId = null;
        }

        revealHideTimerId = window.setTimeout(() => {
          if (panelVisible) {
            revealButton.hidden = true;
          }
          revealHideTimerId = null;
        }, 210);
      } else {
        if (revealHideTimerId) {
          window.clearTimeout(revealHideTimerId);
          revealHideTimerId = null;
        }

        if (revealButton.hidden) {
          revealButton.hidden = false;
        }

        requestAnimationFrame(() => {
          if (!panelVisible) {
            revealButton.classList.add("is-visible");
          }
        });
      }

      requestAnimationFrame(() => {
        applyPanelDragOffset(panelDragOffsetPx, { persist: false });
      });

    }

    function computePanelDragBounds() {
      const panelHeight = Math.max(
        0,
        Number(sidebarElement.getBoundingClientRect().height) || Number(sidebarElement.offsetHeight) || 0
      );
      const viewportHeight = Math.max(
        Number(window.innerHeight) || 0,
        Number(document.documentElement?.clientHeight) || 0
      );

      if (panelHeight <= 0 || viewportHeight <= 0) {
        return { min: 0, max: 0 };
      }

      const anchorTop = (viewportHeight * 0.5) - (panelHeight * 0.5);
      const minOffset = PANEL_DRAG_EDGE_GAP_PX - anchorTop;
      const maxOffset = (viewportHeight - PANEL_DRAG_EDGE_GAP_PX - panelHeight) - anchorTop;

      if (maxOffset < minOffset) {
        const fixed = (minOffset + maxOffset) / 2;
        return { min: fixed, max: fixed };
      }

      return { min: minOffset, max: maxOffset };
    }

    function clampPanelDragOffset(value) {
      const bounds = computePanelDragBounds();
      return clamp(Number(value) || 0, bounds.min, bounds.max);
    }

    function applyPanelDragOffset(value, options = {}) {
      const { persist = false } = options;
      const clamped = round(clampPanelDragOffset(value), 2);
      panelDragOffsetPx = clamped;
      sidebarElement.style.setProperty("--sidebar-drag-offset-px", `${clamped}px`);
      if (persist) {
        writeStoredPanelDragOffset(clamped);
      }
    }

    function readStoredPanelDragOffset() {
      try {
        const raw = window.localStorage.getItem(PANEL_DRAG_STORAGE_KEY);
        if (!raw) {
          return 0;
        }
        const parsed = Number(raw);
        return Number.isFinite(parsed) ? parsed : 0;
      } catch {
        return 0;
      }
    }

    function writeStoredPanelDragOffset(value) {
      try {
        window.localStorage.setItem(PANEL_DRAG_STORAGE_KEY, String(round(Number(value) || 0, 2)));
      } catch {}
    }

    function stopPanelDrag(options = {}) {
      const { persist = true } = options;
      if (!panelDragActive) {
        return;
      }

      panelDragActive = false;
      sidebarElement.classList.remove("is-panel-dragging");

      if (
        panelDragCaptureEl &&
        panelDragPointerId !== null &&
        typeof panelDragCaptureEl.releasePointerCapture === "function"
      ) {
        try {
          panelDragCaptureEl.releasePointerCapture(panelDragPointerId);
        } catch {}
      }

      panelDragPointerId = null;
      panelDragCaptureEl = null;

      if (panelDragRafId !== null) {
        window.cancelAnimationFrame(panelDragRafId);
        panelDragRafId = null;
      }

      if (Number.isFinite(panelDragLastClientY)) {
        const finalClientY = panelDragLastClientY;
        const deltaY = finalClientY - panelDragStartClientY;
        applyPanelDragOffset(panelDragStartOffsetPx + deltaY, { persist: false });
      }
      panelDragLastClientY = null;

      window.removeEventListener("pointermove", panelDragPointerMoveHandler);
      window.removeEventListener("pointerup", panelDragPointerUpHandler);
      window.removeEventListener("pointercancel", panelDragPointerCancelHandler);

      applyPanelDragOffset(panelDragOffsetPx, { persist });
    }

    function applyFavoritesFilterUiState() {
      favoritesFilterButton.classList.toggle("is-active", favoritesOnly);
      favoritesFilterButton.setAttribute("aria-pressed", String(favoritesOnly));
      favoritesFilterButton.textContent = favoritesOnly
        ? "★ Только избранное"
        : "☆ Только избранное";
    }

    function syncSmartSwitchUi() {
      smartOnlyFreeButton.setAttribute("aria-pressed", String(Boolean(smartOnlyFree)));
      smartFamilyFriendlyButton.setAttribute("aria-pressed", String(Boolean(smartFamilyFriendly)));
      smartOnlyFreeButton.classList.toggle("is-active", Boolean(smartOnlyFree));
      smartFamilyFriendlyButton.classList.toggle("is-active", Boolean(smartFamilyFriendly));
    }

    function renderSmartTagChips() {
      const fragment = document.createDocumentFragment();
      for (const tag of smartTags) {
        const chip = document.createElement("span");
        chip.className = "smart-tag-chip";

        const text = document.createElement("span");
        text.className = "smart-tag-chip__text";
        text.textContent = tag;

        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "smart-tag-chip__remove";
        remove.dataset.tag = tag;
        remove.setAttribute("aria-label", `Удалить тег ${tag}`);
        remove.textContent = "Г—";

        chip.append(text, remove);
        fragment.append(chip);
      }

      smartTagsChips.replaceChildren(fragment);
      smartTagsChips.classList.toggle("is-empty", smartTags.length === 0);

      if (smartTags.length === 0) {
        smartTagsChips.setAttribute("aria-label", "Теги не выбраны");
      } else {
        smartTagsChips.setAttribute("aria-label", `Выбрано тегов: ${smartTags.length}`);
      }
    }

    function countActiveSmartFilters() {
      let count = 0;
      if (smartCategory !== DefaultSmartFilters.category) {
        count += 1;
      }
      if (smartTags.length > 0) {
        count += 1;
      }
      if (smartOnlyFree !== DefaultSmartFilters.onlyFree) {
        count += 1;
      }
      if (smartFamilyFriendly !== DefaultSmartFilters.familyFriendly) {
        count += 1;
      }
      if (smartSortBy !== DefaultSmartFilters.sortBy) {
        count += 1;
      }
      return count;
    }

    function updateSmartTriggerUi() {
      const count = countActiveSmartFilters();
      smartFiltersOpenButton.classList.toggle("is-active", count > 0);
      smartFiltersOpenButton.textContent = count > 0
        ? `Умные фильтры (${count})`
        : "Умные фильтры";
    }

    function openSmartFiltersPanel() {
      if (smartPanelCloseTimerId) {
        window.clearTimeout(smartPanelCloseTimerId);
        smartPanelCloseTimerId = null;
      }

      smartPanelOpen = true;
      smartFiltersOpenButton.setAttribute("aria-expanded", "true");
      smartFiltersPanel.hidden = false;
      smartFiltersBackdrop.hidden = false;

      requestAnimationFrame(() => {
        smartFiltersPanel.classList.add("is-open");
        smartFiltersBackdrop.classList.add("is-open");
      });
    }

    function closeSmartFiltersPanel(options = {}) {
      const { returnFocusToTrigger = false } = options;
      if (!smartPanelOpen && smartFiltersPanel.hidden) {
        return;
      }

      smartPanelOpen = false;
      smartFiltersOpenButton.setAttribute("aria-expanded", "false");
      smartFiltersPanel.classList.remove("is-open");
      smartFiltersBackdrop.classList.remove("is-open");

      if (smartPanelCloseTimerId) {
        window.clearTimeout(smartPanelCloseTimerId);
      }

      smartPanelCloseTimerId = window.setTimeout(() => {
        smartPanelCloseTimerId = null;
        if (!smartPanelOpen) {
          smartFiltersPanel.hidden = true;
          smartFiltersBackdrop.hidden = true;
        }
      }, Config.UI_PANEL_TRANSITION_MS);

      if (returnFocusToTrigger) {
        smartFiltersOpenButton.focus();
      }
    }

    function destroy() {
      stopPanelDrag({ persist: false });
      sidebarElement.classList.remove("is-panel-dragging");

      if (revealHideTimerId) {
        window.clearTimeout(revealHideTimerId);
        revealHideTimerId = null;
      }
      if (smartPanelCloseTimerId) {
        window.clearTimeout(smartPanelCloseTimerId);
        smartPanelCloseTimerId = null;
      }
      smartPanelOpen = false;
      smartFiltersPanel.classList.remove("is-open");
      smartFiltersBackdrop.classList.remove("is-open");
      smartFiltersOpenButton.setAttribute("aria-expanded", "false");
      smartFiltersPanel.hidden = true;
      smartFiltersBackdrop.hidden = true;

      while (cleanupFns.length > 0) {
        const cleanupFn = cleanupFns.pop();
        try {
          cleanupFn();
        } catch (error) {
          console.error("Sidebar cleanup error:", error);
        }
      }
    }
  }

  function createNearMeController(options) {
    const {
      toggleButtonEl,
      panelEl,
      closeButtonEl,
      statusEl,
      coordsEl,
      listEl,
      getPlaces,
      mapEngine,
      onSelectPlace,
      onHoverPlace,
      setStatus
    } = options;

    const cleanupFns = [];
    let panelOpen = false;
    let closeTimerId = null;
    let locateToken = 0;
    let isLocating = false;
    let userLocation = null;
    let hoveredPlaceId = null;

    const toggleHandler = () => {
      if (panelOpen) {
        closePanel({ returnFocus: true });
        return;
      }
      void locateAndOpen();
    };
    toggleButtonEl.addEventListener("click", toggleHandler);
    cleanupFns.push(() => toggleButtonEl.removeEventListener("click", toggleHandler));

    const closeHandler = () => {
      closePanel({ returnFocus: true });
    };
    closeButtonEl.addEventListener("click", closeHandler);
    cleanupFns.push(() => closeButtonEl.removeEventListener("click", closeHandler));

    const listClickHandler = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const button = target.closest(".near-me-item__button[data-place-id]");
      if (!(button instanceof HTMLButtonElement)) {
        return;
      }

      const placeId = normalizeText(button.dataset.placeId, "");
      if (!placeId) {
        return;
      }

      if (typeof onSelectPlace === "function") {
        onSelectPlace(placeId);
      }
    };
    listEl.addEventListener("click", listClickHandler);
    cleanupFns.push(() => listEl.removeEventListener("click", listClickHandler));

    const listPointerOverHandler = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const button = target.closest(".near-me-item__button[data-place-id]");
      if (!(button instanceof HTMLButtonElement)) {
        clearHoveredItem();
        return;
      }

      const placeId = normalizeText(button.dataset.placeId, "");
      if (!placeId) {
        clearHoveredItem();
        return;
      }

      setHoveredItem(placeId);
    };
    listEl.addEventListener("pointerover", listPointerOverHandler);
    cleanupFns.push(() => listEl.removeEventListener("pointerover", listPointerOverHandler));

    const listPointerLeaveHandler = () => {
      clearHoveredItem();
    };
    listEl.addEventListener("pointerleave", listPointerLeaveHandler);
    cleanupFns.push(() => listEl.removeEventListener("pointerleave", listPointerLeaveHandler));

    const listFocusInHandler = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const button = target.closest(".near-me-item__button[data-place-id]");
      if (!(button instanceof HTMLButtonElement)) {
        return;
      }

      const placeId = normalizeText(button.dataset.placeId, "");
      if (!placeId) {
        return;
      }
      setHoveredItem(placeId);
    };
    listEl.addEventListener("focusin", listFocusInHandler);
    cleanupFns.push(() => listEl.removeEventListener("focusin", listFocusInHandler));

    const listFocusOutHandler = (event) => {
      const nextFocused = event.relatedTarget;
      if (nextFocused instanceof Element && listEl.contains(nextFocused)) {
        return;
      }
      clearHoveredItem();
    };
    listEl.addEventListener("focusout", listFocusOutHandler);
    cleanupFns.push(() => listEl.removeEventListener("focusout", listFocusOutHandler));

    const documentPointerDownHandler = (event) => {
      if (!panelOpen) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      if (panelEl.contains(target) || toggleButtonEl.contains(target)) {
        return;
      }

      closePanel();
    };
    document.addEventListener("pointerdown", documentPointerDownHandler, true);
    cleanupFns.push(() => document.removeEventListener("pointerdown", documentPointerDownHandler, true));

    const documentKeydownHandler = (event) => {
      if (!panelOpen || event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      closePanel({ returnFocus: true });
    };
    document.addEventListener("keydown", documentKeydownHandler);
    cleanupFns.push(() => document.removeEventListener("keydown", documentKeydownHandler));

    setPanelStatus("Нажмите кнопку Near Me, чтобы определить геопозицию.");
    syncToggleUi();

    return {
      locateAndOpen,
      refreshPlaces,
      closePanel,
      destroy
    };

    async function locateAndOpen(options = {}) {
      const { forceRefresh = false } = options;
      openPanel();

      if (isLocating) {
        return false;
      }

      if (!forceRefresh && userLocation) {
        refreshPlaces();
        return true;
      }

      if (!navigator.geolocation || typeof navigator.geolocation.getCurrentPosition !== "function") {
        setPanelStatus("Геолокация не поддерживается вашим браузером.", { isError: true });
        if (typeof setStatus === "function") {
          setStatus("Геолокация в браузере недоступна.", { type: "error", timeoutMs: 2200 });
        }
        return false;
      }

      const token = ++locateToken;
      isLocating = true;
      setLocateLoadingState(true);
      setPanelStatus("Определяем вашу геопозицию…");

      try {
        const position = await requestCurrentPosition();
        if (token !== locateToken) {
          return false;
        }

        const lat = Number(position?.coords?.latitude);
        const lon = Number(position?.coords?.longitude);
        const accuracy = Number(position?.coords?.accuracy);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
          throw new Error("invalid-position");
        }

        userLocation = {
          lat: round(lat, 6),
          lon: round(lon, 6),
          accuracy: Number.isFinite(accuracy) ? Math.max(0, accuracy) : 0
        };

        if (mapEngine && typeof mapEngine.setUserLocation === "function") {
          mapEngine.setUserLocation(userLocation);
        }

        if (mapEngine && typeof mapEngine.flyToCoordinates === "function") {
          const currentZoom = Number(mapEngine.getView?.()?.zoom);
          const targetZoom = Number.isFinite(currentZoom)
            ? Math.max(currentZoom, Config.NEAR_ME_TARGET_ZOOM)
            : Config.NEAR_ME_TARGET_ZOOM;
          mapEngine.flyToCoordinates(userLocation.lat, userLocation.lon, {
            targetZoom
          });
        }

        refreshPlaces();
        if (typeof setStatus === "function") {
          setStatus("Геопозиция определена. Показаны ближайшие места.", {
            type: "success",
            timeoutMs: 1600
          });
        }
        return true;
      } catch (error) {
        if (token !== locateToken) {
          return false;
        }

        const message = resolveGeolocationErrorMessage(error);
        setPanelStatus(message, { isError: true });
        if (typeof setStatus === "function") {
          setStatus(message, { type: "error", timeoutMs: 2400 });
        }
        return false;
      } finally {
        if (token === locateToken) {
          isLocating = false;
          setLocateLoadingState(false);
        }
      }
    }

    function refreshPlaces() {
      if (!userLocation) {
        renderEmptyList("Сначала определите геопозицию.");
        return;
      }

      const places = Array.isArray(getPlaces?.())
        ? getPlaces().filter(isValidPlace)
        : [];
      const nearest = places
        .map((place) => {
          const distanceMeters = haversineDistanceMeters(
            userLocation.lat,
            userLocation.lon,
            Number(place.lat),
            Number(place.lon)
          );
          if (!Number.isFinite(distanceMeters) || distanceMeters < 0) {
            return null;
          }
          return { place, distanceMeters };
        })
        .filter(Boolean)
        .sort((left, right) => left.distanceMeters - right.distanceMeters)
        .slice(0, Config.NEAR_ME_RESULTS_LIMIT);

      coordsEl.hidden = false;
      coordsEl.textContent = `📍 ${formatCoordinatesInline(userLocation.lat, userLocation.lon)}`;

      if (nearest.length === 0) {
        setPanelStatus("Не удалось найти ближайшие точки в текущем наборе.", { isError: true });
        renderEmptyList("No places found рядом с вашей локацией.");
        return;
      }

      setPanelStatus(`Найдено ближайших мест: ${nearest.length}`);
      renderNearestList(nearest);
    }

    function renderNearestList(entries) {
      const fragment = document.createDocumentFragment();

      for (const entry of entries) {
        const place = entry.place;
        const distanceMeters = Number(entry.distanceMeters);

        const item = document.createElement("li");
        item.className = "near-me-item";

        const button = document.createElement("button");
        button.type = "button";
        button.className = "near-me-item__button";
        button.dataset.placeId = place.id;
        button.setAttribute("aria-label", `Открыть ${normalizeText(place.name, "точку")}`);

        const name = document.createElement("span");
        name.className = "near-me-item__name";
        name.textContent = normalizeText(place.name, "Без названия");

        const distance = document.createElement("span");
        distance.className = "near-me-item__distance";
        distance.textContent = formatDistanceLabel(distanceMeters);

        button.append(name, distance);
        item.append(button);
        fragment.append(item);
      }

      listEl.replaceChildren(fragment);
      syncHoveredButtons();
    }

    function renderEmptyList(message) {
      const item = document.createElement("li");
      item.className = "near-me-item near-me-item--empty";

      const content = document.createElement("span");
      content.className = "near-me-item__button";
      content.setAttribute("aria-hidden", "true");

      const text = document.createElement("span");
      text.className = "near-me-item__name";
      text.textContent = normalizeText(message, "Нет данных.");

      content.append(text);
      item.append(content);
      listEl.replaceChildren(item);
      clearHoveredItem();
    }

    function setHoveredItem(placeId) {
      const normalizedPlaceId = normalizeText(placeId, "");
      if (hoveredPlaceId === normalizedPlaceId) {
        return;
      }

      hoveredPlaceId = normalizedPlaceId || null;
      syncHoveredButtons();
      if (typeof onHoverPlace === "function") {
        onHoverPlace(hoveredPlaceId);
      }
    }

    function clearHoveredItem() {
      if (!hoveredPlaceId) {
        return;
      }
      hoveredPlaceId = null;
      syncHoveredButtons();
      if (typeof onHoverPlace === "function") {
        onHoverPlace(null);
      }
    }

    function syncHoveredButtons() {
      const buttons = listEl.querySelectorAll(".near-me-item__button[data-place-id]");
      for (const button of buttons) {
        if (!(button instanceof HTMLElement)) {
          continue;
        }
        const isHovered = hoveredPlaceId && normalizeText(button.dataset.placeId, "") === hoveredPlaceId;
        button.classList.toggle("is-hovered", Boolean(isHovered));
      }
    }

    function setLocateLoadingState(isLoading) {
      const nextLoading = Boolean(isLoading);
      toggleButtonEl.classList.toggle("is-loading", nextLoading);
      toggleButtonEl.setAttribute("aria-busy", String(nextLoading));
    }

    function setPanelStatus(message, options = {}) {
      const { isError = false } = options;
      statusEl.textContent = normalizeText(message, "");
      statusEl.classList.toggle("is-error", Boolean(isError));
    }

    function openPanel() {
      if (closeTimerId) {
        window.clearTimeout(closeTimerId);
        closeTimerId = null;
      }

      panelOpen = true;
      panelEl.hidden = false;
      requestAnimationFrame(() => {
        panelEl.classList.add("is-open");
      });
      syncToggleUi();
    }

    function closePanel(options = {}) {
      const { returnFocus = false, immediate = false } = options;
      if (!panelOpen && panelEl.hidden) {
        return;
      }

      panelOpen = false;
      panelEl.classList.remove("is-open");
      syncToggleUi();
      clearHoveredItem();

      if (closeTimerId) {
        window.clearTimeout(closeTimerId);
        closeTimerId = null;
      }

      if (immediate) {
        panelEl.hidden = true;
      } else {
        closeTimerId = window.setTimeout(() => {
          closeTimerId = null;
          if (!panelOpen) {
            panelEl.hidden = true;
          }
        }, Config.UI_PANEL_TRANSITION_MS);
      }

      if (returnFocus) {
        toggleButtonEl.focus();
      }
    }

    function syncToggleUi() {
      toggleButtonEl.classList.toggle("is-active", panelOpen);
      toggleButtonEl.setAttribute("aria-expanded", String(panelOpen));
    }

    function formatDistanceLabel(distanceMeters) {
      const safeDistance = Number(distanceMeters);
      if (!Number.isFinite(safeDistance) || safeDistance < 0) {
        return "—";
      }
      if (safeDistance < 1000) {
        return `${Math.round(safeDistance)} m`;
      }
      const km = safeDistance / 1000;
      const digits = km >= 100 ? 0 : 1;
      return `${km.toFixed(digits)} km`;
    }

    function formatCoordinatesInline(lat, lon) {
      return `${Number(lat).toFixed(4)}, ${Number(lon).toFixed(4)}`;
    }

    function resolveGeolocationErrorMessage(error) {
      const code = Number(error?.code);
      if (code === 1) {
        return "Доступ к геопозиции запрещён. Разрешите доступ в браузере.";
      }
      if (code === 2) {
        return "Не удалось определить геопозицию. Проверьте сеть и GPS.";
      }
      if (code === 3) {
        return "Превышено время ожидания геопозиции. Попробуйте снова.";
      }
      return "Не удалось получить геопозицию.";
    }

    function requestCurrentPosition() {
      return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          {
            enableHighAccuracy: true,
            timeout: Config.GEOLOCATION_TIMEOUT_MS,
            maximumAge: Config.GEOLOCATION_MAX_AGE_MS
          }
        );
      });
    }

    function destroy() {
      locateToken += 1;
      isLocating = false;
      setLocateLoadingState(false);
      closePanel({ immediate: true });

      if (closeTimerId) {
        window.clearTimeout(closeTimerId);
        closeTimerId = null;
      }

      clearHoveredItem();

      while (cleanupFns.length > 0) {
        const cleanupFn = cleanupFns.pop();
        try {
          cleanupFn();
        } catch (error) {
          console.error("Near me cleanup error:", error);
        }
      }
    }
  }

  function createAddPlaceController(options) {
    const {
      controlsEl,
      publicToggleButtonEl,
      myToggleButtonEl,
      mapRootEl,
      bannerEl,
      bannerTextEl,
      bannerCancelButtonEl,
      drawerEl,
      drawerCloseButtonEl,
      statusEl,
      coordsEl,
      modeBadgeEl,
      formEl,
      nameInputEl,
      descriptionInputEl,
      photoInputEl,
      photoClearButtonEl,
      photoPreviewEl,
      photoPreviewImageEl,
      photoMetaEl,
      photoAuthHintEl,
      categorySelectEl,
      tagInputEl,
      tagAddButtonEl,
      tagsWrapEl,
      priceSelectEl,
      freeCheckboxEl,
      familyCheckboxEl,
      visibilitySectionEl,
      visibilityPrivateButtonEl,
      visibilityPublicButtonEl,
      visibilityReviewButtonEl,
      scheduleWrapEl,
      scheduleEnabledInputEl,
      scheduleAtInputEl,
      scheduleHintEl,
      seasonalSectionEl,
      seasonalEnabledInputEl,
      seasonalHintEl,
      seasonalCardsEl,
      cancelButtonEl,
      submitButtonEl,
      mapEngine,
      apiClient,
      getAccessState,
      setStatus,
      showToast,
      onPlaceCreated
    } = options;

    const cleanupFns = [];
    const visibilityButtons = [
      visibilityPrivateButtonEl,
      visibilityPublicButtonEl,
      visibilityReviewButtonEl
    ];

    let mode = "idle";
    let submitScope = "my";
    let visibility = "public";
    let draftPoint = null;
    let tags = [];
    let isSubmitting = false;
    let selectedPhotoFile = null;
    let selectedPhotoPreviewUrl = "";
    let canUploadPhoto = false;
    let accessState = normalizeAddPlaceAccessState(
      typeof getAccessState === "function" ? getAccessState() : null
    );
    let drawerHideTimerId = null;
    let bannerHideTimerId = null;
    const seasonControls = PLACE_SEASON_ORDER.map((seasonKey) => {
      const safeSection = seasonalSectionEl instanceof HTMLElement ? seasonalSectionEl : null;
      const rootEl = safeSection?.querySelector(`[data-season="${seasonKey}"]`);
      return {
        key: seasonKey,
        rootEl: rootEl instanceof HTMLElement ? rootEl : null,
        enabledInputEl: safeSection?.querySelector(`[data-season-enabled="${seasonKey}"]`) instanceof HTMLInputElement
          ? safeSection.querySelector(`[data-season-enabled="${seasonKey}"]`)
          : null,
        titleInputEl: safeSection?.querySelector(`[data-season-title="${seasonKey}"]`) instanceof HTMLInputElement
          ? safeSection.querySelector(`[data-season-title="${seasonKey}"]`)
          : null,
        descriptionInputEl: safeSection?.querySelector(`[data-season-description="${seasonKey}"]`) instanceof HTMLTextAreaElement
          ? safeSection.querySelector(`[data-season-description="${seasonKey}"]`)
          : null,
        photoInputEl: safeSection?.querySelector(`[data-season-photo="${seasonKey}"]`) instanceof HTMLInputElement
          ? safeSection.querySelector(`[data-season-photo="${seasonKey}"]`)
          : null,
        photoClearButtonEl: safeSection?.querySelector(`[data-season-photo-clear="${seasonKey}"]`) instanceof HTMLButtonElement
          ? safeSection.querySelector(`[data-season-photo-clear="${seasonKey}"]`)
          : null,
        photoPreviewEl: safeSection?.querySelector(`[data-season-photo-preview="${seasonKey}"]`) instanceof HTMLElement
          ? safeSection.querySelector(`[data-season-photo-preview="${seasonKey}"]`)
          : null,
        photoPreviewImageEl: safeSection?.querySelector(`[data-season-photo-image="${seasonKey}"]`) instanceof HTMLImageElement
          ? safeSection.querySelector(`[data-season-photo-image="${seasonKey}"]`)
          : null,
        photoMetaEl: safeSection?.querySelector(`[data-season-photo-meta="${seasonKey}"]`) instanceof HTMLElement
          ? safeSection.querySelector(`[data-season-photo-meta="${seasonKey}"]`)
          : null,
        file: null,
        previewUrl: ""
      };
    });

    function normalizeSubmitScope(rawScope) {
      return normalizeText(rawScope, "my").toLowerCase() === "public"
        ? "public"
        : "my";
    }

    function resolveAccessState() {
      accessState = normalizeAddPlaceAccessState(
        typeof getAccessState === "function" ? getAccessState() : accessState
      );
      return accessState;
    }

    function isWriteBlocked(stateValue = accessState) {
      const safeState = normalizeAddPlaceAccessState(stateValue);
      return safeState.isBanned || safeState.isFrozen;
    }

    function getWriteBlockedMessage(stateValue = accessState) {
      const safeState = normalizeAddPlaceAccessState(stateValue);
      return normalizeText(
        buildWriteRestrictionMessage(safeState),
        "Write access is temporarily unavailable."
      );
    }

    function applySubmitScope(scope, options = {}) {
      const { syncDraft = true } = options;
      submitScope = normalizeSubmitScope(scope);

      if (modeBadgeEl instanceof HTMLElement) {
        const isPublicScope = submitScope === "public";
        modeBadgeEl.textContent = isPublicScope ? "PUBLIC" : "MY";
        modeBadgeEl.classList.toggle("add-place-drawer__mode-badge--public", isPublicScope);
        modeBadgeEl.classList.toggle("add-place-drawer__mode-badge--my", !isPublicScope);
      }

      const access = resolveAccessState();
      const draftVisibility = submitScope === "public"
        ? (access.isAdmin ? "approved" : "pending")
        : "private";
      setVisibility(draftVisibility, { syncDraft });

      if (visibilitySectionEl instanceof HTMLElement) {
        visibilitySectionEl.hidden = true;
      }

      syncScheduleState();
      syncSeasonalState();
      syncToggleState();
    }

    function syncAccessState(nextState) {
      accessState = normalizeAddPlaceAccessState(nextState);

      if (isWriteBlocked(accessState) && mode !== "idle") {
        cancelFlow({ reason: "write-blocked", silent: true });
      }

      if (submitScope === "my" && !accessState.isAuthenticated && mode !== "idle") {
        cancelFlow({ reason: "auth-lost", silent: true });
      }

      void refreshPhotoAuthState();
      syncToggleState();
    }

    const publicToggleClickHandler = () => {
      handleToggleIntent("public");
    };
    publicToggleButtonEl.addEventListener("click", publicToggleClickHandler);
    cleanupFns.push(() => publicToggleButtonEl.removeEventListener("click", publicToggleClickHandler));

    const myToggleClickHandler = () => {
      handleToggleIntent("my");
    };
    myToggleButtonEl.addEventListener("click", myToggleClickHandler);
    cleanupFns.push(() => myToggleButtonEl.removeEventListener("click", myToggleClickHandler));

    const controlsKeydownHandler = (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      const target = event.target;
      if (!(target instanceof HTMLButtonElement)) {
        return;
      }
      if (target === publicToggleButtonEl) {
        event.preventDefault();
        handleToggleIntent("public");
      } else if (target === myToggleButtonEl) {
        event.preventDefault();
        handleToggleIntent("my");
      }
    };
    controlsEl.addEventListener("keydown", controlsKeydownHandler);
    cleanupFns.push(() => controlsEl.removeEventListener("keydown", controlsKeydownHandler));

    function handleToggleIntent(scope) {
      const access = resolveAccessState();
      const normalizedScope = normalizeSubmitScope(scope);
      if (isWriteBlocked(access)) {
        const message = getWriteBlockedMessage(access);
        setStatusMessage(message, "error");
        if (typeof showToast === "function") {
          showToast(message);
        }
        if (typeof setStatus === "function") {
          setStatus(message, { type: "error", timeoutMs: Config.STATUS_CLEAR_MS });
        }
        return;
      }
      if (normalizedScope === "public" && !access.isAuthenticated) {
        const message = "Please log in to submit a public point.";
        setStatusMessage(message, "error");
        if (typeof showToast === "function") {
          showToast(message);
        }
        if (typeof setStatus === "function") {
          setStatus(message, { type: "error", timeoutMs: Config.STATUS_CLEAR_MS });
        }
        return;
      }
      if (normalizedScope === "my" && !access.isAuthenticated) {
        const message = "Please log in";
        setStatusMessage(message, "error");
        if (typeof showToast === "function") {
          showToast(message);
        }
        if (typeof setStatus === "function") {
          setStatus(message, { type: "error", timeoutMs: Config.STATUS_CLEAR_MS });
        }
        return;
      }
      if (mode === "idle") {
        startPickMode(normalizedScope);
        return;
      }
      if (submitScope !== normalizedScope) {
        applySubmitScope(normalizedScope, { syncDraft: true });
        return;
      }
      cancelFlow({ reason: "toggle" });
    }

    const bannerCancelHandler = () => {
      cancelFlow({ reason: "banner-cancel" });
    };
    bannerCancelButtonEl.addEventListener("click", bannerCancelHandler);
    cleanupFns.push(() => bannerCancelButtonEl.removeEventListener("click", bannerCancelHandler));

    const drawerCloseHandler = () => {
      cancelFlow({ reason: "drawer-close" });
    };
    drawerCloseButtonEl.addEventListener("click", drawerCloseHandler);
    cleanupFns.push(() => drawerCloseButtonEl.removeEventListener("click", drawerCloseHandler));

    const cancelButtonHandler = () => {
      cancelFlow({ reason: "form-cancel" });
    };
    cancelButtonEl.addEventListener("click", cancelButtonHandler);
    cleanupFns.push(() => cancelButtonEl.removeEventListener("click", cancelButtonHandler));

    const formSubmitHandler = (event) => {
      event.preventDefault();
      void submitPlace();
    };
    formEl.addEventListener("submit", formSubmitHandler);
    cleanupFns.push(() => formEl.removeEventListener("submit", formSubmitHandler));

    const tagAddHandler = () => {
      addTagFromInput();
    };
    tagAddButtonEl.addEventListener("click", tagAddHandler);
    cleanupFns.push(() => tagAddButtonEl.removeEventListener("click", tagAddHandler));

    const tagInputKeydownHandler = (event) => {
      if (event.key !== "Enter" && event.key !== ",") {
        return;
      }
      event.preventDefault();
      addTagFromInput();
    };
    tagInputEl.addEventListener("keydown", tagInputKeydownHandler);
    cleanupFns.push(() => tagInputEl.removeEventListener("keydown", tagInputKeydownHandler));

    const photoInputChangeHandler = () => {
      handlePhotoInputChange();
    };
    photoInputEl.addEventListener("change", photoInputChangeHandler);
    cleanupFns.push(() => photoInputEl.removeEventListener("change", photoInputChangeHandler));

    const photoClearHandler = () => {
      clearSelectedPhoto({ resetInput: true });
    };
    photoClearButtonEl.addEventListener("click", photoClearHandler);
    cleanupFns.push(() => photoClearButtonEl.removeEventListener("click", photoClearHandler));

    const photoAuthChangedHandler = () => {
      void refreshPhotoAuthState();
    };
    window.addEventListener("worldatlas:auth-changed", photoAuthChangedHandler);
    cleanupFns.push(() => window.removeEventListener("worldatlas:auth-changed", photoAuthChangedHandler));

    if (seasonalEnabledInputEl instanceof HTMLInputElement) {
      const seasonalEnabledChangeHandler = () => {
        syncSeasonalState();
      };
      seasonalEnabledInputEl.addEventListener("change", seasonalEnabledChangeHandler);
      cleanupFns.push(() => seasonalEnabledInputEl.removeEventListener("change", seasonalEnabledChangeHandler));
    }

    for (const seasonControl of seasonControls) {
      if (seasonControl.enabledInputEl instanceof HTMLInputElement) {
        const enabledChangeHandler = () => {
          syncSeasonCardState(seasonControl);
        };
        seasonControl.enabledInputEl.addEventListener("change", enabledChangeHandler);
        cleanupFns.push(() => seasonControl.enabledInputEl.removeEventListener("change", enabledChangeHandler));
      }

      if (seasonControl.photoInputEl instanceof HTMLInputElement) {
        const photoChangeHandler = () => {
          handleSeasonPhotoInputChange(seasonControl);
        };
        seasonControl.photoInputEl.addEventListener("change", photoChangeHandler);
        cleanupFns.push(() => seasonControl.photoInputEl.removeEventListener("change", photoChangeHandler));
      }

      if (seasonControl.photoClearButtonEl instanceof HTMLButtonElement) {
        const clearClickHandler = () => {
          clearSeasonPhoto(seasonControl, { resetInput: true });
        };
        seasonControl.photoClearButtonEl.addEventListener("click", clearClickHandler);
        cleanupFns.push(() => seasonControl.photoClearButtonEl.removeEventListener("click", clearClickHandler));
      }
    }

    const tagsDelegatedClickHandler = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      const removeButton = target.closest(".add-place-form__chip-remove[data-tag]");
      if (!(removeButton instanceof HTMLButtonElement)) {
        return;
      }

      const tag = normalizeSmartTagValue(removeButton.dataset.tag);
      if (!tag) {
        return;
      }

      tags = tags.filter((entry) => entry !== tag);
      renderTags();
    };
    tagsWrapEl.addEventListener("click", tagsDelegatedClickHandler);
    cleanupFns.push(() => tagsWrapEl.removeEventListener("click", tagsDelegatedClickHandler));

    const visibilityClickHandler = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const button = target.closest(".add-place-form__segment[data-visibility]");
      if (!(button instanceof HTMLButtonElement)) {
        return;
      }

      const nextVisibility = normalizePlaceVisibilityState(button.dataset.visibility);
      setVisibility(nextVisibility);
    };

    for (const button of visibilityButtons) {
      button.addEventListener("click", visibilityClickHandler);
      cleanupFns.push(() => button.removeEventListener("click", visibilityClickHandler));
    }

    if (scheduleEnabledInputEl instanceof HTMLInputElement) {
      const scheduleEnabledChangeHandler = () => {
        syncScheduleState();
      };
      scheduleEnabledInputEl.addEventListener("change", scheduleEnabledChangeHandler);
      cleanupFns.push(() => scheduleEnabledInputEl.removeEventListener("change", scheduleEnabledChangeHandler));
    }

    if (scheduleAtInputEl instanceof HTMLInputElement) {
      const scheduleAtInputHandler = () => {
        if (
          scheduleEnabledInputEl instanceof HTMLInputElement &&
          scheduleEnabledInputEl.checked !== true
        ) {
          scheduleAtInputEl.value = "";
        }
      };
      scheduleAtInputEl.addEventListener("change", scheduleAtInputHandler);
      cleanupFns.push(() => scheduleAtInputEl.removeEventListener("change", scheduleAtInputHandler));
    }

    const documentKeydownHandler = (event) => {
      if (event.key !== "Escape" || mode === "idle") {
        return;
      }
      event.preventDefault();
      cancelFlow({ reason: "escape" });
    };
    document.addEventListener("keydown", documentKeydownHandler);
    cleanupFns.push(() => document.removeEventListener("keydown", documentKeydownHandler));

    const documentPointerDownHandler = (event) => {
      const target = event.target;
      if (
        mode !== "editing" ||
        !(target instanceof Element) ||
        drawerEl.contains(target) ||
        controlsEl.contains(target)
      ) {
        return;
      }
      cancelFlow({ reason: "outside-click", silent: true });
    };
    document.addEventListener("pointerdown", documentPointerDownHandler, true);
    cleanupFns.push(() => document.removeEventListener("pointerdown", documentPointerDownHandler, true));

    initializeForm();
    return {
      startPickMode,
      cancelFlow,
      syncAccessState,
      destroy
    };

    function initializeForm() {
      applySubmitScope("my", { syncDraft: false });
      renderTags();
      clearSelectedPhoto({ resetInput: true });
      hideBanner({ immediate: true });
      hideDrawer({ immediate: true });
      syncToggleState();
      syncScheduleState();
      syncSeasonalState();
      clearStatus();
      void refreshPhotoAuthState();
    }

    function startPickMode(scope = submitScope) {
      if (mode === "picking") {
        return;
      }

      applySubmitScope(scope, { syncDraft: false });
      mode = "picking";
      clearStatus();
      showBanner("Click on map to place marker");
      setMapPickModeVisualState(true);
      syncToggleState();

      mapEngine.armCoordinatePick({
        target: "add-place",
        onPick: (point) => {
          handleMapPick(point);
        },
        onCancel: () => {
          if (mode === "picking") {
            cancelFlow({ reason: "pick-cancelled", silent: true });
          }
        }
      });
    }

    function handleMapPick(point) {
      if (!point || !Number.isFinite(Number(point.lat)) || !Number.isFinite(Number(point.lon))) {
        setStatusMessage("Failed to resolve point coordinates.", "error");
        return;
      }

      mode = "editing";
      draftPoint = {
        lat: round(Number(point.lat), 6),
        lon: round(Number(point.lon), 6)
      };

      hideBanner();
      setMapPickModeVisualState(false);
      updateCoordinates();
      mapEngine.setDraftPlace(draftPoint, { visibility });
      showDrawer();
      clearStatus();
      syncToggleState();
      nameInputEl.focus();
    }

    function cancelFlow(options = {}) {
      const {
        reason = "",
        silent = false
      } = options;

      if (mode === "idle") {
        return;
      }

      const wasPicking = mode === "picking";
      mode = "idle";
      draftPoint = null;
      isSubmitting = false;

      if (wasPicking) {
        mapEngine.cancelCoordinatePick(`add-place-${reason || "cancel"}`);
      }

      hideBanner();
      hideDrawer();
      setMapPickModeVisualState(false);
      mapEngine.clearDraftPlace();
      clearStatus();
      resetFormFields();
      syncToggleState();

      if (!silent && typeof setStatus === "function") {
        setStatus("Place creation canceled.", {
          timeoutMs: 1400
        });
      }
    }

    function syncToggleState() {
      const isActive = mode !== "idle";
      const isPublic = submitScope === "public";
      const writeBlocked = isWriteBlocked(accessState);
      const isAdminPublic = isPublic && accessState.isAdmin;

      publicToggleButtonEl.classList.toggle("is-active", isPublic);
      myToggleButtonEl.classList.toggle("is-active", !isPublic);

      publicToggleButtonEl.setAttribute("aria-pressed", String(isPublic));
      myToggleButtonEl.setAttribute("aria-pressed", String(!isPublic));

      publicToggleButtonEl.setAttribute("aria-expanded", String(isActive && isPublic));
      myToggleButtonEl.setAttribute("aria-expanded", String(isActive && !isPublic));
      publicToggleButtonEl.disabled = publicToggleButtonEl.hidden || writeBlocked;
      myToggleButtonEl.disabled = writeBlocked;
      submitButtonEl.disabled = isSubmitting || writeBlocked;
      submitButtonEl.textContent = isPublic
        ? (isAdminPublic ? "Publish point" : "Send to review")
        : "Save place";
    }

    function setMapPickModeVisualState(enabled) {
      mapRootEl.classList.toggle("is-add-place-mode", Boolean(enabled));
    }

    function showBanner(message) {
      bannerTextEl.textContent = normalizeText(message, "Click on map to place marker");

      if (bannerHideTimerId) {
        window.clearTimeout(bannerHideTimerId);
        bannerHideTimerId = null;
      }

      bannerEl.hidden = false;
      requestAnimationFrame(() => {
        bannerEl.classList.add("is-open");
      });
    }

    function hideBanner(options = {}) {
      const { immediate = false } = options;
      bannerEl.classList.remove("is-open");

      if (bannerHideTimerId) {
        window.clearTimeout(bannerHideTimerId);
        bannerHideTimerId = null;
      }

      if (immediate) {
        bannerEl.hidden = true;
        return;
      }

      bannerHideTimerId = window.setTimeout(() => {
        bannerHideTimerId = null;
        if (!bannerEl.classList.contains("is-open")) {
          bannerEl.hidden = true;
        }
      }, Config.UI_PANEL_TRANSITION_MS);
    }

    function showDrawer() {
      if (drawerHideTimerId) {
        window.clearTimeout(drawerHideTimerId);
        drawerHideTimerId = null;
      }

      drawerEl.hidden = false;
      requestAnimationFrame(() => {
        drawerEl.classList.add("is-open");
      });
    }

    function hideDrawer(options = {}) {
      const { immediate = false } = options;
      drawerEl.classList.remove("is-open");

      if (drawerHideTimerId) {
        window.clearTimeout(drawerHideTimerId);
        drawerHideTimerId = null;
      }

      if (immediate) {
        drawerEl.hidden = true;
        return;
      }

      drawerHideTimerId = window.setTimeout(() => {
        drawerHideTimerId = null;
        if (!drawerEl.classList.contains("is-open")) {
          drawerEl.hidden = true;
        }
      }, Config.UI_PANEL_TRANSITION_MS);
    }

    function setStatusMessage(message, type = "info") {
      statusEl.hidden = false;
      statusEl.textContent = normalizeText(message, "");
      statusEl.classList.remove("is-error", "is-success");
      if (type === "error") {
        statusEl.classList.add("is-error");
      }
      if (type === "success") {
        statusEl.classList.add("is-success");
      }
    }

    function clearStatus() {
      statusEl.hidden = true;
      statusEl.textContent = "";
      statusEl.classList.remove("is-error", "is-success");
    }

    function updateCoordinates() {
      if (!draftPoint) {
        coordsEl.textContent = "Coordinates: -";
        return;
      }

      coordsEl.textContent = `Coordinates: ${draftPoint.lat.toFixed(5)}, ${draftPoint.lon.toFixed(5)}`;
    }

    function resetFormFields() {
      formEl.reset();
      tags = [];
      clearSelectedPhoto({ resetInput: true });
      if (seasonalEnabledInputEl instanceof HTMLInputElement) {
        seasonalEnabledInputEl.checked = false;
      }
      for (const seasonControl of seasonControls) {
        if (seasonControl.enabledInputEl instanceof HTMLInputElement) {
          seasonControl.enabledInputEl.checked = false;
        }
        if (seasonControl.titleInputEl instanceof HTMLInputElement) {
          seasonControl.titleInputEl.value = "";
        }
        if (seasonControl.descriptionInputEl instanceof HTMLTextAreaElement) {
          seasonControl.descriptionInputEl.value = "";
        }
        clearSeasonPhoto(seasonControl, { resetInput: true });
      }
      if (scheduleEnabledInputEl instanceof HTMLInputElement) {
        scheduleEnabledInputEl.checked = false;
      }
      if (scheduleAtInputEl instanceof HTMLInputElement) {
        scheduleAtInputEl.value = "";
      }
      setVisibility(
        submitScope === "public"
          ? (resolveAccessState().isAdmin ? "approved" : "pending")
          : "private",
        { syncDraft: false }
      );
      renderTags();
      updateCoordinates();
      syncScheduleState();
      syncSeasonalState();
      void refreshPhotoAuthState();
    }

    async function refreshPhotoAuthState() {
      const access = resolveAccessState();
      let isAuthed = access.isAuthenticated;
      const writeBlocked = isWriteBlocked(access);
      if (!isAuthed && apiClient && typeof apiClient.isAuthenticated === "function") {
        try {
          isAuthed = Boolean(await apiClient.isAuthenticated());
        } catch {
          isAuthed = false;
        }
      }
      canUploadPhoto = isAuthed && !writeBlocked;
      photoInputEl.disabled = !canUploadPhoto;
      photoAuthHintEl.textContent = writeBlocked
        ? getWriteBlockedMessage(access)
        : (
          isAuthed
            ? "Image will be uploaded to your Supabase account."
            : "Please log in to upload an image from your device."
        );
      photoAuthHintEl.classList.toggle("is-authenticated", canUploadPhoto);

      if (!canUploadPhoto && selectedPhotoFile) {
        clearSelectedPhoto({ resetInput: true });
      }

      syncSeasonalState();
    }

    function hasSeasonalModeEnabled() {
      return (
        submitScope === "public" &&
        seasonalEnabledInputEl instanceof HTMLInputElement &&
        seasonalEnabledInputEl.checked === true
      );
    }

    function syncSeasonalState() {
      const enabled = hasSeasonalModeEnabled();
      if (enabled) {
        const hasActiveSeason = seasonControls.some(
          (seasonControl) => seasonControl.enabledInputEl?.checked === true
        );
        if (!hasActiveSeason) {
          const defaultSeason = normalizeSeasonKey(resolveCurrentSeasonKey(), "summer");
          const defaultControl = seasonControls.find((seasonControl) => seasonControl.key === defaultSeason);
          if (defaultControl?.enabledInputEl instanceof HTMLInputElement) {
            defaultControl.enabledInputEl.checked = true;
          }
        }
      }
      if (seasonalSectionEl instanceof HTMLElement) {
        seasonalSectionEl.hidden = submitScope !== "public";
      }
      if (seasonalCardsEl instanceof HTMLElement) {
        seasonalCardsEl.hidden = !enabled;
      }
      if (seasonalHintEl instanceof HTMLElement) {
        seasonalHintEl.textContent = submitScope === "public"
          ? "Turn one public point into spring, summer, autumn, and winter variants. Each active season can have its own title, photo, and description."
          : "Seasonal variants are available for public points.";
      }

      for (const seasonControl of seasonControls) {
        const isActive = enabled && seasonControl.enabledInputEl?.checked === true;
        if (seasonControl.rootEl instanceof HTMLElement) {
          seasonControl.rootEl.dataset.active = isActive ? "true" : "false";
        }
        if (seasonControl.titleInputEl instanceof HTMLInputElement) {
          seasonControl.titleInputEl.disabled = !isActive;
        }
        if (seasonControl.descriptionInputEl instanceof HTMLTextAreaElement) {
          seasonControl.descriptionInputEl.disabled = !isActive;
        }
        if (seasonControl.photoInputEl instanceof HTMLInputElement) {
          seasonControl.photoInputEl.disabled = !isActive || !canUploadPhoto;
        }
        if (seasonControl.photoClearButtonEl instanceof HTMLButtonElement) {
          seasonControl.photoClearButtonEl.hidden = !isActive || !seasonControl.file;
          seasonControl.photoClearButtonEl.disabled = !isActive || !seasonControl.file || isWriteBlocked(accessState);
        }
        if (seasonControl.photoPreviewEl instanceof HTMLElement) {
          seasonControl.photoPreviewEl.hidden = !isActive || !seasonControl.file;
        }
      }
    }

    function syncSeasonCardState(seasonControl) {
      if (!seasonControl || typeof seasonControl !== "object") {
        return;
      }

      const seasonalEnabled = seasonalEnabledInputEl instanceof HTMLInputElement
        ? seasonalEnabledInputEl.checked === true
        : false;
      if (
        seasonalEnabled &&
        seasonControl.enabledInputEl instanceof HTMLInputElement &&
        seasonControl.enabledInputEl.checked === true
      ) {
        clearStatus();
      }
      syncSeasonalState();
    }

    function handleSeasonPhotoInputChange(seasonControl) {
      if (!seasonControl || !(seasonControl.photoInputEl instanceof HTMLInputElement)) {
        return;
      }

      const file = seasonControl.photoInputEl.files && seasonControl.photoInputEl.files.length > 0
        ? seasonControl.photoInputEl.files[0]
        : null;
      if (!file) {
        clearSeasonPhoto(seasonControl, { resetInput: false });
        return;
      }

      if (!canUploadPhoto) {
        clearSeasonPhoto(seasonControl, { resetInput: true });
        const message = isWriteBlocked(accessState)
          ? getWriteBlockedMessage(accessState)
          : "Please log in to upload an image.";
        setStatusMessage(message, "error");
        return;
      }

      const validationError = validatePhotoFile(file);
      if (validationError) {
        clearSeasonPhoto(seasonControl, { resetInput: true });
        setStatusMessage(validationError, "error");
        return;
      }

      setSeasonPhoto(seasonControl, file);
      clearStatus();
    }

    function setSeasonPhoto(seasonControl, file) {
      if (!seasonControl || !(file instanceof File)) {
        return;
      }

      clearSeasonPhoto(seasonControl, { resetInput: false });
      seasonControl.file = file;
      seasonControl.previewUrl = URL.createObjectURL(file);

      if (seasonControl.photoPreviewImageEl instanceof HTMLImageElement) {
        seasonControl.photoPreviewImageEl.src = seasonControl.previewUrl;
        seasonControl.photoPreviewImageEl.alt = `${formatSeasonLabel(seasonControl.key)} preview`;
      }
      if (seasonControl.photoMetaEl instanceof HTMLElement) {
        const sizeMb = file.size / (1024 * 1024);
        const sizeLabel = sizeMb >= 1
          ? `${sizeMb.toFixed(1)} MB`
          : `${Math.max(1, Math.round(file.size / 1024))} KB`;
        seasonControl.photoMetaEl.textContent = `${normalizeText(file.name, "season-photo")} - ${sizeLabel}`;
      }

      syncSeasonalState();
    }

    function clearSeasonPhoto(seasonControl, options = {}) {
      const { resetInput = false } = options;
      if (!seasonControl || typeof seasonControl !== "object") {
        return;
      }

      seasonControl.file = null;
      if (seasonControl.previewUrl) {
        URL.revokeObjectURL(seasonControl.previewUrl);
        seasonControl.previewUrl = "";
      }
      if (seasonControl.photoPreviewImageEl instanceof HTMLImageElement) {
        seasonControl.photoPreviewImageEl.removeAttribute("src");
        seasonControl.photoPreviewImageEl.alt = "";
      }
      if (seasonControl.photoMetaEl instanceof HTMLElement) {
        seasonControl.photoMetaEl.textContent = "";
      }
      if (seasonControl.photoPreviewEl instanceof HTMLElement) {
        seasonControl.photoPreviewEl.hidden = true;
      }
      if (seasonControl.photoClearButtonEl instanceof HTMLButtonElement) {
        seasonControl.photoClearButtonEl.hidden = true;
        seasonControl.photoClearButtonEl.disabled = true;
      }
      if (resetInput && seasonControl.photoInputEl instanceof HTMLInputElement) {
        seasonControl.photoInputEl.value = "";
      }
    }

    function handlePhotoInputChange() {
      const file = photoInputEl.files && photoInputEl.files.length > 0
        ? photoInputEl.files[0]
        : null;

      if (!file) {
        clearSelectedPhoto({ resetInput: false });
        return;
      }

      if (!canUploadPhoto) {
        clearSelectedPhoto({ resetInput: true });
        const message = isWriteBlocked(accessState)
          ? getWriteBlockedMessage(accessState)
          : "Please log in to upload an image.";
        setStatusMessage(message, "error");
        return;
      }

      const validationError = validatePhotoFile(file);
      if (validationError) {
        clearSelectedPhoto({ resetInput: true });
        setStatusMessage(validationError, "error");
        return;
      }

      setSelectedPhoto(file);
      clearStatus();
    }

    function validatePhotoFile(file) {
      if (!(file instanceof File)) {
        return "Unable to read the selected file.";
      }

      const allowedTypes = Array.isArray(Config.ADD_PLACE_IMAGE_ALLOWED_TYPES)
        ? Config.ADD_PLACE_IMAGE_ALLOWED_TYPES
        : [];
      const fileExt = normalizeText(file.name, "")
        .toLowerCase()
        .match(/\.([a-z0-9]{2,6})$/)?.[1] || "";
      const extensionAllowed = ["jpg", "jpeg", "png", "webp", "avif"].includes(fileExt);
      const mimeAllowed = allowedTypes.includes(file.type);
      if (allowedTypes.length > 0 && !mimeAllowed && !(file.type === "" && extensionAllowed)) {
        return "Only JPG, PNG, WEBP, or AVIF files are supported.";
      }

      const maxBytes = Number(Config.ADD_PLACE_IMAGE_MAX_BYTES) || 8 * 1024 * 1024;
      if (Number(file.size) > maxBytes) {
        return "Image size must be 8 MB or less.";
      }

      return "";
    }

    function setSelectedPhoto(file) {
      clearSelectedPhoto({ resetInput: false });

      selectedPhotoFile = file;
      selectedPhotoPreviewUrl = URL.createObjectURL(file);
      photoPreviewImageEl.src = selectedPhotoPreviewUrl;
      photoPreviewImageEl.alt = `Place image: ${normalizeText(nameInputEl.value, "New place")}`;

      const sizeMb = file.size / (1024 * 1024);
      const sizeLabel = sizeMb >= 1
        ? `${sizeMb.toFixed(1)} MB`
        : `${Math.max(1, Math.round(file.size / 1024))} KB`;
      photoMetaEl.textContent = `${normalizeText(file.name, "photo")} - ${sizeLabel}`;
      photoPreviewEl.hidden = false;
      photoClearButtonEl.hidden = false;
      photoClearButtonEl.disabled = false;
    }

    function clearSelectedPhoto(options = {}) {
      const { resetInput = false } = options;

      selectedPhotoFile = null;

      if (selectedPhotoPreviewUrl) {
        URL.revokeObjectURL(selectedPhotoPreviewUrl);
        selectedPhotoPreviewUrl = "";
      }

      photoPreviewImageEl.removeAttribute("src");
      photoPreviewImageEl.alt = "";
      photoMetaEl.textContent = "";
      photoPreviewEl.hidden = true;
      photoClearButtonEl.hidden = true;
      photoClearButtonEl.disabled = true;

      if (resetInput) {
        photoInputEl.value = "";
      }
    }

    function setVisibility(nextVisibilityRaw, options = {}) {
      const {
        syncDraft = true
      } = options;
      visibility = normalizePlaceVisibilityState(nextVisibilityRaw);

      for (const button of visibilityButtons) {
        const buttonVisibility = normalizePlaceVisibilityState(button.dataset.visibility);
        const isActive = visibility === buttonVisibility;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-pressed", String(isActive));
      }

      if (syncDraft && draftPoint) {
        mapEngine.setDraftPlace(draftPoint, { visibility });
      }
    }

    function syncScheduleState() {
      const isPublicScope = submitScope === "public";
      const scheduleEnabled = Boolean(
        isPublicScope &&
        scheduleEnabledInputEl instanceof HTMLInputElement &&
        scheduleEnabledInputEl.checked
      );

      if (scheduleWrapEl instanceof HTMLElement) {
        scheduleWrapEl.hidden = !isPublicScope;
      }

      if (scheduleAtInputEl instanceof HTMLInputElement) {
        scheduleAtInputEl.disabled = !scheduleEnabled;
        scheduleAtInputEl.min = toLocalDateTimeValue(new Date(Date.now() + 5 * 60 * 1000));
        if (!scheduleEnabled) {
          scheduleAtInputEl.value = "";
        }
      }

      if (scheduleHintEl instanceof HTMLElement) {
        scheduleHintEl.textContent = isPublicScope
          ? (
            resolveAccessState().isAdmin
              ? "Admins can publish immediately or schedule a public point for later."
              : "Public user points go to review first. If approved, the requested publish time is preserved."
          )
          : "Scheduling is available for public points.";
      }
    }

    function addTagFromInput() {
      const value = normalizeSmartTagValue(tagInputEl.value);
      tagInputEl.value = "";
      if (!value) {
        return;
      }
      if (tags.includes(value)) {
        return;
      }
      tags.push(value);
      tags = tags.slice(0, 12);
      renderTags();
    }

    function renderTags() {
      const fragment = document.createDocumentFragment();
      for (const tag of tags) {
        const chip = document.createElement("span");
        chip.className = "add-place-form__chip";

        const text = document.createElement("span");
        text.className = "add-place-form__chip-text";
        text.textContent = tag;

        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "add-place-form__chip-remove";
        remove.dataset.tag = tag;
        remove.setAttribute("aria-label", `Remove tag ${tag}`);
        remove.textContent = "x";

        chip.append(text, remove);
        fragment.append(chip);
      }

      tagsWrapEl.replaceChildren(fragment);
      tagsWrapEl.classList.toggle("is-empty", tags.length === 0);
    }

    function collectSeasonalDraftState() {
      if (!hasSeasonalModeEnabled()) {
        return {
          enabled: false,
          activeSeasons: [],
          defaultSeason: "",
          items: {},
          hasUploads: false
        };
      }

      const items = {};
      const activeSeasons = [];
      let hasUploads = false;
      for (const seasonControl of seasonControls) {
        if (!(seasonControl.enabledInputEl instanceof HTMLInputElement) || seasonControl.enabledInputEl.checked !== true) {
          continue;
        }

        activeSeasons.push(seasonControl.key);
        const title = normalizeText(seasonControl.titleInputEl?.value, "");
        const description = normalizeText(seasonControl.descriptionInputEl?.value, "");
        const file = seasonControl.file instanceof File ? seasonControl.file : null;
        if (file) {
          hasUploads = true;
        }
        items[seasonControl.key] = {
          title,
          description,
          file
        };
      }

      const fallbackSeason = normalizeSeasonKey(resolveCurrentSeasonKey(), activeSeasons[0] || "");
      return {
        enabled: activeSeasons.length > 0,
        activeSeasons,
        defaultSeason: activeSeasons.includes(fallbackSeason) ? fallbackSeason : (activeSeasons[0] || ""),
        items,
        hasUploads
      };
    }

    function resolveSeasonalHeroItem(seasonalDraft) {
      if (!seasonalDraft || seasonalDraft.enabled !== true) {
        return null;
      }

      for (const seasonKey of seasonalDraft.activeSeasons) {
        const item = seasonalDraft.items?.[seasonKey];
        if (item?.file instanceof File) {
          return {
            seasonKey,
            item
          };
        }
      }

      return seasonalDraft.activeSeasons.length > 0
        ? {
            seasonKey: seasonalDraft.activeSeasons[0],
            item: seasonalDraft.items?.[seasonalDraft.activeSeasons[0]] || null
          }
        : null;
    }

    async function submitPlace() {
      if (isSubmitting) {
        return false;
      }

      const access = resolveAccessState();
      if (isWriteBlocked(access)) {
        const deniedMessage = getWriteBlockedMessage(access);
        setStatusMessage(deniedMessage, "error");
        if (typeof showToast === "function") {
          showToast(deniedMessage);
        }
        return false;
      }
      if (submitScope === "public" && !access.isAuthenticated) {
        const deniedMessage = "Please log in to submit a public point.";
        setStatusMessage(deniedMessage, "error");
        if (typeof showToast === "function") {
          showToast(deniedMessage);
        }
        return false;
      }
      if (submitScope === "my" && !access.isAuthenticated) {
        const deniedMessage = "Please log in";
        setStatusMessage(deniedMessage, "error");
        if (typeof showToast === "function") {
          showToast(deniedMessage);
        }
        return false;
      }

      const name = normalizeText(nameInputEl.value, "");
      const description = normalizeText(descriptionInputEl.value, "");
      const seasonalDraft = collectSeasonalDraftState();
      const category = normalizeSmartCategoryValue(categorySelectEl.value);
      const priceLevel = clamp(Math.floor(Number(priceSelectEl.value) || 1), 1, 4);
      const onlyFree = Boolean(freeCheckboxEl.checked);
      const familyFriendly = Boolean(familyCheckboxEl.checked);
      const isMyScope = submitScope === "my";
      const isDirectPublicAdmin = submitScope === "public" && access.isAdmin;
      const isPublicSubmission = submitScope === "public" && !access.isAdmin;

      if (!draftPoint) {
        setStatusMessage("Pick a point on the map first.", "error");
        return false;
      }

      if (!name) {
        setStatusMessage("Title is required.", "error");
        nameInputEl.focus();
        return false;
      }
      if (
        seasonalEnabledInputEl instanceof HTMLInputElement &&
        seasonalEnabledInputEl.checked === true &&
        seasonalDraft.enabled !== true
      ) {
        setStatusMessage("Pick at least one active season for the seasonal point.", "error");
        return false;
      }

      isSubmitting = true;
      submitButtonEl.disabled = true;
      photoInputEl.disabled = true;
      photoClearButtonEl.disabled = true;
      setStatusMessage("Saving place...");

      try {
        let uploadedImageUrl = "";
        let uploadedImagePath = "";
        let seasonalContentPayload = {};
        const scheduledPublishAt = readScheduledPublishAt();
        const pendingUserPlaceId = isMyScope && (selectedPhotoFile || seasonalDraft.hasUploads)
          ? createClientUuid()
          : "";
        const uploadBatchId = !isMyScope && (selectedPhotoFile || seasonalDraft.hasUploads)
          ? createClientUuid()
          : "";
        const storagePlaceId = pendingUserPlaceId || uploadBatchId;
        if (isMyScope && (selectedPhotoFile || seasonalDraft.hasUploads) && !pendingUserPlaceId) {
          throw new Error("Unable to generate user place id for image upload.");
        }
        if (
          (selectedPhotoFile || seasonalDraft.hasUploads) &&
          (!apiClient || typeof apiClient.uploadPlaceImage !== "function")
        ) {
          throw new Error("Image upload is unavailable in this environment.");
        }

        if (selectedPhotoFile) {
          setStatusMessage("Uploading image...");
          if (!canUploadPhoto) {
            throw new Error("Please log in to upload an image.");
          }
          const uploadResult = await apiClient.uploadPlaceImage(selectedPhotoFile, {
            bucket: Config.SUPABASE_PLACE_IMAGES_BUCKET,
            pathPrefix: isMyScope ? "user-places" : "places",
            access: isMyScope || isPublicSubmission ? "private" : "public",
            userId: access.userId,
            placeId: storagePlaceId,
            signedUrlExpiresInSeconds: Config.SUPABASE_SIGNED_IMAGE_TTL_SEC
          });
          uploadedImageUrl = normalizeHttpUrl(uploadResult?.url);
          uploadedImagePath = normalizeText(uploadResult?.path, "");
          if (!uploadedImageUrl) {
            throw new Error("Failed to resolve uploaded image URL.");
          }
          if (isMyScope && !uploadedImagePath) {
            throw new Error("Failed to resolve uploaded image storage path.");
          }
          setStatusMessage("Saving place...");
        }

        if (seasonalDraft.enabled) {
          const seasonalItems = {};
          let uploadedSeasonCount = 0;
          for (const seasonKey of seasonalDraft.activeSeasons) {
            const draftItem = seasonalDraft.items?.[seasonKey] || {};
            const storedItem = {
              title: normalizeText(draftItem.title, ""),
              description: normalizeText(draftItem.description, "")
            };
            if (draftItem.file instanceof File) {
              uploadedSeasonCount += 1;
              setStatusMessage(`Uploading ${formatSeasonLabel(seasonKey).toLowerCase()} photo...`);
              const uploadResult = await apiClient.uploadPlaceImage(draftItem.file, {
                bucket: Config.SUPABASE_PLACE_IMAGES_BUCKET,
                pathPrefix: isMyScope ? "user-places" : "places",
                access: isMyScope || isPublicSubmission ? "private" : "public",
                userId: access.userId,
                placeId: storagePlaceId,
                signedUrlExpiresInSeconds: Config.SUPABASE_SIGNED_IMAGE_TTL_SEC
              });
              const seasonalImageUrl = normalizeHttpUrl(uploadResult?.url);
              const seasonalImagePath = normalizeText(uploadResult?.path, "");
              if (!seasonalImageUrl) {
                throw new Error(`Failed to resolve ${formatSeasonLabel(seasonKey).toLowerCase()} image URL.`);
              }
              if (isMyScope && !seasonalImagePath) {
                throw new Error(`Failed to resolve ${formatSeasonLabel(seasonKey).toLowerCase()} image storage path.`);
              }
              if (seasonalImagePath) {
                storedItem.image_path = seasonalImagePath;
              }
              if (!isMyScope && !isPublicSubmission && seasonalImageUrl) {
                storedItem.image_url = seasonalImageUrl;
              }
            }
            seasonalItems[seasonKey] = storedItem;
          }
          seasonalContentPayload = createSeasonalContentPayload({
            enabled: true,
            defaultSeason: seasonalDraft.defaultSeason,
            activeSeasons: seasonalDraft.activeSeasons,
            items: seasonalItems
          });
          if (Object.keys(seasonalContentPayload).length === 0) {
            throw new Error("Add title, description, or photo to at least one active season.");
          }
          if (uploadedSeasonCount > 0) {
            setStatusMessage("Saving place...");
          }
        }

        const normalizedTags = tags
          .map((entry) => normalizeSmartTagValue(entry))
          .filter(Boolean);
        const derivedTags = [];
        derivedTags.push(`price-level:${priceLevel}`);
        if (onlyFree) {
          derivedTags.push("only-free");
        }
        if (familyFriendly) {
          derivedTags.push("family-friendly");
        }
        if (seasonalDraft.enabled) {
          derivedTags.push("seasonal-story");
        }

        const seasonalHeroItem = seasonalDraft.enabled
          ? seasonalDraft.activeSeasons
              .map((seasonKey) => seasonalContentPayload?.items?.[seasonKey] || null)
              .find((item) => normalizeText(item?.image_path, "") || normalizeHttpUrl(item?.image_url))
          : null;
        const fallbackImagePath = normalizeText(seasonalHeroItem?.image_path, "");
        const fallbackImageUrl = normalizeHttpUrl(seasonalHeroItem?.image_url) || "";
        const effectiveDescription = description || normalizeText(seasonalHeroItem?.description, "");

        const payload = {
          title: name,
          name,
          description: effectiveDescription,
          ...(pendingUserPlaceId ? { id: pendingUserPlaceId } : {}),
          lat: draftPoint.lat,
          lng: draftPoint.lon,
          category,
          region: "Custom",
          country: "",
          tags: Array.from(new Set([...normalizedTags, ...derivedTags])),
          is_free: onlyFree,
          family_friendly: familyFriendly,
          is_public: submitScope === "public",
          place_scope: submitScope,
          ...(seasonalDraft.enabled ? { seasonal_content: seasonalContentPayload } : {}),
          ...(scheduledPublishAt ? { publish_at: scheduledPublishAt } : {}),
          ...((uploadedImagePath || fallbackImagePath)
            ? {
                image_path: uploadedImagePath || fallbackImagePath
            }
            : {}),
          ...(!isMyScope && !isPublicSubmission && (uploadedImageUrl || fallbackImageUrl)
            ? {
                image: uploadedImageUrl || fallbackImageUrl,
                image_url: uploadedImageUrl || fallbackImageUrl
            }
            : {})
        };

        const created = await apiClient.createPlace(payload, {
          scope: submitScope,
          isAdmin: access.isAdmin
        });
        const createdPlace = normalizeCreatedPlace(created, payload);
        if (!createdPlace) {
          throw new Error("Server returned an invalid place payload.");
        }

        const successMessage = isPublicSubmission
          ? "Point submitted for review."
          : (scheduledPublishAt ? "Point saved and scheduled." : "Place created successfully.");
        setStatusMessage(successMessage, "success");
        if (typeof showToast === "function") {
          showToast(
            isPublicSubmission
              ? "Public point sent to moderation"
              : (
                isDirectPublicAdmin
                  ? (scheduledPublishAt ? "Public point scheduled" : "Public point published")
                  : "My place created"
              )
          );
        }
        if (typeof setStatus === "function") {
          setStatus(isPublicSubmission ? "Public point submitted for review." : "New place added to map.", {
            type: "success",
            timeoutMs: 1700
          });
        }

        mapEngine.clearDraftPlace();
        mode = "idle";
        hideBanner();
        hideDrawer();
        setMapPickModeVisualState(false);
        syncToggleState();
        resetFormFields();

        if (typeof onPlaceCreated === "function") {
          onPlaceCreated(createdPlace);
        }
        return true;
      } catch (error) {
        const rawMessage = normalizeText(error?.message, "Unable to create place.");
        const lowered = rawMessage.toLowerCase();
        let message = rawMessage;
        if (submitScope === "public" && lowered.includes("place_submissions")) {
          message = "Review queue schema is missing in Supabase. Run the latest place review SQL patch.";
        } else if (submitScope === "public" && (lowered.includes("42501") || lowered.includes("permission") || lowered.includes("not allowed"))) {
          message = access.isAdmin
            ? "Admin public publish is unavailable right now."
            : "Public submission is unavailable right now. Check the Supabase review queue patch.";
        } else if (lowered.includes("banned")) {
          message = "Your account is banned. You cannot create content or upload photos.";
        } else if (lowered.includes("freeze") || lowered.includes("read-only") || lowered.includes("read only")) {
          message = "Your account is in read-only mode. You cannot create content or upload photos.";
        } else if (lowered.includes("auth") || lowered.includes("log in") || lowered.includes("unauthorized")) {
          message = "Please log in";
        }
        setStatusMessage(message, "error");
        if ((lowered.includes("banned") || lowered.includes("freeze") || lowered.includes("read-only")) && typeof showToast === "function") {
          showToast(message);
        }
        if (typeof setStatus === "function") {
          setStatus(message, {
            type: "error",
            timeoutMs: Config.STATUS_CLEAR_MS
          });
        }
        return false;
      } finally {
        isSubmitting = false;
        const latestAccess = resolveAccessState();
        submitButtonEl.disabled = isWriteBlocked(latestAccess);
        photoClearButtonEl.disabled = !selectedPhotoFile || isWriteBlocked(latestAccess);
        photoInputEl.disabled = !canUploadPhoto;
        syncSeasonalState();
      }
    }

    function normalizeCreatedPlace(response, fallbackPayload) {
      const fallbackScope = normalizeSubmitScope(fallbackPayload?.place_scope ?? submitScope);
      const fallbackVisibility = fallbackScope === "public"
        ? (resolveAccessState().isAdmin ? "approved" : "pending")
        : "private";
      if (isValidPlace(response)) {
        if (!normalizeText(response.visibility_status, "")) {
          response.visibility_status = fallbackVisibility;
        }
        response.place_scope = resolvePlaceScope(response);
        return response;
      }

      if (!response || typeof response !== "object") {
        return null;
      }

      const fallbackId = normalizeText(response.id, "");
      if (!fallbackId) {
        return null;
      }

      const mapped = {
        id: fallbackId,
        slug: normalizeText(response.slug, ""),
        name: normalizeText(response.name ?? response.title, fallbackPayload.title || "New place"),
        title: normalizeText(response.name ?? response.title, fallbackPayload.title || "New place"),
        description: normalizeText(response.description, fallbackPayload.description || "Description unavailable."),
        country: normalizeText(response.country, ""),
        region: normalizeText(response.region, fallbackPayload.region || "Custom"),
        lat: Number(response.lat ?? fallbackPayload.lat),
        lon: Number(response.lon ?? response.lng ?? fallbackPayload.lng),
        lng: Number(response.lng ?? response.lon ?? fallbackPayload.lng),
        category: normalizeText(response.category ?? fallbackPayload.category, ""),
        kind: normalizeText(response.category ?? fallbackPayload.category, ""),
        tags: Array.isArray(response.tags) ? response.tags : (fallbackPayload.tags || []),
        highlights: Array.isArray(response.tags)
          ? response.tags.slice(0, 6)
          : (fallbackPayload.tags || []).slice(0, 6),
        isFree: resolvePlaceBooleanFlag(
          response,
          ["isFree", "is_free", "free", "onlyFree"]
        ) || Boolean(fallbackPayload.is_free),
        familyFriendly: resolvePlaceBooleanFlag(
          response,
          ["familyFriendly", "family_friendly", "family"]
        ) || Boolean(fallbackPayload.family_friendly),
        image:
          normalizeHttpUrl(response.image ?? response.image_url) ||
          normalizeHttpUrl(fallbackPayload.image ?? fallbackPayload.image_url) ||
          "",
        image_url:
          normalizeHttpUrl(response.image ?? response.image_url) ||
          normalizeHttpUrl(fallbackPayload.image ?? fallbackPayload.image_url) ||
          "",
        link: normalizeHttpUrl(response.link) || "",
        is_public: fallbackScope === "public",
        place_scope: fallbackScope,
        visibility_status: normalizePlaceVisibilityState(response.visibility_status || fallbackVisibility),
        publish_at: normalizeText(response.publish_at ?? response.publishAt ?? fallbackPayload.publish_at, ""),
        publishAt: normalizeText(response.publish_at ?? response.publishAt ?? fallbackPayload.publish_at, ""),
        seasonal_content: normalizeSeasonalContentValue(
          response.seasonal_content ??
          response.seasonalContent ??
          fallbackPayload.seasonal_content ??
          fallbackPayload.seasonalContent
        ),
        created_by: normalizeText(response.created_by ?? response.createdBy ?? response.user_id, ""),
        createdAt: normalizeText(response.createdAt ?? response.created_at, new Date().toISOString()),
        updatedAt: normalizeText(response.updatedAt ?? response.updated_at, new Date().toISOString())
      };

      return isValidPlace(mapped) ? mapped : null;
    }

    function readScheduledPublishAt() {
      if (
        submitScope !== "public" ||
        !(scheduleEnabledInputEl instanceof HTMLInputElement) ||
        scheduleEnabledInputEl.checked !== true ||
        !(scheduleAtInputEl instanceof HTMLInputElement)
      ) {
        return "";
      }

      const rawValue = normalizeText(scheduleAtInputEl.value, "");
      if (!rawValue) {
        return "";
      }

      const scheduledMs = Date.parse(rawValue);
      if (!Number.isFinite(scheduledMs)) {
        throw new Error("Scheduled publish date is invalid.");
      }
      if (scheduledMs <= Date.now() + 60 * 1000) {
        throw new Error("Scheduled publish time must be at least a minute in the future.");
      }

      return new Date(scheduledMs).toISOString();
    }

    function destroy() {
      cancelFlow({ reason: "destroy", silent: true });
      clearSelectedPhoto({ resetInput: true });

      if (drawerHideTimerId) {
        window.clearTimeout(drawerHideTimerId);
        drawerHideTimerId = null;
      }
      if (bannerHideTimerId) {
        window.clearTimeout(bannerHideTimerId);
        bannerHideTimerId = null;
      }

      while (cleanupFns.length > 0) {
        const cleanupFn = cleanupFns.pop();
        try {
          cleanupFn();
        } catch (error) {
          console.error("Add place cleanup error:", error);
        }
      }
    }
  }

  function createRouteController(options) {
    const {
      startPlaceSelect,
      endPlaceSelect,
      startPickButton,
      endPickButton,
      startCustomWrap,
      endCustomWrap,
      startLatInput,
      startLonInput,
      endLatInput,
      endLonInput,
      buildButton,
      clearButton,
      inlineStatusElement,
      distanceValueElement,
      durationValueElement,
      providerValueElement,
      mapEngine,
      setStatus
    } = options;

    const CUSTOM_VALUE = "__custom__";
    const placesById = new Map();
    const cleanupFns = [];
    let pendingRequestToken = 0;
    let activePickTarget = "";

    const startChangeHandler = () => {
      updateCustomFieldsVisibility();
      handleCustomPickMode("start");
    };

    const endChangeHandler = () => {
      updateCustomFieldsVisibility();
      handleCustomPickMode("end");
    };

    const buildClickHandler = async () => {
      await buildRoute();
    };

    const clearClickHandler = () => {
      clearRouteView();
      setInlineStatus("", "info");
    };

    const startPickClickHandler = () => {
      forceArmPickMode("start");
    };

    const endPickClickHandler = () => {
      forceArmPickMode("end");
    };

    startPlaceSelect.addEventListener("change", startChangeHandler);
    endPlaceSelect.addEventListener("change", endChangeHandler);
    startPickButton.addEventListener("click", startPickClickHandler);
    endPickButton.addEventListener("click", endPickClickHandler);
    buildButton.addEventListener("click", buildClickHandler);
    clearButton.addEventListener("click", clearClickHandler);

    cleanupFns.push(() => startPlaceSelect.removeEventListener("change", startChangeHandler));
    cleanupFns.push(() => endPlaceSelect.removeEventListener("change", endChangeHandler));
    cleanupFns.push(() => startPickButton.removeEventListener("click", startPickClickHandler));
    cleanupFns.push(() => endPickButton.removeEventListener("click", endPickClickHandler));
    cleanupFns.push(() => buildButton.removeEventListener("click", buildClickHandler));
    cleanupFns.push(() => clearButton.removeEventListener("click", clearClickHandler));

    setMetrics({
      distanceMeters: null,
      durationSeconds: null,
      provider: "—"
    });
    updateCustomFieldsVisibility();
    updatePickTargetVisualState();

    return {
      setPlaces,
      setStartPlace,
      clearRouteView,
      destroy
    };

    function setPlaces(places) {
      const normalizedPlaces = Array.isArray(places)
        ? places
            .filter(isValidPlace)
            .slice()
            .sort((left, right) => left.name.localeCompare(right.name, "ru"))
        : [];

      placesById.clear();
      for (const place of normalizedPlaces) {
        placesById.set(place.id, place);
      }

      populateSelect(startPlaceSelect, normalizedPlaces);
      populateSelect(endPlaceSelect, normalizedPlaces);
      updateCustomFieldsVisibility();
    }

    function setStartPlace(placeId, options = {}) {
      const { focusEnd = true } = options;
      const normalizedPlaceId = normalizeText(placeId, "");
      if (!normalizedPlaceId || !placesById.has(normalizedPlaceId)) {
        return false;
      }

      startPlaceSelect.value = normalizedPlaceId;
      if (startPlaceSelect.value !== normalizedPlaceId) {
        return false;
      }

      activePickTarget = "";
      mapEngine.cancelCoordinatePick("start-place-programmatic");
      updateCustomFieldsVisibility();
      updatePickTargetVisualState();

      const selectedPlace = placesById.get(normalizedPlaceId);
      setInlineStatus(
        `Точка A: ${normalizeText(selectedPlace?.name, "выбрана")}. Теперь выберите точку B.`,
        "success"
      );

      if (focusEnd) {
        endPlaceSelect.focus();
      }

      return true;
    }

    function populateSelect(selectElement, places) {
      const previousValue = typeof selectElement.value === "string" ? selectElement.value : "";
      const fragment = document.createDocumentFragment();

      const emptyOption = document.createElement("option");
      emptyOption.value = "";
      emptyOption.textContent = "Выберите точку";
      fragment.append(emptyOption);

      const customOption = document.createElement("option");
      customOption.value = CUSTOM_VALUE;
      customOption.textContent = "Свои координаты";
      fragment.append(customOption);

      for (const place of places) {
        const option = document.createElement("option");
        option.value = place.id;
        option.textContent = normalizeText(place.name, "Без названия");
        fragment.append(option);
      }

      selectElement.replaceChildren(fragment);
      selectElement.value = previousValue;
      if (selectElement.value !== previousValue) {
        selectElement.value = "";
      }
    }

    function updateCustomFieldsVisibility() {
      startCustomWrap.hidden = startPlaceSelect.value !== CUSTOM_VALUE;
      endCustomWrap.hidden = endPlaceSelect.value !== CUSTOM_VALUE;
      updatePickTargetVisualState();
    }

    function forceArmPickMode(targetKind) {
      const isStart = targetKind === "start";
      const selectElement = isStart ? startPlaceSelect : endPlaceSelect;

      if (selectElement.value !== CUSTOM_VALUE) {
        selectElement.value = CUSTOM_VALUE;
        updateCustomFieldsVisibility();
      }

      handleCustomPickMode(targetKind, { force: true });
    }

    function handleCustomPickMode(targetKind, options = {}) {
      const force = options.force === true;
      const isStart = targetKind === "start";
      const selectElement = isStart ? startPlaceSelect : endPlaceSelect;
      const pointLabel = isStart ? "Точка A" : "Точка B";

      if (selectElement.value !== CUSTOM_VALUE) {
        if (activePickTarget === targetKind) {
          activePickTarget = "";
          mapEngine.cancelCoordinatePick("selection-changed");
          updatePickTargetVisualState();
        }
        return;
      }

      activePickTarget = targetKind;
      updatePickTargetVisualState();
      setInlineStatus(`${pointLabel}: кликните по карте, чтобы выбрать координаты.`, "info");

      if (!force && mapEngine.isCoordinatePickActive(targetKind)) {
        return;
      }

      mapEngine.armCoordinatePick({
        target: targetKind,
        onPick: (pickedPoint) => {
          applyPickedCoordinates(targetKind, pickedPoint);
          activePickTarget = "";
          updatePickTargetVisualState();
          setInlineStatus(
            `${pointLabel}: координаты выбраны (${pickedPoint.lat.toFixed(5)}, ${pickedPoint.lon.toFixed(5)}).`,
            "success"
          );
        },
        onCancel: (payload) => {
          if (payload?.target !== targetKind) {
            return;
          }

          if (activePickTarget === targetKind) {
            activePickTarget = "";
            updatePickTargetVisualState();
          }

          if (payload?.reason === "escape") {
            setInlineStatus(`${pointLabel}: выбор координаты отменён (Esc).`, "error");
          }
        }
      });
    }

    function applyPickedCoordinates(targetKind, pickedPoint) {
      const isStart = targetKind === "start";
      const latInput = isStart ? startLatInput : endLatInput;
      const lonInput = isStart ? startLonInput : endLonInput;

      latInput.value = String(round(pickedPoint.lat, 6));
      lonInput.value = String(round(pickedPoint.lon, 6));
    }

    function updatePickTargetVisualState() {
      startCustomWrap.classList.toggle(
        "is-pick-armed",
        activePickTarget === "start" && startPlaceSelect.value === CUSTOM_VALUE
      );
      endCustomWrap.classList.toggle(
        "is-pick-armed",
        activePickTarget === "end" && endPlaceSelect.value === CUSTOM_VALUE
      );
    }

    async function buildRoute() {
      activePickTarget = "";
      mapEngine.cancelCoordinatePick("build-started");
      updatePickTargetVisualState();

      const startPoint = resolveRoutePoint("start");
      if (!startPoint) {
        return;
      }

      const endPoint = resolveRoutePoint("end");
      if (!endPoint) {
        return;
      }

      const straightDistance = haversineDistanceMeters(
        startPoint.lat,
        startPoint.lon,
        endPoint.lat,
        endPoint.lon
      );

      if (straightDistance < 20) {
        setInlineStatus("Точки маршрута слишком близко друг к другу.", "error");
        return;
      }

      const requestToken = ++pendingRequestToken;
      setBusy(true);
      setInlineStatus("Строю маршрут...", "info");

      try {
        const routeData = await fetchRouteFromOsrm(startPoint, endPoint);
        if (requestToken !== pendingRequestToken) {
          return;
        }

        const rendered = mapEngine.drawRoute(routeData.coordinates, startPoint, endPoint);
        if (!rendered) {
          throw new Error("Route drawing failed.");
        }

        setMetrics({
          distanceMeters: routeData.distanceMeters,
          durationSeconds: routeData.durationSeconds,
          provider: routeData.provider
        });

        if (routeData.isFallback) {
          setInlineStatus("Маршрут построен в резервном режиме.", "success");
          setStatus("Маршрут построен в резервном режиме.", {
            type: "success",
            timeoutMs: 1800
          });
        } else {
          setInlineStatus("Маршрут построен.", "success");
          setStatus("Маршрут построен.", { type: "success", timeoutMs: 1500 });
        }
      } catch (error) {
        console.warn("Route API failure:", error);
        if (requestToken !== pendingRequestToken) {
          return;
        }

        const drawnFallback = mapEngine.drawDirectRoute(startPoint, endPoint);
        if (drawnFallback) {
          setMetrics({
            distanceMeters: straightDistance,
            durationSeconds: estimateDurationByDistance(straightDistance),
            provider: "Прямая линия (fallback)"
          });

          setInlineStatus("Внешние сервисы недоступны. Показан локальный маршрут.", "error");
          setStatus("Внешние сервисы недоступны. Показан локальный маршрут.", {
            type: "error",
            timeoutMs: Config.STATUS_CLEAR_MS
          });
          return;
        }

        setInlineStatus("Не удалось построить маршрут.", "error");
      } finally {
        if (requestToken === pendingRequestToken) {
          setBusy(false);
        }
      }
    }

    function resolveRoutePoint(kind) {
      const isStart = kind === "start";
      const selectElement = isStart ? startPlaceSelect : endPlaceSelect;
      const latInput = isStart ? startLatInput : endLatInput;
      const lonInput = isStart ? startLonInput : endLonInput;
      const pointLabel = isStart ? "Точка A" : "Точка B";
      const selectedValue = selectElement.value;

      if (!selectedValue) {
        setInlineStatus(`${pointLabel}: выберите точку или координаты.`, "error");
        return null;
      }

      if (selectedValue === CUSTOM_VALUE) {
        const lat = parseCoordinateInput(latInput.value, -90, 90);
        const lon = parseCoordinateInput(lonInput.value, -180, 180);

        if (lat === null || lon === null) {
          setInlineStatus(
            `${pointLabel}: введите корректные координаты (lat от -90 до 90, lon от -180 до 180).`,
            "error"
          );
          return null;
        }

        return {
          lat,
          lon,
          label: pointLabel,
          source: "custom"
        };
      }

      const place = placesById.get(selectedValue);
      if (!place) {
        setInlineStatus(`${pointLabel}: выбранная точка не найдена в текущем наборе данных.`, "error");
        return null;
      }

      return {
        lat: Number(place.lat),
        lon: Number(place.lon),
        label: normalizeText(place.name, pointLabel),
        source: "place",
        placeId: place.id
      };
    }

    async function fetchRouteFromOsrm(startPoint, endPoint) {
      const routeUrl = buildRouteApiUrl(startPoint, endPoint);
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => {
        controller.abort();
      }, Config.ROUTE_TIMEOUT_MS);

      try {
        const response = await fetch(routeUrl, {
          method: "GET",
          headers: { Accept: "application/json" },
          signal: controller.signal
        });

        const payload = await parseJsonResponse(response);
        if (!response.ok) {
          throw new Error(payload?.message || `Route request failed: ${response.status}`);
        }

        const coordinates = payload?.coordinates;
        if (!Array.isArray(coordinates) || coordinates.length < 2) {
          throw new Error("Route API response does not contain valid geometry.");
        }

        return {
          coordinates,
          distanceMeters: Number(payload.distanceMeters),
          durationSeconds: Number(payload.durationSeconds),
          provider: normalizeText(payload.provider, "Route API"),
          isFallback: payload?.isFallback === true
        };
      } finally {
        window.clearTimeout(timeoutId);
      }
    }

    function buildRouteApiUrl(startPoint, endPoint) {
      const url = new URL(Config.ROUTE_API_BASE, window.location.origin);
      url.searchParams.set("fromLat", String(round(startPoint.lat, 6)));
      url.searchParams.set("fromLon", String(round(startPoint.lon, 6)));
      url.searchParams.set("toLat", String(round(endPoint.lat, 6)));
      url.searchParams.set("toLon", String(round(endPoint.lon, 6)));
      return url.toString();
    }

    function parseCoordinateInput(rawValue, minValue, maxValue) {
      if (typeof rawValue !== "string" && typeof rawValue !== "number") {
        return null;
      }

      const normalized = String(rawValue).trim().replace(",", ".");
      if (normalized === "") {
        return null;
      }

      const numeric = Number(normalized);
      if (!Number.isFinite(numeric) || numeric < minValue || numeric > maxValue) {
        return null;
      }

      return numeric;
    }

    function clearRouteView() {
      pendingRequestToken += 1;
      activePickTarget = "";
      mapEngine.cancelCoordinatePick("route-cleared");
      startPlaceSelect.value = "";
      endPlaceSelect.value = "";
      startLatInput.value = "";
      startLonInput.value = "";
      endLatInput.value = "";
      endLonInput.value = "";
      updateCustomFieldsVisibility();
      updatePickTargetVisualState();
      mapEngine.clearRoute();
      setMetrics({
        distanceMeters: null,
        durationSeconds: null,
        provider: "—"
      });
    }

    function setBusy(isBusy) {
      buildButton.disabled = isBusy;
      clearButton.disabled = isBusy;
      buildButton.textContent = isBusy ? "Строю..." : "Построить";
    }

    function setInlineStatus(message, type = "info") {
      inlineStatusElement.textContent = typeof message === "string" ? message : "";
      inlineStatusElement.classList.remove("route-panel__status--error", "route-panel__status--success");

      if (type === "error") {
        inlineStatusElement.classList.add("route-panel__status--error");
      } else if (type === "success") {
        inlineStatusElement.classList.add("route-panel__status--success");
      }
    }

    function setMetrics(value) {
      distanceValueElement.textContent = formatDistance(value.distanceMeters);
      durationValueElement.textContent = formatDuration(value.durationSeconds);
      providerValueElement.textContent = normalizeText(value.provider, "—");
    }

    function destroy() {
      pendingRequestToken += 1;
      activePickTarget = "";
      mapEngine.cancelCoordinatePick("destroy");
      while (cleanupFns.length > 0) {
        const cleanupFn = cleanupFns.pop();
        try {
          cleanupFn();
        } catch (error) {
          console.error("Route controller cleanup error:", error);
        }
      }
    }
  }

  function createAdvancedRouteController(options) {
    const {
      startPlaceSelect,
      endPlaceSelect,
      modeSelect,
      addWaypointButton,
      extraPointsWrap,
      orderListElement,
      startPickButton,
      endPickButton,
      startMyLocationButton,
      startCustomWrap,
      endCustomWrap,
      startLatInput,
      startLonInput,
      endLatInput,
      endLonInput,
      buildButton,
      clearButton,
      inlineStatusElement,
      inlineStatusTextElement,
      inlineStatusSpinnerElement,
      distanceValueElement,
      durationValueElement,
      typeValueElement,
      providerValueElement,
      segmentsListElement,
      mapEngine,
      setStatus,
      showToast,
      onMetricsChange
    } = options;

    const CUSTOM_VALUE = "__custom__";
    const MODE_LABELS = {
      walk: "Пешком",
      car: "Авто",
      flight: "Самолёт"
    };

    const placesById = new Map();
    const endpoints = new Map();
    let sortedPlaces = [];
    let routeSelectsHydrated = false;
    let routeOrder = ["start", "end"];
    let waypointCounter = 0;
    let pendingRequestToken = 0;
    let activePickTargetId = "";
    let routePickMode = null;
    let routeOrigin = null;
    let routeDestination = null;
    let geolocationRequestToken = 0;
    let isResolvingMyLocation = false;
    let dragSourceIndex = -1;
    const cleanupFns = [];

    const startEndpoint = {
      id: "start",
      kind: "origin",
      fixed: true,
      title: "Точка A",
      selectEl: startPlaceSelect,
      customWrapEl: startCustomWrap,
      latInputEl: startLatInput,
      lonInputEl: startLonInput,
      pickButtonEl: startPickButton,
      removeButtonEl: null,
      groupEl: startPlaceSelect.closest(".route-panel__group"),
      disposeFns: []
    };

    const endEndpoint = {
      id: "end",
      kind: "destination",
      fixed: true,
      title: "Точка B",
      selectEl: endPlaceSelect,
      customWrapEl: endCustomWrap,
      latInputEl: endLatInput,
      lonInputEl: endLonInput,
      pickButtonEl: endPickButton,
      removeButtonEl: null,
      groupEl: endPlaceSelect.closest(".route-panel__group"),
      disposeFns: []
    };

    endpoints.set(startEndpoint.id, startEndpoint);
    endpoints.set(endEndpoint.id, endEndpoint);
    bindEndpoint(startEndpoint);
    bindEndpoint(endEndpoint);

    const modeChangeHandler = () => {
      setMetrics({
        distanceMeters: null,
        durationSeconds: null,
        mode: normalizeMode(modeSelect.value),
        provider: providerValueElement.textContent
      });
      setInlineStatus(`Тип маршрута: ${formatMode(modeSelect.value)}.`, "info");
    };

    const addWaypointHandler = () => {
      hydrateRouteSelects();
      addWaypoint();
    };

    const buildRouteHandler = async () => {
      hydrateRouteSelects();
      await buildRoute();
    };

    const clearRouteHandler = () => {
      clearRouteView();
      setInlineStatus("", "info");
    };

    const orderDragStartHandler = (event) => {
      const row = event.target instanceof HTMLElement
        ? event.target.closest(".route-panel__order-item")
        : null;
      if (!(row instanceof HTMLElement)) {
        return;
      }

      dragSourceIndex = Number(row.dataset.orderIndex);
      if (!Number.isInteger(dragSourceIndex) || dragSourceIndex < 0) {
        dragSourceIndex = -1;
        return;
      }

      row.classList.add("is-dragging");
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", String(dragSourceIndex));
      }
    };

    const orderDragOverHandler = (event) => {
      const row = event.target instanceof HTMLElement
        ? event.target.closest(".route-panel__order-item")
        : null;
      if (!(row instanceof HTMLElement)) {
        return;
      }

      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "move";
      }

      for (const item of orderListElement.querySelectorAll(".route-panel__order-item")) {
        item.classList.remove("is-drop-target");
      }
      row.classList.add("is-drop-target");
    };

    const orderDropHandler = (event) => {
      const row = event.target instanceof HTMLElement
        ? event.target.closest(".route-panel__order-item")
        : null;
      if (!(row instanceof HTMLElement)) {
        clearOrderDnD();
        return;
      }

      event.preventDefault();
      const targetIndex = Number(row.dataset.orderIndex);
      if (
        !Number.isInteger(targetIndex) ||
        targetIndex < 0 ||
        dragSourceIndex < 0 ||
        dragSourceIndex >= routeOrder.length ||
        targetIndex >= routeOrder.length ||
        dragSourceIndex === targetIndex
      ) {
        clearOrderDnD();
        return;
      }

      const [movedId] = routeOrder.splice(dragSourceIndex, 1);
      routeOrder.splice(targetIndex, 0, movedId);
      renderOrderList();
      setInlineStatus("Порядок точек обновлён.", "success");
      clearOrderDnD();
    };

    const orderDragEndHandler = () => {
      clearOrderDnD();
    };

    const orderClickHandler = (event) => {
      const focusButton = event.target instanceof HTMLElement
        ? event.target.closest(".route-panel__order-focus")
        : null;
      if (!(focusButton instanceof HTMLButtonElement)) {
        return;
      }

      const endpointId = normalizeText(focusButton.dataset.endpointId, "");
      const endpoint = endpoints.get(endpointId);
      if (!endpoint) {
        return;
      }

      endpoint.selectEl.focus();
    };

    const startMyLocationHandler = () => {
      hydrateRouteSelects();
      void setOriginFromMyLocation();
    };

    const documentEscapeHandler = (event) => {
      if (event.key !== "Escape") {
        return;
      }

      if (!activePickTargetId && !mapEngine.isCoordinatePickActive()) {
        return;
      }

      event.preventDefault();
      mapEngine.cancelCoordinatePick("escape");
    };

    modeSelect.addEventListener("change", modeChangeHandler);
    addWaypointButton.addEventListener("click", addWaypointHandler);
    buildButton.addEventListener("click", buildRouteHandler);
    clearButton.addEventListener("click", clearRouteHandler);
    orderListElement.addEventListener("dragstart", orderDragStartHandler);
    orderListElement.addEventListener("dragover", orderDragOverHandler);
    orderListElement.addEventListener("drop", orderDropHandler);
    orderListElement.addEventListener("dragend", orderDragEndHandler);
    orderListElement.addEventListener("click", orderClickHandler);
    if (startMyLocationButton instanceof HTMLButtonElement) {
      startMyLocationButton.addEventListener("click", startMyLocationHandler);
    }
    document.addEventListener("keydown", documentEscapeHandler);

    const routeSelectHydrationHandler = () => {
      hydrateRouteSelects();
    };
    startPlaceSelect.addEventListener("focus", routeSelectHydrationHandler);
    startPlaceSelect.addEventListener("pointerdown", routeSelectHydrationHandler, { passive: true });
    endPlaceSelect.addEventListener("focus", routeSelectHydrationHandler);
    endPlaceSelect.addEventListener("pointerdown", routeSelectHydrationHandler, { passive: true });

    cleanupFns.push(() => modeSelect.removeEventListener("change", modeChangeHandler));
    cleanupFns.push(() => addWaypointButton.removeEventListener("click", addWaypointHandler));
    cleanupFns.push(() => buildButton.removeEventListener("click", buildRouteHandler));
    cleanupFns.push(() => clearButton.removeEventListener("click", clearRouteHandler));
    cleanupFns.push(() => orderListElement.removeEventListener("dragstart", orderDragStartHandler));
    cleanupFns.push(() => orderListElement.removeEventListener("dragover", orderDragOverHandler));
    cleanupFns.push(() => orderListElement.removeEventListener("drop", orderDropHandler));
    cleanupFns.push(() => orderListElement.removeEventListener("dragend", orderDragEndHandler));
    cleanupFns.push(() => orderListElement.removeEventListener("click", orderClickHandler));
    if (startMyLocationButton instanceof HTMLButtonElement) {
      cleanupFns.push(() => startMyLocationButton.removeEventListener("click", startMyLocationHandler));
    }
    cleanupFns.push(() => document.removeEventListener("keydown", documentEscapeHandler));
    cleanupFns.push(() => startPlaceSelect.removeEventListener("focus", routeSelectHydrationHandler));
    cleanupFns.push(() => startPlaceSelect.removeEventListener("pointerdown", routeSelectHydrationHandler));
    cleanupFns.push(() => endPlaceSelect.removeEventListener("focus", routeSelectHydrationHandler));
    cleanupFns.push(() => endPlaceSelect.removeEventListener("pointerdown", routeSelectHydrationHandler));

    setMetrics({
      distanceMeters: null,
      durationSeconds: null,
      mode: normalizeMode(modeSelect.value),
      provider: "—"
    });
    renderSegments([]);
    updateCustomWraps();
    renderOrderList();
    refreshAddWaypointButton();
    syncPrimaryRouteState();

    return {
      setPlaces,
      setStartPlace,
      clearRouteView,
      destroy
    };

    function bindEndpoint(endpoint) {
      const onSelectChange = () => {
        updateCustomWraps();
        if (activePickTargetId === endpoint.id || mapEngine.isCoordinatePickActive(endpoint.id)) {
          handlePickMode(endpoint.id);
        }
        syncPrimaryRouteState();
        renderOrderList();
      };

      const onCoordinateInput = () => {
        syncPrimaryRouteState();
        renderOrderList();
      };

      const onPickClick = () => {
        if (activePickTargetId === endpoint.id && mapEngine.isCoordinatePickActive(endpoint.id)) {
          mapEngine.cancelCoordinatePick("button-toggle");
          setInlineStatus(`${endpoint.title}: режим выбора отменён.`, "info");
          return;
        }

        forcePickMode(endpoint.id);
      };

      endpoint.selectEl.addEventListener("change", onSelectChange);
      endpoint.latInputEl.addEventListener("input", onCoordinateInput);
      endpoint.lonInputEl.addEventListener("input", onCoordinateInput);
      endpoint.pickButtonEl.addEventListener("click", onPickClick);

      endpoint.disposeFns.push(() => endpoint.selectEl.removeEventListener("change", onSelectChange));
      endpoint.disposeFns.push(() => endpoint.latInputEl.removeEventListener("input", onCoordinateInput));
      endpoint.disposeFns.push(() => endpoint.lonInputEl.removeEventListener("input", onCoordinateInput));
      endpoint.disposeFns.push(() => endpoint.pickButtonEl.removeEventListener("click", onPickClick));

      if (endpoint.removeButtonEl instanceof HTMLButtonElement) {
        const onRemove = () => {
          removeWaypoint(endpoint.id);
        };
        endpoint.removeButtonEl.addEventListener("click", onRemove);
        endpoint.disposeFns.push(() => endpoint.removeButtonEl.removeEventListener("click", onRemove));
      }
    }

    function setPlaces(places) {
      const normalizedPlaces = Array.isArray(places)
        ? places
            .filter(isValidPlace)
            .slice()
            .sort((left, right) => left.name.localeCompare(right.name, "ru"))
        : [];

      sortedPlaces = normalizedPlaces;
      placesById.clear();
      for (const place of normalizedPlaces) {
        placesById.set(place.id, place);
      }

      if (routeSelectsHydrated) {
        for (const endpoint of endpoints.values()) {
          populateSelect(endpoint.selectEl, normalizedPlaces);
        }
      }

      updateCustomWraps();
      syncPrimaryRouteState();
      renderOrderList();
    }

    function setStartPlace(placeId, settings = {}) {
      hydrateRouteSelects();
      const { focusEnd = true } = settings;
      const normalizedPlaceId = normalizeText(placeId, "");
      if (!normalizedPlaceId || !placesById.has(normalizedPlaceId)) {
        return false;
      }

      const endpoint = endpoints.get("start");
      if (!endpoint) {
        return false;
      }

      endpoint.selectEl.value = normalizedPlaceId;
      if (endpoint.selectEl.value !== normalizedPlaceId) {
        return false;
      }

      setActivePickTarget("");
      mapEngine.cancelCoordinatePick("start-place-programmatic");
      updateCustomWraps();
      syncPrimaryRouteState();
      renderOrderList();

      const selectedPlace = placesById.get(normalizedPlaceId);
      setInlineStatus(
        `Точка A: ${normalizeText(selectedPlace?.name, "выбрана")}. Теперь выберите следующую точку.`,
        "success"
      );

      if (focusEnd) {
        endPlaceSelect.focus();
      }

      return true;
    }

    function populateSelect(selectElement, places) {
      const previousValue = typeof selectElement.value === "string" ? selectElement.value : "";
      const fragment = document.createDocumentFragment();

      const emptyOption = document.createElement("option");
      emptyOption.value = "";
      emptyOption.textContent = "Выберите точку";
      fragment.append(emptyOption);

      const customOption = document.createElement("option");
      customOption.value = CUSTOM_VALUE;
      customOption.textContent = "Свои координаты";
      fragment.append(customOption);

      for (const place of places) {
        const option = document.createElement("option");
        option.value = place.id;
        option.textContent = normalizeText(place.name, "Без названия");
        fragment.append(option);
      }

      selectElement.replaceChildren(fragment);
      selectElement.value = previousValue;
      if (selectElement.value !== previousValue) {
        selectElement.value = "";
      }
    }

    function hydrateRouteSelects() {
      if (routeSelectsHydrated) {
        return;
      }

      routeSelectsHydrated = true;
      for (const endpoint of endpoints.values()) {
        populateSelect(endpoint.selectEl, sortedPlaces);
      }
      updateCustomWraps();
      syncPrimaryRouteState();
      renderOrderList();
    }

    function addWaypoint() {
      hydrateRouteSelects();
      if (endpoints.size >= Config.ROUTE_MAX_POINTS) {
        setInlineStatus(
          `Достигнут лимит: максимум ${Config.ROUTE_MAX_POINTS} точек.`,
          "error"
        );
        return false;
      }

      waypointCounter += 1;
      const endpointId = `waypoint-${waypointCounter}`;
      const endpoint = createExtraEndpoint(endpointId, waypointCounter);
      endpoints.set(endpoint.id, endpoint);
      routeOrder.push(endpoint.id);

      bindEndpoint(endpoint);
      populateSelect(endpoint.selectEl, sortedPlaces);
      updateCustomWraps();
      renderOrderList();
      refreshAddWaypointButton();
      setInlineStatus(`Добавлена точка ${letter(routeOrder.length - 1)}.`, "success");
      return true;
    }

    function createExtraEndpoint(endpointId, sequence) {
      const groupEl = document.createElement("div");
      groupEl.className = "route-panel__group route-panel__group--extra";
      groupEl.dataset.endpointId = endpointId;

      const head = document.createElement("div");
      head.className = "route-panel__group-head";

      const title = document.createElement("p");
      title.className = "route-panel__group-title";
      title.textContent = `Промежуточная ${sequence}`;
      head.append(title);

      const removeButtonEl = document.createElement("button");
      removeButtonEl.type = "button";
      removeButtonEl.className = "icon-btn route-panel__remove-waypoint";
      removeButtonEl.textContent = "Г—";
      removeButtonEl.setAttribute("aria-label", "Удалить промежуточную точку");
      head.append(removeButtonEl);

      const selectEl = document.createElement("select");
      selectEl.className = "select-input route-panel__select";

      const customWrapEl = document.createElement("div");
      customWrapEl.className = "route-panel__custom";
      customWrapEl.hidden = true;

      const coords = document.createElement("div");
      coords.className = "route-panel__coords";

      const latInputEl = document.createElement("input");
      latInputEl.className = "text-input route-panel__coord-input";
      latInputEl.type = "number";
      latInputEl.step = "any";
      latInputEl.inputMode = "decimal";
      latInputEl.placeholder = "Широта (-90..90)";

      const lonInputEl = document.createElement("input");
      lonInputEl.className = "text-input route-panel__coord-input";
      lonInputEl.type = "number";
      lonInputEl.step = "any";
      lonInputEl.inputMode = "decimal";
      lonInputEl.placeholder = "Долгота (-180..180)";

      coords.append(latInputEl, lonInputEl);

      const pickButtonEl = document.createElement("button");
      pickButtonEl.type = "button";
      pickButtonEl.className = "app-btn app-btn--ghost route-panel__pick-btn";
      pickButtonEl.textContent = "Выбрать на карте";

      customWrapEl.append(coords, pickButtonEl);
      groupEl.append(head, selectEl, customWrapEl);
      extraPointsWrap.append(groupEl);

      return {
        id: endpointId,
        kind: "waypoint",
        fixed: false,
        title: title.textContent,
        selectEl,
        customWrapEl,
        latInputEl,
        lonInputEl,
        pickButtonEl,
        removeButtonEl,
        groupEl,
        disposeFns: []
      };
    }

    function removeWaypoint(endpointId) {
      const endpoint = endpoints.get(endpointId);
      if (!endpoint || endpoint.fixed) {
        return false;
      }

      if (activePickTargetId === endpointId) {
        setActivePickTarget("");
        mapEngine.cancelCoordinatePick("waypoint-removed");
      }

      while (endpoint.disposeFns.length > 0) {
        const disposeFn = endpoint.disposeFns.pop();
        try {
          disposeFn();
        } catch (error) {
          console.error("Route endpoint cleanup error:", error);
        }
      }

      endpoint.groupEl.remove();
      endpoints.delete(endpointId);
      routeOrder = routeOrder.filter((id) => id !== endpointId);
      updateCustomWraps();
      syncPrimaryRouteState();
      renderOrderList();
      refreshAddWaypointButton();
      setInlineStatus("Промежуточная точка удалена.", "success");
      return true;
    }
    function clearRouteView() {
      pendingRequestToken += 1;
      setActivePickTarget("");
      routeOrigin = null;
      routeDestination = null;
      mapEngine.cancelCoordinatePick("route-cleared");
      clearOrderDnD();

      for (const endpoint of Array.from(endpoints.values())) {
        if (endpoint.fixed) {
          endpoint.selectEl.value = "";
          endpoint.latInputEl.value = "";
          endpoint.lonInputEl.value = "";
          continue;
        }

        while (endpoint.disposeFns.length > 0) {
          const disposeFn = endpoint.disposeFns.pop();
          try {
            disposeFn();
          } catch (error) {
            console.error("Route endpoint cleanup error:", error);
          }
        }

        endpoint.groupEl.remove();
        endpoints.delete(endpoint.id);
      }

      routeOrder = ["start", "end"];
      waypointCounter = 0;
      mapEngine.clearRoute();
      setMetrics({
        distanceMeters: null,
        durationSeconds: null,
        mode: normalizeMode(modeSelect.value),
        provider: "—"
      });
      renderSegments([]);
      updateCustomWraps();
      syncPrimaryRouteState();
      renderOrderList();
      refreshAddWaypointButton();
      updatePickUi();
      setMyLocationLoadingState(false);
    }

    async function buildRoute() {
      setActivePickTarget("");
      mapEngine.cancelCoordinatePick("build-started");
      syncPrimaryRouteState();
      updatePickUi();

      const mode = normalizeMode(modeSelect.value);
      const orderedIds = normalizeOrder();
      if (orderedIds.length < 2) {
        setInlineStatus("Выберите минимум две точки A и B.", "error");
        return;
      }

      const points = [];
      for (let index = 0; index < orderedIds.length; index += 1) {
        const endpoint = endpoints.get(orderedIds[index]);
        if (!endpoint) {
          continue;
        }

        const point = resolvePoint(endpoint, index);
        if (!point) {
          return;
        }

        points.push(point);
      }

      if (points.length < 2) {
        setInlineStatus("Недостаточно валидных точек для маршрута.", "error");
        return;
      }

      const requestToken = ++pendingRequestToken;
      setBusy(true);
      setInlineStatus("Строю маршрут...", "loading");

      try {
        const payload = await requestRoute(points, mode);
        if (requestToken !== pendingRequestToken) {
          return;
        }

        const model = normalizeRoutePayload(payload, points, mode);
        if (!mapEngine.drawRoute(model)) {
          throw new Error("Route drawing failed.");
        }

        setMetrics({
          distanceMeters: model.distanceMeters,
          durationSeconds: model.durationSeconds,
          mode: model.mode,
          provider: model.provider
        });
        renderSegments(model.segments);

        if (model.isFallback) {
          setInlineStatus("Маршрут построен. Часть сегментов в fallback-режиме.", "success");
          setStatus("Маршрут построен. Часть сегментов в fallback-режиме.", {
            type: "success",
            timeoutMs: 1800
          });
        } else {
          setInlineStatus("Маршрут построен.", "success");
          setStatus("Маршрут построен.", { type: "success", timeoutMs: 1500 });
        }
      } catch (error) {
        if (requestToken !== pendingRequestToken) {
          return;
        }

        console.warn("Route API failure:", error);
        const fallback = localFallbackRoute(points, mode);
        if (mapEngine.drawRoute(fallback)) {
          setMetrics({
            distanceMeters: fallback.distanceMeters,
            durationSeconds: fallback.durationSeconds,
            mode: fallback.mode,
            provider: fallback.provider
          });
          renderSegments(fallback.segments);

          setInlineStatus("Сервис маршрутов недоступен. Показан локальный маршрут.", "error");
          setStatus("Сервис маршрутов недоступен. Показан локальный маршрут.", {
            type: "error",
            timeoutMs: Config.STATUS_CLEAR_MS
          });
        } else {
          setInlineStatus("Не удалось построить маршрут.", "error");
        }
      } finally {
        if (requestToken === pendingRequestToken) {
          setBusy(false);
        }
      }
    }

    function resolvePoint(endpoint, orderIndex) {
      const label = `Точка ${letter(orderIndex)}`;
      const selectedValue = normalizeText(endpoint.selectEl.value, "");

      if (!selectedValue) {
        setInlineStatus(`${label}: выберите точку или координаты.`, "error");
        syncPrimaryPointFromResolved(endpoint.id, null);
        return null;
      }

      if (selectedValue === CUSTOM_VALUE) {
        const lat = parseCoordinate(endpoint.latInputEl.value, -90, 90);
        const lon = parseCoordinate(endpoint.lonInputEl.value, -180, 180);
        if (lat === null || lon === null) {
          setInlineStatus(`${label}: введите координаты (lat -90..90, lon -180..180).`, "error");
          syncPrimaryPointFromResolved(endpoint.id, null);
          return null;
        }

        const resolvedPoint = {
          id: endpoint.id,
          lat,
          lon,
          label,
          source: "custom"
        };
        syncPrimaryPointFromResolved(endpoint.id, resolvedPoint);
        return resolvedPoint;
      }

      const place = placesById.get(selectedValue);
      if (!place) {
        setInlineStatus(`${label}: выбранная точка не найдена.`, "error");
        syncPrimaryPointFromResolved(endpoint.id, null);
        return null;
      }

      const resolvedPoint = {
        id: endpoint.id,
        lat: Number(place.lat),
        lon: Number(place.lon),
        label: normalizeText(place.name, label),
        source: "place",
        placeId: place.id
      };
      syncPrimaryPointFromResolved(endpoint.id, resolvedPoint);
      return resolvedPoint;
    }

    function updateCustomWraps() {
      for (const endpoint of endpoints.values()) {
        endpoint.customWrapEl.hidden = endpoint.selectEl.value !== CUSTOM_VALUE;
      }
      updatePickUi();
    }

    function forcePickMode(endpointId) {
      const endpoint = endpoints.get(endpointId);
      if (!endpoint) {
        return;
      }

      if (endpoint.selectEl.value !== CUSTOM_VALUE) {
        endpoint.selectEl.value = CUSTOM_VALUE;
        updateCustomWraps();
      }

      handlePickMode(endpointId, { force: true });
    }

    function handlePickMode(endpointId, settings = {}) {
      const endpoint = endpoints.get(endpointId);
      if (!endpoint) {
        return;
      }

      const { force = false } = settings;
      if (endpoint.selectEl.value !== CUSTOM_VALUE) {
        if (activePickTargetId === endpointId) {
          setActivePickTarget("");
          mapEngine.cancelCoordinatePick("selection-changed");
          updatePickUi();
        }
        syncPrimaryRouteState();
        return;
      }

      setActivePickTarget(endpointId);
      updatePickUi();
      const pickTargetLabel = routePickMode === "origin"
        ? "Origin"
        : (routePickMode === "destination" ? "Destination" : endpoint.title);
      setInlineStatus(`Кликни по карте чтобы выбрать ${pickTargetLabel}.`, "info");

      if (!force && mapEngine.isCoordinatePickActive(endpointId)) {
        return;
      }

      mapEngine.armCoordinatePick({
        target: endpointId,
        hint: resolvePickHintForEndpoint(endpoint),
        onPick: (point) => {
          endpoint.latInputEl.value = String(round(point.lat, 6));
          endpoint.lonInputEl.value = String(round(point.lon, 6));
          setActivePickTarget("");
          syncPrimaryRouteState();
          updatePickUi();
          renderOrderList();
          setInlineStatus(
            `${endpoint.title}: координаты выбраны (${point.lat.toFixed(5)}, ${point.lon.toFixed(5)}).`,
            "success"
          );
        },
        onCancel: (payload) => {
          if (payload?.target !== endpointId) {
            return;
          }

          if (activePickTargetId === endpointId) {
            setActivePickTarget("");
            updatePickUi();
          }

          if (payload?.reason === "escape") {
            setInlineStatus(`${endpoint.title}: выбор координаты отменён (Esc).`, "error");
          }

          if (payload?.reason !== "picked") {
            syncPrimaryRouteState();
          }
        }
      });
    }

    function updatePickUi() {
      for (const endpoint of endpoints.values()) {
        const isArmed = endpoint.id === activePickTargetId && endpoint.selectEl.value === CUSTOM_VALUE;
        endpoint.customWrapEl.classList.toggle(
          "is-pick-armed",
          isArmed
        );
        if (endpoint.groupEl instanceof HTMLElement) {
          endpoint.groupEl.classList.toggle("is-pick-armed", isArmed);
        }
        if (endpoint.pickButtonEl instanceof HTMLButtonElement) {
          endpoint.pickButtonEl.classList.toggle("is-active", isArmed);
          endpoint.pickButtonEl.setAttribute("aria-pressed", String(isArmed));
        }
      }
    }

    function setActivePickTarget(endpointId) {
      const normalizedEndpointId = normalizeText(endpointId, "");
      activePickTargetId = normalizedEndpointId;
      if (normalizedEndpointId === "start") {
        routePickMode = "origin";
        return;
      }
      if (normalizedEndpointId === "end") {
        routePickMode = "destination";
        return;
      }
      routePickMode = null;
    }

    function resolvePickHintForEndpoint(endpoint) {
      if (endpoint?.id === "start") {
        return "Кликни по карте чтобы выбрать Origin.";
      }
      if (endpoint?.id === "end") {
        return "Кликни по карте чтобы выбрать Destination.";
      }
      return `Кликни по карте чтобы выбрать ${normalizeText(endpoint?.title, "точку")}.`;
    }

    function syncPrimaryPointFromResolved(endpointId, resolvedPoint) {
      if (endpointId === "start") {
        routeOrigin = clonePrimaryPoint(resolvedPoint);
        return;
      }
      if (endpointId === "end") {
        routeDestination = clonePrimaryPoint(resolvedPoint);
      }
    }

    function syncPrimaryRouteState() {
      routeOrigin = resolvePrimaryEndpointState("start");
      routeDestination = resolvePrimaryEndpointState("end");
    }

    function resolvePrimaryEndpointState(endpointId) {
      const endpoint = endpoints.get(endpointId);
      if (!endpoint) {
        return null;
      }

      const selectedValue = normalizeText(endpoint.selectEl.value, "");
      if (!selectedValue) {
        return null;
      }

      if (selectedValue === CUSTOM_VALUE) {
        const lat = parseCoordinate(endpoint.latInputEl.value, -90, 90);
        const lon = parseCoordinate(endpoint.lonInputEl.value, -180, 180);
        if (lat === null || lon === null) {
          return null;
        }
        return {
          id: endpoint.id,
          lat,
          lon,
          label: endpoint.title,
          source: "custom"
        };
      }

      const place = placesById.get(selectedValue);
      if (!place) {
        return null;
      }

      return {
        id: endpoint.id,
        lat: Number(place.lat),
        lon: Number(place.lon),
        label: normalizeText(place.name, endpoint.title),
        source: "place",
        placeId: place.id
      };
    }

    function clonePrimaryPoint(point) {
      if (!point || typeof point !== "object") {
        return null;
      }

      return {
        id: normalizeText(point.id, ""),
        lat: Number(point.lat),
        lon: Number(point.lon),
        label: normalizeText(point.label, ""),
        source: normalizeText(point.source, ""),
        placeId: normalizeText(point.placeId, "")
      };
    }

    async function setOriginFromMyLocation() {
      if (isResolvingMyLocation) {
        return false;
      }

      if (!navigator.geolocation || typeof navigator.geolocation.getCurrentPosition !== "function") {
        const message = "Разреши геолокацию в браузере.";
        setInlineStatus(message, "error");
        setStatus(message, { type: "error", timeoutMs: 2200 });
        if (typeof showToast === "function") {
          showToast("Разреши геолокацию");
        }
        return false;
      }

      const endpoint = endpoints.get("start");
      if (!endpoint) {
        return false;
      }

      const requestToken = ++geolocationRequestToken;
      isResolvingMyLocation = true;
      setMyLocationLoadingState(true);
      setInlineStatus("Определяю вашу геопозицию…", "loading");

      try {
        const position = await requestCurrentPositionForRoute();
        if (requestToken !== geolocationRequestToken) {
          return false;
        }

        const latRaw = Number(position?.coords?.latitude);
        const lonRaw = Number(position?.coords?.longitude);
        const accuracyRaw = Number(position?.coords?.accuracy);
        if (!Number.isFinite(latRaw) || !Number.isFinite(lonRaw)) {
          throw new Error("invalid-position");
        }

        endpoint.selectEl.value = CUSTOM_VALUE;
        endpoint.latInputEl.value = String(round(latRaw, 6));
        endpoint.lonInputEl.value = String(round(lonRaw, 6));

        setActivePickTarget("");
        mapEngine.cancelCoordinatePick("origin-my-location");
        updateCustomWraps();
        syncPrimaryRouteState();
        renderOrderList();

        const userLocation = {
          lat: round(latRaw, 6),
          lon: round(lonRaw, 6),
          accuracy: Number.isFinite(accuracyRaw) ? Math.max(0, accuracyRaw) : 0,
          label: "You"
        };
        mapEngine.setUserLocation?.(userLocation);

        if (typeof mapEngine.flyToCoordinates === "function") {
          const currentZoom = Number(mapEngine.getView?.()?.zoom);
          const targetZoom = Number.isFinite(currentZoom)
            ? Math.max(currentZoom, Config.NEAR_ME_TARGET_ZOOM)
            : Config.NEAR_ME_TARGET_ZOOM;
          mapEngine.flyToCoordinates(userLocation.lat, userLocation.lon, { targetZoom });
        }

        setInlineStatus("Origin установлен от моего местоположения.", "success");
        setStatus("Origin установлен от моего местоположения.", { type: "success", timeoutMs: 1500 });

        if (routeDestination) {
          await buildRoute();
        }
        return true;
      } catch (error) {
        if (requestToken !== geolocationRequestToken) {
          return false;
        }

        const message = resolveRouteGeolocationErrorMessage(error);
        setInlineStatus(message, "error");
        setStatus(message, { type: "error", timeoutMs: 2400 });
        if (typeof showToast === "function") {
          showToast("Разреши геолокацию");
        }
        return false;
      } finally {
        if (requestToken === geolocationRequestToken) {
          isResolvingMyLocation = false;
          setMyLocationLoadingState(false);
        }
      }
    }

    function setMyLocationLoadingState(isLoading) {
      if (!(startMyLocationButton instanceof HTMLButtonElement)) {
        return;
      }

      const nextLoading = Boolean(isLoading);
      startMyLocationButton.textContent = nextLoading
        ? "Определяю..."
        : "От моего местоположения";
      startMyLocationButton.disabled = nextLoading || buildButton.disabled;
      startMyLocationButton.setAttribute("aria-busy", String(nextLoading));
    }

    function resolveRouteGeolocationErrorMessage(error) {
      const code = Number(error?.code);
      if (code === 1) {
        return "Разреши геолокацию в браузере.";
      }
      if (code === 2) {
        return "Не удалось определить геопозицию. Проверьте сеть и GPS.";
      }
      if (code === 3) {
        return "Превышено время ожидания геопозиции. Попробуйте снова.";
      }
      return "Не удалось получить геопозицию.";
    }

    function requestCurrentPositionForRoute() {
      return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          {
            enableHighAccuracy: true,
            timeout: Config.GEOLOCATION_TIMEOUT_MS,
            maximumAge: Config.GEOLOCATION_MAX_AGE_MS
          }
        );
      });
    }

    function normalizeOrder() {
      routeOrder = routeOrder.filter((id) => endpoints.has(id));
      for (const endpointId of endpoints.keys()) {
        if (!routeOrder.includes(endpointId)) {
          routeOrder.push(endpointId);
        }
      }
      return routeOrder.slice();
    }

    function renderOrderList() {
      const order = normalizeOrder();
      const fragment = document.createDocumentFragment();

      for (let index = 0; index < order.length; index += 1) {
        const endpointId = order[index];
        const endpoint = endpoints.get(endpointId);
        if (!endpoint) {
          continue;
        }

        const row = document.createElement("li");
        row.className = "route-panel__order-item";
        row.draggable = true;
        row.dataset.orderIndex = String(index);

        const bullet = document.createElement("span");
        bullet.className = "route-panel__order-bullet";
        bullet.textContent = letter(index);
        row.append(bullet);

        const textWrap = document.createElement("span");
        textWrap.className = "route-panel__order-text";

        const title = document.createElement("strong");
        title.className = "route-panel__order-name";
        title.textContent = orderRowTitle(endpoint, index);
        textWrap.append(title);

        const meta = document.createElement("span");
        meta.className = "route-panel__order-meta";
        meta.textContent = endpoint.selectEl.value === CUSTOM_VALUE
          ? "Свои координаты"
          : "Точка из списка";
        textWrap.append(meta);

        row.append(textWrap);

        const focus = document.createElement("button");
        focus.type = "button";
        focus.className = "route-panel__order-focus";
        focus.dataset.endpointId = endpoint.id;
        focus.textContent = "◎";
        row.append(focus);

        fragment.append(row);
      }

      orderListElement.replaceChildren(fragment);
    }

    function orderRowTitle(endpoint, orderIndex) {
      const pointLetter = letter(orderIndex);
      const selectedValue = normalizeText(endpoint.selectEl.value, "");
      if (!selectedValue) {
        return `Точка ${pointLetter}: не выбрана`;
      }

      if (selectedValue === CUSTOM_VALUE) {
        const lat = parseCoordinate(endpoint.latInputEl.value, -90, 90);
        const lon = parseCoordinate(endpoint.lonInputEl.value, -180, 180);
        if (lat === null || lon === null) {
          return `Точка ${pointLetter}: свои координаты`;
        }
        return `Точка ${pointLetter}: ${lat.toFixed(3)}, ${lon.toFixed(3)}`;
      }

      const place = placesById.get(selectedValue);
      return `Точка ${pointLetter}: ${normalizeText(place?.name, "точка")}`;
    }

    function letter(index) {
      if (!Number.isInteger(index) || index < 0) {
        return "A";
      }
      if (index < 26) {
        return String.fromCharCode(65 + index);
      }
      return `#${index + 1}`;
    }
    function renderSegments(segments) {
      const safeSegments = Array.isArray(segments) ? segments : [];
      const fragment = document.createDocumentFragment();

      if (safeSegments.length === 0) {
        const item = document.createElement("li");
        item.className = "route-panel__segment route-panel__segment--empty";
        item.textContent = "Соберите минимум две точки и нажмите «Построить».";
        fragment.append(item);
        segmentsListElement.replaceChildren(fragment);
        return;
      }

      for (let index = 0; index < safeSegments.length; index += 1) {
        const segment = safeSegments[index];

        const item = document.createElement("li");
        item.className = "route-panel__segment";
        if (segment?.isFallback) {
          item.classList.add("is-fallback");
        }

        const title = document.createElement("p");
        title.className = "route-panel__segment-title";
        title.textContent = `${letter(index)} > ${letter(index + 1)}`;
        item.append(title);

        const meta = document.createElement("p");
        meta.className = "route-panel__segment-meta";
        meta.textContent = `${formatDistance(segment?.distanceMeters)} • ${formatDuration(segment?.durationSeconds)}`;
        item.append(meta);

        const provider = document.createElement("p");
        provider.className = "route-panel__segment-provider";
        provider.textContent = normalizeText(segment?.provider, "Локальная модель");
        item.append(provider);

        fragment.append(item);
      }

      segmentsListElement.replaceChildren(fragment);
    }

    function refreshAddWaypointButton() {
      const atLimit = endpoints.size >= Config.ROUTE_MAX_POINTS;
      addWaypointButton.disabled = atLimit;
      addWaypointButton.textContent = atLimit
        ? `Лимит: ${Config.ROUTE_MAX_POINTS}`
        : "+ Добавить точку C";
    }

    function setBusy(isBusy) {
      buildButton.disabled = isBusy;
      clearButton.disabled = isBusy;
      modeSelect.disabled = isBusy;
      addWaypointButton.disabled = isBusy || endpoints.size >= Config.ROUTE_MAX_POINTS;
      if (startMyLocationButton instanceof HTMLButtonElement) {
        startMyLocationButton.disabled = isBusy || isResolvingMyLocation;
      }

      for (const endpoint of endpoints.values()) {
        endpoint.selectEl.disabled = isBusy;
        endpoint.pickButtonEl.disabled = isBusy;
        endpoint.latInputEl.disabled = isBusy;
        endpoint.lonInputEl.disabled = isBusy;
        if (endpoint.removeButtonEl instanceof HTMLButtonElement) {
          endpoint.removeButtonEl.disabled = isBusy;
        }
      }

      buildButton.textContent = isBusy ? "Строю..." : "Построить";
      setMyLocationLoadingState(isResolvingMyLocation);
    }

    function setInlineStatus(message, type = "info") {
      inlineStatusTextElement.textContent = normalizeText(message, "");
      inlineStatusSpinnerElement.hidden = type !== "loading";
      inlineStatusElement.classList.remove(
        "route-panel__status--error",
        "route-panel__status--success",
        "route-panel__status--loading"
      );

      if (type === "error") {
        inlineStatusElement.classList.add("route-panel__status--error");
      } else if (type === "success") {
        inlineStatusElement.classList.add("route-panel__status--success");
      } else if (type === "loading") {
        inlineStatusElement.classList.add("route-panel__status--loading");
      }
    }

    function setMetrics(value) {
      const mode = normalizeMode(value.mode);
      const duration = formatDuration(value.durationSeconds);
      const distanceLabel = formatDistance(value.distanceMeters);
      const modeLabel = formatMode(mode);
      const providerLabel = normalizeText(value.provider, "—");
      distanceValueElement.textContent = distanceLabel;
      durationValueElement.textContent = duration === "—"
        ? "—"
        : `${duration} (${modeLabel.toLowerCase()})`;
      typeValueElement.textContent = modeLabel;
      providerValueElement.textContent = providerLabel;

      if (typeof onMetricsChange === "function") {
        onMetricsChange({
          distanceMeters: Number(value.distanceMeters),
          durationSeconds: Number(value.durationSeconds),
          distanceLabel,
          durationLabel: duration,
          mode,
          modeLabel,
          provider: providerLabel
        });
      }
    }

    function normalizeMode(value) {
      const mode = normalizeText(value, Config.ROUTE_MODE_DEFAULT).toLowerCase();
      if (mode === "walk" || mode === "car" || mode === "flight") {
        return mode;
      }
      return Config.ROUTE_MODE_DEFAULT;
    }

    function formatMode(value) {
      const mode = normalizeMode(value);
      return MODE_LABELS[mode] || MODE_LABELS.car;
    }

    function clearOrderDnD() {
      dragSourceIndex = -1;
      for (const row of orderListElement.querySelectorAll(".route-panel__order-item")) {
        row.classList.remove("is-dragging", "is-drop-target");
      }
    }

    function parseCoordinate(rawValue, min, max) {
      if (typeof rawValue !== "string" && typeof rawValue !== "number") {
        return null;
      }

      const normalized = String(rawValue).trim().replace(",", ".");
      if (normalized === "") {
        return null;
      }

      const numeric = Number(normalized);
      if (!Number.isFinite(numeric) || numeric < min || numeric > max) {
        return null;
      }

      return numeric;
    }

    async function requestRoute(points, mode) {
      let backendError = null;

      try {
        return await requestRouteViaBackend(points, mode);
      } catch (error) {
        backendError = error;
      }

      try {
        return await requestRouteViaPublicProviders(points, mode);
      } catch (publicError) {
        const backendMessage = normalizeText(backendError?.message, "");
        const publicMessage = normalizeText(publicError?.message, "");
        const combined = [backendMessage, publicMessage].filter(Boolean).join(" | ");
        throw new Error(combined || "Route service unavailable.");
      }
    }

    async function requestRouteViaBackend(points, mode) {
      const protocol = normalizeText(window.location.protocol, "").toLowerCase();
      if (protocol !== "http:" && protocol !== "https:") {
        throw new Error("Backend route API requires http/https origin.");
      }

      const url = new URL(Config.ROUTE_API_BASE, window.location.origin);
      url.searchParams.set("mode", mode);
      url.searchParams.set(
        "points",
        points.map((point) => `${round(point.lat, 6)},${round(point.lon, 6)}`).join(";")
      );

      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), Config.ROUTE_TIMEOUT_MS);

      try {
        const response = await fetch(url.toString(), {
          method: "GET",
          headers: { Accept: "application/json" },
          signal: controller.signal
        });

        const payload = await parseJsonResponse(response);
        if (!response.ok) {
          const message = normalizeText(payload?.error, `Route request failed: ${response.status}`);
          const details = Array.isArray(payload?.details) ? payload.details.join("; ") : "";
          throw new Error(details ? `${message}: ${details}` : message);
        }

        if (!payload || typeof payload !== "object") {
          throw new Error("Backend route API returned empty payload.");
        }

        return payload;
      } finally {
        window.clearTimeout(timeoutId);
      }
    }

    async function requestRouteViaPublicProviders(points, mode) {
      const normalizedMode = normalizeMode(mode);
      if (normalizedMode === "flight") {
        const segments = pointsToDirectSegments(points, "flight", "Great-circle model (client)");
        return {
          mode: "flight",
          points: points.map((point) => ({
            lat: point.lat,
            lon: point.lon,
            label: point.label,
            source: point.source
          })),
          segments,
          distanceMeters: sumDistance(segments),
          durationSeconds: sumDuration(segments),
          provider: "Great-circle model (client)",
          isFallback: false
        };
      }

      const providers = getPublicProvidersForMode(normalizedMode);
      if (providers.length === 0) {
        throw new Error("No public providers configured for selected route mode.");
      }

      const segments = [];
      const providerErrors = [];

      for (let index = 0; index < points.length - 1; index += 1) {
        const fromPoint = points[index];
        const toPoint = points[index + 1];

        const segment = await requestPublicSegmentWithFallback({
          mode: normalizedMode,
          fromPoint,
          toPoint,
          providers,
          providerErrors
        });
        segments.push({
          index,
          fromPoint,
          toPoint,
          coordinates: segment.coordinates,
          distanceMeters: segment.distanceMeters,
          durationSeconds: estimateDuration(segment.distanceMeters, normalizedMode),
          provider: segment.provider,
          isFallback: false
        });
      }

      if (segments.length === 0) {
        throw new Error(
          providerErrors.length > 0
            ? providerErrors.join("; ")
            : "Public providers returned no route segments."
        );
      }

      return {
        mode: normalizedMode,
        points: points.map((point) => ({
          lat: point.lat,
          lon: point.lon,
          label: point.label,
          source: point.source
        })),
        segments,
        distanceMeters: sumDistance(segments),
        durationSeconds: sumDuration(segments),
        provider: resolveProviderLabel(segments),
        isFallback: false,
        providerErrors: providerErrors.length > 0 ? providerErrors : undefined
      };
    }

    function getPublicProvidersForMode(mode) {
      if (mode === "walk") {
        return [
          {
            name: "OSM DE Foot (direct)",
            baseUrl: "https://routing.openstreetmap.de/routed-foot/route/v1/driving"
          },
          {
            name: "OSM DE Car (direct)",
            baseUrl: "https://routing.openstreetmap.de/routed-car/route/v1/driving"
          }
        ];
      }

      return [
        {
          name: "OSRM Project (direct)",
          baseUrl: "https://router.project-osrm.org/route/v1/driving"
        },
        {
          name: "OSM DE Car (direct)",
          baseUrl: "https://routing.openstreetmap.de/routed-car/route/v1/driving"
        }
      ];
    }

    async function requestPublicSegmentWithFallback(params) {
      const {
        mode,
        fromPoint,
        toPoint,
        providers,
        providerErrors
      } = params;

      for (const provider of providers) {
        try {
          return await fetchPublicProviderSegment(provider, fromPoint, toPoint, mode);
        } catch (error) {
          providerErrors.push(`${provider.name}: ${normalizeText(error?.message, "request failed")}`);
        }
      }

      throw new Error(
        providerErrors.length > 0
          ? providerErrors.join("; ")
          : "No available public route provider."
      );
    }

    async function fetchPublicProviderSegment(provider, fromPoint, toPoint, mode) {
      const url = buildPublicProviderRouteUrl(provider.baseUrl, fromPoint, toPoint);
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), Config.ROUTE_TIMEOUT_MS);

      try {
        const response = await fetch(url, {
          method: "GET",
          headers: { Accept: "application/json" },
          signal: controller.signal
        });

        const payload = await parseJsonResponse(response);
        if (!response.ok) {
          const providerMessage = normalizeText(
            payload?.message || payload?.error || payload?.code,
            `Provider request failed: ${response.status}`
          );
          throw new Error(providerMessage);
        }

        const route = payload?.routes?.[0];
        const coordinates = route?.geometry?.coordinates;
        if (!route || !Array.isArray(coordinates) || coordinates.length < 2) {
          throw new Error("Provider returned invalid route geometry.");
        }

        const distanceMetersRaw = Number(route?.distance);
        const directDistance = haversineDistanceMeters(
          fromPoint.lat,
          fromPoint.lon,
          toPoint.lat,
          toPoint.lon
        );

        return {
          coordinates,
          distanceMeters: Number.isFinite(distanceMetersRaw) && distanceMetersRaw > 0
            ? distanceMetersRaw
            : directDistance,
          durationSeconds: estimateDuration(
            Number.isFinite(distanceMetersRaw) && distanceMetersRaw > 0
              ? distanceMetersRaw
              : directDistance,
            mode
          ),
          provider: provider.name
        };
      } finally {
        window.clearTimeout(timeoutId);
      }
    }

    function buildPublicProviderRouteUrl(baseUrl, fromPoint, toPoint) {
      const pointA = `${round(fromPoint.lon, 6)},${round(fromPoint.lat, 6)}`;
      const pointB = `${round(toPoint.lon, 6)},${round(toPoint.lat, 6)}`;
      const url = new URL(`${baseUrl}/${pointA};${pointB}`);
      url.searchParams.set("overview", "simplified");
      url.searchParams.set("geometries", "geojson");
      url.searchParams.set("alternatives", "false");
      url.searchParams.set("steps", "false");
      return url.toString();
    }

    function resolveProviderLabel(segments) {
      const labels = new Set();
      for (const segment of segments) {
        const provider = normalizeText(segment?.provider, "");
        if (provider) {
          labels.add(provider);
        }
      }
      if (labels.size === 0) {
        return "Route API";
      }
      return Array.from(labels).join(" + ");
    }

    function sumDistance(segments) {
      return segments.reduce((total, segment) => total + Number(segment?.distanceMeters || 0), 0);
    }

    function sumDuration(segments) {
      return segments.reduce((total, segment) => total + Number(segment?.durationSeconds || 0), 0);
    }

    function pointsToDirectSegments(points, mode, providerName) {
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
          fromPoint,
          toPoint,
          coordinates: buildDirectSegment(fromPoint, toPoint),
          distanceMeters,
          durationSeconds: estimateDuration(distanceMeters, mode),
          provider: providerName,
          isFallback: false
        });
      }
      return segments;
    }

    function normalizeRoutePayload(payload, points, mode) {
      const normalizedMode = normalizeMode(payload?.mode || mode);
      const rawSegments = Array.isArray(payload?.segments) ? payload.segments : [];
      const fallbackCoordinates = Array.isArray(payload?.coordinates) ? payload.coordinates : null;
      const segments = [];
      let totalDistance = 0;
      let totalDuration = 0;

      for (let index = 0; index < points.length - 1; index += 1) {
        const fromPoint = points[index];
        const toPoint = points[index + 1];
        const rawSegment = rawSegments[index];

        const coordinates = Array.isArray(rawSegment?.coordinates)
          ? rawSegment.coordinates
          : (
              points.length === 2 && Array.isArray(fallbackCoordinates)
                ? fallbackCoordinates
                : [
                    [fromPoint.lon, fromPoint.lat],
                    [toPoint.lon, toPoint.lat]
                  ]
            );

        const directDistance = haversineDistanceMeters(
          fromPoint.lat,
          fromPoint.lon,
          toPoint.lat,
          toPoint.lon
        );

        const distanceMetersRaw = Number(rawSegment?.distanceMeters);
        const distanceMeters = Number.isFinite(distanceMetersRaw) && distanceMetersRaw > 0
          ? distanceMetersRaw
          : directDistance;
        const durationSeconds = estimateDuration(distanceMeters, normalizedMode);

        segments.push({
          index,
          fromPoint,
          toPoint,
          coordinates,
          distanceMeters,
          durationSeconds,
          provider: normalizeText(rawSegment?.provider, normalizeText(payload?.provider, "Route API")),
          isFallback: rawSegment?.isFallback === true
        });

        totalDistance += distanceMeters;
        totalDuration += durationSeconds;
      }

      return {
        mode: normalizedMode,
        points: points.map((point) => ({
          lat: point.lat,
          lon: point.lon,
          label: point.label,
          source: point.source
        })),
        segments,
        distanceMeters: totalDistance,
        durationSeconds: totalDuration,
        provider: normalizeText(payload?.provider, "Route API"),
        isFallback: payload?.isFallback === true || segments.some((segment) => segment.isFallback)
      };
    }

    function localFallbackRoute(points, mode) {
      const segments = [];
      let totalDistance = 0;
      let totalDuration = 0;

      for (let index = 0; index < points.length - 1; index += 1) {
        const fromPoint = points[index];
        const toPoint = points[index + 1];
        const distanceMeters = haversineDistanceMeters(
          fromPoint.lat,
          fromPoint.lon,
          toPoint.lat,
          toPoint.lon
        );
        const durationSeconds = estimateDuration(distanceMeters, mode);

        segments.push({
          index,
          fromPoint,
          toPoint,
          coordinates: buildDirectSegment(fromPoint, toPoint),
          distanceMeters,
          durationSeconds,
          provider: "Локальная модель",
          isFallback: true
        });

        totalDistance += distanceMeters;
        totalDuration += durationSeconds;
      }

      return {
        mode,
        points: points.map((point) => ({
          lat: point.lat,
          lon: point.lon,
          label: point.label,
          source: point.source
        })),
        segments,
        distanceMeters: totalDistance,
        durationSeconds: totalDuration,
        provider: "Локальная модель",
        isFallback: true
      };
    }

    function buildDirectSegment(fromPoint, toPoint) {
      const distanceMeters = haversineDistanceMeters(
        fromPoint.lat,
        fromPoint.lon,
        toPoint.lat,
        toPoint.lon
      );
      const steps = clamp(Math.round(distanceMeters / 28000), 8, 56);
      const lonDelta = shortestLonDelta(fromPoint.lon, toPoint.lon);
      const coordinates = [];

      for (let step = 0; step <= steps; step += 1) {
        const ratio = step / steps;
        const lat = fromPoint.lat + ((toPoint.lat - fromPoint.lat) * ratio);
        const lon = normalizeLon(fromPoint.lon + (lonDelta * ratio));
        coordinates.push([round(lon, 6), round(lat, 6)]);
      }

      return coordinates;
    }

    function shortestLonDelta(fromLon, toLon) {
      let delta = Number(toLon) - Number(fromLon);
      while (delta > 180) {
        delta -= 360;
      }
      while (delta < -180) {
        delta += 360;
      }
      return delta;
    }

    function normalizeLon(value) {
      let lon = Number(value);
      while (lon > 180) {
        lon -= 360;
      }
      while (lon < -180) {
        lon += 360;
      }
      return lon;
    }

    function estimateDuration(distanceMeters, mode) {
      const distanceKm = Number(distanceMeters) / 1000;
      if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
        return 0;
      }

      if (mode === "walk") {
        return (distanceKm / Config.ROUTE_WALK_SPEED_KMPH) * 3600;
      }

      if (mode === "flight") {
        const flightSeconds = (distanceKm / Config.ROUTE_FLIGHT_SPEED_KMPH) * 3600;
        return flightSeconds + (Config.ROUTE_FLIGHT_OVERHEAD_MINUTES * 60);
      }

      return (distanceKm / Config.ROUTE_CAR_SPEED_KMPH) * 3600;
    }

    function destroy() {
      pendingRequestToken += 1;
      geolocationRequestToken += 1;
      isResolvingMyLocation = false;
      routeOrigin = null;
      routeDestination = null;
      setActivePickTarget("");
      mapEngine.cancelCoordinatePick("destroy");
      setMyLocationLoadingState(false);

      for (const endpoint of endpoints.values()) {
        while (endpoint.disposeFns.length > 0) {
          const disposeFn = endpoint.disposeFns.pop();
          try {
            disposeFn();
          } catch (error) {
            console.error("Route endpoint cleanup error:", error);
          }
        }

        if (!endpoint.fixed) {
          endpoint.groupEl.remove();
        }
      }
      endpoints.clear();

      while (cleanupFns.length > 0) {
        const cleanupFn = cleanupFns.pop();
        try {
          cleanupFn();
        } catch (error) {
          console.error("Route controller cleanup error:", error);
        }
      }
    }
  }

  function loadPopupApiFactory() {
    const existingFactory = window.WorldAtlasPopup?.createPlacePopupApi;
    if (typeof existingFactory === "function") {
      return Promise.resolve(existingFactory);
    }

    if (loadPopupApiFactory.pendingPromise) {
      return loadPopupApiFactory.pendingPromise;
    }

    loadPopupApiFactory.pendingPromise = new Promise((resolve, reject) => {
      const scriptEl = document.createElement("script");
      scriptEl.src = "./popup.js?v=20260416d";
      scriptEl.defer = true;
      scriptEl.async = false;
      scriptEl.dataset.worldAtlasPopup = "true";
      scriptEl.onload = () => {
        const popupFactory = window.WorldAtlasPopup?.createPlacePopupApi;
        if (typeof popupFactory !== "function") {
          reject(new Error("Popup API factory is unavailable."));
          return;
        }
        resolve(popupFactory);
      };
      scriptEl.onerror = () => {
        reject(new Error("Popup module failed to load."));
      };
      document.head.append(scriptEl);
    }).catch((error) => {
      loadPopupApiFactory.pendingPromise = null;
      throw error;
    });

    return loadPopupApiFactory.pendingPromise;
  }
  function createUrlState() {
    return {
      read,
      write
    };

    function read() {
      const params = new URLSearchParams(window.location.search);

      const searchQuery = normalizeText(params.get("q"), "");
      const regionFilter = normalizeText(params.get("region"), "all");
      const selectedPlaceId = normalizeText(params.get("place"), "");

      const lat = parseFloatValue(params.get("lat"), -90, 90);
      const lng = parseFloatValue(params.get("lng"), -180, 180);
      const zoom = parseFloatValue(params.get("z"), Config.MIN_ZOOM, Config.MAX_ZOOM);

      const hasView = lat !== null && lng !== null && zoom !== null;

      return {
        searchQuery,
        regionFilter: regionFilter || "all",
        selectedPlaceId: selectedPlaceId || null,
        mapView: hasView ? { lat, lng, zoom } : null
      };
    }

    function write(nextState) {
      const params = new URLSearchParams();

      if (nextState.searchQuery) {
        params.set("q", nextState.searchQuery);
      }

      if (nextState.regionFilter && nextState.regionFilter !== "all") {
        params.set("region", nextState.regionFilter);
      }

      if (nextState.selectedPlaceId) {
        params.set("place", nextState.selectedPlaceId);
      }

      const view = normalizeView(nextState.mapView, Config.DEFAULT_VIEW);
      params.set("lat", String(round(view.lat, 5)));
      params.set("lng", String(round(view.lng, 5)));
      params.set("z", String(round(view.zoom, 2)));

      const query = params.toString();
      const nextUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;

      window.history.replaceState(null, "", nextUrl);
    }
  }

  function normalizeRegionsMeta(metaItems, places) {
    if (Array.isArray(metaItems) && metaItems.length > 0) {
      const normalizedMeta = metaItems
        .map((item) => {
          if (!item || typeof item !== "object") {
            return null;
          }

          const regionLabel = normalizeText(item.region, "");
          const count = Number(item.count);

          if (!regionLabel || !Number.isFinite(count) || count <= 0) {
            return null;
          }

          return {
            value: regionLabel,
            label: regionLabel,
            count
          };
        })
        .filter(Boolean)
        .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, "ru"));

      if (normalizedMeta.length > 0) {
        return normalizedMeta;
      }
    }

    return deriveRegionsMeta(places);
  }

  async function loadLocalSeedPlaces() {
    if (Array.isArray(Runtime.localSeedPlacesCache)) {
      return Runtime.localSeedPlacesCache;
    }

    if (Runtime.localSeedPlacesPromise) {
      return Runtime.localSeedPlacesPromise;
    }

    Runtime.localSeedPlacesPromise = loadLocalSeedPlacesFromStaticFiles()
      .then((placesFromFiles) => {
        const normalized = Array.isArray(placesFromFiles)
          ? placesFromFiles.filter(isValidPlace)
          : [];
        Runtime.localSeedPlacesCache = normalized;
        return normalized;
      })
      .catch((error) => {
        if (!Runtime.localSeedLoadWarned) {
          Runtime.localSeedLoadWarned = true;
          console.info("Seed places were not loaded from static JSON. Continue without seed.", error);
        }
        Runtime.localSeedPlacesCache = [];
        return [];
      })
      .finally(() => {
        Runtime.localSeedPlacesPromise = null;
      });

    return Runtime.localSeedPlacesPromise;
  }

  async function loadLocalSeedPlacesFromStaticFiles() {
    const requiredFallbackPaths = [
      "/places.json",
      "./places.json"
    ];
    const configuredCandidates = Array.isArray(Config.LOCAL_SEED_SOURCE_PATHS)
      ? Config.LOCAL_SEED_SOURCE_PATHS
      : [];
    const uniqueCandidates = Array.from(
      new Set(
        [...requiredFallbackPaths, ...configuredCandidates]
          .map((candidate) => normalizeText(candidate, ""))
          .filter(Boolean)
      )
    );

    for (const sourcePath of uniqueCandidates) {
      try {
        const response = await fetch(sourcePath, {
          method: "GET",
          headers: {
            Accept: "application/json"
          },
          cache: "no-store"
        });

        if (!response.ok) {
          continue;
        }

        const payload = await parseJsonResponse(response);
        if (!Array.isArray(payload)) {
          continue;
        }

        const normalizedPlaces = payload
          .map((row, index) => normalizeLocalSeedPlace(row, index))
          .filter(Boolean)
          .filter(isValidPlace);

        if (normalizedPlaces.length > 0) {
          return normalizedPlaces;
        }
      } catch {
        continue;
      }
    }

    if (!Runtime.localSeedLoadWarned) {
      Runtime.localSeedLoadWarned = true;
      console.info("Seed places JSON is unavailable for all fallback paths.");
    }
    return [];
  }

  function normalizeLocalSeedPlace(rawPlace, index) {
    if (!rawPlace || typeof rawPlace !== "object") {
      return null;
    }

    const lat = Number(rawPlace.lat);
    const lon = Number(rawPlace.lon ?? rawPlace.lng);
    const name = normalizeText(rawPlace.name ?? rawPlace.title, "");
    const description = normalizeText(rawPlace.description, "");
    const idSource = normalizeText(rawPlace.id, "");
    const fallbackId = name
      ? `${name.toLowerCase().replace(/[^a-z0-9а-яё']+/gi, "-").replace(/^-+|-+$/g, "")}-${index + 1}`
      : `seed-${index + 1}`;
    const id = idSource || fallbackId;

    if (!id || !name || !description) {
      return null;
    }
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      return null;
    }
    if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
      return null;
    }

    const image = normalizeMediaUrl(rawPlace.image ?? rawPlace.image_url) || "";
    const link = normalizeHttpUrl(rawPlace.link) || "";
    const tags = Array.isArray(rawPlace.tags)
      ? rawPlace.tags.map((entry) => normalizeText(entry, "")).filter(Boolean)
      : [];
    const hasPendingReviewTag = tags.some(
      (entry) => normalizeText(entry, "").toLowerCase() === "pending-review"
    );
    const rawIsPublic = rawPlace.is_public ?? rawPlace.isPublic;
    const hasExplicitPublicFlag = rawIsPublic !== undefined && rawIsPublic !== null && rawIsPublic !== "";
    const isPublic = hasExplicitPublicFlag
      ? resolvePlaceBooleanFlag(rawPlace, ["is_public", "isPublic", "public"])
      : true;
    const visibilityStatus = isPublic
      ? "approved"
      : (hasPendingReviewTag ? "pending" : "private");
    const highlights = Array.isArray(rawPlace.highlights)
      ? rawPlace.highlights.map((entry) => normalizeText(entry, "")).filter(Boolean)
      : tags.slice(0, 6);
    const seasonalContent = normalizeSeasonalContentValue(
      rawPlace.seasonal_content ?? rawPlace.seasonalContent
    );

    return enrichPlaceWithSeedDetails({
      ...rawPlace,
      id,
      name,
      title: name,
      description,
      lat,
      lon,
      lng: lon,
      region: normalizeText(rawPlace.region, "Регион не указан"),
      country: normalizeText(rawPlace.country, ""),
      image,
      image_url: image,
      link,
      tags,
      highlights,
      isFree: resolvePlaceBooleanFlag(rawPlace, ["isFree", "is_free", "free", "onlyFree"]),
      familyFriendly: resolvePlaceBooleanFlag(rawPlace, ["familyFriendly", "family_friendly", "family"]),
      is_public: isPublic,
      visibility_status: visibilityStatus,
      seasonal_content: seasonalContent
    });
  }

  function mergePlacesWithSeed(primaryPlaces, seedPlaces) {
    const merged = [
      ...(Array.isArray(primaryPlaces) ? primaryPlaces : []),
      ...(Array.isArray(seedPlaces) ? seedPlaces : [])
    ];
    return dedupePlaces(merged);
  }

  function dedupePlaces(places) {
    const unique = [];
    const seenKeys = new Set();

    for (const place of Array.isArray(places) ? places : []) {
      if (!isValidPlace(place)) {
        continue;
      }

      const dedupeKeys = buildPlaceDedupeKeys(place);
      const isDuplicate = dedupeKeys.some((key) => seenKeys.has(key));
      if (isDuplicate) {
        continue;
      }

      unique.push(place);
      for (const key of dedupeKeys) {
        seenKeys.add(key);
      }
    }

    return unique;
  }

  function buildPlaceDedupeKeys(place) {
    const keys = [];

    const idKey = normalizeText(place?.id, "").toLowerCase();
    if (idKey) {
      keys.push(`id:${idKey}`);
    }

    const slugKey = normalizeText(place?.slug, "").toLowerCase();
    if (slugKey) {
      keys.push(`slug:${slugKey}`);
    }

    const nameKey = normalizePlaceLookupKey(place?.name ?? place?.title);
    const lat = Number(place?.lat);
    const lon = Number(place?.lon ?? place?.lng);
    if (nameKey && Number.isFinite(lat) && Number.isFinite(lon)) {
      const latKey = round(lat, 3).toFixed(3);
      const lonKey = round(lon, 3).toFixed(3);
      keys.push(`name-geo:${nameKey}:${latKey}:${lonKey}`);
    }

    if (keys.length > 0) {
      return keys;
    }

    const fallbackNameKey = normalizePlaceLookupKey(place?.name ?? place?.title);
    return fallbackNameKey ? [`name:${fallbackNameKey}`] : [];
  }

  function deriveRegionsMeta(places) {
    const counters = new Map();

    for (const place of places) {
      const region = normalizeText(place.region, "Регион не указан");
      counters.set(region, (counters.get(region) || 0) + 1);
    }

    return Array.from(counters.entries())
      .map(([label, count]) => ({ value: label, label, count }))
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, "ru"));
  }

  function deriveCategoryOptions(places) {
    const counters = new Map();
    for (const place of Array.isArray(places) ? places : []) {
      const categoryValue = normalizePlaceCategoryValue(place);
      if (!categoryValue || categoryValue === "all") {
        continue;
      }
      counters.set(categoryValue, (counters.get(categoryValue) || 0) + 1);
    }

    return Array.from(counters.entries())
      .map(([value, count]) => ({
        value,
        label: formatCategoryLabel(value),
        count
      }))
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, "ru"));
  }

  function normalizeSmartFiltersState(rawState) {
    const source = rawState && typeof rawState === "object" ? rawState : {};
    return {
      category: normalizeSmartCategoryValue(source.category),
      tags: normalizeSmartTags(source.tags),
      onlyFree: Boolean(source.onlyFree),
      familyFriendly: Boolean(source.familyFriendly),
      sortBy: normalizeSmartSortValue(source.sortBy)
    };
  }

  function normalizeSmartCategoryValue(rawValue) {
    const normalized = normalizeText(rawValue, "all")
      .toLowerCase()
      .replace(/[\s_]+/g, "-");

    if (!normalized || normalized === "all") {
      return "all";
    }

    if (normalized.includes("город") || normalized === "city") {
      return "city";
    }
    if (normalized.includes("природ") || normalized === "nature") {
      return "nature";
    }
    if (normalized.includes("культур") || normalized === "culture") {
      return "culture";
    }

    return normalized;
  }

  function normalizeSmartSortValue(rawValue) {
    const normalized = normalizeText(rawValue, "name-asc").toLowerCase();
    const allowed = new Set([
      "name-asc",
      "name-desc",
      "updated-desc",
      "population-desc",
      "region-asc"
    ]);
    return allowed.has(normalized) ? normalized : "name-asc";
  }

  function normalizeSmartTagValue(rawValue) {
    return normalizeText(rawValue, "")
      .toLowerCase()
      .replace(/[,\s]+/g, " ")
      .trim();
  }

  function normalizeSmartTags(rawTags) {
    const source = Array.isArray(rawTags)
      ? rawTags
      : (typeof rawTags === "string" ? rawTags.split(/[,\n;]+/g) : []);
    const unique = [];

    for (const entry of source) {
      const normalized = normalizeSmartTagValue(entry);
      if (!normalized) {
        continue;
      }
      if (!unique.includes(normalized)) {
        unique.push(normalized);
      }
      if (unique.length >= 12) {
        break;
      }
    }

    return unique;
  }

  function normalizePlaceCategoryValue(place) {
    const rawCategory = normalizeText(place?.category ?? place?.kind, "");
    if (!rawCategory) {
      return normalizeSmartCategoryValue(resolvePlaceCategory(place).key);
    }
    return normalizeSmartCategoryValue(rawCategory);
  }

  function formatCategoryLabel(value) {
    const normalized = normalizeSmartCategoryValue(value);
    if (normalized === "city") {
      return "Город";
    }
    if (normalized === "nature") {
      return "Природа";
    }
    if (normalized === "culture") {
      return "Культура";
    }
    if (!normalized || normalized === "all") {
      return "Все";
    }
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }

  function getPlaceTagsSet(place) {
    const tags = new Set();
    const addTokens = (value) => {
      const normalized = normalizeSmartTagValue(value);
      if (!normalized) {
        return;
      }
      tags.add(normalized);

      const parts = normalized.split(" ");
      for (const token of parts) {
        if (token.length >= 3) {
          tags.add(token);
        }
      }
    };

    if (Array.isArray(place?.tags)) {
      for (const tag of place.tags) {
        addTokens(tag);
      }
    }
    if (Array.isArray(place?.highlights)) {
      for (const highlight of place.highlights) {
        addTokens(highlight);
      }
    }
    addTokens(place?.category);
    addTokens(place?.kind);
    addTokens(place?.region);
    addTokens(place?.country);

    return tags;
  }

  function resolvePlaceScope(place) {
    const rawScope = normalizeText(
      place?.place_scope ?? place?.scope ?? place?.source_scope,
      "public"
    ).toLowerCase();
    return rawScope === "my" || rawScope === "user" || rawScope === "personal"
      ? "my"
      : "public";
  }

  function formatPlaceScopeLabel(place) {
    return resolvePlaceScope(place) === "my" ? "MY" : "PUBLIC";
  }

  function resolvePlaceBooleanFlag(place, fieldNames) {
    const source = place && typeof place === "object" ? place : {};
    const keys = Array.isArray(fieldNames) ? fieldNames : [];

    for (const key of keys) {
      if (!Object.prototype.hasOwnProperty.call(source, key)) {
        continue;
      }
      const value = source[key];
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
    }

    const tags = getPlaceTagsSet(place);
    for (const key of keys) {
      const normalizedKey = normalizeSmartTagValue(key);
      if (normalizedKey && tags.has(normalizedKey)) {
        return true;
      }
    }

    return false;
  }

  function sortPlaces(places, sortBy) {
    const sorted = Array.isArray(places) ? [...places] : [];
    const normalizedSortBy = normalizeSmartSortValue(sortBy);

    if (normalizedSortBy === "name-desc") {
      sorted.sort((left, right) =>
        normalizeText(right.name, "").localeCompare(normalizeText(left.name, ""), "ru")
      );
      return sorted;
    }

    if (normalizedSortBy === "updated-desc") {
      sorted.sort((left, right) => {
        const leftTime = Date.parse(normalizeText(left.updatedAt ?? left.createdAt, ""));
        const rightTime = Date.parse(normalizeText(right.updatedAt ?? right.createdAt, ""));
        const safeLeft = Number.isFinite(leftTime) ? leftTime : 0;
        const safeRight = Number.isFinite(rightTime) ? rightTime : 0;
        if (safeRight !== safeLeft) {
          return safeRight - safeLeft;
        }
        return normalizeText(left.name, "").localeCompare(normalizeText(right.name, ""), "ru");
      });
      return sorted;
    }

    if (normalizedSortBy === "population-desc") {
      sorted.sort((left, right) => {
        const leftPopulation = Number(left.population);
        const rightPopulation = Number(right.population);
        const safeLeft = Number.isFinite(leftPopulation) ? leftPopulation : -1;
        const safeRight = Number.isFinite(rightPopulation) ? rightPopulation : -1;
        if (safeRight !== safeLeft) {
          return safeRight - safeLeft;
        }
        return normalizeText(left.name, "").localeCompare(normalizeText(right.name, ""), "ru");
      });
      return sorted;
    }

    if (normalizedSortBy === "region-asc") {
      sorted.sort((left, right) => {
        const regionCompare = normalizeText(left.region, "")
          .localeCompare(normalizeText(right.region, ""), "ru");
        if (regionCompare !== 0) {
          return regionCompare;
        }
        return normalizeText(left.name, "").localeCompare(normalizeText(right.name, ""), "ru");
      });
      return sorted;
    }

    sorted.sort((left, right) =>
      normalizeText(left.name, "").localeCompare(normalizeText(right.name, ""), "ru")
    );
    return sorted;
  }

  function filterPlaces(places, query, regionFilter, options = {}) {
    const {
      favoritesOnly = false,
      favoritePlaceIds = new Set(),
      categoryFilter = "all",
      tagsFilter = [],
      onlyFree = false,
      familyFriendly = false,
      sortBy = "name-asc"
    } = options;

    const normalizedQuery = normalizeText(query, "").toLowerCase();
    const normalizedRegion = normalizeText(regionFilter, "all").toLowerCase();
    const normalizedCategory = normalizeSmartCategoryValue(categoryFilter);
    const normalizedTags = normalizeSmartTags(tagsFilter);
    const normalizedSortBy = normalizeSmartSortValue(sortBy);

    const filteredPlaces = places.filter((place) => {
      if (favoritesOnly && !favoritePlaceIds.has(place.id)) {
        return false;
      }

      const regionLabel = normalizeText(place.region, "");

      const regionMatch =
        normalizedRegion === "all" ||
        regionLabel.toLowerCase() === normalizedRegion;

      if (!regionMatch) {
        return false;
      }

      const placeCategory = normalizePlaceCategoryValue(place);
      const categoryMatch = normalizedCategory === "all" || placeCategory === normalizedCategory;
      if (!categoryMatch) {
        return false;
      }

      const placeTagsSet = getPlaceTagsSet(place);
      for (const requiredTag of normalizedTags) {
        if (!placeTagsSet.has(requiredTag)) {
          return false;
        }
      }

      if (onlyFree && !resolvePlaceBooleanFlag(place, ["isFree", "is_free", "free", "onlyFree"])) {
        return false;
      }
      if (familyFriendly && !resolvePlaceBooleanFlag(place, ["familyFriendly", "family_friendly", "family"])) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const haystack = [
        normalizeText(place.name, ""),
        regionLabel,
        normalizeText(place.description, ""),
        normalizeText(place.country, ""),
        normalizeText(place.countryCode, ""),
        normalizeText(place.timezone, ""),
        normalizeText(place.utcOffset, ""),
        normalizeText(place.utc_offset, ""),
        normalizeText(place.climate, ""),
        normalizeText(place.currency, ""),
        Array.isArray(place.languages) ? place.languages.join(" ") : normalizeText(place.languages, ""),
        Number.isFinite(Number(place.areaKm2 ?? place.area_km2))
          ? String(place.areaKm2 ?? place.area_km2)
          : "",
        normalizeText(place.founded, ""),
        normalizeText(place.funFact, ""),
        Number.isFinite(Number(place.population)) ? String(place.population) : "",
        Array.isArray(place.tags) ? place.tags.join(" ") : "",
        Array.isArray(place.highlights) ? place.highlights.join(" ") : ""
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });

    return sortPlaces(filteredPlaces, normalizedSortBy);
  }

  function normalizePlaceFacts(place) {
    const source = place && typeof place === "object" ? place : {};
    const unknownText = "Unknown";

    const populationRaw = pickFirstPresentField(source, ["population", "pop"]);
    const areaRaw = pickFirstPresentField(source, ["area", "area_km2", "areaKm2"]);
    const currencyRaw = pickFirstPresentField(source, ["currency", "currencies"]);
    const languageRaw = pickFirstPresentField(source, ["language", "languages"]);
    const utcRaw = pickFirstPresentField(source, ["utc", "timezone", "utc_offset", "utcOffset", "tz"]);
    const categoryRaw = pickFirstPresentField(source, ["category", "kind", "type", "place_category", "placeType", "place_type"]);

    const populationNumber = parsePositiveFactNumber(populationRaw);
    const areaNumber = parsePositiveFactNumber(areaRaw);

    const populationText = populationNumber === null
      ? unknownText
      : new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(populationNumber));
    const areaText = areaNumber === null
      ? unknownText
      : `${new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: areaNumber >= 1000 ? 0 : (areaNumber >= 100 ? 1 : 2)
      }).format(areaNumber)} km²`;

    const currencyText = normalizeCurrencyFactValue(currencyRaw, unknownText);
    const languageText = normalizeLanguageFactValue(languageRaw, unknownText);
    const utcText = normalizeUtcFactValue(utcRaw, unknownText);

    const categoryToken = normalizeText(
      dedupeFactTokens(
        extractFactTokens(categoryRaw, ["value", "label", "name", "title", "category", "kind", "type", "code"])
      )[0],
      ""
    );
    let categoryText = unknownText;
    if (categoryToken) {
      const normalizedCategory = normalizeSmartCategoryValue(categoryToken);
      categoryText = normalizedCategory && normalizedCategory !== "all"
        ? formatCategoryLabel(normalizedCategory)
        : categoryToken;
    }

    const missingFields = [];
    if (populationText === unknownText) {
      missingFields.push("population|pop");
    }
    if (areaText === unknownText) {
      missingFields.push("area|area_km2|areaKm2");
    }
    if (currencyText === unknownText) {
      missingFields.push("currency|currencies");
    }
    if (languageText === unknownText) {
      missingFields.push("language|languages");
    }
    if (utcText === unknownText) {
      missingFields.push("utc|timezone|utc_offset");
    }
    if (categoryText === unknownText) {
      missingFields.push("category|kind|type");
    }
    logMissingPlaceFactsSchemaOnce(source, missingFields);

    return {
      populationText,
      areaText,
      currencyText,
      languageText,
      utcText,
      categoryText
    };
  }

  function logMissingPlaceFactsSchemaOnce(place, missingFields) {
    if (!Array.isArray(missingFields) || missingFields.length === 0) {
      return;
    }

    const safePlace = place && typeof place === "object" ? place : {};
    const placeIdentity = normalizeText(
      safePlace.id ?? safePlace.slug ?? safePlace.name ?? safePlace.title,
      "unknown-place"
    ).toLowerCase();
    const missingKey = [...missingFields].sort().join(",");
    const debugKey = `${placeIdentity}:${missingKey}`;
    if (Runtime.placeFactsSchemaDebugged.has(debugKey)) {
      return;
    }

    Runtime.placeFactsSchemaDebugged.add(debugKey);
    const availableKeys = Object.keys(safePlace).sort();
    console.debug(
      "[facts] Missing place fields. Check schema mapping.",
      { place: placeIdentity, missingFields, availableKeys }
    );
  }

  function pickFirstPresentField(source, keys) {
    if (!source || typeof source !== "object" || !Array.isArray(keys)) {
      return undefined;
    }

    for (const key of keys) {
      if (!Object.prototype.hasOwnProperty.call(source, key)) {
        continue;
      }
      const value = source[key];
      if (value === null || value === undefined) {
        continue;
      }
      if (typeof value === "string" && normalizeText(value, "") === "") {
        continue;
      }
      if (Array.isArray(value) && value.length === 0) {
        continue;
      }
      if (value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0) {
        continue;
      }
      return value;
    }

    return undefined;
  }

  function parsePositiveFactNumber(rawValue) {
    if (Number.isFinite(Number(rawValue)) && Number(rawValue) > 0) {
      return Number(rawValue);
    }

    if (typeof rawValue === "string") {
      return parsePositiveFactNumberFromString(rawValue);
    }

    if (Array.isArray(rawValue)) {
      for (const entry of rawValue) {
        const parsed = parsePositiveFactNumber(entry);
        if (parsed !== null) {
          return parsed;
        }
      }
      return null;
    }

    if (rawValue && typeof rawValue === "object") {
      const keyCandidates = [
        "value",
        "amount",
        "number",
        "total",
        "population",
        "pop",
        "area",
        "area_km2",
        "areaKm2",
        "km2"
      ];
      for (const key of keyCandidates) {
        if (!Object.prototype.hasOwnProperty.call(rawValue, key)) {
          continue;
        }
        const parsed = parsePositiveFactNumber(rawValue[key]);
        if (parsed !== null) {
          return parsed;
        }
      }
      for (const value of Object.values(rawValue)) {
        const parsed = parsePositiveFactNumber(value);
        if (parsed !== null) {
          return parsed;
        }
      }
    }

    return null;
  }

  function parsePositiveFactNumberFromString(rawValue) {
    const source = normalizeText(rawValue, "");
    if (!source) {
      return null;
    }

    const compact = source
      .replace(/\u00a0/g, " ")
      .trim()
      .replace(/\s+/g, "")
      .replace(/[^0-9,.\-]/g, "");
    if (!compact) {
      return null;
    }

    let normalized = compact;
    const hasComma = normalized.includes(",");
    const hasDot = normalized.includes(".");
    if (hasComma && hasDot) {
      normalized = normalized.replace(/,/g, "");
    } else if (hasComma && !hasDot) {
      const commaCount = (normalized.match(/,/g) || []).length;
      if (commaCount > 1) {
        normalized = normalized.replace(/,/g, "");
      } else {
        const [leftPart, rightPart = ""] = normalized.split(",");
        const isThousandsSeparator = rightPart.length === 3 && leftPart.length >= 1;
        normalized = isThousandsSeparator
          ? `${leftPart}${rightPart}`
          : `${leftPart}.${rightPart}`;
      }
    } else if (!hasComma && hasDot) {
      const dotCount = (normalized.match(/\./g) || []).length;
      if (dotCount > 1) {
        normalized = normalized.replace(/\./g, "");
      }
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) && parsed > 0
      ? parsed
      : null;
  }

  function extractFactTokens(rawValue, objectKeys = []) {
    if (rawValue === null || rawValue === undefined) {
      return [];
    }

    if (typeof rawValue === "number") {
      return Number.isFinite(rawValue) ? [String(rawValue)] : [];
    }

    if (typeof rawValue === "string") {
      return splitFactTextTokens(rawValue);
    }

    if (Array.isArray(rawValue)) {
      const combined = [];
      for (const entry of rawValue) {
        combined.push(...extractFactTokens(entry, objectKeys));
      }
      return combined;
    }

    if (rawValue && typeof rawValue === "object") {
      const combined = [];
      for (const key of objectKeys) {
        if (!Object.prototype.hasOwnProperty.call(rawValue, key)) {
          continue;
        }
        combined.push(...extractFactTokens(rawValue[key], objectKeys));
      }

      if (combined.length === 0) {
        for (const value of Object.values(rawValue)) {
          combined.push(...extractFactTokens(value, objectKeys));
        }
      }

      return combined;
    }

    return [];
  }

  function splitFactTextTokens(text) {
    const source = normalizeText(text, "");
    if (!source) {
      return [];
    }
    return source
      .split(/[,;/|]+/g)
      .map((entry) => normalizeText(entry, "").trim())
      .filter(Boolean);
  }

  function dedupeFactTokens(rawTokens) {
    const result = [];
    const seen = new Set();
    for (const token of Array.isArray(rawTokens) ? rawTokens : []) {
      const safeToken = normalizeText(token, "").trim();
      if (!safeToken) {
        continue;
      }
      const lookup = safeToken.toLowerCase();
      if (seen.has(lookup)) {
        continue;
      }
      seen.add(lookup);
      result.push(safeToken);
    }
    return result;
  }

  function normalizeCurrencyFactValue(rawValue, unknownText = "Unknown") {
    const source = rawValue && typeof rawValue === "object" && !Array.isArray(rawValue)
      ? rawValue
      : null;
    const tokens = extractFactTokens(rawValue, [
      "code",
      "currency",
      "currency_code",
      "iso",
      "iso_code",
      "symbol",
      "name",
      "title",
      "label"
    ]);

    if (source) {
      for (const key of Object.keys(source)) {
        if (/^[A-Z]{3}$/.test(key)) {
          tokens.push(key);
        }
      }
    }

    const normalizedTokens = dedupeFactTokens(tokens).map((token) => {
      const upper = token.toUpperCase();
      return /^[A-Z]{3}$/.test(upper) ? upper : token;
    });

    return normalizedTokens.length > 0
      ? normalizedTokens.join(", ")
      : unknownText;
  }

  function normalizeLanguageFactValue(rawValue, unknownText = "Unknown") {
    const tokens = dedupeFactTokens(
      extractFactTokens(rawValue, [
        "language",
        "languages",
        "name",
        "title",
        "label",
        "nativeName",
        "native_name",
        "code"
      ])
    );
    return tokens.length > 0
      ? tokens.join(", ")
      : unknownText;
  }

  function normalizeUtcFactValue(rawValue, unknownText = "Unknown") {
    const raw = pickFirstPresentField(
      { value: rawValue },
      ["value"]
    );

    if (raw === undefined) {
      return unknownText;
    }

    if (Number.isFinite(Number(raw))) {
      const numeric = Number(raw);
      const sign = numeric >= 0 ? "+" : "";
      return `UTC${sign}${numeric}`;
    }

    if (raw && typeof raw === "object") {
      const nested = pickFirstPresentField(raw, ["utc", "utc_offset", "utcOffset", "offset", "timezone", "tz"]);
      if (nested !== undefined) {
        return normalizeUtcFactValue(nested, unknownText);
      }
      return unknownText;
    }

    const text = normalizeText(raw, "").trim();
    if (!text) {
      return unknownText;
    }

    if (/^utc/i.test(text)) {
      return `UTC${text.slice(3)}`.replace(/\s+/g, " ").trim();
    }
    if (/^gmt/i.test(text)) {
      return `UTC${text.slice(3)}`.replace(/\s+/g, " ").trim();
    }
    if (/^[+-]?\d{1,2}(?::\d{2})?$/.test(text)) {
      const sign = text.startsWith("+") || text.startsWith("-") ? "" : "+";
      return `UTC${sign}${text}`;
    }

    return text;
  }

  function buildPlaceDetails(place) {
    const languageValue = Array.isArray(place?.languages)
      ? place.languages
          .filter((item) => typeof item === "string" && item.trim() !== "")
          .join(" / ")
      : place?.languages;

    return {
      population: Number.isFinite(Number(place?.population)) ? Number(place.population) : null,
      area_km2: Number.isFinite(Number(place?.areaKm2 ?? place?.area_km2))
        ? Number(place.areaKm2 ?? place.area_km2)
        : null,
      category: formatCategoryLabel(normalizePlaceCategoryValue(place)),
      tagsLabel: (Array.isArray(place?.tags) ? place.tags : [])
        .map((entry) => normalizeText(entry, ""))
        .filter(Boolean)
        .slice(0, 5)
        .join(", "),
      isFree: resolvePlaceBooleanFlag(place, ["isFree", "is_free", "free", "onlyFree"]),
      familyFriendly: resolvePlaceBooleanFlag(place, ["familyFriendly", "family_friendly", "family"]),
      currency: normalizeText(place?.currency, ""),
      languages: normalizeText(languageValue, ""),
      utc_offset: normalizeText(place?.utcOffset ?? place?.utc_offset, ""),
      climate: normalizeText(place?.climate, ""),
      country: normalizeText(place?.country, ""),
      countryCode: normalizeText(place?.countryCode, ""),
      region: normalizeText(place?.region, ""),
      founded: normalizeText(place?.founded, "")
    };
  }

  function resolvePlaceSources(place) {
    const defaultSources = [
      { label: "Wikipedia", url: "https://www.wikipedia.org/" },
      { label: "GeoNames", url: "https://www.geonames.org/" },
      { label: "WeatherAPI", url: "https://www.weatherapi.com/" }
    ];

    const sourceMap = new Map();
    for (const source of defaultSources) {
      sourceMap.set(source.label.toLowerCase(), source);
    }

    if (Array.isArray(place?.sources)) {
      for (const source of place.sources) {
        if (!source || typeof source !== "object") {
          continue;
        }

        const label = normalizeText(source.label, "");
        const url = normalizeHttpUrl(source.url);
        if (!label || !url) {
          continue;
        }

        sourceMap.set(label.toLowerCase(), { label, url });
      }
    }

    return Array.from(sourceMap.values());
  }

  function formatCompactPopulation(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return "—";
    }

    if (numeric >= 1_000_000) {
      const millions = numeric / 1_000_000;
      const formatter = new Intl.NumberFormat("ru-RU", {
        minimumFractionDigits: millions >= 10 ? 1 : 2,
        maximumFractionDigits: millions >= 10 ? 1 : 2
      });
      return `${formatter.format(millions)} млн`;
    }

    if (numeric >= 1_000) {
      const thousands = numeric / 1_000;
      const formatter = new Intl.NumberFormat("ru-RU", {
        minimumFractionDigits: thousands >= 10 ? 1 : 2,
        maximumFractionDigits: thousands >= 10 ? 1 : 2
      });
      return `${formatter.format(thousands)} тыс`;
    }

    return new Intl.NumberFormat("ru-RU").format(Math.round(numeric));
  }

  function formatArea(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return "—";
    }

    const formatter = new Intl.NumberFormat("ru-RU", {
      maximumFractionDigits: numeric >= 1000 ? 0 : 1
    });
    return `${formatter.format(numeric)} км²`;
  }

  function createPlaceFeedbackStore(storageKey) {
    const REVIEWS_TABLE = "reviews";
    const REVIEWS_BY_SLUG_VIEW = "reviews_by_slug";
    const PLACE_REVIEWS_SUMMARY_VIEW = "place_reviews_summary";
    const SUPABASE_WAIT_TIMEOUT_MS = 9000;
    const SUPABASE_QUERY_TIMEOUT_MS = 11000;
    const BANNED_REVIEW_MESSAGE = "Your account is banned. You cannot leave reviews.";
    const FROZEN_REVIEW_MESSAGE = "Your account is in read-only mode. You cannot leave reviews.";
    const AUTH_CACHE_TTL_MS = 1200;
    const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const OPTIONAL_REVIEW_COLUMNS = Object.freeze(["id", "comment", "created_at", "updated_at"]);

    let authCache = {
      at: 0,
      client: null,
      user: null
    };
    const unsupportedReviewColumns = new Set();
    const placeIdResolutionCache = new Map();

    window.addEventListener("worldatlas:auth-changed", () => {
      authCache = {
        at: 0,
        client: null,
        user: null
      };
      placeIdResolutionCache.clear();
    });

    return {
      isAuthenticated,
      getUserEntry,
      saveUserEntry,
      getCommunitySnapshot
    };

    async function isAuthenticated() {
      const { user } = await resolveSupabaseAuthContext();
      return Boolean(user);
    }

    async function getUserEntry(placeId, retryAttempt = 0) {
      const safePlaceId = normalizeText(placeId, "");
      const payload = readPayload();
      const localEntry = sanitizeUserEntry(payload.userEntries[safePlaceId]);
      if (!safePlaceId) {
        return localEntry;
      }

      const { client, user } = await resolveSupabaseAuthContext();
      if (!client || !user) {
        return localEntry;
      }

      try {
        const resolvedPlaceId = await resolveReviewPlaceId(client, safePlaceId);
        if (!resolvedPlaceId) {
          return localEntry;
        }

        const selectColumns = buildReviewSelectColumns(
          REVIEWS_TABLE,
          ["rating", "comment", "updated_at"]
        );
        const { data, error } = await withTimeout(
          client
            .from(REVIEWS_TABLE)
            .select(selectColumns)
            .eq("place_id", resolvedPlaceId)
            .eq("user_id", user.id)
            .maybeSingle(),
          SUPABASE_QUERY_TIMEOUT_MS,
          "Supabase review user query timeout"
        );

        if (error) {
          const missingColumn = extractMissingReviewColumn(error, REVIEWS_TABLE);
          if (missingColumn && retryAttempt < 3) {
            markReviewColumnUnsupported(REVIEWS_TABLE, missingColumn);
            return getUserEntry(placeId, retryAttempt + 1);
          }
          console.error("Supabase user review read failed:", error);
          return localEntry;
        }

        if (!data) {
          return localEntry;
        }

        return sanitizeUserEntry({
          ...localEntry,
          rating: data.rating,
          comment: data.comment,
          updatedAt: normalizeText(data.updated_at, localEntry.updatedAt)
        });
      } catch (error) {
        console.error("Supabase user review read failed:", error);
        return localEntry;
      }
    }

    async function saveUserEntry(placeId, entry, options = {}) {
      const { syncReview = true } = options;
      const safePlaceId = normalizeText(placeId, "");
      if (!safePlaceId) {
        return sanitizeUserEntry(entry);
      }

      const payload = readPayload();
      const nextEntry = sanitizeUserEntry(entry);
      nextEntry.updatedAt = new Date().toISOString();
      payload.userEntries[safePlaceId] = nextEntry;
      writePayload(payload);

      if (!syncReview) {
        return nextEntry;
      }

      const { client, user } = await resolveSupabaseAuthContext();
      if (!client || !user) {
        throw new Error("Sign in to leave review.");
      }
      await assertUserCanWriteReview(client, user.id);
      const currentUserId = normalizeText(user.id, "");

      const resolvedPlaceId = await resolveReviewPlaceId(client, safePlaceId);
      if (!resolvedPlaceId) {
        cacheLocalCommunityReview(safePlaceId, currentUserId, nextEntry);
        throw new Error(
          "Точка не найдена в Supabase places (slug -> place_id). Проверьте places.slug."
        );
      }

      if (nextEntry.rating < 1) {
        const { error } = await withTimeout(
          client
            .from(REVIEWS_TABLE)
            .delete()
            .eq("place_id", resolvedPlaceId)
            .eq("user_id", user.id),
          SUPABASE_QUERY_TIMEOUT_MS,
          "Supabase review delete timeout"
        );

        if (error) {
          cacheLocalCommunityReview(safePlaceId, currentUserId, nextEntry);
          throw new Error(
            normalizeSupabaseReviewError(error, "Не удалось удалить отзыв.")
          );
        }
        cacheLocalCommunityReview(safePlaceId, currentUserId, nextEntry);
        return nextEntry;
      }

      const rowPayload = {
        place_id: resolvedPlaceId,
        user_id: user.id,
        rating: nextEntry.rating,
        comment: nextEntry.comment || ""
      };

      const { error } = await withTimeout(
        client
          .from(REVIEWS_TABLE)
          .upsert(rowPayload, {
            onConflict: "place_id,user_id"
          }),
        SUPABASE_QUERY_TIMEOUT_MS,
        "Supabase review upsert timeout"
      );

      if (error) {
        cacheLocalCommunityReview(safePlaceId, currentUserId, nextEntry);
        throw new Error(
          normalizeSupabaseReviewError(error, "Не удалось сохранить отзыв.")
        );
      }

      cacheLocalCommunityReview(safePlaceId, currentUserId, nextEntry);
      return nextEntry;
    }

    async function getCommunitySnapshot(place, retryAttempt = 0) {
      const safePlaceId = normalizeText(place?.id, "");
      const payload = readPayload();
      const localCommunityReviews = sanitizeLocalCommunityReviews(
        payload.localCommunity[safePlaceId]
      );
      if (!safePlaceId) {
        return buildCommunitySnapshotFromReviews([]);
      }

      const { client, user } = await resolveSupabaseAuthContext();
      const currentUserId = normalizeText(user?.id, "");

      if (!user) {
        const workerSnapshot = await fetchCommunitySnapshotFromWorker(safePlaceId);
        if (workerSnapshot) {
          const mergedReviews = mergeCommunityReviews(
            Array.isArray(workerSnapshot.reviews) ? workerSnapshot.reviews : [],
            localCommunityReviews
          );
          const snapshot = buildCommunitySnapshotFromReviews(mergedReviews, {
            loadError: normalizeText(workerSnapshot.loadError, "")
          });
          if (Number.isFinite(Number(workerSnapshot.average))) {
            snapshot.average = round(clamp(Number(workerSnapshot.average), 0, 5), 1);
          }
          if (Number.isFinite(Number(workerSnapshot.count))) {
            snapshot.count = Math.max(0, Math.floor(Number(workerSnapshot.count)));
          }
          return snapshot;
        }
      }

      if (!client) {
        if (localCommunityReviews.length > 0) {
          return buildCommunitySnapshotFromReviews(localCommunityReviews);
        }
        return {
          average: 0,
          count: 0,
          reviews: []
        };
      }

      if (Runtime.supabaseReviewSchemaMissing) {
        return buildCommunitySnapshotFromReviews(localCommunityReviews);
      }

      const resolvedPlaceId = await resolveReviewPlaceId(client, safePlaceId);
      if (!resolvedPlaceId) {
        return buildCommunitySnapshotFromReviews(localCommunityReviews);
      }

      try {
        const selectColumns = buildReviewSelectColumns(
          REVIEWS_TABLE,
          ["user_id", "rating", "comment", "created_at", "updated_at", "id"]
        );
        let reviewsQuery = client
          .from(REVIEWS_TABLE)
          .select(selectColumns)
          .eq("place_id", resolvedPlaceId);

        if (!isReviewColumnUnsupported(REVIEWS_TABLE, "created_at")) {
          reviewsQuery = reviewsQuery.order("created_at", { ascending: false });
        } else if (!isReviewColumnUnsupported(REVIEWS_TABLE, "updated_at")) {
          reviewsQuery = reviewsQuery.order("updated_at", { ascending: false });
        }
        reviewsQuery = reviewsQuery.limit(5);

        const summaryQuery = client
          .from(PLACE_REVIEWS_SUMMARY_VIEW)
          .select("place_id,avg_rating,reviews_count")
          .eq("place_id", resolvedPlaceId)
          .maybeSingle();

        let [
          { data: reviewsData, error: reviewsError },
          { data: summaryData, error: summaryError }
        ] = await Promise.all([
          withTimeout(
            reviewsQuery,
            SUPABASE_QUERY_TIMEOUT_MS,
            "Supabase community reviews query timeout"
          ),
          withTimeout(
            summaryQuery,
            SUPABASE_QUERY_TIMEOUT_MS,
            "Supabase place review summary query timeout"
          )
        ]);

        if (reviewsError) {
          const missingColumn = extractMissingReviewColumn(reviewsError, REVIEWS_TABLE);
          if (missingColumn && retryAttempt < 3) {
            markReviewColumnUnsupported(REVIEWS_TABLE, missingColumn);
            return getCommunitySnapshot(place, retryAttempt + 1);
          }
          if (isSupabaseRelationMissing(reviewsError, REVIEWS_TABLE)) {
            markSupabaseReviewSchemaMissing(reviewsError);
            return buildCommunitySnapshotFromReviews(localCommunityReviews);
          }
          const fallbackReviews = await loadRecentReviewsBySlug(client, place, safePlaceId);
          if (Array.isArray(fallbackReviews)) {
            reviewsData = fallbackReviews;
            reviewsError = null;
          }
        }
        if (reviewsError) {
          const loadError = formatSupabaseReviewError(reviewsError, "Не удалось загрузить отзывы.");
          console.error("[reviews] Supabase community query failed:", reviewsError);
          if (localCommunityReviews.length > 0) {
            return buildCommunitySnapshotFromReviews(localCommunityReviews, { loadError });
          }
          return {
            average: 0,
            count: 0,
            reviews: [],
            loadError
          };
        }

        if (summaryError) {
          if (isSupabaseRelationMissing(summaryError, PLACE_REVIEWS_SUMMARY_VIEW)) {
            markSupabaseReviewSchemaMissing(summaryError);
            return buildCommunitySnapshotFromReviews(localCommunityReviews);
          }
          console.error("[reviews] Supabase summary query failed:", summaryError);
          const fallbackSummary = await loadSummaryFallbackBySlug(client, place, safePlaceId);
          if (fallbackSummary) {
            summaryData = fallbackSummary;
            summaryError = null;
          }
        }
        if (!summaryData && !summaryError) {
          const fallbackSummary = await loadSummaryFallbackBySlug(client, place, safePlaceId);
          if (fallbackSummary) {
            summaryData = fallbackSummary;
          }
        }

        const normalizedReviews = Array.isArray(reviewsData)
          ? reviewsData
              .map((entry) => mapSupabaseReviewEntry(entry, currentUserId))
              .filter(Boolean)
          : [];

        const mergedReviews = mergeCommunityReviews(
          normalizedReviews,
          localCommunityReviews
        );
        const snapshot = buildCommunitySnapshotFromReviews(mergedReviews);

        const summaryAverage = Number(summaryData?.avg_rating);
        const summaryCount = Number(summaryData?.reviews_count);
        if (Number.isFinite(summaryAverage)) {
          snapshot.average = round(clamp(summaryAverage, 0, 5), 1);
        }
        if (Number.isFinite(summaryCount) && summaryCount >= 0) {
          snapshot.count = Math.floor(summaryCount);
        }

        return snapshot;
      } catch (error) {
        if (isSupabaseRelationMissing(error, REVIEWS_TABLE)) {
          markSupabaseReviewSchemaMissing(error);
          return buildCommunitySnapshotFromReviews(localCommunityReviews);
        }
        const loadError = formatSupabaseReviewError(error, "Не удалось загрузить отзывы.");
        console.error("[reviews] Supabase community query failed:", error);
        if (localCommunityReviews.length > 0) {
          return buildCommunitySnapshotFromReviews(localCommunityReviews, { loadError });
        }
        return {
          average: 0,
          count: 0,
          reviews: [],
          loadError
        };
      }
    }

    async function fetchCommunitySnapshotFromWorker(placeId) {
      const safePlaceId = normalizeText(placeId, "");
      if (!safePlaceId) {
        return {
          average: 0,
          count: 0,
          reviews: []
        };
      }

      try {
        const response = await fetch(buildUrl("/api/community", {
          placeId: safePlaceId
        }), {
          method: "GET",
          headers: {
            Accept: "application/json"
          }
        });

        const payload = await parseJsonResponse(response);
        if (!response.ok) {
          const access = payload?.access && typeof payload.access === "object"
            ? payload.access
            : null;
          if (response.status === 403 && access?.isBanned === true) {
            applyUserBanUiState({
              userId: normalizeUserId(access.userId),
              visitorId: normalizeText(access.visitorId, ""),
              isBanned: true,
              source: normalizeText(access.source, ""),
              reason: normalizeText(access.reason, ""),
              bannedUntil: normalizeText(access.bannedUntil, ""),
              isPermanent: access.isPermanent === true,
              message: buildBanStateMessage({
                isBanned: true,
                source: normalizeText(access.source, ""),
                reason: normalizeText(access.reason, ""),
                bannedUntil: normalizeText(access.bannedUntil, ""),
                isPermanent: access.isPermanent === true
              })
            });
            redirectToBannedPage();
          }
          return null;
        }

        return payload && typeof payload === "object"
          ? payload
          : null;
      } catch {
        return null;
      }
    }

    async function resolveReviewPlaceId(client, placeRef) {
      const safePlaceRef = normalizeText(placeRef, "");
      if (!safePlaceRef || !client) {
        return "";
      }

      if (Runtime.supabaseReviewSchemaMissing) {
        return "";
      }

      if (isSupabaseReviewPlaceId(safePlaceRef)) {
        return safePlaceRef;
      }

      if (placeIdResolutionCache.has(safePlaceRef)) {
        return normalizeText(placeIdResolutionCache.get(safePlaceRef), "");
      }

      const slugCandidate = normalizeText(safePlaceRef, "").toLowerCase();
      const slugCandidates = Array.from(new Set(
        [normalizeText(safePlaceRef, ""), slugCandidate]
          .map((entry) => normalizeText(entry, ""))
          .filter(Boolean)
      ));
      if (slugCandidates.length === 0) {
        return "";
      }

      const { data, error } = await withTimeout(
        client
          .from("places")
          .select("id,slug")
          .in("slug", slugCandidates)
          .limit(1)
          .maybeSingle(),
          SUPABASE_QUERY_TIMEOUT_MS,
          "Supabase resolve place by slug timeout"
      );

      if (error) {
        if (isSupabaseRelationMissing(error, "places")) {
          markSupabaseReviewSchemaMissing(error);
          return "";
        }
        throw new Error(
          formatSupabaseReviewError(error, "Не удалось определить place_id по slug.")
        );
      }

      const resolvedPlaceId = normalizeText(data?.id, "");
      placeIdResolutionCache.set(safePlaceRef, resolvedPlaceId);
      return resolvedPlaceId;
    }

    async function loadSummaryFallbackBySlug(client, place, placeRef) {
      const slugCandidates = resolvePlaceSlugCandidates(place, placeRef);
      if (!client || slugCandidates.length === 0) {
        return null;
      }

      const { data, error } = await withTimeout(
        client
          .from(REVIEWS_BY_SLUG_VIEW)
          .select("rating")
          .in("place_slug", slugCandidates)
          .limit(2000),
        SUPABASE_QUERY_TIMEOUT_MS,
        "Supabase reviews_by_slug summary fallback timeout"
      );

      if (error) {
        console.error("[reviews] Supabase reviews_by_slug summary fallback failed:", error);
        return null;
      }

      const ratings = Array.isArray(data)
        ? data
            .map((row) => normalizeFeedbackRating(row?.rating))
            .filter((rating) => rating >= 1)
        : [];
      if (ratings.length === 0) {
        return {
          avg_rating: 0,
          reviews_count: 0
        };
      }

      const sum = ratings.reduce((acc, value) => acc + value, 0);
      return {
        avg_rating: sum / ratings.length,
        reviews_count: ratings.length
      };
    }

    async function loadRecentReviewsBySlug(client, place, placeRef, retryAttempt = 0) {
      const slugCandidates = resolvePlaceSlugCandidates(place, placeRef);
      if (!client || slugCandidates.length === 0) {
        return null;
      }

      const selectColumns = buildReviewSelectColumns(
        REVIEWS_BY_SLUG_VIEW,
        ["user_id", "rating", "comment", "created_at", "updated_at", "id"]
      );
      let query = client
        .from(REVIEWS_BY_SLUG_VIEW)
        .select(selectColumns)
        .in("place_slug", slugCandidates);
      if (!isReviewColumnUnsupported(REVIEWS_BY_SLUG_VIEW, "created_at")) {
        query = query.order("created_at", { ascending: false });
      } else if (!isReviewColumnUnsupported(REVIEWS_BY_SLUG_VIEW, "updated_at")) {
        query = query.order("updated_at", { ascending: false });
      }
      query = query.limit(5);

      const { data, error } = await withTimeout(
        query,
        SUPABASE_QUERY_TIMEOUT_MS,
        "Supabase reviews_by_slug fallback query timeout"
      );

      if (error) {
        const missingColumn = extractMissingReviewColumn(error, REVIEWS_BY_SLUG_VIEW);
        if (missingColumn && retryAttempt < 3) {
          markReviewColumnUnsupported(REVIEWS_BY_SLUG_VIEW, missingColumn);
          return loadRecentReviewsBySlug(client, place, placeRef, retryAttempt + 1);
        }
        console.error("[reviews] Supabase reviews_by_slug fallback failed:", error);
        return null;
      }

      return Array.isArray(data) ? data : [];
    }

    function resolvePlaceSlugCandidates(place, placeRef) {
      const candidates = [
        normalizeText(place?.slug, ""),
        normalizeText(place?.id, ""),
        normalizeText(placeRef, "")
      ]
        .map((entry) => normalizeText(entry, ""))
        .filter(Boolean)
        .filter((entry) => !isSupabaseReviewPlaceId(entry));

      return Array.from(new Set(
        candidates.flatMap((entry) => {
          const lowered = entry.toLowerCase();
          return lowered === entry ? [entry] : [entry, lowered];
        })
      ));
    }

    function buildCommunitySnapshotFromReviews(reviews, extras = {}) {
      const normalizedReviews = sanitizeLocalCommunityReviews(reviews);
      const ratingSum = normalizedReviews.reduce(
        (acc, entry) => acc + normalizeFeedbackRating(entry.rating),
        0
      );
      const reviewsCount = normalizedReviews.length;
      const average = reviewsCount > 0
        ? round(ratingSum / reviewsCount, 1)
        : 0;
      return {
        average,
        count: reviewsCount,
        reviews: normalizedReviews,
        ...extras
      };
    }

    function mergeCommunityReviews(primaryReviews, fallbackReviews) {
      const merged = [];
      const seenIds = new Set();
      const seenAuthors = new Set();

      const append = (entry) => {
        const sanitized = sanitizeCommunityReview(entry);
        if (!sanitized) {
          return;
        }

        const safeId = normalizeText(sanitized.id, "");
        const safeAuthor = normalizeText(sanitized.authorId, "");
        if (safeId && seenIds.has(safeId)) {
          return;
        }
        if (safeAuthor && seenAuthors.has(safeAuthor)) {
          return;
        }

        merged.push(sanitized);
        if (safeId) {
          seenIds.add(safeId);
        }
        if (safeAuthor) {
          seenAuthors.add(safeAuthor);
        }
      };

      for (const entry of Array.isArray(primaryReviews) ? primaryReviews : []) {
        append(entry);
      }
      for (const entry of Array.isArray(fallbackReviews) ? fallbackReviews : []) {
        append(entry);
      }

      return sanitizeLocalCommunityReviews(merged);
    }

    function buildReviewSelectColumns(tableName, requestedColumns) {
      const table = normalizeText(tableName, "");
      const columns = Array.isArray(requestedColumns) ? requestedColumns : [];
      const filtered = columns.filter((columnNameRaw) => {
        const columnName = normalizeText(columnNameRaw, "").toLowerCase();
        if (!columnName) {
          return false;
        }
        if (!OPTIONAL_REVIEW_COLUMNS.includes(columnName)) {
          return true;
        }
        return !isReviewColumnUnsupported(table, columnName);
      });

      return filtered.join(",");
    }

    function getReviewColumnKey(tableName, columnName) {
      const table = normalizeText(tableName, "").toLowerCase();
      const column = normalizeText(columnName, "").toLowerCase();
      if (!table || !column) {
        return "";
      }
      return `${table}.${column}`;
    }

    function isReviewColumnUnsupported(tableName, columnName) {
      const key = getReviewColumnKey(tableName, columnName);
      return key ? unsupportedReviewColumns.has(key) : false;
    }

    function markReviewColumnUnsupported(tableName, columnName) {
      const key = getReviewColumnKey(tableName, columnName);
      if (!key) {
        return;
      }
      if (unsupportedReviewColumns.has(key)) {
        return;
      }
      unsupportedReviewColumns.add(key);
      console.info(`[reviews] ${key} is unavailable, fallback enabled.`);
    }

    function extractMissingReviewColumn(error, tableName) {
      const code = normalizeText(error?.code, "").toUpperCase();
      const message = normalizeText(error?.message, "");
      const details = normalizeText(error?.details, "");
      const hint = normalizeText(error?.hint, "");
      const source = `${message} ${details} ${hint}`.toLowerCase();
      const safeTable = normalizeText(tableName, "").toLowerCase();

      const hasKnownMissingCode =
        code === "PGRST204" ||
        code === "PGRST205" ||
        code === "42703";
      const hasMissingColumnHint =
        source.includes("schema cache") ||
        source.includes("column") ||
        source.includes("does not exist");

      if (!hasKnownMissingCode && !hasMissingColumnHint) {
        return "";
      }

      const pgrstMatch = /could not find the ['"]?([a-z0-9_]+)['"]?\s+column of ['"]?([a-z0-9_]+)['"]?/i
        .exec(`${message} ${details}`);
      if (pgrstMatch) {
        const matchedColumn = normalizeText(pgrstMatch[1], "").toLowerCase();
        const matchedTable = normalizeText(pgrstMatch[2], "").toLowerCase();
        if (!safeTable || !matchedTable || matchedTable === safeTable) {
          return matchedColumn;
        }
      }

      const pgMatch = /column\s+(?:["']?([a-z0-9_]+)["']?\.)?["']?([a-z0-9_]+)["']?\s+does not exist/i
        .exec(source);
      if (pgMatch) {
        const matchedTable = normalizeText(pgMatch[1], "").toLowerCase();
        const matchedColumn = normalizeText(pgMatch[2], "").toLowerCase();
        if (!safeTable || !matchedTable || matchedTable === safeTable) {
          return matchedColumn;
        }
      }

      for (const candidate of OPTIONAL_REVIEW_COLUMNS) {
        if (source.includes(candidate)) {
          return candidate;
        }
      }

      return "";
    }

    function cacheLocalCommunityReview(placeId, userId, entry) {
      const safePlaceId = normalizeText(placeId, "");
      if (!safePlaceId) {
        return;
      }

      const safeUserId = normalizeText(userId, "");
      const sanitizedEntry = sanitizeUserEntry(entry);
      const payload = readPayload();
      const currentReviews = sanitizeLocalCommunityReviews(payload.localCommunity[safePlaceId]);
      const filtered = currentReviews.filter(
        (item) => normalizeText(item.authorId, "") !== safeUserId
      );

      if (sanitizedEntry.rating >= 1) {
        filtered.unshift({
          id: `local-${safePlaceId}-${safeUserId || "user"}`,
          authorId: safeUserId,
          authorName: "You",
          rating: sanitizedEntry.rating,
          comment: sanitizedEntry.comment,
          createdAt: new Date().toISOString(),
          source: "local"
        });
      }

      payload.localCommunity[safePlaceId] = sanitizeLocalCommunityReviews(filtered);
      writePayload(payload);
    }

    function isSupabaseReviewPlaceId(value) {
      return UUID_PATTERN.test(normalizeText(value, ""));
    }

    function mapSupabaseReviewEntry(entry, currentUserId) {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const rating = normalizeFeedbackRating(entry.rating);
      if (rating < 1) {
        return null;
      }

      const authorId = normalizeText(entry.user_id, "");
      const isOwn = Boolean(authorId && currentUserId && authorId === currentUserId);
      return {
        id: normalizeText(entry.id, `review-${Date.now()}-${Math.random()}`),
        authorId,
        authorName: isOwn
          ? "You"
          : formatCommunityReviewerName(authorId),
        rating,
        comment: normalizeFeedbackComment(entry.comment),
        createdAt: normalizeText(entry.created_at ?? entry.updated_at, new Date().toISOString()),
        source: "supabase"
      };
    }

    function formatCommunityReviewerName(userId) {
      const safeUserId = normalizeText(userId, "");
      if (!safeUserId) {
        return "User";
      }
      return `User ${safeUserId.slice(0, 8)}`;
    }

    async function resolveSupabaseAuthContext() {
      const now = Date.now();
      if ((now - authCache.at) <= AUTH_CACHE_TTL_MS) {
        return authCache;
      }

      const client = await resolveSupabaseClient();
      if (!client) {
        authCache = {
          at: now,
          client: null,
          user: null
        };
        return authCache;
      }

      try {
        const { data, error } = await withTimeout(
          client.auth.getUser(),
          SUPABASE_QUERY_TIMEOUT_MS,
          "Supabase auth user timeout"
        );

        authCache = {
          at: now,
          client,
          user: error ? null : (data?.user || null)
        };
      } catch {
        authCache = {
          at: now,
          client,
          user: null
        };
      }

      return authCache;
    }

    async function resolveReviewBanState(client, userId) {
      const safeUserId = normalizeUserId(userId);
      if (!safeUserId) {
        return false;
      }

      try {
        const rpcResult = await withTimeout(
          client.rpc("is_banned", {
            target_user_id: safeUserId
          }),
          SUPABASE_QUERY_TIMEOUT_MS,
          "Supabase is_banned RPC timeout"
        );
        if (!rpcResult?.error) {
          const directValue = Array.isArray(rpcResult.data) ? rpcResult.data[0] : rpcResult.data;
          if (typeof directValue === "boolean") {
            return directValue;
          }
          if (typeof directValue === "number") {
            return directValue === 1;
          }
        }
      } catch {
        // fallback below
      }

      try {
        const { data, error } = await withTimeout(
          client
            .from("user_bans")
            .select("user_id,banned,banned_until")
            .eq("user_id", safeUserId)
            .limit(1)
            .maybeSingle(),
          SUPABASE_QUERY_TIMEOUT_MS,
          "Supabase user_bans fallback timeout"
        );
        if (error) {
          return false;
        }
        const bannedUntil = normalizeText(data?.banned_until, "");
        if (data?.banned === false) {
          return false;
        }
        if (bannedUntil) {
          const timestamp = Date.parse(bannedUntil);
          if (Number.isFinite(timestamp) && timestamp <= Date.now()) {
            return false;
          }
        }
        return Boolean(data?.user_id);
      } catch {
        return false;
      }
    }

    async function resolveReviewFreezeState(client, userId) {
      const safeUserId = normalizeUserId(userId);
      if (!safeUserId) {
        return false;
      }

      try {
        const rpcResult = await withTimeout(
          client.rpc("is_soft_frozen", {
            target_user_id: safeUserId
          }),
          SUPABASE_QUERY_TIMEOUT_MS,
          "Supabase is_soft_frozen RPC timeout"
        );
        if (!rpcResult?.error) {
          const directValue = Array.isArray(rpcResult.data) ? rpcResult.data[0] : rpcResult.data;
          if (typeof directValue === "boolean") {
            return directValue;
          }
          if (typeof directValue === "number") {
            return directValue === 1;
          }
        }
      } catch {
        // fallback below
      }

      try {
        const { data, error } = await withTimeout(
          client
            .from("user_freezes")
            .select("user_id,frozen,frozen_until")
            .eq("user_id", safeUserId)
            .limit(1)
            .maybeSingle(),
          SUPABASE_QUERY_TIMEOUT_MS,
          "Supabase user_freezes review fallback timeout"
        );
        if (error) {
          return false;
        }
        const frozenUntil = normalizeText(data?.frozen_until, "");
        if (data?.frozen === false) {
          return false;
        }
        if (frozenUntil) {
          const timestamp = Date.parse(frozenUntil);
          if (Number.isFinite(timestamp) && timestamp <= Date.now()) {
            return false;
          }
        }
        return Boolean(data?.user_id);
      } catch {
        return false;
      }
    }

    async function assertUserCanWriteReview(client, userId) {
      const [isBanned, isFrozen] = await Promise.all([
        resolveReviewBanState(client, userId),
        resolveReviewFreezeState(client, userId)
      ]);
      if (isBanned) {
        throw new Error(BANNED_REVIEW_MESSAGE);
      }
      if (isFrozen) {
        throw new Error(FROZEN_REVIEW_MESSAGE);
      }
    }

    async function resolveSupabaseClient() {
      if (isSupabaseClient(window.supabase)) {
        return window.supabase;
      }

      if (isSupabaseClient(window.WorldAtlasSupabase?.client)) {
        return window.WorldAtlasSupabase.client;
      }

      if (window.supabaseReady && typeof window.supabaseReady.then === "function") {
        try {
          const client = await withTimeout(
            Promise.resolve(window.supabaseReady),
            SUPABASE_WAIT_TIMEOUT_MS,
            "Supabase client init timeout"
          );
          if (isSupabaseClient(client)) {
            return client;
          }
        } catch {
          return null;
        }
      }

      return null;
    }

    function isSupabaseClient(value) {
      return Boolean(
        value &&
        typeof value === "object" &&
        typeof value.from === "function" &&
        value.auth &&
        typeof value.auth.getUser === "function"
      );
    }

    async function withTimeout(promiseLike, timeoutMs, timeoutMessage) {
      const timeoutPromise = new Promise((_, reject) => {
        window.setTimeout(() => {
          reject(new Error(timeoutMessage));
        }, timeoutMs);
      });

      return Promise.race([promiseLike, timeoutPromise]);
    }

    function normalizeSupabaseReviewError(error, fallbackMessage) {
      const formatted = formatSupabaseReviewError(error, fallbackMessage);
      console.error("[reviews] Supabase write failed:", error);
      return formatted;
    }

    function formatSupabaseReviewError(error, fallbackMessage) {
      const message = normalizeText(error?.message, "");
      const details = normalizeText(error?.details, "");
      const hint = normalizeText(error?.hint, "");
      const code = normalizeText(error?.code, "").toUpperCase();
      const source = `${message} ${details} ${hint}`.toLowerCase();

      if (source.includes("banned")) {
        return BANNED_REVIEW_MESSAGE;
      }
      if (source.includes("freeze") || source.includes("read-only") || source.includes("read only")) {
        return FROZEN_REVIEW_MESSAGE;
      }
      if (code === "42501" || source.includes("permission denied") || source.includes("not allowed")) {
        return "Недостаточно прав для выполнения действия.";
      }
      if (code === "22P02" || source.includes("invalid input syntax for type uuid")) {
        return "Некорректный идентификатор точки. Обновите страницу и попробуйте снова.";
      }
      if (code === "23503" || source.includes("foreign key")) {
        return "Не удалось сохранить отзыв: точка не найдена в базе.";
      }
      if (
        code === "42P01" ||
        code === "PGRST205" ||
        source.includes("could not find the table") ||
        source.includes("schema cache")
      ) {
        return "Сервис отзывов временно недоступен. Проверьте таблицы и view в Supabase.";
      }
      if (source.includes("timeout")) {
        return "Сервер отвечает слишком долго. Повторите попытку.";
      }

      return normalizeText(message, fallbackMessage);
    }

    function readPayload() {
      let rawPayload = null;
      try {
        rawPayload = window.localStorage.getItem(storageKey);
      } catch (error) {
        console.warn("Feedback store read failed:", error);
      }

      let parsed = {};
      if (rawPayload) {
        try {
          parsed = JSON.parse(rawPayload);
        } catch {
          parsed = {};
        }
      }

      const normalized = {
        userEntries: {},
        localCommunity: {}
      };

      const sourceEntries = parsed?.userEntries && typeof parsed.userEntries === "object"
        ? parsed.userEntries
        : {};
      for (const [placeId, value] of Object.entries(sourceEntries)) {
        const safePlaceId = normalizeText(placeId, "");
        if (!safePlaceId) {
          continue;
        }
        normalized.userEntries[safePlaceId] = sanitizeUserEntry(value);
      }

      const sourceCommunity = parsed?.localCommunity && typeof parsed.localCommunity === "object"
        ? parsed.localCommunity
        : {};
      for (const [placeId, value] of Object.entries(sourceCommunity)) {
        const safePlaceId = normalizeText(placeId, "");
        if (!safePlaceId) {
          continue;
        }
        normalized.localCommunity[safePlaceId] = sanitizeLocalCommunityReviews(value);
      }

      return normalized;
    }

    function writePayload(payload) {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(payload));
      } catch (error) {
        console.warn("Feedback store write failed:", error);
      }
    }

    function sanitizeUserEntry(value) {
      const source = value && typeof value === "object" ? value : {};
      return {
        status: normalizeFeedbackStatus(source.status),
        rating: normalizeFeedbackRating(source.rating),
        comment: normalizeFeedbackComment(source.comment),
        updatedAt: normalizeText(source.updatedAt, "")
      };
    }

    function sanitizeLocalCommunityReviews(value) {
      if (!Array.isArray(value)) {
        return [];
      }

      const sanitized = value
        .map((entry) => sanitizeCommunityReview(entry))
        .filter(Boolean);

      sanitized.sort((left, right) => {
        const leftTime = Date.parse(normalizeText(left.createdAt, ""));
        const rightTime = Date.parse(normalizeText(right.createdAt, ""));
        const safeLeft = Number.isFinite(leftTime) ? leftTime : 0;
        const safeRight = Number.isFinite(rightTime) ? rightTime : 0;
        return safeRight - safeLeft;
      });

      return sanitized.slice(0, 20);
    }

    function sanitizeCommunityReview(value) {
      if (!value || typeof value !== "object") {
        return null;
      }

      const rating = normalizeFeedbackRating(value.rating);
      if (rating < 1) {
        return null;
      }

      const authorId = normalizeText(value.authorId ?? value.user_id, "");
      return {
        id: normalizeText(value.id, `local-review-${Date.now()}-${Math.random()}`),
        authorId,
        authorName: normalizeText(value.authorName, formatCommunityReviewerName(authorId)),
        rating,
        comment: normalizeFeedbackComment(value.comment),
        createdAt: normalizeText(value.createdAt ?? value.created_at, new Date().toISOString()),
        source: normalizeText(value.source, "local")
      };
    }
  }

  function normalizeFeedbackStatus(value) {
    const normalized = normalizeText(value, "").toLowerCase();
    if (normalized === "want" || normalized === "visited") {
      return normalized;
    }
    return "";
  }

  function normalizeFeedbackRating(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return 0;
    }
    return clamp(Math.round(numeric), 0, 5);
  }

  function normalizeFeedbackCommentDraft(value) {
    if (typeof value === "string") {
      return value.slice(0, 280);
    }
    if (value === null || value === undefined) {
      return "";
    }
    return String(value).slice(0, 280);
  }

  function normalizeFeedbackComment(value) {
    return normalizeText(normalizeFeedbackCommentDraft(value), "");
  }

  function buildStarsString(rating) {
    const safeRating = normalizeFeedbackRating(rating);
    const full = "★".repeat(safeRating);
    const empty = "☆".repeat(Math.max(0, 5 - safeRating));
    return `${full}${empty}`;
  }

  function formatReviewDate(value) {
    const timestamp = Date.parse(String(value || ""));
    if (!Number.isFinite(timestamp)) {
      return "Недавно";
    }

    const diffMs = Date.now() - timestamp;
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays <= 0) {
      return "Сегодня";
    }
    if (diffDays === 1) {
      return "Вчера";
    }
    if (diffDays < 30) {
      return `${diffDays} дн назад`;
    }

    return new Date(timestamp).toLocaleDateString("ru-RU");
  }

  function createFavoritesStore(storageKey) {
    return {
      read,
      write
    };

    function read() {
      try {
        const raw = window.localStorage.getItem(storageKey);
        if (!raw) {
          return new Set();
        }

        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
          return new Set();
        }

        return new Set(
          parsed
            .map((item) => normalizeText(item, ""))
            .filter((item) => item !== "")
        );
      } catch (error) {
        console.warn("Favorites read failed:", error);
        return new Set();
      }
    }

    function write(value) {
      try {
        const asArray = value instanceof Set
          ? Array.from(value.values())
          : Array.isArray(value)
            ? value
            : [];
        window.localStorage.setItem(storageKey, JSON.stringify(asArray));
      } catch (error) {
        console.warn("Favorites write failed:", error);
      }
    }
  }

  function buildShareUrl(placeId) {
    const url = new URL(window.location.pathname, window.location.origin);
    const view = mapEngine ? mapEngine.getView() : State.mapView;
    const normalizedView = normalizeView(view, Config.DEFAULT_VIEW);

    url.searchParams.set("place", placeId);
    url.searchParams.set("lat", String(round(normalizedView.lat, 5)));
    url.searchParams.set("lng", String(round(normalizedView.lng, 5)));
    url.searchParams.set("z", String(round(normalizedView.zoom, 2)));

    return url.toString();
  }

  async function copyTextToClipboard(text) {
    const safeText = normalizeText(text, "");
    if (!safeText) {
      return false;
    }

    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(safeText);
        return true;
      } catch (error) {
        console.warn("Clipboard API write failed:", error);
      }
    }

    const textarea = document.createElement("textarea");
    textarea.value = safeText;
    textarea.setAttribute("readonly", "readonly");
    textarea.style.position = "fixed";
    textarea.style.top = "-1000px";
    textarea.style.left = "-1000px";
    document.body.append(textarea);
    textarea.select();

    let copied = false;
    try {
      copied = document.execCommand("copy");
    } catch (error) {
      copied = false;
    } finally {
      textarea.remove();
    }

    return copied;
  }

  function showToast(message) {
    const text = normalizeText(message, "");
    if (!text) {
      return;
    }

    Elements.appToast.textContent = text;
    Elements.appToast.hidden = false;
    Elements.appToast.classList.add("is-visible");

    if (Runtime.toastTimerId) {
      window.clearTimeout(Runtime.toastTimerId);
      Runtime.toastTimerId = null;
    }

    Runtime.toastTimerId = window.setTimeout(() => {
      Runtime.toastTimerId = null;
      Elements.appToast.classList.remove("is-visible");
      window.setTimeout(() => {
        if (!Elements.appToast.classList.contains("is-visible")) {
          Elements.appToast.hidden = true;
        }
      }, 220);
    }, Config.TOAST_CLEAR_MS);
  }

  function validateMapEngineDependencies(dependencies) {
    if (!(dependencies.mapElement instanceof HTMLElement)) {
      throw new Error("Map element #map-root is missing.");
    }

    if (typeof dependencies.onSelectPlace !== "function") {
      throw new TypeError("onSelectPlace callback is required.");
    }

    if (typeof dependencies.onViewChange !== "function") {
      throw new TypeError("onViewChange callback is required.");
    }

    if (typeof dependencies.onTileError !== "function") {
      throw new TypeError("onTileError callback is required.");
    }
  }

  function createPinIcon(Leaflet, place, options = {}) {
    const {
      isDraft = false
    } = options;
    const visibility = normalizePlaceVisibilityState(place?.visibility_status ?? place?.visibility);
    const hue = resolvePinHueByVisibility(place?.region, visibility);
    const visibilityClass = resolvePinVisibilityClassName(visibility);
    const scopeClass = resolvePlaceScope(place) === "my"
      ? " map-pin-icon--scope-my"
      : " map-pin-icon--scope-public";
    const draftClass = isDraft ? " map-pin-icon--draft" : "";
    return Leaflet.divIcon({
      className: `map-pin-icon ${visibilityClass}${scopeClass}${draftClass}`,
      html:
        `<span class="map-pin" style="--pin-hue:${hue}" aria-hidden="true">` +
        '<span class="map-pin__shadow" aria-hidden="true"></span>' +
        '<span class="map-pin__glow" aria-hidden="true"></span>' +
        '<span class="map-pin__core" aria-hidden="true"></span>' +
        '<span class="map-pin__pulse" aria-hidden="true"></span>' +
        "</span>",
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });
  }

  function normalizePlaceVisibilityState(rawValue) {
    const normalized = normalizeText(rawValue, "").toLowerCase();
    if (normalized === "private") {
      return "private";
    }
    if (
      normalized === "pending" ||
      normalized === "review" ||
      normalized === "scheduled"
    ) {
      return "pending";
    }
    if (normalized === "rejected" || normalized === "withdrawn") {
      return "private";
    }
    if (normalized === "approved" || normalized === "public") {
      return "approved";
    }
    return "approved";
  }

  function toLocalDateTimeValue(value) {
    const timestamp = value instanceof Date ? value.getTime() : Date.parse(value);
    if (!Number.isFinite(timestamp)) {
      return "";
    }
    const local = new Date(timestamp - (new Date(timestamp).getTimezoneOffset() * 60000));
    return local.toISOString().slice(0, 16);
  }

  function resolvePinHueByVisibility(region, visibility) {
    if (visibility === "private") {
      return 262;
    }
    if (visibility === "pending") {
      return 43;
    }
    return getRegionHue(region);
  }

  function resolvePinVisibilityClassName(visibility) {
    if (visibility === "private") {
      return "map-pin-icon--private";
    }
    if (visibility === "pending") {
      return "map-pin-icon--pending";
    }
    return "map-pin-icon--approved";
  }

  function getRequiredElements() {
    const elements = {
      appStatus: document.getElementById("app-status"),
      topToolbar: document.getElementById("top-toolbar"),
      mapRoot: document.getElementById("map-root"),
      mapZoomSlider: document.getElementById("map-zoom-slider"),
      mapZoomRange: document.getElementById("map-zoom-range"),
      mapZoomInButton: document.getElementById("map-zoom-in"),
      mapZoomOutButton: document.getElementById("map-zoom-out"),
      sidebarPanel: document.getElementById("sidebar-panel"),
      sidebarToggleButton: document.getElementById("sidebar-toggle"),
      nearMeToggleButton: document.getElementById("near-me-toggle"),
      nearMePanel: document.getElementById("near-me-panel"),
      nearMeCloseButton: document.getElementById("near-me-close"),
      nearMeStatus: document.getElementById("near-me-status"),
      nearMeCoords: document.getElementById("near-me-coords"),
      nearMeList: document.getElementById("near-me-list"),
      addPlaceControls: document.getElementById("add-place-controls"),
      addPlacePublicToggleButton: document.getElementById("add-place-public-toggle"),
      addPlaceMyToggleButton: document.getElementById("add-place-my-toggle"),
      addPlaceBanner: document.getElementById("add-place-banner"),
      addPlaceBannerText: document.getElementById("add-place-banner-text"),
      addPlaceBannerCancelButton: document.getElementById("add-place-banner-cancel"),
      addPlaceDrawer: document.getElementById("add-place-drawer"),
      addPlaceCloseButton: document.getElementById("add-place-close"),
      addPlaceStatus: document.getElementById("add-place-status"),
      addPlaceCoords: document.getElementById("add-place-coords"),
      addPlaceModeBadge: document.getElementById("add-place-mode-badge"),
      addPlaceForm: document.getElementById("add-place-form"),
      addPlaceNameInput: document.getElementById("add-place-name"),
      addPlaceDescriptionInput: document.getElementById("add-place-description"),
      addPlacePhotoInput: document.getElementById("add-place-photo"),
      addPlacePhotoClearButton: document.getElementById("add-place-photo-clear"),
      addPlacePhotoPreview: document.getElementById("add-place-photo-preview"),
      addPlacePhotoPreviewImage: document.getElementById("add-place-photo-preview-image"),
      addPlacePhotoMeta: document.getElementById("add-place-photo-meta"),
      addPlacePhotoAuthHint: document.getElementById("add-place-photo-auth-hint"),
      addPlaceCategorySelect: document.getElementById("add-place-category"),
      addPlaceTagInput: document.getElementById("add-place-tag-input"),
      addPlaceTagAddButton: document.getElementById("add-place-tag-add"),
      addPlaceTagsWrap: document.getElementById("add-place-tags"),
      addPlacePriceSelect: document.getElementById("add-place-price"),
      addPlaceFreeCheckbox: document.getElementById("add-place-free"),
      addPlaceFamilyCheckbox: document.getElementById("add-place-family"),
      addPlaceVisibilitySection: document.getElementById("add-place-visibility"),
      addPlaceVisibilityPrivateButton: document.getElementById("add-place-visibility-private"),
      addPlaceVisibilityPublicButton: document.getElementById("add-place-visibility-public"),
      addPlaceVisibilityReviewButton: document.getElementById("add-place-visibility-review"),
      addPlaceScheduleWrap: document.getElementById("add-place-schedule"),
      addPlaceScheduleEnabled: document.getElementById("add-place-schedule-enabled"),
      addPlaceScheduleAt: document.getElementById("add-place-schedule-at"),
      addPlaceScheduleHint: document.getElementById("add-place-schedule-hint"),
      addPlaceSeasonalSection: document.getElementById("add-place-seasonal"),
      addPlaceSeasonalEnabled: document.getElementById("add-place-seasonal-enabled"),
      addPlaceSeasonalHint: document.getElementById("add-place-seasonal-hint"),
      addPlaceSeasonalCards: document.getElementById("add-place-seasonal-cards"),
      addPlaceSubmitButton: document.getElementById("add-place-submit"),
      addPlaceCancelButton: document.getElementById("add-place-cancel"),
      sidebarRevealButton: document.getElementById("sidebar-reveal"),
      sidebarCloseButton: document.getElementById("sidebar-close"),
      fitPointsButton: document.getElementById("fit-points"),
      resetViewButton: document.getElementById("reset-view"),
      clearFiltersButton: document.getElementById("clear-filters"),
      smartFiltersOpenButton: document.getElementById("smart-filters-open"),
      smartFiltersBackdrop: document.getElementById("smart-filters-backdrop"),
      smartFiltersPanel: document.getElementById("smart-filters-panel"),
      smartFiltersCloseButton: document.getElementById("smart-filters-close"),
      smartCategoryFilter: document.getElementById("smart-category-filter"),
      smartTagInput: document.getElementById("smart-tag-input"),
      smartTagAddButton: document.getElementById("smart-tag-add"),
      smartTagsChips: document.getElementById("smart-tags-chips"),
      smartOnlyFreeButton: document.getElementById("smart-only-free"),
      smartFamilyFriendlyButton: document.getElementById("smart-family-friendly"),
      smartSortFilter: document.getElementById("smart-sort-filter"),
      smartFiltersApplyButton: document.getElementById("smart-filters-apply"),
      smartFiltersResetButton: document.getElementById("smart-filters-reset"),
      searchInput: document.getElementById("search-input"),
      regionFilter: document.getElementById("region-filter"),
      favoritesFilterButton: document.getElementById("favorites-filter"),
      pointsTotal: document.getElementById("points-total"),
      pointsVisible: document.getElementById("points-visible"),
      routeStartPlaceSelect: document.getElementById("route-start-place"),
      routeEndPlaceSelect: document.getElementById("route-end-place"),
      routePanelRoot: document.getElementById("route-panel-root"),
      routeModeSelect: document.getElementById("route-mode"),
      routeAddWaypointButton: document.getElementById("route-add-waypoint"),
      routeExtraPointsWrap: document.getElementById("route-extra-points"),
      routeOrderList: document.getElementById("route-order-list"),
      routeStartPickButton: document.getElementById("route-start-pick"),
      routeEndPickButton: document.getElementById("route-end-pick"),
      routeStartMyLocationButton: document.getElementById("route-start-my-location"),
      routeStartCustomWrap: document.getElementById("route-start-custom"),
      routeEndCustomWrap: document.getElementById("route-end-custom"),
      routeStartLatInput: document.getElementById("route-start-lat"),
      routeStartLonInput: document.getElementById("route-start-lon"),
      routeEndLatInput: document.getElementById("route-end-lat"),
      routeEndLonInput: document.getElementById("route-end-lon"),
      routeBuildButton: document.getElementById("route-build"),
      routeClearButton: document.getElementById("route-clear"),
      routeInlineStatus: document.getElementById("route-inline-status"),
      routeInlineStatusText: document.getElementById("route-inline-status-text"),
      routeInlineStatusSpinner: document.getElementById("route-inline-status-spinner"),
      routeDistanceValue: document.getElementById("route-distance"),
      routeDurationValue: document.getElementById("route-duration"),
      routeTypeValue: document.getElementById("route-type"),
      routeProviderValue: document.getElementById("route-provider"),
      routeSegmentsList: document.getElementById("route-segments"),
      pointsList: document.getElementById("points-list"),
      listEmpty: document.getElementById("list-empty"),
      popupBackdrop: document.getElementById("popup-backdrop"),
      popupCard: document.getElementById("popup-card"),
      popupClose: document.getElementById("popup-close"),
      popupContent: document.getElementById("popup-content"),
      popupLoading: document.getElementById("popup-loading"),
      popupError: document.getElementById("popup-error"),
      popupErrorMessage: document.getElementById("popup-error-message"),
      popupRetry: document.getElementById("popup-retry"),
      popupMedia: document.getElementById("popup-media"),
      popupMediaSkeleton: document.getElementById("popup-media-skeleton"),
      popupMediaError: document.getElementById("popup-media-error"),
      popupImage: document.getElementById("popup-image"),
      popupRegionLine: document.getElementById("popup-region-line"),
      popupCountry: document.getElementById("popup-country"),
      popupTitle: document.getElementById("popup-title"),
      popupTrustSignals: document.getElementById("popup-trust-signals"),
      popupDescription: document.getElementById("popup-description"),
      popupSeasonSection: document.getElementById("popup-season-section"),
      popupSeasonStatus: document.getElementById("popup-season-status"),
      popupSeasonTabs: document.getElementById("popup-season-tabs"),
      popupSeasonCopy: document.getElementById("popup-season-copy"),
      popupSummary: document.getElementById("popup-summary"),
      popupHighlights: document.getElementById("popup-highlights"),
      popupFact: document.getElementById("popup-fact"),
      popupCoordinates: document.getElementById("popup-coordinates"),
      popupRouteFromButton: document.getElementById("popup-route-from"),
      popupFavoriteButton: document.getElementById("popup-favorite-toggle"),
      popupShareButton: document.getElementById("popup-share"),
      popupDeletePlaceButton: document.getElementById("popup-delete-place"),
      popupNavigation: document.getElementById("popup-navigation"),
      popupPreviousPlaceButton: document.getElementById("popup-prev-place"),
      popupNextPlaceButton: document.getElementById("popup-next-place"),
      popupStatusWantButton: document.getElementById("popup-status-want"),
      popupStatusVisitedButton: document.getElementById("popup-status-visited"),
      popupRatingStars: document.getElementById("popup-rating-stars"),
      popupReviewComment: document.getElementById("popup-review-comment"),
      popupReviewSaveButton: document.getElementById("popup-review-save"),
      popupFeedbackAuthHint: document.getElementById("popup-feedback-auth-hint"),
      popupCommunityAverage: document.getElementById("popup-community-average"),
      popupCommunityCount: document.getElementById("popup-community-count"),
      popupCommunityReviews: document.getElementById("popup-community-reviews"),
      popupActions: document.getElementById("popup-actions"),
      popupSources: document.getElementById("popup-sources"),
      popupSourcesInfo: document.getElementById("popup-sources-info"),
      popupUpdated: document.getElementById("popup-updated"),
      popupLinkRow: document.getElementById("popup-link-row"),
      popupLink: document.getElementById("popup-link"),
      popupWeatherSection: document.getElementById("popup-weather-section"),
      popupWeatherStatus: document.getElementById("popup-weather-status"),
      popupWeatherIcon: document.getElementById("popup-weather-icon"),
      popupWeatherTemp: document.getElementById("popup-weather-temp"),
      popupWeatherCondition: document.getElementById("popup-weather-condition"),
      popupWeatherLocal: document.getElementById("popup-weather-local"),
      popupWeatherMeta: document.getElementById("popup-weather-meta"),
      popupWeatherUpdated: document.getElementById("popup-weather-updated"),
      onboardingOverlay: document.getElementById("onboarding-overlay"),
      onboardingPanel: document.getElementById("onboarding-panel"),
      onboardingStep: document.getElementById("onboarding-step"),
      onboardingTitle: document.getElementById("onboarding-title"),
      onboardingText: document.getElementById("onboarding-text"),
      onboardingNextButton: document.getElementById("onboarding-next"),
      onboardingSkipButton: document.getElementById("onboarding-skip"),
      onboardingNeverCheckbox: document.getElementById("onboarding-never"),
      appToast: document.getElementById("app-toast"),
      userBannedOverlay: document.getElementById("user-banned-overlay"),
      userBannedMessage: document.getElementById("user-banned-message")
    };

    const missing = Object.entries(elements)
      .filter(([, value]) => !(value instanceof HTMLElement))
      .map(([key]) => key);

    if (missing.length > 0) {
      throw new Error(`Missing required DOM elements: ${missing.join(", ")}`);
    }

    return elements;
  }

  function isValidPlace(place) {
    if (!place || typeof place !== "object") {
      return false;
    }

    if (typeof place.id !== "string" || place.id.trim() === "") {
      return false;
    }

    if (typeof place.name !== "string" || place.name.trim() === "") {
      return false;
    }

    if (typeof place.description !== "string" || place.description.trim() === "") {
      return false;
    }

    if (Object.prototype.hasOwnProperty.call(place, "image")) {
      const normalizedImage = normalizeHttpUrl(place.image);
      if (place.image !== "" && !normalizedImage) {
        return false;
      }
    }

    const optionalTextFields = [
      "country",
      "countryCode",
      "timezone",
      "utcOffset",
      "utc_offset",
      "climate",
      "currency",
      "founded",
      "funFact"
    ];

    for (const field of optionalTextFields) {
      if (!Object.prototype.hasOwnProperty.call(place, field)) {
        continue;
      }

      const value = place[field];
      if (value !== null && value !== "" && typeof value !== "string") {
        return false;
      }
    }

    if (Object.prototype.hasOwnProperty.call(place, "languages")) {
      const languages = place.languages;
      const isValidLanguages =
        languages === null ||
        languages === "" ||
        typeof languages === "string" ||
        (
          Array.isArray(languages) &&
          languages.every((item) => typeof item === "string")
        );
      if (!isValidLanguages) {
        return false;
      }
    }

    if (Object.prototype.hasOwnProperty.call(place, "population")) {
      const population = place.population;
      if (
        population !== null &&
        population !== "" &&
        (!Number.isFinite(Number(population)) || Number(population) <= 0)
      ) {
        return false;
      }
    }

    if (Object.prototype.hasOwnProperty.call(place, "areaKm2")) {
      const areaKm2 = place.areaKm2;
      if (
        areaKm2 !== null &&
        areaKm2 !== "" &&
        (!Number.isFinite(Number(areaKm2)) || Number(areaKm2) <= 0)
      ) {
        return false;
      }
    }

    if (Object.prototype.hasOwnProperty.call(place, "area_km2")) {
      const areaKm2 = place.area_km2;
      if (
        areaKm2 !== null &&
        areaKm2 !== "" &&
        (!Number.isFinite(Number(areaKm2)) || Number(areaKm2) <= 0)
      ) {
        return false;
      }
    }

    if (Object.prototype.hasOwnProperty.call(place, "highlights")) {
      if (!Array.isArray(place.highlights)) {
        return false;
      }

      if (!place.highlights.every((item) => typeof item === "string")) {
        return false;
      }
    }

    const lat = Number(place.lat);
    const lon = Number(place.lon);

    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      return false;
    }

    if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
      return false;
    }

    return true;
  }

  function normalizeView(value, fallback) {
    const lat = Number(value?.lat);
    const lng = Number(value?.lng);
    const zoom = Number(value?.zoom);

    if (
      Number.isFinite(lat) && lat >= -90 && lat <= 90 &&
      Number.isFinite(lng) && lng >= -180 && lng <= 180 &&
      Number.isFinite(zoom) && zoom >= Config.MIN_ZOOM && zoom <= Config.MAX_ZOOM
    ) {
      return { lat, lng, zoom };
    }

    return {
      lat: fallback.lat,
      lng: fallback.lng,
      zoom: fallback.zoom
    };
  }

  function parseJsonResponse(response) {
    return response
      .text()
      .then((text) => {
        if (!text) {
          return null;
        }

        try {
          return JSON.parse(text);
        } catch {
          return null;
        }
      });
  }

  function buildUrl(basePath, query) {
    const url = new URL(basePath, window.location.origin);

    if (!query || typeof query !== "object") {
      return url.toString();
    }

    for (const [key, value] of Object.entries(query)) {
      if (value === null || value === undefined) {
        continue;
      }

      const text = String(value).trim();
      if (text === "") {
        continue;
      }

      url.searchParams.set(key, text);
    }

    return `${url.pathname}${url.search}`;
  }

  function formatCoordinates(lat, lon) {
    return `Координаты: ${Number(lat).toFixed(4)}, ${Number(lon).toFixed(4)}`;
  }

  function formatPopulation(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return "—";
    }

    return new Intl.NumberFormat("ru-RU").format(Math.round(numeric));
  }

  function formatCountryLine(place) {
    const country = normalizeText(place?.country, "");
    const countryCode = normalizeText(place?.countryCode, "");
    const flag = resolveCountryFlagEmoji(countryCode);

    if (country && countryCode) {
      return `${flag} ${country} (${countryCode})`;
    }

    if (country) {
      return `${flag} ${country}`;
    }

    if (countryCode) {
      return `${flag} ${countryCode}`;
    }

    return "🌍 —";
  }

  function resolveCountryFlagEmoji(countryCode) {
    const normalized = normalizeText(countryCode, "")
      .toUpperCase()
      .replace(/[^A-Z]/g, "")
      .slice(0, 2);

    if (normalized.length !== 2) {
      return "🌍";
    }

    const offset = 127397;
    return String.fromCodePoint(
      normalized.charCodeAt(0) + offset,
      normalized.charCodeAt(1) + offset
    );
  }

  function computeFlyDurationSeconds(map, targetLatLng, targetZoom) {
    if (!map || !targetLatLng) {
      return Config.FLY_DURATION_MIN_S;
    }

    const currentCenter = map.getCenter();
    const distanceMeters = map.distance(currentCenter, targetLatLng);
    const distanceKm = distanceMeters / 1000;
    const zoomDelta = Math.abs(Number(map.getZoom()) - Number(targetZoom));

    const distancePart = Math.min(distanceKm / Config.FLY_DISTANCE_FACTOR_KM, 1.25);
    const zoomPart = zoomDelta * Config.FLY_ZOOM_FACTOR_S;
    const rawDuration = Config.FLY_DURATION_MIN_S + distancePart + zoomPart;

    return clamp(rawDuration, Config.FLY_DURATION_MIN_S, Config.FLY_DURATION_MAX_S);
  }

  function computeFlyEaseLinearity(map, targetLatLng) {
    if (!map || !targetLatLng) {
      return Config.FLY_EASE_NEAR;
    }

    const currentCenter = map.getCenter();
    const distanceMeters = map.distance(currentCenter, targetLatLng);
    const distanceKm = Math.max(0, distanceMeters / 1000);
    const ratio = clamp(distanceKm / Config.FLY_EASE_DISTANCE_KM, 0, 1);

    const eased =
      Config.FLY_EASE_NEAR +
      ((Config.FLY_EASE_FAR - Config.FLY_EASE_NEAR) * ratio);

    return clamp(eased, 0.1, 0.3);
  }

  function formatDistance(distanceMeters) {
    const distance = Number(distanceMeters);
    if (!Number.isFinite(distance) || distance <= 0) {
      return "—";
    }

    if (distance < 1000) {
      return `${Math.round(distance)} м`;
    }

    return `${(distance / 1000).toFixed(1)} км`;
  }

  function formatDuration(durationSeconds) {
    const duration = Number(durationSeconds);
    if (!Number.isFinite(duration) || duration <= 0) {
      return "—";
    }

    const roundedMinutes = Math.max(1, Math.round(duration / 60));
    const hours = Math.floor(roundedMinutes / 60);
    const minutes = roundedMinutes % 60;

    if (hours === 0) {
      return `${minutes} мин`;
    }

    if (minutes === 0) {
      return `${hours} ч`;
    }

    return `${hours} ч ${minutes} мин`;
  }

  function estimateDurationByDistance(distanceMeters) {
    const distanceKm = Number(distanceMeters) / 1000;
    if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
      return null;
    }

    const durationHours = distanceKm / Config.ROUTE_DIRECT_SPEED_KMPH;
    return durationHours * 3600;
  }

  function haversineDistanceMeters(latA, lonA, latB, lonB) {
    const earthRadiusMeters = 6_371_000;
    const latARadians = toRadians(latA);
    const latBRadians = toRadians(latB);
    const deltaLat = toRadians(latB - latA);
    const deltaLon = toRadians(lonB - lonA);

    const hav =
      Math.sin(deltaLat / 2) ** 2 +
      Math.cos(latARadians) * Math.cos(latBRadians) * Math.sin(deltaLon / 2) ** 2;
    const centralAngle = 2 * Math.atan2(Math.sqrt(hav), Math.sqrt(1 - hav));

    return earthRadiusMeters * centralAngle;
  }

  function toRadians(value) {
    return (Number(value) * Math.PI) / 180;
  }

  function getPlaceImageUrl(place) {
    if (!place || typeof place !== "object") {
      return null;
    }

    const directImage = normalizeHttpUrl(place.image ?? place.image_url);
    if (directImage) {
      return directImage;
    }

    const seasonalView = buildPlaceSeasonView(
      place,
      normalizeSeasonKey(place.active_season, resolveCurrentSeasonKey())
    );
    return normalizeHttpUrl(seasonalView?.image ?? seasonalView?.image_url);
  }

  function getPopupImageCandidates(rawUrl, maxWidthPx = 1200) {
    const safeUrl = normalizeHttpUrl(rawUrl);
    if (!safeUrl) {
      return [];
    }

    const candidates = [safeUrl];

    try {
      const parsedUrl = new URL(safeUrl);
      const host = parsedUrl.hostname.toLowerCase();
      const width = clamp(Math.round(Number(maxWidthPx) || 1200), 640, 1400);

      if (host.endsWith("upload.wikimedia.org")) {
        const wikiCandidates = buildWikimediaImageCandidates(parsedUrl, width);
        for (const candidate of wikiCandidates) {
          if (!candidates.includes(candidate)) {
            candidates.unshift(candidate);
          }
        }
      }
    } catch {
      return [safeUrl];
    }

    return candidates;
  }

  function buildWikimediaImageCandidates(parsedUrl, width) {
    const pathname = parsedUrl.pathname;
    const marker = "/wikipedia/commons/";
    if (!pathname.startsWith(marker)) {
      return [];
    }

    const relative = pathname.slice(marker.length);
    const segments = relative.split("/").filter(Boolean);
    if (segments.length < 3) {
      return [];
    }

    let hashA = "";
    let hashB = "";
    let fileName = "";

    if (segments[0] === "thumb") {
      if (segments.length < 5) {
        return [];
      }
      hashA = segments[1];
      hashB = segments[2];
      fileName = segments[3];
    } else {
      hashA = segments[0];
      hashB = segments[1];
      fileName = segments[2];
    }

    const decodedFileName = decodeURIComponent(fileName);
    const encodedFileName = encodeURIComponent(decodedFileName);
    const thumbPath =
      `${marker}thumb/${hashA}/${hashB}/${encodedFileName}/${width}px-${encodedFileName}`;
    const webpPath = `${thumbPath}.webp`;

    return [
      `${parsedUrl.origin}${webpPath}`,
      `${parsedUrl.origin}${thumbPath}`
    ];
  }

  function getPlaceInitials(placeName) {
    const normalized = normalizeText(placeName, "Локация");
    const words = normalized
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2);

    if (words.length === 0) {
      return "WP";
    }

    return words
      .map((word) => word[0].toUpperCase())
      .join("");
  }

  function resolvePlaceCategory(place) {
    const kindRaw = normalizeText(place?.kind || place?.type, "").toLowerCase();
    const regionRaw = normalizeText(place?.region, "").toLowerCase();
    const haystack = `${kindRaw} ${regionRaw}`.trim();

    if (haystack.includes("природ") || haystack.includes("nature")) {
      return {
        key: "nature",
        tone: "nature",
        label: "Природа",
        icon: "🌿"
      };
    }

    if (
      haystack.includes("культур") ||
      haystack.includes("culture") ||
      haystack.includes("истор")
    ) {
      return {
        key: "culture",
        tone: "culture",
        label: "Культура",
        icon: "🏛️"
      };
    }

    return {
      key: "city",
      tone: "city",
      label: "Город",
      icon: "🏙️"
    };
  }

  function getRegionHue(region) {
    const normalizedRegion = normalizeText(region, "world").toLowerCase();
    const hash = hashString(normalizedRegion);

    return (Math.abs(hash) % 250) + 20;
  }

  function hashString(value) {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
      hash = ((hash << 5) - hash) + value.charCodeAt(index);
      hash |= 0;
    }
    return hash;
  }

  function normalizeMediaUrl(rawUrl) {
    if (typeof rawUrl !== "string" || rawUrl.trim() === "") {
      return null;
    }

    try {
      const parsedUrl = new URL(rawUrl.trim(), window.location.origin);
      if (parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:") {
        return parsedUrl.href;
      }
      return null;
    } catch {
      return null;
    }
  }

  function normalizeHttpUrl(rawUrl) {
    if (typeof rawUrl !== "string" || rawUrl.trim() === "") {
      return null;
    }

    try {
      const parsedUrl = new URL(rawUrl.trim());
      if (parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:") {
        return sanitizeKnownImageUrl(parsedUrl.href);
      }
      return null;
    } catch {
      return null;
    }
  }

  function sanitizeKnownImageUrl(url) {
    const safeUrl = normalizeText(url, "");
    if (safeUrl.includes("Puerto_Madero_-_Puente_de_la_mujer")) {
      return "https://images.unsplash.com/photo-1589909202802-8f4aadce1849?w=800&h=500&fit=crop&q=80";
    }
    return safeUrl;
  }

  function normalizeIsoTimestamp(value) {
    const normalized = normalizeText(value, "");
    if (!normalized) {
      return "";
    }
    const timestamp = Date.parse(normalized);
    return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : "";
  }

  function normalizeToTimestamp(value) {
    return normalizeIsoTimestamp(value);
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

  function parseFloatValue(rawValue, min, max) {
    const numeric = Number(rawValue);
    if (!Number.isFinite(numeric)) {
      return null;
    }

    if (numeric < min || numeric > max) {
      return null;
    }

    return numeric;
  }

  function round(value, digits) {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
  }

  function clamp(value, minValue, maxValue) {
    return Math.min(maxValue, Math.max(minValue, value));
  }

  function truncate(value, maxLength) {
    if (value.length <= maxLength) {
      return value;
    }

    return `${value.slice(0, maxLength - 1)}…`;
  }

  function debounce(callback, delayMs) {
    let timeoutId = null;

    return function debounced(...args) {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }

      timeoutId = window.setTimeout(() => {
        timeoutId = null;
        callback(...args);
      }, delayMs);
    };
  }
})();
