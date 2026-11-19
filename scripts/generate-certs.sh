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

