# 참고문서

## 📚 mTLS와 인증서

- [TLS 1.3 — RFC 8446](https://www.rfc-editor.org/rfc/rfc8446.html)
- [X.509 인증서와 인증 경로 검증 — RFC 5280](https://www.rfc-editor.org/rfc/rfc5280.html)
- [Subject DN 문자열 표기 — RFC 2253](https://www.rfc-editor.org/rfc/rfc2253.html)
- [OpenSSL req: CSR 생성과 Subject 지정](https://docs.openssl.org/3.5/man1/openssl-req/)
- [OpenSSL x509: 인증서 서명과 확인](https://docs.openssl.org/3.5/man1/openssl-x509/)

## 웹서버와 cURL

- [Nginx SSL 모듈](https://nginx.org/en/docs/http/ngx_http_ssl_module.html): 클라이언트 신뢰 CA, 인증 요구, Subject DN 변수
- [Nginx map 모듈](https://nginx.org/en/docs/http/ngx_http_map_module.html)
- [Apache mod_ssl](https://httpd.apache.org/docs/2.4/mod/mod_ssl.html): 신뢰 CA와 인증서 검증
- [Apache Require expr](https://httpd.apache.org/docs/2.4/mod/mod_authz_core.html#reqexpr)
- [Apache 표현식](https://httpd.apache.org/docs/2.4/expr.html)
- [cURL 명령어 안내](https://curl.se/docs/manpage.html)

## 서버 HTTPS 인증서

- [Let’s Encrypt 인증 방식](https://letsencrypt.org/docs/challenge-types/)
- [Certbot 설치 안내](https://certbot.eff.org/instructions)
- [DigiCert 루트·중간 CA 인증서](https://www.digicert.com/kb/digicert-root-certificates.htm)

## 오픈뱅킹

- [금융결제원 오픈뱅킹 소개](https://openapi.kftc.or.kr/service/openBanking)

실제 오픈뱅킹 클라이언트 인증서의 CA와 허용 기관 식별값은 **해당 업무의 최신 연동 안내·인증서 체인**으로 확인합니다. 공개 웹사이트의 HTTPS 서버 인증서 발급자가 같거나 다르다는 이유만으로 발신 mTLS 클라이언트 인증서의 CA를 확정할 수는 없습니다.

이 튜토리얼은 2021년 README를 바탕으로 재정리한 개인 실습 문서입니다. 실제 연동의 오류코드·인증서 갱신·폐지 및 추가 접근 정책은 오픈뱅킹 연동 규격을 따릅니다. 영문 문서는 추후 추가할 예정입니다.

라이선스는 기존 저장소의 [AGPL-3.0](https://github.com/yoobato/mTLS-Tutorial/blob/main/LICENSE)을 유지합니다.
