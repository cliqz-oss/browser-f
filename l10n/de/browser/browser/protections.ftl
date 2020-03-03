# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# Variables:
#   $count (Number) - Number of tracking events blocked.
graph-week-summary =
    { $count ->
        [one] { -brand-short-name } blockierte { $count } Skript zur Aktivitätenverfolgung innerhalb der letzten Woche.
       *[other] { -brand-short-name } blockierte { $count } Skripte zur Aktivitätenverfolgung innerhalb der letzten Woche.
    }
# Variables:
#   $count (Number) - Number of tracking events blocked.
#   $earliestDate (Number) - Unix timestamp in ms, representing a date. The
# earliest date recorded in the database.
graph-total-tracker-summary =
    { $count ->
        [one] <b>{ $count }</b> Skript zur Aktivitätenverfolgung blockiert seit { DATETIME($earliestDate, day: "numeric", month: "long", year: "numeric") }.
       *[other] <b>{ $count }</b> Skripte zur Aktivitätenverfolgung blockiert seit  { DATETIME($earliestDate, day: "numeric", month: "long", year: "numeric") }.
    }
# Text displayed instead of the graph when in Private Mode
graph-private-window = { -brand-short-name } wird weiterhin Elemente zur Aktivitätenverfolgung in privaten Fenstern blockieren, aber nicht aufzeichnen, was blockiert wurde.
# Weekly summary of the graph when the graph is empty in Private Mode
graph-week-summary-private-window = Elemente zur Aktivitätenverfolgung, die { -brand-short-name } diese Woche blockiert hat
# The terminology used to refer to categories of Content Blocking is also used in chrome/browser/browser.properties and should be translated consistently.
# "Standard" in this case is an adjective, meaning "default" or "normal".
# The category name in the <b> tag will be bold.
protection-report-header-details-standard = Schutzstufe gesetzt auf <b>Standard</b>.
    .title = Datenschutz-Einstellungen öffnen
protection-report-header-details-strict = Schutzstufe gesetzt auf <b>Streng</b>.
    .title = Datenschutz-Einstellungen öffnen
protection-report-header-details-custom = Schutzstufe gesetzt auf <b>Benutzerdefiniert</b>.
    .title = Datenschutz-Einstellungen öffnen
protection-report-page-title = Privatsphäre-Schutzmaßnahmen
protection-report-content-title = Privatsphäre-Schutzmaßnahmen
etp-card-title = Verbesserter Tracking-Schutz (Schutz vor Aktivitätenverfolgung)
etp-card-content = Skripte zur Aktivitätenverfolgung (Online-Tracker) folgen Ihnen über Websites hinweg und sammeln Informationen über Ihre Browser-Gewohnheiten und Interessen. { -brand-short-name } blockiert viele dieser Skripte zur Aktivitätenverfolgung und andere böswillige Skripte.
protection-report-etp-card-content-custom-not-blocking = Derzeit sind alle Schutzmaßnahmen deaktiviert. Die zu blockierenden Elemente zur Aktivitätenverfolgung können in den Schutzmaßnahmen-Einstellungen von { -brand-short-name } festgelegt werden.
protection-report-manage-protections = Einstellungen verwalten
# This string is used to label the X axis of a graph. Other days of the week are generated via Intl.DateTimeFormat,
# capitalization for this string should match the output for your locale.
graph-today = Heute
# This string is used to describe the graph for screenreader users.
graph-legend-description = Grafik mit jeweils der Anzahl an blockierten Skripten zur Aktivitätenverfolgung nach Typ während dieser Woche.
social-tab-title = Social-Media-Tracker (Skripte zur Aktivitätenverfolgung durch soziale Netzwerke)
social-tab-contant = Auf anderen Websites eingebundene Elemente sozialer Netzwerke (z.B. zum Teilen von Inhalten) können Skripte enthalten, die verfolgen, was Sie online machen, angezeigt bekommen und sich anschauen. Dies ermöglicht den Unternehmen hinter den sozialen Netzwerken, mehr über Sie zu erfahren als allein durch die Inhalte, die Sie mit Ihrem Profil im sozialen Netzwerk teilen. <a data-l10n-name="learn-more-link">Weitere Informationen</a>
cookie-tab-title = Cookies zur seitenübergreifenden Aktivitätenverfolgung
cookie-tab-content = Diese Cookies werden über viele Websites hinweg verwendet und sammeln Informationen über Ihre Online-Aktivitäten. Sie werden durch Drittanbieter wie Werbe- oder Analyseunternehmen gesetzt. Das Blockieren von Cookies zur seitenübergreifenden Aktivitätenverfolgung verringert die Anzahl an Anzeigen, welche Ihnen im Internet folgen. <a data-l10n-name="learn-more-link">Weitere Informationen</a>
tracker-tab-title = Inhalte zur Aktivitätenverfolgung
tracker-tab-description = Websites können Werbung, Videos und andere Inhalte mit Skripten zur Aktivitätenverfolgung von anderen Websites laden. Das Blockieren von Inhalten zur Aktivitätenverfolgung ermöglicht es unter Umständen, dass Websites schneller laden, aber einige Schaltflächen, Formulare und Anmeldefelder funktionieren dann eventuell nicht richtig. <a data-l10n-name="learn-more-link">Weitere Informationen</a>
fingerprinter-tab-title = Identifizierer (Fingerprinter)
fingerprinter-tab-content = Identifizierer (Fingerprinter) sammeln Eigenschaften Ihres Browsers und Computers und erstellen daraus ein Profil. Mit diesem digitalen Fingerabdruck können diese Sie über Websites hinweg verfolgen. <a data-l10n-name="learn-more-link">Weitere Informationen</a>
cryptominer-tab-title = Heimliche Digitalwährungsberechner (Krypto-Miner)
cryptominer-tab-content = Heimliche Digitalwährungsberechner (Krypto-Miner) verwenden die Rechenleistung Ihres Computers, um digitales Geld zu erzeugen. Dabei wird die Batterie schnell entladen, der Computer verlangsamt und die Energierechnung erhöht. <a data-l10n-name="learn-more-link">Weitere Informationen</a>
lockwise-title = Nie wieder ein Passwort vergessen
lockwise-title-logged-in = { -lockwise-brand-name }
lockwise-header-content = { -lockwise-brand-name } speichert Passwörter sicher in Ihrem Browser.
lockwise-header-content-logged-in = Speichern Sie Passwörter sicher und synchronisieren Sie diese mit allen Ihren Geräten.
protection-report-view-logins-button = Zugangsdaten anzeigen
    .title = Gespeicherte Zugangsdaten öffnen
lockwise-no-logins-content = Holen Sie sich die <a data-l10n-name="lockwise-inline-link">{ -lockwise-brand-name }</a> App und nehmen Sie damit Ihre Passwörter überall mit hin.
lockwise-app-links = { -lockwise-brand-name } für <a data-l10n-name="lockwise-android-inline-link">Android</a> und <a data-l10n-name="lockwise-ios-inline-link">iOS</a>
# This string is displayed after a large numeral that indicates the total number
# of email addresses being monitored. Don’t add $count to
# your localization, because it would result in the number showing twice.
lockwise-passwords-stored =
    { $count ->
        [one] Passwort sicher gespeichert <a data-l10n-name="lockwise-how-it-works">Wie es funktioniert</a>
       *[other] Passwörter sicher gespeichert <a data-l10n-name="lockwise-how-it-works">Wie es funktioniert</a>
    }
turn-on-sync = { -sync-brand-short-name } aktivieren…
    .title = Sync-Einstellungen öffnen
manage-connected-devices = Geräte verwalten…
# Variables:
#   $count (Number) - Number of devices connected with sync.
lockwise-connected-device-status =
    { $count ->
        [one] Verbunden mit { $count } Gerät
       *[other] Verbunden mit { $count } Geräten
    }
monitor-title = Nach Datenlecks Ausschau halten
monitor-link = So funktioniert's
monitor-header-content-no-account = Testen Sie mit { -monitor-brand-name }, ob Sie von einem Datenleck betroffen sind, und lassen Sie sich bei zukünftigen Datenlecks benachrichtigen.
monitor-header-content-signed-in = { -monitor-brand-name } benachrichtigt Sie, falls Ihre Informationen von einem bekannt gewordenen Datenleck betroffen sind.
monitor-sign-up = Für Warnmeldungen zu Datenlecks anmelden
auto-scan = Heute automatisch überprüft
# This string is displayed after a large numeral that indicates the total number
# of email addresses being monitored. Don’t add $count to
# your localization, because it would result in the number showing twice.
info-monitored-emails =
    { $count ->
        [one] E-Mail-Adresse wird auf Datenlecks überwacht.
       *[other] E-Mail-Adressen werden auf Datenlecks überwacht.
    }
# This string is displayed after a large numeral that indicates the total number
# of known data breaches. Don’t add $count to
# your localization, because it would result in the number showing twice.
info-known-breaches-found =
    { $count ->
        [one] bekanntes Datenleck hat Ihre Informationen offengelegt.
       *[other] bekannte Datenlecks haben Ihre Informationen offengelegt.
    }
# This string is displayed after a large numeral that indicates the total number
# of exposed passwords. Don’t add $count to
# your localization, because it would result in the number showing twice.
info-exposed-passwords-found =
    { $count ->
        [one] Passwort durch alle Datenlecks offengelegt.
       *[other] Passwörter durch alle Datenlecks offengelegt.
    }
full-report-link = Zum vollständigen Bericht auf <a data-l10n-name="monitor-inline-link">{ -monitor-brand-name }</a>
# This string is displayed after a large numeral that indicates the total number
# of saved logins which may have been exposed. Don’t add $count to
# your localization, because it would result in the number showing twice.
password-warning =
    { $count ->
        [one] gespeicherte Zugangsdaten wurden eventuell durch ein Datenleck offengelegt. Ändern Sie das Passwort für mehr Online-Sicherheit. <a data-l10n-name="lockwise-link">Gespeicherte Zugangsdaten anzeigen</a>
       *[other] gespeicherte Zugangsdaten wurden eventuell durch einen Datenleck offengelegt. Ändern Sie das Passwort für mehr Online-Sicherheit. <a data-l10n-name="lockwise-link">Gespeicherte Zugangsdaten anzeigen</a>
    }

## The title attribute is used to display the type of protection.
## The aria-label is spoken by screen readers to make the visual graph accessible to blind users.
##
## Variables:
##   $count (Number) - Number of specific trackers
##   $percentage (Number) - Percentage this type of tracker contributes to the whole graph

bar-tooltip-social =
    .title = Skripte zur Aktivitätenverfolgung durch soziale Netzwerke
    .aria-label =
        { $count ->
            [one] { $count } Skript zur Aktivitätenverfolgung durch soziale Netzwerke ({ $percentage } %)
           *[other] { $count } Skripte zur Aktivitätenverfolgung durch soziale Netzwerke ({ $percentage } %)
        }
bar-tooltip-cookie =
    .title = Cookies zur seitenübergreifenden Aktivitätenverfolgung
    .aria-label =
        { $count ->
            [one] { $count } Cookie zur seitenübergreifenden Aktivitätenverfolgung ({ $percentage } %)
           *[other] { $count } Cookies zur seitenübergreifenden Aktivitätenverfolgung ({ $percentage } %)
        }
bar-tooltip-tracker =
    .title = Inhalte zur Aktivitätenverfolgung
    .aria-label =
        { $count ->
            [one] { $count } Inhalt zur Aktivitätenverfolgung ({ $percentage } %)
           *[other] { $count } Inhalte zur Aktivitätenverfolgung ({ $percentage } %)
        }
bar-tooltip-fingerprinter =
    .title = Identifizierer (Fingerprinter)
    .aria-label =
        { $count ->
            [one] { $count } Identifizierer (Fingerprinter) ({ $percentage } %)
           *[other] { $count } Identifizierer (Fingerprinter) ({ $percentage } %)
        }
bar-tooltip-cryptominer =
    .title = Heimliche Digitalwährungsberechner (Krypto-Miner)
    .aria-label =
        { $count ->
            [one] { $count } Heimlicher Digitalwährungsberechner (Krypto-Miner) ({ $percentage } %)
           *[other] { $count } Heimliche Digitalwährungsberechner (Krypto-Miner) ({ $percentage } %)
        }
