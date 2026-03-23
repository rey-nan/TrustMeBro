#!/bin/bash
# TrustMeBro Installer
# Usage: curl -fsSL https://raw.githubusercontent.com/rey-nan/TrustMeBro/main/install.sh -o /tmp/tmb_install.sh && bash /tmp/tmb_install.sh

# CRITICAL: redirect stdin to /dev/tty when piped from curl
if [ ! -t 0 ]; then
  exec < /dev/tty
fi

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

echo ""
echo -e "${BOLD}=======================================${NC}"
echo -e "${GREEN}  TrustMeBro Installer${NC}"
echo -e "${CYAN}  Not Skynet. Probably.${NC}"
echo -e "${BOLD}=======================================${NC}"
echo ""

OS="$(uname -s)"
echo -e "Platform: ${CYAN}$OS${NC}"
echo ""

check_node() {
  if command -v node &> /dev/null; then
    echo -e "${GREEN}✓ Node.js:${NC} $(node --version)"
  else
    echo -e "${YELLOW}Node.js not found. Installing...${NC}"
    if [ "$OS" = "Linux" ]; then
      if command -v apt-get &> /dev/null; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y nodejs
      elif command -v yum &> /dev/null; then
        curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
        yum install -y nodejs
      else
        echo -e "${RED}Please install Node.js 18+ from: https://nodejs.org${NC}"
        exit 1
      fi
    elif [ "$OS" = "Darwin" ]; then
      brew install node
    fi
  fi
}

check_git() {
  if command -v git &> /dev/null; then
    echo -e "${GREEN}✓ Git:${NC} $(git --version)"
  else
    echo -e "${YELLOW}Git not found. Installing...${NC}"
    if [ "$OS" = "Linux" ]; then
      if command -v apt-get &> /dev/null; then
        apt-get install -y git
      elif command -v yum &> /dev/null; then
        yum install -y git
      fi
    fi
  fi
}

install_trustmebro() {
  INSTALL_DIR="$HOME/TrustMeBro"
  if [ -d "$INSTALL_DIR" ]; then
    echo ""
    echo -e "${YELLOW}TrustMeBro already exists at $INSTALL_DIR${NC}"
    read -p "Update to latest version? (y/n): " UPDATE
    if [ "$UPDATE" = "y" ] || [ "$UPDATE" = "Y" ]; then
      cd "$INSTALL_DIR" && git pull
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

build_and_setup() {
  echo ""
  echo -e "${BOLD}Installing dependencies...${NC}"
  npm install

  echo -e "${BOLD}Building core...${NC}"
  npm run build:core

  echo -e "${BOLD}Building CLI...${NC}"
  npm run build:cli

  cd packages/cli && npm link && cd ../..

  echo ""
  echo -e "${GREEN}✓ Build complete!${NC}"
  echo ""
}

check_node
check_git
install_trustmebro

# Save the project root directory
PROJECT_DIR="$(pwd)"

build_and_setup

echo -e "${BOLD}=======================================${NC}"
echo -e "${GREEN}  TrustMeBro installed!${NC}"
echo -e "${CYAN}  Not Skynet. Probably.${NC}"
echo -e "${BOLD}=======================================${NC}"
echo ""
echo "Starting setup wizard..."
echo ""

cd "$PROJECT_DIR"
node packages/cli/dist/index.js setup
