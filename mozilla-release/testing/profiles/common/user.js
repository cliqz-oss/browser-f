// Base preferences file used by both unittest and perf harnesses.
/* globals user_pref */
user_pref("app.update.enabled", false);
user_pref("browser.dom.window.dump.enabled", true);
// Use an empty list of sites to avoid fetching
user_pref("browser.newtabpage.activity-stream.feeds.section.topstories", false);
user_pref("browser.newtabpage.activity-stream.feeds.snippets", false);
user_pref("browser.newtabpage.activity-stream.tippyTop.service.endpoint", "");
// For Activity Stream firstrun page, use an empty string to avoid fetching.
user_pref("browser.newtabpage.activity-stream.fxaccounts.endpoint", "");
// Tell the search service we are running in the US.  This also has the desired
// side-effect of preventing our geoip lookup.
user_pref("browser.search.countryCode", "US");
user_pref("browser.search.region", "US");
// This will prevent HTTP requests for region defaults.
user_pref("browser.search.geoSpecificDefaults", false);
// Disable android snippets
user_pref("browser.snippets.enabled", false);
user_pref("browser.snippets.syncPromo.enabled", false);
// Disable webapp updates.  Yes, it is supposed to be an integer.
user_pref("browser.webapps.checkForUpdates", 0);
// We do not wish to display datareporting policy notifications as it might
// cause other tests to fail. Tests that wish to test the notification functionality
// should explicitly disable this pref.
user_pref("datareporting.policy.dataSubmissionPolicyBypassNotification", true);
user_pref("dom.max_chrome_script_run_time", 0);
user_pref("dom.max_script_run_time", 0); // no slow script dialogs
user_pref("dom.send_after_paint_to_content", true);
// Only load extensions from the application and user profile
// AddonManager.SCOPE_PROFILE + AddonManager.SCOPE_APPLICATION
user_pref("extensions.enabledScopes", 5);
user_pref("extensions.legacy.enabled", true);
// Turn off extension updates so they don't bother tests
user_pref("extensions.update.enabled", false);
// Disable useragent updates.
user_pref("general.useragent.updates.enabled", false);
<<<<<<< HEAD
user_pref("general.useragent.updates.url", "https://example.com/0/%APP_ID%");

// Disable webapp updates.  Yes, it is supposed to be an integer.
user_pref("browser.webapps.checkForUpdates", 0);

user_pref("dom.presentation.testing.simulate-receiver", false);

// Don't connect to Yahoo! for RSS feed tests.
// en-US only uses .types.0.uri, but set all of them just to be sure.
user_pref("browser.contentHandlers.types.0.uri", "http://test1.example.org/rss?url=%s");
user_pref("browser.contentHandlers.types.1.uri", "http://test1.example.org/rss?url=%s");
user_pref("browser.contentHandlers.types.2.uri", "http://test1.example.org/rss?url=%s");
user_pref("browser.contentHandlers.types.3.uri", "http://test1.example.org/rss?url=%s");
user_pref("browser.contentHandlers.types.4.uri", "http://test1.example.org/rss?url=%s");
user_pref("browser.contentHandlers.types.5.uri", "http://test1.example.org/rss?url=%s");

// We want to collect telemetry, but we don't want to send in the results.
user_pref("toolkit.telemetry.server", "https://{server}/telemetry-dummy/");
user_pref("datareporting.healthreport.uploadEnabled", false);
// Don't send 'new-profile' ping on new profiles during tests, otherwise the testing framework
// might wait on the pingsender to finish and slow down tests.
user_pref("toolkit.telemetry.newProfilePing.enabled", false);
// Don't send 'bhr' ping during tests, otherwise the testing framework might
// wait on the pingsender to finish and slow down tests.
user_pref("toolkit.telemetry.bhrPing.enabled", false);
// Don't send the 'shutdown' ping using the pingsender on the first session using
// the 'pingsender' process. Valgrind marks the process as leaky (e.g. see bug 1364068
// for the 'new-profile' ping) but does not provide enough information
// to suppress the leak. Running locally does not reproduce the issue,
// so disable this until we rewrite the pingsender in Rust (bug 1339035).
user_pref("toolkit.telemetry.shutdownPingSender.enabledFirstSession", false);
// Don't send the 'first-shutdown' during tests, otherwise tests expecting
// main and subsession pings will fail.
user_pref("toolkit.telemetry.firstShutdownPing.enabled", false);

// A couple of preferences with default values to test that telemetry preference
// watching is working.
user_pref("toolkit.telemetry.test.pref1", true);
user_pref("toolkit.telemetry.test.pref2", false);

// We don't want to hit the real Firefox Accounts server for tests.  We don't
// actually need a functioning FxA server, so just set it to something that
// resolves and accepts requests, even if they all fail.
user_pref("identity.fxaccounts.auth.uri", "https://{server}/fxa-dummy/");

// Ditto for all the FxA content root URI.
user_pref("identity.fxaccounts.remote.root", "https://{server}/");

// Increase the APZ content response timeout in tests to 1 minute.
// This is to accommodate the fact that test environments tends to be slower
// than production environments (with the b2g emulator being the slowest of them
// all), resulting in the production timeout value sometimes being exceeded
// and causing false-positive test failures. See bug 1176798, bug 1177018,
// bug 1210465.
user_pref("apz.content_response_timeout", 60000);

// Make sure SSL Error reports don't hit the network
user_pref("security.ssl.errorReporting.url", "https://example.com/browser/browser/base/content/test/general/ssl_error_reports.sjs?succeed");

// Make sure Translation won't hit the network.
user_pref("browser.translation.bing.authURL", "http://{server}/browser/browser/components/translation/test/bing.sjs");
user_pref("browser.translation.bing.translateArrayURL", "http://{server}/browser/browser/components/translation/test/bing.sjs");
user_pref("browser.translation.yandex.translateURLOverride", "http://{server}/browser/browser/components/translation/test/yandex.sjs");
user_pref("browser.translation.engine", "bing");

// Make sure we don't try to load snippets from the network.
user_pref("browser.aboutHomeSnippets.updateUrl", "nonexistent://test");

// Use an empty list of sites to avoid fetching
user_pref("browser.newtabpage.activity-stream.default.sites", "");
user_pref("browser.newtabpage.activity-stream.telemetry", false);
user_pref("browser.newtabpage.activity-stream.tippyTop.service.endpoint", "");
user_pref("browser.newtabpage.activity-stream.feeds.section.topstories", false);
user_pref("browser.newtabpage.activity-stream.feeds.snippets", false);

// Ensure UITour won't hit the network
user_pref("browser.uitour.pinnedTabUrl", "http://{server}/uitour-dummy/pinnedTab");
user_pref("browser.uitour.url", "http://{server}/uitour-dummy/tour");

// Tell the search service we are running in the US.  This also has the desired
// side-effect of preventing our geoip lookup.
user_pref("browser.search.isUS", true);
user_pref("browser.search.countryCode", "US");
// This will prevent HTTP requests for region defaults.
user_pref("browser.search.geoSpecificDefaults", false);

// Make sure Shield doesn't hit the network.
user_pref("app.normandy.api_url", "");

// Make sure PingCentre doesn't hit the network.
user_pref("browser.ping-centre.staging.endpoint", "");
user_pref("browser.ping-centre.production.endpoint", "");

user_pref("media.eme.enabled", true);

// Set the number of shmems the PChromiumCDM protocol pre-allocates to 0,
// so that we test the case where we under-estimate how many shmems we need
// to send decoded video frames from the CDM to Gecko.
user_pref("media.eme.chromium-api.video-shmems", 0);

user_pref("media.autoplay.enabled", true);

// Don't use auto-enabled e10s
user_pref("browser.tabs.remote.autostart", false);
// Don't show a delay when hiding the audio indicator during tests
user_pref("browser.tabs.delayHidingAudioPlayingIconMS", 0);
// Don't forceably kill content processes after a timeout
user_pref("dom.ipc.tabs.shutdownTimeoutSecs", 0);

// Make tests run consistently on DevEdition (which has a lightweight theme
// selected by default).
user_pref("lightweightThemes.selectedThemeID", "");

// Enable speech synth test service, and disable built in platform services.
user_pref("media.webspeech.synth.test", true);

// Turn off search suggestions in the location bar so as not to trigger network
// connections.
user_pref("browser.urlbar.suggest.searches", false);

// Turn off the location bar search suggestions opt-in.  It interferes with
// tests that don't expect it to be there.
user_pref("browser.urlbar.userMadeSearchSuggestionsChoice", true);

user_pref("browser.urlbar.usepreloadedtopurls.enabled", false);

user_pref("webextensions.tests", true);
user_pref("startup.homepage_welcome_url", "about:blank");
user_pref("startup.homepage_welcome_url.additional", "");

// For Firefox 52 only, ESR will support non-Flash plugins while release will
// not, so we keep testing the non-Flash pathways
user_pref("plugin.load_flash_only", false);

// Don't block old libavcodec libraries when testing, because our test systems
// cannot easily be upgraded.
user_pref("media.libavcodec.allow-obsolete", true);

user_pref("media.openUnsupportedTypeWithExternalApp", false);

// Disable password capture, so that mochitests that include forms aren't
// influenced by the presence of the persistent doorhanger notification.
user_pref("signon.rememberSignons", false);

// Enable form autofill feature testing.
user_pref("extensions.formautofill.available", "on");

// Disable all recommended Marionette preferences for Gecko tests.
// The prefs recommended by Marionette are typically geared towards
// consumer automation; not vendor testing.
user_pref("marionette.prefs.recommended", false);

// Disable Screenshots by default for now
user_pref("extensions.screenshots.disabled", true);

// Set places maintenance far in the future (the maximum time possible in an
// int32_t) to avoid it kicking in during tests. The maintenance can take a
// relatively long time which may cause unnecessary intermittents and slow down
// tests. This, like many things, will stop working correctly in 2038.
user_pref("places.database.lastMaintenance", 2147483647);

// Disable Bookmark backups by default.
user_pref("browser.bookmarks.max_backups", 0);

// Cliqz ignore onboarding
user_pref("extensions.cliqz.browserOnboarding", true);
||||||| merged common ancestors
user_pref("general.useragent.updates.url", "https://example.com/0/%APP_ID%");

// Disable webapp updates.  Yes, it is supposed to be an integer.
user_pref("browser.webapps.checkForUpdates", 0);

user_pref("dom.presentation.testing.simulate-receiver", false);

// Don't connect to Yahoo! for RSS feed tests.
// en-US only uses .types.0.uri, but set all of them just to be sure.
user_pref("browser.contentHandlers.types.0.uri", "http://test1.example.org/rss?url=%s");
user_pref("browser.contentHandlers.types.1.uri", "http://test1.example.org/rss?url=%s");
user_pref("browser.contentHandlers.types.2.uri", "http://test1.example.org/rss?url=%s");
user_pref("browser.contentHandlers.types.3.uri", "http://test1.example.org/rss?url=%s");
user_pref("browser.contentHandlers.types.4.uri", "http://test1.example.org/rss?url=%s");
user_pref("browser.contentHandlers.types.5.uri", "http://test1.example.org/rss?url=%s");

// We want to collect telemetry, but we don't want to send in the results.
user_pref("toolkit.telemetry.server", "https://{server}/telemetry-dummy/");
user_pref("datareporting.healthreport.uploadEnabled", false);
// Don't send 'new-profile' ping on new profiles during tests, otherwise the testing framework
// might wait on the pingsender to finish and slow down tests.
user_pref("toolkit.telemetry.newProfilePing.enabled", false);
// Don't send 'bhr' ping during tests, otherwise the testing framework might
// wait on the pingsender to finish and slow down tests.
user_pref("toolkit.telemetry.bhrPing.enabled", false);
// Don't send the 'shutdown' ping using the pingsender on the first session using
// the 'pingsender' process. Valgrind marks the process as leaky (e.g. see bug 1364068
// for the 'new-profile' ping) but does not provide enough information
// to suppress the leak. Running locally does not reproduce the issue,
// so disable this until we rewrite the pingsender in Rust (bug 1339035).
user_pref("toolkit.telemetry.shutdownPingSender.enabledFirstSession", false);
// Don't send the 'first-shutdown' during tests, otherwise tests expecting
// main and subsession pings will fail.
user_pref("toolkit.telemetry.firstShutdownPing.enabled", false);

// A couple of preferences with default values to test that telemetry preference
// watching is working.
user_pref("toolkit.telemetry.test.pref1", true);
user_pref("toolkit.telemetry.test.pref2", false);

// We don't want to hit the real Firefox Accounts server for tests.  We don't
// actually need a functioning FxA server, so just set it to something that
// resolves and accepts requests, even if they all fail.
user_pref("identity.fxaccounts.auth.uri", "https://{server}/fxa-dummy/");

// Ditto for all the FxA content root URI.
user_pref("identity.fxaccounts.remote.root", "https://{server}/");

// Increase the APZ content response timeout in tests to 1 minute.
// This is to accommodate the fact that test environments tends to be slower
// than production environments (with the b2g emulator being the slowest of them
// all), resulting in the production timeout value sometimes being exceeded
// and causing false-positive test failures. See bug 1176798, bug 1177018,
// bug 1210465.
user_pref("apz.content_response_timeout", 60000);

// Make sure SSL Error reports don't hit the network
user_pref("security.ssl.errorReporting.url", "https://example.com/browser/browser/base/content/test/general/ssl_error_reports.sjs?succeed");

// Make sure Translation won't hit the network.
user_pref("browser.translation.bing.authURL", "http://{server}/browser/browser/components/translation/test/bing.sjs");
user_pref("browser.translation.bing.translateArrayURL", "http://{server}/browser/browser/components/translation/test/bing.sjs");
user_pref("browser.translation.yandex.translateURLOverride", "http://{server}/browser/browser/components/translation/test/yandex.sjs");
user_pref("browser.translation.engine", "bing");

// Make sure we don't try to load snippets from the network.
user_pref("browser.aboutHomeSnippets.updateUrl", "nonexistent://test");

// Use an empty list of sites to avoid fetching
user_pref("browser.newtabpage.activity-stream.default.sites", "");
user_pref("browser.newtabpage.activity-stream.telemetry", false);
user_pref("browser.newtabpage.activity-stream.tippyTop.service.endpoint", "");
user_pref("browser.newtabpage.activity-stream.feeds.section.topstories", false);
user_pref("browser.newtabpage.activity-stream.feeds.snippets", false);

// Ensure UITour won't hit the network
user_pref("browser.uitour.pinnedTabUrl", "http://{server}/uitour-dummy/pinnedTab");
user_pref("browser.uitour.url", "http://{server}/uitour-dummy/tour");

// Tell the search service we are running in the US.  This also has the desired
// side-effect of preventing our geoip lookup.
user_pref("browser.search.isUS", true);
user_pref("browser.search.countryCode", "US");
// This will prevent HTTP requests for region defaults.
user_pref("browser.search.geoSpecificDefaults", false);

// Make sure Shield doesn't hit the network.
user_pref("app.normandy.api_url", "");

// Make sure PingCentre doesn't hit the network.
user_pref("browser.ping-centre.staging.endpoint", "");
user_pref("browser.ping-centre.production.endpoint", "");

user_pref("media.eme.enabled", true);

// Set the number of shmems the PChromiumCDM protocol pre-allocates to 0,
// so that we test the case where we under-estimate how many shmems we need
// to send decoded video frames from the CDM to Gecko.
user_pref("media.eme.chromium-api.video-shmems", 0);

user_pref("media.autoplay.enabled", true);

// Don't use auto-enabled e10s
user_pref("browser.tabs.remote.autostart", false);
// Don't show a delay when hiding the audio indicator during tests
user_pref("browser.tabs.delayHidingAudioPlayingIconMS", 0);
// Don't forceably kill content processes after a timeout
user_pref("dom.ipc.tabs.shutdownTimeoutSecs", 0);

// Make tests run consistently on DevEdition (which has a lightweight theme
// selected by default).
user_pref("lightweightThemes.selectedThemeID", "");

// Enable speech synth test service, and disable built in platform services.
user_pref("media.webspeech.synth.test", true);

// Turn off search suggestions in the location bar so as not to trigger network
// connections.
user_pref("browser.urlbar.suggest.searches", false);

// Turn off the location bar search suggestions opt-in.  It interferes with
// tests that don't expect it to be there.
user_pref("browser.urlbar.userMadeSearchSuggestionsChoice", true);

user_pref("browser.urlbar.usepreloadedtopurls.enabled", false);

user_pref("webextensions.tests", true);
user_pref("startup.homepage_welcome_url", "about:blank");
user_pref("startup.homepage_welcome_url.additional", "");

// For Firefox 52 only, ESR will support non-Flash plugins while release will
// not, so we keep testing the non-Flash pathways
user_pref("plugin.load_flash_only", false);

// Don't block old libavcodec libraries when testing, because our test systems
// cannot easily be upgraded.
user_pref("media.libavcodec.allow-obsolete", true);

user_pref("media.openUnsupportedTypeWithExternalApp", false);

// Disable password capture, so that mochitests that include forms aren't
// influenced by the presence of the persistent doorhanger notification.
user_pref("signon.rememberSignons", false);

// Enable form autofill feature testing.
user_pref("extensions.formautofill.available", "on");

// Disable all recommended Marionette preferences for Gecko tests.
// The prefs recommended by Marionette are typically geared towards
// consumer automation; not vendor testing.
user_pref("marionette.prefs.recommended", false);

// Disable Screenshots by default for now
user_pref("extensions.screenshots.disabled", true);

// Set places maintenance far in the future (the maximum time possible in an
// int32_t) to avoid it kicking in during tests. The maintenance can take a
// relatively long time which may cause unnecessary intermittents and slow down
// tests. This, like many things, will stop working correctly in 2038.
user_pref("places.database.lastMaintenance", 2147483647);

// Disable Bookmark backups by default.
user_pref("browser.bookmarks.max_backups", 0);
=======
user_pref("hangmonitor.timeout", 0); // no hang monitor
user_pref("media.gmp-manager.updateEnabled", false);
// Make enablePrivilege continue to work for test code. :-(
user_pref("security.turn_off_all_security_so_that_viruses_can_take_over_this_computer", true);
user_pref("xpinstall.signatures.required", false);
>>>>>>> origin/upstream-releases
