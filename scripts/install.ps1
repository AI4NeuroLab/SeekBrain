[CmdletBinding()]
param(
    [string]$Version,
    [string]$Prefix,
    [string]$Cache,
    [string]$Bundle,
    [string]$Checksums,
    [string]$Mirror,
    [switch]$NoModifyPath,
    [switch]$Help
)

if ($Help) {
    Write-Output @'
SeekBrain GitHub Release installer for Windows x64 (PowerShell 5.1+)
Installs private Node 24, Python, Git Bash and SeekBrain without administrator rights.
  -Version <version>   Pin a release (default: latest stable)
  -Prefix <directory>  Default: %LOCALAPPDATA%\SeekBrain
  -Cache <directory>   Archive cache
  -Bundle <zip>        Local bundle; requires -Version and -Checksums
  -Checksums <file>    SHA256SUMS for the local bundle
  -Mirror <URL>        Optional HTTPS mirror root; falls back to GitHub
  -NoModifyPath        Do not change your user PATH
  -Help                Show help without installing anything

SEEKBRAIN_RELEASE_BASE_URL can select a GitHub Release mirror.
SEEKBRAIN_DOWNLOAD_MIRROR also sets -Mirror. Mirror layout:
  download/v<VERSION>/<release assets>, latest/download/version.txt,
  upstream/<PortableGit archive filename>.
Downloads show percentage/bytes, speed and ETA, retry and resume after interruption.
Source/npm package testing is available separately in install-package.ps1.
'@
    return
}

$previousErrorAction = $ErrorActionPreference
$previousProgress = $ProgressPreference
$ErrorActionPreference = 'Stop'
# Windows PowerShell's per-chunk download progress can dominate large downloads.
$ProgressPreference = 'SilentlyContinue'
$lock = $null
$stage = $null
$createdEnvironment = $null
$createdLaunchers = @()
$committed = $false
$originalPath = $env:Path

function Invoke-PrivateNode([string[]]$NodeArguments) {
    & $node @NodeArguments
    if ($LASTEXITCODE -ne 0) { throw "Bundle validation failed ($LASTEXITCODE)." }
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

function Get-Download([string]$Url, [string]$Destination, [switch]$Resume, [string]$Sha256) {
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
    $curl = Join-Path $env:SystemRoot 'System32\curl.exe'
    if (-not (Test-Path -LiteralPath $curl)) { throw 'This installer requires Windows 10/11 with system curl.exe for progress and resumable downloads.' }
    $sources = @()
    if ($Mirror) {
        if ($Url.StartsWith($base + '/', [StringComparison]::OrdinalIgnoreCase)) {
            $sources += $Mirror + $Url.Substring($base.Length)
        } elseif ($Url.StartsWith('https://github.com/git-for-windows/git/releases/download/', [StringComparison]::OrdinalIgnoreCase)) {
            $sources += $Mirror + '/upstream/' + ($Url.Split('/')[-1])
        }
    }
    $sources += $Url
    $lastFailure = ''
    foreach ($sourceUrl in ($sources | Select-Object -Unique)) {
        Write-Host "Downloading $($sourceUrl.Split('/')[-1]) from $(([Uri]$sourceUrl).Host)..."
        for ($attempt = 1; $attempt -le 3; $attempt++) {
            $curlArguments = @('--disable', '--fail', '--location', '--show-error', '--connect-timeout', '15',
                '--max-time', '1800', '--speed-limit', '1024', '--speed-time', '30',
                '--output', $Destination, '--write-out', '%{http_code}')
            if ($Resume) { $curlArguments += @('--continue-at', '-') }
            # Use curl's native meter, avoiding Windows PowerShell's costly per-chunk progress records.
            $httpStatus = & $curl @curlArguments $sourceUrl
            $downloadExit = $LASTEXITCODE
            if ($downloadExit -eq 0) {
                if (-not $Sha256 -or (Get-FileHash -LiteralPath $Destination -Algorithm SHA256).Hash.ToLowerInvariant() -eq $Sha256) { return }
                $lastFailure = 'SHA-256 mismatch'
                Remove-Item -LiteralPath $Destination -Force
                if ($attempt -lt 3) {
                    Write-Warning 'SHA-256 mismatch; retrying with a fresh download.'
                    continue
                }
                break
            }
            $lastFailure = "curl exit $downloadExit, HTTP $httpStatus"
            # A server without Range support, or an invalid/full partial file, needs a fresh transfer.
            if ($Resume -and ($downloadExit -eq 33 -or $httpStatus -eq '416')) {
                if (Test-Path -LiteralPath $Destination) { Remove-Item -LiteralPath $Destination -Force }
            }
            if ($attempt -lt 3) {
                Write-Host "Download interrupted; retry $attempt/2 (resuming cached bytes when available)..."
                Start-Sleep -Seconds $attempt
            }
        }
        if ($sourceUrl -ne $Url) { Write-Warning "Mirror unavailable or invalid ($lastFailure); trying the official source." }
    }
    throw "Download failed ($lastFailure). Run the installer again to resume verified-archive downloads."
}

function Get-VerifiedArchive([string]$Url, [string]$Filename, [string]$Sha256) {
    if ($Filename -match '[/\\]' -or $Sha256 -cnotmatch '\A[a-f0-9]{64}\z') { throw 'Invalid archive metadata.' }
    $destination = Join-Path $Cache $Filename
    if ((Test-Path -LiteralPath $destination) -and
        (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash.ToLowerInvariant() -eq $Sha256) {
        return $destination
    }
    # The checksum scopes partial files to an exact immutable artifact, even if a release is replaced.
    $partial = $destination + '.' + $Sha256 + '.download'
    if (-not ((Test-Path -LiteralPath $partial) -and
        (Get-FileHash -LiteralPath $partial -Algorithm SHA256).Hash.ToLowerInvariant() -eq $Sha256)) {
        Get-Download $Url $partial -Resume -Sha256 $Sha256
        if ((Get-FileHash -LiteralPath $partial -Algorithm SHA256).Hash.ToLowerInvariant() -ne $Sha256) { throw "SHA-256 mismatch: $Filename" }
    }
    Move-Item -LiteralPath $partial -Destination $destination -Force
    return $destination
}

try {
    if ($env:OS -ne 'Windows_NT') { throw 'Use install.sh on Linux/macOS/WSL.' }
    if (-not [Environment]::Is64BitOperatingSystem -or $env:PROCESSOR_ARCHITECTURE -ne 'AMD64' -or $env:PROCESSOR_ARCHITEW6432) { throw 'Use 64-bit PowerShell on x64 Windows.' }
    if (-not $Prefix) { $Prefix = $env:SEEKBRAIN_INSTALL_PREFIX }
    if (-not $Prefix) { $Prefix = Join-Path $env:LOCALAPPDATA 'SeekBrain' }
    $Prefix = [IO.Path]::GetFullPath($Prefix)
    if (-not $Cache) { $Cache = $env:SEEKBRAIN_INSTALL_CACHE }
    if (-not $Cache) { $Cache = Join-Path $Prefix 'cache' }
    $Cache = [IO.Path]::GetFullPath($Cache)
    $base = 'https://github.com/AI4NeuroLab/SeekBrain/releases'
    if ($env:SEEKBRAIN_RELEASE_BASE_URL) { $base = $env:SEEKBRAIN_RELEASE_BASE_URL.TrimEnd('/') }
    if (-not $Mirror) { $Mirror = $env:SEEKBRAIN_DOWNLOAD_MIRROR }
    if ($Mirror) {
        $Mirror = $Mirror.TrimEnd('/')
        $mirrorUri = $null
        if (-not [Uri]::TryCreate($Mirror, [UriKind]::Absolute, [ref]$mirrorUri) -or
            $mirrorUri.Scheme -ne 'https' -or $mirrorUri.UserInfo -or $mirrorUri.Query -or $mirrorUri.Fragment) {
            throw '-Mirror must be an HTTPS URL without credentials, query parameters or fragments.'
        }
    }
    if ($Bundle -and (-not $Version -or -not $Checksums)) { throw '-Bundle requires -Version and -Checksums.' }
    if ($Version -and $Version -cnotmatch '\A[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?\z') { throw 'Invalid release version.' }
    $bin = Join-Path $Prefix 'bin'
    New-Item -ItemType Directory -Force -Path $Prefix, $Cache, $bin | Out-Null
    $lockPath = Join-Path $Prefix '.install.lock'
    $lock = [IO.File]::Open($lockPath, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
    $marker = 'SeekBrain managed launcher'
    foreach ($command in @('seekbrain', 'seekbrain-014', 'seekbrain-pdf')) {
        $launcher = Join-Path $bin "$command.cmd"
        if ((Test-Path -LiteralPath $launcher) -and -not ([IO.File]::ReadAllText($launcher).Contains($marker))) { throw "Command already exists: $launcher" }
    }
    $pointer = Join-Path $Prefix 'current.cmd'
    if ((Test-Path -LiteralPath $pointer) -and -not ([IO.File]::ReadAllText($pointer).Contains($marker))) { throw 'Existing current.cmd is not managed by SeekBrain.' }
    $stage = Join-Path (Join-Path $Prefix 'releases') ('install-' + [Guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Force -Path $stage | Out-Null
    if (-not $Version) {
        $versionFile = Join-Path $stage 'version.txt'
        Get-Download "$base/latest/download/version.txt" $versionFile
        $Version = [IO.File]::ReadAllText($versionFile).Trim()
        if ($Version -cnotmatch '\A[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?\z') { throw 'Invalid release version metadata.' }
    }
    $asset = "seekbrain-$Version-windows-x64.zip"
    if (-not $Checksums) {
        $Checksums = Join-Path $stage 'SHA256SUMS'
        Get-Download "$base/download/v$Version/SHA256SUMS" $Checksums
    }
    $pattern = '\A([a-f0-9]{64})  ' + [regex]::Escape($asset) + '\z'
    $matching = @([IO.File]::ReadAllLines((Resolve-Path -LiteralPath $Checksums).Path) | Where-Object { $_ -cmatch $pattern })
    if ($matching.Count -ne 1) { throw "Missing or ambiguous SHA-256 for $asset" }
    $sha256 = [regex]::Match($matching[0], $pattern).Groups[1].Value
    if (-not $Bundle) { $Bundle = Get-VerifiedArchive "$base/download/v$Version/$asset" $asset $sha256 }
    $Bundle = (Resolve-Path -LiteralPath $Bundle).Path
    if ((Get-FileHash -LiteralPath $Bundle -Algorithm SHA256).Hash.ToLowerInvariant() -ne $sha256) { throw 'SHA-256 mismatch; previous installation preserved.' }
    # Windows' libarchive preserves hidden entries and handles long npm paths.
    $tar = Join-Path $env:SystemRoot 'System32\tar.exe'
    if (-not (Test-Path -LiteralPath $tar)) { throw 'This installer requires Windows 10/11 or Windows Server with tar.exe.' }
    Write-Host 'Extracting SeekBrain bundle...'
    # Keep tar argv ASCII while allowing a Unicode working directory. A regular
    # file is required: Windows libarchive's streaming ZIP reader can omit files.
    $localArchiveName = 'seekbrain-extract-' + [Guid]::NewGuid().ToString('N') + '.zip'
    $localArchive = Join-Path $stage $localArchiveName
    $extractInfo = New-Object Diagnostics.ProcessStartInfo
    $extractInfo.FileName = $tar
    $extractInfo.Arguments = '-xf ' + $localArchiveName
    $extractInfo.WorkingDirectory = $stage
    $extractInfo.UseShellExecute = $false
    $extractInfo.CreateNoWindow = $true
    $extractor = New-Object Diagnostics.Process
    $extractor.StartInfo = $extractInfo
    try {
        [IO.File]::Copy($Bundle, $localArchive)
        [void]$extractor.Start()
        $extractor.WaitForExit()
        if ($extractor.ExitCode -ne 0) { throw 'Bundle extraction failed.' }
    } finally {
        $extractor.Dispose()
        if (Test-Path -LiteralPath $localArchive) { Remove-Item -LiteralPath $localArchive -Force }
    }
    $verifier = Join-Path $stage 'verify-release.mjs'
    if (-not (Test-Path -LiteralPath $verifier -PathType Leaf)) {
        $entries = @([IO.Directory]::GetFileSystemEntries($stage) | ForEach-Object { [IO.Path]::GetFileName($_) }) -join ', '
        throw "Bundle extraction is missing verify-release.mjs. Extracted entries: $entries"
    }
    Write-Host 'Checking private Node, Python and terminal runtime...'
    $node = Join-Path $stage 'runtime\node\node.exe'
    Invoke-PrivateNode -NodeArguments @((Join-Path $stage 'verify-release.mjs'), '--target', 'win32-x64', '--version', $Version)
    $manifest = [IO.File]::ReadAllText((Join-Path $stage 'bundle.json')) | ConvertFrom-Json
    if (-not $manifest.git -or $manifest.git.url -notlike 'https://github.com/git-for-windows/git/releases/download/*') { throw 'Missing official Git Bash metadata.' }
    $gitArchive = Get-VerifiedArchive $manifest.git.url $manifest.git.file $manifest.git.sha256
    $gitDirectory = Join-Path $stage 'runtime\git'
    Write-Host 'Preparing private Git Bash...'
    Invoke-PrivateNode -NodeArguments @((Join-Path $stage 'install-helpers.mjs'), 'extract-git', $gitArchive, $gitDirectory)
    Invoke-PrivateNode -NodeArguments @((Join-Path $stage 'verify-release.mjs'), '--target', 'win32-x64', '--version', $Version, '--require-git')
    $pythonVersion = [string]$manifest.python.version
    if ($pythonVersion -cnotmatch '\A[0-9]+\.[0-9]+\.[0-9]+\z') { throw 'Invalid Python version.' }
    $environment = Join-Path (Join-Path $Prefix 'environments') "python-$pythonVersion"
    $python = Join-Path $stage 'runtime\python\python.exe'
    if (-not (Test-Path -LiteralPath $environment)) {
        Write-Host 'Preparing private Python environment...'
        $createdEnvironment = $environment
        & $python -X utf8 -I -m venv $environment
        if ($LASTEXITCODE -ne 0) { throw 'Could not prepare private Python environment.' }
    }
    & (Join-Path $environment 'Scripts\python.exe') -X utf8 -I -m pip --version
    if ($LASTEXITCODE -ne 0) { throw 'Private Python environment validation failed.' }
    foreach ($command in @('seekbrain', 'seekbrain-014', 'seekbrain-pdf')) {
        $pdf = ''
        if ($command -eq 'seekbrain-pdf') { $pdf = '--pdf-command ' }
        $entry = 'seekbrain.mjs'
        if ($command -eq 'seekbrain-pdf') { $entry = 'seekbrain-pdf.mjs' }
        $lines = @('@echo off', "rem $marker", 'setlocal DisableDelayedExpansion', 'set "SEEKBRAIN_INSTALL_RELEASE="',
            'set "SEEKBRAIN_INSTALL_PREFIX=%~dp0.."', 'call "%~dp0..\current.cmd"', 'if defined SEEKBRAIN_INSTALL_RELEASE goto bundle',
            ('"%SEEKBRAIN_INSTALL_NODE%" "%SEEKBRAIN_INSTALL_PACKAGE%\bin\' + $entry + '" %*'), 'exit /b %errorlevel%', ':bundle',
            ('"%SEEKBRAIN_INSTALL_RELEASE%\runtime\node\node.exe" "%SEEKBRAIN_INSTALL_RELEASE%\launch.mjs" ' + $pdf + '%*'), 'exit /b %errorlevel%')
        $destination = Join-Path $bin "$command.cmd"
        if (-not (Test-Path -LiteralPath $destination)) { $createdLaunchers += $destination }
        Write-AtomicAscii $destination (($lines -join "`r`n") + "`r`n")
    }
    $releaseId = Split-Path -Leaf $stage
    $pointerText = "@rem $marker`r`n" + ('@set "SEEKBRAIN_INSTALL_RELEASE=%~dp0releases\' + $releaseId + '"') + "`r`n"
    Write-AtomicAscii $pointer $pointerText
    $committed = $true
    if (-not $NoModifyPath) {
        try {
            $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
            $entries = @($userPath -split ';' | Where-Object { $_ })
            if ($entries -notcontains $bin) { [Environment]::SetEnvironmentVariable('Path', ((@($bin) + $entries) -join ';'), 'User') }
        } catch { Write-Warning "Installed; add $bin to your user PATH manually." }
    }
    Write-Host "SeekBrain $Version installed. Open a new terminal, then run: seekbrain setup"
    Write-Host "Or run now: & `"$bin\seekbrain.cmd`" setup"
} finally {
    $env:Path = $originalPath
    try {
        if (-not $committed) {
            if ($stage -and (Test-Path -LiteralPath $stage)) { Remove-Item -LiteralPath $stage -Recurse -Force }
            if ($createdEnvironment -and (Test-Path -LiteralPath $createdEnvironment)) { Remove-Item -LiteralPath $createdEnvironment -Recurse -Force }
            foreach ($launcher in $createdLaunchers) { if (Test-Path -LiteralPath $launcher) { Remove-Item -LiteralPath $launcher -Force } }
        }
    } finally {
        if ($lock) { $lock.Dispose(); Remove-Item -LiteralPath $lockPath -Force }
        $ProgressPreference = $previousProgress
        $ErrorActionPreference = $previousErrorAction
    }
}
