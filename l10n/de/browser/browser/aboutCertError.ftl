# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# Variables:
# $hostname (String) - Hostname of the website with cert error.
cert-error-intro = { $hostname } verwendet ein ungültiges Sicherheitszertifikat.
cert-error-mitm-intro = Websites bestätigen ihre Identität mittels Zertifikaten, welche von Zertifizierungsstellen ausgegeben werden.
cert-error-mitm-mozilla = { -brand-short-name } wird von der gemeinnützigen Mozilla-Organisation unterstützt, welche eine vollständig offene Datenbank für Zertifizierungsstellen (CA Store) betreibt. Diese Datenbank hilft bei der Sicherstellung, dass Zertifizierungsstellen sich an Sicherheitsrichtlinien für die Anwendersicherheit halten.
cert-error-mitm-connection = { -brand-short-name } verwendet Mozillas Datenbank für Zertifizierungsstellen (CA Store) anstatt durch das Betriebssystem bereitgestellte Zertifikate, um zu überprüfen, ob eine Verbindung sicher ist. Wenn ein Antivirusprogramm oder das Netzwerk sich in eine Verbindung einklinkt und dafür ein Sicherheitszertifikat einer Zertifizierungsstelle verwendet, welche sich nicht in Mozillas Datenbank für Zertifizierungsstellen befindet, so wird die Verbindung daher als nicht sicher betrachtet.
cert-error-trust-unknown-issuer-intro = Eventuell täuscht jemand die Website vor und es sollte nicht fortgefahren werden.
# Variables:
# $hostname (String) - Hostname of the website with cert error.
cert-error-trust-unknown-issuer = Websites bestätigen ihre Identität mittels Zertifikaten. { -brand-short-name } vertraut { $hostname } nicht, weil der Aussteller des Zertifikats unbekannt ist, das Zertifikat vom Austeller selbst signiert wurde oder der Server nicht die korrekten Zwischen-Zertifikate sendet.
cert-error-trust-cert-invalid = Dem Zertifikat wird nicht vertraut, weil es von einem ungültigen Zertifizierungsstellen-Zertifikat ausgestellt wurde.
cert-error-trust-untrusted-issuer = Dem Zertifikat wird nicht vertraut, weil dem Aussteller-Zertifikat nicht vertraut wird.
cert-error-trust-signature-algorithm-disabled = Dem Zertifikat wird nicht vertraut, weil es mit einem Signatur-Algorithmus signiert wurde, der deaktiviert wurde, weil er nicht sicher ist.
cert-error-trust-expired-issuer = Dem Zertifikat wird nicht vertraut, weil das Aussteller-Zertifikat abgelaufen ist.
cert-error-trust-self-signed = Dem Zertifikat wird nicht vertraut, weil es vom Aussteller selbst signiert wurde.
cert-error-trust-symantec = Von GeoTrust, RapidSSL, Symantec, Thawte oder VeriSign ausgestellte Zertifikate werden nicht mehr als vertrauenswürdig eingestuft, da sich die ausstellende Organisationen in der Vergangenheit nicht an Sicherheitsregeln gehalten haben.
cert-error-untrusted-default = Das Zertifikat kommt nicht von einer vertrauenswürdigen Quelle.
# Variables:
# $hostname (String) - Hostname of the website with cert error.
cert-error-domain-mismatch = Websites bestätigen ihre Identität mittels Zertifikaten. { -brand-short-name } vertraut dieser Website nicht, weil das von der Website verwendete Zertifikat nicht für { $hostname } gilt.
# Variables:
# $hostname (String) - Hostname of the website with cert error.
# $alt-name (String) - Alternate domain name for which the cert is valid.
cert-error-domain-mismatch-single = Websites bestätigen ihre Identität mittels Zertifikaten. { -brand-short-name } vertraut dieser Website nicht, weil das von der Website verwendete Zertifikat nicht für { $hostname } gilt. Das Zertifikat ist nur gültig für <a data-l10n-name="domain-mismatch-link">{ $alt-name }</a>.
# Variables:
# $hostname (String) - Hostname of the website with cert error.
# $alt-name (String) - Alternate domain name for which the cert is valid.
cert-error-domain-mismatch-single-nolink = Websites bestätigen ihre Identität mittels Zertifikaten. { -brand-short-name } vertraut dieser Website nicht, weil das von der Website verwendete Zertifikat nicht für { $hostname } gilt. Das Zertifikat ist nur gültig für { $alt-name }.
# Variables:
# $subject-alt-names (String) - Alternate domain names for which the cert is valid.
cert-error-domain-mismatch-multiple = Websites bestätigen ihre Identität mittels Zertifikaten. { -brand-short-name } vertraut dieser Website nicht, weil das von der Website verwendete Zertifikat nicht für { $hostname } gilt. Das Zertifikat gilt nur für folgende Namen: { $subject-alt-names }
# Variables:
# $error (String) - NSS error code string that specifies type of cert error. e.g. unknown issuer, invalid cert, etc.
cert-error-code-prefix-link = Fehlercode: <a data-l10n-name="error-code-link">{ $error }</a>
# Variables:
# $hostname (String) - Hostname of the website with cert error.
cert-error-symantec-distrust-description = Websites bestätigen ihre Identität mittels Zertifikaten, welche von Zertifizierungsstellen ausgegeben werden. Die meisten Browser vertrauen Zertifikaten nicht mehr, welche von GeoTrust, RapidSSL, Symantec, Thawte oder VeriSign ausgestellt wurden. { $hostname } verwendet ein Zertifikat von einer dieser Zertifizierungsstellen, weshalb die Identität der Website nicht bestätigt werden kann.
cert-error-symantec-distrust-admin = Sie können den Website-Administrator über das Problem benachrichtigen.
