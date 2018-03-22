const {interfaces: Ci, classes: Cc, results: Cr, utils: Cu} = Components;

Cu.import("resource://gre/modules/Services.jsm");

// ================================================
// Load mocking/stubbing library, sinon
// docs: http://sinonjs.org/releases/v2.3.2/
Cu.import("resource://gre/modules/Timer.jsm");
Services.scriptloader.loadSubScript("resource://testing-common/sinon-2.3.2.js", this);
/* globals sinon */
// ================================================
