#!/bin/sh
set -eu
VERSION="${1:-latest}"
INSTALL_DIR="${INSTALL_DIR:-$HOME/.local/bin}"
OS=$(uname -s)
ARCH=$(uname -m)
case "$OS" in
  Darwin)
    PLATFORM="darwin"
    ;;
  Linux)
    PLATFORM="linux"
    ;;
  *)
    printf "\x1b[1;31mUnsupported operating system\x1b[0m: \x1b[1m$OS\x1b[0m\n" >&2
    exit 1
    ;;
esac
case "$ARCH" in
  arm64|aarch64)
    ARCH="arm64"
    ;;
  x86_64|amd64)
    ARCH="x64"
    ;;
  *)
    printf "\x1b[1;31mUnsupported architecture\x1b[0m: \x1b[1m$ARCH\x1b[0m\n" >&2
    exit 1
    ;;
esac
ASSET="remder-$PLATFORM-$ARCH"
BASE_URL="https://github.com/Keyboard1000n17/remder/releases"
if [ "$VERSION" = "latest" ]; then
  URL="$BASE_URL/latest/download/$ASSET"
else
  URL="$BASE_URL/download/$VERSION/$ASSET"
fi
mkdir -p "$INSTALL_DIR"
TMPFILE=$(mktemp)
trap 'rm -f "$TMPFILE"' EXIT
echo "Downloading $ASSET..."
curl -fSL "$URL" -o "$TMPFILE"
chmod +x "$TMPFILE"
mv "$TMPFILE" "$INSTALL_DIR/remder"
echo "remder installed to $INSTALL_DIR/remder"
