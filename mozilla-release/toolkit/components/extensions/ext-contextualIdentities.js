"use strict";

// The ext-* files are imported into the same scopes.
/* import-globals-from ext-toolkit.js */

XPCOMUtils.defineLazyModuleGetter(this, "ContextualIdentityService",
                                  "resource://gre/modules/ContextualIdentityService.jsm");
XPCOMUtils.defineLazyPreferenceGetter(this, "containersEnabled",
                                      "privacy.userContext.enabled");

Cu.import("resource://gre/modules/ExtensionPreferencesManager.jsm");

var {
  ExtensionError,
} = ExtensionUtils;

const CONTAINER_PREF_INSTALL_DEFAULTS = {
  "privacy.userContext.enabled": true,
  "privacy.userContext.longPressBehavior": 2,
  "privacy.userContext.ui.enabled": true,
  "privacy.usercontext.about_newtab_segregation.enabled": true,
  "privacy.userContext.extension": undefined,
};

const CONTAINERS_ENABLED_SETTING_NAME = "privacy.containers";

const CONTAINER_COLORS = new Map([
  ["blue", "#37adff"],
  ["turquoise", "#00c79a"],
  ["green", "#51cd00"],
  ["yellow", "#ffcb00"],
  ["orange", "#ff9f00"],
  ["red", "#ff613d"],
  ["pink", "#ff4bda"],
  ["purple", "#af51f5"],
]);

const CONTAINER_ICONS = new Set([
  "briefcase",
  "cart",
  "circle",
  "dollar",
  "fingerprint",
  "gift",
  "vacation",
  "food",
  "fruit",
  "pet",
  "tree",
  "chill",
]);

function getContainerIcon(iconName) {
  if (!CONTAINER_ICONS.has(iconName)) {
    throw new ExtensionError(`Invalid icon ${iconName} for container`);
  }
  return `resource://usercontext-content/${iconName}.svg`;
}

function getContainerColor(colorName) {
  if (!CONTAINER_COLORS.has(colorName)) {
    throw new ExtensionError(`Invalid color name ${colorName} for container`);
  }
  return CONTAINER_COLORS.get(colorName);
}

const convertIdentity = identity => {
  let result = {
    name: ContextualIdentityService.getUserContextLabel(identity.userContextId),
    icon: identity.icon,
    iconUrl: getContainerIcon(identity.icon),
    color: identity.color,
    colorCode: getContainerColor(identity.color),
    cookieStoreId: getCookieStoreIdForContainer(identity.userContextId),
  };

  return result;
};

const checkAPIEnabled = () => {
  if (!containersEnabled) {
    throw new ExtensionError("Contextual identities are currently disabled");
  }
};

const convertIdentityFromObserver = wrappedIdentity => {
  let identity = wrappedIdentity.wrappedJSObject;
  let iconUrl, colorCode;
  try {
    iconUrl = getContainerIcon(identity.icon);
    colorCode = getContainerColor(identity.color);
  } catch (e) {
    return null;
  }

  let result = {
    name: identity.name,
    icon: identity.icon,
    iconUrl,
    color: identity.color,
    colorCode,
    cookieStoreId: getCookieStoreIdForContainer(identity.userContextId),
  };

  return result;
};

ExtensionPreferencesManager.addSetting(CONTAINERS_ENABLED_SETTING_NAME, {
  prefNames: Object.keys(CONTAINER_PREF_INSTALL_DEFAULTS),

  setCallback(value) {
    if (value !== true) {
      return Object.assign(CONTAINER_PREF_INSTALL_DEFAULTS, {
        "privacy.userContext.extension": value,
      });
    }

    let prefs = {};
    for (let pref of this.prefNames) {
      prefs[pref] = undefined;
    }
    return prefs;
  },
});

this.contextualIdentities = class extends ExtensionAPI {
  onStartup() {
    let {extension} = this;

    if (extension.hasPermission("contextualIdentities")) {
      ExtensionPreferencesManager.setSetting(extension.id, CONTAINERS_ENABLED_SETTING_NAME, extension.id);
    }
  }

  getAPI(context) {
    let self = {
      contextualIdentities: {
        async get(cookieStoreId) {
          checkAPIEnabled();
          let containerId = getContainerForCookieStoreId(cookieStoreId);
          if (!containerId) {
            throw new ExtensionError(`Invalid contextual identity: ${cookieStoreId}`);
          }

          let identity = ContextualIdentityService.getPublicIdentityFromId(containerId);
          return convertIdentity(identity);
        },

        async query(details) {
          checkAPIEnabled();
          let identities = [];
          ContextualIdentityService.getPublicIdentities().forEach(identity => {
            if (details.name &&
                ContextualIdentityService.getUserContextLabel(identity.userContextId) != details.name) {
              return;
            }

            identities.push(convertIdentity(identity));
          });

          return identities;
        },

        async create(details) {
          // Lets prevent making containers that are not valid
          getContainerIcon(details.icon);
          getContainerColor(details.color);

          let identity = ContextualIdentityService.create(details.name,
                                                          details.icon,
                                                          details.color);
          return convertIdentity(identity);
        },

        async update(cookieStoreId, details) {
          checkAPIEnabled();
          let containerId = getContainerForCookieStoreId(cookieStoreId);
          if (!containerId) {
            throw new ExtensionError(`Invalid contextual identity: ${cookieStoreId}`);
          }

          let identity = ContextualIdentityService.getPublicIdentityFromId(containerId);
          if (!identity) {
            throw new ExtensionError(`Invalid contextual identity: ${cookieStoreId}`);
          }

          if (details.name !== null) {
            identity.name = details.name;
          }

          if (details.color !== null) {
            identity.color = details.color;
          }

          if (details.icon !== null) {
            identity.icon = details.icon;
          }

          if (!ContextualIdentityService.update(identity.userContextId,
                                                identity.name, identity.icon,
                                                identity.color)) {
            throw new ExtensionError(`Contextual identity failed to update: ${cookieStoreId}`);
          }

          return convertIdentity(identity);
        },

        async remove(cookieStoreId) {
          checkAPIEnabled();
          let containerId = getContainerForCookieStoreId(cookieStoreId);
          if (!containerId) {
            throw new ExtensionError(`Invalid contextual identity: ${cookieStoreId}`);
          }

          let identity = ContextualIdentityService.getPublicIdentityFromId(containerId);
          if (!identity) {
            throw new ExtensionError(`Invalid contextual identity: ${cookieStoreId}`);
          }

          // We have to create the identity object before removing it.
          let convertedIdentity = convertIdentity(identity);

          if (!ContextualIdentityService.remove(identity.userContextId)) {
            throw new ExtensionError(`Contextual identity failed to remove: ${cookieStoreId}`);
          }

          return convertedIdentity;
        },

        onCreated: new EventManager(context, "contextualIdentities.onCreated", fire => {
          let observer = (subject, topic) => {
            let convertedIdentity = convertIdentityFromObserver(subject);
            if (convertedIdentity) {
              fire.async({contextualIdentity: convertedIdentity});
            }
          };

          Services.obs.addObserver(observer, "contextual-identity-created");
          return () => {
            Services.obs.removeObserver(observer, "contextual-identity-created");
          };
        }).api(),

        onUpdated: new EventManager(context, "contextualIdentities.onUpdated", fire => {
          let observer = (subject, topic) => {
            let convertedIdentity = convertIdentityFromObserver(subject);
            if (convertedIdentity) {
              fire.async({contextualIdentity: convertedIdentity});
            }
          };

          Services.obs.addObserver(observer, "contextual-identity-updated");
          return () => {
            Services.obs.removeObserver(observer, "contextual-identity-updated");
          };
        }).api(),

        onRemoved: new EventManager(context, "contextualIdentities.onRemoved", fire => {
          let observer = (subject, topic) => {
            let convertedIdentity = convertIdentityFromObserver(subject);
            if (convertedIdentity) {
              fire.async({contextualIdentity: convertedIdentity});
            }
          };

          Services.obs.addObserver(observer, "contextual-identity-deleted");
          return () => {
            Services.obs.removeObserver(observer, "contextual-identity-deleted");
          };
        }).api(),

      },
    };

    return self;
  }
};
