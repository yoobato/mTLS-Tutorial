#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
if [ "$#" -lt 1 ]; then
  echo "Usage: bash scripts/test-mtls.sh https://YOUR-HOST/mtls-test.txt [extra curl options]" >&2
  exit 2
fi
TARGET_URL="$1"
shift
EXTRA_CURL_ARGS=("$@")
RESULT_DIR="$(mktemp -d)"
trap 'rm -rf "$RESULT_DIR"' EXIT
failures=0
check() {
  local label="$1" stem="$2" expected="$3"
  local args=(--silent --show-error --connect-timeout 5 --max-time 15 --noproxy '*')
  if [ "${#EXTRA_CURL_ARGS[@]}" -gt 0 ]; then args+=("${EXTRA_CURL_ARGS[@]}"); fi
  if [ "$stem" != none ]; then
    args+=(--cert "$ROOT_DIR/certs/$stem.crt" --key "$ROOT_DIR/certs/$stem.key")
  fi
  local status rc=0
  status=$(curl "${args[@]}" -o "$RESULT_DIR/body" -w '%{http_code}' \
    "$TARGET_URL" 2>"$RESULT_DIR/error") || rc=$?
  case "$expected" in
    ok) test "$rc" -eq 0 && test "$status" = 200 && grep -q 'mTLS OK' "$RESULT_DIR/body" ;;
    identity) test "$rc" -eq 0 && test "$status" = 403 ;;
    reject) { test "$rc" -eq 0 && test "$status" = 400; } || {
      { test "$rc" -eq 35 || test "$rc" -eq 56; } && test "$status" = 000 &&
      grep -Eiq 'SSL|TLS|certificate' "$RESULT_DIR/error";
    } ;;
  esac && local result=PASS || { local result=FAIL; failures=$((failures + 1)); }
  printf '%-5s | %-24s | curl=%s HTTP=%s\n' "$result" "$label" "$rc" "$status"
  if [ "$result" = FAIL ]; then cat "$RESULT_DIR/body" "$RESULT_DIR/error" 2>/dev/null || true; fi
}
check valid-certificate valid-cli ok
check wrong-subject-serial invalid-sn-cli identity
check untrusted-ca invalid-ca-cli reject
check no-client-certificate none reject
if [ "$failures" -ne 0 ]; then echo "$failures checks failed" >&2; exit 1; fi
echo '4개 mTLS 검사를 모두 통과했습니다.'
