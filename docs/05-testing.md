# cURL을 이용한 검증

웹서버에 mTLS 설정이 잘 적용되었는지 테스트합니다.

터미널에서 작업 디렉터리로 이동합니다. 작업 디렉터리는 [3. 테스트 인증서 생성](../certificates/)에서 만든 경로입니다.

```bash
cd "{작업디렉터리}"
```

> **웹서버를 Docker로 로컬에서 실행한 경우**
>
> 아래 네 가지 `cURL` 명령 실행 시, `{서버도메인}`을 `{서버도메인}:{호스트HTTPS포트}`로 설정합니다<small>([2. 사전 준비사항](../environment/)에서 사용한 도메인과 포트 사용)</small>. 또한, `--resolve "{서버도메인}:{호스트HTTPS포트}:127.0.0.1"` 옵션을 추가합니다. <small>(아래 예시 참고)</small>
>
> ```bash
> # 서버 도메인이 example.com 이고, 호스트 HTTPS 포트가 8443일 때
> curl --resolve "example.com:8443:127.0.0.1" \
>   -i "https://example.com:8443/mtls-test.txt"
> ```

> **서버 인증서 검증<small>(일반적인 HTTPS)</small>에 별도 신뢰 설정이 필요한 경우**
>
> 아래 네 가지 `cURL` 명령 실행 시, `--cacert "{서버인증서를검증할CA인증서경로}"` 옵션을 추가합니다. self-signed 서버 인증서라면 그 인증서 파일을, 테스트 CA가 발급한 서버 인증서라면 해당 CA 인증서 파일을 지정합니다. <small>(아래 예시 참고)</small>
>
> ```bash
> # 서버 인증서 검증용 CA 인증서 경로가 certs/server-ca.crt 이고, 서버 도메인이 example.com일 때
> curl --cacert "certs/server-ca.crt" \
>   -i "https://example.com/mtls-test.txt"
> ```


## 1. 신뢰하는 CA + 기관 식별값 일치

```bash
curl --cert certs/valid-cli.crt --key certs/valid-cli.key \
  -i "https://{서버도메인}/mtls-test.txt"
```

HTTP **200**과 본문 `mTLS OK`를 확인합니다.


## 2. 신뢰하는 CA + 기관 식별값 불일치

```bash
curl --cert certs/invalid-sn-cli.crt --key certs/invalid-sn-cli.key \
  -i "https://{서버도메인}/mtls-test.txt"
```

HTTP **403** 오류가 발생합니다. 인증서 검증에는 성공했지만 Subject DN의 기관 식별값이 허용값과 일치하지 않습니다.


## 3. 신뢰하지 않는 CA + 기관 식별값 일치

```bash
curl --cert certs/invalid-ca-cli.crt --key certs/invalid-ca-cli.key \
  -i "https://{서버도메인}/mtls-test.txt"
```

신뢰하지 않는 CA가 발급한 인증서이므로 오류가 발생합니다. `Nginx`의 경우 HTTP **400** 오류가 발생하고, `Apache`의 경우 TLS 연결 오류<small>(HTTP 응답 없음)</small>가 발생합니다.


## 4. 클라이언트 인증서 없음

```bash
curl -i "https://{서버도메인}/mtls-test.txt"
```

클라이언트 인증서가 없어 오류가 발생합니다. [**3. 신뢰하지 않는 CA + 기관 식별값 일치**](#3-신뢰하지-않는-ca-기관-식별값-일치)와 동일한 오류가 발생합니다.

> cf) mTLS 설정 없이 일반 HTTPS만 설정했을 때는 성공하지만, mTLS 설정을 추가한 뒤에는 실패합니다.


## ✅ 검증결과 정리

| 케이스 | Nginx | Apache |
| --- | --- | --- |
| 신뢰하는 CA + 기관 식별값 일치 | HTTP 200 | HTTP 200 |
| 신뢰하는 CA + 기관 식별값 불일치 | HTTP 403 | HTTP 403 |
| 신뢰하지 않는 CA + 기관 식별값 일치 | HTTP 400 | TLS 연결 오류 |
| 클라이언트 인증서 없음 | HTTP 400 | TLS 연결 오류 |
