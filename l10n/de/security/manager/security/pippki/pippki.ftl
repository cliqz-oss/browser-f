# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

password-quality-meter = Passwort-Qualitätsmessung

## Change Password dialog

change-password-window =
    .title = Master-Passwort ändern
# Variables:
# $tokenName (String) - Security device of the change password dialog
change-password-token = Kryptographie-Modul: { $tokenName }
change-password-old = Aktuelles Passwort:
change-password-new = Neues Passwort:
change-password-reenter = Neues Passwort (nochmals):

## Reset Password dialog

reset-password-window =
    .title = Master-Passwort zurücksetzen
    .style = width: 40em
reset-password-button-label =
    .label = Zurücksetzen
reset-password-text = Wenn Sie Ihr Master-Passwort zurücksetzen, gehen all Ihre gespeicherten Web- und E-Mail-Passwörter, Formulardaten, persönlichen Zertifikate und privaten Schlüssel verloren. Soll Ihr Master-Passwort trotzdem zurückgesetzt werden?

## Downloading cert dialog

download-cert-window =
    .title = Herunterladen des Zertifikats
    .style = width: 46em
download-cert-message = Sie wurden gebeten, einer neuen Zertifizierungsstelle (CA) zu vertrauen.
download-cert-trust-ssl =
    .label = Dieser CA vertrauen, um Websites zu identifizieren.
download-cert-trust-email =
    .label = Dieser CA vertrauen, um E-Mail-Nutzer zu identifizieren.
download-cert-message-desc = Bevor Sie dieser CA für jeglichen Zweck vertrauen, sollten Sie das Zertifikat sowie seine Richtlinien und Prozeduren (wenn vorhanden) überprüfen.
download-cert-view-cert =
    .label = Ansicht
download-cert-view-text = CA-Zertifikat überprüfen

## Client Authorization Ask dialog

client-auth-window =
    .title = Benutzer-Identifikationsanfrage
client-auth-site-description = Diese Website verlangt, dass Sie sich mit einem Zertifikat identifizieren:
client-auth-choose-cert = Wählen Sie ein Zertifikat, das als Identifikation vorgezeigt wird:
client-auth-cert-details = Details des gewählten Zertifikats:

## Set password (p12) dialog

set-password-window =
    .title = Wählen Sie ein Zertifikats-Backup-Passwort
set-password-message = Das Zertifikats-Backup-Passwort, das Sie hier festlegen, schützt die Backup-Datei, die Sie im Moment erstellen. Sie müssen dieses Passwort festlegen, um mit dem Backup fortzufahren.
set-password-backup-pw =
    .value = Zertifikats-Backup-Passwort:
set-password-repeat-backup-pw =
    .value = Zertifikats-Backup-Passwort (nochmals):
set-password-reminder = Wichtig: Wenn Sie Ihr Zertifikats-Backup-Passwort vergessen, können Sie dieses Backup später nicht wiederherstellen. Bitte schreiben Sie es an einem sicheren Platz nieder.

## Protected Auth dialog

protected-auth-window =
    .title = Geschützte Token-Authentifikation
protected-auth-msg = Bitte authentifizieren Sie sich beim Token. Die Authentifikationsmethode hängt vom Typ Ihres Tokens ab.
protected-auth-token = Token:
