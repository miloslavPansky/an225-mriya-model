#!/usr/bin/env bash
# Kouřový test stránky v headless Chrome: stránka se načte, three.js poběží,
# app.js dopočítá model a vyplní statistiky. Volitelně uloží snímek obrazovky.
#   tests/smoke.sh [URL] [screenshot.png]
# Prohlížeč: proměnná CHROME (výchozí google-chrome).
set -euo pipefail
URL="${1:-http://localhost:8000/}"
SHOT="${2:-}"
CHROME="${CHROME:-google-chrome}"
FLAGS=(--headless=new --disable-gpu --use-angle=swiftshader --enable-unsafe-swiftshader
       --hide-scrollbars --window-size=1400,1000 --virtual-time-budget=15000)
# Runner GitHub Actions (Ubuntu 24.04, AppArmor) neumožní sandbox Chrome – jen tam ho vypnout.
[[ -n "${GITHUB_ACTIONS:-}" ]] && FLAGS+=(--no-sandbox)

DOM="$("$CHROME" "${FLAGS[@]}" --dump-dom "$URL" 2>/dev/null)"
# id="sN" obsahuje "<počet> dílů · ~<n> desek" až po úspěšném buildModel + vykreslení
STAT="$(printf '%s' "$DOM" | grep -o 'id="sN"[^<]*' | head -1 | sed 's/.*>//')"
if [[ "$STAT" != *dílů* ]]; then
  echo "✗ Model se na stránce nevykreslil (statistika sN: '${STAT:-nenalezena}')." >&2
  exit 1
fi
echo "✓ Stránka vykreslena: $STAT"
FIT="$(printf '%s' "$DOM" | grep -o 'id="sX"[^<]*' | head -1 | sed 's/.*>//')"
echo "  $FIT"

if [[ -n "$SHOT" ]]; then
  "$CHROME" "${FLAGS[@]}" --screenshot="$SHOT" "$URL" >/dev/null 2>&1
  echo "✓ Snímek: $SHOT"
fi
