# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

choose-messenger-language-description = Sprache für die Anzeige von Menüs, Mitteilungen und Benachrichtigungen von { -brand-short-name }
manage-messenger-languages-button =
  .label = Alternative Sprachen festlegen…
  .accesskey = S
confirm-messenger-language-change-description = { -brand-short-name } muss neu gestartet werden, um die Änderungen zu übernehmen.
confirm-messenger-language-change-button = Anwenden und neu starten

update-pref-write-failure-title = Schreibfehler

# Variables:
#   $path (String) - Path to the configuration file
update-pref-write-failure-message = Einstellung konnte nicht gespeichert werden. Fehler beim Schreiben dieser Datei: { $path }

update-setting-write-failure-title = Fehler beim Speichern der Update-Einstellungen

# Variables:
#   $path (String) - Path to the configuration file
# The newlines between the main text and the line containing the path is
# intentional so the path is easier to identify.
update-setting-write-failure-message =
    { -brand-short-name } bemerkte einen Fehler und hat diese Änderung nicht gespeichert. Das Setzen dieser Update-Einstellung benötigt Schreibrechte für die unten genannte Datei. Sie oder ein Systemadministrator können das Problem eventuell beheben, indem Sie der Gruppe "Benutzer" vollständige Kontrolle über die Datei gewähren.

    Konnte folgende Datei nicht speichern: { $path }

update-in-progress-title = Update wird durchgeführt

update-in-progress-message = Soll { -brand-short-name } mit dem Update fortfahren?

update-in-progress-ok-button = &Verwerfen
# Continue is the cancel button so pressing escape or using a platform standard
# method of closing the UI will not discard the update.
update-in-progress-cancel-button = &Fortfahren
