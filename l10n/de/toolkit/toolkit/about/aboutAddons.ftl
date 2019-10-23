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
    .value = Du hast in letzter Zeit keine Add-ons aktualisiert
list-empty-find-updates =
    .label = Nach Updates suchen
list-empty-button =
    .label = Mehr über Add-ons erfahren
install-addon-from-file =
    .label = Add-on aus Datei installieren…
    .accesskey = A
recommended-addon =
    .value = Empfohlene Erweiterungen
install-addon-disclaimer = Vorsicht beim Installieren von Add-ons. <label data-l10n-name="addon-risks">Erfahre mehr über die Risiken.</label>
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
    Add-ons sind Anwendungen, mit denen du { -brand-short-name } mit
    zusätzlichen Funktionen oder einem anderen Stil ausstatten kannst. Probiere eine zeitsparende Sidebar, eine Wettervorhersage  oder ein Theme, um deinen ganz persönlichen { -brand-short-name }
    zu bekommen.
discover-footer =
    Wenn du mit dem Internet verbunden bist, wird diese Seite
    einige der besten und populärsten Add-ons zum Ausprobieren anbieten.
detail-version =
    .label = Version
detail-last-updated =
    .label = Zuletzt aktualisiert

detail-contributions-description = Der Entwickler dieses Add-ons bittet dich, dass du die Entwicklung unterstützt, indem du einen kleinen Betrag spendest.

detail-contributions-button = Unterstützen
    .title = Die Entwicklung dieses Add-ons unterstützen
    .accesskey = U

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
# Used as a description for the option to allow or block an add-on in private windows.
detail-private-browsing-label = In Vergessen-Fenstern ausführen
detail-private-browsing-description2 = Falls erlaubt, hat die Erweiterung Zugriff auf deine Online-Aktivitäten im Vergessen-Modus. <label data-l10n-name="detail-private-browsing-learn-more">Weitere Informationen</label>
# Some add-ons may elect to not run in private windows by setting incognito: not_allowed in the manifest.  This
# cannot be overriden by the user.
detail-private-disallowed-label = In Vergessen-Fenstern nicht erlaubt
detail-private-disallowed-description = Die Erweiterung wird in Vergessen-Fenstern nicht ausgeführt. <label data-l10n-name="detail-private-browsing-learn-more">Weitere Informationen</label>

detail-private-disallowed-description2 = Die Erweiterung wird in Vergessen-Fenstern nicht ausgeführt. <a data-l10n-name="learn-more">Weitere Informationen</a>

# Some special add-ons are privileged, run in private windows automatically, and this permission can't be revoked
detail-private-required-label = Benötigt Zugriff auf Vergessen-Fenster
detail-private-required-description = Die Erweiterung hat Zugriff auf deine Online-Aktivitäten in Vergessen-Fenstern. <label data-l10n-name="detail-private-browsing-learn-more">Weitere Informationen</label>

detail-private-required-description2 = Die Erweiterung hat Zugriff auf deine Online-Aktivitäten in Vergessen-Fenstern. <a data-l10n-name="learn-more">Weitere Informationen</a>

detail-private-browsing-on =
    .label = Erlauben
    .tooltiptext = Aktivieren in Vergessen-Fenstern
detail-private-browsing-off =
    .label = Nicht erlauben
    .tooltiptext = Deaktivieren in Vergessen-Fenstern

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
disabled-unsigned-description = Die folgenden Add-ons wurden nicht für die Verwendung in { -brand-short-name } verifiziert. Du kannst <label data-l10n-name="find-addons">nach Alternativen suchen</label> oder die Entwickler bitten, sie verifizieren zu lassen.
disabled-unsigned-learn-more = Erfahre mehr über unsere Bestrebungen, dich beim Surfen im Internet zu schützen.
disabled-unsigned-devinfo = An der Verifizierung ihrer Add-ons interessierte Entwickler können mehr dazu in unserer <label data-l10n-name="learn-more">Anleitung</label> erfahren.
plugin-deprecation-description = Fehlt etwas? Einige Plugins werden nicht mehr von { -brand-short-name } unterstützt. <label data-l10n-name="learn-more">Weitere Informationen</label>
legacy-warning-show-legacy = Erweiterungen des alten Add-on-Typs anzeigen
legacy-extensions =
    .value = Alter Add-on-Typ
legacy-extensions-description = Diese Erweiterungen erfüllen nicht die aktuellen Standards von { -brand-short-name } und wurden deshalb deaktiviert. <label data-l10n-name="legacy-learn-more">Weitere Informationen über Änderungen bei der Unterstützung von Add-ons für Firefox</label>
private-browsing-description2 =
    { -brand-short-name } ändert die Verwendung von Erweiterungen im Vergessen-Modus.
    Neu in { -brand-short-name } installierte Erweiterungen werden standardmäßig in Vergessen-Fenstern nicht ausgeführt und haben keinen Zugriff auf die Online-Aktivitäten in diesen, außer die Erweiterung wird in den Einstellungen für die Verwendung in Vergessen-Fenstern freigegeben.
    Diese Änderung dient deinem Datenschutz im Vergessen-Modus.
    <label data-l10n-name="private-browsing-learn-more">Weitere Informationen zur Verwaltung der Erweiterungseinstellungen</label>
extensions-view-discover =
    .name = Add-ons entdecken
    .tooltiptext = { extensions-view-discover.name }
extensions-view-discopane =
    .name = Empfehlungen
    .tooltiptext = { extensions-view-discopane.name }
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
    .value = Die Addon-Kompatibilitäts-Prüfung ist deaktiviert. Du könntest inkompatible Add-ons haben.
extensions-warning-check-compatibility-container =
    .tooltiptext = { extensions-warning-check-compatibility-label.value }
extensions-warning-check-compatibility-enable =
    .label = Aktivieren
    .tooltiptext = Addon-Kompatibilitäts-Prüfung aktivieren
extensions-warning-update-security-label =
    .value = Die Überprüfung der Sicherheit von Add-on-Updates ist deaktiviert. Deine Sicherheit könnte durch Updates kompromittiert worden sein.
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
    .value = Deine Add-ons wurden aktualisiert.
extensions-updates-downloaded =
    .value = Deine Add-ons wurden heruntergeladen.
extensions-updates-restart =
    .label = Jetzt neu starten, um die Installation abzuschließen
extensions-updates-none-found =
    .value = Keine Updates gefunden
extensions-updates-manual-updates-found =
    .label = Verfügbare Updates anzeigen
extensions-updates-update-selected =
    .label = Updates installieren
    .tooltiptext = In dieser Liste verfügbare Updates installieren

## Extension shortcut management

manage-extensions-shortcuts =
    .label = Tastenkombination für Erweiterungen verwalten
    .accesskey = T
shortcuts-no-addons = Es sind keine Erweiterungen installiert.
shortcuts-no-commands = Folgende Erweiterungen verfügen über keine Tastenkombinationen:
shortcuts-input =
    .placeholder = Tastenkombination drücken

shortcuts-browserAction = Aktion für Erweiterung aktivieren
shortcuts-pageAction = Aktion für Seite aktivieren
shortcuts-sidebarAction = Sidebar umschalten

shortcuts-modifier-mac = Mit Strg-, Alt- oder ⌘-Taste kombinieren
shortcuts-modifier-other = Mit Strg- oder Alt-Taste kombinieren
shortcuts-invalid = Ungültige Kombination
shortcuts-letter = Zeichen eingeben
shortcuts-system = { -brand-short-name }-Tastenkombinationen können nicht überschrieben werden.

# String displayed in warning label when there is a duplicate shortcut
shortcuts-duplicate = Doppelt verwendete Tastenkombination

# String displayed when a keyboard shortcut is already assigned to more than one add-on
# Variables:
#   $shortcut (string) - Shortcut string for the add-on
shortcuts-duplicate-warning-message = { $shortcut } wird mehrmals als Tastenkombination verwendet. Dies kann zu unerwartetem Verhalten führen.

# String displayed when a keyboard shortcut is already used by another add-on
# Variables:
#   $addon (string) - Name of the add-on
shortcuts-exists = Bereits durch { $addon } belegt
shortcuts-card-expand-button =
    { $numberToShow ->
       *[other] { $numberToShow } weitere anzeigen
    }
shortcuts-card-collapse-button = Weniger anzeigen
go-back-button =
    .tooltiptext = Zurück

## Recommended add-ons page

# Explanatory introduction to the list of recommended add-ons. The action word
# ("recommends") in the final sentence is a link to external documentation.
discopane-intro =
    Erweiterungen und Themes sind wie Apps für den Browser und ermöglichen es zum Beispiel,
    Passwörter zu schützen, Videos herunterzuladen, keine Angebote zu verpassen, nervige Werbung zu blockieren,
    das Aussehen des Browsers zu verändern und viel mehr. Diese kleinen Software-Programme werden oft von
    Personen oder Organisationen entwickelt, die keine direkte Verbindung mit dem Browser-Entwickler haben.
    Hier ist eine Auswahl durch { -brand-product-name } von
    <a data-l10n-name="learn-more-trigger">empfohlenen Add-ons</a>, welche für herausragende Sicherheit,
    Leistung und Funktionalität stehen.

# Notice to make user aware that the recommendations are personalized.
discopane-notice-recommendations =
    Einige dieser Empfehlungen sind personalisiert, da sie auf deinen bereits installierten Erweiterungen,
    Profileinstellungen und Nutzungsstatistiken basieren.
discopane-notice-learn-more = Weitere Informationen

privacy-policy = Datenschutzrichtlinie

# Refers to the author of an add-on, shown below the name of the add-on.
# Variables:
#   $author (string) - The name of the add-on developer.
created-by-author = von <a data-l10n-name="author">{ $author }</a>
# Shows the number of daily users of the add-on.
# Variables:
#   $dailyUsers (number) - The number of daily users.
user-count = { $dailyUsers } Nutzer
install-extension-button = Zu { -brand-product-name } hinzufügen
install-theme-button = Theme installieren
# The label of the button that appears after installing an add-on. Upon click,
# the detailed add-on view is opened, from where the add-on can be managed.
manage-addon-button = Verwalten
find-more-addons = Mehr Add-ons ansehen

# This is a label for the button to open the "more options" menu, it is only
# used for screen readers.
addon-options-button =
    .aria-label = Weitere Optionen

## Add-on actions

report-addon-button = Melden
remove-addon-button = Entfernen
disable-addon-button = Deaktivieren
enable-addon-button = Aktivieren
expand-addon-button = Weitere Einstellungen

preferences-addon-button =
    { PLATFORM() ->
        [windows] Einstellungen
       *[other] Einstellungen
    }
details-addon-button = Details
release-notes-addon-button = Versionshinweise
permissions-addon-button = Berechtigungen


addons-enabled-heading = Aktiviert
addons-disabled-heading = Deaktiviert

extension-enabled-heading = Aktiviert
extension-disabled-heading = Deaktiviert

theme-enabled-heading = Aktiviert
theme-disabled-heading = Deaktiviert

plugin-enabled-heading = Aktiviert
plugin-disabled-heading = Deaktiviert

dictionary-enabled-heading = Aktiviert
dictionary-disabled-heading = Deaktiviert

locale-enabled-heading = Aktiviert
locale-disabled-heading = Deaktiviert

ask-to-activate-button = Nachfragen, ob aktiviert werden soll
always-activate-button = Immer aktivieren
never-activate-button = Nie aktivieren

addon-detail-author-label = Autor
addon-detail-version-label = Version
addon-detail-last-updated-label = Zuletzt aktualisiert
addon-detail-homepage-label = Homepage
addon-detail-rating-label = Bewertung

# The average rating that the add-on has received.
# Variables:
#   $rating (number) - A number between 0 and 5. The translation should show at most one digit after the comma.
five-star-rating =
  .title = Bewertet mit { NUMBER($rating, maximumFractionDigits: 1) } von 5

# This string is used to show that an add-on is disabled.
# Variables:
#   $name (string) - The name of the add-on
addon-name-disabled = { $name } (deaktiviert)

# The number of reviews that an add-on has received on AMO.
# Variables:
#   $numberOfReviews (number) - The number of reviews received
addon-detail-reviews-link =
    { $numberOfReviews ->
        [one] { $numberOfReviews } Bewertung
       *[other] { $numberOfReviews } Bewertungen
    }


## Pending uninstall message bar

# Variables:
#   $addon (string) - Name of the add-on
pending-uninstall-description = <span data-l10n-name="addon-name">{ $addon }</span> wurde entfernt.
pending-uninstall-undo-button = Rückgängig

addon-detail-updates-label = Automatische Updates erlauben
addon-detail-updates-radio-default = Standard
addon-detail-updates-radio-on = An
addon-detail-updates-radio-off = Aus
addon-detail-update-check-label = Nach Updates suchen
install-update-button = Aktualisieren

# This is the tooltip text for the private browsing badge in about:addons. The
# badge is the private browsing icon included next to the extension's name.
addon-badge-private-browsing-allowed =
    .title = In privaten Fenstern erlaubt

# This is the tooltip text for the private browsing badge in about:addons. The
# badge is the private browsing icon included next to the extension's name.
addon-badge-private-browsing-allowed2 =
    .title = In Vergessen Fenstern erlaubt
    .aria-label = { addon-badge-private-browsing-allowed2.title }
addon-detail-private-browsing-help = Falls erlaubt, hat die Erweiterung Zugriff auf deine Online-Aktivitäten im Privaten Modus. <a data-l10n-name="learn-more">Weitere Informationen</a>
addon-detail-private-browsing-allow = Erlauben
addon-detail-private-browsing-disallow = Nicht erlauben

# This is the tooltip text for the recommended badge for an extension in about:addons. The
# badge is a small icon displayed next to an extension when it is recommended on AMO.
addon-badge-recommended =
  .title = Empfohlen
  .alt = Empfohlen

# This is the tooltip text for the recommended badge for an extension in about:addons. The
# badge is a small icon displayed next to an extension when it is recommended on AMO.
addon-badge-recommended2 =
  .title = { -brand-product-name } empfiehlt nur Erweiterungen, die unsere Standards für Sicherheit und Leistung erfüllen.
  .aria-label = { addon-badge-recommended2.title }

available-updates-heading = Verfügbare Updates
recent-updates-heading = Kürzlich durchgeführte Updates

release-notes-loading = Wird geladen…
release-notes-error = Es tut uns leid, beim Laden der Versionshinweise trat ein Fehler auf.

addon-permissions-empty = Diese Erweiterung benötigt keine Berechtigungen.

recommended-extensions-heading = Empfohlene Erweiterungen
recommended-themes-heading = Empfohlene Themes
install-recommended-addon = Installieren
recommended-addon-learn-more = Weitere Informationen…

# A recommendation for the Firefox Color theme shown at the bottom of the theme
# list view. The "Firefox Color" name itself should not be translated.
recommended-theme-1 = Fühlst du dich inspiriert? <a data-l10n-name="link">Erstelle eigene Themes mit Firefox Color.</a>
