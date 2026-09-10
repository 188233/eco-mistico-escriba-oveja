$ErrorActionPreference = 'Stop'
$moduleRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$manifest = Get-Content -LiteralPath (Join-Path $moduleRoot 'module.json') -Raw | ConvertFrom-Json
$moduleId = [string]$manifest.id
$version = [string]$manifest.version
if ($moduleId -ne 'eco-mistico-escriba-oveja' -or $version -notmatch '^\d+\.\d+\.\d+$') { throw 'Identidad o versión inválida.' }
$dist = Join-Path $moduleRoot 'dist'
New-Item -ItemType Directory -Path $dist -Force | Out-Null
$temporaryZip = Join-Path $dist ("package-" + [guid]::NewGuid().ToString('N') + '.zip')
$zipPath = Join-Path $dist "$moduleId-$version.zip"
$entries = @('module.json', 'README.md', 'LICENSE', 'CHANGELOG.md', 'scripts', 'styles', 'templates', 'examples', 'docs')
$files = @()
foreach ($entry in $entries) {
  $item = Get-Item -LiteralPath (Join-Path $moduleRoot $entry)
  if ($item.PSIsContainer) { $files += Get-ChildItem -LiteralPath $item.FullName -Recurse -File }
  else { $files += $item }
}
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [IO.Compression.ZipFile]::Open($temporaryZip, [IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($file in $files | Sort-Object FullName) {
    $relative = $file.FullName.Substring($moduleRoot.Length + 1).Replace('\', '/')
    [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file.FullName, "$moduleId/$relative", [IO.Compression.CompressionLevel]::Optimal) | Out-Null
  }
} finally { $archive.Dispose() }
$verification = [IO.Compression.ZipFile]::OpenRead($temporaryZip)
try {
  if ($verification.Entries.Count -ne $files.Count) { throw 'Cantidad de archivos incorrecta.' }
  foreach ($entry in $verification.Entries) {
    if ($entry.FullName.Contains('\') -or -not $entry.FullName.StartsWith("$moduleId/")) { throw 'Ruta no portable en el ZIP.' }
    $relative = $entry.FullName.Substring($moduleId.Length + 1)
    $sourceBytes = [IO.File]::ReadAllBytes((Join-Path $moduleRoot $relative))
    $stream = $entry.Open()
    $memory = [IO.MemoryStream]::new()
    try {
      $stream.CopyTo($memory)
      if ([Convert]::ToBase64String($sourceBytes) -ne [Convert]::ToBase64String($memory.ToArray())) { throw "Contenido alterado: $relative" }
    } finally { $stream.Dispose(); $memory.Dispose() }
  }
} finally { $verification.Dispose() }
Move-Item -LiteralPath $temporaryZip -Destination $zipPath -Force
Copy-Item -LiteralPath (Join-Path $moduleRoot 'module.json') -Destination (Join-Path $dist 'module.json') -Force
Write-Output "ZIP verificado: $zipPath"
