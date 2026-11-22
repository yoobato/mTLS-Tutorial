# 웹서버 설정

웹서버에 **클라이언트 인증서 검증과 기관 식별값 검사를 추가**합니다.


## 🔐 신뢰하는 CA 인증서 준비

[3. 테스트 인증서 생성](../certificates/)에서 생성한 **`valid-ca.crt`를 신뢰하는 CA로 설정**합니다. `invalid-ca.crt`는 신뢰하는 CA 목록에 넣지 않습니다. 또한, CA 개인키와 클라이언트 개인키는 웹서버에 배치하지 않습니다.


## ⚙️ mTLS 설정 추가

이 튜토리얼에서는 **인증서 검증에 성공하고, Subject DN의 `serialNumber`가 `123456789`인 요청만 허용**합니다.

정규식은 **Subject DN에서 `serialNumber`의 위치와 관계없이** 허용한 기관 식별값을 검사합니다. 속성의 구분자를 기준으로 검사하므로, 다른 속성 값 안에 들어 있는 같은 문자열은 허용 조건으로 사용하지 않습니다.

<div class="tls-tabs" data-tabs="mtls-config-1">
<div class="tls-tablist" role="tablist" aria-label="웹서버 선택">
<button type="button" id="mtls-config-1-nginx-tab" role="tab" aria-selected="true" aria-controls="mtls-config-1-nginx-panel" tabindex="0">Nginx</button>
<button type="button" id="mtls-config-1-apache-tab" role="tab" aria-selected="false" aria-controls="mtls-config-1-apache-panel" tabindex="-1">Apache</button>
</div>
<section class="tls-tabpanel" id="mtls-config-1-nginx-panel" role="tabpanel" aria-labelledby="mtls-config-1-nginx-tab" tabindex="0">

[2. 사전 준비사항](../environment/)의 HTTPS 설정에 mTLS를 추가한 예시입니다.

이 설정은 `nginx.conf`의 **`http {}` 내부에 포함**합니다.

```nginx
##### [START] mTLS 설정 추가: 기관 식별값 검사 #####
# cf) $ssl_client_s_dn: 클라이언트 인증서의 Subject DN
map $ssl_client_s_dn $mtls_allowed {
    # 기관 식별값 불일치 (기본값 = 0)
    default 0;

    # 기관 식별값 일치 = 1
    "~^(?:[A-Za-z0-9.-]+=(?:\\\\.|[^,+\\\\])*[,+])*serialNumber=123456789(?:[,+]|$)" 1;
}
##### [END] mTLS 설정 추가 #####

server {
    listen 443 ssl;
    server_name {서버도메인};

    ssl_certificate "{인증서경로}";
    ssl_certificate_key "{개인키경로}";

    root "{정적파일디렉터리}";

    ##### [START] mTLS 설정 추가 클라이언트 인증과 접근 제어 #####
    ssl_client_certificate "{클라이언트CA인증서경로}";
    # 클라이언트 인증서 체인 검증 (신뢰하는 CA)
    ssl_verify_client on;

    # 기관 식별값 불일치
    if ($mtls_allowed = 0) {
        return 403;
    }
    ##### [END] mTLS 설정 추가 #####
}
```

> `$ssl_client_serial`은 인증서 자체의 일련번호입니다. 이 실습에서는 Subject DN을 제공하는 `$ssl_client_s_dn`을 사용합니다.

직접 설치한 Nginx는 설정을 검사한 뒤 재적용합니다. Docker를 사용한다면 아래 [**Docker에서 CA 인증서 연결**](#docker에서-ca-인증서-연결)을 따릅니다.

```bash
sudo nginx -t
sudo nginx -s reload
```

</section>
<section class="tls-tabpanel" id="mtls-config-1-apache-panel" role="tabpanel" aria-labelledby="mtls-config-1-apache-tab" tabindex="0" hidden>

[2. 사전 준비사항](../environment/)의 HTTPS 설정에 mTLS를 추가한 예시입니다.

```apacheconf
Listen 443

<VirtualHost *:443>
    ServerName {서버도메인}
    SSLEngine on
    SSLCertificateFile "{인증서경로}"
    SSLCertificateKeyFile "{개인키경로}"

    DocumentRoot "{정적파일디렉터리}"
    <Directory "{정적파일디렉터리}">
        Require all granted
    </Directory>

    ##### [START] mTLS 설정 추가 클라이언트 인증과 기관 식별값 검사 #####
    SSLCACertificateFile "{클라이언트CA인증서경로}"
    # 클라이언트 인증서 체인 검증 (신뢰하는 CA)
    SSLVerifyClient require

    <Location "/">
        # 기관 식별값이 일치하는 경우에만 허용
        Require expr "%{SSL_CLIENT_S_DN} =~ m#^(?:[A-Za-z0-9.-]+=(?:\\\\.|[^,+\\\\])*[,+])*serialNumber=123456789(?:[,+]|$)#"
    </Location>
    ##### [END] mTLS 설정 추가 #####
</VirtualHost>
```

직접 설치한 Apache는 설정을 검사한 뒤 재적용합니다. Docker를 사용한다면 아래 [**Docker에서 CA 인증서 연결**](#docker에서-ca-인증서-연결)을 따릅니다.

```bash
sudo apachectl configtest
sudo apachectl graceful
```

> 배포판에 따라 명령 이름은 `apache2ctl`일 수 있습니다.

</section>
</div>


## 🐳 Docker에서 CA 인증서 연결

사전 준비사항에서 다운로드한 설정 파일을 위 예시처럼 수정하고, **`docker run` 명령의 이미지 이름 앞에** 다음 마운트 옵션을 추가합니다.

```bash
--mount "type=bind,src={호스트클라이언트CA인증서경로},dst={클라이언트CA인증서경로},readonly"
```

- `{호스트클라이언트CA인증서경로}`: 호스트에 있는 `valid-ca.crt` 파일의 절대 경로
- `{클라이언트CA인증서경로}`: 웹서버 설정에 지정한 컨테이너 내부의 동일한 절대 경로

실행 중인 컨테이너에는 마운트를 추가할 수 없으므로, 기존 실습 컨테이너를 제거한 뒤 수정한 `docker run` 명령으로 다시 생성합니다.

```bash
docker rm -f "{컨테이너이름}"
```

서버 인증서·개인키·정적 파일의 기존 마운트는 유지합니다.

> **실제 오픈뱅킹 연동 시에는**
>
> 테스트 CA<small>(valid-ca.crt)</small>와 테스트 기관 식별값<small>(123456789)</small> 대신에 **오픈뱅킹 연동 안내에 명시된 CA 인증서와 기관 식별값**을 사용해야 합니다. 또한, 오류 응답<small>(위 예시에서 HTTP 403)</small>의 경우에도 오픈뱅킹에서 안내하는 규격을 따라야 합니다.
