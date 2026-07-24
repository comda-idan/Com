<#
  העלאת גרסה ידנית: .\scripts\bump-version.ps1 -Part minor
  מספר ה-build עולה אוטומטית בכל בנייה (build/Version.targets).
#>
param(
  [ValidateSet('major', 'minor', 'patch')]
  [string]$Part = 'patch'
)

$path = Join-Path $PSScriptRoot '..\version.json'
$v = Get-Content $path -Raw | ConvertFrom-Json

switch ($Part) {
  'major' { $v.major++; $v.minor = 0; $v.patch = 0 }
  'minor' { $v.minor++; $v.patch = 0 }
  'patch' { $v.patch++ }
}
$v.build = 0
$v.updatedUtc = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')

$v | ConvertTo-Json | Set-Content $path -Encoding utf8
Write-Host "version -> $($v.major).$($v.minor).$($v.patch).$($v.build)"
