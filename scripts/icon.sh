#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
tmp=$(mktemp -d)
trap 'rm -r "$tmp"' EXIT
mkdir "$tmp/Masu.iconset"
swift -module-cache-path "$tmp/cache" scripts/render-icon.swift artwork/masu.svg "$tmp/master.png"
cp "$tmp/master.png" artwork/masu.png
for size in 16 32 128 256 512; do
 for scale in 1 2; do
  px=$((size*scale))
  suffix=''; if [[ $scale == 2 ]]; then suffix='@2x'; fi
  sips -z "$px" "$px" "$tmp/master.png" --out "$tmp/Masu.iconset/icon_${size}x${size}${suffix}.png" >/dev/null
 done
done
python3 scripts/pack-icon.py "$tmp/Masu.iconset" artwork/Masu.icns
swift -module-cache-path "$tmp/cache" scripts/folder-icon.swift artwork/Masu.icns "$PWD"
