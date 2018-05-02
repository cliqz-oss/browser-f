# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

connection-window =
    .title = Verbindungs-Einstellungen
    .style =
        { PLATFORM() ->
            [macos] width: 45em
           *[other] width: 49em
        }
connection-close-key =
    .key = w
connection-disable-extension =
    .label = Erweiterung deaktivieren
connection-proxy-configure = Proxy-Zugriff auf das Internet konfigurieren
connection-proxy-option-no =
    .label = Kein Proxy
    .accesskey = e
connection-proxy-option-system =
    .label = Proxy-Einstellungen des Systems verwenden
    .accesskey = g
connection-proxy-option-auto =
    .label = Die Proxy-Einstellungen für dieses Netzwerk automatisch erkennen
    .accesskey = w
connection-proxy-option-manual =
    .label = Manuelle Proxy-Konfiguration:
    .accesskey = M
connection-proxy-http = HTTP-Proxy:
    .accesskey = y
connection-proxy-http-port = Port:
    .accesskey = P
connection-proxy-http-share =
    .label = Für alle Protokolle diesen Proxy-Server verwenden
    .accesskey = F
connection-proxy-ssl = SSL-Proxy:
    .accesskey = S
connection-proxy-ssl-port = Port:
    .accesskey = o
connection-proxy-ftp = FTP-Proxy:
    .accesskey = x
connection-proxy-ftp-port = Port:
    .accesskey = r
connection-proxy-socks = SOCKS-Host:
    .accesskey = C
connection-proxy-socks-port = Port:
    .accesskey = t
connection-proxy-socks4 =
    .label = SOCKS v4
    .accesskey = K
connection-proxy-socks5 =
    .label = SOCKS v5
    .accesskey = v
connection-proxy-noproxy = Kein Proxy für:
    .accesskey = n
connection-proxy-noproxy-desc = Beispiel: .mozilla.org, .net.de, 192.168.1.0/24
connection-proxy-autotype =
    .label = Automatische Proxy-Konfigurations-Adresse:
    .accesskey = u
connection-proxy-reload =
    .label = Neu laden
    .accesskey = a
connection-proxy-autologin =
    .label = Keine Authentifizierungsanfrage bei gespeichertem Passwort
    .accesskey = z
    .tooltip = Beim Aktivieren dieser Einstellung wird die Anmeldung an Proxies automatisch vorgenommen, falls deren Passwort gespeichert ist. Bei fehlgeschlagener Authentifizierung wird das Passwort vom Benutzer abgefragt.
connection-proxy-socks-remote-dns =
    .label = Bei Verwendung von SOCKS v5 den Proxy für DNS-Anfragen verwenden
    .accesskey = D
