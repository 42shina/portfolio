#!/bin/sh
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
npm install --global "$(node -p 'require(process.argv[1]).packageManager' "$root/package.json")" --ignore-scripts --no-audit --no-fund
# Temporary upstream dependency patches for npm 12.2.1; keep integrity pins.
test "$(npm --version)" = '12.2.1'
patch_dir=$(mktemp -d)
trap 'rm -rf "$patch_dir"' EXIT HUP INT TERM
cp "$root/scripts/npm-security/package.json" "$root/scripts/npm-security/package-lock.json" "$patch_dir/"
npm ci --prefix "$patch_dir" --ignore-scripts --no-audit --no-fund
npm_root=$(npm root --global)/npm/node_modules
for package in ip-address undici; do
  test -d "$npm_root/$package"
  rm -rf "$npm_root/$package"
  cp -R "$patch_dir/node_modules/$package" "$npm_root/$package"
done
