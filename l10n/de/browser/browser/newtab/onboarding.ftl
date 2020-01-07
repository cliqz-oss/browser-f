# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


### UI strings for the simplified onboarding modal / about:welcome
### Various strings use a non-breaking space to avoid a single dangling /
### widowed word, so test on various window sizes if you also want this.


## These button action text can be split onto multiple lines, so use explicit
## newlines in translations to control where the line break appears (e.g., to
## avoid breaking quoted text).

onboarding-button-label-learn-more = Weitere Infos
onboarding-button-label-try-now = Jetzt ausprobieren
onboarding-button-label-get-started = Einführung

## Welcome modal dialog strings

onboarding-welcome-header = Willkommen bei { -brand-short-name }
onboarding-welcome-body = Den Browser hast du schon. <br/>Lerne jetzt auch den Rest von { -brand-product-name } kennen.
onboarding-welcome-learn-more = Weitere Infos zu den Vorteilen.
onboarding-welcome-modal-get-body = Den Browser haben Sie schon.<br/> Holen Sie jetzt das Beste aus { -brand-product-name } heraus.
onboarding-welcome-modal-supercharge-body = Erhöhe deinen Datenschutz.
onboarding-welcome-modal-privacy-body = Du hast den Browser. Erhöhe deinen Datenschutz.
onboarding-welcome-modal-family-learn-more = Erfahre mehr über die Produkte rund um { -brand-product-name }.
onboarding-welcome-form-header = Beginne hier
onboarding-join-form-header = Komm zu { -brand-product-name }
onboarding-join-form-body = Gib deine E-Mail-Adresse ein und leg los.
onboarding-join-form-email =
    .placeholder = E-Mail-Adresse eingeben
onboarding-join-form-email-error = Gültige E-Mail-Adresse erforderlich
onboarding-join-form-legal = Indem du fortfährst, stimmst du unseren <a data-l10n-name="terms">Nutzungsbedingungen</a> und unserer <a data-l10n-name="privacy">Datenschutzerklärung</a> zu.
onboarding-join-form-continue = Weiter
# This message is followed by a link using onboarding-join-form-signin ("Sign In") as text.
onboarding-join-form-signin-label = Haben Sie schon ein Konto?
# Text for link to submit the sign in form
onboarding-join-form-signin = Anmelden
onboarding-start-browsing-button-label = Hier geht’s zum Browser
onboarding-cards-dismiss =
    .title = Entfernen
    .aria-label = Entfernen

## Welcome full page string

onboarding-fullpage-welcome-subheader = Erfahre mehr über deine Möglichkeiten.
onboarding-fullpage-form-email =
    .placeholder = Ihre E-Mail-Adresse…

## Firefox Sync modal dialog strings.

onboarding-sync-welcome-header = { -brand-product-name } für unterwegs
onboarding-sync-welcome-content = Nimm Lesezeichen, Chronik, Passwörter und andere Einstellungen mit auf alle deine Geräten.
onboarding-sync-welcome-learn-more-link = Weitere Infos zum Firefox-Konto
onboarding-sync-form-input =
    .placeholder = E-Mail
onboarding-sync-form-continue-button = Weiter
onboarding-sync-form-skip-login-button = Diesen Schritt überspringen

## This is part of the line "Enter your email to continue to Firefox Sync"

onboarding-sync-form-header = E-Mail-Adresse eingeben
onboarding-sync-form-sub-header = um dich bei { -sync-brand-name } anzumelden

## These are individual benefit messages shown with an image, title and
## description.

onboarding-benefit-products-title = Nützliche Produkte
onboarding-benefit-products-text = Erledige wichtige Dinge online – mit Tools, die deine Privatsphäre auf allen Geräten respektieren.
onboarding-benefit-knowledge-title = Praktisches Wissen
onboarding-benefit-knowledge-text = Hol dir die Infos, die dich online sicherer und effizienter machen.
onboarding-benefit-privacy-title = Echte Privatsphäre
# "Personal Data Promise" is a concept that should be translated consistently
# across the product. It refers to a concept shown elsewhere to the user: "The
# Firefox Personal Data Promise is the way we honor your data in everything we
# make and do. We take less data. We keep it safe. And we make sure that we are
# transparent about how we use it."
onboarding-benefit-privacy-text = Hinter allem, was wir tun, steht unser Versprechen für deine persönlichen Daten: Wenig sammeln. Sicher speichern. Ehrlich sein.
onboarding-benefit-sync-title = { -sync-brand-short-name }
onboarding-benefit-sync-text = Habe deine Lesezeichen, Passwörter, Chronik und mehr überall griffbereit, wo Du { -brand-product-name } benutzt.
onboarding-benefit-monitor-title = { -monitor-brand-short-name }
onboarding-benefit-monitor-text = Erhalte Benachrichtigungen, wenn deine persönlichen Daten in einem bekanntgewordenen Datenleck enthalten sind.
onboarding-benefit-lockwise-title = { -lockwise-brand-short-name }
onboarding-benefit-lockwise-text = Verwalte Deine Passwörter sicher und nimm sie überall mit hin.

## These strings belong to the individual onboarding messages.


## Each message has a title and a description of what the browser feature is.
## Each message also has an associated button for the user to try the feature.
## The string for the button is found above, in the UI strings section

onboarding-private-browsing-title = Privater Modus
onboarding-private-browsing-text = Im Privaten Modus werden Online-Tracker, die deine Aktivitäten im Web verfolgen wollen, einfach blockiert.
onboarding-screenshots-title = Bildschirmfotos
onboarding-screenshots-text = Bildschirmfotos aufnehmen, speichern und teilen – ohne { -brand-short-name } zu verlassen. Nimm ausgewählte Bereiche oder komplette Webseiten auf und speichere sie anschließend im Web. So kannst du sofort darauf zuzugreifen oder sie teilen.
onboarding-addons-title = Add-ons
onboarding-addons-text = Füge noch mehr Funktionen zu { -brand-short-name } hinzu, damit Aufgaben leichter von Hand gehen. Vergleiche Preise, erhalte Informationen zum Wetter oder hol dir dein individuelles Theme.
onboarding-ghostery-title = Ghostery
onboarding-ghostery-text = Sei noch schneller und sicherer im Web unterwegs. Mit Erweiterungen wie Ghostery kannst du lästige Werbung einfach blockieren.
# Note: "Sync" in this case is a generic verb, as in "to synchronize"
onboarding-fxa-title = Synchronisieren
onboarding-fxa-text = Melde dich bei { -fxaccount-brand-name } an und synchronisiere Lesezeichen, Passwörter und offene Tabs auf allen Geräten, auf denen du { -brand-short-name } nutzt.
onboarding-tracking-protection-title2 = Schutz vor Tracking
onboarding-tracking-protection-text2 = { -brand-short-name } hilft dir, Websiten daran zu hindern, dich online zu tracken. So machst du es Werbetreibenden schwerer, dich mit Online-Werbung im Web zu verfolgen.
onboarding-tracking-protection-button2 = So funktioniert's
onboarding-data-sync-title = Nimm deine Einstellungen einfach mit
# "Sync" is short for synchronize.
onboarding-data-sync-text2 = Synchronisiere Lesezeichen und Passwörter überall dort, wo du { -brand-product-name } nutzt.
onboarding-data-sync-button2 = Für { -sync-brand-short-name } anmelden
onboarding-firefox-monitor-title = Lass dich bei Datenlecks warnen
onboarding-firefox-monitor-text = { -monitor-brand-name } überprüft, ob deine E-Mail-Adresse schon einmal Teil eines Datenlecks war und warnt dich, wenn sie in neuen Leaks auftaucht.
onboarding-firefox-monitor-text2 = { -monitor-brand-name } überwacht, ob deine E-Mail-Adresse bereits Teil eines Datenlecks war, und warnt dich, falls sie in neuen Lecks enthalten ist.
onboarding-firefox-monitor-button = Für Warnmeldungen anmelden
onboarding-browse-privately-title = Privater Modus
onboarding-browse-privately-text = Der Private Modus löscht Chronik und Suchverlauf automatisch für dich und hält sie so vor anderen Benutzern geheim.
onboarding-browse-privately-button = Privates Fenster öffnen
onboarding-firefox-send-title = Teile Dateien sicher mit anderen
onboarding-firefox-send-text2 = { -send-brand-name } schützt die Dateien, die du versendest, mit End-to-End-Verschlüsselung und einem Link, der automatisch abläuft.
onboarding-firefox-send-button = { -send-brand-name } ausprobieren
onboarding-mobile-phone-title = Hol dir { -brand-product-name } aufs Smartphone
onboarding-mobile-phone-text = Lade dir { -brand-product-name } für iOS oder Android herunter und synchronisiere deine Daten auf allen deinen Geräten.
# "Mobile" is short for mobile/cellular phone, "Browser" is short for web
# browser.
onboarding-mobile-phone-button = Mobilen Browser downloaden
onboarding-send-tabs-title = Sende offene Tabs an deine anderen Geräte
# "Send Tabs" refers to "Send Tab to Device" feature that appears when opening a
# tab's context menu.
onboarding-send-tabs-text = Schicke dir selbst Tabs von einem Gerät aufs andere – ohne Copy & Paste oder dafür den Browser zu verlassen.
# "Send Tabs" refers to "Send Tab to Device" feature that appears when opening a
# tab's context menu.
onboarding-send-tabs-text2 = Teile einfach Webseiten zwischen deinen Geräten, ohne Links zu kopieren oder den Browser zu verlassen.
onboarding-send-tabs-button = So sendest du Tabs
onboarding-pocket-anywhere-title = Jetzt speichern, später lesen
onboarding-pocket-anywhere-text2 = { -pocket-brand-name } speichert die besten Stories und Web-Inhalte für dich offline, damit du sie dann lesen oder hören kannst, wenn es dir passt.
onboarding-pocket-anywhere-button = { -pocket-brand-name } ausprobieren
onboarding-lockwise-passwords-title = Nimm deine Passwörter überall mit hin
onboarding-lockwise-passwords-text2 = { -lockwise-brand-name } speichert deine Passwörter an einem sicheren Ort, damit du dich so einfach wie möglich in jedes deiner Online-Konten einloggen kannst.
onboarding-lockwise-passwords-button2 = Hol dir die App
onboarding-lockwise-strong-passwords-title = Erstelle und speichere sichere Passwörter
onboarding-lockwise-strong-passwords-text = { -lockwise-brand-name } erstellt ganz einfach sichere Passwörter und speichert sie alle an einem Ort.
onboarding-lockwise-strong-passwords-button = Zugangsdaten verwalten
onboarding-facebook-container-title = Weise Facebook in die Schranken
onboarding-facebook-container-text2 = Der { -facebook-container-brand-name } trennt dein Profil von dem, was du sonst so im Web machst. So wird es schwerer für Facebook, dir gezielt Werbung anzuzeigen.
onboarding-facebook-container-button = Erweiterung hinzufügen
onboarding-import-browser-settings-title = Importiere Lesezeichen, Passwörter und mehr
onboarding-import-browser-settings-text = Lege direkt los - bringe einfach deine Chrome-Webseiten und -Einstellungen mit
onboarding-import-browser-settings-button = Chrome-Daten importieren

## Message strings belonging to the Return to AMO flow

return-to-amo-sub-header = Fantastisch, du hast jetzt { -brand-short-name }
# <icon></icon> will be replaced with the icon belonging to the extension
#
# Variables:
#   $addon-name (String) - Name of the add-on
return-to-amo-addon-header = Hol dir auch <icon></icon><b>{ $addon-name }.</b>
return-to-amo-extension-button = Erweiterung installieren
return-to-amo-get-started-button = Informationen zu { -brand-short-name }
