#!/usr/bin/env bash
# Syncs the standing-rules blocks from STANDING_RULES.md into every skill's
# Gotchas section. A skill opts in to a block by containing its marker pair.
# Idempotent; run after any edit to STANDING_RULES.md.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
src="$root/STANDING_RULES.md"

[ -f "$src" ] || { echo "missing $src" >&2; exit 1; }

stamped=0
for f in "$root"/skills/*/SKILL.md; do
  changed=0
  for block in core pi; do
    start="<!-- standing-rules:$block:start -->"
    end="<!-- standing-rules:$block:end -->"
    grep -qF "$start" "$f" || continue
    grep -qF "$end" "$f" || { echo "$f: has start marker but no end marker for '$block'" >&2; exit 1; }
    tmp="$(mktemp)"
    awk -v start="$start" -v end="$end" -v src="$src" '
      BEGIN {
        n = 0; inblk = 0
        while ((getline line < src) > 0) {
          if (line == start) inblk = 1
          if (inblk) repl[n++] = line
          if (line == end) inblk = 0
        }
        if (n == 0) { print "block not found in source: " start > "/dev/stderr"; exit 1 }
      }
      $0 == start { for (i = 0; i < n; i++) print repl[i]; skip = 1; next }
      $0 == end   { skip = 0; next }
      !skip { print }
    ' "$f" > "$tmp"
    if ! cmp -s "$tmp" "$f"; then changed=1; fi
    mv "$tmp" "$f"
  done
  if [ "$changed" = 1 ]; then echo "updated: ${f#$root/}"; stamped=$((stamped+1)); fi
done

echo "done; $stamped file(s) changed"
