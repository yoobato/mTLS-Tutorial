# Apache mTLS 설정

설치된 Apache의 HTTPS 가상호스트를 수정합니다. [실습 안내](../docs/02-environment.md)와 [웹서버 설정](../docs/04-webservers.md)을 참고하세요.

`mtls.conf`에서 도메인, 서버 인증서·키, 신뢰 CA, 정적 파일 경로를 바꿉니다. Apache가 직접 정적 파일을 제공하며 `Require expr`로 Subject의 `serialNumber`를 검사합니다.
