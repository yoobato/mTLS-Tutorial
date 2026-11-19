# 실습 안내

## 🧰 준비 조건

- Nginx 또는 Apache HTTP Server 2.4가 설치되어 있고 설정 파일을 수정·재적용할 수 있는 환경
- OpenSSL 1.1.1 이상, cURL, Bash
- 서버 인증서가 설정된 HTTPS 주소
- 테스트 파일을 읽을 수 있는 웹서버 권한

웹서버의 설치 방식과 무관하게 **실행 중인 웹서버가 읽는 설정·인증서 경로**를 기준으로 적용합니다. 아래는 Linux 경로 예시이며 설치 환경에 따라 바꿉니다.

| 항목 | 예시 |
| --- | --- |
| HTTPS 주소 | `https://api.example.com` — 본인 주소로 교체 |
| 서버 인증서 | `/etc/letsencrypt/live/api.example.com/fullchain.pem` |
| 서버 개인키 | `/etc/letsencrypt/live/api.example.com/privkey.pem` |
| 클라이언트 신뢰 CA | `/etc/mtls-demo/valid-ca.crt` |
| 정적 테스트 파일 | `/var/www/mtls-demo/mtls-test.txt` |

둘 중 한 웹서버만 선택해도 됩니다. 같은 서버에서 두 웹서버를 동시에 확인하려면 별도 포트나 주소를 사용하세요. 기존 443 리스너·가상호스트를 중복 선언하지 않습니다.

## 1. 먼저 일반 HTTPS 구성

이미 HTTPS가 동작한다면 이 단계를 건너뜁니다. 서버 인증서가 없다면 **Let’s Encrypt로 서버 TLS 인증서를 발급하고 HTTPS부터 설정**합니다. 이 단계에서는 아직 클라이언트 인증서를 요구하지 않습니다.

Let’s Encrypt의 HTTP-01 검증을 사용하는 예시입니다. 본인 소유 도메인의 DNS가 서버를 가리켜야 하며, 외부에서 80번 포트의 인증 경로에 접근할 수 있어야 합니다. Certbot은 [공식 설치 안내](https://certbot.eff.org/instructions)에 따라 준비합니다.

```bash
sudo mkdir -p /var/www/acme/.well-known/acme-challenge
```

<details open>
<summary>Nginx</summary>

HTTP 가상호스트에 인증 경로를 추가합니다.

```nginx
server {
    listen 80;
    server_name api.example.com;
    location /.well-known/acme-challenge/ {
        root /var/www/acme;
    }
}
```

</details>

<details>
<summary>Apache</summary>

HTTP 가상호스트에 인증 경로를 추가합니다. 해당 주소의 80번 리스너는 이미 활성화되어 있어야 합니다.

```apacheconf
<VirtualHost *:80>
    ServerName api.example.com
    Alias /.well-known/acme-challenge/ /var/www/acme/.well-known/acme-challenge/
    <Directory /var/www/acme/.well-known/acme-challenge/>
        Require all granted
    </Directory>
</VirtualHost>
```

</details>

설정을 검사·재적용한 뒤 발급합니다.

```bash
sudo certbot certonly --webroot \
  --webroot-path /var/www/acme \
  --domain api.example.com
```

발급된 `fullchain.pem`과 `privkey.pem`을 HTTPS 가상호스트에 설정합니다.

<details open>
<summary>Nginx</summary>

```nginx
server {
    listen 443 ssl;
    server_name api.example.com;
    ssl_certificate /etc/letsencrypt/live/api.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.example.com/privkey.pem;
    root /var/www/mtls-demo;
}
```

</details>

<details>
<summary>Apache</summary>

Apache는 `mod_ssl`과 443 리스너를 활성화한 상태에서 사용합니다.

```apacheconf
<VirtualHost *:443>
    ServerName api.example.com
    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/api.example.com/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/api.example.com/privkey.pem
    DocumentRoot /var/www/mtls-demo
    <Directory /var/www/mtls-demo>
        Require all granted
    </Directory>
</VirtualHost>
```

</details>

## 2. 테스트 파일과 HTTPS 확인

```bash
sudo mkdir -p /var/www/mtls-demo
printf 'mTLS OK\n' | sudo tee /var/www/mtls-demo/mtls-test.txt
```

설정을 검사·재적용한 뒤, 클라이언트 인증서 없이 HTTPS가 동작하는지 먼저 확인합니다.

```bash
curl -i https://api.example.com/mtls-test.txt
```

이 단계에서는 HTTP 200과 `mTLS OK`가 나와야 합니다. 이후 **웹서버 설정** 페이지에서 mTLS를 추가하면 인증서 없는 요청은 거절됩니다.

## 도메인 없이 로컬에서 실습할 경우

기존 로컬 HTTPS 인증서를 사용하거나 `localhost` SAN이 포함된 테스트용 서버 인증서를 따로 준비할 수 있습니다. 이 경우 cURL에 `--cacert /path/to/server-ca.crt`를 추가합니다. 이 옵션은 **서버 인증용 신뢰 CA**이며, 웹서버가 클라이언트 인증에 사용하는 CA 설정과 별개입니다. `-k`로 서버 검증을 생략하지 않습니다.

## 갱신과 운영 설정

Let’s Encrypt 인증서는 갱신 후 웹서버가 새 파일을 읽도록 reload 절차를 연결합니다. `sudo certbot renew --dry-run`으로 갱신 동작을 점검할 수 있습니다. HTTP-01 인증 경로는 클라이언트 인증을 요구하는 HTTPS 테스트 경로와 별도로 유지합니다.

이 문서의 서버 HTTPS 설정은 **클라이언트가 정보제공자 서버를 신뢰하기 위한 단계**입니다. 실제 오픈뱅킹의 요청자 인증은 이후 페이지에서 실제 오픈뱅킹 CA 체인을 신뢰하도록 별도로 설정합니다.
