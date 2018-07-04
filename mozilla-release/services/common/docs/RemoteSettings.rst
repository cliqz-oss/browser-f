.. _services/remotesettings:

===============
Remote Settings
===============

The `remote-settings.js <https://dxr.mozilla.org/mozilla-central/source/services/common/remote-settings.js>`_ module offers the ability to fetch remote settings that are kept in sync with Mozilla servers.


Usage
=====

The `get()` method returns the list of entries for a specific key. Each entry can have arbitrary attributes, and can only be modified on the server.

.. code-block:: js

    const { RemoteSettings } = ChromeUtils.import("resource://services-common/remote-settings.js", {});

    const data = await RemoteSettings("a-key").get();

    /*
      data == [
        {label: "Yahoo",  enabled: true,  weight: 10, id: "d0782d8d", last_modified: 1522764475905},
        {label: "Google", enabled: true,  weight: 20, id: "8883955f", last_modified: 1521539068414},
        {label: "Ecosia", enabled: false, weight: 5,  id: "337c865d", last_modified: 1520527480321},
      ]
    */

    for(const entry of data) {
      // Do something with entry...
      // await InternalAPI.load(entry.id, entry.label, entry.weight);
    });

.. note::
    The ``id`` and ``last_modified`` (timestamp) attributes are assigned by the server.

Options
-------

The list can optionally be filtered or ordered:

.. code-block:: js

    const subset = await RemoteSettings("a-key").get({
      filters: {
        "property": "value"
      },
      order: "-weight"
    });

Events
------

The ``on()`` function registers handlers to be triggered when events occur.

The ``sync`` event allows to be notified when the remote settings are changed on the server side. Your handler is given an ``event`` object that contains a ``data`` attribute that has information about the changes:

- ``current``: current list of entries (after changes were applied);
- ``created``, ``updated``, ``deleted``: list of entries that were created/updated/deleted respectively.

.. code-block:: js

    RemoteSettings("a-key").on("sync", event => {
      const { data: { current } } = event;
      for(const entry of current) {
        // Do something with entry...
        // await InternalAPI.reload(entry.id, entry.label, entry.weight);
      }
    });

.. note::
    Currently, the update of remote settings is triggered by the `nsBlocklistService <https://dxr.mozilla.org/mozilla-central/source/toolkit/mozapps/extensions/nsBlocklistService.js>`_ (~ every 24H).

File attachments
----------------

When an entry has a file attached to it, it has an ``attachment`` attribute, which contains the file related information (url, hash, size, mimetype, etc.). Remote files are not downloaded automatically.

.. code-block:: js

    const data = await RemoteSettings("a-key").get();

    data.filter(d => d.attachment)
        .forEach(async ({ attachment: { url, filename, size } }) => {
          if (size < OS.freeDiskSpace) {
            await downloadLocally(url, filename);
          }
        });


Uptake Telemetry
================

Some :ref:`uptake telemetry <telemetry/collection/uptake>` is collected in order to monitor how remote settings are propagated.

It is submitted to a single :ref:`keyed histogram <histogram-type-keyed>` whose id is ``UPTAKE_REMOTE_CONTENT_RESULT_1`` and the keys are prefixed with ``main/`` (eg. ``main/a-key`` in the above example).


Create new remote settings
==========================

Staff members can create new kinds of remote settings, following `this documentation <mana docs>`_.

It basically consists in:

#. Choosing a key (eg. ``search-providers``)
#. Assigning collaborators to editors and reviewers groups
#. (*optional*) Define a JSONSchema to validate entries
#. (*optional*) Allow attachments on entries

And once done:

#. Create, modify or delete entries and let reviewers approve the changes
#. Wait for Firefox to pick-up the changes for your settings key

.. _mana docs: https://mana.mozilla.org/wiki/pages/viewpage.action?pageId=66655528


Debugging and testing
=====================

Trigger a synchronization manually
----------------------------------

The synchronization of every known remote settings clients can be triggered manually with ``pollChanges()``:

.. code-block:: js

    RemoteSettings.pollChanges()

The synchronization of a single client can be forced with ``maybeSync()``:

.. code-block:: js

    const fakeTimestamp = Infinity;
    const fakeServerTime = Date.now();

    await RemoteSettings("a-key").maybeSync(fakeTimestamp, fakeServerTime)


Manipulate local data
---------------------

A handle on the local collection can be obtained with ``openCollection()``.

.. code-block:: js

    const collection = await RemoteSettings("a-key").openCollection();

And records can be created manually (as if they were synchronized from the server):

.. code-block:: js

    const record = await collection.create({
      domain: "website.com",
      usernameSelector: "#login-account",
      passwordSelector: "#pass-signin",
    }, { synced: true });

In order to bypass the potential target filtering of ``RemoteSettings("key").get()``, the low-level listing of records can be obtained with ``.list()``:

.. code-block:: js

    const subset = await collection.list({
      filters: {
        "property": "value"
      }
    });

The local data can be flushed with ``clear()``:

.. code-block:: js

    await collection.clear()

For further documentation in collection API, checkout the `kinto.js library <https://kintojs.readthedocs.io/>`_, which is charge of the IndexedDB interaction behind-the-scenes.


Inspect local data
------------------

The internal IndexedDBs of remote settings can be accessed via the Storage Inspector in the `browser toolbox <https://developer.mozilla.org/en-US/docs/Tools/Browser_Toolbox>`_.

For example, the local data of the ``"key"`` collection can be accessed in the ``main/key`` IndexedDB store at *Browser Toolbox* > *Storage* > *IndexedDB* > *chrome* > *main/key*.


about:remotesettings
--------------------

The ``about:remotesettings`` extension provides tool to inspect synchronization status, change the remote server or switch to *preview* in order to sign-off pending changes. `More information on the dedicated repository <https://github.com/leplatrem/aboutremotesettings>`_.

.. note::

    With `Bug 1406036 <https://bugzilla.mozilla.org/show_bug.cgi?id=1406036>`_, ``about:remotesettings`` will be available natively.


About blocklists
----------------

Addons, certificates, plugins, and GFX blocklists were the first use-cases of remote settings, and thus have some specificities.

For example, they leverage advanced customization options (bucket, content-signature certificate etc.), and in order to be able to inspect and manipulate their data, the client instances must first be explicitly initialized.

.. code-block:: js

    const BlocklistClients = ChromeUtils.import("resource://services-common/blocklist-clients.js", {});

    BlocklistClients.initialize();

Then, in order to access a specific client instance, the bucket must be specified:

.. code-block:: js

    const collection = await RemoteSettings("addons", { bucketName: "blocklists" }).openCollection();

And in the storage inspector, the IndexedDB internal store will be prefixed with ``blocklists`` instead of ``main`` (eg. ``blocklists/addons``).

