========================
Hybrid Content Telemetry
========================

Hybrid content is web content that is loaded as part of Firefox, appears as part of
Firefox to the user and is primarily intended to be used in Firefox. This can be
either a page that ships with Firefox or that can be loaded dynamically from our hosted
services. Hybrid content telemetry allows Mozilla pages to check whether data
collection is enabled and to submit Telemetry data.

.. important::

    Every new data collection in Firefox (including hybrid content) needs a `data collection review <https://wiki.mozilla.org/Firefox/Data_Collection#Requesting_Approval>`_ from a data collection peer. Just set the feedback? flag for one of the data peers. They try to reply within a business day.

The recorded data will be sent to Mozilla servers by Firefox, if the collection is enabled, with the :doc:`main-ping <../data/main-ping>`.

Adding content data collection
==============================
Telemetry can be sent from web content by:

1. granting the web content's host privileges in the Firefox codebase;
2. including the ``HybridContentTelemetry-lib.js`` file in the page;
3. registering the probes after the library is loaded;
4. using the API to send Telemetry.

Granting the privileges
-----------------------
For security/privacy reasons `Mozilla.ContentTelemetry` will only work on a list of allowed secure origins. The list of allowed origins can be found in `browser/app/permissions <https://dxr.mozilla.org/mozilla-central/source/browser/app/permissions>`_ . A host needs to be given the ``hc_telemetry`` permission in order to be whitelisted.

Example:

.. code-block:: csv

  origin  hc_telemetry  1 https://discovery.addons.mozilla.org

Adding an entry to the ``permissions`` file requires riding the trains. If "go-faster" content requires
granting permissions to a Mozilla page, it can do so by using the `permission manager <https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIPermissionManager>`_

.. code-block:: js

  function addonInit() {
    // The following code must be called before attempting to load a page that uses
    // hybrid content telemetry on https://example.mozilla.org.
    let hostURI = Services.io.newURI("https://example.mozilla.org");
    Services.perms.add(hostURI, "hc_telemetry", Services.perms.ALLOW_ACTION);
  }

  function addonCleanup() {
    // The permission must be removed if no longer needed (e.g. the add-on is shut down).
    let hostURI = Services.io.newURI("https://example.mozilla.org");
    Services.perms.remove(hostURI, "hc_telemetry");
  }

.. important::

    Granted permissions do not disappear when a "go-faster" add-on is uninstalled but are cleared when the browser is closed. If permissions need to be cleaned without closing the browser, it must be done manually. Moreover, permissions are keyed by origin: ``http://mozilla.com`` and ``https://mozilla.com`` are different things.

Including the library
---------------------
To use hybrid content telemetry the relative content JS library needs to be included in the page. We don't have a CDN hosted version that can be readily included in the page. For this reason, each consumer will need to fetch the latest version of the library from `here <https://hg.mozilla.org/mozilla-central/file/tip/toolkit/components/telemetry/hybrid-content/HybridContentTelemetry-lib.js>`_ and add it to the page repository. Then this file can be deployed along with the page.

Example:

.. code-block:: html

  <!DOCTYPE html>
  <html>
    <head>
      <!-- Other head stuff -->
      <script type="application/javascript" src="HybridContentTelemetry-lib.js"></script>
    </head>
    <body> <!-- Other body stuff --> </body>
  </html>

Registering the probes
----------------------
Probe registration can happen at any time after the library is loaded in the page, but registering early enough ensures that the definition is available once a recording attempt is made.

Example:

.. code-block:: html

  <!DOCTYPE html>
  <html>
    <head>
      <!-- Other head stuff -->
      <script type="application/javascript">
        window.onload = function() {
          if (!Mozilla || !Mozilla.ContentTelemetry) {
            // .. uh-oh, was library loaded? Report the error.
            return;
          }
          // Register the probe.
          Mozilla.ContentTelemetry.registerEvents("page.interaction", {
            "click": {
              methods: ["click"],
              objects: ["red_button", "blue_button"],
            }
          });
        };
      </script>
    </head>
    <body> <!-- Other body stuff --> </body>
  </html>

Recording the data
------------------
Data recording can happen at any time after a probe has been registered. The data will be recorded and sent by Firefox if permitted by the Telemetry :doc:`preferences <../internals/preferences>`.

Example:

.. code-block:: html

  <!DOCTYPE html>
  <html>
    <head>
      <!-- Other head stuff -->
      <script type="application/javascript">
        function triggerEvent() {
          if (!Mozilla || !Mozilla.ContentTelemetry) {
            // .. uh-oh, was library loaded? Report the error.
            return;
          }
          Mozilla.ContentTelemetry.recordEvent("page.interaction", "click", "red_button");
        };
      </script>
    </head>
    <body>
      <!-- Other body stuff -->
      <div id="content">
        <button id='event-recording' onclick="triggerEvent();">
          Trigger Recording
        </button>
      </div>
    </body>
  </html>

Checking if upload is enabled
-----------------------------
Mozilla pages can check if data upload is enabled, as reported by Telemetry :doc:`preferences <../internals/preferences>`. This is useful for pages which are not using Telemetry to collect data, but
need to comply to our data policy for the collection.

Example:

.. code-block:: html

  <!DOCTYPE html>
  <html>
    <head>
      <!-- Other head stuff -->
      <script type="application/javascript">
        function recordData() {
          if (!Mozilla || !Mozilla.ContentTelemetry) {
            // .. uh-oh, was library loaded? Report the error.
            return;
          }

          if (!Mozilla.ContentTelemetry.canUpload()) {
            // User has opted-out of Telemetry. No collection must take place.
            return;
          }

          // ... perform the collection without Telemetry below this point.
        };
      </script>
    </head>
    <body>
      <!-- Other body stuff -->
      <div id="content">
        <button id='event-recording' onclick="recordData();">
          Trigger Recording
        </button>
      </div>
    </body>
  </html>

The API
=======
The hybrid content API is available to the web content through the inclusion of the `HybridContentTelemetry-lib.js <https://dxr.mozilla.org/mozilla-central/source/toolkit/components/telemetry/hybrid-content/HybridContentTelemetry-lib.js>`_ library.

The initial implementation of the API allows the registration and the recording of events.

JS API
------
Authorized content can use the following functions:

.. code-block:: js

  Mozilla.ContentTelemetry.canUpload();
  Mozilla.ContentTelemetry.registerEvents(category, eventData);
  Mozilla.ContentTelemetry.recordEvent(category, method, object, value, extra);

These functions will not throw. If an unsupported operation is performed (e.g. recording an unknown event) an error will be logged to the browser console.

.. note::

    Data collected using this API will always respect the user Telemetry preferences: if a user has chosen to not send Telemetry data to Mozilla servers, Telemetry from hybrid content pages will not be sent either.
    Like other Telemetry data, it will still be recorded locally and available through ``about:telemetry``.

``Mozilla.ContentTelemetry.canUpload()``
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

.. code-block:: js

  Mozilla.ContentTelemetry.canUpload();

This function returns true if the browser is allowed to send collected data to Mozilla servers (i.e. ``datareporting.healthreport.uploadEnabled`` is ``true``), false otherwise. See :doc:`preferences <../internals/preferences>`.

.. note::

    The page should use this function to check if it is allowed to collect data. This is only needed in case the Telemetry system is not be being used for collection. If Telemetry is used, then this is taken care of internally by the Telemetry API. The page should not cache the returned value: users can opt in or out from the Data Collection at any time and so the returned value may change.

Example:

.. code-block:: js

  if (Mozilla.ContentTelemetry.canUpload()) {
    // ... perform the data collection here using another measurement system.
  }

``Mozilla.ContentTelemetry.registerEvents()``
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

.. code-block:: js

  Mozilla.ContentTelemetry.registerEvents(category, eventData);

Register new dynamic events from the content. This accepts the same parameters and is subject to the same limitation as ``Services.telemetry.registerEvents()``. See the `events` documentation for the definitive reference.

.. note::

    Make sure to call this before recording events, as soon as the library is loaded (e.g. `window load event <https://developer.mozilla.org/en-US/docs/Web/Events/load>`_). This will make sure that the definition will be ready when recording.

The data recorded into events registered with this function will end up in the ``dynamic`` process section of the main ping.

Example:

.. code-block:: js

  Mozilla.ContentTelemetry.registerEvents("page.interaction", {
    "click": {
      methods: ["click"],
      objects: ["red_button", "blue_button"],
    }
  });
  // Now events can be recorded.
  Mozilla.ContentTelemetry.recordEvent("page.interaction", "click", "red_button");

``Mozilla.ContentTelemetry.recordEvent()``
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

.. code-block:: js

  Mozilla.ContentTelemetry.recordEvent(category, method, object, value, extra);

Record a registered event. This accepts the same parameters and is subject to the same limitation as ``Services.telemetry.recordEvent()``. See the `events` documentation for the definitive reference.

Example:

.. code-block:: js

  Mozilla.ContentTelemetry.recordEvent("ui", "click", "reload-btn");
  // event: [543345, "ui", "click", "reload-btn"]
  Mozilla.ContentTelemetry.recordEvent("ui", "search", "search-bar", "google");
  // event: [89438, "ui", "search", "search-bar", "google"]
  Mozilla.ContentTelemetry.recordEvent("ui", "completion", "search-bar", "yahoo",
                                       {"querylen": "7", "results": "23"});
  // event: [982134, "ui", "completion", "search-bar", "yahoo",
  //           {"qerylen": "7", "results": "23"}]

Version History
===============

- Firefox 59: Initial hybrid content telemetry support (`bug 1417473 <https://bugzilla.mozilla.org/show_bug.cgi?id=1417473>`_).
