/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/* eslint-env mozilla/frame-script */

"use strict";

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;
Cu.import("resource://gre/modules/Services.jsm");

const ONBOARDING_CSS_URL = "resource://onboarding/onboarding.css";
const ABOUT_HOME_URL = "about:home";
const ABOUT_NEWTAB_URL = "about:newtab";
const BUNDLE_URI = "chrome://onboarding/locale/onboarding.properties";
const UITOUR_JS_URI = "resource://onboarding/lib/UITour-lib.js";
const TOUR_AGENT_JS_URI = "resource://onboarding/onboarding-tour-agent.js";
const BRAND_SHORT_NAME = Services.strings
                     .createBundle("chrome://branding/locale/brand.properties")
                     .GetStringFromName("brandShortName");
const PROMPT_COUNT_PREF = "browser.onboarding.notification.prompt-count";
const NOTIFICATION_FINISHED_PREF = "browser.onboarding.notification.finished";
const ONBOARDING_DIALOG_ID = "onboarding-overlay-dialog";
const ONBOARDING_MIN_WIDTH_PX = 960;
const SPEECH_BUBBLE_MIN_WIDTH_PX = 1130;
const SPEECH_BUBBLE_NEWTOUR_STRING_ID = "onboarding.overlay-icon-tooltip2";
const SPEECH_BUBBLE_UPDATETOUR_STRING_ID = "onboarding.overlay-icon-tooltip-updated2";
const ICON_STATE_WATERMARK = "watermark";
const ICON_STATE_DEFAULT = "default";
/**
 * Add any number of tours, key is the tourId, value should follow the format below
 * "tourId": { // The short tour id which could be saved in pref
 *   // The unique tour id
 *   id: "onboarding-tour-addons",
 *   // (optional) mark tour as complete instantly when the user enters the tour
 *   instantComplete: false,
 *   // The string id of tour name which would be displayed on the navigation bar
 *   tourNameId: "onboarding.tour-addon",
 *   // The method returing strings used on tour notification
 *   getNotificationStrings(bundle):
 *     - title: // The string of tour notification title
 *     - message: // The string of tour notification message
 *     - button: // The string of tour notification action button title
 *   // Return a div appended with elements for this tours.
 *   // Each tour should contain the following 3 sections in the div:
 *   // .onboarding-tour-description, .onboarding-tour-content, .onboarding-tour-button-container.
 *   // If there was a .onboarding-tour-action-button present and was clicked, tour would be marked as completed.
 *   getPage() {},
 * },
 **/
var onboardingTourset = {
  "private": {
    id: "onboarding-tour-private-browsing",
    tourNameId: "onboarding.tour-private-browsing",
    getNotificationStrings(bundle) {
      return {
        title: bundle.GetStringFromName("onboarding.notification.onboarding-tour-private-browsing.title"),
        message: bundle.GetStringFromName("onboarding.notification.onboarding-tour-private-browsing.message2"),
        button: bundle.GetStringFromName("onboarding.button.learnMore"),
      };
    },
    getPage(win) {
      let div = win.document.createElement("div");
      div.innerHTML = `
        <section class="onboarding-tour-description">
          <h1 data-l10n-id="onboarding.tour-private-browsing.title2"></h1>
          <p data-l10n-id="onboarding.tour-private-browsing.description3"></p>
        </section>
        <section class="onboarding-tour-content">
          <img src="resource://onboarding/img/figure_private.svg" role="presentation"/>
        </section>
        <aside class="onboarding-tour-button-container">
          <button id="onboarding-tour-private-browsing-button" class="onboarding-tour-action-button" data-l10n-id="onboarding.tour-private-browsing.button"></button>
        </aside>
      `;
      return div;
    },
  },
  "addons": {
    id: "onboarding-tour-addons",
    tourNameId: "onboarding.tour-addons",
    getNotificationStrings(bundle) {
      return {
        title: bundle.GetStringFromName("onboarding.notification.onboarding-tour-addons.title"),
        message: bundle.formatStringFromName("onboarding.notification.onboarding-tour-addons.message", [BRAND_SHORT_NAME], 1),
        button: bundle.GetStringFromName("onboarding.button.learnMore"),
      };
    },
    getPage(win) {
      let div = win.document.createElement("div");
      div.innerHTML = `
        <section class="onboarding-tour-description">
          <h1 data-l10n-id="onboarding.tour-addons.title2"></h1>
          <p data-l10n-id="onboarding.tour-addons.description2"></p>
        </section>
        <section class="onboarding-tour-content">
          <img src="resource://onboarding/img/figure_addons.svg" role="presentation"/>
        </section>
        <aside class="onboarding-tour-button-container">
          <button id="onboarding-tour-addons-button" class="onboarding-tour-action-button" data-l10n-id="onboarding.tour-addons.button"></button>
        </aside>
      `;
      return div;
    },
  },
  "customize": {
    id: "onboarding-tour-customize",
    tourNameId: "onboarding.tour-customize",
    getNotificationStrings(bundle) {
      return {
        title: bundle.GetStringFromName("onboarding.notification.onboarding-tour-customize.title"),
        message: bundle.formatStringFromName("onboarding.notification.onboarding-tour-customize.message", [BRAND_SHORT_NAME], 1),
        button: bundle.GetStringFromName("onboarding.button.learnMore"),
      };
    },
    getPage(win) {
      let div = win.document.createElement("div");
      div.innerHTML = `
        <section class="onboarding-tour-description">
          <h1 data-l10n-id="onboarding.tour-customize.title2"></h1>
          <p data-l10n-id="onboarding.tour-customize.description2"></p>
        </section>
        <section class="onboarding-tour-content">
          <img src="resource://onboarding/img/figure_customize.svg" role="presentation"/>
        </section>
        <aside class="onboarding-tour-button-container">
          <button id="onboarding-tour-customize-button" class="onboarding-tour-action-button" data-l10n-id="onboarding.tour-customize.button"></button>
        </aside>
      `;
      return div;
    },
  },
  "default": {
    id: "onboarding-tour-default-browser",
    instantComplete: true,
    tourNameId: "onboarding.tour-default-browser",
    getNotificationStrings(bundle) {
      return {
        title: bundle.formatStringFromName("onboarding.notification.onboarding-tour-default-browser.title", [BRAND_SHORT_NAME], 1),
        message: bundle.formatStringFromName("onboarding.notification.onboarding-tour-default-browser.message", [BRAND_SHORT_NAME], 1),
        button: bundle.GetStringFromName("onboarding.button.learnMore"),
      };
    },
    getPage(win, bundle) {
      let div = win.document.createElement("div");
      let setFromBackGround = bundle.formatStringFromName("onboarding.tour-default-browser.win7.button", [BRAND_SHORT_NAME], 1);
      let setFromPanel = bundle.GetStringFromName("onboarding.tour-default-browser.button");
      let isDefaultMessage = bundle.GetStringFromName("onboarding.tour-default-browser.is-default.message");
      let isDefault2ndMessage = bundle.formatStringFromName("onboarding.tour-default-browser.is-default.2nd-message", [BRAND_SHORT_NAME], 1);
      // eslint-disable-next-line no-unsanitized/property
      div.innerHTML = `
        <section class="onboarding-tour-description">
          <h1 data-l10n-id="onboarding.tour-default-browser.title2"></h1>
          <p data-l10n-id="onboarding.tour-default-browser.description2"></p>
        </section>
        <section class="onboarding-tour-content">
          <img src="resource://onboarding/img/figure_default.svg" role="presentation"/>
        </section>
        <aside class="onboarding-tour-button-container">
          <button id="onboarding-tour-default-browser-button" class="onboarding-tour-action-button"
            data-bg="${setFromBackGround}" data-panel="${setFromPanel}"></button>
          <div id="onboarding-tour-is-default-browser-msg" class="onboarding-hidden">${isDefaultMessage}<br/>${isDefault2ndMessage}</div>
        </aside>
      `;

      div.addEventListener("beforeshow", () => {
        win.document.dispatchEvent(new Event("Agent:CanSetDefaultBrowserInBackground"));
      });
      return div;
    },
  },
  "sync": {
    id: "onboarding-tour-sync",
    instantComplete: true,
    tourNameId: "onboarding.tour-sync2",
    getNotificationStrings(bundle) {
      return {
        title: bundle.GetStringFromName("onboarding.notification.onboarding-tour-sync.title"),
        message: bundle.GetStringFromName("onboarding.notification.onboarding-tour-sync.message"),
        button: bundle.GetStringFromName("onboarding.button.learnMore"),
      };
    },
    getPage(win, bundle) {
      const STATE_LOGOUT = "logged-out";
      const STATE_LOGIN = "logged-in";
      let div = win.document.createElement("div");
      div.dataset.loginState = STATE_LOGOUT;
      // The email validation pattern used in the form comes from IETF rfc5321,
      // which is identical to server-side checker of Firefox Account. See
      // discussion in https://bugzilla.mozilla.org/show_bug.cgi?id=1378770#c6
      // for detail.
      let emailRegex = "^[\\w.!#$%&’*+\\/=?^`{|}~-]{1,64}@[a-z\\d](?:[a-z\\d-]{0,253}[a-z\\d])?(?:\\.[a-z\\d](?:[a-z\\d-]{0,253}[a-z\\d])?)+$";
      div.innerHTML = `
        <section class="onboarding-tour-description">
          <h1 data-l10n-id="onboarding.tour-sync.title2" class="show-on-logged-out"></h1>
          <p data-l10n-id="onboarding.tour-sync.description2" class="show-on-logged-out"></p>
          <h1 data-l10n-id="onboarding.tour-sync.logged-in.title" class="show-on-logged-in"></h1>
          <p data-l10n-id="onboarding.tour-sync.logged-in.description" class="show-on-logged-in"></p>
        </section>
        <section class="onboarding-tour-content">
          <form class="show-on-logged-out">
            <h3 data-l10n-id="onboarding.tour-sync.form.title"></h3>
            <p data-l10n-id="onboarding.tour-sync.form.description"></p>
            <input id="onboarding-tour-sync-email-input" type="email" required="true"></input><br />
            <button id="onboarding-tour-sync-button" class="onboarding-tour-action-button" data-l10n-id="onboarding.tour-sync.button"></button>
          </form>
          <img src="resource://onboarding/img/figure_sync.svg" role="presentation"/>
        </section>
        <aside class="onboarding-tour-button-container show-on-logged-in">
          <button id="onboarding-tour-sync-connect-device-button" class="onboarding-tour-action-button" data-l10n-id="onboarding.tour-sync.connect-device.button"></button>
        </aside>
      `;
      let emailInput = div.querySelector("#onboarding-tour-sync-email-input");
      emailInput.placeholder =
        bundle.GetStringFromName("onboarding.tour-sync.email-input.placeholder");
      emailInput.pattern = emailRegex;

      div.addEventListener("beforeshow", () => {
        function loginStatusListener(msg) {
          removeMessageListener("Onboarding:ResponseLoginStatus", loginStatusListener);
          div.dataset.loginState = msg.data.isLoggedIn ? STATE_LOGIN : STATE_LOGOUT;
        }
        sendMessageToChrome("get-login-status");
        addMessageListener("Onboarding:ResponseLoginStatus", loginStatusListener);
      });

      return div;
    },
  },
  "library": {
    id: "onboarding-tour-library",
    tourNameId: "onboarding.tour-library",
    getNotificationStrings(bundle) {
      return {
        title: bundle.GetStringFromName("onboarding.notification.onboarding-tour-library.title"),
        message: bundle.formatStringFromName("onboarding.notification.onboarding-tour-library.message", [BRAND_SHORT_NAME], 1),
        button: bundle.GetStringFromName("onboarding.button.learnMore"),
      };
    },
    getPage(win) {
      let div = win.document.createElement("div");
      div.innerHTML = `
        <section class="onboarding-tour-description">
          <h1 data-l10n-id="onboarding.tour-library.title"></h1>
          <p data-l10n-id="onboarding.tour-library.description2"></p>
        </section>
        <section class="onboarding-tour-content">
          <img src="resource://onboarding/img/figure_library.svg" role="presentation"/>
        </section>
        <aside class="onboarding-tour-button-container">
          <button id="onboarding-tour-library-button" class="onboarding-tour-action-button" data-l10n-id="onboarding.tour-library.button2"></button>
        </aside>
      `;
      return div;
    },
  },
  "singlesearch": {
    id: "onboarding-tour-singlesearch",
    tourNameId: "onboarding.tour-singlesearch",
    getNotificationStrings(bundle) {
      return {
        title: bundle.GetStringFromName("onboarding.notification.onboarding-tour-singlesearch.title"),
        message: bundle.GetStringFromName("onboarding.notification.onboarding-tour-singlesearch.message"),
        button: bundle.GetStringFromName("onboarding.button.learnMore"),
      };
    },
    getPage(win, bundle) {
      let div = win.document.createElement("div");
      div.innerHTML = `
        <section class="onboarding-tour-description">
          <h1 data-l10n-id="onboarding.tour-singlesearch.title"></h1>
          <p data-l10n-id="onboarding.tour-singlesearch.description"></p>
        </section>
        <section class="onboarding-tour-content">
          <img src="resource://onboarding/img/figure_singlesearch.svg" role="presentation"/>
        </section>
        <aside class="onboarding-tour-button-container">
          <button id="onboarding-tour-singlesearch-button" class="onboarding-tour-action-button" data-l10n-id="onboarding.tour-singlesearch.button"></button>
        </aside>
      `;
      return div;
    },
  },
  "performance": {
    id: "onboarding-tour-performance",
    instantComplete: true,
    tourNameId: "onboarding.tour-performance",
    getNotificationStrings(bundle) {
      return {
        title: bundle.GetStringFromName("onboarding.notification.onboarding-tour-performance.title"),
        message: bundle.formatStringFromName("onboarding.notification.onboarding-tour-performance.message", [BRAND_SHORT_NAME], 1),
        button: bundle.GetStringFromName("onboarding.button.learnMore"),
      };
    },
    getPage(win, bundle) {
      let div = win.document.createElement("div");
      div.innerHTML = `
        <section class="onboarding-tour-description">
          <h1 data-l10n-id="onboarding.tour-performance.title"></h1>
          <p data-l10n-id="onboarding.tour-performance.description"></p>
        </section>
        <section class="onboarding-tour-content">
          <img src="resource://onboarding/img/figure_performance.svg" role="presentation"/>
        </section>
      `;
      return div;
    },
  },
  "screenshots": {
    id: "onboarding-tour-screenshots",
    tourNameId: "onboarding.tour-screenshots",
    getNotificationStrings(bundle) {
      return {
        title: bundle.GetStringFromName("onboarding.notification.onboarding-tour-screenshots.title"),
        message: bundle.formatStringFromName("onboarding.notification.onboarding-tour-screenshots.message", [BRAND_SHORT_NAME], 1),
        button: bundle.GetStringFromName("onboarding.button.learnMore"),
      };
    },
    getPage(win, bundle) {
      let div = win.document.createElement("div");
      // Screenshot tour opens the screenshot page directly, see below a#onboarding-tour-screenshots-button.
      // The screenshots page should be responsible for highlighting the Screenshots button
      div.innerHTML = `
        <section class="onboarding-tour-description">
          <h1 data-l10n-id="onboarding.tour-screenshots.title"></h1>
          <p data-l10n-id="onboarding.tour-screenshots.description"></p>
        </section>
        <section class="onboarding-tour-content">
          <img src="resource://onboarding/img/figure_screenshots.svg" role="presentation"/>
        </section>
        <aside class="onboarding-tour-button-container">
          <a id="onboarding-tour-screenshots-button" class="onboarding-tour-action-button" data-l10n-id="onboarding.tour-screenshots.button"
             href="https://screenshots.firefox.com/#tour" target="_blank"></a>
        </aside>
      `;
      return div;
    },
  },
};

/**
 * @param {String} action the action to ask the chrome to do
 * @param {Array | Object} params the parameters for the action
 */
function sendMessageToChrome(action, params) {
  sendAsyncMessage("Onboarding:OnContentMessage", {
    action, params
  });
}

/**
 * Template code for talking to `PingCentre`
 * @param {Object} data the payload for the telemetry
 */
function telemetry(data) {
   sendMessageToChrome("ping-centre", {data});
}

function registerNewTelemetrySession(data) {
  telemetry(Object.assign(data, {
    type: "onboarding-register-session",
  }));
}

/**
 * The script won't be initialized if we turned off onboarding by
 * setting "browser.onboarding.enabled" to false.
 */
class Onboarding {
  constructor(contentWindow) {
    this.init(contentWindow);
  }

  async init(contentWindow) {
    this._window = contentWindow;
    // session_key is used for telemetry to track the current tab.
    // The number will renew after reloading the page.
    this._session_key = Date.now();
    this._tours = [];
    this._tourType = Services.prefs.getStringPref("browser.onboarding.tour-type", "update");

    let tourIds = this._getTourIDList();
    tourIds.forEach(tourId => {
      if (onboardingTourset[tourId]) {
        this._tours.push(onboardingTourset[tourId]);
      }
    });

    if (this._tours.length === 0) {
      return;
    }

    // We want to create and append elements after CSS is loaded so
    // no flash of style changes and no additional reflow.
    await this._loadCSS();
    this._bundle = Services.strings.createBundle(BUNDLE_URI);

    this._loadJS(UITOUR_JS_URI);

    this.uiInitialized = false;
    let doc = this._window.document;
    if (doc.hidden) {
      // When the preloaded-browser feature is on,
      // it would preload a hidden about:newtab in the background.
      // We don't want to show onboarding experience in that hidden state.
      let onVisible = () => {
        if (!doc.hidden) {
          doc.removeEventListener("visibilitychange", onVisible);
          this._startUI();
        }
      };
      doc.addEventListener("visibilitychange", onVisible);
    } else {
      this._startUI();
    }
  }

  _startUI() {
    registerNewTelemetrySession({
      page: this._window.location.href,
      session_key: this._session_key,
      tour_type: this._tourType,
    });

    this._window.addEventListener("beforeunload", this);
    this._window.addEventListener("unload", this);
    this._window.addEventListener("resize", this);
    this._resizeTimerId =
      this._window.requestIdleCallback(() => this._resizeUI());
    // start log the onboarding-session when the tab is visible
    telemetry({
      type: "onboarding-session-begin",
      session_key: this._session_key,
    });
  }

  _resizeUI() {
    this._windowWidth = this._window.document.body.getBoundingClientRect().width;
    if (this._windowWidth < ONBOARDING_MIN_WIDTH_PX) {
      // Don't show the overlay UI before we get to a better, responsive design.
      this.destroy();
      return;
    }

    this._initUI();
    if (this._isFirstSession && this._windowWidth >= SPEECH_BUBBLE_MIN_WIDTH_PX) {
      this._overlayIcon.classList.add("onboarding-speech-bubble");
    } else {
      this._overlayIcon.classList.remove("onboarding-speech-bubble");
    }
  }

  _initUI() {
    if (this.uiInitialized) {
      return;
    }
    this.uiInitialized = true;
    this._tourItems = [];
    this._tourPages = [];

    let { body } = this._window.document;
    this._overlayIcon = this._renderOverlayButton();
    this._overlayIcon.addEventListener("click", this);
    this._overlayIcon.addEventListener("keypress", this);
    body.insertBefore(this._overlayIcon, body.firstChild);

    this._overlay = this._renderOverlay();
    this._overlay.addEventListener("click", this);
    this._overlay.addEventListener("keypress", this);
    body.appendChild(this._overlay);

    this._loadJS(TOUR_AGENT_JS_URI);

    this._initPrefObserver();
    this._onIconStateChange(Services.prefs.getStringPref("browser.onboarding.state", ICON_STATE_DEFAULT));

    // Doing tour notification takes some effort. Let's do it on idle.
    this._window.requestIdleCallback(() => this.showNotification());
  }

  _getTourIDList() {
    let tours = Services.prefs.getStringPref(`browser.onboarding.${this._tourType}tour`, "");
    return tours.split(",").filter(tourId => tourId !== "").map(tourId => tourId.trim());
  }

  _initPrefObserver() {
    if (this._prefsObserved) {
      return;
    }

    this._prefsObserved = new Map();
    this._prefsObserved.set("browser.onboarding.state", () => {
      this._onIconStateChange(Services.prefs.getStringPref("browser.onboarding.state", ICON_STATE_DEFAULT));
    });
    this._tours.forEach(tour => {
      let tourId = tour.id;
      this._prefsObserved.set(`browser.onboarding.tour.${tourId}.completed`, () => {
        this.markTourCompletionState(tourId);
        this._checkWatermarkByTours();
      });
    });
    for (let [name, callback] of this._prefsObserved) {
      Services.prefs.addObserver(name, callback);
    }
  }

  _checkWatermarkByTours() {
    let tourDone = this._tours.every(tour => this.isTourCompleted(tour.id));
    if (tourDone) {
      sendMessageToChrome("set-prefs", [{
        name: "browser.onboarding.state",
        value: ICON_STATE_WATERMARK
      }]);
    }
  }

  _clearPrefObserver() {
    if (this._prefsObserved) {
      for (let [name, callback] of this._prefsObserved) {
        Services.prefs.removeObserver(name, callback);
      }
      this._prefsObserved = null;
    }
  }

  /**
   * Find a tour that should be selected. It is either a first tour that was not
   * yet complete or the first one in the tab list.
   */
  get _firstUncompleteTour() {
    return this._tours.find(tour => !this.isTourCompleted(tour.id)) ||
           this._tours[0];
  }

  /*
   * Return currently showing tour navigation item
   */
  get _activeTourId() {
    // We are doing lazy load so there might be no items.
    if (!this._tourItems) {
      return "";
    }

    let tourItem = this._tourItems.find(item => item.classList.contains("onboarding-active"));
    return tourItem ? tourItem.id : "";
  }

  /**
   * Return current logo state as "logo" or "watermark".
   */
  get _logoState() {
    return this._overlayIcon.classList.contains("onboarding-watermark") ?
      "watermark" : "logo";
  }

  /**
   * Return current speech bubble state as "bubble", "dot" or "hide".
   */
  get _bubbleState() {
    let state;
    if (this._overlayIcon.classList.contains("onboarding-watermark")) {
      state = "hide";
    } else if (this._overlayIcon.classList.contains("onboarding-speech-bubble")) {
      state = "bubble";
    } else {
      state = "dot";
    }
    return state;
  }

  /**
   * Return current notification state as "show", "hide" or "finished".
   */
  get _notificationState() {
    if (this._notificationCachedState === "finished") {
      return this._notificationCachedState;
    }

    if (Services.prefs.getBoolPref(NOTIFICATION_FINISHED_PREF, false)) {
      this._notificationCachedState = "finished";
    } else if (this._notification) {
      this._notificationCachedState = "show";
    } else {
      // we know it is in the hidden state if there's no notification bar
      this._notificationCachedState = "hide";
    }

    return this._notificationCachedState;
  }

  /**
   * Return current notification prompt count.
   */
  get _notificationPromptCount() {
    return Services.prefs.getIntPref(PROMPT_COUNT_PREF, 0);
  }

  /**
   * Return current screen width and round it up to the nearest 50 pixels.
   * Collecting rounded values reduces the risk that this could be used to
   * derive a unique user identifier
   */
  get _windowWidthRounded() {
    return Math.round(this._windowWidth / 50) * 50;
  }

  handleClick(target) {
    let { id, classList } = target;
    // Only containers receive pointer events in onboarding tour tab list,
    // actual semantic tab is their first child.
    if (classList.contains("onboarding-tour-item-container")) {
      ({ id, classList } = target.firstChild);
    }

    switch (id) {
      case "onboarding-overlay-button":
        telemetry({
          type: "onboarding-logo-click",
          bubble_state: this._bubbleState,
          logo_state: this._logoState,
          notification_state: this._notificationState,
          session_key: this._session_key,
          width: this._windowWidthRounded,
        });
        this.showOverlay();
        this.gotoPage(this._firstUncompleteTour.id);
        break;
      case "onboarding-skip-tour-button":
        this.hideNotification();
        this.hideOverlay();
        this.skipTour();
        break;
      case "onboarding-overlay-close-btn":
      // If the clicking target is directly on the outer-most overlay,
      // that means clicking outside the tour content area.
      // Let's toggle the overlay.
      case "onboarding-overlay":
        let eventName = id === "onboarding-overlay-close-btn" ?
          "overlay-close-button-click" : "overlay-close-outside-click";
        telemetry({
          type: eventName,
          current_tour_id: this._activeTourId,
          session_key: this._session_key,
          target_tour_id: this._activeTourId,
          width: this._windowWidthRounded,
        });
        this.hideOverlay();
        break;
      case "onboarding-notification-close-btn":
        let currentTourId = this._notificationBar.dataset.targetTourId;
        // should trigger before notification-session event is sent
        telemetry({
          type: "notification-close-button-click",
          bubble_state: this._bubbleState,
          current_tour_id: currentTourId,
          logo_state: this._logoState,
          notification_impression: this._notificationPromptCount,
          notification_state: this._notificationState,
          session_key: this._session_key,
          target_tour_id: currentTourId,
          width: this._windowWidthRounded,
        });
        this.hideNotification();
        this._removeTourFromNotificationQueue(currentTourId);
        break;
      case "onboarding-notification-action-btn":
        let tourId = this._notificationBar.dataset.targetTourId;
        telemetry({
          type: "notification-cta-click",
          bubble_state: this._bubbleState,
          current_tour_id: tourId,
          logo_state: this._logoState,
          notification_impression: this._notificationPromptCount,
          notification_state: this._notificationState,
          session_key: this._session_key,
          target_tour_id: tourId,
          width: this._windowWidthRounded,
        });
        this.showOverlay();
        this.gotoPage(tourId);
        this._removeTourFromNotificationQueue(tourId);
        break;
    }
    if (classList.contains("onboarding-tour-item")) {
      telemetry({
        type: "overlay-nav-click",
        current_tour_id: this._activeTourId,
        session_key: this._session_key,
        target_tour_id: id,
        width: this._windowWidthRounded,
      });
      this.gotoPage(id);
      // Keep focus (not visible) on current item for potential keyboard
      // navigation.
      target.focus();
    } else if (classList.contains("onboarding-tour-action-button")) {
      let activeTourId = this._activeTourId;
      this.setToursCompleted([ activeTourId ]);
      telemetry({
        type: "overlay-cta-click",
        current_tour_id: activeTourId,
        session_key: this._session_key,
        target_tour_id: activeTourId,
        width: this._windowWidthRounded,
      });
    }
  }

  /**
   * Wrap keyboard focus within the dialog.
   * When moving forward, focus on the first element when the current focused
   * element is the last one.
   * When moving backward, focus on the last element when the current focused
   * element is the first one.
   * Do nothing if focus is moving in the middle of the list of dialog's focusable
   * elements.
   *
   * @param  {DOMNode} current  currently focused element
   * @param  {Boolean} back     direction
   * @return {DOMNode}          newly focused element if any
   */
  wrapMoveFocus(current, back) {
    let elms = [...this._dialog.querySelectorAll(
      `button, input[type="checkbox"], input[type="email"], [tabindex="0"]`)];
    let next;
    if (back) {
      if (elms.indexOf(current) === 0) {
        next = elms[elms.length - 1];
        next.focus();
      }
    } else if (elms.indexOf(current) === elms.length - 1) {
      next = elms[0];
      next.focus();
    }
    return next;
  }

  handleKeypress(event) {
    let { target, key, shiftKey } = event;

    if (target === this._overlayIcon) {
      if ([" ", "Enter"].includes(key)) {
        // Remember that the dialog was opened with a keyboard.
        this._overlayIcon.dataset.keyboardFocus = true;
        this.handleClick(target);
        event.preventDefault();
      }
      return;
    }

    // Currently focused item could be tab container if previous navigation was done
    // via mouse.
    if (target.classList.contains("onboarding-tour-item-container")) {
      target = target.firstChild;
    }
    let targetIndex;
    switch (key) {
      case " ":
      case "Enter":
        // Assume that the handle function should be identical for keyboard
        // activation if there is a click handler for the target.
        if (target.classList.contains("onboarding-tour-item")) {
          this.handleClick(target);
          target.focus();
        }
        break;
      case "ArrowUp":
        // Go to and focus on the previous tab if it's available.
        targetIndex = this._tourItems.indexOf(target);
        if (targetIndex > 0) {
          let previous = this._tourItems[targetIndex - 1];
          this.handleClick(previous);
          previous.focus();
        }
        event.preventDefault();
        break;
      case "ArrowDown":
        // Go to and focus on the next tab if it's available.
        targetIndex = this._tourItems.indexOf(target);
        if (targetIndex > -1 && targetIndex < this._tourItems.length - 1) {
          let next = this._tourItems[targetIndex + 1];
          this.handleClick(next);
          next.focus();
        }
        event.preventDefault();
        break;
      case "Escape":
        this.hideOverlay();
        break;
      case "Tab":
        let next = this.wrapMoveFocus(target, shiftKey);
        // If focus was wrapped, prevent Tab key default action.
        if (next) {
          event.preventDefault();
        }
        break;
      default:
        break;
    }
    event.stopPropagation();
  }

  handleEvent(evt) {
    switch (evt.type) {
      case "beforeunload":
        // To make sure the telemetry pings are sent,
        // we send "onboarding-session-end" ping as well as
        // "overlay-session-end" and "notification-session-end" ping
        // (by hiding the overlay and notificaiton) on beforeunload.
        this.hideOverlay();
        this.hideNotification();
        telemetry({
          type: "onboarding-session-end",
          session_key: this._session_key,
        });
        break;
      case "unload":
        // Notice: Cannot do `destroy` on beforeunload, must do on unload.
        // Otherwise, we would hit the docShell leak in the test.
        // See Bug 1413830#c190 and Bug 1429652 for details.
        this.destroy();
        break;
      case "resize":
        this._window.cancelIdleCallback(this._resizeTimerId);
        this._resizeTimerId =
          this._window.requestIdleCallback(() => this._resizeUI());
        break;
      case "keypress":
        this.handleKeypress(evt);
        break;
      case "click":
        this.handleClick(evt.target);
        break;
      default:
        break;
    }
  }

  destroy() {
    if (!this.uiInitialized) {
      return;
    }
    this.uiInitialized = false;

    this._overlayIcon.dispatchEvent(new this._window.CustomEvent("Agent:Destroy"));

    this._clearPrefObserver();
    this._overlayIcon.remove();
    if (this._overlay) {
      // send overlay-session telemetry
      this.hideOverlay();
      this._overlay.remove();
    }
    if (this._notificationBar) {
      // send notification-session telemetry
      this.hideNotification();
      this._notificationBar.remove();
    }
    this._tourItems = this._tourPages =
    this._overlayIcon = this._overlay = this._notificationBar = null;
  }

  _onIconStateChange(state) {
    switch (state) {
      case ICON_STATE_DEFAULT:
        this._overlayIcon.classList.remove("onboarding-watermark");
        break;
      case ICON_STATE_WATERMARK:
        this._overlayIcon.classList.add("onboarding-watermark");
        break;
    }
    return true;
  }

  showOverlay() {
    if (this._tourItems.length == 0) {
      // Lazy loading until first toggle.
      this._loadTours(this._tours);
    }

    if (this._overlay && !this._overlay.classList.contains("onboarding-opened")) {
      this.hideNotification();
      this._overlay.classList.add("onboarding-opened");
      this.toggleModal(true);
      telemetry({
        type: "overlay-session-begin",
        session_key: this._session_key,
      });
    }
  }

  hideOverlay() {
    if (this._overlay && this._overlay.classList.contains("onboarding-opened")) {
      this._overlay.classList.remove("onboarding-opened");
      this.toggleModal(false);
      telemetry({
        type: "overlay-session-end",
        session_key: this._session_key,
      });
    }
  }

  /**
   * Set modal dialog state and properties for accessibility purposes.
   * @param  {Boolean} opened  whether the dialog is opened or closed.
   */
  toggleModal(opened) {
    let { document: doc } = this._window;
    if (opened) {
      // Set aria-hidden to true for the rest of the document.
      [...doc.body.children].forEach(
        child => child.id !== "onboarding-overlay" &&
                 child.setAttribute("aria-hidden", true));
      // When dialog is opened with the keyboard, focus on the first
      // uncomplete tour because it will be the selected tour.
      if (this._overlayIcon.dataset.keyboardFocus) {
        doc.getElementById(this._firstUncompleteTour.id).focus();
      } else {
        // When the dialog is opened with the mouse, focus on the dialog
        // itself to avoid visible keyboard focus styling.
        this._dialog.focus();
      }
    } else {
      // Remove all set aria-hidden attributes.
      [...doc.body.children].forEach(
        child => child.removeAttribute("aria-hidden"));
      // If dialog was opened with a keyboard, set the focus back to the overlay
      // button.
      if (this._overlayIcon.dataset.keyboardFocus) {
        delete this._overlayIcon.dataset.keyboardFocus;
        this._overlayIcon.focus();
      } else {
        this._window.document.activeElement.blur();
      }
    }
  }

  /**
   * Switch to proper tour.
   * @param {String} tourId specify which tour should be switched.
   */
  gotoPage(tourId) {
    let targetPageId = `${tourId}-page`;
    for (let page of this._tourPages) {
      if (page.id === targetPageId) {
        page.style.display = "";
        page.dispatchEvent(new this._window.CustomEvent("beforeshow"));
      } else {
        page.style.display = "none";
      }
    }
    for (let tab of this._tourItems) {
      if (tab.id == tourId) {
        tab.classList.add("onboarding-active");
        tab.setAttribute("aria-selected", true);
        telemetry({
          type: "overlay-current-tour",
          current_tour_id: tourId,
          session_key: this._session_key,
          width: this._windowWidthRounded,
        });

        // Some tours should complete instantly upon showing.
        if (tab.getAttribute("data-instant-complete")) {
          this.setToursCompleted([tourId]);
        }
      } else {
        tab.classList.remove("onboarding-active");
        tab.setAttribute("aria-selected", false);
      }
    }
  }

  isTourCompleted(tourId) {
    return Services.prefs.getBoolPref(`browser.onboarding.tour.${tourId}.completed`, false);
  }

  setToursCompleted(tourIds) {
    let params = [];
    tourIds.forEach(id => {
      if (!this.isTourCompleted(id)) {
        params.push({
          name: `browser.onboarding.tour.${id}.completed`,
          value: true
        });
      }
    });
    if (params.length > 0) {
      sendMessageToChrome("set-prefs", params);
    }
  }

  markTourCompletionState(tourId) {
    // We are doing lazy load so there might be no items.
    if (!this._tourItems || this._tourItems.length === 0) {
      return;
    }

    let completed = this.isTourCompleted(tourId);
    let targetItem = this._tourItems.find(item => item.id == tourId);
    let completedTextId = `onboarding-complete-${tourId}-text`;
    // Accessibility: Text version of the auxiliary information about the tour
    // item completion is provided via an invisible node with an aria-label that
    // the tab is pointing to via aria-described by.
    let completedText = targetItem.querySelector(`#${completedTextId}`);
    if (completed) {
      targetItem.classList.add("onboarding-complete");
      if (!completedText) {
        completedText = this._window.document.createElement("span");
        completedText.id = completedTextId;
        completedText.setAttribute("aria-label",
          this._bundle.GetStringFromName("onboarding.complete"));
        targetItem.appendChild(completedText);
        targetItem.setAttribute("aria-describedby", completedTextId);
      }
    } else {
      targetItem.classList.remove("onboarding-complete");
      targetItem.removeAttribute("aria-describedby");
      if (completedText) {
        completedText.remove();
      }
    }
  }

  get _isFirstSession() {
    // Should only directly return on the "false" case. Consider:
    //   1. On the 1st session, `_firstSession` is true
    //   2. During the 1st session, user resizes window so that the UI is destroyed
    //   3. After the 1st mute session, user resizes window so that the UI is re-init
    if (this._firstSession === false) {
      return false;
    }
    this._firstSession = true;

    // There is a queue, which means we had prompted tour notifications before. Therefore this is not the 1st session.
    if (Services.prefs.prefHasUserValue("browser.onboarding.notification.tour-ids-queue")) {
      this._firstSession = false;
    }

    // When this is set to 0 on purpose, always judge as not the 1st session
    if (Services.prefs.getIntPref("browser.onboarding.notification.mute-duration-on-first-session-ms") === 0) {
      this._firstSession = false;
    }

    return this._firstSession;
  }

  _getLastTourChangeTime() {
    return 1000 * Services.prefs.getIntPref("browser.onboarding.notification.last-time-of-changing-tour-sec", 0);
  }

  _muteNotificationOnFirstSession(lastTourChangeTime) {
    if (!this._isFirstSession) {
      return false;
    }

    if (lastTourChangeTime <= 0) {
      sendMessageToChrome("set-prefs", [{
        name: "browser.onboarding.notification.last-time-of-changing-tour-sec",
        value: Math.floor(Date.now() / 1000)
      }]);
      return true;
    }
    let muteDuration = Services.prefs.getIntPref("browser.onboarding.notification.mute-duration-on-first-session-ms");
    return Date.now() - lastTourChangeTime <= muteDuration;
  }

  _isTimeForNextTourNotification(lastTourChangeTime) {
    let maxCount = Services.prefs.getIntPref("browser.onboarding.notification.max-prompt-count-per-tour");
    if (this._notificationPromptCount >= maxCount) {
      return true;
    }

    let maxTime = Services.prefs.getIntPref("browser.onboarding.notification.max-life-time-per-tour-ms");
    if (lastTourChangeTime && Date.now() - lastTourChangeTime >= maxTime) {
      return true;
    }

    return false;
  }

  _removeTourFromNotificationQueue(tourId) {
    let params = [];
    let queue = this._getNotificationQueue();
    params.push({
      name: "browser.onboarding.notification.tour-ids-queue",
      value: queue.filter(id => id != tourId).join(",")
    });
    params.push({
      name: "browser.onboarding.notification.last-time-of-changing-tour-sec",
      value: 0
    });
    params.push({
      name: "browser.onboarding.notification.prompt-count",
      value: 0
    });
    sendMessageToChrome("set-prefs", params);
  }

  _getNotificationQueue() {
    let queue = "";
    if (Services.prefs.prefHasUserValue("browser.onboarding.notification.tour-ids-queue")) {
      queue = Services.prefs.getStringPref("browser.onboarding.notification.tour-ids-queue");
    } else {
      // For each tour, it only gets 2 chances to prompt with notification
      // (each chance includes 8 impressions or 5-days max life time)
      // if user never interact with it.
      // Assume there are tour #0 ~ #5. Here would form the queue as
      // "#0,#1,#2,#3,#4,#5,#0,#1,#2,#3,#4,#5".
      // Then we would loop through this queue and remove prompted tour from the queue
      // until the queue is empty.
      let ids = this._tours.map(tour => tour.id).join(",");
      queue = `${ids},${ids}`;
      sendMessageToChrome("set-prefs", [{
        name: "browser.onboarding.notification.tour-ids-queue",
        value: queue
      }]);
    }
    return queue ? queue.split(",") : [];
  }

  showNotification() {
    if (this._notificationState === "finished") {
      return;
    }

    let lastTime = this._getLastTourChangeTime();
    if (this._muteNotificationOnFirstSession(lastTime)) {
      return;
    }

    // After the notification mute on the 1st session,
    // we don't want to show the speech bubble by default
    this._overlayIcon.classList.remove("onboarding-speech-bubble");

    let queue = this._getNotificationQueue();
    let totalMaxTime = Services.prefs.getIntPref("browser.onboarding.notification.max-life-time-all-tours-ms");
    if (lastTime && Date.now() - lastTime >= totalMaxTime) {
      // Reach total max life time for all tour notifications.
      // Clear the queue so that we would finish tour notifications below
      queue = [];
    }

    let startQueueLength = queue.length;
    // See if need to move on to the next tour
    if (queue.length > 0 && this._isTimeForNextTourNotification(lastTime)) {
      queue.shift();
    }
    // We don't want to prompt the completed tour.
    while (queue.length > 0 && this.isTourCompleted(queue[0])) {
      queue.shift();
    }

    if (queue.length == 0) {
      sendMessageToChrome("set-prefs", [
        {
          name: NOTIFICATION_FINISHED_PREF,
          value: true
        },
        {
          name: "browser.onboarding.notification.tour-ids-queue",
          value: ""
        },
        {
          name: "browser.onboarding.state",
          value: ICON_STATE_WATERMARK
        }
      ]);
      return;
    }
    let targetTourId = queue[0];
    let targetTour = this._tours.find(tour => tour.id == targetTourId);

    // Show the target tour notification
    this._notificationBar = this._renderNotificationBar();
    this._notificationBar.addEventListener("click", this);
    this._notificationBar.dataset.targetTourId = targetTour.id;
    let notificationStrings = targetTour.getNotificationStrings(this._bundle);
    let actionBtn = this._notificationBar.querySelector("#onboarding-notification-action-btn");
    actionBtn.textContent = notificationStrings.button;
    let tourTitle = this._notificationBar.querySelector("#onboarding-notification-tour-title");
    tourTitle.textContent = notificationStrings.title;
    let tourMessage = this._notificationBar.querySelector("#onboarding-notification-tour-message");
    tourMessage.textContent = notificationStrings.message;
    this._notificationBar.classList.add("onboarding-opened");
    this._window.document.body.appendChild(this._notificationBar);

    let params = [];
    let promptCount = 1;
    if (startQueueLength != queue.length) {
      // We just change tour so update the time, the count and the queue
      params.push({
        name: "browser.onboarding.notification.last-time-of-changing-tour-sec",
        value: Math.floor(Date.now() / 1000)
      });
      params.push({
        name: PROMPT_COUNT_PREF,
        value: promptCount
      });
      params.push({
        name: "browser.onboarding.notification.tour-ids-queue",
        value: queue.join(",")
      });
    } else {
      promptCount = this._notificationPromptCount + 1;
      params.push({
        name: PROMPT_COUNT_PREF,
        value: promptCount
      });
    }
    sendMessageToChrome("set-prefs", params);
    telemetry({
      type: "notification-session-begin",
      session_key: this._session_key
    });
    // since set-perfs is async, pass promptCount directly to avoid gathering the wrong
    // notification_impression.
    telemetry({
      type: "notification-appear",
      bubble_state: this._bubbleState,
      current_tour_id: targetTourId,
      logo_state: this._logoState,
      notification_impression: promptCount,
      notification_state: this._notificationState,
      session_key: this._session_key,
      width: this._windowWidthRounded,
    });
  }

  hideNotification() {
    if (this._notificationBar) {
      if (this._notificationBar.classList.contains("onboarding-opened")) {
        this._notificationBar.classList.remove("onboarding-opened");
        telemetry({
          type: "notification-session-end",
          session_key: this._session_key,
        });
      }
    }
  }

  _renderNotificationBar() {
    let footer = this._window.document.createElement("footer");
    footer.id = "onboarding-notification-bar";
    footer.setAttribute("aria-live", "polite");
    footer.setAttribute("aria-labelledby", "onboarding-notification-tour-title");
    // We use `innerHTML` for more friendly reading.
    // The security should be fine because this is not from an external input.
    footer.innerHTML = `
      <section id="onboarding-notification-message-section" role="presentation">
        <div id="onboarding-notification-tour-icon" role="presentation"></div>
        <div id="onboarding-notification-body" role="presentation">
          <h1 id="onboarding-notification-tour-title"></h1>
          <p id="onboarding-notification-tour-message"></p>
        </div>
        <button id="onboarding-notification-action-btn" class="onboarding-action-button"></button>
      </section>
      <button id="onboarding-notification-close-btn" class="onboarding-close-btn"></button>
    `;

    let closeBtn = footer.querySelector("#onboarding-notification-close-btn");
    closeBtn.setAttribute("title",
      this._bundle.GetStringFromName("onboarding.notification-close-button-tooltip"));
    return footer;
  }

  skipTour() {
    this.setToursCompleted(this._tours.map(tour => tour.id));
    sendMessageToChrome("set-prefs", [
      {
        name: NOTIFICATION_FINISHED_PREF,
        value: true
      },
      {
        name: "browser.onboarding.state",
        value: ICON_STATE_WATERMARK
      }
    ]);
    telemetry({
      type: "overlay-skip-tour",
      current_tour_id: this._activeTourId,
      session_key: this._session_key,
      width: this._windowWidthRounded,
    });
  }

  _renderOverlay() {
    let div = this._window.document.createElement("div");
    div.id = "onboarding-overlay";
    // We use `innerHTML` for more friendly reading.
    // The security should be fine because this is not from an external input.
    div.innerHTML = `
      <div role="dialog" tabindex="-1" aria-labelledby="onboarding-header">
        <header id="onboarding-header"></header>
        <nav>
          <ul id="onboarding-tour-list" role="tablist"></ul>
        </nav>
        <footer id="onboarding-footer"></footer>
        <button id="onboarding-overlay-close-btn" class="onboarding-close-btn"></button>
      </div>
    `;

    this._dialog = div.querySelector(`[role="dialog"]`);
    this._dialog.id = ONBOARDING_DIALOG_ID;
    div.querySelector("#onboarding-header").textContent =
      this._bundle.GetStringFromName("onboarding.overlay-title2");
    // support show/hide skip tour button via pref
    if (!Services.prefs.getBoolPref("browser.onboarding.skip-tour-button.hide", false)) {
      let footer = div.querySelector("#onboarding-footer");
      let skipButton = this._window.document.createElement("button");
      skipButton.id = "onboarding-skip-tour-button";
      skipButton.classList.add("onboarding-action-button");
      skipButton.textContent = this._bundle.GetStringFromName("onboarding.skip-tour-button-label");
      footer.appendChild(skipButton);
    }
    let closeBtn = div.querySelector("#onboarding-overlay-close-btn");
    closeBtn.setAttribute("title",
      this._bundle.GetStringFromName("onboarding.overlay-close-button-tooltip"));
    return div;
  }

  _renderOverlayButton() {
    let button = this._window.document.createElement("button");
    // support customize speech bubble string via pref
    let tooltipStringPrefId = "";
    let defaultTourStringId = "";
    if (this._tourType === "new") {
      tooltipStringPrefId = "browser.onboarding.newtour.tooltip";
      defaultTourStringId = SPEECH_BUBBLE_NEWTOUR_STRING_ID;
    } else {
      tooltipStringPrefId = "browser.onboarding.updatetour.tooltip";
      defaultTourStringId = SPEECH_BUBBLE_UPDATETOUR_STRING_ID;
    }
    let tooltip = "";
    try {
      let tooltipStringId = Services.prefs.getStringPref(tooltipStringPrefId, defaultTourStringId);
      tooltip = this._bundle.formatStringFromName(tooltipStringId, [BRAND_SHORT_NAME], 1);
    } catch (e) {
      Cu.reportError(`the provided ${tooltipStringPrefId} string is in wrong format `, e);
      // fallback to defaultTourStringId to proceed
      tooltip = this._bundle.formatStringFromName(defaultTourStringId, [BRAND_SHORT_NAME], 1);
    }
    button.setAttribute("aria-label", tooltip);
    button.id = "onboarding-overlay-button";
    button.setAttribute("aria-haspopup", true);
    button.setAttribute("aria-controls", `${ONBOARDING_DIALOG_ID}`);
    let defaultImg = this._window.document.createElement("img");
    defaultImg.id = "onboarding-overlay-button-icon";
    defaultImg.setAttribute("role", "presentation");
    defaultImg.src = Services.prefs.getStringPref("browser.onboarding.default-icon-src",
      "chrome://branding/content/icon64.png");
    button.appendChild(defaultImg);
    let watermarkImg = this._window.document.createElement("img");
    watermarkImg.id = "onboarding-overlay-button-watermark-icon";
    watermarkImg.setAttribute("role", "presentation");
    watermarkImg.src = Services.prefs.getStringPref("browser.onboarding.watermark-icon-src",
      "resource://onboarding/img/watermark.svg");
    button.appendChild(watermarkImg);
    return button;
  }

  _loadTours(tours) {
    let itemsFrag = this._window.document.createDocumentFragment();
    let pagesFrag = this._window.document.createDocumentFragment();
    for (let tour of tours) {
      // Create tour navigation items dynamically
      let li = this._window.document.createElement("li");
      // List item should have no semantics. It is just a container for an
      // actual tab.
      li.setAttribute("role", "presentation");
      li.className = "onboarding-tour-item-container";
      // Focusable but not tabbable.
      li.tabIndex = -1;

      let tab = this._window.document.createElement("span");
      tab.id = tour.id;
      tab.textContent = this._bundle.GetStringFromName(tour.tourNameId);
      tab.className = "onboarding-tour-item";
      if (tour.instantComplete) {
        tab.dataset.instantComplete = true;
      }
      tab.tabIndex = 0;
      tab.setAttribute("role", "tab");

      let tourPanelId = `${tour.id}-page`;
      tab.setAttribute("aria-controls", tourPanelId);

      li.appendChild(tab);
      itemsFrag.appendChild(li);
      // Dynamically create tour pages
      let div = tour.getPage(this._window, this._bundle);

      // Do a traverse for elements in the page that need to be localized.
      let l10nElements = div.querySelectorAll("[data-l10n-id]");
      for (let i = 0; i < l10nElements.length; i++) {
        let element = l10nElements[i];
        // We always put brand short name as the first argument for it's the
        // only and frequently used arguments in our l10n case. Rewrite it if
        // other arguments appear.
        element.textContent = this._bundle.formatStringFromName(
                                element.dataset.l10nId, [BRAND_SHORT_NAME], 1);
      }

      div.id = tourPanelId;
      div.classList.add("onboarding-tour-page");
      div.setAttribute("role", "tabpanel");
      div.setAttribute("aria-labelledby", tour.id);
      div.style.display = "none";
      pagesFrag.appendChild(div);
      // Cache elements in arrays for later use to avoid cost of querying elements
      this._tourItems.push(tab);
      this._tourPages.push(div);

      this.markTourCompletionState(tour.id);
    }

    let ul = this._window.document.getElementById("onboarding-tour-list");
    ul.appendChild(itemsFrag);
    let footer = this._window.document.getElementById("onboarding-footer");
    this._dialog.insertBefore(pagesFrag, footer);
  }

  _loadCSS() {
    // Returning a Promise so we can inform caller of loading complete
    // by resolving it.
    return new Promise(resolve => {
      let doc = this._window.document;
      let link = doc.createElement("link");
      link.rel = "stylesheet";
      link.type = "text/css";
      link.href = ONBOARDING_CSS_URL;
      link.addEventListener("load", resolve);
      doc.head.appendChild(link);
    });
  }

  _loadJS(uri) {
    let doc = this._window.document;
    let script = doc.createElement("script");
    script.type = "text/javascript";
    script.src = uri;
    doc.head.appendChild(script);
  }
}

// Load onboarding module only when we enable it.
if (Services.prefs.getBoolPref("browser.onboarding.enabled", false)) {
  addEventListener("load", function onLoad(evt) {
    if (!content || evt.target != content.document) {
      return;
    }

    let window = evt.target.defaultView;
    let location = window.location.href;
    if (location == ABOUT_NEWTAB_URL || location == ABOUT_HOME_URL) {
      // We just want to run tests as quickly as possible
      // so in the automation test, we don't do `requestIdleCallback`.
      if (Cu.isInAutomation) {
        new Onboarding(window);
        return;
      }
      window.requestIdleCallback(() => {
        new Onboarding(window);
      });
    }
  }, true);
}
