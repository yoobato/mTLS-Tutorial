# 테스트 인증서 생성

클라이언트 인증을 확인하기 위해 self-signed CA 두 개와 클라이언트 인증서 세 개를 만듭니다. **서버 HTTPS 인증서는 실습 안내에서 준비한 것을 그대로 사용**합니다.

| 파일 | 발급 CA | Subject serialNumber |
| --- | --- | --- |
| `valid-cli.crt` | `valid-ca.crt` | `123456789` |
| `invalid-sn-cli.crt` | `valid-ca.crt` | `987654321` |
| `invalid-ca-cli.crt` | `invalid-ca.crt` | `123456789` |

웹서버는 `valid-ca.crt`만 신뢰하도록 설정합니다. `invalid-ca`는 형식이 잘못된 CA가 아니라 **신뢰 목록에 넣지 않는 다른 CA**라는 뜻입니다.

## ⚙️ 한 번에 생성하기

저장소 루트에서 실행합니다. `certs/`가 비어 있지 않으면 덮어쓰지 않고 멈춥니다.

```bash
bash scripts/generate-certs.sh
```

직접 명령을 실행하고 싶다면 아래 순서를 따릅니다. 위 스크립트를 실행했다면 다시 생성할 필요는 없습니다.

## 1. 테스트 CA 두 개 생성

```bash
mkdir -p certs
cd certs
umask 077

openssl req -x509 -newkey rsa:2048 -nodes -sha256 -days 365 \
  -keyout valid-ca.key -out valid-ca.crt \
  -subj '/C=KR/L=Seoul/O=KFTC/CN=kftc.io/emailAddress=dy.ryu@kftc.or.kr' \
  -addext 'basicConstraints=critical,CA:TRUE,pathlen:0' \
  -addext 'keyUsage=critical,keyCertSign,cRLSign' \
  -addext 'subjectKeyIdentifier=hash'

openssl req -x509 -newkey rsa:2048 -nodes -sha256 -days 365 \
  -keyout invalid-ca.key -out invalid-ca.crt \
  -subj '/C=KR/L=Seoul/O=KFTC/CN=untrusted-ca.kftc.io/emailAddress=dy.ryu@kftc.or.kr' \
  -addext 'basicConstraints=critical,CA:TRUE,pathlen:0' \
  -addext 'keyUsage=critical,keyCertSign,cRLSign' \
  -addext 'subjectKeyIdentifier=hash'
```

`-nodes`는 개인키를 암호화하지 않는 옵션입니다. 여기서는 로컬 테스트 키에 사용합니다. CA 개인키는 인증서에 서명하는 쪽에만 보관하며 **웹서버에는 CA 인증서만** 복사합니다.

## 2. 개인키와 CSR 생성

CSR에는 공개키와 신청자의 Subject 정보를 담습니다. `-subj`의 `/serialNumber=...`가 Subject DN의 기관 식별값이며 OID는 `2.5.4.5`입니다.

```bash
openssl genrsa -out valid-cli.key 2048
openssl req -new -sha256 -key valid-cli.key -out valid-cli.csr \
  -subj '/C=KR/L=Seoul/O=KFTC/serialNumber=123456789/CN=mtls.kftc.io/emailAddress=dy.ryu@kftc.or.kr'

openssl genrsa -out invalid-sn-cli.key 2048
openssl req -new -sha256 -key invalid-sn-cli.key -out invalid-sn-cli.csr \
  -subj '/C=KR/L=Seoul/O=KFTC/serialNumber=987654321/CN=mtls.kftc.io/emailAddress=dy.ryu@kftc.or.kr'

openssl genrsa -out invalid-ca-cli.key 2048
openssl req -new -sha256 -key invalid-ca-cli.key -out invalid-ca-cli.csr \
  -subj '/C=KR/L=Seoul/O=KFTC/serialNumber=123456789/CN=mtls.kftc.io/emailAddress=dy.ryu@kftc.or.kr'
```

## 3. 클라이언트 인증서 발급

`client.ext` 파일을 만듭니다.

```ini
basicConstraints=critical,CA:FALSE
keyUsage=critical,digitalSignature
extendedKeyUsage=clientAuth
subjectKeyIdentifier=hash
authorityKeyIdentifier=keyid,issuer
```

CA는 CSR을 바탕으로 인증서를 구성하고 **CA 개인키로 인증서에 서명**합니다.

```bash
openssl x509 -req -in valid-cli.csr \
  -CA valid-ca.crt -CAkey valid-ca.key -set_serial 1001 \
  -sha256 -days 30 -extfile client.ext -out valid-cli.crt

openssl x509 -req -in invalid-sn-cli.csr \
  -CA valid-ca.crt -CAkey valid-ca.key -set_serial 1002 \
  -sha256 -days 30 -extfile client.ext -out invalid-sn-cli.crt

openssl x509 -req -in invalid-ca-cli.csr \
  -CA invalid-ca.crt -CAkey invalid-ca.key -set_serial 2001 \
  -sha256 -days 30 -extfile client.ext -out invalid-ca-cli.crt
```

`-set_serial 1001` 등은 **인증서 자체의 일련번호**입니다. 접근 허용 조건인 Subject의 `serialNumber=123456789`와는 다릅니다.

## 4. 인증서 확인과 웹서버 복사

```bash
openssl x509 -in valid-cli.crt -noout -subject -issuer -nameopt RFC2253
openssl verify -purpose sslclient -CAfile valid-ca.crt valid-cli.crt
openssl verify -purpose sslclient -CAfile valid-ca.crt invalid-sn-cli.crt
openssl verify -purpose sslclient -CAfile valid-ca.crt invalid-ca-cli.crt
```

마지막 명령만 CA 검증에 실패해야 합니다. 다른 기관 식별값의 인증서는 CA 검증에는 성공하고, 이후 웹서버의 Subject 검사에서 거절됩니다.

서버에서 다음과 같이 신뢰할 CA 인증서만 배치합니다. 클라이언트 개인키와 CA 개인키는 복사하지 않습니다.

```bash
sudo mkdir -p /etc/mtls-demo
sudo install -m 644 certs/valid-ca.crt /etc/mtls-demo/valid-ca.crt
```

위 복사 명령은 **저장소 루트** 기준입니다. 직접 생성 절차에서 `certs/`로 이동했다면 먼저 `cd ..`를 실행합니다. 클라이언트와 웹서버가 다른 컴퓨터라면 `valid-ca.crt`를 서버로 전달한 뒤 배치합니다.

> **실제 오픈뱅킹에서는**
>
> 요청자가 실제 사용하는 인증서의 발급 체인과 오픈뱅킹 연동 안내를 확인해 **승인된 CA 인증서 묶음**을 배치합니다. 테스트용 `valid-ca.crt`를 운영에 사용하지 않습니다. 실제 기관의 클라이언트 인증서를 이 테스트 CA로 새로 발급하는 절차도 아닙니다.


<details>
<summary>전체 생성 스크립트</summary>


```bash
#!/usr/bin/env bash
set -euo pipefail
umask 077
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CERT_DIR="$ROOT_DIR/certs"
OPENSSL_BIN="${OPENSSL_BIN:-openssl}"
if [ -d "$CERT_DIR" ] && [ -n "$(ls -A "$CERT_DIR")" ]; then
  echo "certs/가 비어 있지 않습니다. 기존 인증서를 덮어쓰지 않습니다." >&2
  echo "재생성하려면 기존 certs/를 다른 위치로 옮긴 뒤 다시 실행하세요." >&2
  exit 1
fi
mkdir -p "$CERT_DIR"
cd "$CERT_DIR"

# Two self-signed CAs. Only valid-ca.crt is trusted by the provider servers.
"$OPENSSL_BIN" req -x509 -newkey rsa:2048 -nodes -sha256 -days 365 \
  -keyout valid-ca.key -out valid-ca.crt \
  -subj '/C=KR/L=Seoul/O=KFTC/CN=kftc.io/emailAddress=dy.ryu@kftc.or.kr' \
  -addext 'basicConstraints=critical,CA:TRUE,pathlen:0' \
  -addext 'keyUsage=critical,keyCertSign,cRLSign' \
  -addext 'subjectKeyIdentifier=hash'
"$OPENSSL_BIN" req -x509 -newkey rsa:2048 -nodes -sha256 -days 365 \
  -keyout invalid-ca.key -out invalid-ca.crt \
  -subj '/C=KR/L=Seoul/O=KFTC/CN=untrusted-ca.kftc.io/emailAddress=dy.ryu@kftc.or.kr' \
  -addext 'basicConstraints=critical,CA:TRUE,pathlen:0' \
  -addext 'keyUsage=critical,keyCertSign,cRLSign' \
  -addext 'subjectKeyIdentifier=hash'

cat > client.ext <<'EOF'
basicConstraints=critical,CA:FALSE
keyUsage=critical,digitalSignature
extendedKeyUsage=clientAuth
subjectKeyIdentifier=hash
authorityKeyIdentifier=keyid,issuer
EOF
make_client() {
  local stem="$1" identity="$2" ca="$3" certificate_serial="$4"
  "$OPENSSL_BIN" genrsa -out "$stem.key" 2048
  "$OPENSSL_BIN" req -new -sha256 -key "$stem.key" -out "$stem.csr" \
    -subj "/C=KR/L=Seoul/O=KFTC/serialNumber=$identity/CN=mtls.kftc.io/emailAddress=dy.ryu@kftc.or.kr"
  "$OPENSSL_BIN" x509 -req -in "$stem.csr" -CA "$ca.crt" -CAkey "$ca.key" \
    -set_serial "$certificate_serial" -sha256 -days 30 -extfile client.ext -out "$stem.crt"
}
make_client valid-cli 123456789 valid-ca 1001
make_client invalid-sn-cli 987654321 valid-ca 1002
make_client invalid-ca-cli 123456789 invalid-ca 2001

"$OPENSSL_BIN" verify -purpose sslclient -CAfile valid-ca.crt valid-cli.crt invalid-sn-cli.crt
echo '테스트 인증서 생성 완료. Subject 식별값:'
for cert in valid-cli invalid-sn-cli invalid-ca-cli; do
  "$OPENSSL_BIN" x509 -in "$cert.crt" -noout -subject -issuer -nameopt RFC2253
done
```


</details>
