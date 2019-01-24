# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

addons-window =
    .title = Add-ons-Verwaltung
search-header =
    .placeholder = Auf addons.mozilla.org suchen
    .searchbuttonlabel = Suchen
search-header-shortcut =
    .key = f
loading-label =
    .value = Laden…
list-empty-installed =
    .value = Es sind keine Add-ons dieses Typs installiert
list-empty-available-updates =
    .value = Keine Updates gefunden
list-empty-recent-updates =
    .value = Sie haben in letzter Zeit keine Add-ons aktualisiert
list-empty-find-updates =
    .label = Nach Updates suchen
list-empty-button =
    .label = Mehr über Add-ons erfahren
install-addon-from-file =
    .label = Add-on aus Datei installieren…
    .accesskey = A
help-button = Hilfe für Add-ons
preferences =
    { PLATFORM() ->
        [windows] { -brand-short-name } - Einstellungen
       *[other] { -brand-short-name } - Einstellungen
    }
tools-menu =
    .tooltiptext = Tools für alle Add-ons
show-unsigned-extensions-button =
    .label = Einige Erweiterungen konnten nicht verifiziert werden.
show-all-extensions-button =
    .label = Alle Erweiterungen anzeigen
debug-addons =
    .label = Add-ons debuggen
    .accesskey = b
cmd-show-details =
    .label = Weitere Informationen anzeigen
    .accesskey = W
cmd-find-updates =
    .label = Updates suchen
    .accesskey = U
cmd-preferences =
    .label =
        { PLATFORM() ->
            [windows] Einstellungen
           *[other] Einstellungen
        }
    .accesskey =
        { PLATFORM() ->
            [windows] E
           *[other] E
        }
cmd-enable-theme =
    .label = Theme anlegen
    .accesskey = T
cmd-disable-theme =
    .label = Theme ablegen
    .accesskey = T
cmd-install-addon =
    .label = Installieren
    .accesskey = I
cmd-contribute =
    .label = Beitragen
    .accesskey = a
    .tooltiptext = Zur Entwicklung dieses Add-ons beitragen
discover-title = Was sind Add-ons?
discover-description =
    Add-ons sind Anwendungen, mit denen Sie { -brand-short-name } mit
    zusätzlichen Funktionen oder einem anderen Stil ausstatten können. Probieren Sie eine zeitsparende Sidebar, eine Wettervorhersage  oder ein Theme, um Ihren ganz persönlichen { -brand-short-name }
    zu bekommen.
discover-footer =
    Wenn Sie mit dem Internet verbunden sind, wird diese Seite
    einige der besten und populärsten Add-ons zum Ausprobieren anbieten.
detail-version =
    .label = Version
detail-last-updated =
    .label = Zuletzt aktualisiert
detail-contributions-description = Der Entwickler dieses Add-ons bittet Sie, dass Sie die Entwicklung unterstützen, indem Sie einen kleinen Betrag spenden.
detail-update-type =
    .value = Automatische Updates
detail-update-default =
    .label = Standard
    .tooltiptext = Updates nur dann automatisch installieren, wenn das der Standard ist
detail-update-automatic =
    .label = Ein
    .tooltiptext = Updates automatisch installieren
detail-update-manual =
    .label = Aus
    .tooltiptext = Updates nicht automatisch installieren
detail-home =
    .label = Homepage
detail-home-value =
    .value = { detail-home.label }
detail-repository =
    .label = Add-on-Profil
detail-repository-value =
    .value = { detail-repository.label }
detail-check-for-updates =
    .label = Auf Updates prüfen
    .accesskey = U
    .tooltiptext = Auf verfügbare Updates für dieses Add-on prüfen
detail-show-preferences =
    .label =
        { PLATFORM() ->
            [windows] Einstellungen
           *[other] Einstellungen
        }
    .accesskey =
        { PLATFORM() ->
            [windows] E
           *[other] E
        }
    .tooltiptext =
        { PLATFORM() ->
            [windows] Die Einstellungen dieses Add-ons ändern
           *[other] Die Einstellungen dieses Add-ons ändern
        }
detail-rating =
    .value = Bewertung
addon-restart-now =
    .label = Jetzt neu starten
disabled-unsigned-heading =
    .value = Einige Add-ons wurden deaktiviert
disabled-unsigned-description = Die folgenden Add-ons wurden nicht für die Verwendung in { -brand-short-name } verifiziert. Sie können <label data-l10n-name="find-addons">nach Alternativen suchen</label> oder die Entwickler bitten, sie verifizieren zu lassen.
disabled-unsigned-learn-more = Erfahren Sie mehr von unseren Bestrebungen, Sie beim Surfen im Internet zu schützen.
disabled-unsigned-devinfo = An der Verifizierung ihrer Add-ons interessierte Entwickler können mehr dazu in unserer <label data-l10n-name="learn-more">Anleitung</label> erfahren.
plugin-deprecation-description = Fehlt etwas? Einige Plugins werden nicht mehr von { -brand-short-name } unterstützt. <label data-l10n-name="learn-more">Weitere Informationen</label>
legacy-warning-show-legacy = Erweiterungen des alten Add-on-Typs anzeigen
legacy-extensions =
    .value = Alter Add-on-Typ
legacy-extensions-description = Diese Erweiterungen erfüllen nicht die aktuellen Standards von { -brand-short-name } und wurden deshalb deaktiviert. <label data-l10n-name="legacy-learn-more">Weitere Informationen über Änderungen bei der Unterstützung von Add-ons für Firefox</label>
extensions-view-discover =
    .name = Add-ons entdecken
    .tooltiptext = { extensions-view-discover.name }
extensions-view-recent-updates =
    .name = Zuletzt durchgeführte Updates
    .tooltiptext = { extensions-view-recent-updates.name }
extensions-view-available-updates =
    .name = Verfügbare Updates
    .tooltiptext = { extensions-view-available-updates.name }

## These are global warnings

extensions-warning-safe-mode-label =
    .value = Alle Add-ons wurden durch den Abgesicherten Modus deaktiviert.
extensions-warning-safe-mode-container =
    .tooltiptext = { extensions-warning-safe-mode-label.value }
extensions-warning-check-compatibility-label =
    .value = Die Addon-Kompatibilitäts-Prüfung ist deaktiviert. Sie könnten inkompatible Add-ons haben.
extensions-warning-check-compatibility-container =
    .tooltiptext = { extensions-warning-check-compatibility-label.value }
extensions-warning-check-compatibility-enable =
    .label = Aktivieren
    .tooltiptext = Addon-Kompatibilitäts-Prüfung aktivieren
extensions-warning-update-security-label =
    .value = Die Überprüfung der Sicherheit von Add-on-Updates ist deaktiviert. Ihre Sicherheit könnte durch Updates kompromittiert worden sein.
extensions-warning-update-security-container =
    .tooltiptext = { extensions-warning-update-security-label.value }
extensions-warning-update-security-enable =
    .label = Aktivieren
    .tooltiptext = Überprüfung auf Sicherheitsupdates für Add-ons aktivieren

## Strings connected to add-on updates

extensions-updates-check-for-updates =
    .label = Auf Updates überprüfen
    .accesskey = A
extensions-updates-view-updates =
    .label = Kürzlich durchgeführte Updates anzeigen
    .accesskey = K

# This menu item is a checkbox that toggles the default global behavior for
# add-on update checking.

extensions-updates-update-addons-automatically =
    .label = Add-ons automatisch aktualisieren
    .accesskey = a

## Specific add-ons can have custom update checking behaviors ("Manually",
## "Automatically", "Use default global behavior"). These menu items reset the
## update checking behavior for all add-ons to the default global behavior
## (which itself is either "Automatically" or "Manually", controlled by the
## extensions-updates-update-addons-automatically.label menu item).

extensions-updates-reset-updates-to-automatic =
    .label = Alle Add-ons umstellen auf automatische Aktualisierung
    .accesskey = u
extensions-updates-reset-updates-to-manual =
    .label = Alle Add-ons umstellen auf manuelle Aktualisierung
    .accesskey = u

## Status messages displayed when updating add-ons

extensions-updates-updating =
    .value = Add-ons werden aktualisiert
extensions-updates-installed =
    .value = Ihre Add-ons wurden aktualisiert.
extensions-updates-downloaded =
    .value = Ihre Add-ons wurden heruntergeladen.
extensions-updates-restart =
    .label = Jetzt neu starten, um die Installation abzuschließen
extensions-updates-none-found =
    .value = Keine Updates gefunden
extensions-updates-manual-updates-found =
    .label = Verfügbare Updates anzeigen
extensions-updates-update-selected =
    .label = Updates installieren
    .tooltiptext = In dieser Liste verfügbare Updates installieren
