[CmdletBinding()]
param(
    [string]$Destination = (Join-Path $PSScriptRoot 'mgmt-secret'),
    [switch]$Force
)

$files = @(
    'backend\.env.development',
    'backend\.env.production',
    'backend\tesoreria-gest-74c64d7836b9.json',
    'backend\backend\settings\base.py',
    'backend\backend\settings\dev.py',
    'backend\backend\settings\prod.py'
)

$destinationPath = [System.IO.Path]::GetFullPath($Destination)

if ((Test-Path -LiteralPath $destinationPath) -and -not $Force) {
    throw "La destinazione esiste gia: $destinationPath. Usa -Force per ricrearla."
}

if ($Force -and (Test-Path -LiteralPath $destinationPath)) {
    Remove-Item -LiteralPath $destinationPath -Recurse -Force
}

foreach ($file in $files) {
    $sourcePath = Join-Path $PSScriptRoot $file
    if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
        throw "File segreto mancante nel progetto: $sourcePath"
    }

    $targetPath = Join-Path $destinationPath $file
    $targetDirectory = Split-Path -Parent $targetPath
    New-Item -ItemType Directory -Path $targetDirectory -Force | Out-Null
    Copy-Item -LiteralPath $sourcePath -Destination $targetPath
}

$createdFiles = Get-ChildItem -LiteralPath $destinationPath -Recurse -File |
    ForEach-Object { $_.FullName.Substring($destinationPath.Length + 1) }

if (($createdFiles | Sort-Object) -join "`n" -cne (($files | Sort-Object) -join "`n")) {
    throw "La cartella generata non contiene esattamente i file previsti."
}

Write-Host "Cartella segreta creata: $destinationPath"
Write-Host "Puoi comprimerla e inviarla ai colleghi."
