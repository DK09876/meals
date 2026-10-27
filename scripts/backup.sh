#!/usr/bin/env bash
# Snapshot the Meals database, as Gains and LifeOS do.
#
# Copied with sqlite3 .backup rather than cp: it takes a consistent snapshot
# while the app is still writing. A snapshot is skipped when nothing has
# changed since the last one.
#
#   scripts/backup.sh            snapshot if changed, prune
#   scripts/backup.sh --verify   also integrity-check the newest snapshot
#   scripts/backup.sh --force    snapshot even if unchanged
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB="${MEALS_DB_PATH:-$ROOT/data/meals.db}"
DEST="${MEALS_BACKUP_DIR:-$HOME/backups/meals}"
KEEP="${MEALS_BACKUP_KEEP:-30}"

VERIFY=0; FORCE=0
for arg in "$@"; do
  case "$arg" in
    --verify) VERIFY=1 ;;
    --force)  FORCE=1 ;;
  esac
done

[ -f "$DB" ] || { echo "no database at $DB" >&2; exit 1; }
mkdir -p "$DEST"

# sha256sum on the Pi, shasum on a Mac - so the script can be tried anywhere.
if command -v sha256sum >/dev/null; then hash() { sha256sum | cut -d' ' -f1; }; else hash() { shasum -a 256 | cut -d' ' -f1; }; fi

# Hash the logical contents, not the file: SQLite rewrites pages for reasons
# that do not change what is stored.
CURRENT=$(sqlite3 "$DB" ".dump" | hash)
MARKER="$DEST/.last-hash"

if [ "$FORCE" -eq 0 ] && [ -f "$MARKER" ] && [ "$(cat "$MARKER")" = "$CURRENT" ]; then
  echo "database unchanged since last snapshot - skipping"
else
  OUT="$DEST/meals_$(date +%Y%m%d_%H%M%S).db"
  suffix=1
  while [ -e "$OUT.gz" ]; do
    OUT="$DEST/meals_$(date +%Y%m%d_%H%M%S)_$suffix.db"
    suffix=$((suffix + 1))
  done
  sqlite3 "$DB" ".backup '$OUT'"
  gzip -f "$OUT"
  echo "$CURRENT" > "$MARKER"
  echo "backed up -> $OUT.gz ($(du -h "$OUT.gz" | cut -f1))"
fi

old=$(ls -1t "$DEST"/meals_*.db.gz 2>/dev/null | tail -n +$((KEEP + 1)) || true)
if [ -n "$old" ]; then
  echo "$old" | xargs rm -f
  echo "pruned $(echo "$old" | wc -l | tr -d ' ') beyond the newest $KEEP"
fi

if [ "$VERIFY" -eq 1 ]; then
  NEWEST=$(ls -1t "$DEST"/meals_*.db.gz 2>/dev/null | head -1)
  [ -z "$NEWEST" ] && { echo "verify: nothing to check" >&2; exit 1; }
  TMP=$(mktemp)
  gunzip -c "$NEWEST" > "$TMP"
  INTEGRITY=$(sqlite3 "$TMP" "PRAGMA integrity_check" 2>/dev/null || echo FAIL)
  PROFILES=$(sqlite3 "$TMP" "SELECT COUNT(*) FROM profiles" 2>/dev/null || echo FAIL)
  EATEN=$(sqlite3 "$TMP" "SELECT COUNT(*) FROM meal_log" 2>/dev/null || echo FAIL)
  rm -f "$TMP"
  echo "verify: $(basename "$NEWEST") integrity=$INTEGRITY profiles=$PROFILES logged=$EATEN"
  [ "$INTEGRITY" = "ok" ] || exit 1
fi
