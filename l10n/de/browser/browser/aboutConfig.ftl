# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# An old map warning, see https://en.wikipedia.org/wiki/Here_be_dragons
about-config-warning-title = Warnung!
about-config-warning-text = Änderungen der Standardwerte dieser erweiterten Einstellungen können die Stabilität, Sicherheit und Geschwindigkeit dieser Anwendung gefährden. Sie sollten nur fortfahren, wenn Sie genau wissen, was Sie tun.
about-config-warning-checkbox = Erneut warnen
about-config-warning-button = Ich bin mir der Gefahren bewusst

about-config-title = about:config

about-config2-title = Erweiterte Konfiguration

about-config-search-input =
    .placeholder = Suchen
about-config-show-all = Alle Einstellungen anzeigen

about-config-pref-add = Hinzufügen
about-config-pref-toggle = Umschalten
about-config-pref-edit = Bearbeiten
about-config-pref-save = Speichern
about-config-pref-reset = Zurücksetzen
about-config-pref-delete = Löschen

## Labels for the type selection radio buttons shown when adding preferences.
about-config-pref-add-type-boolean = Boolean
about-config-pref-add-type-number = Number
about-config-pref-add-type-string = String

## Preferences with a non-default value are differentiated visually, and at the
## same time the state is made accessible to screen readers using an aria-label
## that won't be visible or copied to the clipboard.
##
## Variables:
##   $value (String): The full value of the preference.
about-config-pref-accessible-value-default =
    .aria-label = { $value } (Standard)
about-config-pref-accessible-value-custom =
    .aria-label = { $value } (benutzerdefiniert)
