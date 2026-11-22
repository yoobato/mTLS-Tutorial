# 정보제공자를 위한 mTLS 튜토리얼

설치된 Nginx·Apache에서 HTTPS와 클라이언트 인증을 설정하고, cURL로 접근 허용·거절을 확인하는 한국어·영어 문서입니다. 웹서버가 정적 테스트 파일을 직접 제공합니다.

## 문서

1. [mTLS 개요](docs/01-overview.md)
2. [실습 준비사항](docs/02-environment.md): 필요한 도구, 기존 HTTPS 서버 또는 Docker 로컬 환경
3. [테스트 인증서 생성](docs/03-certificates.md)
4. [웹서버 설정](docs/04-webservers.md): Nginx·Apache, 신뢰하는 CA와 기관 식별값 검사
5. [cURL을 이용한 검증](docs/05-testing.md)
6. [참고문서](docs/06-references.md)

[English documentation](docs/en/01-overview.md)

흑백 본문과 파란 링크를 사용하는 정적 문서 사이트입니다. 상단 KO/EN 버튼으로 같은 문서의 한국어·영어 버전을 전환할 수 있습니다. 한국어는 사이트 루트, 영어는 `/en/`에서 제공합니다.

## 실습 흐름

문서의 명령과 설정을 순서대로 직접 작성하며 진행합니다.

1. 이미 HTTPS가 적용된 웹서버를 준비하거나, 사전 준비사항의 Docker 예시로 실행합니다.
2. [테스트 인증서 생성](docs/03-certificates.md)의 OpenSSL 명령으로 CA 두 개와 클라이언트 인증서 세 개를 직접 만듭니다.
3. `valid-ca.crt`를 웹서버에 배치하고, [웹서버 설정](docs/04-webservers.md)의 내용을 본인 환경에 맞게 작성합니다.
4. [cURL을 이용한 검증](docs/05-testing.md)의 네 가지 요청을 직접 실행해 결과를 확인합니다.

실제 오픈뱅킹에서는 승인된 실제 클라이언트 CA 체인과 허용한 기관 식별값을 사용합니다. 문서의 KFTC·CA 이름·기관 식별값은 실습 예시입니다.

## 문서 사이트 실행 — 작성자용

Node.js 22 이상, pnpm 11.25.0을 사용합니다. 프로젝트의 `.nvmrc`는 Node 22를 지정합니다. 이것은 문서 사이트를 위한 도구이며 mTLS 웹서버 실습의 필수 도구는 아닙니다.

```bash
nvm install
nvm use
pnpm install --frozen-lockfile
pnpm start
```

새 터미널에서 작업할 때도 저장소 루트에서 `nvm use`를 먼저 실행합니다. `node -v`가 `v22` 이상인지 확인하세요. pnpm 11은 Node 20을 지원하지 않습니다.

`http://127.0.0.1:8767`에서 확인합니다. 한국어 콘텐츠는 **`docs/*.md`**, 영어 콘텐츠는 **`docs/en/*.md`를 직접 편집**합니다. 두 언어의 같은 파일명을 수정하면 대응하는 페이지에 반영됩니다. 제목·본문·표·코드 블록은 일반 Markdown이며, 접는 예제는 HTML `<details>`를 사용합니다. 별도 프레임워크 문법이나 생성된 HTML을 수정할 필요가 없습니다. Mermaid 코드 블록도 지원합니다.

`pnpm run build`가 Markdown을 HTML로 변환하여 `site-dist/`에 저장합니다. 이 폴더는 생성 결과이므로 직접 편집하지 않습니다.

**로컬에서는 `pnpm start`를 한 번 실행해 두면 됩니다.** `docs/`의 MD 파일이나 `site/`의 디자인 파일을 저장하면 자동으로 다시 빌드하고 브라우저도 새로고침합니다. 빌드가 실패하면 마지막으로 성공한 화면을 유지하며, 오류는 터미널에 표시합니다. 종료는 `Ctrl+C`입니다.

아래 명령은 배포용 정적 빌드를 확인할 때 사용하며 자동 반영은 하지 않습니다.

```bash
pnpm run build
pnpm serve
```

정적 출력은 `site-dist/`입니다. Pages에는 이 문서만 배포합니다. **`main` 브랜치에 커밋하면 GitHub Actions가 Markdown을 HTML로 빌드하고 GitHub Pages에 자동 배포합니다.** GitHub 웹사이트에서 `docs/`의 MD 파일을 편집해도 같은 방식으로 반영됩니다. 필요하면 Actions의 배포 워크플로를 수동 실행할 수도 있습니다.

## 검증

문서에 안내한 Docker 환경에서 Nginx·Apache의 일반 HTTPS 응답과 네 가지 mTLS 요청 결과를 확인했습니다. 실제 도메인의 Let’s Encrypt 발급·갱신은 검증하지 않았습니다.

기존 저장소의 AGPL-3.0 라이선스를 유지합니다.
