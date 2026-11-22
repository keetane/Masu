#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
app=Masu.app/Contents
mkdir -p "$app/MacOS" "$app/Resources"
tmp=$(mktemp -d)
trap 'rm -r "$tmp"' EXIT
swiftc -O -module-cache-path "$tmp/cache" macos/main.swift -o "$app/MacOS/Masu"
rsync -a --delete dist/ "$app/Resources/web/"
cp artwork/Masu.icns "$app/Resources/Masu.icns"
cat > "$app/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0"><dict>
<key>CFBundleName</key><string>Masu</string><key>CFBundleDisplayName</key><string>Masu</string>
<key>CFBundleIdentifier</key><string>local.masu.workbook</string>
<key>CFBundleVersion</key><string>1</string><key>CFBundleShortVersionString</key><string>1.0</string>
<key>CFBundlePackageType</key><string>APPL</string><key>CFBundleExecutable</key><string>Masu</string>
<key>CFBundleIconFile</key><string>Masu.icns</string><key>NSHighResolutionCapable</key><true/>
</dict></plist>
PLIST
codesign --force --sign - Masu.app
codesign --verify --strict Masu.app
