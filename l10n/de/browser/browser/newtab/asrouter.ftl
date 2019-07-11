# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

cfr-doorhanger-extension-heading = Empfohlene Erweiterung

cfr-doorhanger-pintab-heading = Probieren Sie es aus: Tab anheften

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
