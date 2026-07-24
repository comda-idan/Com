#!/usr/bin/env bash
# העלאת גרסה ידנית: ./scripts/bump-version.sh [major|minor|patch]
# מספר ה-build עולה אוטומטית בכל בנייה (ראו build/Version.targets).
set -euo pipefail

PART="${1:-patch}"
FILE="$(dirname "$0")/../version.json"

python3 - "$FILE" "$PART" <<'PY'
import json, sys, datetime
path, part = sys.argv[1], sys.argv[2]
with open(path, encoding='utf-8') as f:
    v = json.load(f)
if part not in ('major', 'minor', 'patch'):
    sys.exit('usage: bump-version.sh [major|minor|patch]')
v[part] += 1
if part == 'major':
    v['minor'] = v['patch'] = 0
elif part == 'minor':
    v['patch'] = 0
v['build'] = 0
v['updatedUtc'] = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
with open(path, 'w', encoding='utf-8') as f:
    json.dump(v, f, indent=2, ensure_ascii=False)
    f.write('\n')
print(f"version -> {v['major']}.{v['minor']}.{v['patch']}.{v['build']}")
PY
