#!/bin/bash

# TrustMeBro Installer
# Usage: curl -fsSL https://raw.githubusercontent.com/rey-nan/TrustMeBro/main/install.sh | bash

set -e

# Fix stdin for curl | bash
if [ ! -t 0 ]; then
  exec < /dev/tty
fi

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

echo ""
echo -e "${BOLD}═══════════════════════════════════════${NC}"
echo -e "${GREEN}  TrustMeBro Installer${NC}"
echo -e "${CYAN}  Not Skynet. Probably.${NC}"
echo -e "${BOLD}═══════════════════════════════════════${NC}"
echo ""

# Detectar OS
OS="$(uname -s)"
ARCH="$(uname -m)"

echo -e "Platform: ${CYAN}$OS ($ARCH)${NC}"
echo ""

# Verificar/instalar Node.js
check_node() {
  if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✓ Node.js found:${NC} $NODE_VERSION"
    NODE_MAJOR=$(node -e "console.log(process.version.split('.')[0].slice(1))")
    if [ "$NODE_MAJOR" -lt 18 ]; then
      echo -e "${YELLOW}⚠ Node.js 18+ required. Current: $NODE_VERSION${NC}"
      install_node
    fi
  else
    echo -e "${YELLOW}Node.js not found. Installing...${NC}"
    install_node
  fi
}

install_node() {
  if [ "$OS" = "Linux" ]; then
    if command -v apt-get &> /dev/null; then
      echo "Installing Node.js via apt..."
      curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
      sudo apt-get install -y nodejs
    elif command -v yum &> /dev/null; then
      echo "Installing Node.js via yum..."
      curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
      sudo yum install -y nodejs
    elif command -v pacman &> /dev/null; then
      echo "Installing Node.js via pacman..."
      sudo pacman -S --noconfirm nodejs npm
    else
      echo -e "${RED}Could not install Node.js automatically.${NC}"
      echo "Please install Node.js 18+ from: https://nodejs.org"
      exit 1
    fi
  elif [ "$OS" = "Darwin" ]; then
    if command -v brew &> /dev/null; then
      echo "Installing Node.js via Homebrew..."
      brew install node
    else
      echo -e "${RED}Please install Node.js from: https://nodejs.org${NC}"
      exit 1
    fi
  fi
}

# Verificar/instalar Git
check_git() {
  if command -v git &> /dev/null; then
    GIT_VERSION=$(git --version)
    echo -e "${GREEN}✓ Git found:${NC} $GIT_VERSION"
  else
    echo -e "${YELLOW}Git not found. Installing...${NC}"
    if [ "$OS" = "Linux" ]; then
      if command -v apt-get &> /dev/null; then
        sudo apt-get install -y git
      elif command -v yum &> /dev/null; then
        sudo yum install -y git
      elif command -v pacman &> /dev/null; then
        sudo pacman -S --noconfirm git
      fi
    elif [ "$OS" = "Darwin" ]; then
      echo -e "${RED}Please install Git from: https://git-scm.com${NC}"
      exit 1
    fi
  fi
}

# Clonar repositório
install_trustmebro() {
  INSTALL_DIR="$HOME/TrustMeBro"

  if [ -d "$INSTALL_DIR" ]; then
    echo ""
    echo -e "${YELLOW}TrustMeBro already exists at $INSTALL_DIR${NC}"
    read -p "Update to latest version? (y/n): " UPDATE
    if [ "$UPDATE" = "y" ] || [ "$UPDATE" = "Y" ]; then
      echo "Updating..."
      cd "$INSTALL_DIR"
      git pull
    else
      cd "$INSTALL_DIR"
    fi
  else
    echo ""
    echo -e "Installing to: ${CYAN}$INSTALL_DIR${NC}"
    git clone https://github.com/rey-nan/TrustMeBro.git "$INSTALL_DIR"
    cd "$INSTALL_DIR"
  fi
}

# Build
build_and_setup() {
  echo ""
  echo -e "${BOLD}Installing dependencies...${NC}"
  npm install --silent

  echo -e "${BOLD}Building core...${NC}"
  npm run build:core --silent

  echo -e "${BOLD}Building CLI...${NC}"
  npm run build:cli --silent

  echo ""
  echo -e "${GREEN}✓ Build complete!${NC}"
  echo ""
}

# Executar
check_node
check_git
install_trustmebro
build_and_setup

echo -e "${BOLD}═══════════════════════════════════════${NC}"
echo -e "${GREEN}  TrustMeBro installed successfully!${NC}"
echo -e "${CYAN}  Not Skynet. Probably.${NC}"
echo -e "${BOLD}═══════════════════════════════════════${NC}"
echo ""
echo "Starting setup wizard..."
echo ""

# Run setup directly via compiled CLI (no tmb needed)
node packages/cli/dist/index.js setup
