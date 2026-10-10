#!/bin/sh
# Downloads the plugin versions in plugin-versions.txt into .obsidian/plugins/<id>/. Settings (data.json) are kept.
set -eu
cd "$(dirname "$0")/.."
grep -v '^#' plugin-versions.txt | while read -r id repo version; do
  [ -n "$id" ] || continue
  dir=.obsidian/plugins/$id
  mkdir -p "$dir"
  for f in main.js manifest.json; do
    curl -fsSL "https://github.com/$repo/releases/download/$version/$f" -o "$dir/$f"
  done
  curl -fsSL "https://github.com/$repo/releases/download/$version/styles.css" -o "$dir/styles.css" || rm -f "$dir/styles.css"
  echo "$id $version"
done
