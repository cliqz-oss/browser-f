#ifdef 0
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
#endif

const PREF_INTRO_SHOWN = "browser.newtabpage.introShown";
const PREF_NEWTAB_ENHANCED = "browser.newtabpage.enhanced";

let gIntro = {
  _nodeIDSuffixes: [
    "mask",
    "modal",
    "text",
    "buttons",
    "header",
    "footer"
  ],

  _paragraphs: [],

  _nodes: {},

  init: function() {
    for (let idSuffix of this._nodeIDSuffixes) {
      this._nodes[idSuffix] = document.getElementById("newtab-intro-" + idSuffix);
    }
  },

  _showMessage: function() {
    // Set the paragraphs
    let paragraphNodes = this._nodes.text.getElementsByTagName("p");

    this._paragraphs.forEach((arg, index) => {
      paragraphNodes[index].innerHTML = arg;
    });

    // Set the button
    document.getElementById("newtab-intro-button").
             setAttribute("value", newTabString("intro.gotit"));
  },

  _bold: function(str) {
    return `<strong>${str}</strong>`;
  },

  _link: function(url, text) {
    return `<a href="${url}" target="_blank">${text}</a>`;
  },

  _exitIntro: function() {
    this._nodes.mask.style.opacity = 0;
    this._nodes.mask.addEventListener("transitionend", () => {
      this._nodes.mask.style.display = "none";
    });
  },

<<<<<<< HEAD
    this._nodes.panel.addEventListener("popupshowing", e => this._setUpPanel());
    this._nodes.panel.addEventListener("popuphidden", e => this._hidePanel());
    //this._nodes.what.addEventListener("click", e => this.showPanel());
||||||| merged common ancestors
    this._nodes.panel.addEventListener("popupshowing", e => this._setUpPanel());
    this._nodes.panel.addEventListener("popuphidden", e => this._hidePanel());
    this._nodes.what.addEventListener("click", e => this.showPanel());
=======
  _generateParagraphs: function() {
    let customizeIcon = '<input type="button" class="newtab-control newtab-customize"/>';
    this._paragraphs.push(`${newTabString("intro.paragraph9")} ${newTabString("intro.paragraph7")}`);
    this._paragraphs.push(
        `${newTabString("intro.paragraph2", [this._link(TILES_PRIVACY_LINK, newTabString("privacy.link"))])}
         ${newTabString("intro.paragraph4.2", [customizeIcon, this._bold(newTabString("intro.controls"))])}`);
>>>>>>> af3d56ea5e4e598d647510626ee42600c774cbd8
  },

  showIfNecessary: function() {
    if (!Services.prefs.getBoolPref(PREF_INTRO_SHOWN)) {
      this.showPanel();
      Services.prefs.setBoolPref(PREF_INTRO_SHOWN, true);
    }
  },

  showPanel: function() {
    this._nodes.mask.style.display = "block";
    this._nodes.mask.style.opacity = 1;

    if (!this._paragraphs.length) {
      // It's our first time showing the panel. Do some initial setup
      this._generateParagraphs();
    }
    this._showMessage();

    // Header text
    this._nodes.header.innerHTML = newTabString("intro.header.update");

    // Footer links
    let footerLinkNode = document.getElementById("newtab-intro-link");
    footerLinkNode.innerHTML = this._link(TILES_INTRO_LINK, newTabString("learn.link2"))
  },
};
