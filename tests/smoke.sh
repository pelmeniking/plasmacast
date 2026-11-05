#!/bin/bash
set -uo pipefail

cd "$(dirname "$0")/.." || exit 1
cli=bin/plasmacast
fail=0
pass() { printf '  ok    %s\n' "$1"; }
bad() { printf '  FAIL  %s\n' "$1"; fail=1; }

echo "doctor"
$cli doctor | sed 's/^/  /' || fail=1

echo "ipc"
[[ $($cli call system.healthPing '{}') == '{"ok":true,"data":null}' ]] && pass "system.healthPing round trip" || bad "system.healthPing round trip"
[[ $($cli call foo.bar) == '{"ok":false,"error":"Unknown method foo.bar"}' ]] && pass "unknown methods are errors" || bad "unknown methods are errors"
$cli call settings.getGeneralSettings | grep -q '"popToRootTimeout"' && pass "settings document loaded" || bad "settings document loaded"

echo "root search (Phase 1)"
search() { $cli call rootSearch.search "{\"query\":\"$1\"}"; }
first() { search "$1" | python3 -I -c 'import json,sys; d=json.load(sys.stdin); print(d["data"][0]["rows"][0]["title"] if d["ok"] and d["data"] else "")'; }
[[ $(first "lock screen") == "Lock Screen" ]] && pass "KDE actions are searchable (lock screen)" || bad "KDE actions are searchable (lock screen)"
[[ $(first "") != "" ]] && pass "empty root has sections" || bad "empty root has sections"
search zzzz-no-match | grep -q '"id":"fallback-commands"' && pass "fallback section for unmatched queries" || bad "fallback section for unmatched queries"
count=$($cli call system.info | python3 -I -c 'import json,sys; print(json.load(sys.stdin)["data"]["candidates"])')
(( count > 100 )) && pass "$count candidates (apps, settings pages, KDE actions)" || bad "only $count candidates"

echo "toggle round trip (shortcut -> qs ipc -> launcher; budget 100 ms)"
# KWin has no layer event stream like Hyprland's socket2, so this times the
# IPC round trip a shortcut press makes; mapping the surface comes on top.
$cli hide
worst=0
for i in 1 2 3 4 5; do
  t0=$(date +%s%N); $cli show; t1=$(date +%s%N); sleep 0.3
  [[ $($cli call system.info >/dev/null; "$cli" ping) == ok ]] || bad "run $i: no answer"
  t2=$(date +%s%N); $cli hide; t3=$(date +%s%N); sleep 0.3
  show_ms=$(( (t1 - t0) / 1000000 )); hide_ms=$(( (t3 - t2) / 1000000 ))
  printf '        run %d: show %3d ms, hide %3d ms\n' "$i" "$show_ms" "$hide_ms"
  (( show_ms > worst )) && worst=$show_ms
  (( hide_ms > worst )) && worst=$hide_ms
done
(( worst > 0 && worst < 100 )) && pass "worst toggle ${worst} ms" || bad "worst toggle ${worst} ms"

exit $fail
