param(
    [string]$Version = "latest"
)

$Arch = (Get-CimInstance Win32_OperatingSystem).OSArchitecture

if ($Arch -ne "64-Bit") {
    throw "Unsupported Windows architecture: $Arch"
}

$Asset = "remder-windows-x64.exe"
$InstallDir = Join-Path $env:LOCALAPPDATA "Programs\remder"
$BaseUrl = "https://github.com/Keyboard1000n17/remder/releases"

if ($Version -eq "latest") {
    $Url = "$BaseUrl/latest/download/$Asset"
} else {
    $Url = "$BaseUrl/download/$Version/$Asset"
}

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null

$TempFile = Join-Path $env:TEMP "remder-install.exe"

try {
    Write-Host "Downloading $Asset..."
    Invoke-WebRequest -Uri $Url -OutFile $TempFile

    Move-Item -Force $TempFile (Join-Path $InstallDir "remder.exe")
}
finally {
    Remove-Item -Force $TempFile -ErrorAction SilentlyContinue
}

$UserPath = [Environment]::GetEnvironmentVariable("Path", "User")

if (($UserPath -split ";") -notcontains $InstallDir) {
    [Environment]::SetEnvironmentVariable(
        "Path",
        "$UserPath;$InstallDir",
        "User"
    )
}

$env:Path = "$InstallDir;$env:Path"

Write-Host "remder installed to $InstallDir"
