# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

do-not-track-description = Websites eine "Do Not Track"-Information senden, dass die eigenen Aktivitäten nicht verfolgt werden sollen
do-not-track-learn-more = Weitere Informationen
do-not-track-option-default-content-blocking-known =
    .label = Nur wenn { -brand-short-name } bekannte Elemente zur Aktivitätenverfolgung blockieren soll
do-not-track-option-always =
    .label = Immer
pref-page =
    .title =
        { PLATFORM() ->
            [windows] Einstellungen
           *[other] Einstellungen
        }
# This is used to determine the width of the search field in about:preferences,
# in order to make the entire placeholder string visible
#
# Please keep the placeholder string short to avoid truncation.
#
# Notice: The value of the `.style` attribute is a CSS string, and the `width`
# is the name of the CSS property. It is intended only to adjust the element's width.
# Do not translate.
search-input-box =
    .style = width: 15.4em
    .placeholder =
        { PLATFORM() ->
            [windows] In Einstellungen suchen
           *[other] In Einstellungen suchen
        }
policies-notice =
    { PLATFORM() ->
        [windows] Ihre Organisation hat das Ändern einiger Einstellungen deaktiviert.
       *[other] Ihre Organisation hat das Ändern einiger Einstellungen deaktiviert.
    }
pane-general-title = Allgemein
category-general =
    .tooltiptext = { pane-general-title }
pane-home-title = Startseite
category-home =
    .tooltiptext = { pane-home-title }
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

pane-sync-title2 = { -sync-brand-short-name }
category-sync2 =
    .tooltiptext = { pane-sync-title2 }

help-button-label = Hilfe für { -brand-short-name }
addons-button-label = Erweiterungen & Themes
focus-search =
    .key = f
close-button =
    .aria-label = Schließen

## Browser Restart Dialog

feature-enable-requires-restart = { -brand-short-name } muss neu gestartet werden, um diese Funktion zu aktivieren.
feature-disable-requires-restart = { -brand-short-name } muss neu gestartet werden, um diese Funktion zu deaktivieren.
should-restart-title = { -brand-short-name } neu starten
should-restart-ok = { -brand-short-name } jetzt neu starten
cancel-no-restart-button = Abbrechen
restart-later = Später neu starten

## Extension Control Notifications
##
## These strings are used to inform the user
## about changes made by extensions to browser settings.
##
## <img data-l10n-name="icon"/> is going to be replaced by the extension icon.
##
## Variables:
##   $name (String): name of the extension

# This string is shown to notify the user that their home page
# is being controlled by an extension.
extension-controlled-homepage-override = Die Erweiterung "<img data-l10n-name="icon"/> { $name }" verwaltet die Startseite.
# This string is shown to notify the user that their new tab page
# is being controlled by an extension.
extension-controlled-new-tab-url = Die Erweiterung "<img data-l10n-name="icon"/> { $name }" verwaltet die Startseite neuer Tabs.
# This string is shown to notify the user that their notifications permission
# is being controlled by an extension.
extension-controlled-web-notifications = Die Erweiterung <img data-l10n-name="icon"/> { $name } kontrolliert diese Einstellung.
# This string is shown to notify the user that the default search engine
# is being controlled by an extension.
extension-controlled-default-search = Die Erweiterung "<img data-l10n-name="icon"/> { $name }" hat die Standardsuchmaschine festgelegt.
# This string is shown to notify the user that Container Tabs
# are being enabled by an extension.
extension-controlled-privacy-containers = Die Erweiterung <img data-l10n-name="icon"/> { $name } verwaltet die Tab-Umgebungen.
# This string is shown to notify the user that their content blocking "All Detected Trackers"
# preferences are being controlled by an extension.
extension-controlled-websites-content-blocking-all-trackers = Die Erweiterung <img data-l10n-name="icon"/> { $name } kontrolliert diese Einstellung.
# This string is shown to notify the user that their proxy configuration preferences
# are being controlled by an extension.
extension-controlled-proxy-config = Die Erweiterung "<img data-l10n-name="icon"/> { $name }" kontrolliert, wie { -brand-short-name } mit dem Internet verbindet.
# This string is shown after the user disables an extension to notify the user
# how to enable an extension that they disabled.
#
# <img data-l10n-name="addons-icon"/> will be replaced with Add-ons icon
# <img data-l10n-name="menu-icon"/> will be replaced with Menu icon
extension-controlled-enable = Um die Erweiterung zu aktivieren, öffnen Sie das <img data-l10n-name="menu-icon"/> Menü und dann <img data-l10n-name="addons-icon"/> Add-ons.

## Preferences UI Search Results

search-results-header = Suchergebnisse
# `<span data-l10n-name="query"></span>` will be replaced by the search term.
search-results-empty-message =
    { PLATFORM() ->
        [windows] Keine Treffer in den Einstellungen für "<span data-l10n-name="query"></span>".
       *[other] Keine Treffer in den Einstellungen für "<span data-l10n-name="query"></span>".
    }
search-results-help-link = Benötigen Sie Hilfe? Dann besuchen Sie die <a data-l10n-name="url">Hilfeseite für { -brand-short-name }</a>.

## General Section

startup-header = Start
# { -brand-short-name } will be 'Firefox Developer Edition',
# since this setting is only exposed in Firefox Developer Edition
separate-profile-mode =
    .label = Gleichzeitiges Ausführen von { -brand-short-name } und Firefox erlauben
use-firefox-sync = Tipp: Dabei werden getrennte Profile verwendet. Verwenden Sie { -sync-brand-short-name }, um Daten zwischen diesen zu synchronisieren.
get-started-not-logged-in = Bei { -sync-brand-short-name } anmelden…
get-started-configured = { -sync-brand-short-name }-Einstellungen öffnen
always-check-default =
    .label = Immer überprüfen, ob { -brand-short-name } der Standardbrowser ist
    .accesskey = p
is-default = { -brand-short-name } ist derzeit der Standardbrowser
is-not-default = { -brand-short-name } ist nicht Ihr Standardbrowser
set-as-my-default-browser =
    .label = Als Standard festlegen…
    .accesskey = g
startup-restore-previous-session =
    .label = Vorherige Sitzung wiederherstellen
    .accesskey = o
startup-restore-warn-on-quit =
    .label = Beim Beenden des Browsers warnen
disable-extension =
    .label = Erweiterung deaktivieren
tabs-group-header = Tabs
ctrl-tab-recently-used-order =
    .label = Bei Strg+Tab die Tabs nach letzter Nutzung in absteigender Reihenfolge anzeigen
    .accesskey = z
open-new-link-as-tabs =
    .label = Links in Tabs anstatt in neuen Fenstern öffnen
    .accesskey = T
warn-on-close-multiple-tabs =
    .label = Warnen, wenn mehrere Tabs geschlossen werden
    .accesskey = m
warn-on-open-many-tabs =
    .label = Warnen, wenn das gleichzeitige Öffnen mehrerer Tabs { -brand-short-name } verlangsamen könnte
    .accesskey = c
switch-links-to-new-tabs =
    .label = Tabs im Vordergrund öffnen
    .accesskey = V
show-tabs-in-taskbar =
    .label = Tab-Vorschauen in der Windows-Taskleiste anzeigen
    .accesskey = k
browser-containers-enabled =
    .label = Tab-Umgebungen aktivieren
    .accesskey = a
browser-containers-learn-more = Weitere Informationen
browser-containers-settings =
    .label = Einstellungen…
    .accesskey = u
containers-disable-alert-title = Alle Tabs im Umgebungen schließen?
containers-disable-alert-desc =
    { $tabCount ->
        [one] Falls die Funktion "Tab-Umgebungen" jetzt deaktiviert wird, so wird { $tabCount } Tab in einer Umgebung geschlossen. Soll die Funktion "Tab-Umgebungen" wirklich deaktiviert werden?
       *[other] Falls die Funktion "Tab-Umgebungen" jetzt deaktiviert wird, so werden { $tabCount } Tabs in Umgebungen geschlossen. Soll die Funktion "Tab-Umgebungen" wirklich deaktiviert werden?
    }
containers-disable-alert-ok-button =
    { $tabCount ->
        [one] { $tabCount } Tab in einer Umgebung schließen
       *[other] { $tabCount } Tabs im Umgebungen schließen
    }
containers-disable-alert-cancel-button = Aktiviert belassen
containers-remove-alert-title = Diese Umgebung löschen?
# Variables:
#   $count (Number) - Number of tabs that will be closed.
containers-remove-alert-msg =
    { $count ->
        [one] Wenn diese Umgebung jetzt gelöscht wird, so wird { $count } Tab aus dieser Umgebung geschlossen. Soll diese Umgebung wirklich gelöscht werden?
       *[other] Wenn diese Umgebung jetzt gelöscht wird, so werden { $count } Tab aus dieser Umgebung geschlossen. Soll diese Umgebung wirklich gelöscht werden?
    }
containers-remove-ok-button = Umgebung löschen
containers-remove-cancel-button = Umgebung behalten

## General Section - Language & Appearance

language-and-appearance-header = Sprache und Erscheinungsbild
fonts-and-colors-header = Schriftarten & Farben
default-font = Standard-Schriftart
    .accesskey = S
default-font-size = Größe
    .accesskey = G
advanced-fonts =
    .label = Erweitert…
    .accesskey = E
colors-settings =
    .label = Farben…
    .accesskey = F
language-header = Sprache
choose-language-description = Bevorzugte Sprachen für die Darstellung von Websites wählen
choose-button =
    .label = Wählen…
    .accesskey = W
choose-browser-language-description = Sprache für die Anzeige von Menüs, Mitteilungen und Benachrichtigungen von { -brand-short-name }
manage-browser-languages-button =
    .label = Alternative Sprachen festlegen…
    .accesskey = S
confirm-browser-language-change-description = { -brand-short-name } muss neu gestartet werden, um die Änderungen zu übernehmen.
confirm-browser-language-change-button = Anwenden und neu starten
translate-web-pages =
    .label = Web-Inhalte übersetzen
    .accesskey = z
# The <img> element is replaced by the logo of the provider
# used to provide machine translations for web pages.
translate-attribution = Übersetzung mittels <img data-l10n-name="logo"/>
translate-exceptions =
    .label = Ausnahmen…
    .accesskey = u
check-user-spelling =
    .label = Rechtschreibung während der Eingabe überprüfen
    .accesskey = R

## General Section - Files and Applications

files-and-applications-title = Dateien und Anwendungen
download-header = Downloads
download-save-to =
    .label = Alle Dateien in folgendem Ordner abspeichern:
    .accesskey = e
download-choose-folder =
    .label =
        { PLATFORM() ->
            [macos] Auswählen…
           *[other] Durchsuchen…
        }
    .accesskey =
        { PLATFORM() ->
            [macos] u
           *[other] D
        }
download-always-ask-where =
    .label = Jedes Mal nachfragen, wo eine Datei gespeichert werden soll
    .accesskey = n
applications-header = Anwendungen
applications-description = Legen Sie fest, wie { -brand-short-name } mit Dateien verfährt, die Sie aus dem Web oder aus Anwendungen, die Sie beim Surfen verwenden, herunterladen.
applications-filter =
    .placeholder = Dateitypen oder Anwendungen suchen
applications-type-column =
    .label = Dateityp
    .accesskey = D
applications-action-column =
    .label = Aktion
    .accesskey = A
drm-content-header = Inhalte mit DRM-Kopierschutz
play-drm-content =
    .label = Inhalte mit DRM-Kopierschutz wiedergeben
    .accesskey = D
play-drm-content-learn-more = Weitere Informationen
update-application-title = { -brand-short-name }-Updates
update-application-description = { -brand-short-name } aktuell halten, um höchste Leistung, Stabilität und Sicherheit zu erfahren.
update-application-version = Version { $version } <a data-l10n-name="learn-more">Neue Funktionen und Änderungen</a>
update-history =
    .label = Update-Chronik anzeigen…
    .accesskey = C
update-application-allow-description = { -brand-short-name } erlauben
update-application-auto =
    .label = Updates automatisch zu installieren (empfohlen)
    .accesskey = U
update-application-check-choose =
    .label = Nach Updates zu suchen, aber vor der Installation nachfragen
    .accesskey = N
update-application-manual =
    .label = Nicht nach Updates suchen (nicht empfohlen)
    .accesskey = d

update-application-warning-cross-user-setting = Diese Einstellung betrifft alle Windows-Konten und { -brand-short-name }-Profile, welche diese Installation von { -brand-short-name } verwenden.

update-application-use-service =
    .label = Einen Hintergrunddienst verwenden, um Updates zu installieren
    .accesskey = g
update-enable-search-update =
    .label = Suchmaschinen automatisch aktualisieren
    .accesskey = S
update-pref-write-failure-title = Schreibfehler
# Variables:
#   $path (String) - Path to the configuration file
update-pref-write-failure-message = Einstellung konnte nicht gespeichert werden. Fehler beim Schreiben dieser Datei: { $path }

## General Section - Performance

performance-title = Leistung
performance-use-recommended-settings-checkbox =
    .label = Empfohlene Leistungseinstellungen verwenden
    .accesskey = E
performance-use-recommended-settings-desc = Diese Einstellungen sind für die Hardware und das Betriebssystem des Computers optimiert.
performance-settings-learn-more = Weitere Informationen
performance-allow-hw-accel =
    .label = Hardwarebeschleunigung verwenden, wenn verfügbar
    .accesskey = v
performance-limit-content-process-option = Maximale Anzahl an Inhaltsprozessen
    .accesskey = M
performance-limit-content-process-enabled-desc = Mehr Inhaltsprozesse verbessern die Leistung bei Verwendung mehrerer Tabs, aber nutzen auch mehr Arbeitsspeicher.
performance-limit-content-process-blocked-desc = Das Ändern der Anzahl der Inhaltsprozesse ist nur in { -brand-short-name } mit mehreren Prozessen möglich. <a data-l10n-name="learn-more">Wie Sie herausfinden, ob Firefox mit mehreren Prozessen ausgeführt wird</a>
# Variables:
#   $num - default value of the `dom.ipc.processCount` pref.
performance-default-content-process-count =
    .label = { $num } (Standard)

## General Section - Browsing

browsing-title = Surfen
browsing-use-autoscroll =
    .label = Automatischen Bildlauf aktivieren
    .accesskey = A
browsing-use-smooth-scrolling =
    .label = Sanften Bildlauf aktivieren
    .accesskey = S
browsing-use-onscreen-keyboard =
    .label = Bildschirmtastatur falls notwendig anzeigen
    .accesskey = B
browsing-use-cursor-navigation =
    .label = Markieren von Text mit der Tastatur zulassen
    .accesskey = M
browsing-search-on-start-typing =
    .label = Beim Tippen automatisch im Seitentext suchen
    .accesskey = u
browsing-cfr-recommendations =
    .label = Erweiterungen während des Surfens empfehlen
    .accesskey = h

browsing-cfr-features =
    .label = Funktionen während des Surfens empfehlen
    .accesskey = F

browsing-cfr-recommendations-learn-more = Weitere Informationen

## General Section - Proxy

network-settings-title = Verbindungs-Einstellungen
network-proxy-connection-description = Jetzt festlegen, wie sich { -brand-short-name } mit dem Internet verbindet.
network-proxy-connection-learn-more = Weitere Informationen
network-proxy-connection-settings =
    .label = Einstellungen…
    .accesskey = n

## Home Section

home-new-windows-tabs-header = Neue Fenster und Tabs
home-new-windows-tabs-description2 = Legen Sie fest, was als Startseite sowie in neuen Fenstern und Tabs geöffnet wird.

## Home Section - Home Page Customization

home-homepage-mode-label = Startseite und neue Fenster
home-newtabs-mode-label = Neue Tabs
home-restore-defaults =
    .label = Standard wiederherstellen
    .accesskey = w
# "Firefox" should be treated as a brand and kept in English,
# while "Home" and "(Default)" can be localized.
home-mode-choice-default =
    .label = Firefox-Startseite (Standard)
home-mode-choice-custom =
    .label = Benutzerdefinierte Adressen…
home-mode-choice-blank =
    .label = Leere Seite
home-homepage-custom-url =
    .placeholder = Adresse einfügen…
# This string has a special case for '1' and [other] (default). If necessary for
# your language, you can add {$tabCount} to your translations and use the
# standard CLDR forms, or only use the form for [other] if both strings should
# be identical.
use-current-pages =
    .label =
        { $tabCount ->
            [1] Aktuelle Seite verwenden
           *[other] Aktuelle Seiten verwenden
        }
    .accesskey = A
choose-bookmark =
    .label = Lesezeichen verwenden…
    .accesskey = L

## Search Section

search-bar-header = Suchleiste
search-bar-hidden =
    .label = Adressleiste für Suche und Seitenaufrufe verwenden
search-bar-shown =
    .label = Suchleiste zur Symbolleiste hinzufügen
search-engine-default-header = Standardsuchmaschine
search-engine-default-desc = Wählen Sie Ihre Standardsuchmaschine für die Adress- und Suchleiste.
search-suggestions-option =
    .label = Suchvorschläge anzeigen
    .accesskey = S
search-show-suggestions-url-bar-option =
    .label = Suchvorschläge in Adressleiste anzeigen
    .accesskey = v
# This string describes what the user will observe when the system
# prioritizes search suggestions over browsing history in the results
# that extend down from the address bar. In the original English string,
# "ahead" refers to location (appearing most proximate to), not time
# (appearing before).
search-show-suggestions-above-history-option =
    .label = In Adressleiste Suchvorschläge vor Einträgen aus der Browser-Chronik anzeigen
search-suggestions-cant-show = Suchvorschläge werden nicht in der Adressleiste angezeigt, weil { -brand-short-name } angewiesen wurde, keine Chronik zu speichern.
search-one-click-header = Ein-Klick-Suchmaschinen
search-one-click-desc = Wählen Sie die Suchmaschinen, welche unterhalb der Adress- bzw. Suchleiste angezeigt werden, nachdem Sie den Suchbegriff eingegeben haben.
search-choose-engine-column =
    .label = Suchmaschine
search-choose-keyword-column =
    .label = Schlüsselwort
search-restore-default =
    .label = Standardsuchmaschinen wiederherstellen
    .accesskey = w
search-remove-engine =
    .label = Entfernen
    .accesskey = E
search-find-more-link = Weitere Suchmaschinen hinzufügen
# This warning is displayed when the chosen keyword is already in use
# ('Duplicate' is an adjective)
search-keyword-warning-title = Schlüsselwort duplizieren
# Variables:
#   $name (String) - Name of a search engine.
search-keyword-warning-engine = Sie haben ein Schlüsselwort ausgewählt, das bereits von "{ $name }" verwendet wird, bitte wählen Sie ein anderes.
search-keyword-warning-bookmark = Sie haben ein Schlüsselwort ausgewählt, das bereits von einem Lesezeichen verwendet wird, bitte wählen Sie ein anderes.

## Containers Section

containers-back-link = « Zurück
containers-header = Tab-Umgebungen
containers-add-button =
    .label = Neue Umgebung hinzufügen
    .accesskey = N
containers-preferences-button =
    .label = Einstellungen
containers-remove-button =
    .label = Löschen

## Sync Section - Signed out

sync-signedout-caption = So haben Sie das Web überall dabei.
sync-signedout-description = Synchronisieren Sie Ihre Lesezeichen, Chronik, Tabs, Passwörter, Add-ons und Einstellungen zwischen allen Ihren Geräten.
sync-signedout-account-title = Verbinden Sie mit einem { -fxaccount-brand-name }
sync-signedout-account-create = Haben Sie noch kein Konto? Erstellen Sie eines.
    .accesskey = H
sync-signedout-account-signin =
    .label = Anmelden…
    .accesskey = A
# This message contains two links and two icon images.
#   `<img data-l10n-name="android-icon"/>` - Android logo icon
#   `<a data-l10n-name="android-link">` - Link to Android Download
#   `<img data-l10n-name="ios-icon">` - iOS logo icon
#   `<a data-l10n-name="ios-link">` - Link to iOS Download
#
# They can be moved within the sentence as needed to adapt
# to your language, but should not be changed or translated.
sync-mobile-promo = Firefox für <img data-l10n-name="android-icon"/> <a data-l10n-name="android-link">Android</a> oder <img data-l10n-name="ios-icon"/> <a data-l10n-name="ios-link">iOS</a> herunterladen, um mit Ihrem Handy zu synchronisieren.

## Sync Section - Signed in

sync-profile-picture =
    .tooltiptext = Profilbild ändern
sync-disconnect =
    .label = Trennen…
    .accesskey = r
sync-manage-account = Konto verwalten
    .accesskey = v
sync-signedin-unverified = { $email } wurde noch nicht bestätigt.
sync-signedin-login-failure = Melden Sie sich an, um erneut mit { $email } zu verbinden.
sync-resend-verification =
    .label = E-Mail zur Verifizierung erneut senden
    .accesskey = V
sync-remove-account =
    .label = Konto entfernen
    .accesskey = e
sync-sign-in =
    .label = Anmelden
    .accesskey = m
sync-signedin-settings-header = Sync-Einstellungen
sync-signedin-settings-desc = Wählen Sie die zwischen den Geräten zu synchronisierenden { -brand-short-name }-Eigenschaften.
sync-engine-bookmarks =
    .label = Lesezeichen
    .accesskey = L
sync-engine-history =
    .label = Chronik
    .accesskey = C
sync-engine-tabs =
    .label = Offene Tabs
    .tooltiptext = Liste aller offenen Tabs von allen verbundenen Geräten
    .accesskey = T
sync-engine-logins =
    .label = Zugangsdaten
    .tooltiptext = Durch Sie gespeicherte Benutzernamen und Passwörter
    .accesskey = Z
sync-engine-addresses =
    .label = Adressen
    .tooltiptext = Durch Sie gespeicherte postalische Adressen (nur für Desktops)
    .accesskey = d
sync-engine-creditcards =
    .label = Kreditkarten
    .tooltiptext = Namen, Nummern und Gültigkeitsdatum (nur für Desktops)
    .accesskey = K
sync-engine-addons =
    .label = Add-ons
    .tooltiptext = Erweiterungen und Themes für Firefox für Desktops
    .accesskey = A
sync-engine-prefs =
    .label =
        { PLATFORM() ->
            [windows] Einstellungen
           *[other] Einstellungen
        }
    .tooltiptext = Durch Sie geänderte allgemeine, Datenschutz- und Sicherheitseinstellungen
    .accesskey = E
sync-device-name-header = Gerätename
sync-device-name-change =
    .label = Gerät umbenennen…
    .accesskey = u
sync-device-name-cancel =
    .label = Abbrechen
    .accesskey = b
sync-device-name-save =
    .label = Speichern
    .accesskey = S
sync-mobilepromo-single = Weiteres Gerät verbinden
sync-mobilepromo-multi = Geräte verwalten

sync-connect-another-device = Weiteres Gerät verbinden

sync-manage-devices = Geräte verwalten

sync-fxa-begin-pairing = Gerät verbinden

sync-tos-link = Nutzungsbedingungen
sync-fxa-privacy-notice = Datenschutzhinweis

## Privacy Section

privacy-header = Browser-Datenschutz

## Privacy Section - Forms

logins-header = Zugangsdaten & Passwörter
forms-ask-to-save-logins =
    .label = Fragen, ob Zugangsdaten und Passwörter für Websites gespeichert werden sollen
    .accesskey = Z
forms-exceptions =
    .label = Ausnahmen…
    .accesskey = u
forms-saved-logins =
    .label = Gespeicherte Zugangsdaten…
    .accesskey = G
forms-master-pw-use =
    .label = Master-Passwort verwenden
    .accesskey = v
forms-master-pw-change =
    .label = Master-Passwort ändern…
    .accesskey = M

## Privacy Section - History

history-header = Chronik
# This label is followed, on the same line, by a dropdown list of options
# (Remember history, etc.).
# In English it visually creates a full sentence, e.g.
# "Firefox will" + "Remember history".
#
# If this doesn't work for your language, you can translate this message:
#   - Simply as "Firefox", moving the verb into each option.
#     This will result in "Firefox" + "Will remember history", etc.
#   - As a stand-alone message, for example "Firefox history settings:".
history-remember-label = { -brand-short-name } wird eine Chronik
    .accesskey = F
history-remember-option-all =
    .label = anlegen
history-remember-option-never =
    .label = niemals anlegen
history-remember-option-custom =
    .label = nach benutzerdefinierten Einstellungen anlegen
history-remember-description = { -brand-short-name } wird die Adressen der besuchten Webseiten, Downloads sowie eingebene Formular- und Suchdaten speichern.
history-dontremember-description = { -brand-short-name } wird dieselben Einstellungen wie im Privaten Modus verwenden und keinerlei Chronik anlegen, während Sie { -brand-short-name } benutzen.
history-private-browsing-permanent =
    .label = Immer den Privaten Modus verwenden
    .accesskey = M
history-remember-browser-option =
    .label = Besuchte Seiten und Download-Chronik speichern
    .accesskey = w
history-remember-search-option =
    .label = Eingegebene Suchbegriffe und Formulardaten speichern
    .accesskey = S
history-clear-on-close-option =
    .label = Die Chronik löschen, wenn { -brand-short-name } geschlossen wird
    .accesskey = g
history-clear-on-close-settings =
    .label = Einstellungen…
    .accesskey = E
history-clear-button =
    .label = Chronik leeren…
    .accesskey = C

## Privacy Section - Site Data

sitedata-header = Cookies und Website-Daten
sitedata-total-size-calculating = Größe von Website-Daten und Cache wird berechnet…
# Variables:
#   $value (Number) - Value of the unit (for example: 4.6, 500)
#   $unit (String) - Name of the unit (for example: "bytes", "KB")
sitedata-total-size = Die gespeicherten Cookies, Website-Daten und der Cache belegen derzeit { $value } { $unit } Speicherplatz.
sitedata-learn-more = Weitere Informationen
sitedata-delete-on-close =
    .label = Cookies und Website-Daten beim Beenden von { -brand-short-name } löschen
    .accesskey = B
sitedata-delete-on-close-private-browsing = Wenn der Private Modus immer verwendet wird, löscht { -brand-short-name } Cookies und Website-Daten beim Beenden.
sitedata-allow-cookies-option =
    .label = Annehmen von Cookies und Website-Daten
    .accesskey = A
sitedata-disallow-cookies-option =
    .label = Blockieren von Cookies und Website-Daten
    .accesskey = B
# This label means 'type of content that is blocked', and is followed by a drop-down list with content types below.
# The list items are the strings named sitedata-block-*-option*.
sitedata-block-desc = Zu blockieren:
    .accesskey = Z
sitedata-option-block-trackers =
    .label = Nutzer verfolgende Elemente von Drittanbietern
sitedata-option-block-unvisited =
    .label = Cookies von nicht besuchten Websites
sitedata-option-block-all-third-party =
    .label = Alle Cookies von Drittanbietern (einige Websites funktionieren dann eventuell nicht mehr)
sitedata-option-block-all =
    .label = Alle Cookies (einige Websites funktionieren dann nicht mehr)
sitedata-clear =
    .label = Daten entfernen…
    .accesskey = e
sitedata-settings =
    .label = Daten verwalten…
    .accesskey = v
sitedata-cookies-permissions =
    .label = Berechtigungen verwalten…
    .accesskey = B

## Privacy Section - Address Bar

addressbar-header = Adressleiste
addressbar-suggest = Beim Verwenden der Adressleiste Folgendes vorschlagen:
addressbar-locbar-history-option =
    .label = Einträge aus der Chronik
    .accesskey = C
addressbar-locbar-bookmarks-option =
    .label = Einträge aus den Lesezeichen
    .accesskey = L
addressbar-locbar-openpage-option =
    .label = Offene Tabs
    .accesskey = O
addressbar-suggestions-settings = Einstellungen für Suchvorschläge ändern

## Privacy Section - Content Blocking

content-blocking-header = Seitenelemente blockieren
content-blocking-description = Blockiert eingebettete Inhalte anderer Websites, welche Ihre Aktivitäten im Internet verfolgen. Kontrollieren Sie den Umfang Ihrer Online-Aktivitäten, welche von Websites gespeichert und mit anderen Websites ausgetauscht werden.
content-blocking-learn-more = Weitere Informationen
# The terminology used to refer to categories of Content Blocking is also used in chrome/browser/browser.properties and should be translated consistently.
# "Standard" in this case is an adjective, meaning "default" or "normal".
content-blocking-setting-standard =
    .label = Standard
    .accesskey = S
content-blocking-setting-strict =
    .label = Streng
    .accesskey = r
content-blocking-setting-custom =
    .label = Benutzerdefiniert
    .accesskey = B
content-blocking-standard-description = Nur in privaten Fenstern bekannte Elemente zur Aktivitätenverfolgung blockieren
content-blocking-standard-desc = Ausgewogenes Blockieren für gleichzeitigen Schutz und Leistung. Einige Elemente zur Aktivitätenverfolgung werden erlaubt, damit Websites funktionieren.
content-blocking-strict-desc = Alle von { -brand-short-name } erkannten Elemente zur Aktivitätenverfolgung blockieren. Einige Websites funktionieren dann eventuell nicht richtig.
content-blocking-custom-desc = Entsprechend den Einstellungen blockieren:
content-blocking-private-trackers = Bekannte Elemente zur Aktivitätenverfolgung nur in privaten Fenstern
content-blocking-third-party-cookies = Cookies zur Aktivitätenverfolgung von Drittanbietern
content-blocking-all-windows-trackers = Erkannte Elemente zur Aktivitätenverfolgung in allen Fenstern
content-blocking-all-third-party-cookies = Alle Cookies von Drittanbietern
content-blocking-warning-title = Achtung!
content-blocking-warning-desc = Das Blockieren von Cookies und Elementen zur Aktivitätenverfolgung kann zu Problemen mit einigen Websites führen. Deshalb können Sie die Funktion für Websites, denen Sie vertrauen, leicht deaktivieren.
content-blocking-warning-description = Das Blockieren von Inhalten kann bei einigen Websites zu Problemen führen. Das Deaktivieren des Blockierens für von Ihnen vertraute Seiten ist ganz einfach.
content-blocking-learn-how = Erfahren Sie mehr

content-blocking-reload-description = Um die Änderungen anzuwenden, müssen alle Tabs neu geladen werden.
content-blocking-reload-tabs-button =
  .label = Alle Tabs neu laden
  .accesskey = T

content-blocking-trackers-label =
    .label = Elemente zur Aktivitätenverfolgung
    .accesskey = E
content-blocking-tracking-protection-option-all-windows =
    .label = In allen Fenstern
    .accesskey = a
content-blocking-option-private =
    .label = Nur in privaten Fenstern
    .accesskey = p
content-blocking-tracking-protection-change-block-list = Blockierliste ändern
content-blocking-cookies-label =
    .label = Cookies
    .accesskey = C

content-blocking-expand-section = 
  .tooltiptext = Weitere Informationen

# Cryptomining refers to using scripts on websites that can use a computer’s resources to mine cryptocurrency without a user’s knowledge.
content-blocking-cryptominers-label =
  .label = Heimliche Digitalwährungsberechner (Krypto-Miner)
  .accesskey = w

# Browser fingerprinting is a method of tracking users by the configuration and settings information (their "digital fingerprint")
# that is visible to websites they browse, rather than traditional tracking methods such as IP addresses and unique cookies.
content-blocking-fingerprinters-label =
  .label = Identifizierer (Fingerprinter)
  .accesskey = d

## Privacy Section - Tracking

tracking-manage-exceptions =
    .label = Ausnahmen verwalten…
    .accesskey = v

## Privacy Section - Permissions

permissions-header = Berechtigungen
permissions-location = Standort
permissions-location-settings =
    .label = Einstellungen…
    .accesskey = E
permissions-camera = Kamera
permissions-camera-settings =
    .label = Einstellungen…
    .accesskey = E
permissions-microphone = Mikrofon
permissions-microphone-settings =
    .label = Einstellungen…
    .accesskey = E
permissions-notification = Benachrichtigungen
permissions-notification-settings =
    .label = Einstellungen…
    .accesskey = E
permissions-notification-link = Weitere Informationen
permissions-notification-pause =
    .label = Benachrichtigungen bis zum Neustart von { -brand-short-name } deaktivieren
    .accesskey = n
permissions-block-autoplay-media =
    .label = Automatische Wiedergabe von Medien mit Ton durch Websites verhindern
    .accesskey = W
permissions-block-autoplay-media-menu = Bei automatischer Wiedergabe von Ton durch Websites

permissions-block-autoplay-media2 =
    .label = Automatische Wiedergabe von Audio-Inhalten verhindern
    .accesskey = u

permissions-block-autoplay-media-exceptions =
    .label = Ausnahmen…
    .accesskey = A
autoplay-option-ask =
    .label = Immer fragen
autoplay-option-allow =
    .label = Erlauben
autoplay-option-dont =
    .label = Nicht automatisch wiedergeben
permissions-autoplay-link = Weitere Informationen
permissions-block-popups =
    .label = Pop-up-Fenster blockieren
    .accesskey = P
permissions-block-popups-exceptions =
    .label = Ausnahmen…
    .accesskey = A
permissions-addon-install-warning =
    .label = Warnen, wenn Websites versuchen, Add-ons zu installieren
    .accesskey = W
permissions-addon-exceptions =
    .label = Ausnahmen…
    .accesskey = A
permissions-a11y-privacy-checkbox =
    .label = Externen Anwendungen den Zugriff auf den Dienst für Barrierefreiheit in Firefox verweigern
    .accesskey = B
permissions-a11y-privacy-link = Weitere Informationen

## Privacy Section - Data Collection

collection-header = Datenerhebung durch { -brand-short-name } und deren Verwendung
collection-description = Wir lassen Ihnen die Wahl, ob Sie uns Daten senden, und sammeln nur die Daten, welche erforderlich sind, um { -brand-short-name } für jeden anbieten und verbessern zu können. Wir fragen immer um Ihre Erlaubnis, bevor wir persönliche Daten senden.
collection-privacy-notice = Datenschutzhinweis
collection-health-report =
    .label = { -brand-short-name } erlauben, Daten zu technischen Details und Interaktionen an { -vendor-short-name } zu senden
    .accesskey = t
collection-health-report-link = Weitere Informationen
collection-studies =
    .label = { -brand-short-name } das Installieren und Durchführen von Studien erlauben
collection-studies-link = { -brand-short-name }-Studien ansehen
addon-recommendations =
    .label = Personalisierte Erweiterungsempfehlungen durch { -brand-short-name }
addon-recommendations-link = Weitere Informationen
# This message is displayed above disabled data sharing options in developer builds
# or builds with no Telemetry support available.
collection-health-report-disabled = Datenübermittlung ist für diese Build-Konfiguration deaktiviert
collection-browser-errors =
    .label = { -brand-short-name } erlauben, Browser-Fehler einschließlich Fehlermeldungen automatisch an { -vendor-short-name } zu melden
    .accesskey = B
collection-browser-errors-link = Weitere Informationen
collection-backlogged-crash-reports =
    .label = Nicht gesendete Absturzberichte automatisch von { -brand-short-name } senden lassen
    .accesskey = g
collection-backlogged-crash-reports-link = Weitere Informationen

## Privacy Section - Security
##
## It is important that wording follows the guidelines outlined on this page:
## https://developers.google.com/safe-browsing/developers_guide_v2#AcceptableUsage

security-header = Sicherheit
security-browsing-protection = Schutz vor betrügerischen Inhalten und gefährlicher Software
security-enable-safe-browsing =
    .label = Gefährliche und betrügerische Inhalte blockieren
    .accesskey = b
security-enable-safe-browsing-link = Weitere Informationen
security-block-downloads =
    .label = Gefährliche Downloads blockieren
    .accesskey = D
security-block-uncommon-software =
    .label = Vor unerwünschter und ungewöhnlicher Software warnen
    .accesskey = S

## Privacy Section - Certificates

certs-header = Zertifikate
certs-personal-label = Wenn eine Website nach dem persönlichen Sicherheitszertifikat verlangt
certs-select-auto-option =
    .label = Automatisch eins wählen
    .accesskey = w
certs-select-ask-option =
    .label = Jedes Mal fragen
    .accesskey = J
certs-enable-ocsp =
    .label = Aktuelle Gültigkeit von Zertifikaten durch Anfrage bei OCSP-Server bestätigen lassen
    .accesskey = G
certs-view =
    .label = Zertifikate anzeigen…
    .accesskey = Z
certs-devices =
    .label = Kryptographie-Module…
    .accesskey = K
space-alert-learn-more-button =
    .label = Weitere Informationen
    .accesskey = W
space-alert-over-5gb-pref-button =
    .label =
        { PLATFORM() ->
            [windows] Einstellungen öffnen
           *[other] Einstellungen öffnen
        }
    .accesskey =
        { PLATFORM() ->
            [windows] E
           *[other] E
        }
space-alert-over-5gb-message =
    { PLATFORM() ->
        [windows] { -brand-short-name } hat nur noch wenig Speicherplatz zur Verfügung. Webinhalte werden eventuell nicht richtig angezeigt. Sie können gespeicherte Daten im Menü Einstellungen > Datenschutz & Sicherheit > Cookies und Website-Daten löschen.
       *[other] { -brand-short-name } verfügt über nur noch wenig freien Speicherplatz. Website-Inhalte werden vielleicht nicht richtig angezeigt. Sie können gespeicherte Daten im Menü Einstellungen > Datenschutz & Sicherheit > Cookies und Website-Daten löschen.
    }
space-alert-under-5gb-ok-button =
    .label = OK
    .accesskey = O
space-alert-under-5gb-message = { -brand-short-name } verfügt über nur noch wenig freien Speicherplatz. Website-Inhalte werden vielleicht nicht richtig angezeigt. Besuchen Sie "Weitere Informationen", um die Speichernutzung für ein besseres Weberlebnis zu optimieren.

## The following strings are used in the Download section of settings

desktop-folder-name = Desktop
downloads-folder-name = Downloads
choose-download-folder-title = Download-Ordner wählen:
# Variables:
#   $service-name (String) - Name of a cloud storage provider like Dropbox, Google Drive, etc...
save-files-to-cloud-storage =
    .label = Speichert Dateien in { $service-name }
