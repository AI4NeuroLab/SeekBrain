[CmdletBinding()]
param(
    [string]$Package = 'seekbrain',
    [string]$ToolsPackage,
    [string]$Prefix,
    [string]$Cache,
    [switch]$Offline,
    [switch]$NoModifyPath,
    [switch]$Help
)

$ErrorActionPreference = 'Stop'
if ($Help) {
    Write-Output @'
SeekBrain native Windows x64 installer (PowerShell 5.1 or newer)
  -Package <spec>       npm package/version, source directory, or local .tgz
  -ToolsPackage <tgz>   Local seekbrain-tools-win32-x64 package
  -Prefix <directory>  Default: %LOCALAPPDATA%\SeekBrain
  -Cache <directory>   Default: <prefix>\cache
  -Offline             Require cached Node archive and npm dependencies
  -NoModifyPath        Do not update your user PATH
  -Help                Show this help without installing anything

Installs a private Node 24 runtime and SeekBrain under your user account.
Install Git for Windows and Python separately; configure with seekbrain setup.
During development, pass local main/tool .tgz files; these packages are unpublished.
SEEKBRAIN_NODE_MIRROR and SEEKBRAIN_NPM_REGISTRY can select download mirrors.
'@
    return
}

if ($env:OS -ne 'Windows_NT') { throw 'This installer requires native Windows. Use scripts/install.sh on Linux/macOS/WSL.' }
if ($Package.StartsWith('-')) { throw 'Invalid package spec.' }
if (-not [Environment]::Is64BitOperatingSystem -or $env:PROCESSOR_ARCHITECTURE -ne 'AMD64' -or $env:PROCESSOR_ARCHITEW6432) {
    throw 'The first native Windows release requires x64 Windows and a 64-bit PowerShell process.'
}
if (-not $Prefix) { $Prefix = $env:SEEKBRAIN_INSTALL_PREFIX }
if (-not $Prefix) { $Prefix = Join-Path $env:LOCALAPPDATA 'SeekBrain' }
$Prefix = [IO.Path]::GetFullPath($Prefix)
if (-not $Cache) { $Cache = $env:SEEKBRAIN_INSTALL_CACHE }
if (-not $Cache) { $Cache = Join-Path $Prefix 'cache' }
$Cache = [IO.Path]::GetFullPath($Cache)
$bin = Join-Path $Prefix 'bin'
$nodeVersion = '24.22.1'
$nodeAsset = "node-v$nodeVersion-win-x64.zip"
$nodeSha = 'd2046d28c2c3dcd211ac5145c0bf30e2047ef9dfb306693c8c6e2eccd8b95fa5'
$marker = 'SeekBrain managed launcher'
$releaseId = 'install-' + [Guid]::NewGuid().ToString('N')
$stage = Join-Path (Join-Path $Prefix 'releases') $releaseId
$lock = $null
$committed = $false
$originalPath = $env:Path

function Invoke-Node([string[]]$NodeArguments) {
    & $script:node @NodeArguments
    if ($LASTEXITCODE -ne 0) { throw "Node command failed with exit code $LASTEXITCODE" }
}

function Write-AtomicAscii([string]$Destination, [string]$Content) {
    $temporary = $Destination + '.' + [Guid]::NewGuid().ToString('N') + '.tmp'
    try {
        [IO.File]::WriteAllText($temporary, $Content, [Text.Encoding]::ASCII)
        if (Test-Path -LiteralPath $Destination) { [IO.File]::Replace($temporary, $Destination, [NullString]::Value) }
        else { [IO.File]::Move($temporary, $Destination) }
    } finally {
        if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary -Force }
    }
}

try {
    New-Item -ItemType Directory -Force -Path $Prefix, $Cache, $bin | Out-Null
    $lockPath = Join-Path $Prefix '.install.lock'
    $lock = [IO.File]::Open($lockPath, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
    foreach ($command in @('seekbrain', 'seekbrain-014', 'seekbrain-pdf')) {
        $launcher = Join-Path $bin "$command.cmd"
        if ((Test-Path -LiteralPath $launcher) -and -not ([IO.File]::ReadAllText($launcher).Contains($marker))) {
            throw "Command already exists: $launcher"
        }
    }
    $pointer = Join-Path $Prefix 'current.cmd'
    if ((Test-Path -LiteralPath $pointer) -and -not ([IO.File]::ReadAllText($pointer).Contains($marker))) {
        throw "Installation pointer already exists: $pointer"
    }
    $archive = Join-Path $Cache $nodeAsset
    if (Test-Path -LiteralPath $archive) {
        if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $nodeSha) {
            throw "SHA-256 mismatch for cached Node archive: $archive"
        }
    } else {
        if ($Offline) { throw "Offline cache is missing: $archive" }
        $mirror = 'https://nodejs.org/dist'
        if ($env:SEEKBRAIN_NODE_MIRROR) { $mirror = $env:SEEKBRAIN_NODE_MIRROR.TrimEnd('/') }
        $download = $archive + '.' + [Guid]::NewGuid().ToString('N') + '.download'
        try {
            [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
            Invoke-WebRequest -UseBasicParsing -Uri "$mirror/v$nodeVersion/$nodeAsset" -OutFile $download
            if ((Get-FileHash -LiteralPath $download -Algorithm SHA256).Hash.ToLowerInvariant() -ne $nodeSha) {
                throw 'SHA-256 mismatch for downloaded Node archive.'
            }
            Move-Item -LiteralPath $download -Destination $archive
        } finally {
            if (Test-Path -LiteralPath $download) { Remove-Item -LiteralPath $download -Force }
        }
    }
    New-Item -ItemType Directory -Force -Path $stage | Out-Null
    Expand-Archive -LiteralPath $archive -DestinationPath $stage
    Move-Item -LiteralPath (Join-Path $stage "node-v$nodeVersion-win-x64") -Destination (Join-Path $stage 'runtime')
    $node = Join-Path $stage 'runtime\node.exe'
    $npm = Join-Path $stage 'runtime\node_modules\npm\bin\npm-cli.js'
    $env:Path = (Split-Path -Parent $node) + ';' + $originalPath
    Invoke-Node -NodeArguments @('--version')
    $npmPrefix = Join-Path $stage 'npm'
    $npmArguments = @($npm, 'install', '--global', '--prefix', $npmPrefix, '--no-audit', '--no-fund', '--omit=dev', '--include=optional', '--cache', (Join-Path $Cache 'npm'))
    if ($Offline) { $npmArguments += '--offline' }
    if ($env:SEEKBRAIN_NPM_REGISTRY) { $npmArguments += @('--registry', $env:SEEKBRAIN_NPM_REGISTRY) }
    if ($ToolsPackage) { $npmArguments += (Resolve-Path -LiteralPath $ToolsPackage).Path }
    if (Test-Path -LiteralPath $Package -PathType Container) {
        $packArguments = @($npm, 'pack', (Resolve-Path -LiteralPath $Package).Path, '--ignore-scripts', '--pack-destination', $stage, '--cache', (Join-Path $Cache 'npm'), '--json')
        if ($Offline) { $packArguments += '--offline' }
        $packed = & $node @packArguments
        if ($LASTEXITCODE -ne 0) { throw 'Could not pack the source directory.' }
        $packInfo = @($packed -join "`n" | ConvertFrom-Json)[0]
        $Package = Join-Path $stage $packInfo.filename
    } elseif (Test-Path -LiteralPath $Package -PathType Leaf) {
        $Package = (Resolve-Path -LiteralPath $Package).Path
    }
    $npmArguments += $Package
    Invoke-Node -NodeArguments $npmArguments
    $installed = Join-Path $npmPrefix 'node_modules\seekbrain'
    Invoke-Node -NodeArguments @((Join-Path $installed 'bin\seekbrain.mjs'), '--version')
    $verifyTools = @'
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = process.argv[1];
const { configureBundledTools } = await import(pathToFileURL(join(root, 'src/cli/bundled-tools.mjs')));
configureBundledTools(process.env, root);
for (const tool of ['fd.exe', 'rg.exe']) {
  const result = spawnSync(tool, ['--version'], { encoding: 'utf8' });
  if (result.error || result.status !== 0) throw result.error || new Error(result.stderr);
}
'@
    Invoke-Node -NodeArguments @('--input-type=module', '-e', $verifyTools, $installed)
    foreach ($command in @('seekbrain', 'seekbrain-014', 'seekbrain-pdf')) {
        $entry = 'seekbrain.mjs'
        if ($command -eq 'seekbrain-pdf') { $entry = 'seekbrain-pdf.mjs' }
        $lines = @('@echo off', "rem $marker", 'setlocal DisableDelayedExpansion', 'if not exist "%~dp0..\current.cmd" exit /b 1', 'call "%~dp0..\current.cmd"', ('"%SEEKBRAIN_INSTALL_NODE%" "%SEEKBRAIN_INSTALL_PACKAGE%\bin\' + $entry + '" %*'), 'exit /b %errorlevel%')
        Write-AtomicAscii (Join-Path $bin "$command.cmd") (($lines -join "`r`n") + "`r`n")
    }
    $pointerLines = @(
        "@rem $marker"
        ('@set "SEEKBRAIN_INSTALL_NODE=%~dp0releases\' + $releaseId + '\runtime\node.exe"')
        ('@set "SEEKBRAIN_INSTALL_PACKAGE=%~dp0releases\' + $releaseId + '\npm\node_modules\seekbrain"')
    )
    Write-AtomicAscii $pointer (($pointerLines -join "`r`n") + "`r`n")
    $committed = $true
    if (-not $NoModifyPath) {
        try {
            $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
            $entries = @($userPath -split ';' | Where-Object { $_ })
            if ($entries -notcontains $bin) { [Environment]::SetEnvironmentVariable('Path', ((@($bin) + $entries) -join ';'), 'User') }
        } catch { Write-Warning "Installed successfully; add $bin to your user PATH manually. $_" }
    }
    Write-Host "SeekBrain installed in $Prefix. Open a new terminal, then run: seekbrain setup"
    Write-Host "For this terminal: `$env:Path = '$($bin.Replace("'", "''"));' + `$env:Path"
    Write-Host 'Git for Windows and Python are required for analysis. Check them with: seekbrain doctor'
} finally {
    $env:Path = $originalPath
    try {
        if (-not $committed -and (Test-Path -LiteralPath $stage)) { Remove-Item -LiteralPath $stage -Recurse -Force }
    } finally {
        if ($lock) {
            $lock.Dispose()
            Remove-Item -LiteralPath $lockPath -Force
        }
    }
}
