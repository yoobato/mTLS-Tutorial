# Testing with cURL

Check whether the web server's mTLS configuration works as expected.

In your terminal, change to the working directory created in [3. Test Certificates](../certificates/).

```bash
cd "{WORKING_DIRECTORY}"
```

> **If the web server runs locally with Docker**
>
> In each of the four `cURL` commands below, use `{SERVER_DOMAIN}:{HOST_HTTPS_PORT}` in place of `{SERVER_DOMAIN}` <small>(using the domain and port from [2. Prerequisites](../environment/))</small>. Also add `--resolve "{SERVER_DOMAIN}:{HOST_HTTPS_PORT}:127.0.0.1"`. <small>(See the example below.)</small>
>
> ```bash
> # Server domain: example.com; host HTTPS port: 8443
> curl --resolve "example.com:8443:127.0.0.1" \
>   -i "https://example.com:8443/mtls-test.txt"
> ```

> **If server certificate validation <small>(regular HTTPS)</small> needs an explicit trust setting**
>
> Add `--cacert "{SERVER_CA_CERTIFICATE_PATH}"` to each of the four `cURL` commands below. For a self-signed server certificate, specify that certificate file. For a server certificate issued by a test CA, specify the CA certificate file. <small>(See the example below.)</small>
>
> ```bash
> # Server CA certificate: certs/server-ca.crt; server domain: example.com
> curl --cacert "certs/server-ca.crt" \
>   -i "https://example.com/mtls-test.txt"
> ```

## 1. Trusted CA + matching institution identifier

```bash
curl --cert certs/valid-cli.crt --key certs/valid-cli.key \
  -i "https://{SERVER_DOMAIN}/mtls-test.txt"
```

Expect HTTP **200** and the response body `mTLS OK`.

## 2. Trusted CA + mismatched institution identifier

```bash
curl --cert certs/invalid-sn-cli.crt --key certs/invalid-sn-cli.key \
  -i "https://{SERVER_DOMAIN}/mtls-test.txt"
```

Expect HTTP **403**. Certificate validation succeeds, but the institution identifier in the Subject DN does not match the allowed value.

## 3. Untrusted CA + matching institution identifier

```bash
curl --cert certs/invalid-ca-cli.crt --key certs/invalid-ca-cli.key \
  -i "https://{SERVER_DOMAIN}/mtls-test.txt"
```

The request fails because the certificate was issued by an untrusted CA. `Nginx` returns HTTP **400**. `Apache` rejects the TLS connection <small>(no HTTP response)</small>.

## 4. No client certificate

```bash
curl -i "https://{SERVER_DOMAIN}/mtls-test.txt"
```

The request fails because no client certificate is provided. The error is the same as in [**3. Untrusted CA + matching institution identifier**](#3-untrusted-ca-matching-institution-identifier).

> This request succeeds with regular HTTPS before mTLS is configured, but fails after the mTLS settings are added.

## ✅ Results

| Case | Nginx | Apache |
| --- | --- | --- |
| Trusted CA + matching institution identifier | HTTP 200 | HTTP 200 |
| Trusted CA + mismatched institution identifier | HTTP 403 | HTTP 403 |
| Untrusted CA + matching institution identifier | HTTP 400 | TLS connection error |
| No client certificate | HTTP 400 | TLS connection error |
