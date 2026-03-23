# TrustMeBro Installer for Windows
# Usage: iwr -useb https://raw.githubusercontent.com/rey-nan/TrustMeBro/main/install.ps1 | iex

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=======================================" -ForegroundColor White
Write-Host "  TrustMeBro Installer" -ForegroundColor Green
Write-Host "  Not Skynet. Probably." -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor White
Write-Host ""

# Verificar Node.js
function Check-Node {
  try {
    $nodeVersion = node --version 2>$null
    if ($nodeVersion) {
      Write-Host "✓ Node.js found: $nodeVersion" -ForegroundColor Green
      $major = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
      if ($major -lt 18) {
        Write-Host "⚠ Node.js 18+ required." -ForegroundColor Yellow
        Install-Node
      }
    }
  } catch {
    Write-Host "Node.js not found. Installing..." -ForegroundColor Yellow
    Install-Node
  }
}

function Install-Node {
  Write-Host "Downloading Node.js installer..." -ForegroundColor Cyan
  $nodeUrl = "https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi"
  $installer = "$env:TEMP\node-installer.msi"
  Invoke-WebRequest -Uri $nodeUrl -OutFile $installer
  Write-Host "Installing Node.js (this may take a moment)..." -ForegroundColor Cyan
  Start-Process msiexec.exe -Wait -ArgumentList "/i $installer /quiet"
  Remove-Item $installer
  $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH", "User")
  Write-Host "✓ Node.js installed!" -ForegroundColor Green
}

# Verificar Git
function Check-Git {
  try {
    $gitVersion = git --version 2>$null
    Write-Host "✓ Git found: $gitVersion" -ForegroundColor Green
  } catch {
    Write-Host "Git not found." -ForegroundColor Yellow
    Write-Host "Please install Git from: https://git-scm.com/download/win" -ForegroundColor Cyan
    Start-Process "https://git-scm.com/download/win"
    Write-Host ""
    Read-Host "After installing Git, press Enter to continue"
  }
}

# Clonar repositório
function Install-TrustMeBro {
  $installDir = "$(Get-Location)\TrustMeBro"

  if (Test-Path $installDir) {
    Write-Host ""
    Write-Host "TrustMeBro already exists at $installDir" -ForegroundColor Yellow
    $update = Read-Host "Update to latest version? (y/n)"
    if ($update -eq "y" -or $update -eq "Y") {
      Set-Location $installDir
      git pull
    } else {
      Set-Location $installDir
    }
  } else {
    Write-Host ""
    Write-Host "Installing to: $installDir" -ForegroundColor Cyan
    git clone https://github.com/rey-nan/TrustMeBro.git $installDir
    Set-Location $installDir
  }

  return $installDir
}

# Build
function Build-Project {
  Write-Host ""
  Write-Host "Installing dependencies..." -ForegroundColor White
  npm install --silent

  Write-Host "Building core..." -ForegroundColor White
  npm run build:core

  Write-Host "Building CLI..." -ForegroundColor White
  npm run build:cli

  Write-Host ""
  Write-Host "✓ Build complete!" -ForegroundColor Green
  Write-Host ""
}

# Executar
Check-Node
Check-Git
$dir = Install-TrustMeBro
Build-Project

Write-Host "=======================================" -ForegroundColor White
Write-Host "  TrustMeBro installed successfully!" -ForegroundColor Green
Write-Host "  Not Skynet. Probably." -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor White
Write-Host ""
Write-Host "Starting setup wizard..." -ForegroundColor White
Write-Host ""

node packages/cli/dist/index.js setup
