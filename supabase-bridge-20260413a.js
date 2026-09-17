(() => {
  "use strict";

  const PANEL_CLOSE_DELAY_MS = 240;
  const SUPABASE_READY_TIMEOUT_MS = 12000;
  const ADMIN_AUTH_CHANGED_EVENT_NAME = "worldatlas:admin-auth-changed";
  const ADMIN_QUEUE_LIMIT = 180;
  const ADMIN_REVIEWS_LIMIT = 100;
  const PLACE_SUBMISSIONS_TABLE = "place_submissions";
  const USER_NOTIFICATIONS_TABLE = "user_notifications";
  const ADMIN_PLACE_QUEUE_VIEW = "admin_place_review_queue";
  const ONLINE_PRESENCE_VIEW = "admin_live_presence";
  const ONLINE_STATUS_REALTIME_CHANNEL = "online-user-status";
  const ONLINE_STATUS_TABLE = "user_status";
  const VISITOR_STATUS_TABLE = "visitor_status";
  const USER_BANS_TABLE = "user_bans";
  const USER_FREEZES_TABLE = "user_freezes";
  const VISITOR_BANS_TABLE = "visitor_bans";
  const ADMIN_NOTES_TABLE = "admin_notes";
  const ADMIN_ACTION_LOGS_TABLE = "admin_action_logs";
  const ONLINE_STATUS_KNOWN_USERS_KEY = "worldAtlasPro.onlineStatus.knownUsers.v1";
  const ONLINE_BANS_CACHE_TTL_MS = 15000;
  const ONLINE_CAPABILITIES_CACHE_TTL_MS = 60000;
  const ONLINE_ACTION_REASON = "Admin panel moderation";
  const ONLINE_ACTIVE_WINDOW_MS = 45000;
  const ONLINE_HEARTBEAT_VISIBLE_MS = 12000;
  const ONLINE_HEARTBEAT_HIDDEN_MS = 30000;
  const VISITOR_HEARTBEAT_VISIBLE_MS = 12000;
  const VISITOR_HEARTBEAT_HIDDEN_MS = 30000;
  const ONLINE_STATUS_CACHE_TTL_MS = 4000;
  const ONLINE_REALTIME_REFRESH_DEBOUNCE_MS = 350;
  const ONLINE_RECONNECT_BASE_MS = 1200;
  const ONLINE_RECONNECT_MAX_MS = 30000;
  const ONLINE_RECONNECT_JITTER_MS = 450;
  const VISITOR_ID_STORAGE_KEY = "worldAtlasPro.visitor.id.v1";
  const VISITOR_NAME_STORAGE_KEY = "worldAtlasPro.visitor.name.v1";
  const VISITOR_ACCESS_EVENT_NAME = "worldatlas:visitor-access-changed";
  const VISITOR_PING_PATH = "/api/visitor/ping";
  const USER_PING_PATH = "/api/user/ping";
  const REGISTER_PATH = "/api/register";
  const SESSION_SYNC_PATH = "/api/session/sync";
  const ACCESS_STATE_PATH = "/api/access-state";
  const SERVER_ACCESS_REFRESH_EVENT_NAME = "worldatlas:server-access-refresh";
  const PLACES_MUTATED_EVENT_NAME = "worldatlas:places-mutated";
  const USER_BAN_REALTIME_CHANNEL_PREFIX = "user-ban-watch";
  const USER_FREEZE_REALTIME_CHANNEL_PREFIX = "user-freeze-watch";
  const DEFAULT_BAN_REASON = "Blocked by admin";
  const DEFAULT_FREEZE_REASON = "Read-only mode enabled by admin";
  const ADMIN_GEO_LIMIT = 220;
  const USER_NOTIFICATION_POLL_MS = 45000;
  const BAN_REASON_TEMPLATES = Object.freeze([
    "Spam / abuse",
    "Fake content",
    "Harassment / toxic behavior",
    "Mass low-quality activity"
  ]);
  const FREEZE_REASON_TEMPLATES = Object.freeze([
    "Needs manual review",
    "Suspicious activity spike",
    "Temporary read-only moderation",
    "Wait for admin verification"
  ]);

  const realtimeDiagnosticsClients = new WeakSet();

  const ui = getAuthUiElements();
  if (!ui) {
    console.warn("[supabase-bridge] Auth UI elements are not found.");
    return;
  }
  const adminUi = getAdminUiElements();

  const state = {
    isPanelOpen: false,
    isAdminDrawerOpen: false,
    isAdmin: false,
    closeTimerId: null,
    busy: false,
    session: null,
    client: null,
    pendingConfirmationEmail: "",
    sessionSyncToken: 0,
    banLogoutInFlight: false
  };

  const adminPresenceState = {
    currentUser: null,
    isAdmin: false,
    client: null,
    authSubscription: null,
    authCallbacks: new Set(),
    initialized: false,
    resolvedAdminForUserId: "",
    supportsActiveAdminRpc: null,
    selfBanChannel: null,
    selfFreezeChannel: null
  };

  const adminOnlineState = {
    activeTab: "queue",
    statusRows: [],
    statusRowsFetchedAt: 0,
    realtimeChannel: null,
    realtimeStatus: "idle",
    trackedUserId: "",
    reconnectTimerId: null,
    reconnectAttempt: 0,
    heartbeatTimerId: null,
    realtimeRefreshTimerId: null,
    shouldMaintainPresence: false,
    fallbackMode: false,
    fallbackReason: "",
    fallbackNoticeAt: 0,
    bansCacheMap: new Map(),
    bansCacheKey: "",
    bansCacheExpiresAt: 0,
    capabilitiesCheckedAt: 0,
    supportsTimedVisitorBans: null,
    presenceViewSupportsExtendedFields: null,
    renderToken: 0,
    pendingAction: null,
    selectedPresenceKey: "",
    displayOrder: []
  };

  const adminOpsState = {
    loadingDossier: false,
    dossierToken: 0,
    selectedTarget: null,
    selectedGeoRowIndex: -1,
    dossier: null,
    geoRows: [],
    geoFilteredRows: [],
    geoLoaded: false,
    geoLoading: false,
    geoToken: 0,
    commandBusy: false,
    noteBusy: false,
    geoFilters: {
      query: "",
      source: "all",
      onlyNew: false,
      onlySuspicious: false,
      onlyNoPhoto: false,
      onlyNoDescription: false
    }
  };

  const adminReviewsState = {
    loaded: false,
    loading: false,
    loadToken: 0,
    searchQuery: "",
    allReviews: [],
    visibleReviews: []
  };

  const adminQueueState = {
    loaded: false,
    loading: false,
    loadToken: 0,
    searchQuery: "",
    stateFilter: "pending",
    rows: [],
    visibleRows: [],
    audienceRows: [],
    stats: null
  };

  const userNotificationState = {
    lastReadAt: 0,
    unreadIds: new Set(),
    timerId: null
  };

  const visitorPresenceState = {
    visitorId: "",
    displayName: "",
    heartbeatTimerId: null,
    initialized: false,
    requestToken: 0,
    accessState: {
      userId: "",
      visitorId: "",
      displayName: "",
      isBanned: false,
      isUserBanned: false,
      isVisitorBanned: false,
      source: "",
      reason: "",
      bannedAt: "",
      bannedUntil: "",
      isPermanent: false,
      isFrozen: false,
      freezeReason: "",
      frozenAt: "",
      frozenUntil: "",
      isFreezePermanent: false,
      checkedAt: "",
      lastSeenAt: "",
      role: "guest"
    }
  };

  bindEvents();
  updateAdminUI(null);
  initAdminPanelUi();
  registerAdminPresenceApi();
  void init();

  async function init() {
    let client;
    try {
      client = await waitForSupabaseClient(SUPABASE_READY_TIMEOUT_MS);
      if (!client) {
        throw new Error("Supabase client is not available.");
      }
      state.client = client;
      logSupabaseClientConfig(client);
      installRealtimeDiagnostics(client);
    } catch (error) {
      console.error("[supabase-bridge] Failed to resolve Supabase client:", error);
      showMessage("Auth service is unavailable.", "error");
      disableAuthActions(true);
      return;
    }

    window.WorldAtlasSupabase = Object.freeze({
      client,
      async getSession() {
        const result = await client.auth.getSession();
        return result?.data?.session || null;
      },
      async getUser() {
        const result = await client.auth.getUser();
        return result?.data?.user || null;
      },
      async isAuthenticated() {
        const session = await this.getSession();
        return Boolean(session?.user);
      },
      initAdminPresence,
      getIsAdmin,
      onAuthChanged,
      getAccessState,
      getAdminPresenceList,
      getAdminReviews,
      adminSoftDeleteReview,
      adminRestoreReview,
      adminDeletePlaceByRef: deletePlaceByReference,
      adminBanEmail,
      adminUnbanEmail
    });

    try {
      await initAdminPresence();
    } catch (error) {
      console.warn("[supabase-bridge] Admin & Presence init failed:", error);
    }

    try {
      const { data, error } = await client.auth.getSession();
      if (error) {
        showMessage(normalizeText(error.message, "Failed to get auth session."), "error");
      }

      state.session = data?.session || null;
      updateAdminUI(state.session?.user || null);
      renderAuthState();
      dispatchAuthChanged("initial-session", state.session);
      void initVisitorPresence();
      void syncUserNotifications();
      startUserNotificationPolling();
      void syncServerAccessState({
        session: state.session,
        reason: "initial-session"
      });
    } catch (error) {
      console.error("[supabase-bridge] init failed:", error);
      showMessage("Failed to initialize auth.", "error");
    }

    client.auth.onAuthStateChange((event, session) => {
      state.session = session || null;
      updateAdminUI(state.session?.user || null);
      renderAuthState();
      dispatchAuthChanged(event, session);
      void initVisitorPresence();
      void syncUserNotifications();
      startUserNotificationPolling();
      void syncServerAccessState({
        session: state.session,
        reason: event
      });
    });
  }

  function dispatchAuthChanged(event, session) {
    window.dispatchEvent(
      new CustomEvent("worldatlas:auth-changed", {
        detail: {
          event,
          session,
          isAdmin: adminPresenceState.isAdmin
        }
      })
    );
  }

  function dispatchPlacesMutated(detail = {}) {
    const payload = detail && typeof detail === "object" ? detail : {};
    window.dispatchEvent(
      new CustomEvent(PLACES_MUTATED_EVENT_NAME, {
        detail: payload
      })
    );
  }

  function handleAdminPlacesMutated(event) {
    const detail = event?.detail && typeof event.detail === "object"
      ? event.detail
      : {};
    const prunedLocally = pruneGeoModerationRows(detail);
    adminOpsState.geoLoaded = false;
    if (!state.isAdmin) {
      return;
    }
    if (adminOnlineState.activeTab === "ops" || prunedLocally) {
      void loadGeoModerationRows({ force: true });
    }
  }

  function pruneGeoModerationRows(detail = {}) {
    const currentRows = Array.isArray(adminOpsState.geoRows) ? adminOpsState.geoRows : [];
    if (currentRows.length === 0) {
      return false;
    }

    const removedIds = new Set(
      (Array.isArray(detail?.removedPlaceIds) ? detail.removedPlaceIds : [])
        .map((entry) => normalizeText(entry, ""))
        .filter(Boolean)
    );
    const removedRefs = new Set(
      (Array.isArray(detail?.removedPlaceRefs) ? detail.removedPlaceRefs : [])
        .map((entry) => normalizeText(entry, "").toLowerCase())
        .filter(Boolean)
    );
    if (removedIds.size === 0 && removedRefs.size === 0) {
      return false;
    }

    const nextRows = currentRows.filter((row) => {
      const rowId = normalizeText(row?.id, "");
      const rowSlug = normalizeText(row?.slug, "").toLowerCase();
      if (rowId && removedIds.has(rowId)) {
        return false;
      }
      if (rowId && removedRefs.has(rowId.toLowerCase())) {
        return false;
      }
      if (rowSlug && removedRefs.has(rowSlug)) {
        return false;
      }
      return true;
    });

    if (nextRows.length === currentRows.length) {
      return false;
    }

    adminOpsState.geoRows = nextRows;
    applyGeoFilters();
    return true;
  }

  function startUserNotificationPolling() {
    if (userNotificationState.timerId) {
      window.clearInterval(userNotificationState.timerId);
      userNotificationState.timerId = null;
    }

    const userId = normalizeText(state.session?.user?.id, "");
    if (!userId) {
      userNotificationState.unreadIds.clear();
      return;
    }

    userNotificationState.timerId = window.setInterval(() => {
      void syncUserNotifications();
    }, USER_NOTIFICATION_POLL_MS);
  }

  async function syncUserNotifications() {
    const userId = normalizeText(state.session?.user?.id, "");
    if (!userId || !state.client) {
      return;
    }

    try {
      const response = await state.client
        .from(USER_NOTIFICATIONS_TABLE)
        .select("id,title,body,created_at,is_read")
        .eq("user_id", userId)
        .eq("is_read", false)
        .order("created_at", { ascending: false })
        .limit(8);
      if (response?.error) {
        if (!isMissingRelationError(response.error)) {
          console.warn("[supabase-bridge] Failed to load user notifications:", response.error);
        }
        return;
      }

      const rows = Array.isArray(response?.data) ? response.data : [];
      rows.forEach((row) => {
        const notificationId = normalizeText(row?.id, "");
        if (!notificationId || userNotificationState.unreadIds.has(notificationId)) {
          return;
        }
        userNotificationState.unreadIds.add(notificationId);
        const toastText = [normalizeText(row?.title, "Update"), normalizeText(row?.body, "")]
          .filter(Boolean)
          .join(": ");
        if (window.WorldAtlasAppBridge?.showToast) {
          window.WorldAtlasAppBridge.showToast(toastText);
        } else {
          showMessage(toastText, "success");
        }
      });
    } catch (error) {
      console.warn("[supabase-bridge] Notification polling failed:", error);
    }
  }

  function bindEvents() {
    ui.toggleButton.addEventListener("click", () => {
      if (state.isPanelOpen) {
        closePanel();
      } else {
        openPanel();
      }
    });

    ui.closeButton.addEventListener("click", closePanel);

    ui.signInButton.addEventListener("click", async () => {
      await signIn();
    });

    ui.signUpButton.addEventListener("click", async () => {
      await signUp();
    });

    ui.signOutButton.addEventListener("click", async () => {
      await signOut();
    });

    if (ui.resendButton instanceof HTMLElement) {
      ui.resendButton.addEventListener("click", async () => {
        await resendConfirmation();
      });
    }

    if (adminUi.toggleButton instanceof HTMLElement) {
      adminUi.toggleButton.addEventListener("click", () => {
        if (!state.isAdmin) {
          return;
        }
        if (state.isAdminDrawerOpen) {
          closeAdminDrawer();
        } else {
          openAdminDrawer();
        }
      });
    }

    if (adminUi.closeButton instanceof HTMLElement) {
      adminUi.closeButton.addEventListener("click", closeAdminDrawer);
    }

    if (adminUi.backdrop instanceof HTMLElement) {
      adminUi.backdrop.addEventListener("click", closeAdminDrawer);
    }

    if (adminUi.tabReviews instanceof HTMLElement) {
      adminUi.tabReviews.addEventListener("click", () => {
        activateAdminTab("reviews");
      });
    }

    if (adminUi.tabQueue instanceof HTMLElement) {
      adminUi.tabQueue.addEventListener("click", () => {
        activateAdminTab("queue");
      });
    }

    if (adminUi.tabOnline instanceof HTMLElement) {
      adminUi.tabOnline.addEventListener("click", () => {
        activateAdminTab("online");
      });
    }

    if (adminUi.tabOps instanceof HTMLElement) {
      adminUi.tabOps.addEventListener("click", () => {
        activateAdminTab("ops");
      });
    }

    if (adminUi.onlineRefreshButton instanceof HTMLElement) {
      adminUi.onlineRefreshButton.addEventListener("click", () => {
        void refreshOnlineTab({ forceBans: true });
      });
    }

    if (adminUi.onlineList instanceof HTMLElement) {
      adminUi.onlineList.addEventListener("click", (event) => {
        void handleOnlineActionClick(event);
      });
      adminUi.onlineList.addEventListener("input", (event) => {
        handleOnlineReasonInput(event);
      });
    }

    if (adminUi.commandRunButton instanceof HTMLElement) {
      adminUi.commandRunButton.addEventListener("click", () => {
        void runAdminCommand();
      });
    }

    if (adminUi.commandInput instanceof HTMLInputElement) {
      adminUi.commandInput.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") {
          return;
        }
        event.preventDefault();
        void runAdminCommand();
      });
    }

    if (Array.isArray(adminUi.commandPresetButtons) && adminUi.commandPresetButtons.length > 0) {
      adminUi.commandPresetButtons.forEach((buttonEl) => {
        if (!(buttonEl instanceof HTMLButtonElement)) {
          return;
        }
        buttonEl.addEventListener("click", () => {
          applyCommandTemplate(buttonEl.dataset.adminCommandTemplate);
        });
      });
    }

    if (adminUi.noteSaveButton instanceof HTMLElement) {
      adminUi.noteSaveButton.addEventListener("click", () => {
        void saveAdminNote();
      });
    }

    if (adminUi.geoRefreshButton instanceof HTMLElement) {
      adminUi.geoRefreshButton.addEventListener("click", () => {
        void refreshOpsTab({ forceGeo: true, forceDossier: true });
      });
    }

    if (adminUi.geoSearchInput instanceof HTMLInputElement) {
      adminUi.geoSearchInput.addEventListener("input", () => {
        adminOpsState.geoFilters.query = normalizeText(adminUi.geoSearchInput.value, "");
        applyGeoFilters();
      });
    }

    if (adminUi.geoSourceSelect instanceof HTMLSelectElement) {
      adminUi.geoSourceSelect.addEventListener("change", () => {
        adminOpsState.geoFilters.source = normalizeText(adminUi.geoSourceSelect.value, "all");
        applyGeoFilters();
      });
    }

    bindAdminFilterChip(adminUi.geoFilterNewButton, "onlyNew");
    bindAdminFilterChip(adminUi.geoFilterSuspiciousButton, "onlySuspicious");
    bindAdminFilterChip(adminUi.geoFilterNoPhotoButton, "onlyNoPhoto");
    bindAdminFilterChip(adminUi.geoFilterNoDescriptionButton, "onlyNoDescription");

    if (adminUi.dossierCard instanceof HTMLElement) {
      adminUi.dossierCard.addEventListener("click", (event) => {
        void handleDossierActionClick(event);
      });
    }

    if (adminUi.geoList instanceof HTMLElement) {
      adminUi.geoList.addEventListener("click", (event) => {
        void handleGeoListActionClick(event);
      });
    }

    if (adminUi.geoMap instanceof HTMLElement) {
      adminUi.geoMap.addEventListener("click", (event) => {
        void handleGeoMapActionClick(event);
      });
    }

    if (adminUi.reviewsSearchInput instanceof HTMLInputElement) {
      adminUi.reviewsSearchInput.addEventListener("input", () => {
        applyReviewsSearchFilter(adminUi.reviewsSearchInput.value, { commitInput: false });
      });
    }

    if (adminUi.reviewsList instanceof HTMLElement) {
      adminUi.reviewsList.addEventListener("click", (event) => {
        void handleReviewActionClick(event);
      });
    }

    if (adminUi.queueRefreshButton instanceof HTMLElement) {
      adminUi.queueRefreshButton.addEventListener("click", () => {
        void refreshQueueTab({ force: true });
      });
    }

    if (adminUi.queueSearchInput instanceof HTMLInputElement) {
      adminUi.queueSearchInput.addEventListener("input", () => {
        adminQueueState.searchQuery = normalizeText(adminUi.queueSearchInput.value, "");
        applyQueueFilters();
      });
    }

    if (adminUi.queueStateSelect instanceof HTMLSelectElement) {
      adminUi.queueStateSelect.addEventListener("change", () => {
        adminQueueState.stateFilter = normalizeText(adminUi.queueStateSelect.value, "pending");
        applyQueueFilters();
      });
    }

    if (adminUi.submissionsList instanceof HTMLElement) {
      adminUi.submissionsList.addEventListener("click", (event) => {
        void handleQueueActionClick(event);
      });
    }

    ui.authForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (state.session?.user) {
        await signOut();
        return;
      }
      await signIn();
    });

    document.addEventListener("keydown", (event) => {
      if (!state.isPanelOpen) {
        if (state.isAdminDrawerOpen && event.key === "Escape") {
          event.preventDefault();
          closeAdminDrawer();
        }
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        closePanel();
      }
    });

    document.addEventListener(
      "pointerdown",
      (event) => {
        if (!state.isPanelOpen) {
          return;
        }

        const target = event.target;
        if (!(target instanceof Element)) {
          return;
        }

        if (ui.panel.contains(target) || ui.toggleButton.contains(target)) {
          return;
        }

        closePanel();
      },
      true
    );

    if (ui.resendButton instanceof HTMLElement) {
      ui.resendButton.hidden = true;
      ui.resendButton.disabled = true;
    }

    const unloadPresenceHandler = () => {
      adminOnlineState.shouldMaintainPresence = false;
      clearOnlinePresenceReconnectTimer();
      clearOnlinePresenceHeartbeat();
      clearOnlineRealtimeRefreshTimer();
      clearVisitorPresenceHeartbeat();
      if (userNotificationState.timerId) {
        window.clearInterval(userNotificationState.timerId);
        userNotificationState.timerId = null;
      }
      void stopOnlinePresence({ skipRender: true, preserveFallback: true });
    };
    const refreshAccessHandler = () => {
      if (document.visibilityState === "hidden") {
        return;
      }
      startVisitorPresenceHeartbeat({ immediate: true });
      void syncServerAccessState({
        session: state.session,
        reason: "visibility"
      });
    };
    document.addEventListener("visibilitychange", handleOnlineVisibilityChange);
    document.addEventListener("visibilitychange", refreshAccessHandler);
    window.addEventListener(PLACES_MUTATED_EVENT_NAME, handleAdminPlacesMutated);
    window.addEventListener("focus", refreshAccessHandler, { passive: true });
    window.addEventListener("beforeunload", unloadPresenceHandler);
    window.addEventListener("pagehide", unloadPresenceHandler);
  }

  function openPanel() {
    if (state.closeTimerId) {
      window.clearTimeout(state.closeTimerId);
      state.closeTimerId = null;
    }

    state.isPanelOpen = true;
    ui.panel.hidden = false;
    ui.toggleButton.setAttribute("aria-expanded", "true");

    requestAnimationFrame(() => {
      ui.panel.classList.add("is-open");
    });
  }

  function closePanel() {
    state.isPanelOpen = false;
    ui.toggleButton.setAttribute("aria-expanded", "false");
    ui.panel.classList.remove("is-open");

    if (state.closeTimerId) {
      window.clearTimeout(state.closeTimerId);
    }

    state.closeTimerId = window.setTimeout(() => {
      state.closeTimerId = null;
      if (!state.isPanelOpen) {
        ui.panel.hidden = true;
      }
    }, PANEL_CLOSE_DELAY_MS);
  }

  function openAdminDrawer() {
    if (!state.isAdmin) {
      return;
    }

    if (!(adminUi.drawer instanceof HTMLElement) || !(adminUi.backdrop instanceof HTMLElement)) {
      return;
    }

    state.isAdminDrawerOpen = true;
    adminUi.toggleButton?.setAttribute("aria-expanded", "true");
    adminUi.drawer.hidden = false;
    adminUi.backdrop.hidden = false;
    document.body.classList.add("admin-drawer-open");

    requestAnimationFrame(() => {
      adminUi.drawer.classList.add("is-open");
      adminUi.backdrop.classList.add("is-open");
    });

    void onAdminDrawerOpened();
  }

  function closeAdminDrawer() {
    state.isAdminDrawerOpen = false;

    if (adminUi.toggleButton instanceof HTMLElement) {
      adminUi.toggleButton.setAttribute("aria-expanded", "false");
    }

    if (adminUi.drawer instanceof HTMLElement) {
      adminUi.drawer.classList.remove("is-open");
      adminUi.drawer.hidden = true;
    }

    if (adminUi.backdrop instanceof HTMLElement) {
      adminUi.backdrop.classList.remove("is-open");
      adminUi.backdrop.hidden = true;
    }

    document.body.classList.remove("admin-drawer-open");
  }

  function updateAdminUI(user, isAdminOverride = null) {
    const hasUser = Boolean(normalizeText(user?.id, "") || normalizeText(user?.email, ""));
    const isAdmin = hasUser
      ? (
        typeof isAdminOverride === "boolean"
          ? isAdminOverride
          : Boolean(adminPresenceState.isAdmin)
      )
      : false;
    state.isAdmin = isAdmin;
    adminPresenceState.isAdmin = isAdmin;

    document.body.dataset.admin = isAdmin ? "true" : "false";
    document.body.classList.toggle("is-admin", isAdmin);

    if (adminUi.toggleButton instanceof HTMLElement) {
      adminUi.toggleButton.hidden = !isAdmin;
      if (!isAdmin) {
        adminUi.toggleButton.setAttribute("aria-expanded", "false");
      }
    }

    if (adminUi.drawer instanceof HTMLElement) {
      adminUi.drawer.style.display = isAdmin ? "" : "none";
    }

    if (adminUi.backdrop instanceof HTMLElement) {
      adminUi.backdrop.style.display = isAdmin ? "" : "none";
    }

    if (!isAdmin) {
      closeAdminDrawer();
      resetReviewsUiState();
      resetQueueUiState();
      activateAdminTab("queue");
    }

    console.log("Logged in as:", user?.email, "isAdmin:", isAdmin);
    return isAdmin;
  }

  // ADMIN ONLINE / PRESENCE
  function initAdminPanelUi() {
    activateAdminTab(adminOnlineState.activeTab, {
      renderQueue: false,
      renderOnline: false,
      renderReviews: false,
      renderOps: false
    });

    if (adminUi.onlineCountValue instanceof HTMLElement) {
      adminUi.onlineCountValue.textContent = "0";
    }

    if (adminUi.onlineList instanceof HTMLElement) {
      renderOnlineEmptyState("No users online");
    }

    renderReviewsEmptyState("Open Reviews tab to load data.");
    renderQueueEmptyState("Open Queue tab to load point review requests.");
    renderCommandStatus("");
    renderOpsEmptyState("Choose a user from Online or use the command bar.");
    renderNotesEmptyState("Notes will appear here.");
    renderGeoEmptyState("Open Ops tab to load moderation map.");
  }

  async function onAdminDrawerOpened() {
    if (adminOnlineState.activeTab === "queue") {
      await refreshQueueTab({ force: true });
      return;
    }
    if (adminOnlineState.activeTab === "online") {
      await refreshOnlineTab({ forceBans: true });
      return;
    }
    if (adminOnlineState.activeTab === "ops") {
      await refreshOpsTab({ forceGeo: true, forceDossier: true });
      return;
    }
    await refreshReviewsTab({ force: true });
  }

  function activateAdminTab(tabName, options = {}) {
    const rawTab = normalizeText(tabName, "").toLowerCase();
    const safeTab = rawTab === "queue"
      ? "queue"
      : (rawTab === "online"
        ? "online"
        : (rawTab === "ops" ? "ops" : "reviews"));
    const isQueue = safeTab === "queue";
    const isOnline = safeTab === "online";
    const isOps = safeTab === "ops";

    adminOnlineState.activeTab = safeTab;

    if (adminUi.tabQueue instanceof HTMLElement) {
      adminUi.tabQueue.classList.toggle("is-active", isQueue);
      adminUi.tabQueue.setAttribute("aria-selected", isQueue ? "true" : "false");
      adminUi.tabQueue.setAttribute("tabindex", isQueue ? "0" : "-1");
    }

    if (adminUi.tabReviews instanceof HTMLElement) {
      adminUi.tabReviews.classList.toggle("is-active", !isQueue && !isOnline && !isOps);
      adminUi.tabReviews.setAttribute("aria-selected", (!isQueue && !isOnline && !isOps) ? "true" : "false");
      adminUi.tabReviews.setAttribute("tabindex", (!isQueue && !isOnline && !isOps) ? "0" : "-1");
    }

    if (adminUi.tabOnline instanceof HTMLElement) {
      adminUi.tabOnline.classList.toggle("is-active", isOnline);
      adminUi.tabOnline.setAttribute("aria-selected", isOnline ? "true" : "false");
      adminUi.tabOnline.setAttribute("tabindex", isOnline ? "0" : "-1");
    }

    if (adminUi.tabOps instanceof HTMLElement) {
      adminUi.tabOps.classList.toggle("is-active", isOps);
      adminUi.tabOps.setAttribute("aria-selected", isOps ? "true" : "false");
      adminUi.tabOps.setAttribute("tabindex", isOps ? "0" : "-1");
    }

    if (adminUi.panelQueue instanceof HTMLElement) {
      adminUi.panelQueue.hidden = !isQueue;
      adminUi.panelQueue.classList.toggle("is-active", isQueue);
    }

    if (adminUi.panelReviews instanceof HTMLElement) {
      adminUi.panelReviews.hidden = isQueue || isOnline || isOps;
      adminUi.panelReviews.classList.toggle("is-active", !isQueue && !isOnline && !isOps);
    }

    if (adminUi.panelOnline instanceof HTMLElement) {
      adminUi.panelOnline.hidden = !isOnline;
      adminUi.panelOnline.classList.toggle("is-active", isOnline);
    }

    if (adminUi.panelOps instanceof HTMLElement) {
      adminUi.panelOps.hidden = !isOps;
      adminUi.panelOps.classList.toggle("is-active", isOps);
    }

    if (isQueue && options.renderQueue !== false) {
      void refreshQueueTab();
      return;
    }

    if (isOnline && options.renderOnline !== false) {
      void refreshOnlineTab();
      return;
    }

    if (isOps && options.renderOps !== false) {
      void refreshOpsTab();
      return;
    }

    if (!isOnline && options.renderReviews !== false) {
      void refreshReviewsTab();
    }
  }

  async function refreshQueueTab(options = {}) {
    if (adminOnlineState.activeTab !== "queue" && options.force !== true) {
      return;
    }
    if (!state.isAdmin) {
      resetQueueUiState();
      renderQueueEmptyState("Admin access required.");
      return;
    }

    const forceReload = options.force === true;
    if (!forceReload && adminQueueState.loaded && !adminQueueState.loading) {
      applyQueueFilters();
      return;
    }

    await loadQueueRowsForAdminUi();
  }

  function resetQueueUiState() {
    adminQueueState.loaded = false;
    adminQueueState.loading = false;
    adminQueueState.loadToken = 0;
    adminQueueState.searchQuery = "";
    adminQueueState.stateFilter = "pending";
    adminQueueState.rows = [];
    adminQueueState.visibleRows = [];
    adminQueueState.audienceRows = [];
    adminQueueState.stats = null;
    if (adminUi.queueSearchInput instanceof HTMLInputElement) {
      adminUi.queueSearchInput.value = "";
    }
    if (adminUi.queueStateSelect instanceof HTMLSelectElement) {
      adminUi.queueStateSelect.value = "pending";
    }
    renderQueueStats(null);
  }

  async function loadQueueRowsForAdminUi() {
    if (!(adminUi.submissionsList instanceof HTMLElement)) {
      return;
    }

    const loadToken = adminQueueState.loadToken + 1;
    adminQueueState.loadToken = loadToken;
    adminQueueState.loading = true;
    renderQueueEmptyState("Loading review queue...");

    try {
      const client = await ensureAdminClient();
      const [queueResult, userBansResult, visitorBansResult, audienceRows] = await Promise.all([
        client
          .from(ADMIN_PLACE_QUEUE_VIEW)
          .select("*")
          .order("created_at", { ascending: false })
          .limit(ADMIN_QUEUE_LIMIT),
        client
          .from(USER_BANS_TABLE)
          .select("banned_at,updated_at")
          .limit(120),
        client
          .from(VISITOR_BANS_TABLE)
          .select("banned_at,updated_at")
          .limit(120),
        loadOnlineUsersFromStatusTable({ force: false }).catch(() => [])
      ]);

      if (adminQueueState.loadToken !== loadToken) {
        return;
      }

      if (queueResult?.error) {
        throw new Error(
          formatSupabaseErrorMessage(
            queueResult.error,
            "Failed to load review queue. Run the latest place review SQL patch in Supabase."
          )
        );
      }

      adminQueueState.rows = await hydrateQueueSubmissionImages(
        client,
        Array.isArray(queueResult?.data) ? queueResult.data : []
      );
      adminQueueState.audienceRows = Array.isArray(audienceRows) ? audienceRows : [];
      adminQueueState.stats = buildQueueStats({
        rows: adminQueueState.rows,
        userBans: Array.isArray(userBansResult?.data) ? userBansResult.data : [],
        visitorBans: Array.isArray(visitorBansResult?.data) ? visitorBansResult.data : [],
        audienceRows: adminQueueState.audienceRows
      });
      adminQueueState.loaded = true;
      adminQueueState.loading = false;
      applyQueueFilters();
    } catch (error) {
      if (adminQueueState.loadToken !== loadToken) {
        return;
      }
      adminQueueState.loaded = false;
      adminQueueState.loading = false;
      adminQueueState.rows = [];
      adminQueueState.visibleRows = [];
      adminQueueState.audienceRows = [];
      adminQueueState.stats = null;
      renderQueueStats(null);
      renderQueueEmptyState(normalizeText(error?.message, "Failed to load review queue."));
      showAdminToast(normalizeText(error?.message, "Failed to load review queue."));
    }
  }

  function applyQueueFilters() {
    const rows = Array.isArray(adminQueueState.rows) ? adminQueueState.rows : [];
    const query = normalizeText(adminQueueState.searchQuery, "").toLowerCase();
    const stateFilter = normalizeText(adminQueueState.stateFilter, "pending").toLowerCase();

    adminQueueState.visibleRows = rows.filter((row) => {
      const submissionState = normalizeText(row?.submission_state, "pending").toLowerCase();
      if (stateFilter !== "all") {
        if (stateFilter === "scheduled" && submissionState !== "scheduled") {
          return false;
        }
        if (stateFilter !== "scheduled" && submissionState !== stateFilter) {
          return false;
        }
      }
      if (!query) {
        return true;
      }
      const haystack = [
        row?.title,
        row?.description,
        row?.country,
        row?.region,
        row?.submitter_email,
        row?.submitter_display_name,
        row?.slug
      ].join(" ").toLowerCase();
      return haystack.includes(query);
    });

    renderQueueStats(adminQueueState.stats);
    renderSubmissionQueue(adminQueueState.visibleRows);
    renderQueueHeatmaps();
  }

  function buildQueueStats(context = {}) {
    const rows = Array.isArray(context.rows) ? context.rows : [];
    const audienceRows = Array.isArray(context.audienceRows) ? context.audienceRows : [];
    const userBans = Array.isArray(context.userBans) ? context.userBans : [];
    const visitorBans = Array.isArray(context.visitorBans) ? context.visitorBans : [];
    return {
      pendingNow: rows.filter((row) => normalizeText(row?.submission_state, "pending") === "pending").length,
      newToday: rows.filter((row) => isRecentIso(row?.created_at, 24)).length,
      approvedWeek: rows.filter((row) => {
        const stateValue = normalizeText(row?.submission_state, "").toLowerCase();
        return (stateValue === "approved" || stateValue === "scheduled") && isRecentIso(row?.reviewed_at, 24 * 7);
      }).length,
      reviewsDay: rows.filter((row) => isRecentIso(row?.reviewed_at, 24)).length,
      bansWeek: [...userBans, ...visitorBans].filter((row) => isRecentIso(row?.banned_at || row?.updated_at, 24 * 7)).length,
      liveAudience: audienceRows.length
    };
  }

  function renderQueueStats(stats) {
    const safeStats = stats || {
      pendingNow: 0,
      newToday: 0,
      approvedWeek: 0,
      reviewsDay: 0,
      bansWeek: 0,
      liveAudience: 0
    };
    if (adminUi.queuePendingStat instanceof HTMLElement) {
      adminUi.queuePendingStat.textContent = String(safeStats.pendingNow);
    }
    if (adminUi.queueNewTodayStat instanceof HTMLElement) {
      adminUi.queueNewTodayStat.textContent = String(safeStats.newToday);
    }
    if (adminUi.queueApprovedWeekStat instanceof HTMLElement) {
      adminUi.queueApprovedWeekStat.textContent = String(safeStats.approvedWeek);
    }
    if (adminUi.queueReviewsDayStat instanceof HTMLElement) {
      adminUi.queueReviewsDayStat.textContent = String(safeStats.reviewsDay);
    }
    if (adminUi.queueBansWeekStat instanceof HTMLElement) {
      adminUi.queueBansWeekStat.textContent = String(safeStats.bansWeek);
    }
    if (adminUi.queueAudienceLiveStat instanceof HTMLElement) {
      adminUi.queueAudienceLiveStat.textContent = String(safeStats.liveAudience);
    }
  }

  function renderQueueHeatmaps() {
    const contentPoints = (Array.isArray(adminQueueState.rows) ? adminQueueState.rows : [])
      .filter((row) => Number.isFinite(Number(row?.lat)) && Number.isFinite(Number(row?.lng)))
      .map((row) => ({
        lat: Number(row.lat),
        lng: Number(row.lng),
        title: normalizeText(row.title, "Untitled"),
        tone: normalizeText(row?.submission_state, "pending").toLowerCase() === "pending" ? "suspicious" : "public"
      }));
    const audiencePoints = (Array.isArray(adminQueueState.audienceRows) ? adminQueueState.audienceRows : [])
      .filter((row) => Number.isFinite(Number(row?.last_lat)) && Number.isFinite(Number(row?.last_lng)))
      .map((row) => ({
        lat: Number(row.last_lat),
        lng: Number(row.last_lng),
        title: normalizeText(row.display_name, row.email || "Guest"),
        tone: "public"
      }));

    renderHeatmap(adminUi.contentHeatmap, contentPoints, "No point geography yet.");
    renderHeatmap(adminUi.audienceHeatmap, audiencePoints, "No live geo audience yet.");

    if (adminUi.contentHeatmapSummary instanceof HTMLElement) {
      adminUi.contentHeatmapSummary.textContent = contentPoints.length > 0
        ? `${contentPoints.length} queued / approved public point locations in the current moderation window.`
        : "Fresh public points and submissions by location.";
    }
    if (adminUi.audienceHeatmapSummary instanceof HTMLElement) {
      adminUi.audienceHeatmapSummary.textContent = audiencePoints.length > 0
        ? `${audiencePoints.length} active users or guests with approximate location from live presence pings.`
        : "Approximate live audience clusters from worker presence pings.";
    }
  }

  function renderHeatmap(container, points, emptyText) {
    if (!(container instanceof HTMLElement)) {
      return;
    }
    container.replaceChildren();
    const safePoints = Array.isArray(points) ? points : [];
    if (safePoints.length === 0) {
      const empty = document.createElement("div");
      empty.className = "admin-geo-map__empty";
      empty.textContent = normalizeText(emptyText, "No geo data yet.");
      container.append(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    safePoints.forEach((point, index) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = point.tone === "suspicious"
        ? "admin-geo-map__dot admin-heatmap__dot admin-geo-map__dot--suspicious"
        : "admin-geo-map__dot admin-heatmap__dot admin-geo-map__dot--public";
      dot.style.left = `${((point.lng + 180) / 360) * 100}%`;
      dot.style.top = `${((90 - point.lat) / 180) * 100}%`;
      dot.style.width = `${12 + Math.min(18, Math.floor(index / 4))}px`;
      dot.style.height = dot.style.width;
      dot.title = normalizeText(point.title, "Location");
      fragment.append(dot);
    });
    container.append(fragment);
  }

  async function hydrateQueueSubmissionImages(client, rows) {
    const safeRows = Array.isArray(rows) ? rows : [];
    if (!client || safeRows.length === 0 || !client.storage || typeof client.storage.from !== "function") {
      return safeRows;
    }

    const bucket = client.storage.from("place-images");
    return Promise.all(safeRows.map(async (row) => {
      const imagePath = normalizeText(row?.image_path, "");
      if (!imagePath) {
        return row;
      }
      try {
        const { data, error } = await bucket.createSignedUrl(imagePath, 60 * 30);
        if (error) {
          return row;
        }
        return {
          ...row,
          image_url: normalizeText(data?.signedUrl, normalizeText(row?.image_url, ""))
        };
      } catch {
        return row;
      }
    }));
  }

  function renderSubmissionQueue(rows) {
    if (!(adminUi.submissionsList instanceof HTMLElement)) {
      return;
    }
    const items = Array.isArray(rows) ? rows : [];
    if (items.length === 0) {
      renderQueueEmptyState("No point submissions match the current filters.");
      return;
    }

    const fragment = document.createDocumentFragment();
    items.forEach((row) => {
      const item = document.createElement("li");
      item.className = "admin-submission-item";
      item.dataset.submissionId = normalizeText(row.id, "");

      const top = document.createElement("div");
      top.className = "admin-submission-item__top";

      const identity = document.createElement("div");
      identity.className = "admin-review-item__identity";

      const title = document.createElement("strong");
      title.className = "admin-online-item__email";
      title.textContent = normalizeText(row.title, "Untitled point");

      const metaPill = document.createElement("span");
      metaPill.className = "admin-review-item__place";
      metaPill.textContent = `${normalizeText(row.submitter_display_name, row.submitter_email || "user")} / ${normalizeText(row.submitter_role, "user")}`;
      identity.append(title, metaPill);

      const stateBadge = createStatusBadge(
        normalizeText(row.submission_state, "pending").toUpperCase(),
        normalizeText(row.submission_state, "pending") === "pending" ? "deleted" : "online"
      );
      top.append(identity, stateBadge);

      const locationMeta = document.createElement("p");
      locationMeta.className = "admin-online-item__meta";
      locationMeta.textContent = `${normalizeText(row.country, "Unknown country")} / ${normalizeText(row.region, "Unknown region")} / ${formatReviewDateLabel(row.created_at)}`;

      const description = document.createElement("p");
      description.className = "admin-review-item__preview";
      description.textContent = normalizeText(row.description, "Description unavailable.");

      item.append(top, locationMeta);

      if (normalizeText(row.image_url, "")) {
        const media = document.createElement("div");
        media.className = "admin-submission-item__media";
        const image = document.createElement("img");
        image.className = "admin-submission-item__image";
        image.src = row.image_url;
        image.alt = normalizeText(row.title, "Submission image");
        image.loading = "lazy";
        media.append(image);
        item.append(media);
      }

      item.append(description);

      const coords = document.createElement("p");
      coords.className = "admin-online-item__meta";
      coords.textContent = `coords: ${Number(row.lat).toFixed(4)}, ${Number(row.lng).toFixed(4)} / category: ${normalizeText(row.category, "not set")}`;
      item.append(coords);

      const scheduleMeta = document.createElement("p");
      scheduleMeta.className = "admin-online-item__meta";
      scheduleMeta.textContent = normalizeText(row.publish_at, "")
        ? `scheduled publish: ${formatReviewDateLabel(row.publish_at)}`
        : "scheduled publish: immediate after approval";
      item.append(scheduleMeta);

      if (normalizeText(row.review_reason, "")) {
        const reviewReason = document.createElement("p");
        reviewReason.className = "admin-online-item__meta admin-online-item__meta--reason";
        reviewReason.textContent = `review note: ${row.review_reason}`;
        item.append(reviewReason);
      }

      const textarea = document.createElement("textarea");
      textarea.className = "text-input admin-submission-item__note";
      textarea.rows = 2;
      textarea.maxLength = 180;
      textarea.placeholder = "Approval / rejection note for the author";
      textarea.dataset.queueNote = "true";
      textarea.value = "";
      item.append(textarea);

      const actions = document.createElement("div");
      actions.className = "admin-actions";
      actions.append(
        createQueueActionButton("Locate", "locate", row.id, "restore"),
        createQueueActionButton("Dossier", "dossier", row.id, ""),
        createQueueActionButton("Approve", "approve", row.id, "restore"),
        createQueueActionButton("Reject", "reject", row.id, "danger")
      );
      item.append(actions);

      fragment.append(item);
    });

    adminUi.submissionsList.replaceChildren(fragment);
  }

  function renderQueueEmptyState(text) {
    if (!(adminUi.submissionsList instanceof HTMLElement)) {
      return;
    }
    const item = document.createElement("li");
    item.className = "admin-online-item";
    const meta = document.createElement("p");
    meta.className = "admin-online-item__meta";
    meta.textContent = normalizeText(text, "No point submissions.");
    item.append(meta);
    adminUi.submissionsList.replaceChildren(item);
  }

  function createQueueActionButton(label, action, submissionId, tone = "") {
    const button = document.createElement("button");
    button.type = "button";
    button.className = tone === "restore"
      ? "admin-action-btn admin-action-btn--restore"
      : (tone === "danger" ? "admin-action-btn admin-action-btn--danger" : "admin-action-btn");
    button.textContent = label;
    button.dataset.queueAction = action;
    button.dataset.submissionId = normalizeText(submissionId, "");
    return button;
  }

  async function handleQueueActionClick(event) {
    const button = event.target instanceof Element
      ? event.target.closest("button[data-queue-action]")
      : null;
    if (!(button instanceof HTMLButtonElement) || !state.isAdmin) {
      return;
    }

    const action = normalizeText(button.dataset.queueAction, "");
    const submissionId = normalizeText(button.dataset.submissionId, "");
    const row = (Array.isArray(adminQueueState.rows) ? adminQueueState.rows : []).find(
      (entry) => normalizeText(entry?.id, "") === submissionId
    );
    if (!row) {
      return;
    }

    const noteValue = normalizeText(
      button.closest(".admin-submission-item")?.querySelector("[data-queue-note='true']")?.value,
      ""
    );

    if (action === "locate") {
      if (window.WorldAtlasAppBridge?.previewCoordinates) {
        const located = window.WorldAtlasAppBridge.previewCoordinates(row.lat, row.lng, {
          visibility: normalizeText(row.submission_state, "pending"),
          targetZoom: 6
        });
        if (!located) {
          showAdminToast("Failed to preview submission coordinates.");
        }
      }
      return;
    }

    if (action === "dossier") {
      await loadTargetDossier({
        presenceType: "user",
        userId: normalizeText(row.submitter_user_id, ""),
        visitorId: "",
        email: normalizeText(row.submitter_email, ""),
        displayName: normalizeText(row.submitter_display_name, "")
      }, { force: true });
      activateAdminTab("ops", { renderOps: false });
      return;
    }

    button.disabled = true;
    try {
      const client = await ensureAdminClient();
      if (action === "approve") {
        const rpcResult = await client.rpc("admin_approve_place_submission", {
          target_submission_id: submissionId,
          review_note: noteValue || null
        });
        if (rpcResult?.error) {
          throw new Error(formatSupabaseErrorMessage(rpcResult.error, "Failed to approve point."));
        }
        showAdminToast("Point approved.");
        if (window.WorldAtlasAppBridge?.reloadPlacesState) {
          await window.WorldAtlasAppBridge.reloadPlacesState();
        }
      }
      if (action === "reject") {
        const rpcResult = await client.rpc("admin_reject_place_submission", {
          target_submission_id: submissionId,
          review_note: noteValue || null
        });
        if (rpcResult?.error) {
          throw new Error(formatSupabaseErrorMessage(rpcResult.error, "Failed to reject point."));
        }
        showAdminToast("Point rejected.");
      }
      await refreshQueueTab({ force: true });
      await loadGeoModerationRows({ force: true });
    } catch (error) {
      showAdminToast(normalizeText(error?.message, "Queue action failed."));
    } finally {
      button.disabled = false;
    }
  }

  async function refreshReviewsTab(options = {}) {
    if (adminOnlineState.activeTab !== "reviews") {
      return;
    }
    if (!state.isAdmin) {
      resetReviewsUiState();
      renderReviewsEmptyState("Admin access required.");
      return;
    }

    const forceReload = options.force === true;
    if (!forceReload && adminReviewsState.loaded && !adminReviewsState.loading) {
      renderReviewsList(adminReviewsState.visibleReviews);
      return;
    }

    await loadReviewsForAdminUi();
  }

  function resetReviewsUiState() {
    adminReviewsState.loaded = false;
    adminReviewsState.loading = false;
    adminReviewsState.searchQuery = "";
    adminReviewsState.allReviews = [];
    adminReviewsState.visibleReviews = [];
    if (adminUi.reviewsSearchInput instanceof HTMLInputElement) {
      adminUi.reviewsSearchInput.value = "";
    }
  }

  async function loadReviewsForAdminUi() {
    if (!(adminUi.reviewsList instanceof HTMLElement)) {
      return;
    }

    const loadToken = adminReviewsState.loadToken + 1;
    adminReviewsState.loadToken = loadToken;
    adminReviewsState.loading = true;
    renderReviewsSkeleton(4);

    try {
      const rows = await getAdminReviews({ limit: ADMIN_REVIEWS_LIMIT });
      if (adminReviewsState.loadToken !== loadToken) {
        return;
      }

      adminReviewsState.allReviews = Array.isArray(rows) ? rows : [];
      adminReviewsState.loaded = true;
      adminReviewsState.loading = false;
      applyReviewsSearchFilter(adminReviewsState.searchQuery, { commitInput: false });
    } catch (error) {
      if (adminReviewsState.loadToken !== loadToken) {
        return;
      }

      adminReviewsState.loaded = false;
      adminReviewsState.loading = false;
      adminReviewsState.allReviews = [];
      adminReviewsState.visibleReviews = [];
      const message = normalizeText(error?.message, "Failed to load reviews.");
      renderReviewsEmptyState(message);
      showAdminToast(message);
    }
  }

  function applyReviewsSearchFilter(rawQuery, options = {}) {
    const inputValue = typeof rawQuery === "string" ? rawQuery : "";
    const query = normalizeText(inputValue, "").toLowerCase();
    adminReviewsState.searchQuery = query;

    if (options.commitInput !== false && adminUi.reviewsSearchInput instanceof HTMLInputElement) {
      adminUi.reviewsSearchInput.value = inputValue;
    }

    const sourceRows = Array.isArray(adminReviewsState.allReviews)
      ? adminReviewsState.allReviews
      : [];

    if (!query) {
      adminReviewsState.visibleReviews = sourceRows.slice();
      renderReviewsList(adminReviewsState.visibleReviews);
      return;
    }

    adminReviewsState.visibleReviews = sourceRows.filter((entry) => {
      const email = normalizeText(entry?.email, "").toLowerCase();
      const comment = normalizeText(entry?.comment, "").toLowerCase();
      const placeTitle = normalizeText(entry?.place_title, "").toLowerCase();
      return (
        email.includes(query) ||
        comment.includes(query) ||
        placeTitle.includes(query)
      );
    });
    renderReviewsList(adminReviewsState.visibleReviews);
  }

  function renderReviewsSkeleton(count = 3) {
    if (!(adminUi.reviewsList instanceof HTMLElement)) {
      return;
    }

    const safeCount = Math.max(1, Math.min(6, Number(count) || 3));
    const fragment = document.createDocumentFragment();
    for (let index = 0; index < safeCount; index += 1) {
      const item = document.createElement("li");
      item.className = "admin-review-item admin-review-item--skeleton";
      item.setAttribute("aria-hidden", "true");

      const lineTop = document.createElement("span");
      lineTop.className = "admin-skeleton-line admin-skeleton-line--title";
      const lineMeta = document.createElement("span");
      lineMeta.className = "admin-skeleton-line admin-skeleton-line--meta";
      const lineBody = document.createElement("span");
      lineBody.className = "admin-skeleton-line admin-skeleton-line--body";

      item.append(lineTop, lineMeta, lineBody);
      fragment.append(item);
    }
    adminUi.reviewsList.replaceChildren(fragment);
  }

  function renderReviewsEmptyState(text) {
    if (!(adminUi.reviewsList instanceof HTMLElement)) {
      return;
    }

    const item = document.createElement("li");
    item.className = "admin-review-item";

    const meta = document.createElement("p");
    meta.className = "admin-review-item__meta";
    meta.textContent = normalizeText(text, "No reviews");

    item.append(meta);
    adminUi.reviewsList.replaceChildren(item);
  }

  function renderReviewsList(reviews) {
    if (!(adminUi.reviewsList instanceof HTMLElement)) {
      return;
    }

    const items = Array.isArray(reviews) ? reviews : [];
    if (items.length === 0) {
      const text = adminReviewsState.searchQuery
        ? "No reviews match your search."
        : "No reviews found.";
      renderReviewsEmptyState(text);
      return;
    }

    const fragment = document.createDocumentFragment();
    items.forEach((entry) => {
      const reviewId = normalizeText(entry?.id, "");
      const isDeleted = resolveReviewDeletedState(entry);
      const item = document.createElement("li");
      item.className = isDeleted
        ? "admin-review-item is-deleted"
        : "admin-review-item";
      if (reviewId) {
        item.dataset.reviewId = reviewId;
      }

      const top = document.createElement("div");
      top.className = "admin-review-item__top";

      const identity = document.createElement("div");
      identity.className = "admin-review-item__identity";

      const email = document.createElement("strong");
      email.className = "admin-review-item__email";
      email.textContent = normalizeText(entry?.email, "unknown@user");

      const place = document.createElement("span");
      place.className = "admin-review-item__place";
      place.textContent = normalizeText(entry?.place_title, "Unknown place");

      identity.append(email, place);

      if (isDeleted) {
        const badge = document.createElement("span");
        badge.className = "admin-status-badge admin-status-badge--deleted";
        badge.textContent = "Deleted";
        top.append(identity, badge);
      } else {
        const rating = document.createElement("span");
        rating.className = "admin-review-item__rating";
        rating.textContent = formatReviewRating(entry?.rating);
        top.append(identity, rating);
      }

      const meta = document.createElement("p");
      meta.className = "admin-review-item__meta";
      const createdAt = formatReviewDateLabel(entry?.created_at);
      const deletedAt = resolveDeletedAt(entry);
      if (isDeleted && deletedAt) {
        meta.textContent = `${createdAt} - deleted ${formatReviewDateLabel(deletedAt)}`;
      } else {
        meta.textContent = createdAt;
      }

      const preview = document.createElement("p");
      preview.className = "admin-review-item__preview";
      preview.textContent = normalizeText(entry?.comment, "No comment");

      item.append(top, meta, preview);

      if (state.isAdmin && reviewId) {
        const actions = document.createElement("div");
        actions.className = "admin-actions";

        const actionButton = document.createElement("button");
        actionButton.type = "button";
        actionButton.dataset.reviewAction = isDeleted ? "restore" : "delete";
        actionButton.dataset.reviewId = reviewId;
        actionButton.className = isDeleted
          ? "admin-action-btn admin-action-btn--restore"
          : "admin-action-btn admin-action-btn--danger";
        actionButton.textContent = isDeleted ? "Restore" : "Delete";

        actions.append(actionButton);
        item.append(actions);
      }

      fragment.append(item);
    });

    adminUi.reviewsList.replaceChildren(fragment);
  }

  // Online status implementation: public.user_status + heartbeat + realtime table changes
  async function refreshOnlineTab(options = {}) {
    if (adminOnlineState.activeTab !== "online") {
      return;
    }

    if (options.forceBans === true && adminOnlineState.reconnectTimerId) {
      clearOnlinePresenceReconnectTimer(false);
    }

    if (
      adminOnlineState.shouldMaintainPresence &&
      (
        options.forceBans === true ||
        adminOnlineState.fallbackMode ||
        !adminOnlineState.heartbeatTimerId ||
        (
          state.isAdmin &&
          (
            !adminOnlineState.realtimeChannel ||
            !isOnlinePresenceChannelPendingOrReady(adminOnlineState.realtimeStatus)
          )
        )
      ) &&
      !adminOnlineState.reconnectTimerId
    ) {
      const user = adminPresenceState.currentUser || state.session?.user || null;
      if (normalizeText(user?.id, "")) {
        void startOnlinePresence({ user });
      }
    }

    await renderOnlineList({
      forceBansFetch: options.forceBans === true,
      forceStatusFetch: options.forceBans === true
    });
  }

  function bindAdminFilterChip(buttonEl, filterKey) {
    if (!(buttonEl instanceof HTMLElement)) {
      return;
    }

    buttonEl.addEventListener("click", () => {
      adminOpsState.geoFilters[filterKey] = adminOpsState.geoFilters[filterKey] !== true;
      applyGeoFilters();
    });
  }

  function renderCommandStatus(message, type = "info") {
    if (!(adminUi.commandStatus instanceof HTMLElement)) {
      return;
    }

    const safeMessage = normalizeText(message, "");
    adminUi.commandStatus.hidden = !safeMessage;
    adminUi.commandStatus.textContent = safeMessage;
    adminUi.commandStatus.classList.remove("is-error", "is-success");
    if (!safeMessage) {
      return;
    }
    if (type === "error") {
      adminUi.commandStatus.classList.add("is-error");
    } else if (type === "success") {
      adminUi.commandStatus.classList.add("is-success");
    }
  }

  function renderOpsEmptyState(text) {
    if (!(adminUi.dossierCard instanceof HTMLElement)) {
      return;
    }
    adminUi.dossierCard.replaceChildren();
    const empty = document.createElement("p");
    empty.className = "admin-dossier-card__empty";
    empty.textContent = normalizeText(text, "Choose a user or guest.");
    adminUi.dossierCard.append(empty);
  }

  function renderNotesEmptyState(text) {
    if (!(adminUi.notesList instanceof HTMLElement)) {
      return;
    }
    const item = document.createElement("li");
    item.className = "admin-note-item";
    const meta = document.createElement("p");
    meta.className = "admin-note-item__meta";
    meta.textContent = normalizeText(text, "No notes yet.");
    item.append(meta);
    adminUi.notesList.replaceChildren(item);
  }

  function renderGeoEmptyState(text) {
    if (adminUi.geoCountValue instanceof HTMLElement) {
      adminUi.geoCountValue.textContent = "0";
    }

    if (adminUi.geoSummary instanceof HTMLElement) {
      adminUi.geoSummary.textContent = normalizeText(text, "No moderation rows.");
    }

    if (adminUi.geoMap instanceof HTMLElement) {
      adminUi.geoMap.replaceChildren();
      const empty = document.createElement("div");
      empty.className = "admin-geo-map__empty";
      empty.textContent = normalizeText(text, "No moderation rows.");
      adminUi.geoMap.append(empty);
    }

    if (adminUi.geoList instanceof HTMLElement) {
      const item = document.createElement("li");
      item.className = "admin-geo-item";
      const meta = document.createElement("p");
      meta.className = "admin-geo-item__meta";
      meta.textContent = normalizeText(text, "No moderation rows.");
      item.append(meta);
      adminUi.geoList.replaceChildren(item);
    }
  }

  function renderGeoSummary(row, totalCount = 0) {
    if (!(adminUi.geoSummary instanceof HTMLElement)) {
      return;
    }

    const total = Math.max(0, Number(totalCount) || 0);
    const safeRow = row && typeof row === "object" ? row : null;
    if (!safeRow) {
      adminUi.geoSummary.textContent = total > 0
        ? `Showing ${total} point${total === 1 ? "" : "s"} on the mini world map. Select a row or dot for details.`
        : "Select a row or dot to see the place context and coordinates.";
      return;
    }

    const country = normalizeText(safeRow.country, "Unknown country");
    const region = normalizeText(safeRow.region, "Unknown region");
    const creator = normalizeText(safeRow.creatorEmail, "unknown creator");
    const lat = Number.isFinite(Number(safeRow.lat)) ? Number(safeRow.lat).toFixed(2) : "--";
    const lng = Number.isFinite(Number(safeRow.lng)) ? Number(safeRow.lng).toFixed(2) : "--";
    const sourceLabel = safeRow.source === "public" ? "public point" : "user point";
    adminUi.geoSummary.textContent = `${normalizeText(safeRow.title, "Untitled")} / ${country} / ${region} / ${lat}, ${lng} / ${sourceLabel} / ${creator}`;
  }

  async function refreshOpsTab(options = {}) {
    if (adminOnlineState.activeTab !== "ops" && options.force !== true) {
      return;
    }

    if (!state.isAdmin) {
      renderOpsEmptyState("Admin access required.");
      renderNotesEmptyState("Admin access required.");
      renderGeoEmptyState("Admin access required.");
      return;
    }

    if (adminUi.commandRunButton instanceof HTMLButtonElement) {
      adminUi.commandRunButton.disabled = adminOpsState.commandBusy === true;
    }

    if (adminUi.noteSaveButton instanceof HTMLButtonElement) {
      adminUi.noteSaveButton.disabled = adminOpsState.noteBusy === true || !adminOpsState.selectedTarget;
    }

    if (options.forceGeo === true || !adminOpsState.geoLoaded) {
      await loadGeoModerationRows({ force: options.forceGeo === true });
    } else {
      applyGeoFilters();
    }

    if (adminOpsState.selectedTarget) {
      await loadTargetDossier(adminOpsState.selectedTarget, {
        force: options.forceDossier === true
      });
      return;
    }

    renderOpsEmptyState("Choose a user from Online or use the command bar.");
    renderNotesEmptyState("Notes will appear here.");
  }

  function parseAdminDuration(rawValue) {
    const value = normalizeText(rawValue, "").toLowerCase();
    if (!value) {
      return null;
    }
    if (["perm", "perma", "permanent", "forever"].includes(value)) {
      return 0;
    }

    const directNumber = Number(value);
    if (Number.isFinite(directNumber) && directNumber > 0) {
      return Math.floor(directNumber);
    }

    const match = /^(\d+)(m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days)$/i.exec(value);
    if (!match) {
      return null;
    }

    const amount = Math.max(0, Math.floor(Number(match[1]) || 0));
    const unit = normalizeText(match[2], "").toLowerCase();
    if (unit.startsWith("d")) {
      return amount * 1440;
    }
    if (unit.startsWith("h")) {
      return amount * 60;
    }
    return amount;
  }

  function parseAdminCommand(input) {
    const safeInput = normalizeText(input, "");
    if (!safeInput) {
      return null;
    }

    const tokens = safeInput.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) {
      return null;
    }

    const command = normalizeText(tokens[0], "").toLowerCase();
    if (!command) {
      return null;
    }

    if (command === "delete" && normalizeText(tokens[1], "").toLowerCase() === "point") {
      return {
        command: "delete-point",
        pointRef: normalizeText(tokens.slice(2).join(" "), "")
      };
    }

    if (command === "hide") {
      return {
        command: "hide",
        query: normalizeText(tokens.slice(1).join(" "), "")
      };
    }

    if (command === "dossier") {
      return {
        command,
        targetQuery: normalizeText(tokens.slice(1).join(" "), "")
      };
    }

    if (command === "note") {
      return {
        command,
        targetQuery: normalizeText(tokens[1], ""),
        note: normalizeText(tokens.slice(2).join(" "), "")
      };
    }

    if (["ban", "freeze"].includes(command)) {
      return {
        command,
        targetQuery: normalizeText(tokens[1], ""),
        minutes: parseAdminDuration(tokens[2]),
        reason: normalizeText(tokens.slice(parseAdminDuration(tokens[2]) === null ? 2 : 3).join(" "), "")
      };
    }

    if (["unban", "unfreeze", "promote", "cleanup"].includes(command)) {
      return {
        command,
        targetQuery: normalizeText(tokens[1], ""),
        reason: normalizeText(tokens.slice(2).join(" "), "")
      };
    }

    return {
      command,
      targetQuery: normalizeText(tokens.slice(1).join(" "), "")
    };
  }

  function resolveAdminTargetHint(target = adminOpsState.selectedTarget) {
    const safeTarget = target && typeof target === "object" ? target : null;
    if (!safeTarget) {
      return "user@example.com";
    }

    return normalizeText(
      safeTarget.email,
      normalizeText(
        safeTarget.displayName,
        normalizeText(
          safeTarget.userId,
          normalizeText(safeTarget.visitorId, "user@example.com")
        )
      )
    );
  }

  function applyCommandTemplate(template) {
    if (!(adminUi.commandInput instanceof HTMLInputElement)) {
      return;
    }

    const safeTemplate = normalizeText(template, "");
    if (!safeTemplate) {
      return;
    }

    adminUi.commandInput.value = safeTemplate.replace("{target}", resolveAdminTargetHint());
    adminUi.commandInput.focus();
    adminUi.commandInput.setSelectionRange(
      adminUi.commandInput.value.length,
      adminUi.commandInput.value.length
    );
    renderCommandStatus("", "info");
  }

  function buildTargetFromPresenceEntry(entry) {
    const safeEntry = entry && typeof entry === "object" ? entry : {};
    return {
      presenceType: normalizePresenceType(safeEntry.presence_type),
      userId: normalizeText(safeEntry.user_id, ""),
      visitorId: normalizeText(safeEntry.visitor_id, ""),
      email: normalizeText(safeEntry.email, ""),
      displayName: normalizeText(safeEntry.display_name, "")
    };
  }

  function findPresenceTargetByQuery(query) {
    const safeQuery = normalizeText(query, "").toLowerCase();
    if (!safeQuery) {
      return null;
    }

    const rows = Array.isArray(adminOnlineState.statusRows)
      ? adminOnlineState.statusRows
      : [];
    const matched = rows.find((entry) => {
      const haystack = [
        normalizeText(entry?.email, ""),
        normalizeText(entry?.display_name, ""),
        normalizeText(entry?.user_id, ""),
        normalizeText(entry?.visitor_id, ""),
        normalizeText(entry?.presence_key, "")
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(safeQuery);
    });

    return matched ? buildTargetFromPresenceEntry(matched) : null;
  }

  async function resolveAdminTargetFromQuery(query) {
    const safeQuery = normalizeText(query, "");
    if (!safeQuery) {
      if (adminOpsState.selectedTarget) {
        return adminOpsState.selectedTarget;
      }
      throw new Error("Target is required.");
    }

    const onlineTarget = findPresenceTargetByQuery(safeQuery);
    if (onlineTarget) {
      return onlineTarget;
    }

    const { client } = await ensureAdminContext();
    const safeLike = safeQuery.replace(/[%(),]/g, "").slice(0, 80);

    if (safeLike) {
      const visitorResult = await client
        .from(VISITOR_STATUS_TABLE)
        .select("visitor_id,user_id,email,display_name")
        .or(`visitor_id.ilike.%${safeLike}%,display_name.ilike.%${safeLike}%,email.ilike.%${safeLike}%`)
        .order("last_seen", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!visitorResult?.error && visitorResult?.data) {
        return {
          presenceType: "visitor",
          userId: normalizeText(visitorResult.data.user_id, ""),
          visitorId: normalizeText(visitorResult.data.visitor_id, ""),
          email: normalizeText(visitorResult.data.email, ""),
          displayName: normalizeText(visitorResult.data.display_name, "")
        };
      }
    }

    if (safeLike) {
      const profileResult = await client
        .from("profiles")
        .select("id,email,display_name")
        .or(`email.ilike.%${safeLike}%,display_name.ilike.%${safeLike}%`)
        .limit(1)
        .maybeSingle();
      if (!profileResult?.error && profileResult?.data) {
        return {
          presenceType: "user",
          userId: normalizeText(profileResult.data.id, ""),
          visitorId: "",
          email: normalizeText(profileResult.data.email, ""),
          displayName: normalizeText(profileResult.data.display_name, "")
        };
      }
    }

    if (/^[0-9a-f-]{32,36}$/i.test(safeQuery)) {
      return {
        presenceType: "user",
        userId: safeQuery.toLowerCase(),
        visitorId: "",
        email: "",
        displayName: ""
      };
    }

    throw new Error("Target was not found.");
  }

  async function runAdminCommand() {
    if (adminOpsState.commandBusy) {
      return;
    }

    const input = normalizeText(adminUi.commandInput?.value, "");
    const parsed = parseAdminCommand(input);
    if (!parsed) {
      renderCommandStatus("Enter a command first.", "error");
      return;
    }

    adminOpsState.commandBusy = true;
    if (adminUi.commandRunButton instanceof HTMLButtonElement) {
      adminUi.commandRunButton.disabled = true;
    }

    try {
      if (parsed.command === "hide") {
        adminOpsState.geoFilters.query = normalizeText(parsed.query, "");
        if (adminUi.geoSearchInput instanceof HTMLInputElement) {
          adminUi.geoSearchInput.value = adminOpsState.geoFilters.query;
        }
        activateAdminTab("ops", { renderOps: false });
        if (!adminOpsState.geoLoaded) {
          await loadGeoModerationRows({ force: true });
        }
        applyGeoFilters();
        renderCommandStatus("Geo moderation filter applied.", "success");
        return;
      }

      if (parsed.command === "delete-point") {
        await deletePlaceByReference(parsed.pointRef);
        if (window.WorldAtlasAppBridge?.reloadPlacesState) {
          await window.WorldAtlasAppBridge.reloadPlacesState({
            updateUrl: false,
            allowFallback: false
          });
        }
        renderCommandStatus("Point deleted.", "success");
        return;
      }

      const target = await resolveAdminTargetFromQuery(parsed.targetQuery);

      if (parsed.command === "dossier") {
        await loadTargetDossier(target, { force: true });
        activateAdminTab("ops", { renderOps: false });
        renderCommandStatus("Dossier loaded.", "success");
        return;
      }

      if (parsed.command === "note") {
        await createAdminNote(target, parsed.note);
        await loadTargetDossier(target, { force: true });
        activateAdminTab("ops", { renderOps: false });
        renderCommandStatus("Note saved.", "success");
        return;
      }

      if (parsed.command === "ban") {
        await applyOnlineBanAction({
          action: "ban",
          presenceType: target.presenceType,
          userId: target.userId,
          visitorId: target.visitorId,
          minutes: parsed.minutes === null ? 1440 : parsed.minutes,
          reason: normalizeText(parsed.reason, DEFAULT_BAN_REASON)
        });
        invalidateOnlineBansCache();
        await loadTargetDossier(target, { force: true });
        await refreshOnlineTab({ forceBans: true });
        renderCommandStatus("Ban applied.", "success");
        return;
      }

      if (parsed.command === "unban") {
        await applyOnlineBanAction({
          action: "unban",
          presenceType: target.presenceType,
          userId: target.userId,
          visitorId: target.visitorId,
          minutes: 0,
          reason: ""
        });
        invalidateOnlineBansCache();
        await loadTargetDossier(target, { force: true });
        await refreshOnlineTab({ forceBans: true });
        renderCommandStatus("Ban removed.", "success");
        return;
      }

      if (parsed.command === "freeze") {
        if (target.presenceType === "visitor" || !target.userId) {
          throw new Error("Soft freeze is available only for registered users.");
        }
        await freezeUserAccount(
          target.userId,
          parsed.minutes === null ? 1440 : parsed.minutes,
          normalizeText(parsed.reason, DEFAULT_FREEZE_REASON)
        );
        await loadTargetDossier(target, { force: true });
        await refreshOnlineTab({ forceBans: true });
        renderCommandStatus("Read-only mode enabled.", "success");
        return;
      }

      if (parsed.command === "unfreeze") {
        if (target.presenceType === "visitor" || !target.userId) {
          throw new Error("Soft freeze is available only for registered users.");
        }
        await unfreezeUserAccount(target.userId);
        await loadTargetDossier(target, { force: true });
        await refreshOnlineTab({ forceBans: true });
        renderCommandStatus("Read-only mode removed.", "success");
        return;
      }

      if (parsed.command === "promote") {
        if (target.presenceType === "visitor" || !target.userId) {
          throw new Error("Only registered users can be promoted.");
        }
        await promoteUserAccount(target.userId);
        await loadTargetDossier(target, { force: true });
        renderCommandStatus("User promoted to admin.", "success");
        return;
      }

      if (parsed.command === "cleanup") {
        if (target.presenceType === "visitor" || !target.userId) {
          throw new Error("Cleanup works only for registered users.");
        }
        await cleanupUserContent(target.userId, parsed.reason);
        await loadTargetDossier(target, { force: true });
        await loadGeoModerationRows({ force: true });
        renderCommandStatus("Cleanup completed.", "success");
        return;
      }

      renderCommandStatus("Unknown command.", "error");
    } catch (error) {
      console.error("[supabase-bridge] Admin command failed:", error);
      renderCommandStatus(normalizeText(error?.message, "Command failed."), "error");
    } finally {
      adminOpsState.commandBusy = false;
      if (adminUi.commandRunButton instanceof HTMLButtonElement) {
        adminUi.commandRunButton.disabled = false;
      }
    }
  }

  async function freezeUserAccount(userId, minutes, reason) {
    const { client } = await ensureAdminContext();
    const safeUserId = normalizeText(userId, "");
    if (!safeUserId) {
      throw new Error("User id is required.");
    }

    const { error } = await client.rpc("admin_freeze_user", {
      target_user_id: safeUserId,
      minutes: Number.isFinite(Number(minutes)) ? Math.max(0, Math.floor(Number(minutes))) : null,
      reason: normalizeText(reason, "") || null
    });

    if (error) {
      if (isMissingFunctionLikeError(error) || isMissingRelationError(error)) {
        throw new Error("Run patch_20260410_admin_ops.sql in Supabase to enable soft freeze.");
      }
      throw new Error(formatSupabaseErrorMessage(error, "Failed to freeze user."));
    }
  }

  async function unfreezeUserAccount(userId) {
    const { client } = await ensureAdminContext();
    const safeUserId = normalizeText(userId, "");
    if (!safeUserId) {
      throw new Error("User id is required.");
    }

    const { error } = await client.rpc("admin_unfreeze_user", {
      target_user_id: safeUserId
    });

    if (error) {
      if (isMissingFunctionLikeError(error) || isMissingRelationError(error)) {
        throw new Error("Run patch_20260410_admin_ops.sql in Supabase to enable soft freeze.");
      }
      throw new Error(formatSupabaseErrorMessage(error, "Failed to unfreeze user."));
    }
  }

  async function promoteUserAccount(userId) {
    const { client, user } = await ensureAdminContext();
    const safeUserId = normalizeText(userId, "");
    if (!safeUserId) {
      throw new Error("User id is required.");
    }

    const { error } = await client
      .from("profiles")
      .update({
        role: "admin",
        updated_at: new Date().toISOString()
      })
      .eq("id", safeUserId);

    if (error) {
      throw new Error(formatSupabaseErrorMessage(error, "Failed to promote user."));
    }

    await recordAdminAction(client, {
      actorUserId: normalizeText(user?.id, ""),
      targetUserId: safeUserId,
      action: "promote",
      reason: "promoted to admin"
    });
  }

  async function createAdminNote(target, noteText) {
    const { client, user } = await ensureAdminContext();
    const safeText = normalizeText(noteText, "");
    if (!safeText) {
      throw new Error("Note text is required.");
    }

    const payload = {
      target_user_id: normalizeText(target?.presenceType, "") === "user"
        ? normalizeText(target?.userId, "") || null
        : null,
      target_visitor_id: normalizeText(target?.presenceType, "") === "visitor"
        ? normalizeText(target?.visitorId, "") || null
        : null,
      body: safeText,
      created_by: normalizeText(user?.id, "") || null
    };

    const { error } = await client.from(ADMIN_NOTES_TABLE).insert(payload);
    if (error) {
      if (isMissingRelationError(error)) {
        throw new Error("Run patch_20260410_admin_ops.sql in Supabase to enable admin notes.");
      }
      throw new Error(formatSupabaseErrorMessage(error, "Failed to save admin note."));
    }

    await recordAdminAction(client, {
      actorUserId: normalizeText(user?.id, ""),
      targetUserId: payload.target_user_id,
      targetVisitorId: payload.target_visitor_id,
      action: "note",
      reason: safeText
    });
  }

  async function recordAdminAction(client, payload = {}) {
    if (!client) {
      return;
    }

    const insertPayload = {
      actor_user_id: normalizeText(payload.actorUserId, "") || null,
      target_user_id: normalizeText(payload.targetUserId, "") || null,
      target_visitor_id: normalizeText(payload.targetVisitorId, "") || null,
      action: normalizeText(payload.action, ""),
      reason: normalizeText(payload.reason, "") || null,
      meta: payload.meta && typeof payload.meta === "object" ? payload.meta : {}
    };

    if (!insertPayload.action) {
      return;
    }

    const { error } = await client
      .from(ADMIN_ACTION_LOGS_TABLE)
      .insert(insertPayload);

    if (error && !isMissingRelationError(error)) {
      console.warn("[supabase-bridge] Failed to record admin action:", error);
    }
  }

  async function deletePlaceByReference(placeRef) {
    const { client, user } = await ensureAdminContext();
    const safeRef = normalizeText(placeRef, "");
    if (!safeRef) {
      throw new Error("Point reference is required.");
    }

    let deletedScope = "";
    let deletedId = "";
    let deletedSlug = "";
    let removedStoragePath = "";

    const loadPlaceCandidate = async (tableName) => {
      const safeUuid = normalizeUuid(safeRef);
      const safeSlug = normalizeText(safeRef, "").toLowerCase();
      const queries = [];

      if (safeUuid) {
        queries.push(
          client
            .from(tableName)
            .select("id,slug,image_path")
            .eq("id", safeUuid)
            .limit(1)
        );
      }

      if (safeSlug) {
        queries.push(
          client
            .from(tableName)
            .select("id,slug,image_path")
            .eq("slug", safeSlug)
            .limit(1)
        );
      }

      for (const query of queries) {
        const response = await query;
        if (response?.error) {
          if (isMissingRelationError(response.error)) {
            return null;
          }
          throw new Error(formatSupabaseErrorMessage(response.error, "Failed to resolve point."));
        }
        const row = Array.isArray(response?.data) ? response.data[0] : null;
        if (row) {
          return row;
        }
      }

      return null;
    };

    const deleteFromTable = async (tableName, idColumn, matched) => {
      if (!matched) {
        return false;
      }

      removedStoragePath = normalizeText(matched?.image_path, "");
      deletedId = normalizeText(matched?.id, "");
      deletedSlug = normalizeText(matched?.slug, "").toLowerCase();
      deletedScope = tableName === "places" ? "public" : "user";
      const { error } = await client
        .from(tableName)
        .delete()
        .eq(idColumn, deletedId);
      if (error) {
        throw new Error(formatSupabaseErrorMessage(error, "Failed to delete point."));
      }
      return true;
    };

    const [publicPlaceCandidate, userPlaceCandidate] = await Promise.all([
      loadPlaceCandidate("places"),
      loadPlaceCandidate("user_places")
    ]);

    if (await deleteFromTable("places", "id", publicPlaceCandidate)) {
      if (removedStoragePath) {
        await removeStoragePaths(client, [removedStoragePath]);
      }
      await recordAdminAction(client, {
        actorUserId: normalizeText(user?.id, ""),
        action: "delete-point",
        reason: safeRef,
        meta: {
          scope: deletedScope,
          point_id: deletedId
        }
      });
      dispatchPlacesMutated({
        action: "delete",
        scope: deletedScope,
        removedPlaceIds: deletedId ? [deletedId] : [],
        removedPlaceRefs: Array.from(new Set(
          [safeRef, deletedId, deletedSlug]
            .map((entry) => normalizeText(entry, ""))
            .filter(Boolean)
        ))
      });
      return true;
    }

    if (await deleteFromTable("user_places", "id", userPlaceCandidate)) {
      if (removedStoragePath) {
        await removeStoragePaths(client, [removedStoragePath]);
      }
      await recordAdminAction(client, {
        actorUserId: normalizeText(user?.id, ""),
        action: "delete-point",
        reason: safeRef,
        meta: {
          scope: deletedScope,
          point_id: deletedId
        }
      });
      dispatchPlacesMutated({
        action: "delete",
        scope: deletedScope,
        removedPlaceIds: deletedId ? [deletedId] : [],
        removedPlaceRefs: Array.from(new Set(
          [safeRef, deletedId, deletedSlug]
            .map((entry) => normalizeText(entry, ""))
            .filter(Boolean)
        ))
      });
      return true;
    }

    throw new Error("Point was not found.");
  }

  async function cleanupUserContent(userId, reason = "") {
    const { client, user } = await ensureAdminContext();
    const safeUserId = normalizeText(userId, "");
    if (!safeUserId) {
      throw new Error("User id is required.");
    }

    const [
      userPlacesResult,
      publicPlacesResult,
      visitorRowsResult
    ] = await Promise.all([
      client.from("user_places").select("id,image_path").eq("user_id", safeUserId).limit(500),
      client.from("places").select("id,image_path").eq("created_by", safeUserId).limit(500),
      client.from(VISITOR_STATUS_TABLE).select("visitor_id").eq("user_id", safeUserId).limit(200)
    ]);

    const storagePaths = [];
    const userPlaceIds = [];
    const publicPlaceIds = [];
    const visitorIds = [];

    for (const row of Array.isArray(userPlacesResult?.data) ? userPlacesResult.data : []) {
      const imagePath = normalizeText(row?.image_path, "");
      const placeId = normalizeText(row?.id, "");
      if (imagePath) {
        storagePaths.push(imagePath);
      }
      if (placeId) {
        userPlaceIds.push(placeId);
      }
    }

    for (const row of Array.isArray(publicPlacesResult?.data) ? publicPlacesResult.data : []) {
      const imagePath = normalizeText(row?.image_path, "");
      const placeId = normalizeText(row?.id, "");
      if (imagePath) {
        storagePaths.push(imagePath);
      }
      if (placeId) {
        publicPlaceIds.push(placeId);
      }
    }

    for (const row of Array.isArray(visitorRowsResult?.data) ? visitorRowsResult.data : []) {
      const visitorId = normalizeText(row?.visitor_id, "");
      if (visitorId) {
        visitorIds.push(visitorId);
      }
    }

    const deleteTasks = [
      client.from("reviews").delete().eq("user_id", safeUserId),
      client.from("favorites").delete().eq("user_id", safeUserId),
      client.from("user_places").delete().eq("user_id", safeUserId),
      client.from("places").delete().eq("created_by", safeUserId),
      client.from(ONLINE_STATUS_TABLE).delete().eq("user_id", safeUserId)
    ];

    if (visitorIds.length > 0) {
      deleteTasks.push(
        client.from(VISITOR_STATUS_TABLE).delete().in("visitor_id", visitorIds),
        client.from(VISITOR_BANS_TABLE).delete().in("visitor_id", visitorIds)
      );
    }

    const results = await Promise.all(deleteTasks);
    const failed = results.find((result) => result?.error);
    if (failed?.error) {
      throw new Error(formatSupabaseErrorMessage(failed.error, "Cleanup failed."));
    }

    await removeStoragePaths(client, storagePaths);
    await recordAdminAction(client, {
      actorUserId: normalizeText(user?.id, ""),
      targetUserId: safeUserId,
      action: "cleanup",
      reason: normalizeText(reason, "") || "one-click cleanup",
      meta: {
        user_places_removed: userPlaceIds.length,
        public_places_removed: publicPlaceIds.length,
        visitor_rows_removed: visitorIds.length,
        storage_paths_removed: storagePaths.length
      }
    });

    if (userPlaceIds.length > 0 || publicPlaceIds.length > 0) {
      dispatchPlacesMutated({
        action: "cleanup",
        scope: "mixed",
        removedPlaceIds: [...publicPlaceIds, ...userPlaceIds]
      });
    }
  }

  async function removeStoragePaths(client, paths) {
    const safePaths = Array.from(new Set(
      (Array.isArray(paths) ? paths : [])
        .map((entry) => normalizeText(entry, ""))
        .filter(Boolean)
    ));
    if (!client || safePaths.length === 0) {
      return;
    }

    const bucket = client.storage.from("place-images");
    for (let index = 0; index < safePaths.length; index += 100) {
      const chunk = safePaths.slice(index, index + 100);
      try {
        const { error } = await bucket.remove(chunk);
        if (error) {
          console.warn("[supabase-bridge] Failed to remove storage paths:", error);
        }
      } catch (error) {
        console.warn("[supabase-bridge] Failed to remove storage paths:", error);
      }
    }
  }

  async function loadTargetDossier(target, options = {}) {
    const safeTarget = target && typeof target === "object" ? target : null;
    if (!safeTarget) {
      adminOpsState.selectedTarget = null;
      adminOpsState.dossier = null;
      renderOpsEmptyState("Choose a user from Online or use the command bar.");
      renderNotesEmptyState("Notes will appear here.");
      return null;
    }

    const normalizedTarget = {
      presenceType: normalizePresenceType(safeTarget.presenceType),
      userId: normalizeText(safeTarget.userId, ""),
      visitorId: normalizeText(safeTarget.visitorId, ""),
      email: normalizeText(safeTarget.email, ""),
      displayName: normalizeText(safeTarget.displayName, "")
    };
    const sameTarget =
      adminOpsState.selectedTarget &&
      normalizeText(adminOpsState.selectedTarget.userId, "") === normalizedTarget.userId &&
      normalizeText(adminOpsState.selectedTarget.visitorId, "") === normalizedTarget.visitorId &&
      normalizeText(adminOpsState.selectedTarget.presenceType, "") === normalizedTarget.presenceType;
    if (sameTarget && options.force !== true && adminOpsState.dossier) {
      renderDossierCard(adminOpsState.dossier);
      renderNotesList(adminOpsState.dossier.notes);
      return adminOpsState.dossier;
    }

    adminOpsState.selectedTarget = normalizedTarget;
    adminOpsState.loadingDossier = true;
    renderOpsEmptyState("Loading dossier...");
    renderNotesEmptyState("Loading notes...");

    try {
      const { client } = await ensureAdminContext();
      const isUserTarget = normalizedTarget.presenceType !== "visitor" && Boolean(normalizedTarget.userId);
      const [
        profileResult,
        userStatusResult,
        banResult,
        freezeResult,
        visitorRowsResult,
        reviewsResult,
        userPlacesResult,
        publicPlacesResult,
        favoritesCountResult,
        notes,
        logs
      ] = await Promise.all([
        isUserTarget
          ? client.from("profiles").select("id,email,display_name,role,created_at,updated_at").eq("id", normalizedTarget.userId).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        isUserTarget
          ? client.from(ONLINE_STATUS_TABLE).select("user_id,email,role,last_seen,last_path,user_agent,last_ip").eq("user_id", normalizedTarget.userId).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        isUserTarget
          ? client.from(USER_BANS_TABLE).select("user_id,banned,reason,banned_at,banned_until,updated_at").eq("user_id", normalizedTarget.userId).maybeSingle()
          : client.from(VISITOR_BANS_TABLE).select("visitor_id,banned,reason,banned_at,banned_until,updated_at").eq("visitor_id", normalizedTarget.visitorId).maybeSingle(),
        isUserTarget
          ? client.from(USER_FREEZES_TABLE).select("user_id,frozen,reason,frozen_at,frozen_until,updated_at").eq("user_id", normalizedTarget.userId).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        isUserTarget
          ? client.from(VISITOR_STATUS_TABLE).select("visitor_id,display_name,email,last_seen,last_path,user_agent,last_ip,user_id").eq("user_id", normalizedTarget.userId).order("last_seen", { ascending: false }).limit(8)
          : client.from(VISITOR_STATUS_TABLE).select("visitor_id,display_name,email,last_seen,last_path,user_agent,last_ip,user_id").eq("visitor_id", normalizedTarget.visitorId).limit(1),
        isUserTarget
          ? client.from("reviews").select("id,place_id,rating,comment,created_at,is_deleted").eq("user_id", normalizedTarget.userId).order("created_at", { ascending: false }).limit(8)
          : Promise.resolve({ data: [], error: null }),
        isUserTarget
          ? client.from("user_places").select("id,title,slug,created_at,image_path").eq("user_id", normalizedTarget.userId).order("created_at", { ascending: false }).limit(8)
          : Promise.resolve({ data: [], error: null }),
        isUserTarget
          ? client.from("places").select("id,title,slug,created_at,image_path").eq("created_by", normalizedTarget.userId).order("created_at", { ascending: false }).limit(8)
          : Promise.resolve({ data: [], error: null }),
        isUserTarget
          ? client.from("favorites").select("place_id", { count: "exact", head: true }).eq("user_id", normalizedTarget.userId)
          : Promise.resolve({ count: 0, error: null }),
        loadAdminNotesForTarget(client, normalizedTarget),
        loadAdminLogsForTarget(client, normalizedTarget)
      ]);

      const banRow = banResult?.error ? null : (banResult?.data || null);
      const freezeRow = freezeResult?.error ? null : (freezeResult?.data || null);
      const activeBan = Boolean(banRow) && isTimedStateActive(
        banRow?.banned !== false,
        banRow?.banned_until
      );
      const activeFreeze = Boolean(freezeRow) && isTimedStateActive(
        freezeRow?.frozen !== false,
        freezeRow?.frozen_until
      );

      const dossier = {
        target: normalizedTarget,
        profile: profileResult?.error ? null : profileResult?.data || null,
        userStatus: userStatusResult?.error ? null : userStatusResult?.data || null,
        ban: banResult?.error ? null : banResult?.data || null,
        freeze: freezeResult?.error ? null : freezeResult?.data || null,
        visitorRows: Array.isArray(visitorRowsResult?.data) ? visitorRowsResult.data : [],
        reviews: Array.isArray(reviewsResult?.data) ? reviewsResult.data : [],
        userPlaces: Array.isArray(userPlacesResult?.data) ? userPlacesResult.data : [],
        publicPlaces: Array.isArray(publicPlacesResult?.data) ? publicPlacesResult.data : [],
        favoritesCount: Number(favoritesCountResult?.count) || 0,
        notes,
        logs,
        activeBan,
        activeFreeze,
        suspicionScore: computeSuspicionScore({
          activeBan,
          activeFreeze,
          reviewCount: Array.isArray(reviewsResult?.data) ? reviewsResult.data.length : 0,
          userPlaceCount: Array.isArray(userPlacesResult?.data) ? userPlacesResult.data.length : 0,
          publicPlaceCount: Array.isArray(publicPlacesResult?.data) ? publicPlacesResult.data.length : 0,
          visitorCount: Array.isArray(visitorRowsResult?.data) ? visitorRowsResult.data.length : 0
        })
      };

      adminOpsState.dossier = dossier;
      renderDossierCard(dossier);
      renderNotesList(notes);
      return dossier;
    } catch (error) {
      console.error("[supabase-bridge] Failed to load dossier:", error);
      renderOpsEmptyState(normalizeText(error?.message, "Failed to load dossier."));
      renderNotesEmptyState("Failed to load notes.");
      return null;
    } finally {
      adminOpsState.loadingDossier = false;
    }
  }

  async function loadAdminNotesForTarget(client, target) {
    if (!client) {
      return [];
    }
    const isUserTarget = normalizePresenceType(target?.presenceType) !== "visitor" && normalizeText(target?.userId, "");
    const query = client
      .from(ADMIN_NOTES_TABLE)
      .select("id,target_user_id,target_visitor_id,body,created_by,created_at,updated_at")
      .order("created_at", { ascending: false })
      .limit(12);

    const result = isUserTarget
      ? await query.eq("target_user_id", normalizeText(target?.userId, ""))
      : await query.eq("target_visitor_id", normalizeText(target?.visitorId, ""));

    if (result?.error) {
      if (isMissingRelationError(result.error)) {
        return [];
      }
      throw new Error(formatSupabaseErrorMessage(result.error, "Failed to load admin notes."));
    }
    return Array.isArray(result?.data) ? result.data : [];
  }

  async function loadAdminLogsForTarget(client, target) {
    if (!client) {
      return [];
    }
    const isUserTarget = normalizePresenceType(target?.presenceType) !== "visitor" && normalizeText(target?.userId, "");
    const query = client
      .from(ADMIN_ACTION_LOGS_TABLE)
      .select("id,action,reason,meta,created_at,actor_user_id,target_user_id,target_visitor_id")
      .order("created_at", { ascending: false })
      .limit(8);

    const result = isUserTarget
      ? await query.eq("target_user_id", normalizeText(target?.userId, ""))
      : await query.eq("target_visitor_id", normalizeText(target?.visitorId, ""));

    if (result?.error) {
      if (isMissingRelationError(result.error)) {
        return [];
      }
      throw new Error(formatSupabaseErrorMessage(result.error, "Failed to load admin action logs."));
    }
    return Array.isArray(result?.data) ? result.data : [];
  }

  function computeSuspicionScore(input = {}) {
    let score = 0;
    if (input.activeBan === true) {
      score += 4;
    }
    if (input.activeFreeze === true) {
      score += 2;
    }
    if ((Number(input.userPlaceCount) || 0) + (Number(input.publicPlaceCount) || 0) >= 4) {
      score += 2;
    }
    if ((Number(input.reviewCount) || 0) >= 6) {
      score += 1;
    }
    if ((Number(input.visitorCount) || 0) >= 3) {
      score += 1;
    }
    return score;
  }

  function renderDossierCard(dossier) {
    if (!(adminUi.dossierCard instanceof HTMLElement)) {
      return;
    }
    const safeDossier = dossier && typeof dossier === "object" ? dossier : null;
    if (!safeDossier) {
      renderOpsEmptyState("Choose a user from Online or use the command bar.");
      return;
    }

    const target = safeDossier.target || {};
    const isUserTarget = normalizePresenceType(target.presenceType) !== "visitor";
    const titleText = normalizeText(
      safeDossier.profile?.display_name,
      normalizeText(target.displayName, normalizeText(safeDossier.profile?.email, normalizeText(target.email, "Unknown")))
    );
    const emailText = normalizeText(
      safeDossier.profile?.email,
      normalizeText(target.email, isUserTarget ? normalizeText(target.userId, "unknown") : normalizeText(target.visitorId, "guest"))
    );

    const card = document.createElement("div");
    card.className = "admin-dossier-card";

    const hero = document.createElement("div");
    hero.className = "admin-dossier-card__hero";

    const identity = document.createElement("div");
    identity.className = "admin-dossier-card__identity";

    const title = document.createElement("h4");
    title.className = "admin-dossier-card__title";
    title.textContent = titleText;

    const subline = document.createElement("p");
    subline.className = "admin-dossier-card__subline";
    subline.textContent = isUserTarget
      ? `${emailText} / ${normalizeText(safeDossier.profile?.role, "user")}`
      : `${emailText} / guest / browser`;
    identity.append(title, subline);

    const badges = document.createElement("div");
    badges.className = "admin-dossier-card__badges";
    badges.append(createStatusBadge(
      (safeDossier.userStatus || (safeDossier.visitorRows?.length || 0) > 0) ? "LIVE" : "OFFLINE",
      (safeDossier.userStatus || (safeDossier.visitorRows?.length || 0) > 0) ? "online" : "offline"
    ));
    if (safeDossier.activeBan) {
      badges.append(createStatusBadge("BANNED", "deleted"));
    }
    if (safeDossier.activeFreeze) {
      badges.append(createStatusBadge("READ ONLY", "deleted"));
    }
    hero.append(identity, badges);
    card.append(hero);

    const moderation = document.createElement("div");
    moderation.className = "admin-dossier-card__moderation";

    const moderationTitle = document.createElement("p");
    moderationTitle.className = "admin-dossier-card__section-title";
    moderationTitle.textContent = "Moderation status";
    moderation.append(moderationTitle);

    const moderationGrid = document.createElement("div");
    moderationGrid.className = "admin-dossier-card__moderation-grid";
    const addModerationRow = (label, value) => {
      const row = document.createElement("div");
      row.className = "admin-dossier-card__moderation-row";
      const key = document.createElement("span");
      key.className = "admin-dossier-card__moderation-key";
      key.textContent = label;
      const body = document.createElement("strong");
      body.className = "admin-dossier-card__moderation-value";
      body.textContent = normalizeText(value, "-");
      row.append(key, body);
      moderationGrid.append(row);
    };

    const banUntilText = safeDossier.activeBan
      ? (
        normalizeText(safeDossier.ban?.banned_until, "")
          ? formatBanUntilLabel(safeDossier.ban?.banned_until)
          : "Manual unban required"
      )
      : "No active ban";
    const freezeUntilText = safeDossier.activeFreeze
      ? (
        normalizeText(safeDossier.freeze?.frozen_until, "")
          ? formatBanUntilLabel(safeDossier.freeze?.frozen_until)
          : "Manual unfreeze required"
      )
      : (isUserTarget ? "No active freeze" : "Guests cannot be frozen");

    addModerationRow("Source", isUserTarget ? "Registered user" : "Guest / browser");
    addModerationRow("Ban", safeDossier.activeBan ? "Active" : "Clear");
    addModerationRow(
      "Ban reason",
      safeDossier.activeBan ? normalizeText(safeDossier.ban?.reason, "Blocked by admin") : "No active restriction"
    );
    addModerationRow("Ban ends", banUntilText);
    addModerationRow("Read only", safeDossier.activeFreeze ? "Active" : (isUserTarget ? "Clear" : "Not available"));
    addModerationRow(
      "Freeze reason",
      safeDossier.activeFreeze ? normalizeText(safeDossier.freeze?.reason, "Read-only mode by admin") : (isUserTarget ? "No read-only restriction" : "Not available")
    );
    addModerationRow("Freeze ends", freezeUntilText);
    moderation.append(moderationGrid);
    card.append(moderation);

    const metaLines = [
      isUserTarget
        ? `user id: ${normalizeText(target.userId, "unknown")}`
        : `visitor id: ${normalizeText(target.visitorId, "unknown")}`,
      normalizeText(safeDossier.userStatus?.last_path, "")
        ? `path: ${safeDossier.userStatus.last_path}`
        : (safeDossier.visitorRows?.[0]?.last_path ? `path: ${safeDossier.visitorRows[0].last_path}` : ""),
      normalizeText(safeDossier.userStatus?.last_ip, "")
        ? `ip: ${safeDossier.userStatus.last_ip}`
        : (safeDossier.visitorRows?.[0]?.last_ip ? `ip: ${safeDossier.visitorRows[0].last_ip}` : ""),
      `suspicion score: ${safeDossier.suspicionScore}`
    ].filter(Boolean);

    metaLines.forEach((entry) => {
      const meta = document.createElement("p");
      meta.className = "admin-dossier-card__meta";
      meta.textContent = entry;
      card.append(meta);
    });

    const stats = document.createElement("div");
    stats.className = "admin-dossier-card__stats";
    [
      ["Reviews", safeDossier.reviews?.length || 0],
      ["User places", safeDossier.userPlaces?.length || 0],
      ["Public places", safeDossier.publicPlaces?.length || 0],
      ["Favorites", safeDossier.favoritesCount || 0],
      ["Visitors", safeDossier.visitorRows?.length || 0],
      ["Notes", safeDossier.notes?.length || 0]
    ].forEach(([label, value]) => {
      const stat = document.createElement("div");
      stat.className = "admin-dossier-card__stat";
      const statLabel = document.createElement("span");
      statLabel.className = "admin-dossier-card__stat-label";
      statLabel.textContent = String(label);
      const statValue = document.createElement("strong");
      statValue.className = "admin-dossier-card__stat-value";
      statValue.textContent = String(value);
      stat.append(statLabel, statValue);
      stats.append(stat);
    });
    card.append(stats);

    const actions = document.createElement("div");
    actions.className = "admin-dossier-card__actions";
    actions.append(createDossierActionButton("Ban 24h", "ban-24h"));
    actions.append(createDossierActionButton("Ban perm", "ban-perm"));
    actions.append(createDossierActionButton("Unban", "unban", "restore"));
    if (isUserTarget) {
      actions.append(createDossierActionButton("Freeze 24h", "freeze-24h"));
      actions.append(createDossierActionButton("Freeze perm", "freeze-perm"));
      actions.append(createDossierActionButton("Unfreeze", "unfreeze", "restore"));
      actions.append(createDossierActionButton("Promote", "promote", "restore"));
      actions.append(createDossierActionButton("Cleanup", "cleanup"));
    }
    card.append(actions);

    const activityTitle = document.createElement("p");
    activityTitle.className = "admin-dossier-card__section-title";
    activityTitle.textContent = "Recent admin activity";
    card.append(activityTitle);

    if (Array.isArray(safeDossier.logs) && safeDossier.logs.length > 0) {
      safeDossier.logs.slice(0, 5).forEach((entry) => {
        const meta = document.createElement("p");
        meta.className = "admin-dossier-card__meta";
        meta.textContent = `${formatReviewDateLabel(entry.created_at)} · ${normalizeText(entry.action, "action")} · ${normalizeText(entry.reason, "no reason")}`;
        card.append(meta);
      });
    } else {
      const empty = document.createElement("p");
      empty.className = "admin-dossier-card__meta";
      empty.textContent = "No admin actions yet.";
      card.append(empty);
    }

    adminUi.dossierCard.replaceChildren(card);
  }

  function createStatusBadge(label, tone = "online") {
    const badge = document.createElement("span");
    badge.className = tone === "deleted"
      ? "admin-status-badge admin-status-badge--deleted"
      : (tone === "offline"
        ? "admin-status-badge admin-status-badge--offline"
        : "admin-status-badge admin-status-badge--online");
    badge.textContent = normalizeText(label, "STATUS");
    return badge;
  }

  function createDossierActionButton(label, action, tone = "danger") {
    const button = document.createElement("button");
    const safeAction = normalizeText(action, "");
    button.type = "button";
    button.className = tone === "restore"
      ? "admin-action-btn admin-action-btn--restore"
      : "admin-action-btn admin-action-btn--danger";
    button.dataset.dossierAction = safeAction;
    button.textContent = normalizeText(label, "Action");
    button.title = {
      "ban-24h": "Ban this person for 24 hours.",
      "ban-perm": "Ban this person until a manual unban.",
      unban: "Remove the active ban.",
      "freeze-24h": "Read-only mode for 24 hours.",
      "freeze-perm": "Read-only mode until manual unfreeze.",
      unfreeze: "Remove read-only mode.",
      promote: "Promote this user to admin.",
      cleanup: "Delete this user's reviews, points, photos, favorites and presence tails."
    }[safeAction] || "";
    return button;
  }

  function renderNotesList(notes) {
    if (!(adminUi.notesList instanceof HTMLElement)) {
      return;
    }
    const items = Array.isArray(notes) ? notes : [];
    if (items.length === 0) {
      renderNotesEmptyState("No notes yet.");
      return;
    }

    const fragment = document.createDocumentFragment();
    items.forEach((entry) => {
      const item = document.createElement("li");
      item.className = "admin-note-item";
      const meta = document.createElement("p");
      meta.className = "admin-note-item__meta";
      meta.textContent = `${formatReviewDateLabel(entry.created_at)} · ${normalizeText(entry.created_by, "admin")}`;
      const body = document.createElement("p");
      body.className = "admin-note-item__body";
      body.textContent = normalizeText(entry.body, "Empty note");
      item.append(meta, body);
      fragment.append(item);
    });
    adminUi.notesList.replaceChildren(fragment);
  }

  async function saveAdminNote() {
    if (adminOpsState.noteBusy || !adminOpsState.selectedTarget) {
      return;
    }
    const noteText = normalizeText(adminUi.noteInput?.value, "");
    if (!noteText) {
      showAdminToast("Enter note text first.");
      return;
    }

    adminOpsState.noteBusy = true;
    if (adminUi.noteSaveButton instanceof HTMLButtonElement) {
      adminUi.noteSaveButton.disabled = true;
    }
    try {
      await createAdminNote(adminOpsState.selectedTarget, noteText);
      if (adminUi.noteInput instanceof HTMLTextAreaElement) {
        adminUi.noteInput.value = "";
      }
      await loadTargetDossier(adminOpsState.selectedTarget, { force: true });
      showAdminToast("Note saved");
    } catch (error) {
      showAdminToast(normalizeText(error?.message, "Failed to save note."));
    } finally {
      adminOpsState.noteBusy = false;
      if (adminUi.noteSaveButton instanceof HTMLButtonElement) {
        adminUi.noteSaveButton.disabled = false;
      }
    }
  }

  async function handleDossierActionClick(event) {
    const button = event.target instanceof Element
      ? event.target.closest("button[data-dossier-action]")
      : null;
    if (!(button instanceof HTMLButtonElement) || !adminOpsState.selectedTarget) {
      return;
    }

    const action = normalizeText(button.dataset.dossierAction, "");
    if (!action) {
      return;
    }

    if (action === "cleanup" && !window.confirm("Delete this user's reviews, points, photos, favorites and presence tails?")) {
      return;
    }

    button.disabled = true;
    try {
      const target = adminOpsState.selectedTarget;
      if (action === "ban-24h") {
        await applyOnlineBanAction({ action: "ban", presenceType: target.presenceType, userId: target.userId, visitorId: target.visitorId, minutes: 1440, reason: DEFAULT_BAN_REASON });
      } else if (action === "ban-perm") {
        await applyOnlineBanAction({ action: "ban", presenceType: target.presenceType, userId: target.userId, visitorId: target.visitorId, minutes: 0, reason: DEFAULT_BAN_REASON });
      } else if (action === "unban") {
        await applyOnlineBanAction({ action: "unban", presenceType: target.presenceType, userId: target.userId, visitorId: target.visitorId, minutes: 0, reason: "" });
      } else if (action === "freeze-24h") {
        await freezeUserAccount(target.userId, 1440, DEFAULT_FREEZE_REASON);
      } else if (action === "freeze-perm") {
        await freezeUserAccount(target.userId, 0, DEFAULT_FREEZE_REASON);
      } else if (action === "unfreeze") {
        await unfreezeUserAccount(target.userId);
      } else if (action === "promote") {
        await promoteUserAccount(target.userId);
      } else if (action === "cleanup") {
        await cleanupUserContent(target.userId, "dossier cleanup");
        await loadGeoModerationRows({ force: true });
      }

      invalidateOnlineBansCache();
      await refreshOnlineTab({ forceBans: true });
      await loadTargetDossier(adminOpsState.selectedTarget, { force: true });
      showAdminToast("Action applied");
    } catch (error) {
      console.error("[supabase-bridge] Dossier action failed:", error);
      showAdminToast(normalizeText(error?.message, "Action failed."));
    } finally {
      button.disabled = false;
    }
  }

  async function loadGeoModerationRows(options = {}) {
    if (adminOpsState.geoLoading && options.force !== true) {
      return adminOpsState.geoRows;
    }

    adminOpsState.geoLoading = true;
    try {
      const { client } = await ensureAdminContext();
      const [publicResult, userResult, submissionResult] = await Promise.all([
        client
          .from("places")
          .select("id,slug,title,description,lat,lng,country,region,image_url,image_path,created_at,created_by")
          .order("created_at", { ascending: false })
          .limit(Math.ceil(ADMIN_GEO_LIMIT / 2)),
        client
          .from("user_places")
          .select("id,slug,title,description,lat,lng,country,region,image_url,image_path,created_at,user_id")
          .order("created_at", { ascending: false })
          .limit(Math.ceil(ADMIN_GEO_LIMIT / 3)),
        client
          .from(PLACE_SUBMISSIONS_TABLE)
          .select("id,slug,title,description,lat,lng,country,region,image_url,image_path,created_at,submitter_user_id,submission_state")
          .order("created_at", { ascending: false })
          .limit(Math.ceil(ADMIN_GEO_LIMIT / 3))
      ]);

      if (publicResult?.error) {
        throw new Error(formatSupabaseErrorMessage(publicResult.error, "Failed to load public moderation rows."));
      }
      if (userResult?.error) {
        throw new Error(formatSupabaseErrorMessage(userResult.error, "Failed to load user moderation rows."));
      }
      if (submissionResult?.error && !isMissingRelationError(submissionResult.error)) {
        throw new Error(formatSupabaseErrorMessage(submissionResult.error, "Failed to load point submissions."));
      }

      const creatorIds = new Set();
      const publicRows = Array.isArray(publicResult?.data) ? publicResult.data : [];
      const userRows = Array.isArray(userResult?.data) ? userResult.data : [];
      const submissionRows = (Array.isArray(submissionResult?.data) ? submissionResult.data : []).filter((row) => {
        const submissionState = normalizeText(row?.submission_state, "pending").toLowerCase();
        return submissionState === "pending" || submissionState === "scheduled";
      });
      publicRows.forEach((row) => {
        const creatorId = normalizeText(row?.created_by, "");
        if (creatorId) {
          creatorIds.add(creatorId);
        }
      });
      userRows.forEach((row) => {
        const creatorId = normalizeText(row?.user_id, "");
        if (creatorId) {
          creatorIds.add(creatorId);
        }
      });
      submissionRows.forEach((row) => {
        const creatorId = normalizeText(row?.submitter_user_id, "");
        if (creatorId) {
          creatorIds.add(creatorId);
        }
      });

      const creatorIdList = Array.from(creatorIds);
      const [profilesResult, bansResult, freezesResult] = creatorIdList.length > 0
        ? await Promise.all([
          client.from("profiles").select("id,email,display_name,role").in("id", creatorIdList),
          client.from(USER_BANS_TABLE).select("user_id,banned,banned_until").in("user_id", creatorIdList),
          client.from(USER_FREEZES_TABLE).select("user_id,frozen,frozen_until").in("user_id", creatorIdList)
        ])
        : [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }];

      const profileMap = mapProfilesByKey(profilesResult?.data, "id");
      const bannedUserIds = new Set(
        (Array.isArray(bansResult?.data) ? bansResult.data : [])
          .filter((entry) => isTimedStateActive(entry?.banned !== false, entry?.banned_until))
          .map((entry) => normalizeText(entry?.user_id, ""))
          .filter(Boolean)
      );
      const frozenUserIds = new Set(
        (Array.isArray(freezesResult?.data) ? freezesResult.data : [])
          .filter((entry) => isTimedStateActive(entry?.frozen !== false, entry?.frozen_until))
          .map((entry) => normalizeText(entry?.user_id, ""))
          .filter(Boolean)
      );

      const buildRow = (entry, source) => {
        const creatorId = normalizeText(
          source === "public"
            ? entry?.created_by
            : (source === "submission" ? entry?.submitter_user_id : entry?.user_id),
          ""
        );
        const profile = profileMap.get(creatorId) || {};
        const description = normalizeText(entry?.description, "");
        const hasPhoto = Boolean(normalizeText(entry?.image_url, "") || normalizeText(entry?.image_path, ""));
        const createdAt = normalizeText(entry?.created_at, "");
        const isNew = Number.isFinite(Date.parse(createdAt)) && (Date.now() - Date.parse(createdAt)) <= (72 * 60 * 60 * 1000);
        const suspiciousScore = [
          hasPhoto ? 0 : 1,
          description.length >= 24 ? 0 : 1,
          bannedUserIds.has(creatorId) ? 2 : 0,
          frozenUserIds.has(creatorId) ? 1 : 0,
          normalizeText(entry?.title, "").length >= 4 ? 0 : 1
        ].reduce((sum, value) => sum + value, 0);

        return {
          source,
          id: normalizeText(entry?.id, ""),
          slug: normalizeText(entry?.slug, ""),
          title: normalizeText(entry?.title, "Untitled"),
          description,
          lat: Number(entry?.lat),
          lng: Number(entry?.lng),
          country: normalizeText(entry?.country, ""),
          region: normalizeText(entry?.region, ""),
          creatorId,
          creatorEmail: normalizeText(profile?.email, creatorId || "unknown"),
          creatorName: normalizeText(profile?.display_name, ""),
          createdAt,
          hasPhoto,
          hasDescription: description.length >= 24,
          isNew,
          suspiciousScore,
          isSuspicious: suspiciousScore >= 2,
          submissionState: normalizeText(entry?.submission_state, "")
        };
      };

      adminOpsState.geoRows = [
        ...publicRows.map((row) => buildRow(row, "public")),
        ...userRows.map((row) => buildRow(row, "user")),
        ...submissionRows.map((row) => buildRow(row, "submission"))
      ].sort((left, right) => Date.parse(right.createdAt || "") - Date.parse(left.createdAt || ""));
      adminOpsState.geoLoaded = true;
      applyGeoFilters();
      return adminOpsState.geoRows;
    } catch (error) {
      console.error("[supabase-bridge] Failed to load geo moderation rows:", error);
      renderGeoEmptyState(normalizeText(error?.message, "Failed to load geo moderation."));
      return [];
    } finally {
      adminOpsState.geoLoading = false;
    }
  }

  function applyGeoFilters() {
    const filters = adminOpsState.geoFilters;
    const rows = Array.isArray(adminOpsState.geoRows) ? adminOpsState.geoRows : [];
    const query = normalizeText(filters.query, "").toLowerCase();

    adminOpsState.geoFilteredRows = rows.filter((row) => {
      if (normalizeText(filters.source, "all") !== "all" && row.source !== filters.source) {
        return false;
      }
      if (filters.onlyNew === true && row.isNew !== true) {
        return false;
      }
      if (filters.onlySuspicious === true && row.isSuspicious !== true) {
        return false;
      }
      if (filters.onlyNoPhoto === true && row.hasPhoto === true) {
        return false;
      }
      if (filters.onlyNoDescription === true && row.hasDescription === true) {
        return false;
      }
      if (!query) {
        return true;
      }
      const haystack = [
        row.title,
        row.creatorEmail,
        row.creatorName,
        row.country,
        row.region,
        row.slug
      ].join(" ").toLowerCase();
      return haystack.includes(query);
    });

    if (adminOpsState.geoFilteredRows.length === 0) {
      adminOpsState.selectedGeoRowIndex = -1;
    } else if (
      adminOpsState.selectedGeoRowIndex < 0 ||
      adminOpsState.selectedGeoRowIndex >= adminOpsState.geoFilteredRows.length
    ) {
      adminOpsState.selectedGeoRowIndex = 0;
    }

    syncGeoFilterButtons();
    renderGeoRows(adminOpsState.geoFilteredRows);
    renderGeoMap(adminOpsState.geoFilteredRows);
    renderGeoSummary(
      adminOpsState.selectedGeoRowIndex >= 0
        ? adminOpsState.geoFilteredRows[adminOpsState.selectedGeoRowIndex]
        : null,
      adminOpsState.geoFilteredRows.length
    );
  }

  function syncGeoFilterButtons() {
    const mapping = [
      [adminUi.geoFilterNewButton, adminOpsState.geoFilters.onlyNew],
      [adminUi.geoFilterSuspiciousButton, adminOpsState.geoFilters.onlySuspicious],
      [adminUi.geoFilterNoPhotoButton, adminOpsState.geoFilters.onlyNoPhoto],
      [adminUi.geoFilterNoDescriptionButton, adminOpsState.geoFilters.onlyNoDescription]
    ];
    mapping.forEach(([buttonEl, isActive]) => {
      if (!(buttonEl instanceof HTMLElement)) {
        return;
      }
      buttonEl.classList.toggle("is-active", isActive === true);
      buttonEl.setAttribute("aria-pressed", isActive === true ? "true" : "false");
    });
  }

  function renderGeoRows(rows) {
    if (!(adminUi.geoList instanceof HTMLElement) || !(adminUi.geoCountValue instanceof HTMLElement)) {
      return;
    }
    const items = Array.isArray(rows) ? rows : [];
    adminUi.geoCountValue.textContent = String(items.length);
    if (items.length === 0) {
      renderGeoEmptyState("No places match the current filters.");
      return;
    }

    const fragment = document.createDocumentFragment();
    items.forEach((row, index) => {
      const item = document.createElement("li");
      item.className = "admin-geo-item";
      item.classList.toggle("is-selected", index === adminOpsState.selectedGeoRowIndex);

      const top = document.createElement("div");
      top.className = "admin-geo-item__top";
      const title = document.createElement("h5");
      title.className = "admin-geo-item__title";
      title.textContent = row.title;
      top.append(
        title,
        createStatusBadge(
          row.isSuspicious
            ? "SUSPICIOUS"
            : (row.source === "public"
              ? "PUBLIC"
              : (row.source === "submission" ? "QUEUE" : "USER")),
          row.isSuspicious ? "deleted" : "online"
        )
      );

      const meta = document.createElement("p");
      meta.className = "admin-geo-item__meta";
      meta.textContent = `${row.country || "Unknown country"} / ${row.region || "Unknown region"} / ${row.creatorEmail}`;

      const detail = document.createElement("p");
      detail.className = "admin-geo-item__meta";
      const lat = Number.isFinite(row.lat) ? row.lat.toFixed(2) : "--";
      const lng = Number.isFinite(row.lng) ? row.lng.toFixed(2) : "--";
      detail.textContent = `coords: ${lat}, ${lng} / photo: ${row.hasPhoto ? "yes" : "no"} / description: ${row.hasDescription ? "ok" : "weak"} / score: ${row.suspiciousScore} / ${formatReviewDateLabel(row.createdAt)}`;

      const actions = document.createElement("div");
      actions.className = "admin-actions";
      if (row.creatorId) {
        const dossierButton = document.createElement("button");
        dossierButton.type = "button";
        dossierButton.className = "admin-action-btn";
        dossierButton.dataset.geoAction = "dossier";
        dossierButton.dataset.geoIndex = String(index);
        dossierButton.textContent = "Dossier";
        actions.append(dossierButton);
      }
      if (row.source === "public" || row.source === "submission") {
        const focusButton = document.createElement("button");
        focusButton.type = "button";
        focusButton.className = "admin-action-btn admin-action-btn--restore";
        focusButton.dataset.geoAction = "focus";
        focusButton.dataset.geoIndex = String(index);
        focusButton.textContent = row.source === "submission" ? "Locate" : "Focus";
        actions.append(focusButton);
      }

      item.append(top, meta, detail, actions);
      fragment.append(item);
    });
    adminUi.geoList.replaceChildren(fragment);
  }

  function renderGeoMap(rows) {
    if (!(adminUi.geoMap instanceof HTMLElement)) {
      return;
    }
    adminUi.geoMap.replaceChildren();
    const items = Array.isArray(rows) ? rows : [];
    if (items.length === 0) {
      const empty = document.createElement("div");
      empty.className = "admin-geo-map__empty";
      empty.textContent = "No places match the current filters.";
      adminUi.geoMap.append(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    items.forEach((row, index) => {
      if (!Number.isFinite(row.lat) || !Number.isFinite(row.lng)) {
        return;
      }
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = row.isSuspicious
        ? "admin-geo-map__dot admin-geo-map__dot--suspicious"
        : (row.source === "public"
          ? "admin-geo-map__dot admin-geo-map__dot--public"
          : "admin-geo-map__dot");
      dot.dataset.geoAction = "focus";
      dot.dataset.geoIndex = String(index);
      dot.classList.toggle("is-selected", index === adminOpsState.selectedGeoRowIndex);
      dot.style.left = `${((row.lng + 180) / 360) * 100}%`;
      dot.style.top = `${((90 - row.lat) / 180) * 100}%`;
      dot.title = `${row.title} / ${row.country || "Unknown country"} / ${row.region || "Unknown region"} / ${row.creatorEmail}`;
      fragment.append(dot);
    });
    adminUi.geoMap.append(fragment);
  }

  async function handleGeoListActionClick(event) {
    const button = event.target instanceof Element
      ? event.target.closest("button[data-geo-action]")
      : null;
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }
    await executeGeoAction(
      normalizeText(button.dataset.geoAction, ""),
      Math.max(0, Math.floor(Number(button.dataset.geoIndex) || 0))
    );
  }

  async function handleGeoMapActionClick(event) {
    const button = event.target instanceof Element
      ? event.target.closest("button[data-geo-action]")
      : null;
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }
    await executeGeoAction(
      normalizeText(button.dataset.geoAction, ""),
      Math.max(0, Math.floor(Number(button.dataset.geoIndex) || 0))
    );
  }

  async function executeGeoAction(action, index) {
    const row = Array.isArray(adminOpsState.geoFilteredRows)
      ? adminOpsState.geoFilteredRows[index]
      : null;
    if (!row) {
      return;
    }

    adminOpsState.selectedGeoRowIndex = index;
    renderGeoSummary(row, adminOpsState.geoFilteredRows.length);
    renderGeoRows(adminOpsState.geoFilteredRows);
    renderGeoMap(adminOpsState.geoFilteredRows);

    if (action === "dossier" && row.creatorId) {
      await loadTargetDossier({
        presenceType: "user",
        userId: row.creatorId,
        visitorId: "",
        email: row.creatorEmail,
        displayName: row.creatorName
      }, { force: true });
      activateAdminTab("ops", { renderOps: false });
      return;
    }

    if (action === "focus" && row.source === "submission" && window.WorldAtlasAppBridge?.previewCoordinates) {
      const focused = window.WorldAtlasAppBridge.previewCoordinates(row.lat, row.lng, {
        visibility: "pending",
        targetZoom: 6
      });
      if (!focused) {
        showAdminToast("Unable to preview submission coordinates.");
      }
      return;
    }

    if (action === "focus" && row.source === "public" && window.WorldAtlasAppBridge?.selectPlace) {
      let focused = window.WorldAtlasAppBridge.selectPlace(row.id, {
        panToPlace: true,
        openPopup: true,
        updateUrl: true,
        source: "admin-geo"
      });
      if (!focused && typeof window.WorldAtlasAppBridge?.reloadPlacesState === "function") {
        try {
          await window.WorldAtlasAppBridge.reloadPlacesState();
        } catch (error) {
          console.warn("[supabase-bridge] Failed to reload places before focus:", error);
        }
        focused = window.WorldAtlasAppBridge.selectPlace(row.id, {
          panToPlace: true,
          openPopup: true,
          updateUrl: true,
          source: "admin-geo-reloaded"
        });
      }
      if (!focused) {
        showAdminToast("This point is not loaded in the current map view.");
      }
    }
  }

  async function renderOnlineList(options = {}) {
    if (!(adminUi.onlineList instanceof HTMLElement) || !(adminUi.onlineCountValue instanceof HTMLElement)) {
      return;
    }

    if (!state.isAdmin) {
      adminUi.onlineCountValue.textContent = "0";
      renderOnlineEmptyState("No users online");
      return;
    }

    const renderToken = adminOnlineState.renderToken + 1;
    adminOnlineState.renderToken = renderToken;

    let users = [];
    try {
      users = await loadOnlineUsersFromStatusTable({
        force: options.forceStatusFetch === true
      });
    } catch (error) {
      const fallbackText = `Offline mode: ${normalizeText(error?.message, "Failed to load online users.")}`;
      setOnlinePresenceFallback(true, fallbackText);
      adminUi.onlineCountValue.textContent = "0";
      renderOnlineEmptyState(adminOnlineState.fallbackReason || fallbackText);
      return;
    }

    if (adminOnlineState.renderToken !== renderToken) {
      return;
    }

    adminUi.onlineCountValue.textContent = String(users.length);

    if (users.length === 0) {
      renderOnlineEmptyState(
        adminOnlineState.fallbackMode
          ? adminOnlineState.fallbackReason || "Offline mode: live updates unavailable."
          : "No users online"
      );
      return;
    }

    const currentUserId = normalizeText(adminPresenceState.currentUser?.id, "");
    const fragment = document.createDocumentFragment();
    const previousScrollTop = adminUi.onlineList.scrollTop;

    users.forEach((user) => {
      const isVisitor = user.presence_type === "visitor";
      const isSelf = !isVisitor && currentUserId !== "" && user.user_id === currentUserId;
      const isBanned = user.is_banned === true;
      const isFrozen = user.is_frozen === true;
      const pendingAction = resolvePendingOnlineAction(user);
      const isBusy = pendingAction?.loading === true;
      const statusText = isBanned
        ? (user.is_permanent_ban ? "PERM BANNED" : "BANNED")
        : (isFrozen ? (user.is_permanent_freeze ? "FROZEN" : "TEMP FROZEN") : "ONLINE");

      const item = document.createElement("li");
      item.className = "admin-online-item";
      item.dataset.presenceKey = normalizeText(user.presence_key, "");
      item.classList.toggle(
        "is-selected",
        normalizeText(adminOnlineState.selectedPresenceKey, "") === normalizeText(user.presence_key, "")
      );

      const top = document.createElement("div");
      top.className = "admin-online-item__top";

      const identity = document.createElement("div");
      identity.className = "admin-review-item__identity";

      const email = document.createElement("strong");
      email.className = "admin-online-item__email";
      email.textContent = isVisitor
        ? normalizeText(user.display_name, user.email || "Guest")
        : normalizeText(user.email, user.user_id);

      const identityMeta = document.createElement("span");
      identityMeta.className = "admin-review-item__place";
      identityMeta.textContent = isVisitor
        ? `visitor · ${normalizeText(user.role, "guest")}`
        : `user · ${normalizeText(user.role, "user")}`;
      identity.append(email, identityMeta);
      {
        const identityRole = normalizeText(user.role, isVisitor ? "guest" : "user");
        identityMeta.textContent = isVisitor
          ? `visitor / ${identityRole}`
          : `user / ${identityRole}`;
      }

      const badge = document.createElement("span");
      badge.className = (isBanned || isFrozen)
        ? "admin-status-badge admin-status-badge--deleted"
        : "admin-status-badge admin-status-badge--online";
      badge.textContent = statusText;

      top.append(identity, badge);

      const meta = document.createElement("p");
      meta.className = "admin-online-item__meta";
      meta.textContent = `active ${formatRelativeDuration(user.last_seen_at)} | last seen ${formatReviewDateLabel(user.last_seen_at)}`;

      item.append(top, meta);

      const identityLine = document.createElement("p");
      identityLine.className = "admin-online-item__meta";
      identityLine.textContent = isVisitor
        ? `id: ${normalizeText(user.visitor_id, "unknown")}`
        : `id: ${normalizeText(user.user_id, "unknown")}`;
      item.append(identityLine);

      if (normalizeText(user.display_name, "") && user.display_name !== user.email) {
        const displayNameLine = document.createElement("p");
        displayNameLine.className = "admin-online-item__meta";
        displayNameLine.textContent = `name: ${user.display_name}`;
        item.append(displayNameLine);
      }

      if (isVisitor && normalizeText(user.last_path, "")) {
        const pathLine = document.createElement("p");
        const safePath = normalizeText(user.last_path, "/");
        pathLine.className = "admin-online-item__meta admin-online-item__meta--path";
        pathLine.textContent = `path: ${safePath}`;
        pathLine.title = safePath;
        item.append(pathLine);
      }

      if (normalizeText(user.last_ip, "")) {
        const ipLine = document.createElement("p");
        ipLine.className = "admin-online-item__meta";
        ipLine.textContent = `ip: ${user.last_ip}`;
        item.append(ipLine);
      }

      const locationBits = [
        normalizeText(user.last_country, ""),
        normalizeText(user.last_region, ""),
        normalizeText(user.last_city, "")
      ].filter(Boolean);
      if (locationBits.length > 0) {
        const locationLine = document.createElement("p");
        locationLine.className = "admin-online-item__meta";
        locationLine.textContent = `geo: ${locationBits.join(" / ")}`;
        item.append(locationLine);
      }

      if (isBanned) {
        const reason = normalizeText(user.ban_reason, "");
        const sinceText = formatBanSinceLabel(user.banned_at);
        const untilText = user.is_permanent_ban === true
          ? "until manual unban"
          : formatBanUntilLabel(user.banned_until);
        const banSourceMeta = document.createElement("p");
        banSourceMeta.className = "admin-online-item__meta";
        banSourceMeta.textContent = `ban source: ${isVisitor ? "guest / browser" : "registered user"}`;
        const banWindowMeta = document.createElement("p");
        banWindowMeta.className = "admin-online-item__meta";
        banWindowMeta.textContent = `ban window: ${sinceText} / ${untilText}`;
        const banReasonMeta = document.createElement("p");
        banReasonMeta.className = "admin-online-item__meta admin-online-item__meta--reason";
        banReasonMeta.textContent = `ban reason: ${reason || "Blocked by admin"}`;
        item.append(banSourceMeta, banWindowMeta, banReasonMeta);
      }

      if (isFrozen) {
        const reason = normalizeText(user.freeze_reason, "");
        const sinceText = formatBanSinceLabel(user.frozen_at);
        const untilText = user.is_permanent_freeze === true
          ? "read-only until manual unfreeze"
          : formatBanUntilLabel(user.frozen_until);
        const freezeWindowMeta = document.createElement("p");
        freezeWindowMeta.className = "admin-online-item__meta";
        freezeWindowMeta.textContent = `freeze window: ${sinceText} / ${untilText}`;
        const freezeReasonMeta = document.createElement("p");
        freezeReasonMeta.className = "admin-online-item__meta admin-online-item__meta--reason";
        freezeReasonMeta.textContent = `freeze reason: ${reason || "Read-only mode by admin"}`;
        item.append(freezeWindowMeta, freezeReasonMeta);
      }

      if (!isSelf) {
        const actions = document.createElement("div");
        actions.className = "admin-actions";

        actions.append(
          createOnlineActionButton({
            label: "Dossier",
            action: "dossier",
            userId: user.user_id,
            visitorId: user.visitor_id,
            presenceType: user.presence_type,
            tone: "",
            email: user.email,
            displayName: user.display_name,
            disabled: false
          })
        );

        if (!isBanned) {
          actions.append(createOnlineBanMenu(user, { disabled: isBusy }));
        }

        actions.append(
          createOnlineActionButton({
            label: isBusy && isBanned ? "Working..." : "Unban",
            action: "unban",
            userId: user.user_id,
            visitorId: user.visitor_id,
            presenceType: user.presence_type,
            tone: "restore",
            disabled: isBusy || !isBanned,
            disabledTitle: !isBanned ? "Entry is not banned." : ""
          })
        );
        item.append(actions);
      }

      if (isSelf) {
        const selfMeta = document.createElement("p");
        selfMeta.className = "admin-online-item__meta";
        selfMeta.textContent = "You cannot ban yourself.";
        item.append(selfMeta);
      }

      if (pendingAction && !isSelf) {
        item.append(createOnlineConfirmPanel(user, pendingAction));
      }

      fragment.append(item);
    });

    adminUi.onlineList.replaceChildren(fragment);
    adminUi.onlineList.scrollTop = previousScrollTop;
  }

  function renderOnlineEmptyState(text) {
    if (!(adminUi.onlineList instanceof HTMLElement)) {
      return;
    }

    const item = document.createElement("li");
    item.className = "admin-online-item";

    const safeText = normalizeText(text, "No users online");
    if (safeText.toLowerCase().includes("offline mode")) {
      const top = document.createElement("div");
      top.className = "admin-online-item__top";

      const badge = document.createElement("span");
      badge.className = "admin-status-badge admin-status-badge--offline";
      badge.textContent = "SYNCING";
      top.append(badge);
      item.append(top);
    }

    const meta = document.createElement("p");
    meta.className = "admin-online-item__meta";
    meta.textContent = safeText;

    item.append(meta);
    adminUi.onlineList.replaceChildren(item);
  }

  function createOnlineActionButton(options) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = options.tone === "restore"
      ? "admin-action-btn admin-action-btn--restore"
      : (options.tone === "danger"
        ? "admin-action-btn admin-action-btn--danger"
        : "admin-action-btn");
    button.textContent = normalizeText(options.label, "Action");
    button.dataset.onlineAction = normalizeText(options.action, "");
    button.dataset.userId = normalizeText(options.userId, "");
    button.dataset.visitorId = normalizeText(options.visitorId, "");
    button.dataset.presenceType = normalizePresenceType(options.presenceType);
    button.dataset.email = normalizeText(options.email, "");
    button.dataset.displayName = normalizeText(options.displayName, "");
    button.disabled = options.disabled === true || !state.isAdmin;

    const disabledTitle = normalizeText(options.disabledTitle, "");
    if (button.disabled && disabledTitle) {
      button.title = disabledTitle;
    }

    return button;
  }

  function createOnlineBanMenu(user, options = {}) {
    const details = document.createElement("details");
    details.className = "admin-ban-menu";

    const summary = document.createElement("summary");
    summary.className = "admin-ban-menu__summary";
    summary.textContent = options.disabled === true ? "Working..." : "Ban";
    if (options.disabled === true) {
      summary.setAttribute("aria-disabled", "true");
    }

    const list = document.createElement("div");
    list.className = "admin-ban-menu__list";

    const timedVisitorBanSupported = (
      normalizePresenceType(user?.presence_type) !== "visitor" ||
      adminOnlineState.supportsTimedVisitorBans !== false
    );
    const timedVisitorDisabledTitle = normalizePresenceType(user?.presence_type) === "visitor" &&
      adminOnlineState.supportsTimedVisitorBans === false
      ? "Run patch_20260410_ban_system.sql in Supabase to enable timed guest bans."
      : "";

    [
      { label: "Ban 1 hour", minutes: "60" },
      { label: "Ban 24 hours", minutes: "1440" },
      { label: "Ban permanently", minutes: "0" }
    ].forEach((entry) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "admin-ban-option";
      button.textContent = entry.label;
      button.dataset.onlineAction = "prepare-ban";
      button.dataset.banMinutes = entry.minutes;
      button.dataset.userId = normalizeText(user.user_id, "");
      button.dataset.visitorId = normalizeText(user.visitor_id, "");
      button.dataset.presenceType = normalizePresenceType(user.presence_type);
      const isTimedBan = entry.minutes !== "0";
      const isTimedVisitorBanDisabled = isTimedBan && !timedVisitorBanSupported;
      button.disabled = options.disabled === true || isTimedVisitorBanDisabled;
      if (isTimedVisitorBanDisabled && timedVisitorDisabledTitle) {
        button.title = timedVisitorDisabledTitle;
      }
      list.append(button);
    });

    details.append(summary, list);
    return details;
  }

  function createOnlineConfirmPanel(user, pendingAction) {
    const panel = document.createElement("div");
    panel.className = "admin-inline-confirm";

    const title = document.createElement("p");
    title.className = "admin-inline-confirm__title";
    title.textContent = pendingAction.minutes > 0
      ? `Confirm ban for ${formatBanMinutesLabel(pendingAction.minutes)}`
      : "Confirm permanent ban";

    const row = document.createElement("div");
    row.className = "admin-inline-confirm__row";

    const input = document.createElement("textarea");
    input.className = "text-input admin-inline-confirm__reason";
    input.maxLength = 180;
    input.rows = 2;
    input.placeholder = "Reason shown to the user on the banned page";
    input.value = normalizeText(pendingAction.reason, "");
    input.dataset.banReasonInput = "true";

    const templateWrap = document.createElement("div");
    templateWrap.className = "admin-inline-confirm__templates";
    const templates = pendingAction.mode === "freeze"
      ? FREEZE_REASON_TEMPLATES
      : BAN_REASON_TEMPLATES;
    templates.forEach((template) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "admin-inline-confirm__template";
      chip.textContent = template;
      chip.dataset.onlineAction = "apply-template";
      chip.dataset.templateValue = template;
      chip.dataset.userId = normalizeText(user.user_id, "");
      chip.dataset.visitorId = normalizeText(user.visitor_id, "");
      chip.dataset.presenceType = normalizePresenceType(user.presence_type);
      templateWrap.append(chip);
    });

    const actions = document.createElement("div");
    actions.className = "admin-inline-confirm__actions";

    const confirmButton = document.createElement("button");
    confirmButton.type = "button";
    confirmButton.className = "admin-inline-confirm__btn admin-inline-confirm__btn--danger";
    confirmButton.textContent = pendingAction.loading === true ? "Applying..." : "Confirm";
    confirmButton.dataset.onlineAction = "confirm-ban";
    confirmButton.dataset.userId = normalizeText(user.user_id, "");
    confirmButton.dataset.visitorId = normalizeText(user.visitor_id, "");
    confirmButton.dataset.presenceType = normalizePresenceType(user.presence_type);
    confirmButton.dataset.banMinutes = String(pendingAction.minutes);
    confirmButton.disabled = pendingAction.loading === true;

    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.className = "admin-inline-confirm__btn admin-inline-confirm__btn--ghost";
    cancelButton.textContent = "Cancel";
    cancelButton.dataset.onlineAction = "cancel-ban";
    cancelButton.dataset.userId = normalizeText(user.user_id, "");
    cancelButton.dataset.visitorId = normalizeText(user.visitor_id, "");
    cancelButton.dataset.presenceType = normalizePresenceType(user.presence_type);
    cancelButton.disabled = pendingAction.loading === true;

    actions.append(confirmButton, cancelButton);
    row.append(input, templateWrap, actions);
    panel.append(title, row);
    return panel;
  }

  function resolvePendingOnlineAction(user) {
    const pending = adminOnlineState.pendingAction;
    if (!pending || typeof pending !== "object") {
      return null;
    }
    const presenceKey = normalizeText(user?.presence_key, "");
    return normalizeText(pending.presenceKey, "") === presenceKey
      ? pending
      : null;
  }

  function handleOnlineReasonInput(event) {
    const target = event.target;
    if (!(target instanceof HTMLTextAreaElement) || target.dataset.banReasonInput !== "true") {
      return;
    }
    if (!adminOnlineState.pendingAction) {
      return;
    }
    adminOnlineState.pendingAction = {
      ...adminOnlineState.pendingAction,
      reason: normalizeText(target.value, "")
    };
  }

  function shouldPauseOnlineListRefresh() {
    return Boolean(
      (
        adminOnlineState.pendingAction &&
        adminOnlineState.pendingAction.loading !== true
      ) ||
      normalizeText(adminOnlineState.selectedPresenceKey, "") !== ""
    );
  }

  async function loadOnlineUsersFromStatusTable(options = {}) {
    const forceFetch = options.force === true;
    const now = Date.now();
    if (
      !forceFetch &&
      Array.isArray(adminOnlineState.statusRows) &&
      adminOnlineState.statusRowsFetchedAt > 0 &&
      now - adminOnlineState.statusRowsFetchedAt < ONLINE_STATUS_CACHE_TTL_MS
    ) {
      return adminOnlineState.statusRows.slice();
    }

    const client = await ensureAdminClient();
    await resolveOnlineModerationCapabilities(client, {
      force: forceFetch
    });
    let rows = [];
    let queryError = null;

    const extendedSelectClause = "presence_key,presence_type,user_id,visitor_id,email,display_name,role,last_seen,last_path,user_agent,last_ip,last_country,last_region,last_city,last_lat,last_lng,is_registered,is_banned,ban_reason,banned_at,banned_until,is_permanent_ban,is_frozen,freeze_reason,frozen_at,frozen_until,is_permanent_freeze";
    const legacySelectClause = "presence_key,presence_type,user_id,visitor_id,email,display_name,role,last_seen,is_registered,is_banned,ban_reason,banned_at";
    const selectVariants = adminOnlineState.presenceViewSupportsExtendedFields === false
      ? [legacySelectClause]
      : adminOnlineState.presenceViewSupportsExtendedFields === true
        ? [extendedSelectClause]
        : [extendedSelectClause, legacySelectClause];

    for (const selectClause of selectVariants) {
      const viewResponse = await client
        .from(ONLINE_PRESENCE_VIEW)
        .select(selectClause)
        .order("last_seen", { ascending: false })
        .limit(500);
      rows = Array.isArray(viewResponse?.data) ? viewResponse.data : [];
      queryError = viewResponse?.error || null;
      if (!queryError) {
        adminOnlineState.presenceViewSupportsExtendedFields = selectClause === extendedSelectClause;
        break;
      }
      if (!isMissingColumnError(queryError)) {
        break;
      }
      adminOnlineState.presenceViewSupportsExtendedFields = false;
    }

    if (queryError && isMissingRelationError(queryError)) {
      const fallbackResponse = await client
        .from(ONLINE_STATUS_TABLE)
        .select("user_id,email,last_seen,role")
        .order("last_seen", { ascending: false })
        .limit(500);
      rows = Array.isArray(fallbackResponse?.data) ? fallbackResponse.data : [];
      queryError = fallbackResponse?.error || null;
    }

    if (queryError) {
      throw new Error(formatSupabaseErrorMessage(queryError, "Failed to load online users."));
    }

    const normalizedUsers = normalizeOnlineStatusRows(rows);
    adminOnlineState.statusRows = normalizedUsers.slice();
    adminOnlineState.statusRowsFetchedAt = Date.now();
    return normalizedUsers;
  }

  async function resolveOnlineModerationCapabilities(client, options = {}) {
    const now = Date.now();
    if (
      options.force !== true &&
      adminOnlineState.capabilitiesCheckedAt > 0 &&
      now - adminOnlineState.capabilitiesCheckedAt < ONLINE_CAPABILITIES_CACHE_TTL_MS
    ) {
      return {
        supportsTimedVisitorBans: adminOnlineState.supportsTimedVisitorBans !== false
      };
    }

    let supportsTimedVisitorBans = true;
    try {
      const response = await client
        .from(VISITOR_BANS_TABLE)
        .select("banned_until")
        .limit(1);
      if (response?.error && isMissingColumnError(response.error)) {
        supportsTimedVisitorBans = false;
      }
    } catch {
      supportsTimedVisitorBans = false;
    }

    adminOnlineState.supportsTimedVisitorBans = supportsTimedVisitorBans;
    adminOnlineState.capabilitiesCheckedAt = now;

    return {
      supportsTimedVisitorBans
    };
  }

  function normalizeOnlineStatusRows(rows) {
    const byPresenceKey = new Map();
    const now = Date.now();

    (Array.isArray(rows) ? rows : []).forEach((entry) => {
      const presenceType = normalizePresenceType(entry?.presence_type);
      const userId = normalizeText(entry?.user_id, normalizeText(entry?.userId, ""));
      const visitorId = normalizeText(entry?.visitor_id, "");
      const presenceKey = normalizeText(
        entry?.presence_key,
        presenceType === "visitor"
          ? `visitor:${visitorId}`
          : `user:${userId}`
      );
      if (!presenceKey) {
        return;
      }

      const lastSeenRaw = normalizeText(entry?.last_seen, normalizeText(entry?.lastSeen, ""));
      const lastSeenMs = Date.parse(lastSeenRaw);
      if (!isOnlineStatusActive(lastSeenMs, now)) {
        return;
      }

      const safeLastSeenIso = Number.isFinite(lastSeenMs)
        ? new Date(lastSeenMs).toISOString()
        : new Date(now).toISOString();
      const nextRecord = {
        presence_key: presenceKey,
        presence_type: presenceType,
        user_id: userId,
        visitor_id: visitorId,
        display_name: normalizeText(
          entry?.display_name,
          presenceType === "visitor"
            ? resolveGuestLabel(visitorId)
            : normalizeText(entry?.email, userId)
        ),
        email: normalizeText(
          entry?.email,
          presenceType === "visitor"
            ? resolveGuestLabel(visitorId)
            : userId
        ),
        role: resolveOnlineRole(userId, entry?.role, presenceType),
        last_seen_at: safeLastSeenIso,
        last_seen_ms: Number.isFinite(lastSeenMs) ? lastSeenMs : now,
        last_path: normalizeText(entry?.last_path, ""),
        user_agent: normalizeText(entry?.user_agent, ""),
        last_ip: normalizeText(entry?.last_ip, ""),
        last_country: normalizeText(entry?.last_country, ""),
        last_region: normalizeText(entry?.last_region, ""),
        last_city: normalizeText(entry?.last_city, ""),
        last_lat: Number(entry?.last_lat),
        last_lng: Number(entry?.last_lng),
        is_registered: entry?.is_registered !== false && presenceType !== "visitor",
        is_banned: entry?.is_banned === true,
        ban_reason: normalizeText(entry?.ban_reason, ""),
        banned_at: normalizeText(entry?.banned_at, ""),
        banned_until: normalizeText(entry?.banned_until, ""),
        is_permanent_ban: entry?.is_permanent_ban === true,
        is_frozen: entry?.is_frozen === true,
        freeze_reason: normalizeText(entry?.freeze_reason, ""),
        frozen_at: normalizeText(entry?.frozen_at, ""),
        frozen_until: normalizeText(entry?.frozen_until, ""),
        is_permanent_freeze: entry?.is_permanent_freeze === true
      };

      const currentRecord = byPresenceKey.get(presenceKey);
      if (!currentRecord || nextRecord.last_seen_ms >= currentRecord.last_seen_ms) {
        byPresenceKey.set(presenceKey, nextRecord);
      }
    });

    return stabilizeOnlineUserOrder(Array.from(byPresenceKey.values()));
  }

  function stabilizeOnlineUserOrder(rows) {
    const items = Array.isArray(rows) ? rows.slice() : [];
    const previousOrder = Array.isArray(adminOnlineState.displayOrder)
      ? adminOnlineState.displayOrder
      : [];
    const previousIndexMap = new Map(
      previousOrder.map((presenceKey, index) => [normalizeText(presenceKey, ""), index])
    );
    const pendingPresenceKey = normalizeText(adminOnlineState.pendingAction?.presenceKey, "");
    const selectedPresenceKey = normalizeText(adminOnlineState.selectedPresenceKey, "");

    items.sort((left, right) => {
      const leftKey = normalizeText(left?.presence_key, "");
      const rightKey = normalizeText(right?.presence_key, "");
      const leftIndex = previousIndexMap.get(leftKey);
      const rightIndex = previousIndexMap.get(rightKey);
      const leftKnown = Number.isInteger(leftIndex);
      const rightKnown = Number.isInteger(rightIndex);

      if (leftKey && rightKey && leftKey === pendingPresenceKey && rightKey !== pendingPresenceKey) {
        return -1;
      }
      if (leftKey && rightKey && rightKey === pendingPresenceKey && leftKey !== pendingPresenceKey) {
        return 1;
      }
      if (
        selectedPresenceKey &&
        leftKey &&
        rightKey &&
        leftKey === selectedPresenceKey &&
        rightKey !== selectedPresenceKey &&
        rightKey !== pendingPresenceKey
      ) {
        return -1;
      }
      if (
        selectedPresenceKey &&
        leftKey &&
        rightKey &&
        rightKey === selectedPresenceKey &&
        leftKey !== selectedPresenceKey &&
        leftKey !== pendingPresenceKey
      ) {
        return 1;
      }
      if (leftKnown && rightKnown) {
        return leftIndex - rightIndex;
      }
      if (leftKnown) {
        return -1;
      }
      if (rightKnown) {
        return 1;
      }
      return (Number(right?.last_seen_ms) || 0) - (Number(left?.last_seen_ms) || 0);
    });

    adminOnlineState.displayOrder = items
      .map((entry) => normalizeText(entry?.presence_key, ""))
      .filter(Boolean);
    return items;
  }

  function isOnlineStatusActive(lastSeenMs, nowMs = Date.now()) {
    if (!Number.isFinite(lastSeenMs) || lastSeenMs <= 0) {
      return false;
    }

    const elapsedMs = Math.max(0, nowMs - lastSeenMs);
    return elapsedMs < ONLINE_ACTIVE_WINDOW_MS;
  }

  function resolveOnlineRole(userId, rawRole, presenceType = "user") {
    const directRole = normalizeText(rawRole, "").toLowerCase();
    if (directRole) {
      return directRole;
    }

    if (presenceType === "visitor") {
      return "guest";
    }

    const selfUserId = normalizeText(adminPresenceState.currentUser?.id, "");
    if (selfUserId && selfUserId === userId && adminPresenceState.isAdmin) {
      return "admin";
    }

    return "user";
  }

  function normalizePresenceType(value) {
    return normalizeText(value, "").toLowerCase() === "visitor"
      ? "visitor"
      : "user";
  }

  function resolveGuestLabel(visitorId) {
    const safeVisitorId = normalizeText(visitorId, "");
    if (!safeVisitorId) {
      return "Guest";
    }
    return `Guest ${safeVisitorId.slice(-6).toUpperCase()}`;
  }

  async function startOnlinePresence(session) {
    const user = session?.user || adminPresenceState.currentUser || state.session?.user || null;
    const userId = normalizeText(user?.id, "");
    if (!userId) {
      adminOnlineState.shouldMaintainPresence = false;
      await stopOnlinePresence({ preserveFallback: false });
      return;
    }
    adminOnlineState.shouldMaintainPresence = true;
    adminOnlineState.trackedUserId = userId;

    let client = null;
    try {
      client = await ensureAdminClient();
    } catch (error) {
      console.error("[supabase-bridge] Failed to resolve client for online status:", error);
      setOnlinePresenceFallback(true, "Offline mode: Supabase client unavailable.");
      scheduleOnlinePresenceReconnect("client-unavailable");
      if (
        !shouldPauseOnlineListRefresh() &&
        adminOnlineState.activeTab === "online" &&
        state.isAdmin &&
        state.isAdminDrawerOpen
      ) {
        await renderOnlineList({ forceBansFetch: false, forceStatusFetch: false });
      }
      return;
    }

    try {
      await upsertOwnOnlineStatus(client, user);
      adminOnlineState.statusRowsFetchedAt = 0;
      clearOnlinePresenceReconnectTimer(true);
    } catch (error) {
      console.error("[supabase-bridge] Failed to upsert user_status:", error);
      setOnlinePresenceFallback(true, `Offline mode: ${normalizeText(error?.message, "Failed to update user status.")}`);
      scheduleOnlinePresenceReconnect("status-upsert-failed");
    }

    startOnlinePresenceHeartbeat(user);

    if (state.isAdmin) {
      await ensureOnlineStatusRealtimeSubscription(client);
    } else if (adminOnlineState.realtimeChannel) {
      clearOnlineRealtimeRefreshTimer();
      try {
        if (typeof client.removeChannel === "function") {
          await client.removeChannel(adminOnlineState.realtimeChannel);
        }
      } catch (error) {
        console.error("[supabase-bridge] Failed to remove user_status channel for non-admin session:", error);
      } finally {
        adminOnlineState.realtimeChannel = null;
        adminOnlineState.realtimeStatus = "idle";
      }
    }

    if (
      !shouldPauseOnlineListRefresh() &&
      adminOnlineState.activeTab === "online" &&
      state.isAdmin &&
      state.isAdminDrawerOpen
    ) {
      await renderOnlineList({
        forceBansFetch: false,
        forceStatusFetch: true
      });
    }
  }

  function isOnlinePresenceChannelPendingOrReady(status) {
    const safeStatus = normalizeText(status, "").toUpperCase();
    return safeStatus === "SUBSCRIBED" || safeStatus === "CONNECTING";
  }

  async function ensureOnlineStatusRealtimeSubscription(client) {
    if (!state.isAdmin || !adminOnlineState.shouldMaintainPresence) {
      return;
    }

    if (!client || typeof client.channel !== "function") {
      setOnlinePresenceFallback(true, "Offline mode: Realtime is not supported by this client.");
      scheduleOnlinePresenceReconnect("client-no-channel");
      return;
    }

    if (
      adminOnlineState.realtimeChannel &&
      isOnlinePresenceChannelPendingOrReady(adminOnlineState.realtimeStatus)
    ) {
      return;
    }

    if (adminOnlineState.realtimeChannel) {
      const staleChannel = adminOnlineState.realtimeChannel;
      adminOnlineState.realtimeChannel = null;
      adminOnlineState.realtimeStatus = "idle";
      clearOnlineRealtimeRefreshTimer();
      try {
        if (typeof client.removeChannel === "function") {
          await client.removeChannel(staleChannel);
        }
      } catch (error) {
        console.error("[supabase-bridge] Failed to remove stale user_status channel:", error);
      }
    }

    let channel = null;
    try {
      channel = client.channel(ONLINE_STATUS_REALTIME_CHANNEL);
    } catch (error) {
      console.error("[supabase-bridge] Failed to create user_status realtime channel:", error);
      setOnlinePresenceFallback(true, "Offline mode: Realtime channel is unavailable.");
      scheduleOnlinePresenceReconnect("channel-create-failed");
      return;
    }

    bindOnlinePresenceEvents(channel);
    adminOnlineState.realtimeChannel = channel;
    adminOnlineState.realtimeStatus = "CONNECTING";

    channel.subscribe((status, subscribeError) => {
      void handleOnlinePresenceSubscribeStatus(channel, status, subscribeError);
    });
  }

  async function handleOnlinePresenceSubscribeStatus(channel, status, subscribeError = null) {
    if (adminOnlineState.realtimeChannel !== channel) {
      return;
    }

    const safeStatus = normalizeText(status, "unknown").toUpperCase();
    adminOnlineState.realtimeStatus = safeStatus;

    if (subscribeError) {
      console.error("[supabase-bridge] user_status subscribe callback error:", subscribeError);
    }

    if (safeStatus === "SUBSCRIBED") {
      clearOnlinePresenceReconnectTimer(true);
      setOnlinePresenceFallback(false, "");
      adminOnlineState.statusRowsFetchedAt = 0;
      if (
        !shouldPauseOnlineListRefresh() &&
        adminOnlineState.activeTab === "online" &&
        state.isAdmin &&
        state.isAdminDrawerOpen
      ) {
        await renderOnlineList({
          forceBansFetch: false,
          forceStatusFetch: true
        });
      }
      return;
    }

    if (safeStatus === "CHANNEL_ERROR" || safeStatus === "TIMED_OUT" || safeStatus === "CLOSED") {
      console.warn("[supabase-bridge] user_status subscribe status:", safeStatus, subscribeError || "");
      scheduleOnlinePresenceReconnect(safeStatus, channel);
    }
  }

  function bindOnlinePresenceEvents(channel) {
    if (!channel || typeof channel.on !== "function") {
      return;
    }

    [
      ONLINE_STATUS_TABLE,
      VISITOR_STATUS_TABLE,
      USER_BANS_TABLE,
      USER_FREEZES_TABLE,
      VISITOR_BANS_TABLE
    ].forEach((tableName) => {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: tableName },
        () => {
          scheduleOnlineRealtimeRefresh(channel);
        }
      );
    });
  }

  function scheduleOnlineRealtimeRefresh(channel) {
    if (adminOnlineState.realtimeChannel !== channel) {
      return;
    }

    adminOnlineState.statusRowsFetchedAt = 0;
    if (adminOnlineState.realtimeRefreshTimerId) {
      return;
    }

    adminOnlineState.realtimeRefreshTimerId = window.setTimeout(() => {
      adminOnlineState.realtimeRefreshTimerId = null;
      if (adminOnlineState.realtimeChannel !== channel) {
        return;
      }

      if (
        !shouldPauseOnlineListRefresh() &&
        adminOnlineState.activeTab === "online" &&
        state.isAdmin &&
        state.isAdminDrawerOpen
      ) {
        void renderOnlineList({
          forceBansFetch: false,
          forceStatusFetch: true
        });
      }
    }, ONLINE_REALTIME_REFRESH_DEBOUNCE_MS);
  }

  function clearOnlineRealtimeRefreshTimer() {
    if (adminOnlineState.realtimeRefreshTimerId) {
      window.clearTimeout(adminOnlineState.realtimeRefreshTimerId);
      adminOnlineState.realtimeRefreshTimerId = null;
    }
  }

  function scheduleOnlinePresenceReconnect(reason, channel = null) {
    if (channel && adminOnlineState.realtimeChannel !== channel) {
      return;
    }
    if (!adminOnlineState.shouldMaintainPresence) {
      return;
    }
    if (adminOnlineState.reconnectTimerId) {
      return;
    }

    clearOnlineRealtimeRefreshTimer();
    adminOnlineState.reconnectAttempt += 1;
    const expDelay = ONLINE_RECONNECT_BASE_MS * (2 ** Math.max(0, adminOnlineState.reconnectAttempt - 1));
    const jitter = Math.floor(Math.random() * ONLINE_RECONNECT_JITTER_MS);
    const delayMs = Math.min(ONLINE_RECONNECT_MAX_MS, expDelay) + jitter;
    const reasonText = normalizeText(reason, "connection-error");
    const fallbackText = `Offline mode: Realtime unavailable (${reasonText}). Retrying in ${Math.ceil(delayMs / 1000)}s.`;

    setOnlinePresenceFallback(true, fallbackText);
    const now = Date.now();
    if (
      state.isAdmin &&
      adminOnlineState.activeTab === "online" &&
      state.isAdminDrawerOpen &&
      now - adminOnlineState.fallbackNoticeAt >= 12000
    ) {
      adminOnlineState.fallbackNoticeAt = now;
      showAdminToast("Online presence in offline mode. Reconnecting...");
    }

    adminOnlineState.reconnectTimerId = window.setTimeout(() => {
      adminOnlineState.reconnectTimerId = null;
      if (!adminOnlineState.shouldMaintainPresence) {
        return;
      }
      const nextUser = adminPresenceState.currentUser || state.session?.user || null;
      if (!normalizeText(nextUser?.id, "")) {
        return;
      }
      void startOnlinePresence({ user: nextUser });
    }, delayMs);

    if (
      !shouldPauseOnlineListRefresh() &&
      adminOnlineState.activeTab === "online" &&
      state.isAdmin &&
      state.isAdminDrawerOpen
    ) {
      void renderOnlineList({ forceBansFetch: false, forceStatusFetch: false });
    }
  }

  function clearOnlinePresenceReconnectTimer(resetAttempts = false) {
    if (adminOnlineState.reconnectTimerId) {
      window.clearTimeout(adminOnlineState.reconnectTimerId);
      adminOnlineState.reconnectTimerId = null;
    }
    if (resetAttempts) {
      adminOnlineState.reconnectAttempt = 0;
    }
  }

  function startOnlinePresenceHeartbeat(user, options = {}) {
    clearOnlinePresenceHeartbeat();

    if (!adminOnlineState.shouldMaintainPresence) {
      return;
    }

    const nextUser = user || adminPresenceState.currentUser || state.session?.user || null;
    if (!normalizeText(nextUser?.id, "")) {
      return;
    }

    const initialDelayMs = options.immediate === true ? 0 : getOnlineHeartbeatIntervalMs();
    adminOnlineState.heartbeatTimerId = window.setTimeout(() => {
      adminOnlineState.heartbeatTimerId = null;
      void runOnlinePresenceHeartbeat(nextUser);
    }, initialDelayMs);
  }

  async function runOnlinePresenceHeartbeat(fallbackUser = null) {
    if (!adminOnlineState.shouldMaintainPresence) {
      return;
    }

    const user = adminPresenceState.currentUser || state.session?.user || fallbackUser || null;
    const userId = normalizeText(user?.id, "");
    if (!userId) {
      return;
    }
    if (adminOnlineState.trackedUserId && adminOnlineState.trackedUserId !== userId) {
      return;
    }

    let client = null;
    try {
      client = await ensureAdminClient();
    } catch (error) {
      console.error("[supabase-bridge] Heartbeat failed to resolve client:", error);
      scheduleOnlinePresenceReconnect("heartbeat-client-unavailable");
      return;
    }

    try {
      await upsertOwnOnlineStatus(client, user);
      adminOnlineState.statusRowsFetchedAt = 0;
      clearOnlinePresenceReconnectTimer(true);
    } catch (error) {
      console.warn("[supabase-bridge] user_status heartbeat update failed:", error);
      scheduleOnlinePresenceReconnect("heartbeat-upsert-failed");
      return;
    }

    if (
      !shouldPauseOnlineListRefresh() &&
      adminOnlineState.activeTab === "online" &&
      state.isAdmin &&
      state.isAdminDrawerOpen
    ) {
      void renderOnlineList({
        forceBansFetch: false,
        forceStatusFetch: true
      });
    }

    if (adminOnlineState.shouldMaintainPresence) {
      startOnlinePresenceHeartbeat(user);
    }
  }

  function clearOnlinePresenceHeartbeat() {
    if (adminOnlineState.heartbeatTimerId) {
      window.clearTimeout(adminOnlineState.heartbeatTimerId);
      adminOnlineState.heartbeatTimerId = null;
    }
  }

  function getOnlineHeartbeatIntervalMs() {
    return document.visibilityState === "hidden"
      ? ONLINE_HEARTBEAT_HIDDEN_MS
      : ONLINE_HEARTBEAT_VISIBLE_MS;
  }

  function handleOnlineVisibilityChange() {
    if (visitorPresenceState.initialized) {
      startVisitorPresenceHeartbeat({
        immediate: document.visibilityState === "visible"
      });
    }

    if (!adminOnlineState.shouldMaintainPresence) {
      return;
    }

    const user = adminPresenceState.currentUser || state.session?.user || null;
    if (!normalizeText(user?.id, "")) {
      return;
    }

    startOnlinePresenceHeartbeat(user, {
      immediate: document.visibilityState === "visible"
    });
  }

  function setOnlinePresenceFallback(isEnabled, reason = "") {
    adminOnlineState.fallbackMode = Boolean(isEnabled);
    adminOnlineState.fallbackReason = adminOnlineState.fallbackMode
      ? normalizeText(reason, "Offline mode: Realtime unavailable.")
      : "";
    if (!adminOnlineState.fallbackMode) {
      adminOnlineState.fallbackNoticeAt = 0;
    }
  }

  async function stopOnlinePresence(options = {}) {
    const {
      skipRender = false,
      preserveFallback = false,
      preserveTrackedUser = false,
      preserveReconnectAttempt = false
    } = options;
    const channel = adminOnlineState.realtimeChannel;
    clearOnlinePresenceHeartbeat();
    clearOnlineRealtimeRefreshTimer();
    clearOnlinePresenceReconnectTimer(!preserveReconnectAttempt);
    adminOnlineState.statusRows = [];
    adminOnlineState.statusRowsFetchedAt = 0;

    if (!channel) {
      adminOnlineState.realtimeStatus = "idle";
      if (!preserveTrackedUser) {
        adminOnlineState.trackedUserId = "";
      }
      if (!preserveFallback) {
        setOnlinePresenceFallback(false, "");
      }
      invalidateOnlineBansCache();
      return;
    }

    const client = state.client || adminPresenceState.client;
    adminOnlineState.realtimeChannel = null;
    adminOnlineState.realtimeStatus = "idle";
    if (!preserveTrackedUser) {
      adminOnlineState.trackedUserId = "";
    }
    if (!preserveFallback) {
      setOnlinePresenceFallback(false, "");
      adminOnlineState.fallbackNoticeAt = 0;
    }

    try {
      if (client && typeof client.removeChannel === "function") {
        await client.removeChannel(channel);
      }
    } catch (error) {
      console.error("[supabase-bridge] Failed to remove user_status channel:", error);
    } finally {
      invalidateOnlineBansCache();
      if (!skipRender && adminOnlineState.activeTab === "online" && !shouldPauseOnlineListRefresh()) {
        await renderOnlineList({
          forceBansFetch: false,
          forceStatusFetch: true
        });
      }
    }
  }

  async function upsertOwnOnlineStatus(client, user) {
    const userId = normalizeText(user?.id, "");
    if (!userId) {
      return;
    }

    const session = state.session || (await client.auth.getSession()).data?.session || null;
    const accessToken = normalizeText(session?.access_token, "");
    if (!accessToken) {
      return;
    }

    await requestWorkerJson("POST", USER_PING_PATH, {
      visitorId: visitorPresenceState.visitorId || resolveVisitorId(),
      accessToken,
      pathName: buildCurrentPath()
    });
    rememberOnlineStatusUserId(userId);
  }

  function isUniqueViolationError(error) {
    const code = normalizeText(error?.code, "").toUpperCase();
    const message = normalizeText(error?.message, "").toLowerCase();
    return code === "23505" || message.includes("duplicate key");
  }

  function isKnownOnlineStatusUserId(userId) {
    const safeUserId = normalizeText(userId, "");
    if (!safeUserId) {
      return false;
    }

    return readKnownOnlineStatusUserIds().has(safeUserId);
  }

  function rememberOnlineStatusUserId(userId) {
    const safeUserId = normalizeText(userId, "");
    if (!safeUserId) {
      return;
    }

    const ids = readKnownOnlineStatusUserIds();
    ids.add(safeUserId);
    writeKnownOnlineStatusUserIds(ids);
  }

  function readKnownOnlineStatusUserIds() {
    try {
      const raw = window.localStorage.getItem(ONLINE_STATUS_KNOWN_USERS_KEY);
      if (!raw) {
        return new Set();
      }

      const parsed = JSON.parse(raw);
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

  function writeKnownOnlineStatusUserIds(ids) {
    try {
      const values = Array.from(ids instanceof Set ? ids : []);
      window.localStorage.setItem(
        ONLINE_STATUS_KNOWN_USERS_KEY,
        JSON.stringify(values.slice(-24))
      );
    } catch {}
  }

  async function fetchBansForOnlineUsers(userIds, options = {}) {
    const normalizedUserIds = Array.from(
      new Set((Array.isArray(userIds) ? userIds : [])
        .map((value) => normalizeText(value, ""))
        .filter(Boolean))
    );

    if (normalizedUserIds.length === 0 || !state.isAdmin) {
      return new Map();
    }

    const key = normalizedUserIds.slice().sort().join(",");
    const now = Date.now();
    if (
      options.force !== true &&
      adminOnlineState.bansCacheKey === key &&
      now < adminOnlineState.bansCacheExpiresAt
    ) {
      return new Map(adminOnlineState.bansCacheMap);
    }

    let client;
    try {
      client = await ensureAdminClient();
    } catch (error) {
      console.error("[supabase-bridge] Failed to resolve admin client for bans:", error);
      return new Map();
    }

    let data = null;
    let error = null;
    {
      const next = await client
        .from("user_bans")
        .select("user_id,banned,reason,banned_by,banned_at")
        .in("user_id", normalizedUserIds)
        .eq("banned", true);
      data = next?.data || null;
      error = next?.error || null;
    }

    if (error && isMissingColumnError(error)) {
      const legacyNow = new Date().toISOString();
      const legacy = await client
        .from("user_bans")
        .select("user_id,reason,banned_until")
        .in("user_id", normalizedUserIds)
        .or(`banned_until.is.null,banned_until.gt.${legacyNow}`);
      data = legacy?.data || null;
      error = legacy?.error || null;
    }

    if (error) {
      console.error("[supabase-bridge] Failed to load bans:", error);
      return new Map();
    }

    const map = new Map();
    (Array.isArray(data) ? data : []).forEach((entry) => {
      const userId = normalizeText(entry?.user_id, "");
      if (!userId) {
        return;
      }
      const bannedAt = normalizeText(
        entry?.banned_at,
        normalizeText(
          entry?.updated_at,
          normalizeText(entry?.created_at, normalizeText(entry?.banned_until, ""))
        )
      );
      map.set(userId, {
        user_id: userId,
        banned: entry?.banned === true || normalizeText(entry?.banned_until, "") !== "",
        reason: normalizeText(entry?.reason, ""),
        banned_by: normalizeText(entry?.banned_by ?? entry?.created_by, ""),
        banned_at: bannedAt
      });
    });

    adminOnlineState.bansCacheMap = new Map(map);
    adminOnlineState.bansCacheKey = key;
    adminOnlineState.bansCacheExpiresAt = now + ONLINE_BANS_CACHE_TTL_MS;

    return map;
  }

  function invalidateOnlineBansCache() {
    adminOnlineState.bansCacheMap = new Map();
    adminOnlineState.bansCacheKey = "";
    adminOnlineState.bansCacheExpiresAt = 0;
  }

  async function handleOnlineActionClick(event) {
    const target = event.target instanceof Element
      ? event.target.closest("button[data-online-action]")
      : null;

    if (!(target instanceof HTMLButtonElement)) {
      return;
    }

    const action = normalizeText(target.dataset.onlineAction, "");
    const userId = normalizeText(target.dataset.userId, "");
    const visitorId = normalizeText(target.dataset.visitorId, "");
    const presenceType = normalizePresenceType(target.dataset.presenceType);
    const presenceKey = normalizeText(
      target.closest(".admin-online-item")?.getAttribute("data-presence-key"),
      presenceType === "visitor"
        ? `visitor:${visitorId}`
        : `user:${userId}`
    );
    if (!action || (!userId && !visitorId) || !state.isAdmin) {
      return;
    }

    const currentUserId = normalizeText(adminPresenceState.currentUser?.id, "");
    if (presenceType !== "visitor" && currentUserId && currentUserId === userId) {
      return;
    }

    if (action === "prepare-ban") {
      adminOnlineState.selectedPresenceKey = presenceKey;
      adminOnlineState.pendingAction = {
        presenceKey,
        presenceType,
        userId,
        visitorId,
        minutes: Math.max(0, Math.floor(Number(target.dataset.banMinutes) || 0)),
        reason: "",
        loading: false,
        mode: "ban"
      };
      await refreshOnlineTab({ forceBans: false });
      return;
    }

    if (action === "cancel-ban") {
      adminOnlineState.pendingAction = null;
      adminOnlineState.selectedPresenceKey = "";
      await refreshOnlineTab({ forceBans: false });
      return;
    }

    if (action === "apply-template") {
      const templateValue = normalizeText(target.dataset.templateValue, "");
      if (!adminOnlineState.pendingAction || !templateValue) {
        return;
      }
      adminOnlineState.pendingAction = {
        ...adminOnlineState.pendingAction,
        reason: templateValue
      };
      await refreshOnlineTab({ forceBans: false });
      return;
    }

    if (action === "dossier") {
      await loadTargetDossier({
        presenceType,
        userId,
        visitorId,
        email: normalizeText(target.dataset.email, ""),
        displayName: normalizeText(target.dataset.displayName, "")
      });
      activateAdminTab("ops", { renderOps: false });
      return;
    }

    if (action === "confirm-ban") {
      const reasonInput = target.closest(".admin-inline-confirm")?.querySelector("[data-ban-reason-input='true']");
      const reason = normalizeText(reasonInput?.value, DEFAULT_BAN_REASON);
      adminOnlineState.pendingAction = {
        presenceKey,
        presenceType,
        userId,
        visitorId,
        minutes: Math.max(0, Math.floor(Number(target.dataset.banMinutes) || 0)),
        reason,
        loading: true,
        mode: "ban"
      };
      await refreshOnlineTab({ forceBans: false });
      try {
        await applyOnlineBanAction({
          action: "ban",
          presenceType,
          userId,
          visitorId,
          minutes: adminOnlineState.pendingAction.minutes,
          reason
        });
        showAdminToast("Ban applied");
        adminOnlineState.pendingAction = null;
        adminOnlineState.selectedPresenceKey = "";
      } catch (error) {
        console.error("[supabase-bridge] Online moderation action failed:", error);
        adminOnlineState.pendingAction = {
          ...adminOnlineState.pendingAction,
          loading: false
        };
        showAdminToast(normalizeText(error?.message, "Moderation action failed."));
      } finally {
        invalidateOnlineBansCache();
        window.dispatchEvent(new CustomEvent(SERVER_ACCESS_REFRESH_EVENT_NAME));
        await refreshOnlineTab({ forceBans: true });
      }
      return;
    }

    if (action === "unban") {
      target.disabled = true;
      adminOnlineState.selectedPresenceKey = presenceKey;
      try {
        await applyOnlineBanAction({
          action: "unban",
          presenceType,
          userId,
          visitorId,
          minutes: 0,
          reason: ""
        });
        showAdminToast("Unbanned");
      } catch (error) {
        console.error("[supabase-bridge] Online moderation action failed:", error);
        showAdminToast(normalizeText(error?.message, "Moderation action failed."));
      } finally {
        target.disabled = false;
        adminOnlineState.selectedPresenceKey = "";
        invalidateOnlineBansCache();
        window.dispatchEvent(new CustomEvent(SERVER_ACCESS_REFRESH_EVENT_NAME));
        await refreshOnlineTab({ forceBans: true });
      }
    }
  }

  async function applyOnlineBanAction(options = {}) {
    const action = normalizeText(options.action, "");
    const presenceType = normalizePresenceType(options.presenceType);
    const userId = normalizeText(options.userId, "");
    const visitorId = normalizeText(options.visitorId, "");
    const minutes = Math.max(0, Math.floor(Number(options.minutes) || 0));
    const reason = normalizeText(options.reason, DEFAULT_BAN_REASON) || null;

    if (action === "ban" && presenceType === "visitor") {
      await upsertVisitorBan(visitorId, minutes, reason);
      return;
    }
    if (action === "unban" && presenceType === "visitor") {
      await removeVisitorBan(visitorId);
      return;
    }
    if (action === "ban") {
      await upsertUserBan(userId, minutes, reason);
      return;
    }
    if (action === "unban") {
      await removeUserBan(userId);
    }
  }

  async function handleReviewActionClick(event) {
    const target = event.target instanceof Element
      ? event.target.closest("button[data-review-action]")
      : null;

    if (!(target instanceof HTMLButtonElement) || !state.isAdmin) {
      return;
    }

    const action = normalizeText(target.dataset.reviewAction, "");
    const reviewId = normalizeText(target.dataset.reviewId, "");
    if (!action || !reviewId) {
      return;
    }

    if (action === "delete") {
      const confirmed = window.confirm("Delete this review?");
      if (!confirmed) {
        return;
      }
    }

    target.disabled = true;
    try {
      if (action === "delete") {
        const updated = await adminSoftDeleteReview(reviewId, "moderation");
        mergeReviewModerationState(reviewId, updated);
        showAdminToast("Review deleted");
      } else if (action === "restore") {
        const updated = await adminRestoreReview(reviewId);
        mergeReviewModerationState(reviewId, updated);
        showAdminToast("Review restored");
      }
      applyReviewsSearchFilter(adminReviewsState.searchQuery, { commitInput: false });
    } catch (error) {
      showAdminToast(normalizeText(error?.message, "Review action failed."));
    } finally {
      target.disabled = false;
    }
  }

  function mergeReviewModerationState(reviewId, patch) {
    const safeReviewId = normalizeText(reviewId, "");
    if (!safeReviewId || !Array.isArray(adminReviewsState.allReviews)) {
      return;
    }

    adminReviewsState.allReviews = adminReviewsState.allReviews.map((entry) => {
      const entryId = normalizeText(entry?.id, "");
      if (entryId !== safeReviewId) {
        return entry;
      }
      return {
        ...entry,
        ...(patch && typeof patch === "object" ? patch : {})
      };
    });
  }

  async function upsertUserBan(userId, minutes, reason) {
    const { client, user } = await ensureAdminContext();
    const safeUserId = normalizeText(userId, "");
    if (!safeUserId) {
      return;
    }

    const safeReason = normalizeText(reason, "") || null;
    const safeMinutes = Math.max(0, Math.floor(Number(minutes) || 0));

    const rpcResult = await client.rpc("admin_ban_user", {
      target_user_id: safeUserId,
      minutes: safeMinutes > 0 ? safeMinutes : null,
      reason: safeReason
    });
    if (!rpcResult?.error) {
      return;
    }

    const actorUserId = normalizeText(user?.id, "") || null;
    const payload = {
      user_id: safeUserId,
      banned: true,
      reason: safeReason,
      banned_by: actorUserId,
      banned_at: new Date().toISOString(),
      banned_until: safeMinutes > 0
        ? new Date(Date.now() + (safeMinutes * 60 * 1000)).toISOString()
        : null
    };
    let { error } = await client.from("user_bans").upsert(payload, { onConflict: "user_id" });
    if (error && isMissingColumnError(error)) {
      const legacyPayload = {
        user_id: safeUserId,
        reason: safeReason,
        created_by: actorUserId,
        banned_until: safeMinutes > 0
          ? new Date(Date.now() + (safeMinutes * 60 * 1000)).toISOString()
          : null
      };
      const legacyResult = await client
        .from("user_bans")
        .upsert(legacyPayload, { onConflict: "user_id" });
      error = legacyResult?.error || null;
    }
    if (error) {
      throw new Error(
        formatSupabaseErrorMessage(rpcResult.error || error, "Failed to ban user.")
      );
    }
  }

  async function removeUserBan(userId) {
    const { client, user } = await ensureAdminContext();
    const safeUserId = normalizeText(userId, "");
    if (!safeUserId) {
      return;
    }

    const rpcResult = await client.rpc("admin_unban_user", {
      target_user_id: safeUserId
    });
    if (!rpcResult?.error) {
      return;
    }

    const actorUserId = normalizeText(user?.id, "") || null;
    let { error } = await client
      .from("user_bans")
      .upsert({
        user_id: safeUserId,
        banned: false,
        reason: null,
        banned_by: actorUserId,
        banned_at: new Date().toISOString()
      }, { onConflict: "user_id" });
    if (error && isMissingColumnError(error)) {
      const legacyResult = await client
        .from("user_bans")
        .delete()
        .eq("user_id", safeUserId);
      error = legacyResult?.error || null;
    }
    if (error) {
      throw new Error(
        formatSupabaseErrorMessage(rpcResult.error || error, "Failed to unban user.")
      );
    }
  }

  async function upsertVisitorBan(visitorId, minutes, reason) {
    const { client } = await ensureAdminContext();
    const safeVisitorId = normalizeText(visitorId, "");
    if (!safeVisitorId) {
      return;
    }

    const safeReason = normalizeText(reason, "") || null;
    const safeMinutes = Math.max(0, Math.floor(Number(minutes) || 0));
    const { error } = await client.rpc("admin_ban_visitor", {
      target_visitor_id: safeVisitorId,
      minutes: safeMinutes > 0 ? safeMinutes : null,
      reason: safeReason
    });
    if (!error) {
      return;
    }

    if (isMissingFunctionLikeError(error)) {
      if (safeMinutes > 0) {
        throw new Error("Apply patch_20260410_ban_system.sql to enable timed visitor bans.");
      }
      const legacyResult = await client.rpc("ban_visitor", {
        target_visitor_id: safeVisitorId,
        p_reason: safeReason
      });
      if (!legacyResult?.error) {
        return;
      }
      throw new Error(formatSupabaseErrorMessage(legacyResult.error, "Failed to ban visitor."));
    }

    throw new Error(formatSupabaseErrorMessage(error, "Failed to ban visitor."));
  }

  async function removeVisitorBan(visitorId) {
    const { client } = await ensureAdminContext();
    const safeVisitorId = normalizeText(visitorId, "");
    if (!safeVisitorId) {
      return;
    }

    const { error } = await client.rpc("admin_unban_visitor", {
      target_visitor_id: safeVisitorId
    });
    if (!error) {
      return;
    }

    if (isMissingFunctionLikeError(error)) {
      const legacyResult = await client.rpc("unban_visitor", {
        target_visitor_id: safeVisitorId
      });
      if (!legacyResult?.error) {
        return;
      }
      throw new Error(formatSupabaseErrorMessage(legacyResult.error, "Failed to unban visitor."));
    }

    throw new Error(formatSupabaseErrorMessage(error, "Failed to unban visitor."));
  }

  function resolveReviewDeletedState(review) {
    if (!review || typeof review !== "object") {
      return false;
    }
    if (typeof review.is_deleted === "boolean") {
      return review.is_deleted;
    }
    if (typeof review.isDeleted === "boolean") {
      return review.isDeleted;
    }
    return Boolean(normalizeText(review.deleted_at, ""));
  }

  function resolveDeletedAt(review) {
    if (!review || typeof review !== "object") {
      return "";
    }
    return normalizeText(review.deleted_at ?? review.deletedAt, "");
  }

  function formatReviewDateLabel(value) {
    const parsed = Date.parse(normalizeText(value, ""));
    if (!Number.isFinite(parsed)) {
      return "Unknown date";
    }
    return new Date(parsed).toLocaleString();
  }

  function formatReviewRating(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return "-";
    }
    const safeRating = Math.max(1, Math.min(5, Math.round(numeric)));
    return `${safeRating}/5`;
  }

  function formatRelativeDuration(timestampValue) {
    const timestampMs = Date.parse(normalizeText(timestampValue, ""));
    if (!Number.isFinite(timestampMs)) {
      return "just now";
    }

    const elapsedMs = Math.max(0, Date.now() - timestampMs);
    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    if (elapsedSeconds < 60) {
      return `${elapsedSeconds}s ago`;
    }

    const elapsedMinutes = Math.floor(elapsedSeconds / 60);
    if (elapsedMinutes < 60) {
      return `${elapsedMinutes}m ago`;
    }

    const elapsedHours = Math.floor(elapsedMinutes / 60);
    if (elapsedHours < 24) {
      return `${elapsedHours}h ago`;
    }

    const elapsedDays = Math.floor(elapsedHours / 24);
    return `${elapsedDays}d ago`;
  }

  function resolvePresenceRole(user) {
    const role = normalizeText(
      user?.user_metadata?.role,
      normalizeText(user?.app_metadata?.role, "")
    ).toLowerCase();
    if (role) {
      return role;
    }
    return adminPresenceState.isAdmin ? "admin" : "user";
  }

  function formatBanSinceLabel(value) {
    const timestamp = Date.parse(normalizeText(value, ""));
    if (!Number.isFinite(timestamp)) {
      return "recently";
    }
    return `since ${new Date(timestamp).toLocaleString()}`;
  }

  function formatBanUntilLabel(value) {
    const timestamp = Date.parse(normalizeText(value, ""));
    if (!Number.isFinite(timestamp)) {
      return "until unknown time";
    }
    return `until ${new Date(timestamp).toLocaleString()}`;
  }

  function formatBanMinutesLabel(minutes) {
    const safeMinutes = Math.max(0, Math.floor(Number(minutes) || 0));
    if (safeMinutes <= 0) {
      return "permanent";
    }
    if (safeMinutes % 1440 === 0) {
      return `${safeMinutes / 1440}d`;
    }
    if (safeMinutes % 60 === 0) {
      return `${safeMinutes / 60}h`;
    }
    return `${safeMinutes}m`;
  }

  function isTimedStateActive(flag, untilValue) {
    if (flag !== true) {
      return false;
    }
    const safeUntil = normalizeText(untilValue, "");
    if (!safeUntil) {
      return true;
    }
    const timestamp = Date.parse(safeUntil);
    return Number.isFinite(timestamp) && timestamp > Date.now();
  }

  function renderAuthState() {
    const user = state.session?.user || null;
    const email = normalizeText(user?.email, "");
    const isAuthed = Boolean(user && email);

    ui.userBadge.hidden = !isAuthed;
    ui.signOutButton.hidden = !isAuthed;
    ui.authForm.classList.toggle("is-authenticated", isAuthed);
    setAuthFormMode(isAuthed);

    if (isAuthed) {
      ui.toggleLabel.textContent = "Account";
      ui.userLine.textContent = `Signed in: ${email}`;
      ui.passwordInput.setAttribute("autocomplete", "new-password");
      ui.passwordInput.value = "";
      showMessage("", "info");
      if (state.isPanelOpen) {
        closePanel();
      }
    } else {
      ui.toggleLabel.textContent = "Sign in";
      ui.userLine.textContent = "Not authenticated";
      ui.passwordInput.setAttribute("autocomplete", "current-password");
    }
  }

  async function signIn() {
    const credentials = readCredentials();
    if (!credentials || !state.client) {
      return;
    }

    setBusy(true);
    try {
      const { error } = await state.client.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password
      });

      if (error) {
        if (isInvalidCredentialsError(error)) {
          showMessage(
            "Неверный email или пароль. Если аккаунта нет, нажмите Sign up.",
            "error"
          );
          return;
        }
        if (isEmailConfirmationError(error)) {
          showMessage(
            "Вход для этого аккаунта сейчас недоступен. Используйте другой email или обратитесь к администратору.",
            "error"
          );
          return;
        }
        showMessage(normalizeText(error.message, "Sign-in failed."), "error");
        return;
      }

      showMessage("Signed in successfully.", "success");
    } catch (error) {
      console.error("[supabase-bridge] signIn failed:", error);
      showMessage("Unable to sign in.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function signUp() {
    const credentials = readCredentials();
    if (!credentials || !state.client) {
      return;
    }

    setBusy(true);
    try {
      const registrationResult = await requestWorkerJson("POST", REGISTER_PATH, {
        email: credentials.email,
        password: credentials.password
      });

      if (!registrationResult?.ok) {
        showMessage("Registration failed.", "error");
        return;
      }

      const signInResult = await signInAfterRegistration(credentials, 3);
      if (!signInResult) {
        showMessage(
          "Account was created, but auto sign-in did not finish. Please use Sign in.",
          "error"
        );
        return;
      }

      showMessage("Registration completed and signed in.", "success");
      return;

      const { data: signUpData, error: signUpError } = await state.client.auth.signUp({
        email: credentials.email,
        password: credentials.password
      });

      if (signUpError) {
        if (isUserAlreadyExistsError(signUpError)) {
          showMessage("Аккаунт уже существует. Используйте Log in.", "error");
          return;
        }
        showMessage(normalizeText(signUpError.message, "Sign-up failed."), "error");
        return;
      }
      if (isObfuscatedExistingUser(signUpData)) {
        showMessage("Аккаунт уже существует. Используйте Log in.", "error");
        return;
      }

      const { error: signInError } = await state.client.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password
      });

      if (signInError) {
        showMessage(
          "Аккаунт создан, но автоматический вход не выполнен. Нажмите Log in.",
          "error"
        );
        return;
      }

      showMessage("Registration completed and signed in.", "success");
    } catch (error) {
      console.error("[supabase-bridge] signUp failed:", error);
      if (isUserAlreadyExistsError(error)) {
        showMessage("Account already exists. Use Sign in.", "error");
        return;
      }
      showMessage(normalizeText(error?.message, "Unable to complete registration."), "error");
    } finally {
      setBusy(false);
    }
  }

  async function signInAfterRegistration(credentials, attempts = 1) {
    const safeAttempts = Math.max(1, Number(attempts) || 1);
    for (let attempt = 0; attempt < safeAttempts; attempt += 1) {
      const { error } = await state.client.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password
      });
      if (!error) {
        return true;
      }
      if (attempt >= safeAttempts - 1) {
        return false;
      }
      await wait(250 * (attempt + 1));
    }
    return false;
  }

  function getAccessState() {
    return {
      ...visitorPresenceState.accessState
    };
  }

  async function syncServerAccessState(options = {}) {
    const requestToken = state.sessionSyncToken + 1;
    state.sessionSyncToken = requestToken;

    const session = Object.prototype.hasOwnProperty.call(options, "session")
      ? options.session
      : state.session;
    const accessToken = normalizeText(session?.access_token, "");
    const visitorId = visitorPresenceState.visitorId || resolveVisitorId();

    try {
      const response = await fetch(SESSION_SYNC_PATH, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          visitorId,
          pathName: buildCurrentPath(),
          accessToken: accessToken || undefined,
          clear: !accessToken
        })
      });

      let payload = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      if (requestToken !== state.sessionSyncToken) {
        return null;
      }

      if (!response.ok) {
        throw new Error(normalizeText(payload?.error, "Server access sync failed."));
      }

      applyServerAccessSnapshot(payload?.access, payload?.visitor);
      await refreshSelfFreezeState();
      await syncSelfBanSubscription();
      await syncSelfFreezeSubscription();
      return payload;
    } catch (error) {
      console.warn("[supabase-bridge] Server access sync failed:", error);
      return null;
    }
  }

  function applyServerAccessSnapshot(access, visitor = null) {
    const safeAccess = access && typeof access === "object" ? access : {};
    const safeVisitor = visitor && typeof visitor === "object" ? visitor : {};
    updateVisitorAccessState({
      userId: normalizeText(safeAccess.userId, normalizeText(state.session?.user?.id, "")),
      visitorId: normalizeText(safeAccess.visitorId, visitorPresenceState.visitorId),
      displayName: normalizeText(safeVisitor.displayName, visitorPresenceState.displayName),
      isBanned: safeAccess.isBanned === true,
      isUserBanned: safeAccess.isUserBanned === true,
      isVisitorBanned: safeAccess.isVisitorBanned === true,
      source: normalizeText(safeAccess.source, ""),
      reason: normalizeText(safeAccess.reason, ""),
      bannedAt: normalizeText(safeAccess.bannedAt, ""),
      bannedUntil: normalizeText(safeAccess.bannedUntil, ""),
      isPermanent: safeAccess.isPermanent === true,
      checkedAt: normalizeText(safeAccess.checkedAt, new Date().toISOString()),
      lastSeenAt: normalizeText(safeVisitor.lastSeen, visitorPresenceState.accessState.lastSeenAt),
      role: normalizeText(safeVisitor.role, resolveVisitorRoleHint())
    });

    if (
      safeAccess.isBanned === true &&
      normalizeText(safeAccess.source, "") === "user" &&
      state.session?.user &&
      state.client &&
      state.banLogoutInFlight !== true
    ) {
      state.banLogoutInFlight = true;
      void state.client.auth.signOut()
        .catch((error) => {
          console.warn("[supabase-bridge] Forced sign-out after ban failed:", error);
        })
        .finally(() => {
          state.banLogoutInFlight = false;
        });
    }
  }

  async function syncSelfBanSubscription() {
    const client = state.client || adminPresenceState.client || null;
    const userId = normalizeText(state.session?.user?.id, "");

    if (adminPresenceState.selfBanChannel && typeof client?.removeChannel === "function") {
      try {
        await client.removeChannel(adminPresenceState.selfBanChannel);
      } catch (error) {
        console.warn("[supabase-bridge] Failed to remove self ban channel:", error);
      }
      adminPresenceState.selfBanChannel = null;
    }

    if (!client || !userId) {
      return;
    }

    const channel = client
      .channel(`${USER_BAN_REALTIME_CHANNEL_PREFIX}:${userId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: USER_BANS_TABLE,
        filter: `user_id=eq.${userId}`
      }, () => {
        window.dispatchEvent(new CustomEvent(SERVER_ACCESS_REFRESH_EVENT_NAME));
        void syncServerAccessState({
          session: state.session,
          reason: "user-ban-realtime"
        });
      });

    adminPresenceState.selfBanChannel = channel;
    channel.subscribe((status) => {
      if (status === "CHANNEL_ERROR") {
        console.warn("[supabase-bridge] Self ban realtime channel error.");
      }
    });
  }

  async function refreshSelfFreezeState(options = {}) {
    const client = state.client || adminPresenceState.client || null;
    const userId = normalizeText(options.userId, normalizeText(state.session?.user?.id, ""));

    if (!client || !userId) {
      updateVisitorAccessState({
        isFrozen: false,
        freezeReason: "",
        frozenAt: "",
        frozenUntil: "",
        isFreezePermanent: false
      });
      return;
    }

    try {
      const { data, error } = await client
        .from(USER_FREEZES_TABLE)
        .select("user_id,frozen,reason,frozen_at,frozen_until,updated_at")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();

      if (error) {
        if (isMissingRelationError(error) || isMissingColumnError(error)) {
          updateVisitorAccessState({
            isFrozen: false,
            freezeReason: "",
            frozenAt: "",
            frozenUntil: "",
            isFreezePermanent: false
          });
          return;
        }
        throw error;
      }

      const frozenUntil = normalizeText(data?.frozen_until, "");
      let isFrozen = data?.frozen !== false && Boolean(normalizeText(data?.user_id, ""));
      if (isFrozen && frozenUntil) {
        const timestamp = Date.parse(frozenUntil);
        if (!Number.isFinite(timestamp) || timestamp <= Date.now()) {
          isFrozen = false;
        }
      }

      updateVisitorAccessState({
        isFrozen,
        freezeReason: isFrozen ? normalizeText(data?.reason, "") : "",
        frozenAt: isFrozen
          ? normalizeText(data?.frozen_at, normalizeText(data?.updated_at, ""))
          : "",
        frozenUntil: isFrozen ? frozenUntil : "",
        isFreezePermanent: isFrozen && frozenUntil === ""
      });
    } catch (error) {
      console.warn("[supabase-bridge] Failed to refresh self freeze state:", error);
    }
  }

  async function syncSelfFreezeSubscription() {
    const client = state.client || adminPresenceState.client || null;
    const userId = normalizeText(state.session?.user?.id, "");

    if (adminPresenceState.selfFreezeChannel && typeof client?.removeChannel === "function") {
      try {
        await client.removeChannel(adminPresenceState.selfFreezeChannel);
      } catch (error) {
        console.warn("[supabase-bridge] Failed to remove self freeze channel:", error);
      }
      adminPresenceState.selfFreezeChannel = null;
    }

    if (!client || !userId) {
      updateVisitorAccessState({
        isFrozen: false,
        freezeReason: "",
        frozenAt: "",
        frozenUntil: "",
        isFreezePermanent: false
      });
      return;
    }

    const channel = client
      .channel(`${USER_FREEZE_REALTIME_CHANNEL_PREFIX}:${userId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: USER_FREEZES_TABLE,
        filter: `user_id=eq.${userId}`
      }, () => {
        void refreshSelfFreezeState({ userId });
      });

    adminPresenceState.selfFreezeChannel = channel;
    channel.subscribe((status) => {
      if (status === "CHANNEL_ERROR") {
        console.warn("[supabase-bridge] Self freeze realtime channel error.");
      }
    });
  }

  async function initVisitorPresence() {
    const visitorId = resolveVisitorId();
    if (!visitorId) {
      return;
    }

    visitorPresenceState.visitorId = visitorId;
    visitorPresenceState.displayName = resolveVisitorDisplayName(visitorId);
    visitorPresenceState.initialized = true;
    updateVisitorAccessState({
      userId: normalizeText(state.session?.user?.id, ""),
      visitorId,
      displayName: visitorPresenceState.displayName,
      role: resolveVisitorRoleHint(),
      lastSeenAt: visitorPresenceState.accessState.lastSeenAt
    });
    startVisitorPresenceHeartbeat({ immediate: true });
  }

  async function runVisitorPresenceHeartbeat() {
    if (!visitorPresenceState.visitorId) {
      return;
    }

    visitorPresenceState.requestToken += 1;
    const requestToken = visitorPresenceState.requestToken;
    try {
      const payload = await requestWorkerJson("POST", VISITOR_PING_PATH, {
        visitorId: visitorPresenceState.visitorId,
        displayName: visitorPresenceState.displayName,
        userId: normalizeText(state.session?.user?.id, ""),
        email: normalizeText(state.session?.user?.email, ""),
        roleHint: resolveVisitorRoleHint(),
        pathName: buildCurrentPath()
      });

      if (requestToken !== visitorPresenceState.requestToken) {
        return;
      }

      const visitor = payload?.visitor && typeof payload.visitor === "object"
        ? payload.visitor
        : {};
      const access = payload?.access && typeof payload.access === "object"
        ? payload.access
        : {};

      updateVisitorAccessState({
        userId: normalizeText(access.userId, normalizeText(state.session?.user?.id, "")),
        visitorId: normalizeText(access.visitorId, visitorPresenceState.visitorId),
        displayName: normalizeText(visitor.displayName, visitorPresenceState.displayName),
        isBanned: access.isBanned === true,
        isUserBanned: access.isUserBanned === true,
        isVisitorBanned: access.isVisitorBanned === true,
        source: normalizeText(access.source, ""),
        reason: normalizeText(access.reason, ""),
        bannedAt: normalizeText(access.bannedAt, ""),
        bannedUntil: normalizeText(access.bannedUntil, ""),
        isPermanent: access.isPermanent === true,
        checkedAt: normalizeText(access.checkedAt, new Date().toISOString()),
        lastSeenAt: normalizeText(visitor.lastSeen, new Date().toISOString()),
        role: normalizeText(visitor.role, resolveVisitorRoleHint())
      });
    } catch (error) {
      console.warn("[supabase-bridge] Visitor presence heartbeat failed:", error);
    } finally {
      startVisitorPresenceHeartbeat();
    }
  }

  function startVisitorPresenceHeartbeat(options = {}) {
    clearVisitorPresenceHeartbeat();
    if (!visitorPresenceState.initialized || !visitorPresenceState.visitorId) {
      return;
    }

    const delayMs = options.immediate === true
      ? 0
      : getVisitorHeartbeatIntervalMs();
    visitorPresenceState.heartbeatTimerId = window.setTimeout(() => {
      visitorPresenceState.heartbeatTimerId = null;
      void runVisitorPresenceHeartbeat();
    }, delayMs);
  }

  function clearVisitorPresenceHeartbeat() {
    if (visitorPresenceState.heartbeatTimerId) {
      window.clearTimeout(visitorPresenceState.heartbeatTimerId);
      visitorPresenceState.heartbeatTimerId = null;
    }
  }

  function getVisitorHeartbeatIntervalMs() {
    return document.visibilityState === "hidden"
      ? VISITOR_HEARTBEAT_HIDDEN_MS
      : VISITOR_HEARTBEAT_VISIBLE_MS;
  }

  function updateVisitorAccessState(nextState = {}) {
    const previous = visitorPresenceState.accessState || {};
    const hasFrozenState = Object.prototype.hasOwnProperty.call(nextState, "isFrozen");
    const hasFreezeReason = Object.prototype.hasOwnProperty.call(nextState, "freezeReason");
    const hasFrozenAt = Object.prototype.hasOwnProperty.call(nextState, "frozenAt");
    const hasFrozenUntil = Object.prototype.hasOwnProperty.call(nextState, "frozenUntil");
    const hasFreezePermanent = Object.prototype.hasOwnProperty.call(nextState, "isFreezePermanent");
    const snapshot = {
      userId: normalizeText(nextState.userId, previous.userId),
      visitorId: normalizeText(nextState.visitorId, visitorPresenceState.visitorId),
      displayName: normalizeText(nextState.displayName, visitorPresenceState.displayName),
      isBanned: nextState.isBanned === true,
      isUserBanned: nextState.isUserBanned === true,
      isVisitorBanned: nextState.isVisitorBanned === true,
      source: normalizeText(nextState.source, ""),
      reason: normalizeText(nextState.reason, ""),
      bannedAt: normalizeText(nextState.bannedAt, ""),
      bannedUntil: normalizeText(nextState.bannedUntil, ""),
      isPermanent: nextState.isPermanent === true,
      isFrozen: hasFrozenState ? nextState.isFrozen === true : previous.isFrozen === true,
      freezeReason: hasFreezeReason ? normalizeText(nextState.freezeReason, "") : normalizeText(previous.freezeReason, ""),
      frozenAt: hasFrozenAt ? normalizeText(nextState.frozenAt, "") : normalizeText(previous.frozenAt, ""),
      frozenUntil: hasFrozenUntil ? normalizeText(nextState.frozenUntil, "") : normalizeText(previous.frozenUntil, ""),
      isFreezePermanent: hasFreezePermanent ? nextState.isFreezePermanent === true : previous.isFreezePermanent === true,
      checkedAt: normalizeText(nextState.checkedAt, new Date().toISOString()),
      lastSeenAt: normalizeText(nextState.lastSeenAt, ""),
      role: normalizeText(nextState.role, resolveVisitorRoleHint())
    };

    visitorPresenceState.accessState = snapshot;
    visitorPresenceState.visitorId = snapshot.visitorId || visitorPresenceState.visitorId;
    visitorPresenceState.displayName = snapshot.displayName || visitorPresenceState.displayName;
    if (snapshot.visitorId) {
      writeLocalStorageText(VISITOR_ID_STORAGE_KEY, snapshot.visitorId);
    }
    if (snapshot.displayName) {
      writeLocalStorageText(VISITOR_NAME_STORAGE_KEY, snapshot.displayName);
    }

    if (
      previous.userId !== snapshot.userId ||
      previous.visitorId !== snapshot.visitorId ||
      previous.displayName !== snapshot.displayName ||
      previous.isBanned !== snapshot.isBanned ||
      previous.isUserBanned !== snapshot.isUserBanned ||
      previous.isVisitorBanned !== snapshot.isVisitorBanned ||
      previous.source !== snapshot.source ||
      previous.reason !== snapshot.reason ||
      previous.bannedAt !== snapshot.bannedAt ||
      previous.bannedUntil !== snapshot.bannedUntil ||
      previous.isPermanent !== snapshot.isPermanent ||
      previous.isFrozen !== snapshot.isFrozen ||
      previous.freezeReason !== snapshot.freezeReason ||
      previous.frozenAt !== snapshot.frozenAt ||
      previous.frozenUntil !== snapshot.frozenUntil ||
      previous.isFreezePermanent !== snapshot.isFreezePermanent ||
      previous.role !== snapshot.role
    ) {
      window.dispatchEvent(
        new CustomEvent(VISITOR_ACCESS_EVENT_NAME, {
          detail: {
            ...snapshot
          }
        })
      );
    }
  }

  function resolveVisitorId() {
    let visitorId = readLocalStorageText(VISITOR_ID_STORAGE_KEY);
    if (visitorId) {
      return visitorId;
    }

    visitorId = createClientVisitorId();
    if (visitorId) {
      writeLocalStorageText(VISITOR_ID_STORAGE_KEY, visitorId);
    }
    return visitorId;
  }

  function resolveVisitorDisplayName(visitorId) {
    const cachedValue = readLocalStorageText(VISITOR_NAME_STORAGE_KEY);
    if (cachedValue) {
      return cachedValue;
    }

    const suffix = normalizeText(visitorId, "").slice(-6).toUpperCase();
    const nextValue = suffix ? `Guest ${suffix}` : "Guest";
    writeLocalStorageText(VISITOR_NAME_STORAGE_KEY, nextValue);
    return nextValue;
  }

  function resolveVisitorRoleHint() {
    if (state.isAdmin) {
      return "admin";
    }
    if (normalizeText(state.session?.user?.id, "")) {
      return "user";
    }
    return "guest";
  }

  function buildCurrentPath() {
    const pathname = normalizeText(window.location?.pathname, "/");
    const search = typeof window.location?.search === "string"
      ? window.location.search.trim()
      : "";
    const value = `${pathname}${search}`.slice(0, 240);
    return value || "/";
  }

  function createClientVisitorId() {
    const cryptoApi = window.crypto || globalThis.crypto;
    if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
      return `visitor_${cryptoApi.randomUUID().replace(/-/g, "").slice(0, 24)}`;
    }

    if (cryptoApi && typeof cryptoApi.getRandomValues === "function") {
      const bytes = new Uint8Array(16);
      cryptoApi.getRandomValues(bytes);
      return `visitor_${Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("")}`;
    }

    return `visitor_${Math.random().toString(36).slice(2, 18)}`;
  }

  function readLocalStorageText(key) {
    try {
      return normalizeText(window.localStorage.getItem(key), "");
    } catch {
      return "";
    }
  }

  function writeLocalStorageText(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch {}
  }

  async function signOut() {
    if (!state.client) {
      return;
    }

    setBusy(true);
    try {
      adminOnlineState.shouldMaintainPresence = false;
      await stopOnlinePresence({ skipRender: true, preserveFallback: false });
      const { error } = await state.client.auth.signOut();
      if (error) {
        showMessage(normalizeText(error.message, "Sign-out failed."), "error");
        return;
      }

      showMessage("Signed out.", "success");
    } catch (error) {
      console.error("[supabase-bridge] signOut failed:", error);
      showMessage("Unable to sign out.", "error");
    } finally {
      setBusy(false);
    }
  }

  // Admin & Presence API
  async function initAdminPresence() {
    if (adminPresenceState.initialized) {
      return;
    }

    const client = await ensureAdminClient();
    adminPresenceState.client = client;
    adminPresenceState.initialized = true;

    const listenerResult = client.auth.onAuthStateChange((event, session) => {
      void applyAdminPresenceSession(event, session);
    });

    const subscription = listenerResult?.data?.subscription;
    if (subscription && typeof subscription.unsubscribe === "function") {
      adminPresenceState.authSubscription = subscription;
    }

    const { data, error } = await client.auth.getSession();
    if (error) {
      console.warn("[supabase-bridge] Failed to read initial admin session:", error);
      emitAdminAuthChanged("initial-session", null);
      return;
    }

    await applyAdminPresenceSession("initial-session", data?.session || null);
  }

  function getIsAdmin() {
    return Boolean(adminPresenceState.isAdmin);
  }

  function onAuthChanged(callback) {
    if (typeof callback !== "function") {
      throw new Error("onAuthChanged(callback): callback must be a function.");
    }

    adminPresenceState.authCallbacks.add(callback);
    safeCallAdminAuthCallback(callback, createAdminAuthSnapshot("subscribe", state.session));

    return () => {
      adminPresenceState.authCallbacks.delete(callback);
    };
  }

  async function getAdminPresenceList() {
    await ensureAdminContext();
    const rows = await loadOnlineUsersFromStatusTable({ force: true });
    return rows.map((entry) => ({
      presence_key: entry.presence_key,
      presence_type: entry.presence_type,
      user_id: entry.user_id,
      userId: entry.user_id,
      visitor_id: entry.visitor_id,
      visitorId: entry.visitor_id,
      email: entry.email,
      display_name: entry.display_name,
      displayName: entry.display_name,
      last_seen: entry.last_seen_at,
      lastSeen: entry.last_seen_at,
      role: normalizeText(entry.role, "user"),
      is_registered: entry.is_registered === true,
      is_banned: entry.is_banned === true,
      ban_reason: normalizeText(entry.ban_reason, ""),
      banned_at: normalizeText(entry.banned_at, ""),
      banned_until: normalizeText(entry.banned_until, ""),
      is_permanent_ban: entry.is_permanent_ban === true,
      is_frozen: entry.is_frozen === true,
      freeze_reason: normalizeText(entry.freeze_reason, ""),
      frozen_at: normalizeText(entry.frozen_at, ""),
      frozen_until: normalizeText(entry.frozen_until, ""),
      is_permanent_freeze: entry.is_permanent_freeze === true,
      last_path: normalizeText(entry.last_path, ""),
      user_agent: normalizeText(entry.user_agent, ""),
      last_ip: normalizeText(entry.last_ip, ""),
      is_online: isOnlineStatusActive(entry.last_seen_ms),
      idle_for: formatRelativeDuration(entry.last_seen_at)
    }));
  }

  async function getAdminReviews(options = {}) {
    const { client } = await ensureAdminContext();
    const limit = normalizePositiveInteger(options.limit, ADMIN_REVIEWS_LIMIT, 1, 1000);
    return loadAdminReviewsFromTable(client, limit);
  }

  async function adminSoftDeleteReview(reviewId, reason) {
    const { client, user } = await ensureAdminContext();
    const safeReviewId = normalizeText(reviewId, "");
    if (!safeReviewId) {
      throw new Error("adminSoftDeleteReview(reviewId, reason): reviewId is required.");
    }

    const safeReason = normalizeText(reason, "moderation");
    return updateReviewModerationRow(client, safeReviewId, {
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      deleted_by: normalizeText(user?.id, "") || null,
      delete_reason: safeReason
    });
  }

  async function adminRestoreReview(reviewId) {
    const { client } = await ensureAdminContext();
    const safeReviewId = normalizeText(reviewId, "");
    if (!safeReviewId) {
      throw new Error("adminRestoreReview(reviewId): reviewId is required.");
    }

    return updateReviewModerationRow(client, safeReviewId, {
      is_deleted: false,
      deleted_at: null,
      deleted_by: null,
      delete_reason: null
    });
  }

  async function updateReviewModerationRow(client, reviewId, payload) {
    const safeReviewId = normalizeText(reviewId, "");
    if (!safeReviewId) {
      throw new Error("Review id is required.");
    }

    const basePayload = payload && typeof payload === "object"
      ? { ...payload }
      : {};
    const attempts = [
      basePayload,
      (() => {
        const nextPayload = { ...basePayload };
        if (Object.prototype.hasOwnProperty.call(nextPayload, "delete_reason")) {
          nextPayload.deleted_reason = nextPayload.delete_reason;
          delete nextPayload.delete_reason;
        }
        return nextPayload;
      })(),
      (() => {
        const nextPayload = { ...basePayload };
        delete nextPayload.delete_reason;
        delete nextPayload.deleted_reason;
        return nextPayload;
      })(),
      (() => {
        const nextPayload = { ...basePayload };
        delete nextPayload.is_deleted;
        if (Object.prototype.hasOwnProperty.call(nextPayload, "delete_reason")) {
          nextPayload.deleted_reason = nextPayload.delete_reason;
          delete nextPayload.delete_reason;
        }
        return nextPayload;
      })(),
      (() => {
        const nextPayload = { ...basePayload };
        delete nextPayload.is_deleted;
        delete nextPayload.delete_reason;
        delete nextPayload.deleted_reason;
        return nextPayload;
      })()
    ];

    let lastError = null;
    for (const attemptPayload of attempts) {
      const { data, error } = await client
        .from("reviews")
        .update(attemptPayload)
        .eq("id", safeReviewId)
        .select("*")
        .maybeSingle();

      if (error) {
        lastError = error;
        if (isMissingColumnError(error)) {
          continue;
        }
        throw new Error(formatSupabaseErrorMessage(error, "Failed to update review."));
      }
      if (!data) {
        throw new Error("Review not found.");
      }

      return normalizeReviewRow(data);
    }

    throw new Error(formatSupabaseErrorMessage(lastError, "Failed to update review."));
  }

  async function adminBanEmail(email, minutes, reason) {
    const { client } = await ensureAdminContext();
    const safeEmail = normalizeText(email, "").toLowerCase();
    if (!isLikelyEmail(safeEmail)) {
      throw new Error("adminBanEmail(email, minutes, reason): valid email is required.");
    }

    const safeMinutes = normalizePositiveInteger(minutes, NaN, 1, 525600);
    if (!Number.isFinite(safeMinutes)) {
      throw new Error("adminBanEmail(email, minutes, reason): minutes must be a positive integer.");
    }

    const safeReason = normalizeText(reason, "");
    const { data, error } = await client.rpc("admin_ban_email", {
      email: safeEmail,
      minutes: safeMinutes,
      reason: safeReason || null
    });

    if (error) {
      throw new Error(formatSupabaseErrorMessage(error, "Failed to ban email."));
    }

    return data;
  }

  async function adminUnbanEmail(email) {
    const { client } = await ensureAdminContext();
    const safeEmail = normalizeText(email, "").toLowerCase();
    if (!isLikelyEmail(safeEmail)) {
      throw new Error("adminUnbanEmail(email): valid email is required.");
    }

    const { data, error } = await client.rpc("admin_unban_email", {
      email: safeEmail
    });

    if (error) {
      throw new Error(formatSupabaseErrorMessage(error, "Failed to unban email."));
    }

    return data;
  }

  async function applyAdminPresenceSession(eventName, session) {
    const nextUser = session?.user || null;
    const nextUserId = normalizeText(nextUser?.id, "");
    const prevUserId = normalizeText(adminPresenceState.currentUser?.id, "");

    if (!nextUserId) {
      adminPresenceState.currentUser = null;
      updateAdminUI(null);
      adminPresenceState.resolvedAdminForUserId = "";
      adminOnlineState.shouldMaintainPresence = false;
      void syncSelfBanSubscription();
      void syncSelfFreezeSubscription();
      try {
        await stopOnlinePresence({ preserveFallback: false });
      } catch (error) {
        console.error("[supabase-bridge] Failed to stop online presence:", error);
      }
      emitAdminAuthChanged(eventName, session || null);
      return;
    }

    const isDifferentUser = prevUserId !== nextUserId;
    adminPresenceState.currentUser = nextUser;

    if (isDifferentUser) {
      adminPresenceState.resolvedAdminForUserId = "";
      adminOnlineState.shouldMaintainPresence = false;
      try {
        await stopOnlinePresence({
          preserveFallback: false
        });
      } catch (error) {
        console.error("[supabase-bridge] Failed to stop online presence:", error);
      }
    }

    const isAdmin = await resolveIsAdminForUser(nextUser);
    adminPresenceState.isAdmin = updateAdminUI(nextUser, isAdmin);
    adminPresenceState.resolvedAdminForUserId = nextUserId;
    adminOnlineState.shouldMaintainPresence = true;
    void syncSelfBanSubscription();
    void syncSelfFreezeSubscription();
    await refreshSelfFreezeState({ userId: nextUserId });
    try {
      await startOnlinePresence(session || { user: nextUser });
    } catch (error) {
      console.error("[supabase-bridge] Failed to start online presence:", error);
    }

    emitAdminAuthChanged(eventName, session || null);
  }

  function emitAdminAuthChanged(eventName, session) {
    const payload = createAdminAuthSnapshot(eventName, session);
    window.dispatchEvent(
      new CustomEvent(ADMIN_AUTH_CHANGED_EVENT_NAME, {
        detail: payload
      })
    );

    const callbacks = Array.from(adminPresenceState.authCallbacks);
    callbacks.forEach((callback) => {
      safeCallAdminAuthCallback(callback, payload);
    });
  }

  function safeCallAdminAuthCallback(callback, payload) {
    try {
      callback(payload);
    } catch (error) {
      console.warn("[supabase-bridge] onAuthChanged callback failed:", error);
    }
  }

  function createAdminAuthSnapshot(eventName, session) {
    const user = adminPresenceState.currentUser;
    return {
      event: normalizeText(eventName, "unknown"),
      session: session || null,
      currentUser: user,
      isAuthenticated: Boolean(user && normalizeText(user.id, "")),
      isAdmin: Boolean(adminPresenceState.isAdmin)
    };
  }

  async function resolveIsAdminForUser(user) {
    const safeUserId = normalizeText(user?.id, "");
    if (!safeUserId) {
      return false;
    }

    const client = await ensureAdminClient();

    if (adminPresenceState.supportsActiveAdminRpc !== false) {
      try {
        const rpcResult = await client.rpc("is_active_admin");
        if (!rpcResult?.error) {
          adminPresenceState.supportsActiveAdminRpc = true;
          const rpcData = Array.isArray(rpcResult.data) ? rpcResult.data[0] : rpcResult.data;
          const directValue = rpcData?.is_active_admin ?? rpcData?.isActiveAdmin ?? rpcData;
          if (typeof directValue === "boolean") {
            return directValue;
          }
          if (typeof directValue === "number") {
            return directValue === 1;
          }
          if (typeof directValue === "string") {
            const normalized = directValue.trim().toLowerCase();
            if (normalized === "true" || normalized === "1" || normalized === "yes") {
              return true;
            }
            if (normalized === "false" || normalized === "0" || normalized === "no") {
              return false;
            }
          }
        } else if (isMissingFunctionLikeError(rpcResult.error)) {
          adminPresenceState.supportsActiveAdminRpc = false;
        }
      } catch (error) {
        if (isMissingFunctionLikeError(error)) {
          adminPresenceState.supportsActiveAdminRpc = false;
        } else {
          console.warn("[supabase-bridge] is_active_admin RPC failed:", error);
        }
      }
    }

    try {
      const rpcResult = await client.rpc("is_admin");
      if (!rpcResult?.error) {
        const rpcData = Array.isArray(rpcResult.data) ? rpcResult.data[0] : rpcResult.data;
        const directValue = rpcData?.is_admin ?? rpcData?.isAdmin ?? rpcData;
        if (typeof directValue === "boolean") {
          return directValue;
        }
        if (typeof directValue === "number") {
          return directValue === 1;
        }
        if (typeof directValue === "string") {
          const normalized = directValue.trim().toLowerCase();
          if (normalized === "true" || normalized === "1" || normalized === "yes") {
            return true;
          }
          if (normalized === "false" || normalized === "0" || normalized === "no") {
            return false;
          }
        }
      }
    } catch (error) {
      console.warn("[supabase-bridge] is_admin RPC failed:", error);
    }

    try {
      const profileResult = await client
        .from("profiles")
        .select("role")
        .eq("id", safeUserId)
        .maybeSingle();
      if (profileResult?.error) {
        return false;
      }
      const role = normalizeText(profileResult?.data?.role, "").toLowerCase();
      return role === "admin";
    } catch {
      return false;
    }
  }

  async function ensureAdminContext() {
    const client = await ensureAdminClient();
    const user = await ensureCurrentUser(client);
    const userId = normalizeText(user?.id, "");
    if (!userId) {
      throw new Error("Authentication required.");
    }

    if (adminPresenceState.resolvedAdminForUserId !== userId) {
      const isAdmin = await resolveIsAdminForUser(user);
      adminPresenceState.isAdmin = isAdmin;
      adminPresenceState.resolvedAdminForUserId = userId;
    }

    if (!adminPresenceState.isAdmin) {
      throw new Error("Admin access required.");
    }

    return {
      client,
      user
    };
  }

  async function ensureCurrentUser(client) {
    const cachedUser = adminPresenceState.currentUser;
    if (cachedUser && normalizeText(cachedUser.id, "")) {
      return cachedUser;
    }

    const { data, error } = await client.auth.getUser();
    if (error) {
      throw new Error(formatSupabaseErrorMessage(error, "Failed to resolve current user."));
    }

    adminPresenceState.currentUser = data?.user || null;
    return adminPresenceState.currentUser;
  }

  async function ensureAdminClient() {
    if (isSupabaseClient(adminPresenceState.client)) {
      installRealtimeDiagnostics(adminPresenceState.client);
      return adminPresenceState.client;
    }

    if (isSupabaseClient(state.client)) {
      adminPresenceState.client = state.client;
      installRealtimeDiagnostics(adminPresenceState.client);
      return adminPresenceState.client;
    }

    const client = await waitForSupabaseClient(SUPABASE_READY_TIMEOUT_MS);
    if (!client) {
      throw new Error("Supabase client is not available.");
    }

    adminPresenceState.client = client;
    installRealtimeDiagnostics(adminPresenceState.client);
    return client;
  }

  async function loadAdminReviewsFromView(client, limit) {
    const { data, error } = await client
      .from("admin_reviews")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      if (isMissingRelationError(error)) {
        return null;
      }
      throw new Error(formatSupabaseErrorMessage(error, "Failed to load admin reviews."));
    }

    return Array.isArray(data) ? data : [];
  }

  async function loadAdminReviewsFromTable(client, limit) {
    const selectVariants = [
      "id,user_id,place_id,rating,comment,created_at,is_deleted,deleted_at,deleted_by,delete_reason",
      "id,user_id,place_id,rating,comment,created_at,is_deleted,deleted_at,deleted_by,deleted_reason",
      "id,user_id,place_id,rating,comment,created_at,deleted_at,deleted_by,deleted_reason",
      "id,user_id,place_id,rating,comment,created_at"
    ];

    let reviewsData = [];
    let reviewsError = null;

    for (const selectClause of selectVariants) {
      const response = await client
        .from("reviews")
        .select(selectClause)
        .order("created_at", { ascending: false })
        .limit(limit);

      reviewsData = Array.isArray(response?.data) ? response.data : [];
      reviewsError = response?.error || null;
      if (!reviewsError) {
        break;
      }
      if (!isMissingColumnError(reviewsError)) {
        break;
      }
    }

    if (reviewsError) {
      throw new Error(formatSupabaseErrorMessage(reviewsError, "Failed to load reviews."));
    }

    const normalizedReviews = reviewsData.map((entry) => normalizeReviewRow(entry));
    const byUserId = await loadProfilesEmailByUserId(client, normalizedReviews);
    const placeTitleById = await loadPlaceTitlesByPlaceId(client, normalizedReviews);

    return normalizedReviews.map((entry) => {
      const userId = normalizeText(entry?.user_id, "");
      const placeId = normalizeText(entry?.place_id, "");
      const profile = byUserId.get(userId) || null;
      const placeTitle = normalizeText(placeTitleById.get(placeId), "Unknown place");

      return {
        ...entry,
        place_title: placeTitle,
        email: normalizeText(profile?.email, ""),
        profile
      };
    });
  }

  function normalizeReviewRow(entry) {
    const row = entry && typeof entry === "object" ? entry : {};
    return {
      id: normalizeText(row.id, ""),
      user_id: normalizeText(row.user_id, ""),
      place_id: normalizeText(row.place_id, ""),
      rating: Number(row.rating),
      comment: normalizeText(row.comment, ""),
      created_at: normalizeText(row.created_at, ""),
      is_deleted: (
        typeof row.is_deleted === "boolean"
          ? row.is_deleted
          : Boolean(normalizeText(row.deleted_at, ""))
      ),
      deleted_at: normalizeText(row.deleted_at, ""),
      deleted_by: normalizeText(row.deleted_by, ""),
      delete_reason: normalizeText(row.delete_reason ?? row.deleted_reason, "")
    };
  }

  async function loadPlaceTitlesByPlaceId(client, reviews) {
    const ids = Array.from(
      new Set(
        (Array.isArray(reviews) ? reviews : [])
          .map((entry) => normalizeText(entry?.place_id, ""))
          .filter(Boolean)
      )
    );

    if (ids.length === 0) {
      return new Map();
    }

    const { data, error } = await client
      .from("places")
      .select("id,title")
      .in("id", ids);

    if (error) {
      if (isMissingRelationError(error) || isMissingColumnError(error)) {
        return new Map();
      }
      throw new Error(formatSupabaseErrorMessage(error, "Failed to load places."));
    }

    const byPlaceId = new Map();
    (Array.isArray(data) ? data : []).forEach((entry) => {
      const placeId = normalizeText(entry?.id, "");
      if (!placeId) {
        return;
      }
      byPlaceId.set(placeId, normalizeText(entry?.title, ""));
    });
    return byPlaceId;
  }

  async function loadProfilesEmailByUserId(client, reviews) {
    const ids = Array.from(
      new Set(
        (Array.isArray(reviews) ? reviews : [])
          .map((entry) => normalizeText(entry?.user_id, ""))
          .filter(Boolean)
      )
    );

    if (ids.length === 0) {
      return new Map();
    }

    const idQuery = await client
      .from("profiles")
      .select("id,email")
      .in("id", ids);

    if (!idQuery.error) {
      return mapProfilesByKey(idQuery.data, "id");
    }

    if (isMissingRelationError(idQuery.error)) {
      console.warn("[supabase-bridge] Failed to enrich reviews with profile emails:", idQuery.error);
      return new Map();
    }

    if (!isMissingColumnError(idQuery.error)) {
      throw new Error(formatSupabaseErrorMessage(idQuery.error, "Failed to load profiles."));
    }

    const userIdQuery = await client
      .from("profiles")
      .select("user_id,email")
      .in("user_id", ids);

    if (userIdQuery.error) {
      if (isMissingRelationError(userIdQuery.error) || isMissingColumnError(userIdQuery.error)) {
        console.warn("[supabase-bridge] Failed to enrich reviews with profile emails:", userIdQuery.error);
        return new Map();
      }
      throw new Error(formatSupabaseErrorMessage(userIdQuery.error, "Failed to load profiles."));
    }

    return mapProfilesByKey(userIdQuery.data, "user_id");
  }

  function mapProfilesByKey(data, keyName) {
    const records = Array.isArray(data) ? data : [];
    const result = new Map();
    records.forEach((entry) => {
      const key = normalizeText(entry?.[keyName], "");
      if (!key) {
        return;
      }
      result.set(key, {
        id: key,
        email: normalizeText(entry?.email, "")
      });
    });
    return result;
  }

  function registerAdminPresenceApi() {
    window.WorldAtlasAdminPresence = Object.freeze({
      initAdminPresence,
      getIsAdmin,
      onAuthChanged,
      getAdminPresenceList,
      getAdminReviews,
      adminSoftDeleteReview,
      adminRestoreReview,
      adminBanEmail,
      adminUnbanEmail
    });
  }

  function normalizePositiveInteger(value, fallbackValue, minValue, maxValue) {
    const asNumber = Number(value);
    if (!Number.isFinite(asNumber)) {
      return fallbackValue;
    }

    const rounded = Math.floor(asNumber);
    if (rounded < minValue || rounded > maxValue) {
      return fallbackValue;
    }

    return rounded;
  }

  function isMissingRelationError(error) {
    const code = normalizeText(error?.code, "").toUpperCase();
    if (code === "PGRST205" || code === "42P01") {
      return true;
    }

    const message = normalizeText(error?.message, "").toLowerCase();
    return (
      message.includes("could not find the table") ||
      message.includes("relation") && message.includes("does not exist")
    );
  }

  function isMissingColumnError(error) {
    const code = normalizeText(error?.code, "").toUpperCase();
    if (code === "42703") {
      return true;
    }

    const message = normalizeText(error?.message, "").toLowerCase();
    return message.includes("column") && message.includes("does not exist");
  }

  function isMissingFunctionLikeError(error) {
    const code = normalizeText(error?.code, "").toUpperCase();
    if (code === "42883" || code === "PGRST202") {
      return true;
    }

    const message = normalizeText(error?.message, "").toLowerCase();
    return (
      message.includes("function") && message.includes("does not exist") ||
      message.includes("could not find the function")
    );
  }

  function formatSupabaseErrorMessage(error, fallbackMessage) {
    const message = normalizeText(error?.message, "");
    const details = normalizeText(error?.details, "");
    if (message && details) {
      return `${message} (${details})`;
    }
    if (message) {
      return message;
    }
    return fallbackMessage;
  }

  function logSupabaseClientConfig(client) {
    const config = window.SUPABASE_CONFIG && typeof window.SUPABASE_CONFIG === "object"
      ? window.SUPABASE_CONFIG
      : {};
    const rawUrl = normalizeText(config.url, normalizeText(client?.supabaseUrl, ""));
    const key = normalizeText(config.publishableKey, "");
    const safeKeyPreview = key ? `${key.slice(0, 14)}...` : "missing";

    if (!rawUrl) {
      console.error("[supabase-bridge] Supabase URL is missing.");
      return;
    }

    try {
      const parsed = new URL(rawUrl);
      const host = normalizeText(parsed.hostname, "");
      const isSupabaseHost = /\.supabase\.co$/i.test(host);
      if (!isSupabaseHost) {
        console.error("[supabase-bridge] Unexpected Supabase host:", host || rawUrl);
      }
      if (!key) {
        console.error("[supabase-bridge] Supabase publishable key is missing.");
      }
      console.info(
        `[supabase-bridge] Supabase client ready: host=${host || "unknown"} key=${safeKeyPreview}`
      );
    } catch (error) {
      console.error("[supabase-bridge] Invalid Supabase URL:", rawUrl, error);
    }
  }

  function installRealtimeDiagnostics(client) {
    if (!isSupabaseClient(client) || !client.realtime || typeof client.realtime !== "object") {
      return;
    }
    if (realtimeDiagnosticsClients.has(client)) {
      return;
    }
    realtimeDiagnosticsClients.add(client);

    const realtime = client.realtime;
    const safeBind = (methodName, handler) => {
      if (typeof realtime[methodName] !== "function") {
        return;
      }
      try {
        realtime[methodName](handler);
      } catch (error) {
        console.warn(`[supabase-bridge] Realtime diagnostics bind failed: ${methodName}`, error);
      }
    };

    safeBind("onOpen", () => {
      console.info("[supabase-bridge] Realtime socket opened.");
    });
    safeBind("onClose", (event) => {
      console.warn("[supabase-bridge] Realtime socket closed.", event || "");
    });
    safeBind("onError", (error) => {
      console.error("[supabase-bridge] Realtime socket error:", error || "");
    });
    safeBind("onMessage", (message) => {
      if (message?.event === "phx_error" || message?.event === "phx_close") {
        console.warn("[supabase-bridge] Realtime message event:", message);
      }
    });
  }

  function readCredentials() {
    const email = normalizeText(ui.emailInput.value, "").toLowerCase();
    const password = ui.passwordInput.value || "";

    if (!email || !isLikelyEmail(email)) {
      showMessage("Enter a valid email.", "error");
      ui.emailInput.focus();
      return null;
    }

    if (password.length < 6) {
      showMessage("Password must be at least 6 characters.", "error");
      ui.passwordInput.focus();
      return null;
    }

    return {
      email,
      password
    };
  }

  async function requestWorkerJson(method, path, body = null) {
    const response = await fetch(path, {
      method,
      headers: {
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (payload?.access && typeof payload.access === "object") {
      applyServerAccessSnapshot(payload.access, payload?.visitor);
    }

    if (!response.ok) {
      const message = normalizeText(payload?.error, `Request failed with status ${response.status}.`);
      throw new Error(message);
    }

    return payload;
  }

  function wait(timeoutMs) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, Math.max(0, Number(timeoutMs) || 0));
    });
  }

  function setBusy(isBusy) {
    state.busy = Boolean(isBusy);
    ui.signInButton.disabled = state.busy;
    ui.signUpButton.disabled = state.busy;
    ui.signOutButton.disabled = state.busy;
    ui.emailInput.disabled = state.busy;
    ui.passwordInput.disabled = state.busy;
  }

  function disableAuthActions(disabled) {
    const isDisabled = Boolean(disabled);
    ui.signInButton.disabled = isDisabled;
    ui.signUpButton.disabled = isDisabled;
    ui.signOutButton.disabled = isDisabled;
    ui.emailInput.disabled = isDisabled;
    ui.passwordInput.disabled = isDisabled;
  }

  function setAuthFormMode(isAuthenticated) {
    const showCredentials = !Boolean(isAuthenticated);
    ui.emailLabel.hidden = !showCredentials;
    ui.emailInput.hidden = !showCredentials;
    ui.passwordLabel.hidden = !showCredentials;
    ui.passwordInput.hidden = !showCredentials;
    ui.signInButton.hidden = !showCredentials;
    ui.signUpButton.hidden = !showCredentials;
    ui.actionsRow.hidden = !showCredentials;
    if (ui.resendButton instanceof HTMLElement) {
      ui.resendButton.hidden = true;
    }
  }

  function showMessage(message, type = "info") {
    const text = normalizeText(message, "");
    if (!text) {
      ui.message.hidden = true;
      ui.message.textContent = "";
      ui.message.classList.remove("is-error", "is-success");
      return;
    }

    ui.message.hidden = false;
    ui.message.textContent = text;
    ui.message.classList.remove("is-error", "is-success");

    if (type === "error") {
      ui.message.classList.add("is-error");
    } else if (type === "success") {
      ui.message.classList.add("is-success");
    }
  }

  function showAdminToast(message) {
    const text = normalizeText(message, "");
    if (!text) {
      return;
    }

    const toastEl = document.getElementById("app-toast");
    if (!(toastEl instanceof HTMLElement)) {
      return;
    }

    toastEl.textContent = text;
    toastEl.hidden = false;
    toastEl.classList.add("is-visible");

    const previousTimer = Number(toastEl.dataset.timerId) || 0;
    if (previousTimer) {
      window.clearTimeout(previousTimer);
    }

    const timerId = window.setTimeout(() => {
      toastEl.classList.remove("is-visible");
      window.setTimeout(() => {
        if (!toastEl.classList.contains("is-visible")) {
          toastEl.hidden = true;
        }
      }, 220);
      delete toastEl.dataset.timerId;
    }, 2400);

    toastEl.dataset.timerId = String(timerId);
  }

  function isInvalidCredentialsError(error) {
    const message = normalizeText(error?.message, "").toLowerCase();
    if (!message) {
      return false;
    }

    return (
      message.includes("invalid login credentials") ||
      message.includes("invalid credentials") ||
      message.includes("invalid email or password")
    );
  }

  function isEmailConfirmationError(error) {
    const message = normalizeText(error?.message, "").toLowerCase();
    if (!message) {
      return false;
    }

    return (
      message.includes("email not confirmed") ||
      message.includes("not confirmed") ||
      message.includes("confirm your email")
    );
  }

  function isUserAlreadyExistsError(error) {
    const message = normalizeText(error?.message, "").toLowerCase();
    if (!message) {
      return false;
    }

    return (
      message.includes("already registered") ||
      message.includes("user already registered") ||
      message.includes("already exists")
    );
  }

  function isObfuscatedExistingUser(signUpData) {
    const identities = signUpData?.user?.identities;
    return Array.isArray(identities) && identities.length === 0;
  }

  async function waitForSupabaseClient(timeoutMs) {
    const directClient = getSupabaseClientSync();
    if (directClient) {
      return directClient;
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
      const fallbackClient = getSupabaseClientSync();
      if (fallbackClient) {
        return fallbackClient;
      }
      throw new Error("Supabase client promise resolved without a valid client.");
    }

    return new Promise((resolve, reject) => {
      let done = false;

      const finish = (value, asError) => {
        if (done) {
          return;
        }
        done = true;
        window.removeEventListener("worldatlas:supabase-ready", onReady);
        window.removeEventListener("worldatlas:supabase-error", onError);
        if (timeoutId) {
          window.clearTimeout(timeoutId);
        }
        if (asError) {
          reject(value);
        } else {
          resolve(value);
        }
      };

      const onReady = () => {
        const client = getSupabaseClientSync();
        if (client) {
          finish(client, false);
        }
      };

      const onError = (event) => {
        finish(event?.detail?.error || new Error("Supabase init failed."), true);
      };

      const timeoutId = window.setTimeout(() => {
        finish(new Error("Timed out while waiting for Supabase client."), true);
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

    const bridgeClient = window.WorldAtlasSupabase?.client;
    if (isSupabaseClient(bridgeClient)) {
      return bridgeClient;
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

  function getAuthUiElements() {
    const toggleButton = document.getElementById("auth-toggle");
    const toggleLabel = document.getElementById("auth-toggle-label");
    const userBadge = document.getElementById("auth-user-badge");
    const panel = document.getElementById("auth-panel");
    const closeButton = document.getElementById("auth-close");
    const userLine = document.getElementById("auth-user-line");
    const message = document.getElementById("auth-message");
    const authForm = document.getElementById("auth-form");
    const emailLabel = document.getElementById("auth-email-label");
    const emailInput = document.getElementById("auth-email");
    const passwordLabel = document.getElementById("auth-password-label");
    const passwordInput = document.getElementById("auth-password");
    const actionsRow = authForm instanceof HTMLElement
      ? authForm.querySelector(".auth-panel__actions")
      : null;
    const signInButton = document.getElementById("auth-sign-in");
    const signUpButton = document.getElementById("auth-sign-up");
    const resendButton = document.getElementById("auth-resend-confirmation");
    const signOutButton = document.getElementById("auth-sign-out");

    const required = [
      toggleButton,
      toggleLabel,
      userBadge,
      panel,
      closeButton,
      userLine,
      message,
      authForm,
      emailLabel,
      emailInput,
      passwordLabel,
      passwordInput,
      actionsRow,
      signInButton,
      signUpButton,
      signOutButton
    ];

    if (required.some((item) => !(item instanceof HTMLElement))) {
      return null;
    }

    return {
      toggleButton,
      toggleLabel,
      userBadge,
      panel,
      closeButton,
      userLine,
      message,
      authForm,
      emailLabel,
      emailInput,
      passwordLabel,
      passwordInput,
      actionsRow,
      signInButton,
      signUpButton,
      resendButton,
      signOutButton
    };
  }

  function getAdminUiElements() {
    const toggleButton = document.getElementById("admin-toggle");
    const drawer = document.getElementById("admin-drawer");
    const backdrop = document.getElementById("admin-backdrop");
    const closeButton = document.getElementById("admin-drawer-close");
    const tabQueue = document.getElementById("admin-tab-queue");
    const tabReviews = document.getElementById("admin-tab-reviews");
    const tabOnline = document.getElementById("admin-tab-online");
    const tabOps = document.getElementById("admin-tab-ops");
    const panelQueue = document.getElementById("admin-panel-queue");
    const panelReviews = document.getElementById("admin-panel-reviews");
    const panelOnline = document.getElementById("admin-panel-online");
    const panelOps = document.getElementById("admin-panel-ops");
    const queueRefreshButton = document.getElementById("admin-queue-refresh");
    const queueSearchInput = document.getElementById("admin-queue-search");
    const queueStateSelect = document.getElementById("admin-queue-state");
    const submissionsList = document.getElementById("admin-submissions-list");
    const queuePendingStat = document.getElementById("admin-stat-pending");
    const queueNewTodayStat = document.getElementById("admin-stat-new-today");
    const queueApprovedWeekStat = document.getElementById("admin-stat-approved-week");
    const queueReviewsDayStat = document.getElementById("admin-stat-reviews-day");
    const queueBansWeekStat = document.getElementById("admin-stat-bans-week");
    const queueAudienceLiveStat = document.getElementById("admin-stat-audience-live");
    const contentHeatmap = document.getElementById("admin-content-heatmap");
    const contentHeatmapSummary = document.getElementById("admin-content-heatmap-summary");
    const audienceHeatmap = document.getElementById("admin-audience-heatmap");
    const audienceHeatmapSummary = document.getElementById("admin-audience-heatmap-summary");
    const reviewsSearchInput = document.getElementById("admin-reviews-search");
    const reviewsList = document.getElementById("admin-reviews-list");
    const onlineCountValue = document.getElementById("admin-online-count");
    const onlineRefreshButton = document.getElementById("admin-online-refresh");
    const onlineList = document.getElementById("admin-online-list");
    const commandInput = document.getElementById("admin-command-input");
    const commandRunButton = document.getElementById("admin-command-run");
    const commandStatus = document.getElementById("admin-command-status");
    const commandPresetButtons = Array.from(document.querySelectorAll("[data-admin-command-template]"));
    const dossierCard = document.getElementById("admin-dossier-card");
    const noteInput = document.getElementById("admin-note-input");
    const noteSaveButton = document.getElementById("admin-note-save");
    const notesList = document.getElementById("admin-notes-list");
    const geoRefreshButton = document.getElementById("admin-geo-refresh");
    const geoSearchInput = document.getElementById("admin-geo-search");
    const geoSourceSelect = document.getElementById("admin-geo-source");
    const geoFilterNewButton = document.getElementById("admin-geo-filter-new");
    const geoFilterSuspiciousButton = document.getElementById("admin-geo-filter-suspicious");
    const geoFilterNoPhotoButton = document.getElementById("admin-geo-filter-no-photo");
    const geoFilterNoDescriptionButton = document.getElementById("admin-geo-filter-no-description");
    const geoCountValue = document.getElementById("admin-geo-count");
    const geoSummary = document.getElementById("admin-geo-summary");
    const geoMap = document.getElementById("admin-geo-map");
    const geoList = document.getElementById("admin-geo-list");

    return {
      toggleButton: toggleButton instanceof HTMLElement ? toggleButton : null,
      drawer: drawer instanceof HTMLElement ? drawer : null,
      backdrop: backdrop instanceof HTMLElement ? backdrop : null,
      closeButton: closeButton instanceof HTMLElement ? closeButton : null,
      tabQueue: tabQueue instanceof HTMLElement ? tabQueue : null,
      tabReviews: tabReviews instanceof HTMLElement ? tabReviews : null,
      tabOnline: tabOnline instanceof HTMLElement ? tabOnline : null,
      tabOps: tabOps instanceof HTMLElement ? tabOps : null,
      panelQueue: panelQueue instanceof HTMLElement ? panelQueue : null,
      panelReviews: panelReviews instanceof HTMLElement ? panelReviews : null,
      panelOnline: panelOnline instanceof HTMLElement ? panelOnline : null,
      panelOps: panelOps instanceof HTMLElement ? panelOps : null,
      queueRefreshButton: queueRefreshButton instanceof HTMLElement ? queueRefreshButton : null,
      queueSearchInput: queueSearchInput instanceof HTMLInputElement ? queueSearchInput : null,
      queueStateSelect: queueStateSelect instanceof HTMLSelectElement ? queueStateSelect : null,
      submissionsList: submissionsList instanceof HTMLElement ? submissionsList : null,
      queuePendingStat: queuePendingStat instanceof HTMLElement ? queuePendingStat : null,
      queueNewTodayStat: queueNewTodayStat instanceof HTMLElement ? queueNewTodayStat : null,
      queueApprovedWeekStat: queueApprovedWeekStat instanceof HTMLElement ? queueApprovedWeekStat : null,
      queueReviewsDayStat: queueReviewsDayStat instanceof HTMLElement ? queueReviewsDayStat : null,
      queueBansWeekStat: queueBansWeekStat instanceof HTMLElement ? queueBansWeekStat : null,
      queueAudienceLiveStat: queueAudienceLiveStat instanceof HTMLElement ? queueAudienceLiveStat : null,
      contentHeatmap: contentHeatmap instanceof HTMLElement ? contentHeatmap : null,
      contentHeatmapSummary: contentHeatmapSummary instanceof HTMLElement ? contentHeatmapSummary : null,
      audienceHeatmap: audienceHeatmap instanceof HTMLElement ? audienceHeatmap : null,
      audienceHeatmapSummary: audienceHeatmapSummary instanceof HTMLElement ? audienceHeatmapSummary : null,
      reviewsSearchInput: reviewsSearchInput instanceof HTMLInputElement ? reviewsSearchInput : null,
      reviewsList: reviewsList instanceof HTMLElement ? reviewsList : null,
      onlineCountValue: onlineCountValue instanceof HTMLElement ? onlineCountValue : null,
      onlineRefreshButton: onlineRefreshButton instanceof HTMLElement ? onlineRefreshButton : null,
      onlineList: onlineList instanceof HTMLElement ? onlineList : null,
      commandInput: commandInput instanceof HTMLInputElement ? commandInput : null,
      commandRunButton: commandRunButton instanceof HTMLElement ? commandRunButton : null,
      commandStatus: commandStatus instanceof HTMLElement ? commandStatus : null,
      commandPresetButtons: commandPresetButtons.filter((item) => item instanceof HTMLButtonElement),
      dossierCard: dossierCard instanceof HTMLElement ? dossierCard : null,
      noteInput: noteInput instanceof HTMLTextAreaElement ? noteInput : null,
      noteSaveButton: noteSaveButton instanceof HTMLElement ? noteSaveButton : null,
      notesList: notesList instanceof HTMLElement ? notesList : null,
      geoRefreshButton: geoRefreshButton instanceof HTMLElement ? geoRefreshButton : null,
      geoSearchInput: geoSearchInput instanceof HTMLInputElement ? geoSearchInput : null,
      geoSourceSelect: geoSourceSelect instanceof HTMLSelectElement ? geoSourceSelect : null,
      geoFilterNewButton: geoFilterNewButton instanceof HTMLElement ? geoFilterNewButton : null,
      geoFilterSuspiciousButton: geoFilterSuspiciousButton instanceof HTMLElement ? geoFilterSuspiciousButton : null,
      geoFilterNoPhotoButton: geoFilterNoPhotoButton instanceof HTMLElement ? geoFilterNoPhotoButton : null,
      geoFilterNoDescriptionButton: geoFilterNoDescriptionButton instanceof HTMLElement ? geoFilterNoDescriptionButton : null,
      geoCountValue: geoCountValue instanceof HTMLElement ? geoCountValue : null,
      geoSummary: geoSummary instanceof HTMLElement ? geoSummary : null,
      geoMap: geoMap instanceof HTMLElement ? geoMap : null,
      geoList: geoList instanceof HTMLElement ? geoList : null
    };
  }

  function isLikelyEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value));
  }

  function isRecentIso(value, hours) {
    const timestamp = Date.parse(normalizeText(value, ""));
    if (!Number.isFinite(timestamp)) {
      return false;
    }
    const thresholdMs = Math.max(1, Number(hours) || 1) * 60 * 60 * 1000;
    return Math.abs(Date.now() - timestamp) <= thresholdMs;
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
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(normalized)
      ? normalized
      : "";
  }
})();
