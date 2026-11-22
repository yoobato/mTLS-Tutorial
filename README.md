# mTLS Tutorial

A hands-on guide to mutual TLS authentication with Nginx and Apache. Create test certificate authorities and client certificates, configure client authentication, and verify access with cURL.

**[Read the tutorial →](https://yoobato.github.io/mTLS-Tutorial/)** · [한국어](https://yoobato.github.io/mTLS-Tutorial/ko/)

The website is available in English and Korean. Use **EN / KO** in the header to switch languages on the same page.

## What the tutorial covers

- Mutual TLS authentication and how it differs from regular TLS.
- Prerequisites for an existing HTTPS server, with optional Docker examples.
- Self-signed test CAs and three client certificates.
- Nginx and Apache configuration for certificate validation and a Subject DN `serialNumber` check.
- Four cURL test cases: a matching identifier, a mismatched identifier, an untrusted CA, and no client certificate.
- Official documentation and related MyData API references.

The lab models requests from KFTC to an information provider. Institution identifier validation is an additional access check beyond general mTLS. Production integrations must use the CA certificates, identifiers, and response rules specified by the relevant integration guidance.

The lab commands are provided on the website; cloning this repository is only needed to build or edit the documentation site locally.

## Questions and corrections

[Open a GitHub issue](https://github.com/yoobato/mTLS-Tutorial/issues) to ask a question, report an error, or suggest an improvement. Include the affected page URL and, for a technical issue, the relevant software versions, command, and error output. Remove private keys and other sensitive information before posting.

## Run the documentation site locally

Requirements: Node.js 22 and pnpm 11.25.0. The repository includes an `.nvmrc` for Node.js and a pinned `packageManager` version for pnpm.

```bash
git clone https://github.com/yoobato/mTLS-Tutorial.git
cd mTLS-Tutorial

# If using nvm:
nvm install
nvm use

corepack enable
pnpm install --frozen-lockfile
pnpm start
```

Open **http://127.0.0.1:8767/**. Saving Markdown, template, or style changes rebuilds the site and refreshes the browser automatically. Stop the server with `Ctrl+C`.

To use a different port:

```bash
PORT=8768 pnpm start
```

## Build and preview

```bash
pnpm run build
pnpm serve
```

The build generates static HTML in `site-dist/`. The static preview runs at http://127.0.0.1:8767/ and requires Python 3. Stop any development server using that port before starting the preview.

## Edit the content

| Content | Source |
| --- | --- |
| English documentation | [`docs/en/`](docs/en/) |
| Korean documentation | [`docs/`](docs/) <small>(top-level Markdown files)</small> |
| Page template, styles, and interactions | [`site/`](site/) |
| SEO descriptions and public site URL | [`site/metadata.json`](site/metadata.json) |
| English configuration downloads | [`site/examples/en/`](site/examples/en/) |
| Korean configuration downloads | [`site/examples/`](site/examples/) <small>(top-level configuration files)</small> |

Both languages use matching Markdown filenames. Update both versions when changing shared technical instructions. `site-dist/` is generated output and is not edited directly.

English pages are published at the site root and Korean pages under `/ko/`. Previously published `/en/` URLs redirect to the corresponding English pages. For deployment to another URL, update `siteUrl` in `site/metadata.json` before building.

Pushes to `main` build and deploy the site through [GitHub Actions](https://github.com/yoobato/mTLS-Tutorial/actions) and GitHub Pages.

## License

[GNU Affero General Public License v3.0](LICENSE).
