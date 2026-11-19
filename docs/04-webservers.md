# 웹서버 설정

**일반 HTTPS가 동작하는 가상호스트에 mTLS를 추가**합니다. 서버 인증서 경로는 실습 안내에서 준비한 값을 유지하고, 클라이언트 CA 검증과 Subject 식별값 검사만 추가합니다.

## 🔐 신뢰할 CA 설정: DigiCert 인증서라면?

`ssl_client_certificate`는 **서버가 클라이언트 인증서를 검증할 때 신뢰할 CA 인증서 묶음**입니다. 이 파일을 클라이언트가 직접 생성해야 한다는 뜻은 아닙니다. 이번에는 사설 테스트 CA를 만들었으므로 그 인증서를 넣습니다.

실제 클라이언트 인증서가 DigiCert 계열 CA에서 발급됐다면, **해당 인증서 체인에 대응하고 오픈뱅킹에서 허용한 CA 인증서**를 설정합니다. DigiCert라는 회사 이름만 보고 임의의 루트 인증서를 고르지 않습니다. 클라이언트가 필요한 중간 인증서를 함께 제시하는지, 검증 체인이 신뢰 루트까지 이어지는지도 확인합니다.

**공인 CA라고 해서 Nginx·Apache가 시스템 신뢰 목록을 자동으로 사용하여 클라이언트를 인증해 주지는 않습니다.** 클라이언트 인증용 신뢰 설정과 인증 요구 설정은 별도로 필요합니다. Nginx에서는 `ssl_trusted_certificate`로 신뢰 CA를 지정하는 방법도 있지만, 이 예제는 허용 CA 목록도 클라이언트에 알리는 `ssl_client_certificate`를 사용합니다.

| 설정 목적 | Nginx | Apache |
| --- | --- | --- |
| 서버 자신의 HTTPS 인증서 | `ssl_certificate` | `SSLCertificateFile` |
| 클라이언트 인증용 신뢰 CA | `ssl_client_certificate` | `SSLCACertificateFile` |
| 클라이언트 인증서 필수 | `ssl_verify_client on` | `SSLVerifyClient require` |

## 설정 파일

`api.example.com`, 서버 인증서·키 경로, CA 경로, 정적 파일 경로를 본인 환경에 맞게 바꿉니다. 예제의 인증서 체인은 짧지만 중간 CA가 있는 실제 연동에서는 `ssl_verify_depth` / `SSLVerifyDepth`도 해당 체인에 맞게 조정합니다.

<details open>
<summary>Nginx</summary>

`map`과 `server`를 포함한 다음 파일은 **`nginx.conf`의 `http {}` 내부에서 include**합니다. `map`을 `server {}` 안에 넣으면 안 됩니다.


```nginx
# Include this file inside nginx.conf's http {} context.
map $ssl_client_s_dn $mtls_subject_serial {
    default "";
    "~^(?:[A-Za-z0-9.]+=(?:\\\\.|[^,\\\\])*,)*serialNumber=([0-9]+)(?:,|$)" $1;
}

map "$ssl_client_verify:$mtls_subject_serial" $mtls_allowed {
    default 0;
    "SUCCESS:123456789" 1;
}

server {
    listen 443 ssl;
    server_name api.example.com;
    ssl_protocols TLSv1.2 TLSv1.3;

    # Server HTTPS identity, obtained before enabling mTLS.
    ssl_certificate /etc/letsencrypt/live/api.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.example.com/privkey.pem;

    # Demo: our self-signed client CA. Production: approved Open Banking CA chain.
    ssl_client_certificate /etc/mtls-demo/valid-ca.crt;
    ssl_verify_client on;
    ssl_verify_depth 2;

    location = /mtls-test.txt {
        if ($mtls_allowed = 0) { return 403; }
        root /var/www/mtls-demo;
    }
    location / { return 404; }
}
```


Nginx는 `$ssl_client_s_dn`의 RFC 2253 형식 Subject에서 `serialNumber`를 추출합니다. 정규식은 앞선 DN 속성 안의 이스케이프된 쉼표를 건너뛰므로 다른 속성 값 속의 같은 문자열을 기관 식별값으로 취급하지 않습니다. 인증서 검증 결과가 `SUCCESS`이고 추출한 값이 `123456789`일 때만 파일을 제공합니다.

`$ssl_client_serial`은 인증서 자체의 일련번호이므로 이 조건에 사용하지 않습니다. 이 예제는 앞에서 생성한 단일 값·숫자형 기관 식별값 형식을 대상으로 합니다. 실제 Subject 표기와 기관 식별값 형식이 다르면 연동 규격에 맞춰 조건을 검토합니다.

```bash
sudo nginx -t
sudo nginx -s reload
```

</details>

<details>
<summary>Apache</summary>

Apache는 `mod_ssl`, `mod_authz_core`를 사용할 수 있어야 합니다. 이미 설정된 443 리스너는 그대로 두고 가상호스트를 수정합니다. 예제 파일에 `Listen 443`을 다시 추가하지 않습니다.


```apacheconf
# HTTPS listener and required modules must already be enabled.
<VirtualHost *:443>
    ServerName api.example.com
    SSLEngine on
    SSLProtocol -all +TLSv1.2 +TLSv1.3
    SSLCertificateFile /etc/letsencrypt/live/api.example.com/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/api.example.com/privkey.pem

    # Demo: our self-signed client CA. Production: approved Open Banking CA chain.
    SSLCACertificateFile /etc/mtls-demo/valid-ca.crt
    SSLVerifyClient require
    SSLVerifyDepth 2

    DocumentRoot /var/www/mtls-demo
    <Directory /var/www/mtls-demo>
        Options -Indexes
        Require all granted
    </Directory>
    <LocationMatch "^/mtls-test[.]txt$">
        <RequireAll>
            Require ssl-verify-client
            Require expr "%{SSL_CLIENT_S_DN} =~ m#^(?:[A-Za-z0-9.]+=(?:\\\\.|[^,\\\\])*,)*serialNumber=123456789(?:,|$)#"
        </RequireAll>
    </LocationMatch>
</VirtualHost>
```


`SSLVerifyClient require`가 CA 검증을 수행하고, `Require expr`가 TLS 연결에서 얻은 Subject의 `serialNumber`를 검사합니다. 요청자가 보낸 HTTP 헤더 값은 검사에 사용하지 않습니다.

```bash
sudo apachectl configtest
sudo apachectl graceful
```

배포판에 따라 명령 이름이 `apache2ctl`일 수 있습니다. 사용하는 서비스 관리 방식에 맞춰 설정을 검사하고 reload합니다.

</details>

정상 인증서는 웹서버가 정적 `mtls-test.txt`를 직접 제공합니다. CA 검증에 실패하면 TLS 처리 단계에서, Subject 식별값이 다르면 접근 제어 단계에서 거절합니다.

> **실제 오픈뱅킹에 적용할 때**
>
> `valid-ca.crt` 경로에는 **실제 오픈뱅킹 클라이언트 인증서의 승인된 CA 체인 파일**을 지정하고, `123456789`도 실제 허용 기관 식별값으로 바꿉니다. CA만 신뢰하도록 설정하고 Subject 검사를 생략하면 의도보다 넓은 범위의 요청자를 허용할 수 있습니다. 실제 API의 오류 응답 규격은 해당 연동 규격을 따릅니다.

