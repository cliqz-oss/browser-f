# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


## These messages are used as headings in the recommendation doorhanger

cfr-doorhanger-extension-heading = Empfohlene Erweiterung
cfr-doorhanger-feature-heading = Empfohlene Funktion
cfr-doorhanger-pintab-heading = Probieren Sie es aus: Tab anheften

##

cfr-doorhanger-extension-sumo-link =
    .tooltiptext = Warum wird das angezeigt?
cfr-doorhanger-extension-cancel-button = Nicht jetzt
    .accesskey = N
cfr-doorhanger-extension-ok-button = Jetzt hinzufügen
    .accesskey = h
cfr-doorhanger-pintab-ok-button = Diesen Tab anheften
    .accesskey = a
cfr-doorhanger-extension-manage-settings-button = Einstellungen für Empfehlungen verwalten
    .accesskey = E
cfr-doorhanger-extension-never-show-recommendation = Diese Empfehlung nicht anzeigen
    .accesskey = D
cfr-doorhanger-extension-learn-more-link = Weitere Informationen
# This string is used on a new line below the add-on name
# Variables:
#   $name (String) - Add-on author name
cfr-doorhanger-extension-author = von { $name }
# This is a notification displayed in the address bar.
# When clicked it opens a panel with a message for the user.
cfr-doorhanger-extension-notification = Empfehlung
cfr-doorhanger-extension-notification2 = Empfehlung
    .tooltiptext = Erweiterungsempfehlung
    .a11y-announcement = Erweiterungsempfehlung verfügbar
# This is a notification displayed in the address bar.
# When clicked it opens a panel with a message for the user.
cfr-doorhanger-feature-notification = Empfehlung
    .tooltiptext = Funktionsempfehlung
    .a11y-announcement = Funktionsempfehlung verfügbar

## Add-on statistics
## These strings are used to display the total number of
## users and rating for an add-on. They are shown next to each other.

# Variables:
#   $total (Number) - The rating of the add-on from 1 to 5
cfr-doorhanger-extension-rating =
    .tooltiptext =
        { $total ->
            [one] { $total } Stern
           *[other] { $total } Sterne
        }
# Variables:
#   $total (Number) - The total number of users using the add-on
cfr-doorhanger-extension-total-users =
    { $total ->
        [one] { $total } Benutzer
       *[other] { $total } Benutzer
    }
cfr-doorhanger-pintab-description = Schneller Zugriff auf die meistverwendeten Seiten. Seiten bleiben geöffnet, selbst nach einem Neustart.

## These messages are steps on how to use the feature and are shown together.

cfr-doorhanger-pintab-step1 = Klicken Sie mit der <b>rechten Maustaste</b> auf den anzuheftenden Tab.
cfr-doorhanger-pintab-step2 = Wählen Sie <b>Tab anheften</b> aus dem Menü.
cfr-doorhanger-pintab-step3 = Falls die Seite auf eine Aktualisierung aufmerksam machen will, wird ein blauer Punkt auf dem angehefteten Tab angezeigt.
cfr-doorhanger-pintab-animation-pause = Anhalten
cfr-doorhanger-pintab-animation-resume = Fortfahren

## Firefox Accounts Message

cfr-doorhanger-bookmark-fxa-header = Synchronisieren Sie Ihre Lesezeichen, um sie überall verfügbar zu haben.
cfr-doorhanger-bookmark-fxa-body = Jederzeit Zugriff auf dieses Lesezeichen - auch auf mobilen Geräten. Nutzen Sie dafür ein { -fxaccount-brand-name }.
cfr-doorhanger-bookmark-fxa-link-text = Lesezeichen jetzt synchronisieren…
cfr-doorhanger-bookmark-fxa-close-btn-tooltip =
    .aria-label = Schließen-Schaltfläche
    .title = Schließen

## Protections panel

cfr-protections-panel-header = Surfen ohne verfolgt zu werden
cfr-protections-panel-body = Behalten Sie die Kontrolle über Ihre Daten. { -brand-short-name } schützt Sie vor den verbreitetsten Skripten, welche Ihre Online-Aktivitäten verfolgen.
cfr-protections-panel-link-text = Weitere Informationen

## What's New toolbar button and panel

# This string is used by screen readers to offer a text based alternative for
# the notification icon
cfr-badge-reader-label-newfeature = Neue Funktion:
cfr-whatsnew-button =
    .label = Neue Funktionen und Änderungen
    .tooltiptext = Neue Funktionen und Änderungen
cfr-whatsnew-panel-header = Neue Funktionen und Änderungen
cfr-whatsnew-release-notes-link-text = Release Notes lesen
cfr-whatsnew-fx70-title = { -brand-short-name } kämpft noch stärker für deine Privatsphäre
cfr-whatsnew-fx70-body =
    Das neueste Update verbessert den Tracking-Schutz und macht es
    dir einfacher denn je, sichere Kennwörter für jede Webseite zu erstellen.
cfr-whatsnew-tracking-protect-title = Schütze dich vor Online-Tracking
cfr-whatsnew-tracking-protect-body =
    { -brand-short-name } blockt gängige Online-Tracker sozialer Plattformen und anderer Webseiten,
    die dir durchs Web folgen wollen.
cfr-whatsnew-tracking-protect-link-text = Deinen Bericht anzeigen
# This string is displayed before a large numeral that indicates the total
# number of tracking elements blocked. Don’t add $blockedCount to your
# localization, because it would result in the number showing twice.
cfr-whatsnew-tracking-blocked-title =
    { $blockedCount ->
        [one] Tracker geblockt
       *[other] Tracker geblockt
    }
cfr-whatsnew-tracking-blocked-subtitle = Seit { DATETIME($earliestDate, month: "long", year: "numeric") }
cfr-whatsnew-tracking-blocked-link-text = Bericht anzeigen
cfr-whatsnew-lockwise-backup-title = Speichere deine Passwörter ab
cfr-whatsnew-lockwise-backup-body = Generiere jetzt sichere Passwörter, auf die du mit deinem Konto von überall aus zugreifen kannst.
cfr-whatsnew-lockwise-backup-link-text = Backups einschalten
cfr-whatsnew-lockwise-take-title = Nimm deine Passwörter mit
cfr-whatsnew-lockwise-take-body =
    Mit der { -lockwise-brand-short-name } App für mobile Geräte kannst du von überall aus sicher auf deine
    gespeicherten Passwörter zugreifen.
cfr-whatsnew-lockwise-take-link-text = Hol dir die App

## Picture-in-Picture

cfr-whatsnew-pip-header = Schaue Videos während du surfst
cfr-whatsnew-pip-body = Bild-in-Bild zeigt das Video in einem schwebenden Fenster an, damit du in anderen Tabs surfen und dennoch das Video anschauen kannst.
cfr-whatsnew-pip-cta = Weitere Informationen

## Permission Prompt

cfr-whatsnew-permission-prompt-header = Weniger nervige Pop-ups durch Websites
cfr-whatsnew-permission-prompt-body = { -brand-shorter-name } hindert Websites nun daran, automatisch nach der Berechtigung zum Anzeigen von Pop-up-Nachrichten zu fragen.
cfr-whatsnew-permission-prompt-cta = Weitere Informationen

## Fingerprinter Counter

# This string is displayed before a large numeral that indicates the total
# number of tracking elements blocked. Don’t add $fingerprinterCount to your
# localization, because it would result in the number showing twice.
cfr-whatsnew-fingerprinter-counter-header =
    { $fingerprinterCount ->
        [one] Identifizierer (Fingerprinter) blockiert
       *[other] Identifizierer (Fingerprinter) blockiert
    }
cfr-whatsnew-fingerprinter-counter-body = { -brand-shorter-name } blockiert viele Identifizierer (Fingerprinter), welche sonst heimlich Informationen über dein Gerät und deine Aktivitäten sammeln, um ein Werbeprofil über dich zu erstellen.
# Message variation when fingerprinters count is less than 10
cfr-whatsnew-fingerprinter-counter-header-alt = Identifizierer (Fingerprinter)
cfr-whatsnew-fingerprinter-counter-body-alt = { -brand-shorter-name } kann Identifizierer (Fingerprinter) blockieren, die sonst heimlich Informationen über dein Gerät und deine Aktivitäten sammeln, um ein Werbeprofil über dich zu erstellen.

## Bookmark Sync

cfr-doorhanger-sync-bookmarks-header = Auf dieses Lesezeichen auf dem Handy zugreifen
cfr-doorhanger-sync-bookmarks-body = Haben Sie Ihre Passwörter, Chronik und mehr überall griffbereit, wo Sie mit { -brand-product-name } angemeldet sind.
cfr-doorhanger-sync-bookmarks-ok-button = { -sync-brand-short-name } aktivieren
    .accesskey = a

## Login Sync

cfr-doorhanger-sync-logins-header = Nie wieder ein Passwort verlieren
cfr-doorhanger-sync-logins-body = Speichern Sie Ihre Passwörter sicher und synchronisieren Sie diese mit allen Ihren Geräten.
cfr-doorhanger-sync-logins-ok-button = { -sync-brand-short-name } aktivieren
    .accesskey = a

## Send Tab

cfr-doorhanger-send-tab-header = Das unterwegs lesen
cfr-doorhanger-send-tab-recipe-header = Dieses Rezept in die Küche mitnehmen
cfr-doorhanger-send-tab-body = Die Funktion "Tab senden" ermöglicht es, diesen Link ganz einfach mit Ihrem Handy oder einem anderen mit { -brand-product-name } verbundenen Gerät zu teilen.
cfr-doorhanger-send-tab-ok-button = "Tab senden" ausprobieren
    .accesskey = T

## Firefox Send

cfr-doorhanger-firefox-send-header = Diese PDF-Datei sicher teilen
cfr-doorhanger-firefox-send-body = Schützen Sie Ihre Dokumente vor neugierigen Blicken mittels Ende-zu-Ende-Verschlüsselung und Links, welche nach der Benutzung ungültig werden.
cfr-doorhanger-firefox-send-ok-button = { -send-brand-name } ausprobieren
    .accesskey = p

## Social Tracking Protection

cfr-doorhanger-socialtracking-ok-button = Schutzmaßnahmen anzeigen
    .accesskey = M
cfr-doorhanger-socialtracking-close-button = Schließen
    .accesskey = S
cfr-doorhanger-socialtracking-dont-show-again = Ähnliche Nachrichten nicht mehr anzeigen
    .accesskey = n
cfr-doorhanger-socialtracking-heading = { -brand-short-name } hat ein soziales Netzwerk daran gehindert, deine Aktivitäten hier zu verfolgen.
cfr-doorhanger-socialtracking-description = Deine Privatsphäre ist wichtig. { -brand-short-name } blockiert jetzt auch bekannte Skripte zur Aktivitätenverfolgung durch soziale Netzwerke und begrenzt damit, wie viel Informationen diese über deine Online-Aktivitäten sammeln können.
cfr-doorhanger-fingerprinters-heading = { -brand-short-name } hat einen Fingerabdruck auf dieser Seite blockiert
cfr-doorhanger-fingerprinters-description = Deine Privatsphäre ist uns wichtig. { -brand-short-name } blockiert jetzt Fingerabdrücke, die eindeutig identifizierbare Informationen zu deinem Gerät sammeln, um dich zu tracken.
cfr-doorhanger-cryptominers-heading = { -brand-short-name } hat einen Fingerabdruck auf dieser Seite blockiert
cfr-doorhanger-cryptominers-description = Deine Privatsphäre ist uns wichtig. { -brand-short-name } blockiert jetzt Krypto-Miner, die die Rechenleistung deines Systems nutzen wollen, um digitale Währungen zu schürfen.

## Enhanced Tracking Protection Milestones

# Variables:
#   $blockedCount (Number) - The total count of blocked trackers. This number will always be greater than 1.
#   $date (String) - The date we began recording the count of blocked trackers
cfr-doorhanger-milestone-heading =
    { $blockedCount ->
        [one] { -brand-short-name } hat seit { $date } mehr als <b>{ $blockedCount }</b> Element zur Aktivitätenverfolgung blockiert!
       *[other] { -brand-short-name } hat seit { $date } mehr als <b>{ $blockedCount }</b> Elemente zur Aktivitätenverfolgung blockiert!
    }
cfr-doorhanger-milestone-ok-button = Alle anzeigen
    .accesskey = A
