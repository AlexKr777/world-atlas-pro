  (() => {
  "use strict";
  const FEEDBACK_CACHE_TTL_MS = 7 * 60 * 1000;
  const FACTS_CACHE_TTL_MS = 10 * 60 * 1000;
  const REVIEW_VIRTUAL_WINDOW = 25;
  const REVIEW_VIRTUAL_OVERSCAN = 5;
  const REVIEW_ESTIMATED_HEIGHT_PX = 104;
  const MAX_REVIEW_NODE_CACHE = 220;
  function createAbortError() {
    const error = new Error("Aborted");
    error.name = "AbortError";
    return error;
  }
  function isAbortError(error) {
    return Boolean(error && typeof error === "object" && error.name === "AbortError");
  }
  function withAbort(promise, signal) {
    if (!(signal instanceof AbortSignal)) {
      return Promise.resolve(promise);
    }
    if (signal.aborted) {
      return Promise.reject(createAbortError());
    }
    return new Promise((resolve, reject) => {
      const onAbort = () => {
        cleanup();
        reject(createAbortError());
      };
      const cleanup = () => {
        signal.removeEventListener("abort", onAbort);
      };
      signal.addEventListener("abort", onAbort, { once: true });
      Promise.resolve(promise).then(
        (value) => {
          if (signal.aborted) {
            cleanup();
            reject(createAbortError());
            return;
          }
          cleanup();
          resolve(value);
        },
        (error) => {
          cleanup();
          reject(error);
        }
      );
    });
  }
  function createPopupController(options) {
    const {
      backdropEl,
      popupEl,
      closeButtonEl,
      contentEl,
      loadingStateEl,
      errorStateEl,
      errorMessageEl,
      retryButtonEl,
      mediaEl,
      mediaSkeletonEl,
      mediaErrorEl,
      imageEl,
      regionLineEl,
      countryEl,
      titleEl,
      trustSignalsEl,
      descriptionEl,
      seasonSectionEl,
      seasonStatusEl,
      seasonTabsEl,
      seasonCopyEl,
      summaryListEl,
      highlightsEl,
      factEl,
      coordinatesEl,
      routeFromButtonEl,
      favoriteToggleButtonEl,
      shareButtonEl,
      deleteButtonEl,
      navigationEl,
      previousPlaceButtonEl,
      nextPlaceButtonEl,
      statusWantButtonEl,
      statusVisitedButtonEl,
      ratingStarsEl,
      reviewCommentEl,
      reviewSaveButtonEl,
      feedbackAuthHintEl,
      communityAverageEl,
      communityCountEl,
      communityReviewsEl,
      sourcesEl,
      sourcesInfoEl,
      updatedEl,
      linkRowEl,
      linkEl,
      weatherSectionEl,
      weatherStatusEl,
      weatherIconEl,
      weatherTempEl,
      weatherConditionEl,
      weatherLocalEl,
      weatherMetaEl,
      weatherUpdatedEl,
      subscribeToMapMotion,
      onVisibilityChange,
      onRouteFromPlace,
      onToggleFavorite,
      isFavoritePlace,
      onFavoritesChanged,
      onSharePlace,
      canDeletePlace,
      onDeletePlace,
      getAdjacentPlaces,
      onNavigatePlace,
      onClose,
      onLoadPlaceFacts,
      onLoadPlaceWeather,
      config = {},
      helpers = {},
      placeFeedbackStore = null
    } = options;
    const Config = config;
    const PlaceFeedbackStore = placeFeedbackStore;
    const {
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
    } = helpers;

    if (
      typeof isValidPlace !== "function" ||
      typeof normalizeText !== "function" ||
      typeof clamp !== "function" ||
      typeof round !== "function" ||
      typeof formatCoordinates !== "function" ||
      typeof normalizeHttpUrl !== "function" ||
      typeof buildPlaceDetails !== "function" ||
      typeof normalizePlaceFacts !== "function" ||
      typeof formatCountryLine !== "function" ||
      typeof formatCompactPopulation !== "function" ||
      typeof formatArea !== "function" ||
      typeof resolvePlaceSources !== "function" ||
      typeof getPlaceImageUrl !== "function" ||
      typeof getPopupImageCandidates !== "function" ||
      typeof normalizeSeasonKey !== "function" ||
      typeof formatSeasonLabel !== "function" ||
      typeof normalizeSeasonalContentValue !== "function" ||
      typeof buildPlaceSeasonView !== "function" ||
      typeof resolveCurrentSeasonKey !== "function" ||
      typeof normalizeFeedbackStatus !== "function" ||
      typeof normalizeFeedbackRating !== "function" ||
      typeof normalizeFeedbackCommentDraft !== "function" ||
      typeof normalizeFeedbackComment !== "function" ||
      typeof buildStarsString !== "function" ||
      typeof formatReviewDate !== "function"
    ) {
      throw new Error("Popup helper bindings are incomplete.");
    }

    const safeSetStatus = typeof setStatus === "function" ? setStatus : () => {};
    const safeShowToast = typeof showToast === "function" ? showToast : () => {};
    const BANNED_REVIEW_MESSAGE = "Your account is banned. Reviews are disabled.";
    const globalPopupBridge =
      window.WorldAtlasAppBridge && typeof window.WorldAtlasAppBridge === "object"
        ? window.WorldAtlasAppBridge
        : null;
    const resolvedToggleFavorite = typeof onToggleFavorite === "function"
      ? onToggleFavorite
      : (
        typeof globalPopupBridge?.toggleFavoritePlace === "function"
          ? globalPopupBridge.toggleFavoritePlace
          : (typeof window.toggleFavoritePlace === "function" ? window.toggleFavoritePlace : null)
      );
    const resolvedIsFavoritePlace = typeof isFavoritePlace === "function"
      ? isFavoritePlace
      : (
        typeof globalPopupBridge?.isFavoritePlace === "function"
          ? globalPopupBridge.isFavoritePlace
          : (typeof window.isFavoritePlace === "function" ? window.isFavoritePlace : null)
      );

    function isWriteBlockedByBan() {
      if (typeof globalPopupBridge?.isWriteBlocked === "function") {
        try {
          if (globalPopupBridge.isWriteBlocked()) {
            return true;
          }
        } catch {
          // fallback below
        }
      }
      const bodyEl = document.body;
      return Boolean(bodyEl instanceof HTMLBodyElement && bodyEl.dataset.userBanned === "true");
    }

    let isOpen = false;
    let currentContext = null;
    let hideTimerId = null;
    let trackingFrameId = null;
    let trackingTimerId = null;
    let toolbarRestoreTimerId = null;
    let unsubscribeMapMotion = null;
    let isMapMotionActive = false;
    let switchAnimationTimerId = null;
    let renderSessionToken = 0;
    let popupTrackIdleFrames = 0;
    let popupTrackFrameCounter = 0;
    let popupTargetPosition = null;
    let popupLastAnchorPoint = null;
    let popupCachedSize = null;
    let popupCachedMaxHeight = null;
    let popupLayoutMode = "";
    let popupLastMapMotionChangeAt = 0;
    let mediaRequestToken = 0;
    let pendingRenderFrameId = null;
    let pendingRenderTimerId = null;
    let pendingNonCriticalRenderFrameId = null;
    let pendingNonCriticalRenderTimerId = null;
    let pendingNonCriticalIdleId = null;
    let activeMediaAbortController = null;
    let mediaRetryButtonEl = null;
    let mediaRetryClickHandler = null;
    let previewOpenButtonEl = null;
    let previewOpenClickHandler = null;
    let twoStepPendingPlaceId = "";
    let activeFeedbackAbortController = null;
    let activeFeedbackPlaceId = "";
    let activeFeedbackCacheKey = "";
    let feedbackStatusDraft = "";
    let feedbackRatingDraft = 0;
    let feedbackHoverRating = 0;
    let feedbackCommentDraft = "";
    let feedbackSavePulseTimerId = null;
    let feedbackIsAuthenticated = false;
    let feedbackIsSaving = false;
    let factsLoadToken = 0;
    let activeFactsAbortController = null;
    let weatherLoadToken = 0;
    let activeWeatherAbortController = null;
    let feedbackLoadToken = 0;
    let feedbackCurrentSnapshot = {
      average: 0,
      count: 0,
      reviews: []
    };
    let feedbackCurrentUserRating = 0;
    let deleteAccessToken = 0;
    let canDeleteCurrentPlace = false;
    const feedbackCache = new Map();
    const placeFactsCache = new Map();
    const weatherCache = new Map();
    const placeImageCache = new Map();
    const imageSuccessCache = new Set();
    const badImageUrlCache = new Map();
    const PLACE_IMAGE_BAD_CACHE_TTL_MS = Number(Config.POPUP_IMAGE_BAD_URL_TTL_MS) > 0
      ? Number(Config.POPUP_IMAGE_BAD_URL_TTL_MS)
      : 10 * 60 * 1000;
    const PLACE_IMAGE_TIMEOUT_MS = Number(Config.POPUP_IMAGE_TIMEOUT_MS) > 0
      ? Number(Config.POPUP_IMAGE_TIMEOUT_MS)
      : 6000;
    const popupDeferredDelayRaw = Number(Config.POPUP_DEFERRED_RENDER_DELAY_MS);
    const POPUP_DEFERRED_RENDER_DELAY_MS = Number.isFinite(popupDeferredDelayRaw)
      ? clamp(Math.round(popupDeferredDelayRaw), 0, 120)
      : 24;
    const popupNonCriticalDelayRaw = Number(Config.POPUP_NON_CRITICAL_RENDER_DELAY_MS);
    const POPUP_NON_CRITICAL_RENDER_DELAY_MS = Number.isFinite(popupNonCriticalDelayRaw)
      ? clamp(Math.round(popupNonCriticalDelayRaw), 16, 240)
      : 16;
    const popupNonCriticalIdleTimeoutRaw = Number(Config.POPUP_NON_CRITICAL_IDLE_TIMEOUT_MS);
    const POPUP_NON_CRITICAL_IDLE_TIMEOUT_MS = Number.isFinite(popupNonCriticalIdleTimeoutRaw)
      ? clamp(Math.round(popupNonCriticalIdleTimeoutRaw), 120, 1200)
      : 320;
    const popupNonCriticalRetryWhileMovingRaw = Number(
      Config.POPUP_NON_CRITICAL_WHILE_MOVING_RETRY_MS
    );
    const POPUP_NON_CRITICAL_WHILE_MOVING_RETRY_MS = Number.isFinite(popupNonCriticalRetryWhileMovingRaw)
      ? clamp(Math.round(popupNonCriticalRetryWhileMovingRaw), 48, 240)
      : 96;
    const popupWeatherCacheTtlRaw = Number(Config.POPUP_WEATHER_CACHE_TTL_MS);
    const POPUP_WEATHER_CACHE_TTL_MS = Number.isFinite(popupWeatherCacheTtlRaw)
      ? clamp(Math.round(popupWeatherCacheTtlRaw), 60 * 1000, 30 * 60 * 1000)
      : 10 * 60 * 1000;
    const POPUP_MOTION_SETTLE_MS = 220;
    const FEATURE_TWO_STEP_POPUP = Boolean(Config.FEATURE_TWO_STEP_POPUP);
    const reviewNodeCache = new Map();
    const reviewVirtualState = {
      enabled: false,
      reviews: [],
      revision: 0,
      lastRenderedRevision: -1,
      lastStart: -1,
      lastEnd: -1,
      rafId: null
    };
    const reviewSaveButtonDefaultText = normalizeText(reviewSaveButtonEl.textContent, "Save review");
    const ratingStarButtons = Array.from(
      ratingStarsEl.querySelectorAll(".popup-feedback__star[data-rating]")
    ).filter((node) => node instanceof HTMLButtonElement);
    const OUTSIDE_CLICK_GUARD_MS = 250;
    const classAnimationRestartMap = new WeakMap();
    const POPUP_DEBUG_ENABLED = (() => {
      try {
        return new URLSearchParams(window.location.search).get("popupdebug") === "1";
      } catch (_error) {
        return false;
      }
    })();
    const POPUP_CLOSE_SELECTOR =
      '[data-popup-close="1"], .popup-close, .popup__close, #popup-close';
    const MAP_MARKER_GUARD_SELECTOR =
      ".leaflet-marker-icon,.leaflet-interactive,.leaflet-popup,.map-pin-icon[data-place-id],.point-item__button[data-place-id]";
    let ignoreOutsideClicksUntil = 0;
    let popupEventsBound = false;
    let popupDebugHandlersBound = false;
    let debugDocumentPointerDownHandler = null;
    let debugDocumentClickHandler = null;

    function cancelClassAnimationRestart(element) {
      if (!(element instanceof HTMLElement)) {
        return;
      }

      const pending = classAnimationRestartMap.get(element);
      if (!pending) {
        return;
      }

      if (pending.rafA) {
        window.cancelAnimationFrame(pending.rafA);
      }
      if (pending.rafB) {
        window.cancelAnimationFrame(pending.rafB);
      }

      classAnimationRestartMap.delete(element);
    }

    function restartClassAnimation(element, className) {
      if (!(element instanceof HTMLElement) || !normalizeText(className, "")) {
        return;
      }

      cancelClassAnimationRestart(element);
      element.classList.remove(className);

      const pending = { rafA: 0, rafB: 0 };
      pending.rafA = window.requestAnimationFrame(() => {
        pending.rafA = 0;
        pending.rafB = window.requestAnimationFrame(() => {
          pending.rafB = 0;
          classAnimationRestartMap.delete(element);
          if (element.isConnected) {
            element.classList.add(className);
          }
        });
      });

      classAnimationRestartMap.set(element, pending);
    }

    function popupDebugLog(label, payload) {
      if (!POPUP_DEBUG_ENABLED) {
        return;
      }
      if (payload === undefined) {
        console.debug(`[popup:debug] ${label}`);
        return;
      }
      console.debug(`[popup:debug] ${label}`, payload);
    }

    function describeDebugNode(node) {
      if (!(node instanceof Element)) {
        return normalizeText(node?.nodeName, "unknown");
      }
      const tagName = normalizeText(node.tagName, "").toLowerCase();
      const id = normalizeText(node.id, "");
      const className = node.classList && node.classList.length > 0
        ? Array.from(node.classList).slice(0, 3).join(".")
        : "";
      return `${tagName}${id ? `#${id}` : ""}${className ? `.${className}` : ""}`;
    }

    function getDebugPathSample(event) {
      const path = typeof event?.composedPath === "function" ? event.composedPath() : [];
      if (!Array.isArray(path) || path.length === 0) {
        return [];
      }
      return path.slice(0, 4).map((node) => describeDebugNode(node));
    }

    function resolveCloseTriggerElement(targetNode) {
      if (!(targetNode instanceof Element)) {
        return null;
      }

      const directMatch = targetNode.closest(POPUP_CLOSE_SELECTOR);
      if (directMatch instanceof Element) {
        return directMatch;
      }

      const actionElement = targetNode.closest("button,[role=\"button\"],[aria-label],[title]");
      if (!(actionElement instanceof Element)) {
        return null;
      }

      const ariaLabel = normalizeText(actionElement.getAttribute("aria-label"), "").toLowerCase();
      const title = normalizeText(actionElement.getAttribute("title"), "").toLowerCase();
      if (ariaLabel.includes("close") || ariaLabel.includes("закры")) {
        return actionElement;
      }
      if (title.includes("close") || title.includes("закры")) {
        return actionElement;
      }
      return null;
    }

    function hasElementInEventPath(event, selector) {
      const targetNode = event?.target;
      if (targetNode instanceof Element && targetNode.closest(selector)) {
        return true;
      }

      const path = typeof event?.composedPath === "function" ? event.composedPath() : [];
      if (!Array.isArray(path)) {
        return false;
      }

      for (const node of path) {
        if (!(node instanceof Element)) {
          continue;
        }
        if (node.matches(selector) || node.closest(selector)) {
          return true;
        }
      }
      return false;
    }

    function bindPopupDebugHandlers() {
      if (!POPUP_DEBUG_ENABLED || popupDebugHandlersBound) {
        return;
      }
      popupDebugHandlersBound = true;
      popupDebugLog("elements", {
        popupEl: popupEl instanceof HTMLElement,
        backdropEl: backdropEl instanceof HTMLElement,
        closeButtonEl: closeButtonEl instanceof HTMLElement
      });

      if (popupEl instanceof HTMLElement) {
        const popupStyle = window.getComputedStyle(popupEl);
        popupDebugLog("popup style", {
          pointerEvents: popupStyle.pointerEvents,
          zIndex: popupStyle.zIndex
        });
      }
      if (backdropEl instanceof HTMLElement) {
        const backdropStyle = window.getComputedStyle(backdropEl);
        popupDebugLog("backdrop style", {
          pointerEvents: backdropStyle.pointerEvents,
          zIndex: backdropStyle.zIndex
        });
      }

      const debugCaptureHandler = (event) => {
        if (!isOpen) {
          return;
        }
        const targetNode = event.target;
        const insidePopup = (targetNode instanceof Node) && popupEl.contains(targetNode);
        const closeTrigger = resolveCloseTriggerElement(targetNode);
        popupDebugLog(`${event.type} capture`, {
          target: describeDebugNode(targetNode),
          path: getDebugPathSample(event),
          insidePopup,
          isCloseTrigger: Boolean(closeTrigger)
        });
      };

      debugDocumentPointerDownHandler = debugCaptureHandler;
      debugDocumentClickHandler = debugCaptureHandler;
      document.addEventListener("pointerdown", debugDocumentPointerDownHandler, true);
      document.addEventListener("click", debugDocumentClickHandler, true);
    }

    function unbindPopupDebugHandlers() {
      if (!popupDebugHandlersBound) {
        return;
      }
      popupDebugHandlersBound = false;
      if (typeof debugDocumentPointerDownHandler === "function") {
        document.removeEventListener("pointerdown", debugDocumentPointerDownHandler, true);
      }
      if (typeof debugDocumentClickHandler === "function") {
        document.removeEventListener("click", debugDocumentClickHandler, true);
      }
      debugDocumentPointerDownHandler = null;
      debugDocumentClickHandler = null;
    }

    const closeButtonHandler = (event) => {
      event.preventDefault();
      event.stopPropagation();
      closePopup("close_button");
    };

    const popupPointerDownHandler = (event) => {
      event.stopPropagation();
    };

    const popupClickHandler = (event) => {
      if (event.defaultPrevented) {
        event.stopPropagation();
        return;
      }
      const seasonButton = event.target instanceof Element
        ? event.target.closest("[data-popup-season]")
        : null;
      if (seasonButton instanceof HTMLButtonElement) {
        event.preventDefault();
        event.stopPropagation();
        activateSeasonView(seasonButton.dataset.popupSeason);
        return;
      }
      const closeTrigger = resolveCloseTriggerElement(event.target);
      if (closeTrigger) {
        event.preventDefault();
        event.stopPropagation();
        closePopup("close_button");
        return;
      }
      event.stopPropagation();
    };

    const backdropPointerDownHandler = (event) => {
      if (!isOpen) {
        return;
      }
      if (Date.now() < ignoreOutsideClicksUntil) {
        return;
      }
      if (event.target === backdropEl) {
        closePopup("outside_click");
      }
    };

    function bindPopupEvents() {
      if (popupEventsBound) {
        return;
      }
      popupEventsBound = true;

      if (closeButtonEl instanceof HTMLElement) {
        closeButtonEl.dataset.popupClose = "1";
      }

      closeButtonEl.addEventListener("click", closeButtonHandler, { passive: false });
      popupEl.addEventListener("pointerdown", popupPointerDownHandler, { passive: true });
      popupEl.addEventListener("click", popupClickHandler, { passive: false });
      backdropEl.addEventListener("pointerdown", backdropPointerDownHandler, { passive: true });

      bindPopupDebugHandlers();
      popupDebugLog("handlers bound");
    }

    function unbindPopupEvents() {
      if (!popupEventsBound) {
        return;
      }
      popupEventsBound = false;
      closeButtonEl.removeEventListener("click", closeButtonHandler);
      popupEl.removeEventListener("pointerdown", popupPointerDownHandler);
      popupEl.removeEventListener("click", popupClickHandler);
      backdropEl.removeEventListener("pointerdown", backdropPointerDownHandler);
      unbindPopupDebugHandlers();
    }

    const retryButtonHandler = () => {
      const place = currentContext?.place;
      if (!isOpen || !isValidPlace(place)) {
        return;
      }

      queuePopupRender(place, { isRetry: true });
    };

    const routeFromButtonHandler = () => {
      const place = currentContext?.place;
      if (!isOpen || !isValidPlace(place)) {
        return;
      }

      if (typeof onRouteFromPlace === "function") {
        try {
          onRouteFromPlace(place);
        } catch (error) {
          console.error("Route-from-popup action failed:", error);
        }
      }
    };

    const favoriteToggleButtonHandler = async () => {
      const place = currentContext?.place;
      if (!isOpen || !isValidPlace(place)) {
        return;
      }

      if (typeof resolvedToggleFavorite !== "function") {
        return;
      }

      favoriteToggleButtonEl.disabled = true;
      try {
        const nextIsFavorite = await resolvedToggleFavorite(place.id);
        setFavoriteButtonState(Boolean(nextIsFavorite));
        if (typeof onFavoritesChanged === "function") {
          try {
            onFavoritesChanged({
              placeId: place.id,
              isFavorite: Boolean(nextIsFavorite)
            });
          } catch (error) {
            console.error("Favorites changed callback failed:", error);
          }
        }
      } catch (error) {
        console.error("Favorite toggle failed:", error);
      } finally {
        favoriteToggleButtonEl.disabled = isWriteBlockedByBan();
      }
    };

    const shareButtonHandler = async () => {
      const place = currentContext?.place;
      if (!isOpen || !isValidPlace(place)) {
        return;
      }

      if (typeof onSharePlace !== "function") {
        return;
      }

      shareButtonEl.disabled = true;
      try {
        await onSharePlace(place);
      } catch (error) {
        console.error("Share action failed:", error);
      } finally {
        shareButtonEl.disabled = false;
      }
    };

    const deleteButtonHandler = async () => {
      const place = currentContext?.place;
      if (!isOpen || !isValidPlace(place) || !canDeleteCurrentPlace) {
        return;
      }
      if (typeof onDeletePlace !== "function") {
        return;
      }

      deleteButtonEl.disabled = true;
      try {
        const deleted = await onDeletePlace(place);
        if (deleted) {
          closePopup("place-deleted");
          return;
        }
      } catch (error) {
        console.error("Delete-place action failed:", error);
      } finally {
        if (isOpen) {
          deleteButtonEl.disabled = false;
          void syncDeleteActionAvailability(place);
        }
      }
    };

    const previousPlaceButtonHandler = () => {
      handleAdjacentNavigation("previous");
    };

    const nextPlaceButtonHandler = () => {
      handleAdjacentNavigation("next");
    };

    const statusWantButtonHandler = () => {
      applyStatusSelection("want");
    };

    const statusVisitedButtonHandler = () => {
      applyStatusSelection("visited");
    };

    const ratingStarsPointerLeaveHandler = () => {
      if (!isOpen) {
        return;
      }
      feedbackHoverRating = 0;
      updateRatingStarUi();
    };

    const reviewCommentInputHandler = () => {
      feedbackCommentDraft = normalizeFeedbackCommentDraft(reviewCommentEl.value);
      if (reviewCommentEl.value.length > 280) {
        reviewCommentEl.value = feedbackCommentDraft;
      }
    };

    const reviewSaveButtonHandler = () => {
      void persistFeedback({
        requireRating: true,
        updateReview: true,
        showSavedToast: true
      });
    };

    const authChangedHandler = () => {
      const place = currentContext?.place;
      if (!isOpen || !isValidPlace(place)) {
        return;
      }
      feedbackCache.clear();
      void syncDeleteActionAvailability(place);
      void renderFeedback(place);
    };

    const favoritesSyncedHandler = () => {
      const place = currentContext?.place;
      if (!isOpen || !isValidPlace(place)) {
        return;
      }
      setFavoriteButtonState(Boolean(resolvedIsFavoritePlace?.(place.id)));
    };

    const banStateChangedHandler = () => {
      if (!isOpen) {
        return;
      }
      applyFeedbackAuthState(feedbackIsAuthenticated);
      setFeedbackLoadingState(false);
    };

    const imageErrorHandler = () => {
      if (!isOpen) {
        return;
      }

      const place = currentContext?.place;
      showMediaError("Photo failed to load.", {
        canRetry: isValidPlace(place),
        onRetry: () => {
          if (!isValidPlace(place)) {
            return;
          }
          renderMedia(place, { forceRetry: true });
        }
      });
      invalidatePopupTracking();
      updatePosition({ forceSnap: false, forceMeasure: true });
    };

    const imageLoadHandler = () => {
      mediaEl.classList.remove("is-loading", "is-error");
      mediaEl.classList.add("is-ready");
      imageEl.classList.add("is-ready");
      mediaSkeletonEl.hidden = true;
      mediaErrorEl.hidden = true;
      invalidatePopupTracking();
      if (isOpen) {
        updatePosition({ forceSnap: false, forceMeasure: true });
      }
    };

    const windowResizeHandler = () => {
      if (isOpen) {
        invalidatePopupTracking();
        updatePosition({ forceSnap: false, forceMeasure: true });
      }
    };

    const communityReviewsScrollHandler = () => {
      if (!isOpen || !reviewVirtualState.enabled) {
        return;
      }
      if (reviewVirtualState.rafId) {
        return;
      }
      reviewVirtualState.rafId = window.requestAnimationFrame(() => {
        reviewVirtualState.rafId = null;
        renderVisibleReviewsWindow();
      });
    };

    bindPopupEvents();
    retryButtonEl.addEventListener("click", retryButtonHandler);
    routeFromButtonEl.addEventListener("click", routeFromButtonHandler);
    favoriteToggleButtonEl.addEventListener("click", favoriteToggleButtonHandler);
    shareButtonEl.addEventListener("click", shareButtonHandler);
    deleteButtonEl.addEventListener("click", deleteButtonHandler);
    if (previousPlaceButtonEl instanceof HTMLButtonElement) {
      previousPlaceButtonEl.addEventListener("click", previousPlaceButtonHandler);
    }
    if (nextPlaceButtonEl instanceof HTMLButtonElement) {
      nextPlaceButtonEl.addEventListener("click", nextPlaceButtonHandler);
    }
    statusWantButtonEl.addEventListener("click", statusWantButtonHandler);
    statusVisitedButtonEl.addEventListener("click", statusVisitedButtonHandler);
    ratingStarsEl.addEventListener("pointerleave", ratingStarsPointerLeaveHandler);
    reviewCommentEl.addEventListener("input", reviewCommentInputHandler);
    reviewSaveButtonEl.addEventListener("click", reviewSaveButtonHandler);
    communityReviewsEl.addEventListener("scroll", communityReviewsScrollHandler, { passive: true });
    window.addEventListener("worldatlas:auth-changed", authChangedHandler);
    window.addEventListener("worldatlas:favorites-synced", favoritesSyncedHandler);
    window.addEventListener("worldatlas:ban-state-changed", banStateChangedHandler);

    for (const starButton of ratingStarButtons) {
      const ratingValue = clamp(Math.round(Number(starButton.dataset.rating || 0)), 1, 5);
      const onStarEnter = () => {
        if (!isOpen) {
          return;
        }
        feedbackHoverRating = ratingValue;
        updateRatingStarUi();
      };
      const onStarFocus = () => {
        if (!isOpen) {
          return;
        }
        feedbackHoverRating = ratingValue;
        updateRatingStarUi();
      };
      const onStarBlur = () => {
        if (!isOpen) {
          return;
        }
        feedbackHoverRating = 0;
        updateRatingStarUi();
      };
      const onStarClick = () => {
        if (!isOpen) {
          return;
        }
        feedbackRatingDraft = ratingValue;
        feedbackHoverRating = 0;
        updateRatingStarUi({ animate: true });
      };

      starButton.addEventListener("mouseenter", onStarEnter);
      starButton.addEventListener("focus", onStarFocus);
      starButton.addEventListener("blur", onStarBlur);
      starButton.addEventListener("click", onStarClick);

      starButton.__popupFeedbackCleanup = () => {
        starButton.removeEventListener("mouseenter", onStarEnter);
        starButton.removeEventListener("focus", onStarFocus);
        starButton.removeEventListener("blur", onStarBlur);
        starButton.removeEventListener("click", onStarClick);
      };
    }
    imageEl.addEventListener("error", imageErrorHandler);
    imageEl.addEventListener("load", imageLoadHandler);

    if (typeof subscribeToMapMotion === "function") {
      unsubscribeMapMotion = subscribeToMapMotion((isMoving) => {
        const nextMapMotionState = Boolean(isMoving);
        const hasMotionStateChanged = nextMapMotionState !== isMapMotionActive;
        isMapMotionActive = nextMapMotionState;
        if (hasMotionStateChanged) {
          popupLastMapMotionChangeAt = performance.now();
        }
        if (!isOpen) {
          return;
        }
        if (hasMotionStateChanged && !isMapMotionActive) {
          updatePosition({ forceSnap: true, forceMeasure: false });
        }
        startPositionTracking({ force: true });
      });
    }

    function isMobilePopupSheetMode() {
      const viewportWidth = Number(window.innerWidth || document.documentElement?.clientWidth || 0);
      let coarsePointer = false;
      try {
        coarsePointer = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
      } catch (_error) {
        coarsePointer = false;
      }

      return viewportWidth <= 640 || (coarsePointer && viewportWidth <= 820);
    }

    function shouldUseTwoStepPopup() {
      return FEATURE_TWO_STEP_POPUP && !isMobilePopupSheetMode();
    }

    function openPlacePopup(place, context) {
      if (!isValidPlace(place)) {
        throw new TypeError("Popup received invalid place data.");
      }

      const safeContext = (context && typeof context === "object") ? context : {};
      const previousPlaceId = normalizeText(currentContext?.placeId, "");
      const nextPlaceId = normalizeText(safeContext.placeId, place.id);
      const isPlaceSwitch = isOpen && previousPlaceId !== "" && previousPlaceId !== nextPlaceId;
      const useTwoStepPopup = shouldUseTwoStepPopup();
      const shouldOpenFullPopup = !useTwoStepPopup || twoStepPendingPlaceId === nextPlaceId;
      const basePlace = place;
      const seasonalContent = normalizeSeasonalContentValue(
        basePlace?.seasonal_content ?? basePlace?.seasonalContent
      );
      const initialSeason = seasonalContent.enabled
        ? normalizeText(safeContext.activeSeason, "base")
        : normalizeSeasonKey(safeContext.activeSeason, resolveCurrentSeasonKey());
      const initialPlaceView = buildPlaceSeasonView(basePlace, initialSeason);

      currentContext = {
        ...safeContext,
        basePlace,
        place: initialPlaceView,
        placeId: nextPlaceId,
        activeSeason: normalizeText(
          initialPlaceView?.active_season,
          seasonalContent.enabled ? "base" : ""
        ).toLowerCase()
      };

      setContentState("content");
      renderInstantShell(initialPlaceView);
      invalidatePopupTracking();
      setFavoriteButtonState(Boolean(resolvedIsFavoritePlace?.(nextPlaceId)));
      canDeleteCurrentPlace = false;
      deleteButtonEl.hidden = true;
      deleteButtonEl.disabled = true;

      if (hideTimerId) {
        window.clearTimeout(hideTimerId);
        hideTimerId = null;
      }

      setToolbarVisibilityByPopup(true);
      ignoreOutsideClicksUntil = Date.now() + OUTSIDE_CLICK_GUARD_MS;

      if (!isOpen) {
        isOpen = true;
        backdropEl.hidden = false;

        requestAnimationFrame(() => {
          updatePosition({ forceSnap: true, forceMeasure: true });
          requestAnimationFrame(() => {
            backdropEl.classList.add("is-open");
            popupEl.classList.add("is-open");
          });
        });

        document.addEventListener("keydown", onDocumentKeydown);
        document.addEventListener("pointerdown", onDocumentPointerDown, true);
        window.addEventListener("resize", windowResizeHandler, { passive: true });
        startPositionTracking({ force: true });
      } else {
        if (isPlaceSwitch) {
          runSwitchAnimation();
        }
        updatePosition({ forceSnap: false, forceMeasure: true });
        startPositionTracking({ force: true });
      }

      if (useTwoStepPopup && !shouldOpenFullPopup) {
        twoStepPendingPlaceId = nextPlaceId;
        popupEl.classList.add("is-preview");
        showPreviewOpenAction();
        activateDeferredMediaSources(mediaEl);
        renderMedia(initialPlaceView);
        if (!isPlaceSwitch) {
          closeButtonEl.focus();
        }
        return;
      }

      twoStepPendingPlaceId = "";
      popupEl.classList.remove("is-preview");
      hidePreviewOpenAction();
      activateDeferredMediaSources(mediaEl);
      queuePopupRender(initialPlaceView, { defer: true });

      if (!isPlaceSwitch) {
        closeButtonEl.focus();
      }
    }

    function closePopup(reason = "programmatic") {
      if (!isOpen) {
        return;
      }

      isOpen = false;
      ignoreOutsideClicksUntil = 0;
      renderSessionToken += 1;
      mediaRequestToken += 1;
      cancelPendingRenderTasks();
      abortActiveMediaRequest();
      abortActiveFactsRequest();
      abortActiveWeatherRequest();
      clearMediaRetryAction();
      abortActiveFeedbackRequest();
      backdropEl.classList.remove("is-open");
      popupEl.classList.remove("is-open");
      popupEl.classList.remove("is-switching", "is-loading", "is-error");
      popupEl.classList.remove("popup-card--below");
      popupEl.classList.remove("is-preview");
      ratingStarsEl.classList.remove("is-pop");
      reviewSaveButtonEl.classList.remove("is-saved");
      cancelClassAnimationRestart(popupEl);
      cancelClassAnimationRestart(ratingStarsEl);
      cancelClassAnimationRestart(reviewSaveButtonEl);
      feedbackHoverRating = 0;
      document.removeEventListener("keydown", onDocumentKeydown);
      document.removeEventListener("pointerdown", onDocumentPointerDown, true);
      window.removeEventListener("resize", windowResizeHandler);
      stopPositionTracking();
      invalidatePopupTracking();
      setToolbarVisibilityByPopup(false);

      if (switchAnimationTimerId) {
        window.clearTimeout(switchAnimationTimerId);
        switchAnimationTimerId = null;
      }

      if (feedbackSavePulseTimerId) {
        window.clearTimeout(feedbackSavePulseTimerId);
        feedbackSavePulseTimerId = null;
      }
      setReviewSavingState(false, { immediate: true });
      if (reviewVirtualState.rafId) {
        window.cancelAnimationFrame(reviewVirtualState.rafId);
        reviewVirtualState.rafId = null;
      }
      reviewVirtualState.enabled = false;
      reviewVirtualState.reviews = [];
      reviewVirtualState.revision += 1;
      reviewVirtualState.lastRenderedRevision = -1;
      reviewVirtualState.lastStart = -1;
      reviewVirtualState.lastEnd = -1;
      reviewNodeCache.clear();
      communityReviewsEl.replaceChildren();
      communityReviewsEl.scrollTop = 0;

      hideTimerId = window.setTimeout(() => {
        backdropEl.hidden = true;
        popupEl.style.removeProperty("left");
        popupEl.style.removeProperty("top");
        popupEl.style.removeProperty("max-height");
        popupEl.style.removeProperty("--popup-arrow-x");
        hideTimerId = null;
      }, Config.POPUP_TRANSITION_MS);

      if (typeof onClose === "function") {
        onClose({
          reason,
          context: currentContext
        });
      }

      activeFeedbackPlaceId = "";
      activeFeedbackCacheKey = "";
      factsLoadToken += 1;
      feedbackLoadToken += 1;
      twoStepPendingPlaceId = "";
      deleteAccessToken += 1;
      canDeleteCurrentPlace = false;
      deleteButtonEl.hidden = true;
      deleteButtonEl.disabled = true;
      hidePreviewOpenAction();
      releaseDeferredMediaSources(mediaEl);
      resetMediaLoadingState();
      mediaEl.hidden = true;
      currentContext = null;
    }

    function destroyPopup() {
      closePopup("destroy");
      unbindPopupEvents();
      retryButtonEl.removeEventListener("click", retryButtonHandler);
      routeFromButtonEl.removeEventListener("click", routeFromButtonHandler);
      favoriteToggleButtonEl.removeEventListener("click", favoriteToggleButtonHandler);
      shareButtonEl.removeEventListener("click", shareButtonHandler);
      deleteButtonEl.removeEventListener("click", deleteButtonHandler);
      if (previousPlaceButtonEl instanceof HTMLButtonElement) {
        previousPlaceButtonEl.removeEventListener("click", previousPlaceButtonHandler);
      }
      if (nextPlaceButtonEl instanceof HTMLButtonElement) {
        nextPlaceButtonEl.removeEventListener("click", nextPlaceButtonHandler);
      }
      statusWantButtonEl.removeEventListener("click", statusWantButtonHandler);
      statusVisitedButtonEl.removeEventListener("click", statusVisitedButtonHandler);
      ratingStarsEl.removeEventListener("pointerleave", ratingStarsPointerLeaveHandler);
      reviewCommentEl.removeEventListener("input", reviewCommentInputHandler);
      reviewSaveButtonEl.removeEventListener("click", reviewSaveButtonHandler);
      communityReviewsEl.removeEventListener("scroll", communityReviewsScrollHandler);
      window.removeEventListener("worldatlas:auth-changed", authChangedHandler);
      window.removeEventListener("worldatlas:favorites-synced", favoritesSyncedHandler);
      window.removeEventListener("worldatlas:ban-state-changed", banStateChangedHandler);

      for (const starButton of ratingStarButtons) {
        if (typeof starButton.__popupFeedbackCleanup === "function") {
          starButton.__popupFeedbackCleanup();
          delete starButton.__popupFeedbackCleanup;
        }
      }

      imageEl.removeEventListener("error", imageErrorHandler);
      imageEl.removeEventListener("load", imageLoadHandler);
      document.removeEventListener("keydown", onDocumentKeydown);
      document.removeEventListener("pointerdown", onDocumentPointerDown, true);
      window.removeEventListener("resize", windowResizeHandler);
      stopPositionTracking();
      cancelClassAnimationRestart(popupEl);
      cancelClassAnimationRestart(ratingStarsEl);
      cancelClassAnimationRestart(reviewSaveButtonEl);
      setToolbarVisibilityByPopup(false, { immediate: true });

      if (hideTimerId) {
        window.clearTimeout(hideTimerId);
        hideTimerId = null;
      }

      if (toolbarRestoreTimerId) {
        window.clearTimeout(toolbarRestoreTimerId);
        toolbarRestoreTimerId = null;
      }

      if (switchAnimationTimerId) {
        window.clearTimeout(switchAnimationTimerId);
        switchAnimationTimerId = null;
      }
      cancelPendingRenderTasks();

      if (typeof unsubscribeMapMotion === "function") {
        unsubscribeMapMotion();
        unsubscribeMapMotion = null;
      }
      clearMediaRetryAction();
      releaseDeferredMediaSources(mediaEl);
      resetMediaLoadingState();
      mediaEl.hidden = true;
      if (previewOpenButtonEl && previewOpenClickHandler) {
        previewOpenButtonEl.removeEventListener("click", previewOpenClickHandler);
      }
      previewOpenButtonEl = null;
      previewOpenClickHandler = null;
    }

    return {
      openPlacePopup,
      closePopup,
      destroyPopup,
      open: openPlacePopup,
      close: closePopup,
      destroy: destroyPopup,
      get isOpen() {
        return isOpen;
      }
    };

    function queuePopupRender(place, options = {}) {
      const { isRetry = false, defer = false } = options;

      renderSessionToken += 1;
      const currentToken = renderSessionToken;
      setContentState("content");
      cancelPendingRenderTasks();

      if (isRetry) {
        retryButtonEl.blur();
      }

      const renderTask = () => {
        if (currentToken !== renderSessionToken || !isOpen) {
          return;
        }
        try {
          activateDeferredMediaSources(mediaEl);
          renderContent(place, { renderToken: currentToken });
          invalidatePopupTracking();
          updatePosition({ forceSnap: false, forceMeasure: true });
          startPositionTracking({ force: true });
        } catch (error) {
          console.error("Popup render error:", error);
          setContentState("error", "Could not load place details.");
        }
      };

      if (defer) {
        pendingRenderFrameId = window.requestAnimationFrame(() => {
          pendingRenderFrameId = null;
          pendingRenderTimerId = window.setTimeout(() => {
            pendingRenderTimerId = null;
            renderTask();
          }, POPUP_DEFERRED_RENDER_DELAY_MS);
        });
        return;
      }

      renderTask();
    }

    function cancelPendingRenderTasks() {
      if (pendingRenderFrameId) {
        window.cancelAnimationFrame(pendingRenderFrameId);
        pendingRenderFrameId = null;
      }
      if (pendingRenderTimerId) {
        window.clearTimeout(pendingRenderTimerId);
        pendingRenderTimerId = null;
      }
      if (pendingNonCriticalRenderFrameId) {
        window.cancelAnimationFrame(pendingNonCriticalRenderFrameId);
        pendingNonCriticalRenderFrameId = null;
      }
      if (pendingNonCriticalRenderTimerId) {
        window.clearTimeout(pendingNonCriticalRenderTimerId);
        pendingNonCriticalRenderTimerId = null;
      }
      if (
        pendingNonCriticalIdleId !== null &&
        typeof window.cancelIdleCallback === "function"
      ) {
        window.cancelIdleCallback(pendingNonCriticalIdleId);
        pendingNonCriticalIdleId = null;
      }
    }

    function renderInstantShell(place) {
      regionLineEl.textContent = `${normalizeText(place?.region, "Region unknown")} - ${normalizeText(place?.country, "Country unknown")}`;
      countryEl.textContent = formatCountryLine(place);
      renderPlaceTitle(place);
      renderTrustSignals(place);
      renderSeasonSwitcher(getBasePlace() || place);
      renderPlaceNavigation(normalizeText(currentContext?.placeId, place?.id));
      descriptionEl.textContent = normalizeText(place?.description, "Loading description...");
      coordinatesEl.textContent = `GPS ${formatCoordinates(place?.lat, place?.lon)}`;
      summaryListEl.replaceChildren();
      highlightsEl.replaceChildren();
      factEl.textContent = "Loading fact...";
      renderWeatherLoading(place);
      sourcesEl.replaceChildren();
      updatedEl.textContent = "Updated: -";
      linkRowEl.hidden = true;
      linkEl.removeAttribute("href");
      linkEl.textContent = "";
      renderCommunitySnapshot({
        average: 0,
        count: 0,
        reviews: [],
        isLoading: true
      });
      resetMediaLoadingState();
      mediaEl.hidden = false;
    }
    function showPreviewOpenAction() {
      if (!shouldUseTwoStepPopup()) {
        return;
      }
      if (!previewOpenButtonEl) {
        previewOpenButtonEl = document.createElement("button");
        previewOpenButtonEl.type = "button";
        previewOpenButtonEl.className = "app-btn app-btn--primary popup-card__preview-open";
        previewOpenButtonEl.textContent = "Open full details";
        previewOpenButtonEl.hidden = true;
        previewOpenClickHandler = () => {
          openFullPopupFromPreview();
        };
        previewOpenButtonEl.addEventListener("click", previewOpenClickHandler);
        if (coordinatesEl.parentElement === contentEl) {
          contentEl.insertBefore(previewOpenButtonEl, coordinatesEl.nextSibling);
        } else {
          contentEl.append(previewOpenButtonEl);
        }
      }
      previewOpenButtonEl.hidden = false;
    }

    function hidePreviewOpenAction() {
      if (!previewOpenButtonEl) {
        return;
      }
      previewOpenButtonEl.hidden = true;
    }

    function openFullPopupFromPreview() {
      const place = currentContext?.place;
      if (!isOpen || !isValidPlace(place)) {
        return;
      }
      twoStepPendingPlaceId = "";
      popupEl.classList.remove("is-preview");
      hidePreviewOpenAction();
      queuePopupRender(place, { defer: false });
      startPositionTracking({ force: true });
      closeButtonEl.focus();
    }

    function getBasePlace() {
      return currentContext?.basePlace || currentContext?.place || null;
    }

    function renderSeasonSwitcher(place) {
      if (
        !(seasonSectionEl instanceof HTMLElement) ||
        !(seasonTabsEl instanceof HTMLElement) ||
        !(seasonStatusEl instanceof HTMLElement) ||
        !(seasonCopyEl instanceof HTMLElement)
      ) {
        return;
      }

      const basePlace = place && typeof place === "object" ? place : getBasePlace();
      const seasonalContent = normalizeSeasonalContentValue(
        basePlace?.seasonal_content ?? basePlace?.seasonalContent
      );
      if (!seasonalContent.enabled) {
        seasonSectionEl.hidden = true;
        seasonTabsEl.replaceChildren();
        seasonStatusEl.textContent = "";
        seasonCopyEl.textContent = "";
        return;
      }

      const activeSeasonRaw = normalizeText(currentContext?.activeSeason, "").toLowerCase();
      const activeSeason = activeSeasonRaw === "base"
        ? "base"
        : normalizeSeasonKey(
            activeSeasonRaw,
            seasonalContent.defaultSeason || resolveCurrentSeasonKey()
          );
      const fragment = document.createDocumentFragment();
      const baseButtonEl = document.createElement("button");
      baseButtonEl.type = "button";
      baseButtonEl.className = "popup-season__tab";
      baseButtonEl.dataset.popupSeason = "base";
      baseButtonEl.setAttribute("role", "tab");
      const isBaseSelected = activeSeason === "base";
      baseButtonEl.setAttribute("aria-selected", String(isBaseSelected));
      baseButtonEl.classList.toggle("is-active", isBaseSelected);
      baseButtonEl.textContent = "Base";
      fragment.append(baseButtonEl);

      for (const seasonKey of seasonalContent.activeSeasons) {
        const buttonEl = document.createElement("button");
        buttonEl.type = "button";
        buttonEl.className = "popup-season__tab";
        buttonEl.dataset.popupSeason = seasonKey;
        buttonEl.setAttribute("role", "tab");
        const isSelected = seasonKey === activeSeason;
        buttonEl.setAttribute("aria-selected", String(isSelected));
        buttonEl.classList.toggle("is-active", isSelected);
        buttonEl.textContent = formatSeasonLabel(seasonKey);
        fragment.append(buttonEl);
      }

      seasonTabsEl.replaceChildren(fragment);
      seasonStatusEl.textContent = `${seasonalContent.activeSeasons.length + 1} views`;
      seasonCopyEl.textContent = `Base plus ${seasonalContent.activeSeasons.map((seasonKey) => formatSeasonLabel(seasonKey).toLowerCase()).join(", ")} views are available in this card.`;
      seasonSectionEl.hidden = false;
    }

    function activateSeasonView(rawSeasonKey) {
      const basePlace = getBasePlace();
      if (!isValidPlace(basePlace)) {
        return;
      }

      const nextPlaceView = buildPlaceSeasonView(basePlace, rawSeasonKey);
      const nextSeasonRaw = normalizeText(nextPlaceView?.active_season, "").toLowerCase();
      const nextSeason = nextSeasonRaw === "base"
        ? "base"
        : normalizeSeasonKey(nextSeasonRaw, "");
      if (!nextSeason) {
        return;
      }
      if (normalizeText(currentContext?.activeSeason, "").toLowerCase() === nextSeason) {
        return;
      }

      currentContext = {
        ...currentContext,
        activeSeason: nextSeason,
        place: nextPlaceView
      };

      renderPlaceTitle(nextPlaceView);
      renderTrustSignals(nextPlaceView);
      renderSeasonSwitcher(basePlace);
      descriptionEl.textContent = normalizeText(
        nextPlaceView?.description,
        "Description unavailable."
      );
      renderMedia(nextPlaceView);
      invalidatePopupTracking();
      updatePosition({ forceSnap: false, forceMeasure: true });
    }

    function setContentState(state, message = "") {
      const normalizedState = normalizeText(state, "content");
      const isLoading = normalizedState === "loading";
      const isError = normalizedState === "error";
      const hasContent = !isLoading && !isError;
      const isWriteBlocked = isWriteBlockedByBan();

      popupEl.classList.toggle("is-loading", isLoading);
      popupEl.classList.toggle("is-error", isError);

      loadingStateEl.hidden = !isLoading;
      errorStateEl.hidden = !isError;
      contentEl.hidden = !hasContent;

      if (isError) {
        errorMessageEl.textContent = normalizeText(message, "Could not load data.");
      } else {
        errorMessageEl.textContent = "Could not load data.";
      }

      routeFromButtonEl.disabled = isLoading || isError;
      favoriteToggleButtonEl.disabled = isLoading || isError || isWriteBlocked;
      shareButtonEl.disabled = isLoading || isError;
      deleteButtonEl.disabled = isLoading || isError || !canDeleteCurrentPlace || isWriteBlocked;
      if (previousPlaceButtonEl instanceof HTMLButtonElement) {
        previousPlaceButtonEl.disabled =
          isLoading || isError || !normalizeText(previousPlaceButtonEl.dataset.targetPlaceId, "");
      }
      if (nextPlaceButtonEl instanceof HTMLButtonElement) {
        nextPlaceButtonEl.disabled =
          isLoading || isError || !normalizeText(nextPlaceButtonEl.dataset.targetPlaceId, "");
      }
      statusWantButtonEl.disabled = isLoading || isError || isWriteBlocked;
      statusVisitedButtonEl.disabled = isLoading || isError || isWriteBlocked;
      reviewCommentEl.disabled = isLoading || isError || isWriteBlocked;
      reviewSaveButtonEl.disabled = isLoading || isError || isWriteBlocked;

      for (const starButton of ratingStarButtons) {
        starButton.disabled = isLoading || isError || isWriteBlocked;
      }

      if (isWriteBlocked) {
        feedbackAuthHintEl.hidden = false;
        feedbackAuthHintEl.textContent = BANNED_REVIEW_MESSAGE;
      }
    }

    function runSwitchAnimation() {
      restartClassAnimation(popupEl, "is-switching");

      if (switchAnimationTimerId) {
        window.clearTimeout(switchAnimationTimerId);
      }

      switchAnimationTimerId = window.setTimeout(() => {
        switchAnimationTimerId = null;
        popupEl.classList.remove("is-switching");
      }, Config.POPUP_SWITCH_TRANSITION_MS + 44);
    }

    function onDocumentKeydown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        closePopup("escape");
      }
    }

    function onDocumentPointerDown(event) {
      if (!isOpen) {
        return;
      }
      if (Date.now() < ignoreOutsideClicksUntil) {
        return;
      }

      const targetNode = event.target;
      if (!(targetNode instanceof Node)) {
        return;
      }

      const insidePopup = popupEl.contains(targetNode);
      if (insidePopup) {
        return;
      }

      const markerInteraction = hasElementInEventPath(event, MAP_MARKER_GUARD_SELECTOR);
      if (markerInteraction) {
        return;
      }

      closePopup("outside_click");
    }

    function startPositionTracking(options = {}) {
      const { force = false } = options;
      if (trackingFrameId && !force) {
        return;
      }

      stopPositionTracking();
      popupTrackIdleFrames = 0;

      const track = () => {
        if (!isOpen) {
          trackingFrameId = null;
          return;
        }

        const hasUpdated = updatePosition();
        if (isMobilePopupSheetMode()) {
          trackingFrameId = null;
          popupTrackIdleFrames = 0;
          return;
        }
        const isHighFrequencyMode = isMapMotionActive;

        if (!isHighFrequencyMode && !hasUpdated) {
          popupTrackIdleFrames += 1;
        } else {
          popupTrackIdleFrames = 0;
        }

        if (!isHighFrequencyMode && popupTrackIdleFrames >= Config.POPUP_TRACK_IDLE_FRAME_THRESHOLD) {
          trackingFrameId = null;
          return;
        }

        if (isHighFrequencyMode) {
          trackingFrameId = window.requestAnimationFrame(track);
          return;
        }

        trackingTimerId = window.setTimeout(() => {
          trackingTimerId = null;
          trackingFrameId = window.requestAnimationFrame(track);
        }, Config.POPUP_TRACK_IDLE_INTERVAL_MS);
      };

      trackingFrameId = window.requestAnimationFrame(track);
    }

    function stopPositionTracking() {
      if (trackingTimerId) {
        window.clearTimeout(trackingTimerId);
        trackingTimerId = null;
      }

      if (!trackingFrameId) {
        popupTrackIdleFrames = 0;
        return;
      }

      window.cancelAnimationFrame(trackingFrameId);
      trackingFrameId = null;
      popupTrackIdleFrames = 0;
    }

    function updatePosition(options = {}) {
      if (!isOpen) {
        return false;
      }

      const {
        forceSnap = false,
        forceMeasure = false
      } = options;

      if (isMobilePopupSheetMode()) {
        const viewportHeight = Number(window.innerHeight || document.documentElement?.clientHeight || 0);
        const mobileMaxHeight = Math.max(320, round(Math.min(viewportHeight * 0.78, 620), 2));
        const modeChanged = popupLayoutMode !== "mobile-sheet";
        const heightChanged =
          forceMeasure ||
          popupCachedMaxHeight === null ||
          Math.abs((popupCachedMaxHeight || 0) - mobileMaxHeight) > 8;

        popupLayoutMode = "mobile-sheet";
        popupEl.classList.add("popup-card--mobile-sheet");
        popupEl.classList.remove("popup-card--below");
        popupEl.style.removeProperty("left");
        popupEl.style.removeProperty("top");
        popupEl.style.removeProperty("--popup-arrow-x");
        popupEl.style.setProperty("--popup-mobile-max-height", `${mobileMaxHeight}px`);

        if (modeChanged || heightChanged) {
          popupCachedSize = null;
          popupTargetPosition = null;
          popupLastAnchorPoint = null;
          popupCachedMaxHeight = mobileMaxHeight;
          popupEl.style.maxHeight = `${mobileMaxHeight}px`;
        }

        return modeChanged || heightChanged;
      }

      if (popupLayoutMode === "mobile-sheet") {
        popupLayoutMode = "";
        popupEl.classList.remove("popup-card--mobile-sheet");
        popupEl.style.removeProperty("--popup-mobile-max-height");
        popupCachedSize = null;
        popupTargetPosition = null;
        popupLastAnchorPoint = null;
        popupCachedMaxHeight = null;
      }

      const anchorPoint = resolveAnchorPoint();
      if (!anchorPoint) {
        return false;
      }

      popupTrackFrameCounter += 1;
      const hasAnchorMoved = hasPointMoved(anchorPoint, popupLastAnchorPoint, 0.45);
      const shouldRecomputeGeometry =
        forceMeasure ||
        forceSnap ||
        !popupCachedSize ||
        hasAnchorMoved ||
        (popupTrackFrameCounter % Config.POPUP_TRACK_REMEASURE_EVERY_FRAMES) === 0;

      popupLastAnchorPoint = anchorPoint;
      if (!shouldRecomputeGeometry && popupTargetPosition) {
        return false;
      }

      const viewportPadding = Config.POPUP_VIEWPORT_PADDING_PX;
      const anchorGap = Config.POPUP_ANCHOR_GAP_PX;
      const availableAbove = Math.max(0, anchorPoint.y - anchorGap - viewportPadding);
      const defaultMaxHeight = window.innerHeight * Config.POPUP_TRACK_MAX_HEIGHT_RATIO;
      const cappedHeight = Math.max(80, round(Math.min(defaultMaxHeight, availableAbove), 2));

      if (
        forceMeasure ||
        popupCachedMaxHeight === null ||
        Math.abs(cappedHeight - popupCachedMaxHeight) > 18
      ) {
        popupCachedMaxHeight = cappedHeight;
        popupEl.style.maxHeight = `${cappedHeight}px`;
        popupCachedSize = null;
      }

      const popupSize = getPopupSize({ forceMeasure });
      const popupWidth = popupSize.width;
      const popupHeight = popupSize.height;

      const maxLeft = Math.max(viewportPadding, window.innerWidth - viewportPadding - popupWidth);
      const targetLeft = clamp(
        anchorPoint.x - (popupWidth / 2),
        viewportPadding,
        maxLeft
      );

      const targetTop = Math.max(viewportPadding, anchorPoint.y - popupHeight - anchorGap);
      const targetArrowX = clamp(anchorPoint.x - targetLeft, 28, Math.max(28, popupWidth - 28));

      if (!popupTargetPosition || forceSnap) {
        popupTargetPosition = {
          left: targetLeft,
          top: targetTop,
          arrowX: targetArrowX
        };
      } else {
        const motionSettling =
          !isMapMotionActive &&
          (performance.now() - popupLastMapMotionChangeAt) <= POPUP_MOTION_SETTLE_MS;
        if (isMapMotionActive || motionSettling) {
          popupTargetPosition.left = targetLeft;
          popupTargetPosition.top = targetTop;
          popupTargetPosition.arrowX = targetArrowX;
        } else {
          popupTargetPosition.left = smoothFollowValue(
            popupTargetPosition.left,
            targetLeft,
            Config.POPUP_TRACK_LERP,
            Config.POPUP_TRACK_SNAP_PX
          );
          popupTargetPosition.top = smoothFollowValue(
            popupTargetPosition.top,
            targetTop,
            Config.POPUP_TRACK_LERP,
            Config.POPUP_TRACK_SNAP_PX
          );
          popupTargetPosition.arrowX = smoothFollowValue(
            popupTargetPosition.arrowX,
            targetArrowX,
            Config.POPUP_TRACK_LERP,
            0.5
          );
        }
      }

      popupEl.style.left = `${round(popupTargetPosition.left, 2)}px`;
      popupEl.style.top = `${round(popupTargetPosition.top, 2)}px`;
      popupEl.classList.remove("popup-card--below");
      popupEl.style.setProperty(
        "--popup-arrow-x",
        `${round(popupTargetPosition.arrowX, 2)}px`
      );

      return true;
    }

    function invalidatePopupTracking() {
      popupTrackIdleFrames = 0;
      popupTrackFrameCounter = 0;
      popupTargetPosition = null;
      popupLastAnchorPoint = null;
      popupCachedSize = null;
      popupCachedMaxHeight = null;
    }

    function getPopupSize(options = {}) {
      const { forceMeasure = false } = options;

      if (!popupCachedSize || forceMeasure) {
        const popupRect = popupEl.getBoundingClientRect();
        popupCachedSize = {
          width: Math.max(280, popupRect.width || popupEl.offsetWidth || 320),
          height: Math.max(80, popupRect.height || popupEl.offsetHeight || 220)
        };
      }

      return popupCachedSize;
    }

    function smoothFollowValue(current, target, lerpFactor, snapDistance) {
      if (!Number.isFinite(current)) {
        return target;
      }

      const delta = target - current;
      if (Math.abs(delta) <= snapDistance) {
        return target;
      }

      const safeLerp = clamp(lerpFactor, 0.08, 0.92);
      return current + (delta * safeLerp);
    }

    function hasPointMoved(currentPoint, previousPoint, epsilon) {
      if (!previousPoint) {
        return true;
      }

      return (
        Math.abs(currentPoint.x - previousPoint.x) > epsilon ||
        Math.abs(currentPoint.y - previousPoint.y) > epsilon
      );
    }

    function resolveAnchorPoint() {
      if (typeof currentContext?.resolveAnchor === "function") {
        const point = currentContext.resolveAnchor();
        if (isValidAnchorPoint(point)) {
          return point;
        }
      }

      if (currentContext?.markerElement instanceof HTMLElement) {
        const markerRect = currentContext.markerElement.getBoundingClientRect();
        return {
          x: markerRect.left + (markerRect.width / 2),
          y: markerRect.top + Math.max(8, markerRect.height * 0.12)
        };
      }

      return {
        x: window.innerWidth / 2,
        y: window.innerHeight / 2
      };
    }

    function isValidAnchorPoint(value) {
      return (
        value &&
        typeof value === "object" &&
        Number.isFinite(value.x) &&
        Number.isFinite(value.y)
      );
    }

    function setToolbarVisibilityByPopup(isPopupVisible, options = {}) {
      if (typeof onVisibilityChange !== "function") {
        return;
      }

      if (toolbarRestoreTimerId) {
        window.clearTimeout(toolbarRestoreTimerId);
        toolbarRestoreTimerId = null;
      }

      if (isPopupVisible) {
        onVisibilityChange(true);
        return;
      }

      if (options.immediate === true) {
        onVisibilityChange(false);
        return;
      }

      const delayMs = Math.max(120, Math.round(Config.POPUP_TRANSITION_MS * 0.52));
      toolbarRestoreTimerId = window.setTimeout(() => {
        toolbarRestoreTimerId = null;
        onVisibilityChange(false);
      }, delayMs);
    }

    function renderContent(place, options = {}) {
      const { renderToken = renderSessionToken } = options;
      const placeDetails = buildPlaceDetails(place);
      const normalizedFacts = normalizePlaceFacts(place);
      regionLineEl.textContent = `${normalizeText(placeDetails.region, "Region not specified")} - ${normalizeText(placeDetails.country, "Country not specified")}`;
      countryEl.textContent = formatCountryLine(place);
      renderPlaceTitle(place);
      renderTrustSignals(place);
      renderSeasonSwitcher(getBasePlace() || place);
      renderPlaceNavigation(normalizeText(currentContext?.placeId, place?.id));
      descriptionEl.textContent = normalizeText(place.description, "Description unavailable.");
      renderSummary(placeDetails, normalizedFacts);
      renderHighlights(place);
      renderFact(place);
      coordinatesEl.textContent = `GPS ${formatCoordinates(place.lat, place.lon)}`;
      renderWeatherLoading(place);
      renderSources(place);
      renderUpdatedAt(place.updatedAt);
      renderMedia(place);
      scheduleNonCriticalContentRender({
        place,
        placeDetails,
        normalizedFacts,
        renderToken
      });
      sourcesInfoEl.title = "Data may be incomplete. Please verify with official sources.";
      setFavoriteButtonState(Boolean(resolvedIsFavoritePlace?.(place.id)));

      const safeUrl = normalizeHttpUrl(place.link);
      if (safeUrl) {
        linkEl.href = safeUrl;
        linkEl.textContent = "Open official source";
        linkRowEl.hidden = false;
      } else {
        linkEl.removeAttribute("href");
        linkEl.textContent = "";
        linkRowEl.hidden = true;
      }
    }

    function scheduleNonCriticalContentRender(params = {}) {
      const {
        place = null,
        placeDetails = null,
        normalizedFacts = null,
        renderToken = renderSessionToken
      } = params;
      if (!isValidPlace(place)) {
        return;
      }

      if (pendingNonCriticalRenderFrameId) {
        window.cancelAnimationFrame(pendingNonCriticalRenderFrameId);
        pendingNonCriticalRenderFrameId = null;
      }
      if (pendingNonCriticalRenderTimerId) {
        window.clearTimeout(pendingNonCriticalRenderTimerId);
        pendingNonCriticalRenderTimerId = null;
      }

      pendingNonCriticalRenderFrameId = window.requestAnimationFrame(() => {
        pendingNonCriticalRenderFrameId = null;
        pendingNonCriticalRenderTimerId = window.setTimeout(() => {
          pendingNonCriticalRenderTimerId = null;
          const runWhenSettled = () => {
            if (!isOpen || renderToken !== renderSessionToken) {
              return;
            }

            if (isMapMotionActive) {
              pendingNonCriticalRenderTimerId = window.setTimeout(() => {
                pendingNonCriticalRenderTimerId = null;
                runWhenSettled();
              }, POPUP_NON_CRITICAL_WHILE_MOVING_RETRY_MS);
              return;
            }

            const execute = () => {
              pendingNonCriticalIdleId = null;
              if (!isOpen || renderToken !== renderSessionToken) {
                return;
              }
              void hydrateWeather(place, renderToken);
              void hydrateSummaryFacts(place, placeDetails, normalizedFacts);
              void syncDeleteActionAvailability(place);
              void renderFeedback(place);
            };

            if (typeof window.requestIdleCallback === "function") {
              pendingNonCriticalIdleId = window.requestIdleCallback(
                () => {
                  execute();
                },
                { timeout: POPUP_NON_CRITICAL_IDLE_TIMEOUT_MS }
              );
              return;
            }

            execute();
          };

          runWhenSettled();
        }, POPUP_NON_CRITICAL_RENDER_DELAY_MS);
      });
    }

    function renderPlaceTitle(place) {
      const titleText = normalizeText(place?.name, "Untitled place");
      const scope = resolvePlaceScope(place);
      const fragment = document.createDocumentFragment();

      const titleMain = document.createElement("span");
      titleMain.className = "popup-card__title-main";
      titleMain.textContent = titleText;
      fragment.append(titleMain);

      const scopeBadge = document.createElement("span");
      scopeBadge.className = `popup-card__scope-badge popup-card__scope-badge--${scope}`;
      scopeBadge.textContent = scope === "my" ? "MY" : "PUBLIC";
      fragment.append(scopeBadge);

      const activeSeasonLabel = normalizeText(place?.active_season_label, "");
      if (activeSeasonLabel) {
        const seasonBadge = document.createElement("span");
        seasonBadge.className = "popup-card__scope-badge popup-card__scope-badge--season";
        seasonBadge.textContent = activeSeasonLabel;
        fragment.append(seasonBadge);
      }

      titleEl.replaceChildren(fragment);
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

    function isVerifiedPublicPlace(place) {
      if (resolvePlaceScope(place) !== "public") {
        return false;
      }
      const visibility = normalizeText(
        place?.visibility_status ?? place?.submission_state ?? place?.visibility,
        ""
      ).toLowerCase();
      if (
        visibility === "pending" ||
        visibility === "review" ||
        visibility === "scheduled" ||
        visibility === "rejected" ||
        visibility === "withdrawn" ||
        visibility === "private"
      ) {
        return false;
      }
      if (visibility === "approved" || visibility === "public") {
        return true;
      }
      return place?.is_public === true;
    }

    function isVerifiedPlaceAuthor(place) {
      if (!isVerifiedPublicPlace(place)) {
        return false;
      }
      return Boolean(normalizeText(place?.created_by ?? place?.createdBy ?? place?.user_id, ""));
    }

    function renderTrustSignals(place) {
      if (!(trustSignalsEl instanceof HTMLElement)) {
        return;
      }

      const signals = [];
      if (isVerifiedPublicPlace(place)) {
        signals.push({ type: "place", label: "Verified place" });
      }
      if (isVerifiedPlaceAuthor(place)) {
        signals.push({ type: "author", label: "Verified author" });
      }

      if (signals.length === 0) {
        trustSignalsEl.hidden = true;
        trustSignalsEl.replaceChildren();
        return;
      }

      const fragment = document.createDocumentFragment();
      for (const signal of signals) {
        const badge = document.createElement("span");
        badge.className = `popup-card__trust-badge popup-card__trust-badge--${signal.type}`;
        badge.textContent = signal.label;
        fragment.append(badge);
      }
      trustSignalsEl.replaceChildren(fragment);
      trustSignalsEl.hidden = false;
    }

    function renderPlaceNavigation(placeRef) {
      if (!(navigationEl instanceof HTMLElement)) {
        return;
      }

      const safeRef = normalizeText(placeRef, "");
      const navigation = typeof getAdjacentPlaces === "function"
        ? getAdjacentPlaces(safeRef)
        : null;
      const previous = navigation && isValidPlace(navigation.previous) ? navigation.previous : null;
      const next = navigation && isValidPlace(navigation.next) ? navigation.next : null;

      setNavigationButtonState(previousPlaceButtonEl, previous, "previous");
      setNavigationButtonState(nextPlaceButtonEl, next, "next");
      navigationEl.hidden = !previous && !next;
    }

    function setNavigationButtonState(buttonEl, place, direction) {
      if (!(buttonEl instanceof HTMLButtonElement)) {
        return;
      }
      const isPrevious = direction === "previous";
      const label = isPrevious ? "Previous point" : "Next point";
      const targetName = normalizeText(place?.name ?? place?.title, "");
      const targetId = normalizeText(place?.id, "") || normalizeText(place?.slug, "");
      const labelEl = buttonEl.querySelector(".popup-card__nav-label");
      const targetEl = buttonEl.querySelector(".popup-card__nav-target");

      if (labelEl instanceof HTMLElement) {
        labelEl.textContent = label;
      }
      if (targetEl instanceof HTMLElement) {
        targetEl.textContent = targetName || "Unavailable";
      }

      buttonEl.dataset.targetPlaceId = targetId;
      buttonEl.disabled = !targetId;
      buttonEl.title = targetName ? `${label}: ${targetName}` : label;
      buttonEl.setAttribute(
        "aria-label",
        targetName ? `${label}: ${targetName}` : label
      );
    }

    function handleAdjacentNavigation(direction) {
      const safeDirection = normalizeText(direction, "next").toLowerCase() === "previous"
        ? "previous"
        : "next";
      const sourceButton = safeDirection === "previous"
        ? previousPlaceButtonEl
        : nextPlaceButtonEl;
      if (!(sourceButton instanceof HTMLButtonElement)) {
        return;
      }
      const currentPlaceId = normalizeText(currentContext?.placeId, "");
      const targetPlaceId = normalizeText(sourceButton.dataset.targetPlaceId, "");
      if (!currentPlaceId || !targetPlaceId || typeof onNavigatePlace !== "function") {
        return;
      }

      sourceButton.disabled = true;
      try {
        onNavigatePlace(currentPlaceId, safeDirection);
      } catch (error) {
        console.error("Popup adjacent navigation failed:", error);
        renderPlaceNavigation(currentPlaceId);
      }
    }

    function setFavoriteButtonState(isFavorite) {
      favoriteToggleButtonEl.setAttribute("aria-pressed", String(isFavorite));
      favoriteToggleButtonEl.textContent = isFavorite ? "Saved" : "Save";
      favoriteToggleButtonEl.classList.toggle("is-favorite", isFavorite);
    }
    function renderSummary(placeDetails, factsInput = null) {
      const unknownText = "Unknown";
      const facts = factsInput && typeof factsInput === "object"
        ? factsInput
        : normalizePlaceFacts(placeDetails);
      const entries = [
        {
          label: "Population",
          value: normalizeText(facts.populationText, unknownText),
          fallbackValue: unknownText,
          emptyHint: "No data in source"
        },
        {
          label: "Area",
          value: normalizeText(facts.areaText, unknownText),
          fallbackValue: unknownText,
          emptyHint: "No data in source"
        },
        {
          label: "Currency",
          value: normalizeText(facts.currencyText, unknownText),
          fallbackValue: unknownText,
          emptyHint: "No data in source"
        },
        {
          label: "Language",
          value: normalizeText(facts.languageText, unknownText),
          fallbackValue: unknownText,
          emptyHint: "No data in source"
        },
        {
          label: "UTC",
          value: normalizeText(facts.utcText, unknownText),
          fallbackValue: unknownText,
          emptyHint: "No data in source"
        },
        {
          label: "Category",
          value: normalizeText(facts.categoryText, unknownText),
          fallbackValue: unknownText,
          emptyHint: "Category not set"
        },
        {
          label: "Tags",
          value: normalizeText(placeDetails.tagsLabel, "-"),
          fallbackValue: "-",
          emptyHint: "Tags are not set"
        },
        {
          label: "Only free",
          value: placeDetails.isFree ? "Yes" : "No",
          fallbackValue: "",
          emptyHint: ""
        },
        {
          label: "Family friendly",
          value: placeDetails.familyFriendly ? "Yes" : "No",
          fallbackValue: "",
          emptyHint: ""
        },
        {
          label: "Climate",
          value: normalizeText(placeDetails.climate, "-"),
          fallbackValue: "-",
          emptyHint: "No data in source"
        },
        {
          label: "Founded",
          value: normalizeText(placeDetails.founded, "-"),
          fallbackValue: "-",
          emptyHint: "No data in source"
        },
        {
          label: "Country code",
          value: normalizeText(placeDetails.countryCode, "-"),
          fallbackValue: "-",
          emptyHint: "No data in source"
        }
      ];

      const fragment = document.createDocumentFragment();
      for (const entry of entries.slice(0, 10)) {
        const item = document.createElement("li");
        item.className = "popup-summary__item";

        const label = document.createElement("span");
        label.className = "popup-summary__label";
        label.textContent = `${entry.label}:`;

        const value = document.createElement("strong");
        value.className = "popup-summary__value";
        const fallbackValue = normalizeText(entry.fallbackValue, "-");
        const safeValue = normalizeText(entry.value, fallbackValue);
        value.textContent = safeValue;
        if (safeValue === fallbackValue && fallbackValue !== "Unknown") {
          const emptyHint = normalizeText(entry.emptyHint, "No data in source");
          value.setAttribute("data-empty-hint", emptyHint);
          value.title = emptyHint;
        } else {
          value.removeAttribute("data-empty-hint");
          value.removeAttribute("title");
        }

        item.append(label, value);
        fragment.append(item);
      }

      summaryListEl.replaceChildren(fragment);
    }

    function isUnknownFactText(value) {
      return normalizeText(value, "Unknown") === "Unknown";
    }

    function hasMissingCoreFacts(facts) {
      if (!facts || typeof facts !== "object") {
        return true;
      }

      return (
        isUnknownFactText(facts.populationText) ||
        isUnknownFactText(facts.areaText) ||
        isUnknownFactText(facts.currencyText) ||
        isUnknownFactText(facts.languageText) ||
        isUnknownFactText(facts.utcText) ||
        isUnknownFactText(facts.categoryText)
      );
    }

    function getFactsCacheKey(place) {
      return normalizeText(place?.id, "") || normalizeText(place?.slug, "");
    }

    function getFreshFactsCache(cacheKey) {
      if (!cacheKey) {
        return null;
      }

      const cached = placeFactsCache.get(cacheKey);
      if (!cached) {
        return null;
      }

      if (cached.expiresAt <= Date.now()) {
        placeFactsCache.delete(cacheKey);
        return null;
      }

      return cached.payload;
    }

    function setFactsCache(cacheKey, payload) {
      if (!cacheKey || !payload || typeof payload !== "object") {
        return;
      }

      placeFactsCache.set(cacheKey, {
        expiresAt: Date.now() + FACTS_CACHE_TTL_MS,
        payload: {
          populationText: normalizeText(payload.populationText, "Unknown"),
          areaText: normalizeText(payload.areaText, "Unknown"),
          currencyText: normalizeText(payload.currencyText, "Unknown"),
          languageText: normalizeText(payload.languageText, "Unknown"),
          utcText: normalizeText(payload.utcText, "Unknown"),
          categoryText: normalizeText(payload.categoryText, "Unknown")
        }
      });
    }

    function mergeFactsPreferKnown(localFacts, fetchedFacts) {
      const local = localFacts && typeof localFacts === "object" ? localFacts : {};
      const remote = fetchedFacts && typeof fetchedFacts === "object" ? fetchedFacts : {};

      const pick = (localValue, remoteValue) => {
        return isUnknownFactText(remoteValue)
          ? normalizeText(localValue, "Unknown")
          : normalizeText(remoteValue, "Unknown");
      };

      return {
        populationText: pick(local.populationText, remote.populationText),
        areaText: pick(local.areaText, remote.areaText),
        currencyText: pick(local.currencyText, remote.currencyText),
        languageText: pick(local.languageText, remote.languageText),
        utcText: pick(local.utcText, remote.utcText),
        categoryText: pick(local.categoryText, remote.categoryText)
      };
    }

    function hasFactsImproved(previousFacts, nextFacts) {
      const keys = [
        "populationText",
        "areaText",
        "currencyText",
        "languageText",
        "utcText",
        "categoryText"
      ];

      return keys.some((key) => {
        const prevValue = normalizeText(previousFacts?.[key], "Unknown");
        const nextValue = normalizeText(nextFacts?.[key], "Unknown");
        return prevValue === "Unknown" && nextValue !== "Unknown";
      });
    }

    async function hydrateSummaryFacts(place, placeDetails, localFacts) {
      if (!isOpen || !isValidPlace(place)) {
        return;
      }

      if (!hasMissingCoreFacts(localFacts)) {
        return;
      }

      const cacheKey = getFactsCacheKey(place);
      if (!cacheKey) {
        return;
      }

      const cachedFacts = getFreshFactsCache(cacheKey);
      if (cachedFacts) {
        const mergedFacts = mergeFactsPreferKnown(localFacts, cachedFacts);
        if (hasFactsImproved(localFacts, mergedFacts)) {
          renderSummary(placeDetails, mergedFacts);
          invalidatePopupTracking();
          updatePosition({ forceSnap: false, forceMeasure: true });
        }
        return;
      }

      if (typeof onLoadPlaceFacts !== "function") {
        return;
      }

      const placeId = normalizeText(place?.id, "");
      factsLoadToken += 1;
      abortActiveFactsRequest();
      const requestToken = factsLoadToken;

      const factsController = new AbortController();
      activeFactsAbortController = factsController;

      try {
        const fetchedPlace = await withAbort(onLoadPlaceFacts(place), factsController.signal);
        if (!isOpen || requestToken !== factsLoadToken) {
          return;
        }

        const activePlaceId = normalizeText(currentContext?.placeId, "");
        if (!activePlaceId || activePlaceId !== placeId) {
          return;
        }

        const fetchedFacts = normalizePlaceFacts(fetchedPlace || {});
        const mergedFacts = mergeFactsPreferKnown(localFacts, fetchedFacts);
        setFactsCache(cacheKey, mergedFacts);

        if (hasFactsImproved(localFacts, mergedFacts)) {
          renderSummary(placeDetails, mergedFacts);
          invalidatePopupTracking();
          updatePosition({ forceSnap: false, forceMeasure: true });
        }
      } catch (error) {
        if (!isAbortError(error)) {
          console.debug("Popup facts lazy-fetch failed:", error);
        }
      } finally {
        if (activeFactsAbortController === factsController) {
          activeFactsAbortController = null;
        }
      }
    }

    function abortActiveFactsRequest() {
      try {
        activeFactsAbortController?.abort();
      } catch (_error) {
        // Ignore abort errors; popup close must always complete.
      }
      activeFactsAbortController = null;
    }

    function renderHighlights(place) {
      const highlights = Array.isArray(place.highlights)
        ? place.highlights
            .filter((item) => typeof item === "string" && item.trim() !== "")
            .slice(0, 6)
        : [];

      if (highlights.length === 0) {
        const fallback = document.createElement("li");
        fallback.className = "popup-highlight is-empty";
        fallback.textContent = "— Ключевые особенности скоро будут добавлены.";
        highlightsEl.replaceChildren(fallback);
        highlightsEl.hidden = false;
        return;
      }

      const fragment = document.createDocumentFragment();
      for (const item of highlights) {
        const listItem = document.createElement("li");
        listItem.className = "popup-highlight";
        listItem.textContent = item.trim();
        fragment.append(listItem);
      }

      highlightsEl.replaceChildren(fragment);
      highlightsEl.hidden = false;
    }

    function renderFact(place) {
      const fact = normalizeText(place.funFact, "");
      if (!fact) {
        factEl.textContent = "💡 Факт о месте временно недоступен.";
        factEl.classList.add("is-empty");
        factEl.hidden = false;
        return;
      }

      factEl.textContent = `💡 ${fact}`;
      factEl.classList.remove("is-empty");
      factEl.hidden = false;
    }

    function renderSources(place) {
      const sources = resolvePlaceSources(place);
      const fragment = document.createDocumentFragment();

      for (const [index, source] of sources.entries()) {
        if (index > 0) {
          const separator = document.createElement("span");
          separator.className = "popup-card__source-separator";
          separator.textContent = " • ";
          fragment.append(separator);
        }

        const link = document.createElement("a");
        link.className = "popup-card__source-link";
        link.href = source.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = source.label;
        fragment.append(link);
      }

      sourcesEl.replaceChildren(fragment);
    }

    function renderUpdatedAt(updatedAtValue) {
      const timestamp = Date.parse(String(updatedAtValue || ""));
      if (Number.isFinite(timestamp)) {
        updatedEl.textContent = `Обновлено: ${new Date(timestamp).toLocaleString("ru-RU")}`;
        return;
      }

      updatedEl.textContent = "Обновлено: —";
    }

    function getWeatherCacheKey(place) {
      const byId = normalizeText(place?.id, "");
      if (byId) {
        return byId;
      }
      const lat = Number(place?.lat);
      const lon = Number(place?.lon ?? place?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        return "";
      }
      return `${round(lat, 3)},${round(lon, 3)}`;
    }

    function getFreshWeatherCache(cacheKey) {
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

    function setWeatherCache(cacheKey, payload) {
      if (!cacheKey || !payload || typeof payload !== "object") {
        return;
      }
      weatherCache.set(cacheKey, {
        expiresAt: Date.now() + POPUP_WEATHER_CACHE_TTL_MS,
        payload: { ...payload }
      });
    }

    function renderWeatherMeta(entries) {
      if (!(weatherMetaEl instanceof HTMLElement)) {
        return;
      }

      const fragment = document.createDocumentFragment();
      for (const entry of Array.isArray(entries) ? entries : []) {
        if (!entry || typeof entry !== "object") {
          continue;
        }
        const labelText = normalizeText(entry.label, "");
        const valueText = normalizeText(entry.value, "");
        if (!labelText || !valueText) {
          continue;
        }

        const item = document.createElement("li");
        item.className = "popup-weather__meta-item";

        const label = document.createElement("span");
        label.className = "popup-weather__meta-label";
        label.textContent = labelText;

        const value = document.createElement("strong");
        value.className = "popup-weather__meta-value";
        value.textContent = valueText;

        item.append(label, value);
        fragment.append(item);
      }

      weatherMetaEl.replaceChildren(fragment);
    }

    function applyWeatherVisualState(period = "") {
      const safePeriod = normalizeText(period, "").toLowerCase();
      if (safePeriod === "day" || safePeriod === "night") {
        popupEl.dataset.weatherPeriod = safePeriod;
        weatherSectionEl.dataset.period = safePeriod;
        return;
      }
      delete popupEl.dataset.weatherPeriod;
      delete weatherSectionEl.dataset.period;
    }

    function formatWeatherClock(value) {
      const safeValue = normalizeText(value, "");
      if (!safeValue) {
        return "";
      }
      const normalizedIsoCandidate = safeValue.includes("T")
        ? safeValue
        : safeValue.replace(" ", "T");
      const parsed = Date.parse(normalizedIsoCandidate);
      if (Number.isFinite(parsed)) {
        return new Date(parsed).toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit"
        });
      }
      const match = safeValue.match(/\b(\d{1,2}:\d{2})\b/);
      return match ? match[1] : safeValue;
    }

    function renderWeatherLoading(place) {
      if (!(weatherSectionEl instanceof HTMLElement)) {
        return;
      }
      const lat = Number(place?.lat);
      const lon = Number(place?.lon ?? place?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        weatherSectionEl.hidden = true;
        return;
      }

      weatherSectionEl.hidden = false;
      weatherSectionEl.dataset.state = "loading";
      applyWeatherVisualState("");
      weatherIconEl.textContent = "◌";
      weatherTempEl.textContent = "—";
      weatherConditionEl.textContent = "Checking live weather...";
      if (weatherLocalEl instanceof HTMLElement) {
        weatherLocalEl.textContent = "Local time is syncing...";
      }
      weatherStatusEl.textContent = "Live";
      weatherUpdatedEl.textContent = "Updating…";
      renderWeatherMeta([]);
    }

    function renderWeatherError(message) {
      if (!(weatherSectionEl instanceof HTMLElement)) {
        return;
      }
      weatherSectionEl.hidden = false;
      weatherSectionEl.dataset.state = "error";
      applyWeatherVisualState("");
      weatherIconEl.textContent = "◌";
      weatherTempEl.textContent = "—";
      weatherConditionEl.textContent = normalizeText(message, "Weather is temporarily unavailable.");
      if (weatherLocalEl instanceof HTMLElement) {
        weatherLocalEl.textContent = "Local time is unavailable right now.";
      }
      weatherStatusEl.textContent = "Live";
      weatherUpdatedEl.textContent = "Will retry later";
      renderWeatherMeta([]);
    }

    function normalizeWeatherPayload(payload) {
      const source = payload && typeof payload === "object"
        ? (payload.item && typeof payload.item === "object" ? payload.item : payload)
        : null;
      if (!source) {
        return null;
      }

      const tempC = Number(source.tempC ?? source.temp_c);
      const feelsLikeC = Number(source.feelsLikeC ?? source.feels_like_c);
      const humidity = Number(source.humidity);
      const windKph = Number(source.windKph ?? source.wind_kph);
      const uvIndex = Number(source.uvIndex ?? source.uv ?? source.uv_index);
      const condition = normalizeText(source.condition, "");
      const updatedAt = normalizeText(source.updatedAt ?? source.updated_at, "");
      const localTime = normalizeText(source.localTime ?? source.local_time, "");
      const tzId = normalizeText(source.tzId ?? source.tz_id, "");
      const sunrise = normalizeText(source.sunrise, "");
      const sunset = normalizeText(source.sunset, "");
      const isDay = Number(source.isDay ?? source.is_day) === 1;

      if (!Number.isFinite(tempC) || !condition) {
        return null;
      }

      return {
        tempC,
        feelsLikeC: Number.isFinite(feelsLikeC) ? feelsLikeC : null,
        humidity: Number.isFinite(humidity) ? humidity : null,
        windKph: Number.isFinite(windKph) ? windKph : null,
        uvIndex: Number.isFinite(uvIndex) ? uvIndex : null,
        condition,
        updatedAt,
        isDay,
        localTime,
        tzId,
        sunrise,
        sunset
      };
    }

    function formatWeatherTemperature(value) {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) {
        return "—";
      }
      return `${Math.round(numeric)}°C`;
    }

    function resolveWeatherGlyph(condition, isDay) {
      const normalized = normalizeText(condition, "").toLowerCase();
      if (!normalized) {
        return "◌";
      }
      if (normalized.includes("thunder")) {
        return "⚡";
      }
      if (normalized.includes("snow") || normalized.includes("sleet") || normalized.includes("ice")) {
        return "❄";
      }
      if (normalized.includes("rain") || normalized.includes("drizzle") || normalized.includes("shower")) {
        return "☂";
      }
      if (normalized.includes("mist") || normalized.includes("fog") || normalized.includes("haze")) {
        return "〰";
      }
      if (normalized.includes("cloud") || normalized.includes("overcast")) {
        return "☁";
      }
      return isDay ? "☀" : "☾";
    }

    function renderWeatherSnapshot(payload) {
      if (!(weatherSectionEl instanceof HTMLElement)) {
        return;
      }

      const weather = normalizeWeatherPayload(payload);
      if (!weather) {
        renderWeatherError("Weather is temporarily unavailable.");
        return;
      }

      weatherSectionEl.hidden = false;
      weatherSectionEl.dataset.state = "ready";
      applyWeatherVisualState(weather.isDay ? "day" : "night");
      weatherIconEl.textContent = resolveWeatherGlyph(weather.condition, weather.isDay);
      weatherTempEl.textContent = formatWeatherTemperature(weather.tempC);
      weatherConditionEl.textContent = weather.condition;
      if (weatherLocalEl instanceof HTMLElement) {
        const clockLabel = formatWeatherClock(weather.localTime);
        const timezoneLabel = normalizeText(weather.tzId, "");
        weatherLocalEl.textContent = clockLabel
          ? `Local time ${clockLabel}${timezoneLabel ? ` • ${timezoneLabel}` : ""}`
          : "Live local time unavailable";
      }
      weatherStatusEl.textContent = weather.isDay ? "Live / Day" : "Live / Night";
      weatherUpdatedEl.textContent = weather.updatedAt
        ? `Updated ${new Date(weather.updatedAt).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit"
          })}`
        : "Updated recently";

      renderWeatherMeta([
        {
          label: "Feels like",
          value: formatWeatherTemperature(weather.feelsLikeC)
        },
        {
          label: "Humidity",
          value: Number.isFinite(weather.humidity) ? `${Math.round(weather.humidity)}%` : "—"
        },
        {
          label: "Wind",
          value: Number.isFinite(weather.windKph) ? `${Math.round(weather.windKph)} km/h` : "—"
        },
        {
          label: "UV",
          value: Number.isFinite(weather.uvIndex) ? weather.uvIndex.toFixed(1) : "—"
        },
        {
          label: "Sunrise",
          value: normalizeText(weather.sunrise, "—")
        },
        {
          label: "Sunset",
          value: normalizeText(weather.sunset, "—")
        }
      ]);
    }

    async function hydrateWeather(place, renderToken = renderSessionToken) {
      if (!isOpen || !isValidPlace(place)) {
        return;
      }
      if (typeof onLoadPlaceWeather !== "function") {
        if (weatherSectionEl instanceof HTMLElement) {
          weatherSectionEl.hidden = true;
        }
        return;
      }

      const cacheKey = getWeatherCacheKey(place);
      if (!cacheKey) {
        if (weatherSectionEl instanceof HTMLElement) {
          weatherSectionEl.hidden = true;
        }
        return;
      }

      const cached = getFreshWeatherCache(cacheKey);
      if (cached) {
        renderWeatherSnapshot(cached);
        invalidatePopupTracking();
        updatePosition({ forceSnap: false, forceMeasure: true });
        return;
      }

      weatherLoadToken += 1;
      abortActiveWeatherRequest();
      const requestToken = weatherLoadToken;
      const weatherController = new AbortController();
      activeWeatherAbortController = weatherController;

      try {
        const payload = await withAbort(onLoadPlaceWeather(place), weatherController.signal);
        if (!isOpen || renderToken !== renderSessionToken || requestToken !== weatherLoadToken) {
          return;
        }
        const normalized = normalizeWeatherPayload(payload);
        if (!normalized) {
          renderWeatherError("Weather is temporarily unavailable.");
          return;
        }
        setWeatherCache(cacheKey, normalized);
        renderWeatherSnapshot(normalized);
        invalidatePopupTracking();
        updatePosition({ forceSnap: false, forceMeasure: true });
      } catch (error) {
        if (isAbortError(error)) {
          return;
        }
        console.debug("Popup weather lazy-fetch failed:", error);
        if (!isOpen || renderToken !== renderSessionToken || requestToken !== weatherLoadToken) {
          return;
        }
        renderWeatherError("Weather is temporarily unavailable.");
      } finally {
        if (activeWeatherAbortController === weatherController) {
          activeWeatherAbortController = null;
        }
      }
    }

    function abortActiveWeatherRequest() {
      try {
        activeWeatherAbortController?.abort();
      } catch (_error) {
        // Ignore abort errors; popup close must always complete.
      }
      activeWeatherAbortController = null;
    }

    async function renderFeedback(place) {
      const placeId = normalizeText(place?.id, "");
      const cacheKey = placeId || normalizeText(place?.slug, "");
      activeFeedbackPlaceId = placeId;
      activeFeedbackCacheKey = cacheKey;
      feedbackLoadToken += 1;
      const requestToken = feedbackLoadToken;
      abortActiveFeedbackRequest();

      feedbackStatusDraft = "";
      feedbackRatingDraft = 0;
      feedbackHoverRating = 0;
      feedbackCurrentUserRating = 0;
      feedbackCommentDraft = "";
      reviewCommentEl.value = "";
      feedbackAuthHintEl.hidden = true;
      feedbackAuthHintEl.textContent = "";
      updateStatusButtonUi();
      updateRatingStarUi();
      setFeedbackLoadingState(true);
      renderCommunitySnapshot({
        average: 0,
        count: 0,
        reviews: [],
        isLoading: true
      });

      const cachedFeedback = getFreshFeedbackCache(cacheKey);
      if (cachedFeedback) {
        applyCachedFeedback(cachedFeedback);
        if (isOpen && requestToken === feedbackLoadToken && activeFeedbackPlaceId === placeId) {
          setFeedbackLoadingState(false);
        }
        return;
      }

      if (
        !PlaceFeedbackStore ||
        typeof PlaceFeedbackStore.isAuthenticated !== "function" ||
        typeof PlaceFeedbackStore.getUserEntry !== "function" ||
        typeof PlaceFeedbackStore.getCommunitySnapshot !== "function"
      ) {
        renderCommunitySnapshot({
          average: 0,
          count: 0,
          reviews: [],
          loadError: "Unable to load reviews."
        });
        setFeedbackLoadingState(false);
        return;
      }

      const feedbackController = new AbortController();
      activeFeedbackAbortController = feedbackController;

      try {
        const [isAuthenticated, userEntry, snapshot] = await Promise.all([
          withAbort(PlaceFeedbackStore.isAuthenticated(), feedbackController.signal),
          withAbort(PlaceFeedbackStore.getUserEntry(placeId), feedbackController.signal),
          withAbort(PlaceFeedbackStore.getCommunitySnapshot(place), feedbackController.signal)
        ]);

        if (!isOpen || requestToken !== feedbackLoadToken || activeFeedbackPlaceId !== placeId) {
          return;
        }

        feedbackIsAuthenticated = Boolean(isAuthenticated);
        applyFeedbackAuthState(feedbackIsAuthenticated);

        feedbackStatusDraft = normalizeFeedbackStatus(userEntry?.status);
        feedbackRatingDraft = feedbackIsAuthenticated
          ? normalizeFeedbackRating(userEntry?.rating)
          : 0;
        feedbackCurrentUserRating = feedbackRatingDraft;
        feedbackHoverRating = 0;
        feedbackCommentDraft = feedbackIsAuthenticated
          ? normalizeFeedbackComment(userEntry?.comment)
          : "";

        reviewCommentEl.value = feedbackCommentDraft;
        updateStatusButtonUi();
        updateRatingStarUi();
        feedbackCurrentSnapshot = normalizeCommunitySnapshot(snapshot);
        renderCommunitySnapshot(feedbackCurrentSnapshot);
        setFeedbackCache(cacheKey, {
          isAuthenticated: feedbackIsAuthenticated,
          userEntry: {
            status: feedbackStatusDraft,
            rating: feedbackRatingDraft,
            comment: feedbackCommentDraft
          },
          snapshot: feedbackCurrentSnapshot
        });
      } catch (error) {
        if (isAbortError(error)) {
          return;
        }
        console.error("Feedback render failed:", error);
        if (!isOpen || requestToken !== feedbackLoadToken || activeFeedbackPlaceId !== placeId) {
          return;
        }

        feedbackIsAuthenticated = false;
        applyFeedbackAuthState(false);
        renderCommunitySnapshot({
          average: 0,
          count: 0,
          reviews: [],
          loadError: "Unable to load reviews."
        });
      } finally {
        if (activeFeedbackAbortController === feedbackController) {
          activeFeedbackAbortController = null;
        }
        if (!isOpen || requestToken !== feedbackLoadToken || activeFeedbackPlaceId !== placeId) {
          return;
        }
        setFeedbackLoadingState(false);
      }
    }

    function normalizeCommunitySnapshot(snapshot) {
      const safeSnapshot = snapshot && typeof snapshot === "object"
        ? snapshot
        : {};
      return {
        average: Number(safeSnapshot.average) || 0,
        count: Math.max(0, Math.floor(Number(safeSnapshot.count) || 0)),
        reviews: Array.isArray(safeSnapshot.reviews) ? safeSnapshot.reviews : [],
        isLoading: safeSnapshot.isLoading === true,
        requiresAuth: safeSnapshot.requiresAuth === true,
        loadError: normalizeText(safeSnapshot.loadError, "")
      };
    }

    function getFreshFeedbackCache(cacheKey) {
      if (!cacheKey) {
        return null;
      }
      const cached = feedbackCache.get(cacheKey);
      if (!cached) {
        return null;
      }
      if (cached.expiresAt <= Date.now()) {
        feedbackCache.delete(cacheKey);
        return null;
      }
      return cached.payload;
    }

    function setFeedbackCache(cacheKey, payload) {
      if (!cacheKey) {
        return;
      }
      feedbackCache.set(cacheKey, {
        expiresAt: Date.now() + FEEDBACK_CACHE_TTL_MS,
        payload: {
          isAuthenticated: Boolean(payload?.isAuthenticated),
          userEntry: payload?.userEntry && typeof payload.userEntry === "object"
            ? { ...payload.userEntry }
            : null,
          snapshot: normalizeCommunitySnapshot(payload?.snapshot)
        }
      });
    }

    function applyCachedFeedback(cached) {
      const payload = cached && typeof cached === "object" ? cached : {};
      feedbackIsAuthenticated = Boolean(payload.isAuthenticated);
      applyFeedbackAuthState(feedbackIsAuthenticated);

      const userEntry = payload.userEntry && typeof payload.userEntry === "object"
        ? payload.userEntry
        : null;
      feedbackStatusDraft = normalizeFeedbackStatus(userEntry?.status);
      feedbackRatingDraft = feedbackIsAuthenticated
        ? normalizeFeedbackRating(userEntry?.rating)
        : 0;
      feedbackCurrentUserRating = feedbackRatingDraft;
      feedbackHoverRating = 0;
      feedbackCommentDraft = feedbackIsAuthenticated
        ? normalizeFeedbackComment(userEntry?.comment)
        : "";
      reviewCommentEl.value = feedbackCommentDraft;
      updateStatusButtonUi();
      updateRatingStarUi();
      feedbackCurrentSnapshot = normalizeCommunitySnapshot(payload.snapshot);
      renderCommunitySnapshot(feedbackCurrentSnapshot);
    }

    function abortActiveFeedbackRequest() {
      if (!activeFeedbackAbortController) {
        return;
      }
      activeFeedbackAbortController.abort();
      activeFeedbackAbortController = null;
    }

    async function syncDeleteActionAvailability(place) {
      const token = ++deleteAccessToken;
      canDeleteCurrentPlace = false;
      deleteButtonEl.hidden = true;
      deleteButtonEl.disabled = true;

      if (!isOpen || !isValidPlace(place) || typeof canDeletePlace !== "function") {
        return false;
      }

      try {
        const allowed = Boolean(await canDeletePlace(place));
        if (!isOpen || token !== deleteAccessToken) {
          return false;
        }
        canDeleteCurrentPlace = allowed;
        deleteButtonEl.hidden = !allowed;
        deleteButtonEl.disabled = !allowed;
        return allowed;
      } catch (error) {
        console.warn("Delete availability check failed:", error);
        return false;
      }
    }

    function applyStatusSelection(nextStatusRaw) {
      if (!isOpen || !isValidPlace(currentContext?.place)) {
        return;
      }

      const nextStatus = normalizeFeedbackStatus(nextStatusRaw);
      feedbackStatusDraft = feedbackStatusDraft === nextStatus ? "" : nextStatus;
      updateStatusButtonUi();
      void persistFeedback({
        requireRating: false,
        updateReview: false,
        showSavedToast: false
      });
    }

    async function persistFeedback(options = {}) {
      const {
        requireRating = false,
        updateReview = true,
        showSavedToast = false
      } = options;

      const place = currentContext?.place;
      if (!isOpen || !isValidPlace(place)) {
        return false;
      }
      if (activeFeedbackPlaceId && activeFeedbackPlaceId !== place.id) {
        return false;
      }
      if (
        !PlaceFeedbackStore ||
        typeof PlaceFeedbackStore.saveUserEntry !== "function" ||
        typeof PlaceFeedbackStore.isAuthenticated !== "function"
      ) {
        return false;
      }

      if (isWriteBlockedByBan()) {
        safeSetStatus(BANNED_REVIEW_MESSAGE, {
          type: "error",
          timeoutMs: 2400
        });
        safeShowToast(BANNED_REVIEW_MESSAGE);
        return false;
      }

      if (requireRating && feedbackRatingDraft < 1) {
        safeSetStatus("Please choose a rating from 1 to 5.", {
          type: "error",
          timeoutMs: 1800
        });
        return false;
      }

      if (updateReview) {
        const isAuthenticated = await PlaceFeedbackStore.isAuthenticated();
        feedbackIsAuthenticated = Boolean(isAuthenticated);
        applyFeedbackAuthState(feedbackIsAuthenticated);
        if (!feedbackIsAuthenticated) {
          renderCommunitySnapshot({
            average: 0,
            count: 0,
            reviews: [],
            requiresAuth: true
          });
          safeSetStatus("Sign in to leave review.", {
            type: "error",
            timeoutMs: 1800
          });
          return false;
        }
      }

      feedbackCommentDraft = normalizeFeedbackComment(feedbackCommentDraft);
      reviewCommentEl.value = feedbackCommentDraft;
      const previousUserRating = feedbackCurrentUserRating;
      setReviewSavingState(true);

      try {
        await PlaceFeedbackStore.saveUserEntry(place.id, {
          status: feedbackStatusDraft,
          rating: feedbackRatingDraft,
          comment: feedbackCommentDraft
        }, {
          syncReview: updateReview
        });

        feedbackCurrentUserRating = normalizeFeedbackRating(feedbackRatingDraft);
        if (updateReview) {
          feedbackCurrentSnapshot = applyOptimisticReviewUpdate({
            snapshot: feedbackCurrentSnapshot,
            previousRating: previousUserRating,
            nextRating: feedbackCurrentUserRating,
            comment: feedbackCommentDraft
          });
          renderCommunitySnapshot(feedbackCurrentSnapshot);
        }
        setFeedbackCache(activeFeedbackCacheKey, {
          isAuthenticated: feedbackIsAuthenticated,
          userEntry: {
            status: feedbackStatusDraft,
            rating: feedbackCurrentUserRating,
            comment: feedbackCommentDraft
          },
          snapshot: feedbackCurrentSnapshot
        });
      } catch (error) {
        const message = normalizeText(error?.message, "Could not save review.");
        renderCommunitySnapshot({
          ...feedbackCurrentSnapshot,
          loadError: message
        });
        safeSetStatus(message, {
          type: "error",
          timeoutMs: 2400
        });
        if (message.toLowerCase().includes("banned")) {
          safeShowToast(message);
        }
        return false;
      } finally {
        setReviewSavingState(false);
      }

      if (showSavedToast) {
        pulseSaveButton();
        safeShowToast("Review saved");
      }

      return true;
    }

    function applyOptimisticReviewUpdate(payload) {
      const {
        snapshot,
        previousRating,
        nextRating,
        comment
      } = payload;
      const safeSnapshot = normalizeCommunitySnapshot(snapshot);
      const reviews = Array.isArray(safeSnapshot.reviews)
        ? [...safeSnapshot.reviews]
        : [];
      const previous = normalizeFeedbackRating(previousRating);
      const next = normalizeFeedbackRating(nextRating);

      const existingOwnIndex = reviews.findIndex((entry) => {
        const author = normalizeText(entry?.authorName, "").toLowerCase();
        return author === "you";
      });

      if (existingOwnIndex >= 0) {
        reviews.splice(existingOwnIndex, 1);
      }

      if (next >= 1) {
        reviews.unshift({
          id: `local-review-${Date.now()}`,
          authorName: "You",
          rating: next,
          comment: normalizeFeedbackComment(comment),
          createdAt: new Date().toISOString()
        });
      }

      let count = Math.max(0, Math.floor(Number(safeSnapshot.count) || 0));
      let sum = (Number(safeSnapshot.average) || 0) * count;
      if (previous >= 1) {
        sum -= previous;
        count = Math.max(0, count - 1);
      }
      if (next >= 1) {
        sum += next;
        count += 1;
      }

      return {
        average: count > 0 ? round(sum / count, 1) : 0,
        count,
        reviews
      };
    }

    function setReviewSavingState(isSaving, options = {}) {
      feedbackIsSaving = Boolean(isSaving);
      if (feedbackIsSaving) {
        reviewSaveButtonEl.dataset.prevLabel = reviewSaveButtonEl.textContent || reviewSaveButtonDefaultText;
        reviewSaveButtonEl.textContent = "Saving...";
      } else {
        reviewSaveButtonEl.textContent = normalizeText(
          reviewSaveButtonEl.dataset.prevLabel,
          reviewSaveButtonDefaultText
        );
        delete reviewSaveButtonEl.dataset.prevLabel;
      }
      if (options.immediate === true) {
        reviewSaveButtonEl.disabled = false;
      }
      setFeedbackLoadingState(false);
    }

    function setFeedbackLoadingState(isLoading) {
      const lockedByAuth = !feedbackIsAuthenticated;
      const lockedByBan = isWriteBlockedByBan();
      const isBusy = Boolean(isLoading) || feedbackIsSaving;
      reviewCommentEl.disabled = isBusy || lockedByAuth || lockedByBan;
      reviewSaveButtonEl.disabled = isBusy || lockedByAuth || lockedByBan;
      for (const starButton of ratingStarButtons) {
        starButton.disabled = isBusy || lockedByAuth || lockedByBan;
      }
      statusWantButtonEl.disabled = isBusy || lockedByAuth || lockedByBan;
      statusVisitedButtonEl.disabled = isBusy || lockedByAuth || lockedByBan;
      if (lockedByBan) {
        feedbackAuthHintEl.hidden = false;
        feedbackAuthHintEl.textContent = BANNED_REVIEW_MESSAGE;
      }
    }

    function applyFeedbackAuthState(isAuthenticated) {
      const isAuthed = Boolean(isAuthenticated);
      const lockedByBan = isWriteBlockedByBan();
      feedbackIsAuthenticated = isAuthed;
      feedbackAuthHintEl.hidden = isAuthed && !lockedByBan;
      feedbackAuthHintEl.textContent = lockedByBan
        ? BANNED_REVIEW_MESSAGE
        : (
          isAuthed
            ? ""
            : "Sign in to leave review."
        );
      setFeedbackLoadingState(false);
    }

    function updateStatusButtonUi() {
      const isWant = feedbackStatusDraft === "want";
      const isVisited = feedbackStatusDraft === "visited";

      statusWantButtonEl.classList.toggle("is-active", isWant);
      statusVisitedButtonEl.classList.toggle("is-active", isVisited);
      statusWantButtonEl.setAttribute("aria-pressed", String(isWant));
      statusVisitedButtonEl.setAttribute("aria-pressed", String(isVisited));
    }

    function updateRatingStarUi(options = {}) {
      const { animate = false } = options;
      const displayRating = feedbackHoverRating > 0 ? feedbackHoverRating : feedbackRatingDraft;

      for (const starButton of ratingStarButtons) {
        const starRating = clamp(Math.round(Number(starButton.dataset.rating || 0)), 1, 5);
        const isOn = starRating <= displayRating;
        const isHoverPreview = feedbackHoverRating > 0 && starRating <= feedbackHoverRating;

        starButton.classList.toggle("is-on", isOn);
        starButton.classList.toggle("is-hover", isHoverPreview);
        starButton.setAttribute("aria-checked", String(starRating === feedbackRatingDraft));
      }

      ratingStarsEl.setAttribute("data-rating", String(displayRating));

      if (animate) {
        restartClassAnimation(ratingStarsEl, "is-pop");
        window.setTimeout(() => {
          ratingStarsEl.classList.remove("is-pop");
        }, 240);
      }
    }

    function pulseSaveButton() {
      reviewSaveButtonEl.classList.remove("is-saved");
      if (feedbackSavePulseTimerId) {
        window.clearTimeout(feedbackSavePulseTimerId);
        feedbackSavePulseTimerId = null;
      }

      restartClassAnimation(reviewSaveButtonEl, "is-saved");
      feedbackSavePulseTimerId = window.setTimeout(() => {
        feedbackSavePulseTimerId = null;
        reviewSaveButtonEl.classList.remove("is-saved");
      }, 380);
    }

    function renderCommunitySnapshot(snapshot) {
      const safeSnapshot = normalizeCommunitySnapshot(snapshot);
      const isLoading = safeSnapshot.isLoading === true;
      const requiresAuth = safeSnapshot.requiresAuth === true;
      const loadError = normalizeText(safeSnapshot.loadError, "");

      const averageValue = Number(safeSnapshot.average);
      const countValue = Math.max(0, Math.floor(Number(safeSnapshot.count) || 0));
      const avgText = Number.isFinite(averageValue) && countValue > 0
        ? averageValue.toFixed(1)
        : "—";

      communityAverageEl.textContent = avgText;
      communityCountEl.textContent = requiresAuth
        ? "Sign in required"
        : `${new Intl.NumberFormat("en-US").format(countValue)} reviews`;

      const reviews = Array.isArray(safeSnapshot.reviews) ? safeSnapshot.reviews : [];

      if (isLoading || requiresAuth || loadError || reviews.length === 0) {
        let message = "No reviews yet.";
        if (isLoading) {
          message = "Loading reviews...";
        } else if (requiresAuth) {
          message = "Sign in to see community reviews.";
        } else if (loadError) {
          message = loadError;
        }
        renderCommunityMessage(message);
        return;
      }

      reviewVirtualState.reviews = reviews;
      reviewVirtualState.enabled = reviews.length > REVIEW_VIRTUAL_WINDOW;
      reviewVirtualState.revision += 1;
      renderVisibleReviewsWindow({ force: true });
    }

    function renderCommunityMessage(message) {
      reviewVirtualState.enabled = false;
      reviewVirtualState.reviews = [];
      reviewVirtualState.revision += 1;
      reviewVirtualState.lastRenderedRevision = -1;
      reviewVirtualState.lastStart = -1;
      reviewVirtualState.lastEnd = -1;

      const fragment = document.createDocumentFragment();
      const item = document.createElement("li");
      item.className = "popup-community__review is-empty";
      item.textContent = message;
      fragment.append(item);
      communityReviewsEl.replaceChildren(fragment);
    }

    function renderVisibleReviewsWindow(options = {}) {
      const { force = false } = options;
      const reviews = reviewVirtualState.reviews;
      if (!Array.isArray(reviews) || reviews.length === 0) {
        return;
      }

      let start = 0;
      let end = reviews.length;

      if (reviewVirtualState.enabled) {
        const scrollTop = Math.max(0, communityReviewsEl.scrollTop || 0);
        start = Math.max(
          0,
          Math.floor(scrollTop / REVIEW_ESTIMATED_HEIGHT_PX) - REVIEW_VIRTUAL_OVERSCAN
        );
        end = Math.min(reviews.length, start + REVIEW_VIRTUAL_WINDOW);
      }

      if (
        !force &&
        reviewVirtualState.lastRenderedRevision === reviewVirtualState.revision &&
        reviewVirtualState.lastStart === start &&
        reviewVirtualState.lastEnd === end
      ) {
        return;
      }

      const fragment = document.createDocumentFragment();

      if (reviewVirtualState.enabled && start > 0) {
        fragment.append(createReviewSpacer(start * REVIEW_ESTIMATED_HEIGHT_PX));
      }

      for (let index = start; index < end; index += 1) {
        fragment.append(getOrCreateReviewNode(reviews[index], index));
      }

      if (reviewVirtualState.enabled && end < reviews.length) {
        fragment.append(createReviewSpacer((reviews.length - end) * REVIEW_ESTIMATED_HEIGHT_PX));
      }

      communityReviewsEl.replaceChildren(fragment);
      reviewVirtualState.lastRenderedRevision = reviewVirtualState.revision;
      reviewVirtualState.lastStart = start;
      reviewVirtualState.lastEnd = end;
      pruneReviewNodeCache(reviews);
    }

    function createReviewSpacer(heightPx) {
      const spacer = document.createElement("li");
      spacer.className = "popup-community__review is-empty";
      spacer.setAttribute("aria-hidden", "true");
      spacer.textContent = "";
      spacer.style.height = `${Math.max(0, Math.round(heightPx))}px`;
      spacer.style.padding = "0";
      spacer.style.margin = "0";
      spacer.style.border = "0";
      return spacer;
    }

    function getOrCreateReviewNode(review, index) {
      const safeReview = review && typeof review === "object" ? review : {};
      const keyBase = normalizeText(safeReview.id, "");
      const key = keyBase || `${normalizeText(safeReview.authorName, "guest")}::${normalizeText(safeReview.createdAt, String(index))}::${index}`;
      let node = reviewNodeCache.get(key);
      if (!node) {
        node = document.createElement("li");
        node.className = "popup-community__review";

        const head = document.createElement("div");
        head.className = "popup-community__review-head";
        const authorEl = document.createElement("strong");
        authorEl.className = "popup-community__review-author";
        const starsEl = document.createElement("span");
        starsEl.className = "popup-community__review-stars";
        head.append(authorEl, starsEl);

        const commentEl = document.createElement("p");
        commentEl.className = "popup-community__review-text";
        const dateEl = document.createElement("span");
        dateEl.className = "popup-community__review-date";

        node.append(head, commentEl, dateEl);
        node.__popupParts = { authorEl, starsEl, commentEl, dateEl };
        reviewNodeCache.set(key, node);
      }

      const rating = normalizeFeedbackRating(safeReview.rating);
      const author = normalizeText(safeReview.authorName, "Guest");
      const comment = normalizeText(safeReview.comment, "");
      const dateValue = formatReviewDate(safeReview.createdAt);
      const parts = node.__popupParts;

      if (parts) {
        if (parts.authorEl.textContent !== author) {
          parts.authorEl.textContent = author;
        }
        const starsText = buildStarsString(rating);
        if (parts.starsEl.textContent !== starsText) {
          parts.starsEl.textContent = starsText;
        }
        const commentText = comment || "No comment.";
        if (parts.commentEl.textContent !== commentText) {
          parts.commentEl.textContent = commentText;
        }
        if (parts.dateEl.textContent !== dateValue) {
          parts.dateEl.textContent = dateValue;
        }
      }

      return node;
    }

    function pruneReviewNodeCache(reviews) {
      if (reviewNodeCache.size <= MAX_REVIEW_NODE_CACHE) {
        return;
      }
      const allowedKeys = new Set();
      for (let index = 0; index < reviews.length; index += 1) {
        const review = reviews[index];
        const keyBase = normalizeText(review?.id, "");
        const key = keyBase || `${normalizeText(review?.authorName, "guest")}::${normalizeText(review?.createdAt, String(index))}::${index}`;
        allowedKeys.add(key);
      }
      for (const key of reviewNodeCache.keys()) {
        if (!allowedKeys.has(key)) {
          reviewNodeCache.delete(key);
        }
      }
    }

    function renderMedia(place, options = {}) {
      const {
        forceRetry = false
      } = options;
      const imageUrl = getPlaceImageUrl(place);
      const mediaAlt = `Photo: ${normalizeText(place.name, "Location")}`;
      mediaRequestToken += 1;
      const requestToken = mediaRequestToken;
      const cacheKeyBase = normalizeText(place?.id, "") || normalizeText(place?.slug, "");
      const cacheKeySeason = normalizeText(place?.active_season, "base").toLowerCase() || "base";
      const cacheKey = cacheKeyBase ? `${cacheKeyBase}::${cacheKeySeason}` : "";
      const cachedCandidate = cacheKey ? placeImageCache.get(cacheKey) : "";

      abortActiveMediaRequest();

      resetMediaLoadingState();
      mediaEl.hidden = false;

      if (!imageUrl) {
        showMediaError("No photo.", {
          canRetry: false
        });
        return;
      }

      const candidates = getPopupImageCandidates(imageUrl, Config.POPUP_IMAGE_MAX_WIDTH_PX);
      const orderedCandidates = buildMediaCandidateList({
        cacheKey,
        cachedCandidate,
        candidates,
        forceRetry
      });
      if (orderedCandidates.length === 0) {
        showMediaError("No photo.", {
          canRetry: true,
          onRetry: () => {
            renderMedia(place, { forceRetry: true });
          }
        });
        return;
      }

      const mediaController = new AbortController();
      activeMediaAbortController = mediaController;

      void loadPopupImageFromCandidates({
        place,
        candidates: orderedCandidates,
        requestToken,
        altText: mediaAlt,
        cacheKey,
        signal: mediaController.signal,
        timeoutMs: PLACE_IMAGE_TIMEOUT_MS
      });
    }

    function activateDeferredMediaSources(rootEl) {
      if (!(rootEl instanceof HTMLElement)) {
        return;
      }
      const videoNodes = rootEl.querySelectorAll("video");
      for (const videoNode of videoNodes) {
        if (!(videoNode instanceof HTMLVideoElement)) {
          continue;
        }
        videoNode.preload = "none";
        const sourceNodes = videoNode.querySelectorAll("source[data-src]");
        let hasDeferredSources = false;
        for (const sourceNode of sourceNodes) {
          if (!(sourceNode instanceof HTMLSourceElement)) {
            continue;
          }
          if (sourceNode.getAttribute("src")) {
            continue;
          }
          const sourceDataSrc = normalizeText(sourceNode.dataset.src, "");
          if (!sourceDataSrc) {
            continue;
          }
          sourceNode.setAttribute("src", sourceDataSrc);
          hasDeferredSources = true;
        }
        if (!videoNode.getAttribute("src")) {
          const videoDataSrc = normalizeText(videoNode.dataset.src, "");
          if (videoDataSrc) {
            videoNode.setAttribute("src", videoDataSrc);
            hasDeferredSources = true;
          }
        }
        if (hasDeferredSources) {
          try {
            videoNode.load();
          } catch (_error) {
            // No-op: browser may block load() for inactive media elements.
          }
        }
      }
    }

    function releaseDeferredMediaSources(rootEl) {
      if (!(rootEl instanceof HTMLElement)) {
        return;
      }
      const videoNodes = rootEl.querySelectorAll("video");
      for (const videoNode of videoNodes) {
        if (!(videoNode instanceof HTMLVideoElement)) {
          continue;
        }

        try {
          videoNode.pause();
        } catch (_error) {
          // No-op.
        }
        videoNode.preload = "none";

        const directSrc = normalizeText(videoNode.getAttribute("src"), "");
        if (directSrc && !normalizeText(videoNode.dataset.src, "")) {
          videoNode.dataset.src = directSrc;
        }
        videoNode.removeAttribute("src");

        const sourceNodes = videoNode.querySelectorAll("source");
        for (const sourceNode of sourceNodes) {
          if (!(sourceNode instanceof HTMLSourceElement)) {
            continue;
          }
          const sourceSrc = normalizeText(sourceNode.getAttribute("src"), "");
          if (sourceSrc && !normalizeText(sourceNode.dataset.src, "")) {
            sourceNode.dataset.src = sourceSrc;
          }
          sourceNode.removeAttribute("src");
        }

        try {
          videoNode.load();
        } catch (_error) {
          // No-op.
        }
      }
    }

    function resetMediaLoadingState() {
      clearMediaRetryAction();
      mediaEl.classList.remove("is-ready", "is-error");
      mediaEl.classList.add("is-loading");
      mediaSkeletonEl.hidden = false;
      mediaErrorEl.hidden = true;
      mediaErrorEl.textContent = "";
      imageEl.classList.remove("is-ready");
      imageEl.removeAttribute("src");
      imageEl.removeAttribute("srcset");
      imageEl.removeAttribute("sizes");
      imageEl.alt = "";
      imageEl.referrerPolicy = "strict-origin-when-cross-origin";
      imageEl.decoding = "async";
      imageEl.loading = "lazy";
      imageEl.fetchPriority = "low";
      imageEl.width = 1200;
      imageEl.height = 675;
      imageEl.style.aspectRatio = "16 / 9";
    }

    function showMediaError(message, options = {}) {
      const {
        canRetry = false,
        onRetry = null
      } = options;

      clearMediaRetryAction();
      mediaEl.classList.remove("is-loading", "is-ready");
      mediaEl.classList.add("is-error");
      mediaSkeletonEl.hidden = true;
      mediaErrorEl.hidden = false;
      mediaErrorEl.replaceChildren();
      imageEl.classList.remove("is-ready");
      imageEl.removeAttribute("src");
      imageEl.removeAttribute("srcset");
      imageEl.removeAttribute("sizes");
      imageEl.alt = "";

      const messageEl = document.createElement("span");
      messageEl.className = "popup-card__media-fallback-text";
      messageEl.textContent = normalizeText(message, "No photo.");
      mediaErrorEl.append(messageEl);

      if (canRetry && typeof onRetry === "function") {
        mediaRetryButtonEl = document.createElement("button");
        mediaRetryButtonEl.type = "button";
        mediaRetryButtonEl.className = "app-btn app-btn--ghost popup-card__media-retry";
        mediaRetryButtonEl.textContent = "Retry";
        mediaRetryClickHandler = () => {
          onRetry();
        };
        mediaRetryButtonEl.addEventListener("click", mediaRetryClickHandler);
        mediaErrorEl.append(mediaRetryButtonEl);
      }
    }

    function clearMediaRetryAction() {
      if (mediaRetryButtonEl && mediaRetryClickHandler) {
        mediaRetryButtonEl.removeEventListener("click", mediaRetryClickHandler);
      }
      mediaRetryButtonEl = null;
      mediaRetryClickHandler = null;
    }

    function abortActiveMediaRequest() {
      if (!activeMediaAbortController) {
        return;
      }
      activeMediaAbortController.abort();
      activeMediaAbortController = null;
    }

    function settleMediaRequest(signal) {
      if (
        activeMediaAbortController &&
        activeMediaAbortController.signal === signal
      ) {
        activeMediaAbortController = null;
      }
    }

    async function loadPopupImageFromCandidates(params) {
      const {
        place,
        candidates,
        requestToken,
        altText,
        cacheKey = "",
        signal = null,
        timeoutMs = PLACE_IMAGE_TIMEOUT_MS
      } = params;
      if (!Array.isArray(candidates) || candidates.length === 0) {
        if (requestToken === mediaRequestToken && isOpen) {
          showMediaError("No photo.", {
            canRetry: isValidPlace(place),
            onRetry: () => {
              if (!isValidPlace(place)) {
                return;
              }
              renderMedia(place, { forceRetry: true });
            }
          });
        }
        settleMediaRequest(signal);
        return;
      }

      let timeoutFailed = false;
      const loadDeadlineAt = Date.now() + Math.max(
        300,
        Number(timeoutMs) > 0 ? Number(timeoutMs) : PLACE_IMAGE_TIMEOUT_MS
      );
      for (const candidateUrl of candidates) {
        const timeoutLeftMs = Math.max(250, loadDeadlineAt - Date.now());
        if (timeoutLeftMs <= 250 && Date.now() >= loadDeadlineAt) {
          timeoutFailed = true;
          break;
        }
        const result = await loadPlaceImage({
          url: candidateUrl,
          signal,
          timeoutMs: timeoutLeftMs
        });
        if (result.status === "aborted") {
          settleMediaRequest(signal);
          return;
        }

        if (requestToken !== mediaRequestToken || !isOpen) {
          settleMediaRequest(signal);
          return;
        }

        if (result.status === "ok") {
          imageSuccessCache.add(candidateUrl);
          clearBadImageUrl(candidateUrl);
          if (cacheKey) {
            placeImageCache.set(cacheKey, candidateUrl);
          }

          imageEl.src = candidateUrl;
          imageEl.alt = altText;
          imageEl.classList.add("is-ready");
          mediaEl.classList.remove("is-loading", "is-error");
          mediaEl.classList.add("is-ready");
          mediaSkeletonEl.hidden = true;
          mediaErrorEl.hidden = true;
          invalidatePopupTracking();
          updatePosition({ forceSnap: false, forceMeasure: true });
          settleMediaRequest(signal);
          return;
        }

        if (result.status === "timeout") {
          timeoutFailed = true;
          markBadImageUrl(candidateUrl);
        } else if (result.status === "error") {
          markBadImageUrl(candidateUrl);
        }
      }

      if (requestToken === mediaRequestToken && isOpen) {
        showMediaError(
          timeoutFailed
            ? "Photo is taking too long to load."
            : "Photo failed to load.",
          {
            canRetry: isValidPlace(place),
            onRetry: () => {
              if (!isValidPlace(place)) {
                return;
              }
              renderMedia(place, { forceRetry: true });
            }
          }
        );
        invalidatePopupTracking();
        updatePosition({ forceSnap: false, forceMeasure: true });
      }
      settleMediaRequest(signal);
    }

    function buildMediaCandidateList(params) {
      const {
        cacheKey = "",
        cachedCandidate = "",
        candidates = [],
        forceRetry = false
      } = params;
      pruneExpiredBadImageCache();

      const orderedCandidates = [];
      if (cachedCandidate) {
        orderedCandidates.push(cachedCandidate);
      }
      for (const candidate of Array.isArray(candidates) ? candidates : []) {
        if (!orderedCandidates.includes(candidate)) {
          orderedCandidates.push(candidate);
        }
      }

      orderedCandidates.sort((left, right) => {
        const leftScore = imageSuccessCache.has(left) ? 0 : 1;
        const rightScore = imageSuccessCache.has(right) ? 0 : 1;
        return leftScore - rightScore;
      });

      if (forceRetry) {
        if (cacheKey && cachedCandidate) {
          clearBadImageUrl(cachedCandidate);
        }
        return orderedCandidates;
      }

      return orderedCandidates.filter((candidateUrl) => !isBadImageUrlCached(candidateUrl));
    }

    function pruneExpiredBadImageCache() {
      if (badImageUrlCache.size === 0) {
        return;
      }
      const now = Date.now();
      for (const [url, expiresAt] of badImageUrlCache.entries()) {
        if (!Number.isFinite(expiresAt) || expiresAt <= now) {
          badImageUrlCache.delete(url);
        }
      }
    }

    function isBadImageUrlCached(url) {
      const safeUrl = normalizeText(url, "");
      if (!safeUrl) {
        return false;
      }
      const expiresAt = badImageUrlCache.get(safeUrl);
      if (!Number.isFinite(expiresAt)) {
        return false;
      }
      if (expiresAt <= Date.now()) {
        badImageUrlCache.delete(safeUrl);
        return false;
      }
      return true;
    }

    function markBadImageUrl(url) {
      const safeUrl = normalizeText(url, "");
      if (!safeUrl) {
        return;
      }
      badImageUrlCache.set(safeUrl, Date.now() + PLACE_IMAGE_BAD_CACHE_TTL_MS);
    }

    function clearBadImageUrl(url) {
      const safeUrl = normalizeText(url, "");
      if (!safeUrl) {
        return;
      }
      badImageUrlCache.delete(safeUrl);
    }

    function loadPlaceImage(params = {}) {
      const {
        url = "",
        signal = null,
        timeoutMs = PLACE_IMAGE_TIMEOUT_MS
      } = params;
      const safeUrl = normalizeText(url, "");
      if (!safeUrl) {
        return Promise.resolve({ status: "error" });
      }
      if (signal?.aborted) {
        return Promise.resolve({ status: "aborted" });
      }

      return new Promise((resolve) => {
        const loader = new Image();
        let settled = false;
        let timeoutId = null;
        const settle = (status) => {
          if (settled) {
            return;
          }
          settled = true;
          loader.onload = null;
          loader.onerror = null;
          if (signal) {
            signal.removeEventListener("abort", onAbort);
          }
          if (timeoutId) {
            window.clearTimeout(timeoutId);
            timeoutId = null;
          }
          resolve({
            status,
            blobUrl: "",
            loadedUrl: status === "ok" ? safeUrl : ""
          });
        };
        const onAbort = () => {
          loader.src = "";
          settle("aborted");
        };

        loader.decoding = "async";
        loader.loading = "eager";
        loader.fetchPriority = "low";
        loader.referrerPolicy = "strict-origin-when-cross-origin";
        loader.onload = () => {
          settle("ok");
        };
        loader.onerror = () => {
          settle("error");
        };

        if (signal) {
          signal.addEventListener("abort", onAbort, { once: true });
        }
        const safeTimeout = Number(timeoutMs) > 0 ? Number(timeoutMs) : PLACE_IMAGE_TIMEOUT_MS;
        timeoutId = window.setTimeout(() => {
          loader.src = "";
          settle("timeout");
        }, safeTimeout);
        loader.src = safeUrl;
      });
    }
  }
  function createPlacePopupApi(options = {}) {
    return createPopupController(options);
  }

  window.WorldAtlasPopup = window.WorldAtlasPopup || {};
  window.WorldAtlasPopup.createPlacePopupApi = createPlacePopupApi;
})();
