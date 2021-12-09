# mTLS(Mutual TLS) 튜토리얼
금융분야 [마이데이터](https://mydata.kftc.or.kr/) 및 [오픈뱅킹](https://www.openbanking.or.kr/) **정보제공자**의 mTLS 적용을 위한 웹서버(apache, nginx) 설정 및 테스트 튜토리얼

## TODO
- [ ] mTLS 개요 (링크로 갈음?)
- [ ] 샘플 웹서버 설정 (Apache, Nginx + Flask)
- [ ] 서버 SSL 인증서 설정 (Let's encrypt)
- [ ] 웹서버 mTLS 설정 (Apache, Nginx)
- [ ] 테스트 방법 (curl 명령어)
- [ ] 오픈뱅킹 정보제공자 mTLS 설명 (DigiCert 등)

## 목차 
1. [테스트용 클라이언트 CA 인증서 생성](#테스트용-클라이언트-CA-인증서-생성)
2. [테스트용 클라이언트 인증서 생성](#테스트용-클라이언트-인증서-생성)
3. [테스트용 웹서버 설정](#테스트용-웹서버-설정)
4. [mTLS 테스트](#mTLS-테스트)
5. [참고](#참고)

---

## 테스트용 클라이언트 CA 인증서 생성

클라이언트 인증서를 검증할 때 사용할 (self-signed)**CA 인증서**를 2개 생성한다.
- [유효한 CA 인증서](#유효한-CA-인증서-생성)
- [유효하지 않은 CA 인증서](#유효하지-않은-CA-인증서-생성)

### 유효한 CA 인증서 생성
```sh
openssl req -newkey rsa:2048 -nodes -keyform PEM -keyout valid-ca.key -x509 -days 365 \
 -outform PEM -out valid-ca.crt

# 실행 결과
# ...전략 (Country Name ~ Email Address의 값은 자유롭게 입력)
Country Name (2 letter code) []:KR
State or Province Name (full name) []:
Locality Name (eg, city) []:Seoul
Organization Name (eg, company) []:KFTC
Organizational Unit Name (eg, section) []:Dev
Common Name (eg, fully qualified host name) []:kftc.io
Email Address []:dy.ryu@kftc.or.kr
```

현재 디렉토리에 `valid-ca.crt` 파일과 `valid-ca.key` 두 개의 파일이 생성된다.
이중 `valid-ca.crt` 파일은 **웹서버에 업로드**한다.

### 유효하지 않은 CA 인증서 생성

위와 동일한 방법으로 **유효하지 않은 CA 인증서**도 한 개 생성한다. (웹서버 업로드 X)
```sh
openssl req -newkey rsa:2048 -nodes -keyform PEM -keyout invalid-ca.key -x509 -days 365 \
 -outform PEM -out invalid-ca.crt
```

---

## 테스트용 클라이언트 인증서 생성

아래와 같이 총 **3개**의 인증서를 발급한다.
- [정상 인증서](#정상-인증서)
- [SerialNumber가 다른 인증서](#SerialNumber가-다른-인증서)
- [CA가 다른 인증서](#CA가-다른-인증서)

> 원래 SerialNumber는 Subject DN 안에 기술되어 있으나, 여기에서는 편의상 **OU(Organizational Unit Name)**에 기재한다.

우선 공통으로 사용할 개인키 파일을 생성한다.
```sh
openssl genrsa -out pass.key 2048

# 실행 결과
Generating RSA private key, 2048 bit long modulus
..................+++
................................................................................
............................................................................+++
e is 65537 (0x10001)
```

현재 디렉토리에 `pass.key` 파일이 생성된다.

### 정상 인증서

CSR(Certificate Signing Request) 파일을 생성한다.
```sh
openssl req -new -key pass.key -out valid-cli.csr

# 실행 결과
# ...전략 (OU를 제외한 Country Name ~ Email Address의 값은 자유롭게 입력)
# OU에는 중계기관(정보제공자(서버) 입장에서의 클라이언트)에서 제공한 SerialNumber를 입력 (123456789라 가정)
Country Name (2 letter code) []:KR
State or Province Name (full name) []:
Locality Name (eg, city) []:Seoul
Organization Name (eg, company) []:KFTC
Organizational Unit Name (eg, section) []:SerialNumber 123456789
Common Name (eg, fully qualified host name) []:mtls.kftc.io
Email Address []:dy.ryu@kftc.or.kr

Please enter the following 'extra' attributes
to be sent with your certificate request
A challenge password []:
```
> Challenge password는 편의상 생략한다. (값 입력 없이 엔터키를 치면 비밀번호가 없는 CSR 파일이 생성된다.)

유효한 CA 인증서(`valid-ca.crt`, `valid-ca.key`)로 CSR 파일(`valid-cli.csr`)을 서명한다.
```sh
openssl x509 -req -in valid-cli.csr -CA valid-ca.crt -CAkey valid-ca.key -set_serial 1234 \
 -days 365 -outform PEM -out valid-cli.crt

# 실행 결과
Signature ok
subject=/C=KR/L=Seoul/O=KFTC/OU=SerialNumber 123456789/CN=mtls.kftc.io/emailAddress=dy.ryu@kftc.or.kr
Getting CA Private Key
```
> *set_serial*은 인증서의 일련번호를 설정하는 것으로 아무 값이나 입력해도 된다.
> mTLS 검증 시 인증서 자체의 일련번호가 아니라, **Subject DN 안에 있는 일련번호**를 검증한다.

현재 디렉토리에 **정상** 인증서인 `valid-cli.crt` 파일이 생성된다.

### SerialNumber가 다른 인증서

**SerialNumber를 다르게**하여 CSR(Certificate Signing Request) 파일을 생성한다.
```sh
openssl req -new -key pass.key -out invalid-sn-cli.csr

# 실행 결과
# ...전략 (OU를 제외한 Country Name ~ Email Address의 값은 자유롭게 입력)
# OU에 올바르지 않은 SerialNumber를 입력한다.
Country Name (2 letter code) []:KR
State or Province Name (full name) []:
Locality Name (eg, city) []:Seoul
Organization Name (eg, company) []:KFTC
Organizational Unit Name (eg, section) []:SerialNumber 987654321
Common Name (eg, fully qualified host name) []:mtls.kftc.io
Email Address []:dy.ryu@kftc.or.kr
# ...후략
```

유효한 CA 인증서(`valid-ca.crt`, `valid-ca.key`)로 CSR 파일(`invalid-sn-cli.csr`)을 서명한다.
```sh
openssl x509 -req -in invalid-sn-cli.csr -CA valid-ca.crt -CAkey valid-ca.key -set_serial 1234 \
 -days 365 -outform PEM -out invalid-sn-cli.crt

# 실행 결과
Signature ok
subject=/C=KR/L=Seoul/O=KFTC/OU=SerialNumber 987654321/CN=mtls.kftc.io/emailAddress=dy.ryu@kftc.or.kr
Getting CA Private Key
```

현재 디렉토리에 **CA는 정상이나 SerialNumber가 비정상**인 `invalid-sn-cli.crt` 파일이 생성된다.

### CA가 다른 인증서

**유효하지 않은 CA 인증서**(`invalid-ca.crt`, `invalid-ca.key`)로 정상 인증서의 CSR 파일(`valid-cli.csr`)을 다시 서명한다.
```sh
openssl x509 -req -in invalid-ca-cli.csr -CA invalid-ca.crt -CAkey invalid-ca.key -set_serial 1234 \
 -days 365 -outform PEM -out invalid-ca-cli.crt

# 실행 결과
Signature ok
subject=/C=KR/L=Seoul/O=KFTC/OU=SerialNumber 123456789/CN=mtls.kftc.io/emailAddress=dy.ryu@kftc.or.kr
Getting CA Private Key
```

현재 디렉토리에 **SerialNumber는 정상이나 CA가 비정상**인 `invalid-ca-cli.crt` 파일이 생성된다.

---

## 테스트용 웹서버 설정
Ubuntu 18.04, AWS Lightsail

- [Apache (TBA)](./apache/README.md)
- [Nginx (TBA)](./nginx/README.md)

---

## mTLS 테스트
- TBA

---

## 참고
- [Self-signed CA 인증서 생성](https://www.gluu.org/docs/gluu-server/4.0/fe/mtls/#self-signed-ssl-certs)
- [클라이언트 인증서 발급](https://www.gluu.org/docs/gluu-server/4.0/fe/mtls/#client-side-mutual-authentication-setup)
- [DigiCert Root 인증서 다운로드](https://www.digicert.com/kb/digicert-root-certificates.htm)
- [smallstep nginx mTLS 설정](https://smallstep.com/hello-mtls/doc/combined/nginx/nginx-proxy)
- Apache SSL module doc
- Nginx SSL module doc
