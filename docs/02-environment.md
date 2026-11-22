# 사전 준비사항

이 튜토리얼은 **서버 인증서와 개인키가 설정되어 HTTPS 요청을 처리할 수 있는 웹서버**가 준비된 환경을 전제로 합니다. <small>(웹서버 구축과 HTTPS 설정 등의 절차는 다루지 않습니다.)</small>

준비된 웹서버가 없다면 아래 [**Docker로 HTTPS 웹서버 실행**](#docker로-https-웹서버-실행)의 예시 파일을 사용합니다. <small>(이 경우에도 서버 인증서와 개인키는 미리 준비해야 합니다.)</small>


## 🧰 필요한 환경

| 준비물 | 용도 |
| --- | --- |
| HTTPS가 적용된 Nginx 또는 Apache HTTP Server 2.4 | 정보제공자 역할의 웹서버 |
| 서버 인증서와 개인키 | 서버의 HTTPS 인증 |
| OpenSSL 1.1.1 이상 | 다음 단계에서 테스트 인증서 생성 |
| cURL | HTTPS 요청과 이후 인증 결과 확인 |
| Docker<small>(선택 사항)</small> | 웹서버가 없을 때 사용 |

> Nginx, Apache 외의 웹서버<small>(예. WebToB)</small>를 사용하는 경우, 해당 웹서버의 가이드를 확인해주세요.


## 🌐 HTTPS가 적용된 설정 예시

다음은 **mTLS 설정<small>(클라이언트 인증)</small>을 추가하기 전**의 설정 참고입니다.

<div class="tls-tabs" data-tabs="prepare-https">
<div class="tls-tablist" role="tablist" aria-label="웹서버 선택">
<button type="button" id="prepare-https-nginx-tab" role="tab" aria-selected="true" aria-controls="prepare-https-nginx-panel" tabindex="0">Nginx</button>
<button type="button" id="prepare-https-apache-tab" role="tab" aria-selected="false" aria-controls="prepare-https-apache-panel" tabindex="-1">Apache</button>
</div>
<section class="tls-tabpanel" id="prepare-https-nginx-panel" role="tabpanel" aria-labelledby="prepare-https-nginx-tab" tabindex="0">

Nginx의 `http {}` 내부에 포함되는 서버 설정입니다.

```nginx
server {
    listen 443 ssl;
    server_name {서버도메인};

    ssl_certificate "{인증서경로}";
    ssl_certificate_key "{개인키경로}";

    root "{정적파일디렉터리}";
}
```

</section>
<section class="tls-tabpanel" id="prepare-https-apache-panel" role="tabpanel" aria-labelledby="prepare-https-apache-tab" tabindex="0" hidden>

Apache의 `mod_ssl`과 `mod_authz_core`가 활성화된 상태를 전제로 합니다.

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
</VirtualHost>
```

</section>
</div>


## 📄 테스트 정적 파일 만들기

인증서 상호 검증이 완료되어 접근이 허용되었을 때 웹서버가 반환할 `mtls-test.txt`를 만듭니다. <small>(웹서버가 제공할 정적 파일 디렉터리에 해당 파일을 만듭니다.)</small>

```bash
mkdir -p "{정적파일디렉터리}"
printf 'mTLS OK\n' > "{정적파일디렉터리}/mtls-test.txt"
```


## 🐳 Docker로 HTTPS 웹서버 실행

[Docker](https://docs.docker.com/get-started/get-docker/)가 실행 중이고, **서버 인증서·개인키·테스트 정적 파일**이 호스트에 준비되어 있어야 합니다. [Nginx 공식 이미지](https://hub.docker.com/_/nginx) 또는 [Apache 공식 이미지](https://hub.docker.com/_/httpd) 중 하나를 선택합니다.

1. 아래 예시 설정 파일을 원하는 위치에 저장합니다.
2. 파일 안의 도메인과 경로를 본인 환경에 맞게 바꿉니다. **이때 경로는 컨테이너 내부에서 읽을 경로**입니다. 컨테이너 내부 HTTPS 포트는 443으로 유지합니다.
3. 실행 명령의 호스트 경로와 컨테이너 경로를 대응시킵니다. 정적 파일은 앞에서 만든 `mtls-test.txt`가 들어 있는 호스트 디렉터리를 연결합니다.

> 호스트와 컨테이너 경로는 모두 절대 경로로 지정합니다.

<div class="tls-tabs" data-tabs="prepare-docker">
<div class="tls-tablist" role="tablist" aria-label="웹서버 선택">
<button type="button" id="prepare-docker-nginx-tab" role="tab" aria-selected="true" aria-controls="prepare-docker-nginx-panel" tabindex="0">Nginx</button>
<button type="button" id="prepare-docker-apache-tab" role="tab" aria-selected="false" aria-controls="prepare-docker-apache-panel" tabindex="-1">Apache</button>
</div>
<section class="tls-tabpanel" id="prepare-docker-nginx-panel" role="tabpanel" aria-labelledby="prepare-docker-nginx-tab" tabindex="0">

<a href="../examples/nginx-https.conf" download="nginx-https.conf">📥 Nginx HTTPS 설정 예시 다운로드</a>

```bash
docker run -d --name mtls-demo-nginx \
  -p "127.0.0.1:{호스트HTTPS포트}:443" \
  --mount "type=bind,src={호스트설정파일경로},dst=/etc/nginx/conf.d/default.conf,readonly" \
  --mount "type=bind,src={호스트인증서경로},dst={인증서경로},readonly" \
  --mount "type=bind,src={호스트개인키경로},dst={개인키경로},readonly" \
  --mount "type=bind,src={호스트정적파일디렉터리},dst={정적파일디렉터리},readonly" \
  nginx:stable
```

</section>
<section class="tls-tabpanel" id="prepare-docker-apache-panel" role="tabpanel" aria-labelledby="prepare-docker-apache-tab" tabindex="0" hidden>

<a href="../examples/apache-https.conf" download="apache-https.conf">📥 Apache HTTPS 설정 예시 다운로드</a>

```bash
docker run -d --name mtls-demo-apache \
  -p "127.0.0.1:{호스트HTTPS포트}:443" \
  --mount "type=bind,src={호스트설정파일경로},dst=/usr/local/apache2/conf/extra/https.conf,readonly" \
  --mount "type=bind,src={호스트인증서경로},dst={인증서경로},readonly" \
  --mount "type=bind,src={호스트개인키경로},dst={개인키경로},readonly" \
  --mount "type=bind,src={호스트정적파일디렉터리},dst={정적파일디렉터리},readonly" \
  httpd:2.4 httpd-foreground \
  -C 'LoadModule ssl_module modules/mod_ssl.so' \
  -C 'LoadModule socache_shmcb_module modules/mod_socache_shmcb.so' \
  -c 'Include /usr/local/apache2/conf/extra/https.conf'
```

</section>
</div>


## ✅ 웹서버 환경설정 확인

`cURL`로 **HTTP 200**과 본문 `mTLS OK`가 나오는지 확인합니다.

```bash
curl -i "https://{서버도메인}/mtls-test.txt"
```

### Docker로 로컬에서 웹서버를 실행한 경우

```bash
curl --resolve "{서버도메인}:{호스트HTTPS포트}:127.0.0.1" \
  -i "https://{서버도메인}:{호스트HTTPS포트}/mtls-test.txt"
```

> `--resolve`는 인증서를 검증할 도메인은 유지하면서, 실제 연결은 로컬 Docker 서버의 `127.0.0.1`로 보내기 위해 사용합니다.
>
> self-signed 등 별도 신뢰 설정이 필요한 서버 인증서라면 `--cacert "{서버인증서를검증할CA인증서경로}"`를 추가합니다. self-signed 서버 인증서 자체를 신뢰하는 경우에는 그 인증서 파일을 지정합니다.
