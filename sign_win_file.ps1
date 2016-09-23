Param(
  [string]$CertPath,
  [string]$CertPass,
  [string]$FilePath
)
$Cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($CertPath, $CertPass)

Set-AuthenticodeSignature `
      $FilePath `
      $Cert `
      -TimeStampServer "http://timestamp.verisign.com/scripts/timstamp.dll"
