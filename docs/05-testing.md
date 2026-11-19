# cURL을 이용한 검증

이 페이지는 **mTLS 설정을 적용한 이후** 실행합니다. `api.example.com`을 본인 HTTPS 주소로 바꾸고, 인증서 파일 경로는 저장소 루트를 기준으로 사용합니다. Nginx와 Apache에서 같은 명령으로 확인할 수 있습니다.

## 1. 정상 CA + 정상 Subject serialNumber

```bash
curl --cert certs/valid-cli.crt --key certs/valid-cli.key \
  -i https://api.example.com/mtls-test.txt
```

HTTP **200**과 본문 `mTLS OK`를 확인합니다.

## 2. 정상 CA + 다른 Subject serialNumber

```bash
curl --cert certs/invalid-sn-cli.crt --key certs/invalid-sn-cli.key \
  -i https://api.example.com/mtls-test.txt
```

HTTP **403**이어야 합니다. CA 검증에는 성공했지만 Subject의 기관 식별값이 다릅니다.

## 3. 다른 CA + 정상 Subject serialNumber

```bash
curl --cert certs/invalid-ca-cli.crt --key certs/invalid-ca-cli.key \
  -i https://api.example.com/mtls-test.txt
```

웹서버가 신뢰하지 않는 CA의 인증서이므로 거절되어야 합니다. 웹서버·TLS 버전에 따라 TLS 연결 오류 또는 HTTP 400으로 나타날 수 있습니다.

## 4. 클라이언트 인증서 없음

```bash
curl -i https://api.example.com/mtls-test.txt
```

이 요청도 거절되어야 합니다. **실습 안내에서 일반 HTTPS만 설정했을 때는 성공했지만, mTLS를 추가한 뒤에는 실패**하는 것이 맞습니다.

## 서버 인증서가 테스트용인 경우

위 명령은 일반적으로 신뢰되는 서버 인증서, 예를 들어 Let’s Encrypt 서버 인증서를 전제로 합니다. 로컬 테스트 서버가 별도 테스트 CA를 사용한다면 각 명령에 다음 옵션을 추가합니다.

```bash
--cacert /path/to/server-ca.crt
```

`--cacert`는 **cURL이 서버를 검증할 때**의 신뢰 CA입니다. 웹서버의 `ssl_client_certificate` / `SSLCACertificateFile`은 **웹서버가 클라이언트를 검증할 때**의 신뢰 CA입니다. 같은 파일일 수도 있지만 서로 다른 방향의 설정입니다. `-k` / `--insecure`는 사용하지 않습니다.

## 자동 검사

```bash
bash scripts/test-mtls.sh https://api.example.com/mtls-test.txt
```

로컬 서버 인증서의 CA도 지정해야 한다면 다음과 같이 실행합니다.

```bash
bash scripts/test-mtls.sh https://localhost:8443/mtls-test.txt \
  --cacert /path/to/server-ca.crt
```

4개 케이스를 모두 통과해야 종료코드 0을 반환합니다. 연결 거부·서버 장애를 인증 거절로 오인하지 않도록 예상한 HTTP 400 또는 TLS 오류를 검사합니다.

<details>
<summary>자동 검사 스크립트</summary>


```bash
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
```


</details>

## ✅ 로컬에서 확인한 결과

이번 초안의 설정을 별도 백엔드 없이 Nginx 1.28.3과 Apache 2.4.67의 정적 파일 제공으로 검증했습니다. 검증 환경의 Apache TLS 라이브러리가 TLS 1.3을 지원하지 않아 Apache는 `SSLProtocol -all +TLSv1.2`로 실행했습니다. 로컬 검증용 서버 인증서를 사용했으며, 실제 도메인의 Let’s Encrypt 발급은 실행하지 않았습니다.

| 케이스 | Nginx | Apache |
| --- | --- | --- |
| 정상 CA + 정상 번호 | HTTP 200 | HTTP 200 |
| 정상 CA + 다른 번호 | HTTP 403 | HTTP 403 |
| 다른 CA + 정상 번호 | HTTP 400 | TLS 연결 오류 |
| 인증서 없음 | HTTP 400 | TLS 연결 오류 |
| 다른 번호 + 다른 Subject 속성 안에 허용 번호 문자열 삽입 | HTTP 403 | HTTP 403 |

cURL의 HTTP `000` 표시는 실제 HTTP 상태코드가 아니라 **HTTP 응답을 받지 못했다는 출력값**입니다. cURL은 기본적으로 HTTP 400/403에도 프로세스 종료코드 0을 반환할 수 있으므로 HTTP 상태와 오류 메시지를 함께 확인합니다.

## 🛠️ 문제 해결

| 현상 | 확인할 것 |
| --- | --- |
| 서버 인증서 오류 | 서버 인증서 만료·체인·SAN과 접속 호스트, 필요 시 `--cacert` |
| 정상 클라이언트도 거절 | 인증서·키 쌍, `clientAuth` 용도, CA 파일, 검증 깊이 |
| HTTP 403 | 실제 Subject의 `serialNumber`와 설정의 허용값 |
| Nginx에서 `map` 위치 오류 | `http {}` 내부에 include했는지 |
| Apache에서 TLS 버전 설정 오류 | 해당 빌드의 지원 버전; TLS 1.3 미지원이면 `+TLSv1.3` 제외 |
| 연결 거부 | 웹서버 실행 여부·리스너·포트·방화벽 |

> **실제 오픈뱅킹 테스트에서는**
>
> 웹서버에 실제 오픈뱅킹의 승인된 CA 체인과 기관 식별값을 설정한 뒤 해당 연동용 클라이언트 인증서로 확인합니다. 테스트 CA로 서명한 이 예제의 인증서는 운영용 신뢰 설정에서 통과하지 않는 것이 정상입니다.

