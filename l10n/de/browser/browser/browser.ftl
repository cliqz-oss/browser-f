# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# This is the default window title in case there is no content
# title to be displayed.
#
# Depending on the $mode, the string will look like this (in en-US):
#
# "default" - "Mozilla Firefox"
# "private" - "Mozilla Firefox (Private Browsing)"
#
# Variables
#   $mode (String) - "private" in case of a private browsing mode, "default" otherwise.
browser-main-window-title =
    { $mode ->
        [private] { -brand-full-name } (Privater Modus)
       *[default] { -brand-full-name }
    }
# This is the default window title in case there is a content
# title to be displayed.
#
# Depending on the $mode, the string will look like this (in en-US):
#
# "default" - "Example Title - Mozilla Firefox"
# "private" - "Example Title - Mozilla Firefox (Private Browsing)"
#
# Variables
#   $mode (String) - "private" in case of a private browsing mode, "default" otherwise.
#   $title (String) - Content title string.
browser-main-window-content-title =
    { $mode ->
        [private] { $title } - { -brand-full-name } (Privater Modus)
       *[default] { $title } - { -brand-full-name }
    }
urlbar-identity-button =
    .aria-label = Seiteninformationen anzeigen

## Tooltips for images appearing in the address bar

urlbar-services-notification-anchor =
    .tooltiptext = Ansicht über eine Installation öffnen
urlbar-web-notification-anchor =
    .tooltiptext = Ändern, ob diese Website Benachrichtigungen senden darf
urlbar-midi-notification-anchor =
    .tooltiptext = MIDI-Ansicht öffnen
urlbar-eme-notification-anchor =
    .tooltiptext = Verwendung von DRM-geschützter Software verwalten
urlbar-web-authn-anchor =
    .tooltiptext = Ansicht für Web-Authentifizierung öffnen
urlbar-canvas-notification-anchor =
    .tooltiptext = Erlaubnis zur Abfrage von Canvas-Daten verwalten
urlbar-web-rtc-share-microphone-notification-anchor =
    .tooltiptext = Verwalten des Zugriffs auf Ihr Mikrofon durch diese Website
urlbar-default-notification-anchor =
    .tooltiptext = Ansicht mit Benachrichtigung öffnen
urlbar-geolocation-notification-anchor =
    .tooltiptext = Ansicht mit Standortanfrage öffnen
urlbar-storage-access-anchor =
    .tooltiptext = Ansicht für während des Surfens berechtigte Aktivitäten öffnen
urlbar-translate-notification-anchor =
    .tooltiptext = Diese Seite übersetzen
urlbar-web-rtc-share-screen-notification-anchor =
    .tooltiptext = Verwalten des Zugriffs auf Ihre Fenster oder Bildschirme durch diese Website
urlbar-indexed-db-notification-anchor =
    .tooltiptext = Ansicht über Offline-Speicher öffnen
urlbar-password-notification-anchor =
    .tooltiptext = Ansicht über gespeicherte Zugangsdaten öffnen
urlbar-translated-notification-anchor =
    .tooltiptext = Übersetzung von Seiten verwalten
urlbar-plugins-notification-anchor =
    .tooltiptext = Plugin-Verwendung verwalten
urlbar-web-rtc-share-devices-notification-anchor =
    .tooltiptext = Verwalten des Zugriffs auf Ihre Kamera und/oder Ihr Mikrofon durch diese Website
urlbar-autoplay-notification-anchor =
    .tooltiptext = Ansicht für automatische Wiedergabe öffnen
urlbar-persistent-storage-notification-anchor =
    .tooltiptext = Daten im dauerhaften Speicher speichern
urlbar-addons-notification-anchor =
    .tooltiptext = Ansicht mit Anfrage zur Installation eines Add-ons öffnen
urlbar-tip-help-icon =
    .title = Hilfe erhalten
urlbar-geolocation-blocked =
    .tooltiptext = Sie haben den Zugriff auf Ihren Standort durch diese Website blockiert.
urlbar-web-notifications-blocked =
    .tooltiptext = Sie haben das Anzeigen von Benachrichtungen durch diese Website blockiert.
urlbar-camera-blocked =
    .tooltiptext = Sie haben den Zugriff auf Ihre Kamera durch diese Website blockiert.
urlbar-microphone-blocked =
    .tooltiptext = Sie haben den Zugriff auf Ihr Mikrofon durch diese Website blockiert.
urlbar-screen-blocked =
    .tooltiptext = Sie haben den Zugriff auf Ihren Bildschirm durch diese Website blockiert.
urlbar-persistent-storage-blocked =
    .tooltiptext = Sie haben die Verwendung von dauerhaftem Speicher für diese Website blockiert.
urlbar-popup-blocked =
    .tooltiptext = Sie haben das Anzeigen von Pop-ups für diese Website blockiert.
urlbar-autoplay-media-blocked =
    .tooltiptext = Sie haben die automatische Wiedergabe von Medien mit Ton für diese Website blockiert.
urlbar-canvas-blocked =
    .tooltiptext = Sie haben das Abfragen von Canvas-Daten durch diese Website blockiert.
urlbar-midi-blocked =
    .tooltiptext = Sie haben den Zugriff auf MIDI für diese Website blockiert.
urlbar-install-blocked =
    .tooltiptext = Sie haben die Installation von Erweiterungen von dieser Website blockiert.

## Page Action Context Menu

page-action-add-to-urlbar =
    .label = Zu Adressleiste hinzufügen
page-action-manage-extension =
    .label = Erweiterung verwalten…
page-action-remove-from-urlbar =
    .label = Aus Adressleiste entfernen

## Auto-hide Context Menu

full-screen-autohide =
    .label = Symbolleisten ausblenden
    .accesskey = a
full-screen-exit =
    .label = Vollbild beenden
    .accesskey = V

## Search Engine selection buttons (one-offs)

# This string prompts the user to use the list of one-click search engines in
# the Urlbar and searchbar.
search-one-offs-with-title = Einmalig suchen mit:
# This string won't wrap, so if the translated string is longer,
# consider translating it as if it said only "Search Settings".
search-one-offs-change-settings-button =
    .label = Sucheinstellungen ändern
search-one-offs-change-settings-compact-button =
    .tooltiptext = Sucheinstellungen ändern
search-one-offs-context-open-new-tab =
    .label = In neuem Tab suchen
    .accesskey = T
search-one-offs-context-set-as-default =
    .label = Als Standardsuchmaschine festlegen
    .accesskey = S
search-one-offs-context-set-as-default-private =
    .label = Als Standardsuchmaschine für private Fenster festlegen
    .accesskey = p

## Bookmark Panel

bookmark-panel-show-editor-checkbox =
    .label = Eigenschaften beim Speichern bearbeiten
    .accesskey = g
bookmark-panel-done-button =
    .label = Fertig
# Width of the bookmark panel.
# Should be large enough to fully display the Done and
# Cancel/Remove Bookmark buttons.
bookmark-panel =
    .style = min-width: 23em
