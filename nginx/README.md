# Nginx mTLS 설정

설치된 Nginx의 HTTPS 설정을 수정합니다. [실습 안내](../docs/02-environment.md)와 [웹서버 설정](../docs/04-webservers.md)을 참고하세요.

`default.conf`는 `nginx.conf`의 `http {}` 내부에서 include합니다. 도메인, 서버 인증서·키, 신뢰 CA, 정적 파일 경로를 바꿉니다. `map`으로 Subject의 `serialNumber`를 추출하고 Nginx가 직접 정적 파일을 제공합니다.
