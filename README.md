# 정보제공자를 위한 mTLS 튜토리얼

설치된 Nginx·Apache에서 HTTPS와 클라이언트 인증을 설정하고, cURL로 접근 허용·거절을 확인하는 한국어 문서 초안입니다. 웹서버가 정적 테스트 파일을 직접 제공합니다.

## 문서

1. [mTLS 개요](docs/01-overview.md)
2. [실습 안내](docs/02-environment.md): 준비 조건, 서버 HTTPS와 Let’s Encrypt
3. [테스트 인증서 생성](docs/03-certificates.md)
4. [웹서버 설정](docs/04-webservers.md): Nginx·Apache, 신뢰 CA와 Subject 검사
5. [cURL을 이용한 검증](docs/05-testing.md)
6. [참고문서](docs/06-references.md)

흑백 본문과 파란 링크를 사용하는 정적 문서 사이트입니다. 영문은 추후 추가할 예정입니다.

## 실습 흐름

1. Nginx 또는 Apache가 설치된 환경에서 일반 HTTPS를 먼저 준비합니다. 기존 서버 인증서를 사용하거나 Let’s Encrypt로 발급합니다.
2. `bash scripts/generate-certs.sh`로 테스트 CA 두 개와 클라이언트 인증서 세 개를 생성합니다.
3. `valid-ca.crt`만 웹서버에 복사하고, [웹서버 설정](docs/04-webservers.md)을 적용합니다.
4. cURL 또는 아래 스크립트로 검증합니다.

```bash
bash scripts/test-mtls.sh https://YOUR-HOST/mtls-test.txt
```

| 요청 | 기대 결과 |
| --- | --- |
| 신뢰하는 CA + 허용한 Subject serialNumber | HTTP 200, `mTLS OK` |
| 신뢰하는 CA + 다른 Subject serialNumber | HTTP 403 |
| 신뢰하지 않는 CA + 허용한 Subject serialNumber | 인증서 검증 실패 |
| 인증서 없음 | 인증서 검증 실패 |

실제 오픈뱅킹에서는 테스트 CA 대신 승인된 실제 클라이언트 CA 체인을 사용하고, 기관 식별값도 실제 허용값으로 바꿉니다. 공인 CA라도 클라이언트 인증용 신뢰 설정은 필요합니다. Subject 예시는 기존 README의 KFTC·도메인·이메일을 유지하며 실제 운영 인증서를 뜻하지 않습니다.

## 문서 사이트 실행

Node.js 22 이상, pnpm 11.25.0을 사용합니다. 프로젝트의 `.nvmrc`는 Node 22를 지정합니다. 이것은 문서 사이트를 위한 도구이며 mTLS 웹서버 실습의 필수 도구는 아닙니다.

```bash
nvm install
nvm use
pnpm install --frozen-lockfile
pnpm start
```

새 터미널에서 작업할 때도 저장소 루트에서 `nvm use`를 먼저 실행합니다. `node -v`가 `v22` 이상인지 확인하세요. pnpm 11은 Node 20을 지원하지 않습니다.

`http://127.0.0.1:8767`에서 확인합니다. 콘텐츠는 **`docs/*.md`를 직접 편집**합니다. 제목·본문·표·코드 블록은 일반 Markdown이며, 접는 예제는 HTML `<details>`를 사용합니다. 별도 프레임워크 문법이나 생성된 HTML을 수정할 필요가 없습니다. Mermaid 코드 블록도 지원합니다.

`pnpm run build`가 Markdown을 HTML로 변환하여 `site-dist/`에 저장합니다. 이 폴더는 생성 결과이므로 직접 편집하지 않습니다. 현재 로컬 미리보기가 실행 중이라면 `pnpm run build`만 실행한 뒤 브라우저를 새로고침하면 반영됩니다.

```bash
pnpm run build
pnpm serve
```

정적 출력은 `site-dist/`입니다. Pages에는 이 문서만 배포합니다. **`main` 브랜치에 커밋하면 GitHub Actions가 Markdown을 HTML로 빌드하고 GitHub Pages에 자동 배포합니다.** GitHub 웹사이트에서 `docs/`의 MD 파일을 편집해도 같은 방식으로 반영됩니다. 필요하면 Actions의 배포 워크플로를 수동 실행할 수도 있습니다.

## 검증

정적 파일 제공 방식으로 Nginx 1.28.3과 Apache 2.4.67에서 각 5개, 총 10개 검사를 확인했습니다. 정상·다른 번호·다른 CA·미제출 외에, 다른 Subject 속성 안에 허용 번호 문자열을 넣은 경우의 거절도 확인했습니다. 이 로컬 Apache 검증은 TLS 1.2를 사용했습니다. 실제 도메인의 Let’s Encrypt 발급·갱신은 검증하지 않았습니다.

생성한 개인키·인증서와 테스트 산출물은 Git에서 제외합니다. 기존 저장소의 AGPL-3.0 라이선스를 유지합니다.
