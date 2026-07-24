#!/usr/bin/env bash
# Build a Kiwi/Chrome-ready extension zip (manifest.json at zip root).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/app.suppliersden.com"
OUT="$ROOT/release"
NAME="Meesho_Shipping_Cost_Optimizer_AI_-_Unlimited"
DEST="$OUT/$NAME"

if [[ ! -f "$SRC/manifest.json" ]]; then
  echo "ERROR: $SRC/manifest.json not found"
  exit 1
fi

echo "Building extension package from $SRC"
rm -rf "$DEST" "$OUT/$NAME.zip"
mkdir -p "$DEST"

cp -a "$SRC/." "$DEST/"

# Remove web-only files (not needed for extension/Kiwi)
rm -f "$DEST/_headers" "$DEST/index.html" \
  "$DEST/web-app.js" "$DEST/web-shim.js" \
  "$DEST/web-optimizer.js" "$DEST/web-session.js"

# Ensure Kiwi readme is included
cp "$SRC/START_HERE_KIWI.txt" "$DEST/"
cp "$SRC/HOW_TO_INSTALL.txt" "$DEST/"

if [[ ! -f "$DEST/manifest.json" ]]; then
  echo "ERROR: manifest.json missing from package"
  exit 1
fi

(
  cd "$OUT"
  zip -r -q "$NAME.zip" "$NAME"
)

echo ""
echo "Done."
echo "  Folder: $DEST"
echo "  Zip:    $OUT/$NAME.zip"
echo ""
echo "manifest.json is at the root of both. Unzip on phone → Kiwi → Load unpacked."
ls -la "$DEST/manifest.json" "$OUT/$NAME.zip"
