# 테스트 인증서 생성

클라이언트 인증을 확인하기 위해 self-signed CA 두 개와 클라이언트 인증서 세 개를 만듭니다. 기관 식별값<small>(Subject DN의 `serialNumber`)</small>의 허용값은 `123456789`로 가정합니다.

| 파일 | 발급 CA | 기관 식별값 | 비고 |
| --- | --- | --- | --- |
| `valid-cli.crt` | `valid-ca.crt` | `123456789` | 신뢰하는 CA + 기관 식별값 일치 |
| `invalid-sn-cli.crt` | `valid-ca.crt` | `987654321` | 신뢰하는 CA + 기관 식별값 불일치 |
| `invalid-ca-cli.crt` | `invalid-ca.crt` | `123456789` | 신뢰하지 않는 CA + 기관 식별값 일치 |


## 1. 테스트 CA 두 개 생성

```bash
mkdir -p "{작업디렉터리}"
cd "{작업디렉터리}"
mkdir -p certs
cd certs

# 신뢰하는 CA 인증서 + 개인키
openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
  -keyout valid-ca.key -out valid-ca.crt \
  -subj '/C=KR/L=Seoul/O=KFTC/CN=Test CA'

# 신뢰하지 않는 CA 인증서 + 개인키
openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
  -keyout invalid-ca.key -out invalid-ca.crt \
  -subj '/C=KR/L=Seoul/O=KFTC/CN=Untrusted Test CA'
```

> `-nodes`는 개인키를 암호화하지 않는 옵션입니다.
>
> CA 개인키는 인증서에 서명하는 쪽에만 보관하며 **웹서버에는 CA 인증서만** 복사합니다.

기본 OpenSSL 설정으로 CA 인증서를 생성합니다. 다음 명령으로 **두 인증서 모두 `CA:TRUE`가 포함되어 있는지** 확인합니다.

```bash
openssl x509 -in valid-ca.crt -noout -text
openssl x509 -in invalid-ca.crt -noout -text
```

> `CA:TRUE`가 없다면 현재 OpenSSL 설정에 CA 확장이 지정되지 않은 것입니다. 위 생성 명령에 `-addext 'basicConstraints=critical,CA:TRUE'`를 추가해 다시 생성합니다.


## 2. 개인키와 CSR 생성

CSR에는 공개키와 신청자의 Subject 정보를 담습니다. `-subj`의 `/serialNumber=...`가 Subject DN의 기관 식별값이며 OID는 `2.5.4.5`입니다.

```bash
# 신뢰하는 CA + 기관 식별값 일치
openssl genrsa -out valid-cli.key 2048
openssl req -new -key valid-cli.key -out valid-cli.csr \
  -subj '/C=KR/L=Seoul/O=KFTC/serialNumber=123456789'

# 신뢰하는 CA + 기관 식별값 불일치
openssl genrsa -out invalid-sn-cli.key 2048
openssl req -new -key invalid-sn-cli.key -out invalid-sn-cli.csr \
  -subj '/C=KR/L=Seoul/O=KFTC/serialNumber=987654321'

# 신뢰하지 않는 CA + 기관 식별값 일치
openssl genrsa -out invalid-ca-cli.key 2048
openssl req -new -key invalid-ca-cli.key -out invalid-ca-cli.csr \
  -subj '/C=KR/L=Seoul/O=KFTC/serialNumber=123456789'
```


## 3. 클라이언트 인증서 발급

CA는 CSR을 바탕으로 인증서를 구성하고 **CA 개인키로 인증서에 서명**합니다.

```bash
# 신뢰하는 CA + 기관 식별값 일치
openssl x509 -req -in valid-cli.csr \
  -CA valid-ca.crt -CAkey valid-ca.key \
  -out valid-cli.crt

# 신뢰하는 CA + 기관 식별값 불일치
openssl x509 -req -in invalid-sn-cli.csr \
  -CA valid-ca.crt -CAkey valid-ca.key \
  -out invalid-sn-cli.crt

# 신뢰하지 않는 CA + 기관 식별값 일치
openssl x509 -req -in invalid-ca-cli.csr \
  -CA invalid-ca.crt -CAkey invalid-ca.key \
  -out invalid-ca-cli.crt
```


## 4. 인증서 확인

```bash
openssl x509 -in valid-cli.crt -noout -subject -issuer -nameopt RFC2253
openssl verify -purpose sslclient -CAfile valid-ca.crt valid-cli.crt
openssl verify -purpose sslclient -CAfile valid-ca.crt invalid-sn-cli.crt
openssl verify -purpose sslclient -CAfile valid-ca.crt invalid-ca-cli.crt
```

마지막 명령만 인증서 검증에 실패해야 합니다. 기관 식별값이 불일치하는 인증서는 인증서 검증에는 성공하고, 이후 웹서버의 기관 식별값 검사에서 거절됩니다.

> **실제 오픈뱅킹 연동 시에는**
>
> 이 튜토리얼에서는 직접 만든 테스트 CA를 사용합니다. 실제로는 **오픈뱅킹 연동 안내에 명시된 CA 인증서와 기관 식별값**을 적용해야 합니다.
