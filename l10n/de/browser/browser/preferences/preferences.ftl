# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

do-not-track-description = Websites eine "Do Not Track"-Information senden, dass die eigenen Aktivitäten nicht verfolgt werden sollen
do-not-track-learn-more = Weitere Informationen
do-not-track-option-default =
    .label = Nur wenn der Schutz vor Aktivitätenverfolgung aktiv ist
do-not-track-option-always =
    .label = Immer
pref-page =
    .title = { PLATFORM() ->
            [windows] Einstellungen
           *[other] Einstellungen
        }
# This is used to determine the width of the search field in about:preferences,
# in order to make the entire placeholder string visible
#
# Notice: The value of the `.style` attribute is a CSS string, and the `width`
# is the name of the CSS property. It is intended only to adjust the element's width.
# Do not translate.
search-input =
    .style = width: 15.4em
pane-general-title = Allgemein
category-general =
    .tooltiptext = { pane-general-title }
pane-search-title = Suche
category-search =
    .tooltiptext = { pane-search-title }
pane-privacy-title = Datenschutz & Sicherheit
category-privacy =
    .tooltiptext = { pane-privacy-title }
# The word "account" can be translated, do not translate or transliterate "Firefox".
pane-sync-title = Firefox-Konto
category-sync =
    .tooltiptext = { pane-sync-title }
help-button-label = Hilfe für { -brand-short-name }
focus-search =
    .key = f
close-button =
    .aria-label = Schließen

## Browser Restart Dialog

feature-enable-requires-restart = { -brand-short-name } muss neu gestartet werden, um diese Funktion zu aktivieren.
feature-disable-requires-restart = { -brand-short-name } muss neu gestartet werden, um diese Funktion zu deaktivieren.
should-restart-title = { -brand-short-name } neu starten
should-restart-ok = { -brand-short-name } jetzt neu starten
revert-no-restart-button = Rückgängig machen
restart-later = Später neu starten
