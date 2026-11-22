# Prerequisites

This tutorial assumes that **a web server is already configured with a server certificate and private key and can handle HTTPS requests**. <small>(Installing the web server and configuring HTTPS are outside the scope of this tutorial.)</small>

If you do not have a web server ready, use the example files in [**Run an HTTPS web server with Docker**](#run-an-https-web-server-with-docker). <small>(You still need to prepare a server certificate and private key.)</small>

## 🧰 Requirements

| Requirement | Purpose |
| --- | --- |
| Nginx or Apache HTTP Server 2.4 with HTTPS enabled | Web server acting as the information provider |
| Server certificate and private key | Server authentication over HTTPS |
| OpenSSL 1.1.1 or later | Generate test certificates in the next step |
| cURL | Send HTTPS requests and check authentication results |
| Docker <small>(optional)</small> | Run a web server if one is not already available |

> For web servers other than Nginx and Apache <small>(such as WebToB)</small>, consult the documentation for that server.

## 🌐 Example HTTPS configurations

These examples show the configuration **before adding mTLS <small>(client authentication)</small>**.

<div class="tls-tabs" data-tabs="prepare-https">
<div class="tls-tablist" role="tablist" aria-label="Select a web server">
<button type="button" id="prepare-https-nginx-tab" role="tab" aria-selected="true" aria-controls="prepare-https-nginx-panel" tabindex="0">Nginx</button>
<button type="button" id="prepare-https-apache-tab" role="tab" aria-selected="false" aria-controls="prepare-https-apache-panel" tabindex="-1">Apache</button>
</div>
<section class="tls-tabpanel" id="prepare-https-nginx-panel" role="tabpanel" aria-labelledby="prepare-https-nginx-tab" tabindex="0">

This server configuration is included inside the Nginx `http {}` block.

```nginx
server {
    listen 443 ssl;
    server_name {SERVER_DOMAIN};

    ssl_certificate "{SERVER_CERTIFICATE_PATH}";
    ssl_certificate_key "{SERVER_PRIVATE_KEY_PATH}";

    root "{STATIC_FILES_DIRECTORY}";
}
```

</section>
<section class="tls-tabpanel" id="prepare-https-apache-panel" role="tabpanel" aria-labelledby="prepare-https-apache-tab" tabindex="0" hidden>

Apache must have `mod_ssl` and `mod_authz_core` enabled.

```apacheconf
Listen 443

<VirtualHost *:443>
    ServerName {SERVER_DOMAIN}
    SSLEngine on
    SSLCertificateFile "{SERVER_CERTIFICATE_PATH}"
    SSLCertificateKeyFile "{SERVER_PRIVATE_KEY_PATH}"

    DocumentRoot "{STATIC_FILES_DIRECTORY}"
    <Directory "{STATIC_FILES_DIRECTORY}">
        Require all granted
    </Directory>
</VirtualHost>
```

</section>
</div>

## 📄 Create a static test file

Create `mtls-test.txt`, which the web server returns when authentication succeeds and access is allowed. <small>(Place it in the static files directory served by the web server.)</small>

```bash
mkdir -p "{STATIC_FILES_DIRECTORY}"
printf 'mTLS OK\n' > "{STATIC_FILES_DIRECTORY}/mtls-test.txt"
```

## 🐳 Run an HTTPS web server with Docker

[Docker](https://docs.docker.com/get-started/get-docker/) must be running, and the **server certificate, private key, and static test file** must be available on the host. Choose either the [official Nginx image](https://hub.docker.com/_/nginx) or the [official Apache image](https://hub.docker.com/_/httpd).

1. Save one of the example configuration files below to a location of your choice.
2. Replace the domain and paths in the file with values for your environment. **These paths are the paths the container will read internally.** Keep the HTTPS port inside the container set to 443.
3. Match the host paths in the run command to their container paths. Mount the host directory containing the `mtls-test.txt` file created above.

> Use absolute paths for both host and container paths.

<div class="tls-tabs" data-tabs="prepare-docker">
<div class="tls-tablist" role="tablist" aria-label="Select a web server">
<button type="button" id="prepare-docker-nginx-tab" role="tab" aria-selected="true" aria-controls="prepare-docker-nginx-panel" tabindex="0">Nginx</button>
<button type="button" id="prepare-docker-apache-tab" role="tab" aria-selected="false" aria-controls="prepare-docker-apache-panel" tabindex="-1">Apache</button>
</div>
<section class="tls-tabpanel" id="prepare-docker-nginx-panel" role="tabpanel" aria-labelledby="prepare-docker-nginx-tab" tabindex="0">

<a href="../examples/nginx-https.conf" download="nginx-https.conf">📥 Download the Nginx HTTPS configuration example</a>

```bash
docker run -d --name mtls-demo-nginx \
  -p "127.0.0.1:{HOST_HTTPS_PORT}:443" \
  --mount "type=bind,src={HOST_CONFIG_PATH},dst=/etc/nginx/conf.d/default.conf,readonly" \
  --mount "type=bind,src={HOST_SERVER_CERTIFICATE_PATH},dst={SERVER_CERTIFICATE_PATH},readonly" \
  --mount "type=bind,src={HOST_SERVER_PRIVATE_KEY_PATH},dst={SERVER_PRIVATE_KEY_PATH},readonly" \
  --mount "type=bind,src={HOST_STATIC_FILES_DIRECTORY},dst={STATIC_FILES_DIRECTORY},readonly" \
  nginx:stable
```

</section>
<section class="tls-tabpanel" id="prepare-docker-apache-panel" role="tabpanel" aria-labelledby="prepare-docker-apache-tab" tabindex="0" hidden>

<a href="../examples/apache-https.conf" download="apache-https.conf">📥 Download the Apache HTTPS configuration example</a>

```bash
docker run -d --name mtls-demo-apache \
  -p "127.0.0.1:{HOST_HTTPS_PORT}:443" \
  --mount "type=bind,src={HOST_CONFIG_PATH},dst=/usr/local/apache2/conf/extra/https.conf,readonly" \
  --mount "type=bind,src={HOST_SERVER_CERTIFICATE_PATH},dst={SERVER_CERTIFICATE_PATH},readonly" \
  --mount "type=bind,src={HOST_SERVER_PRIVATE_KEY_PATH},dst={SERVER_PRIVATE_KEY_PATH},readonly" \
  --mount "type=bind,src={HOST_STATIC_FILES_DIRECTORY},dst={STATIC_FILES_DIRECTORY},readonly" \
  httpd:2.4 httpd-foreground \
  -C 'LoadModule ssl_module modules/mod_ssl.so' \
  -C 'LoadModule socache_shmcb_module modules/mod_socache_shmcb.so' \
  -c 'Include /usr/local/apache2/conf/extra/https.conf'
```

</section>
</div>

## ✅ Check the web server configuration

Use `cURL` to check for **HTTP 200** and the response body `mTLS OK`.

```bash
curl -i "https://{SERVER_DOMAIN}/mtls-test.txt"
```

### If the web server runs locally with Docker

```bash
curl --resolve "{SERVER_DOMAIN}:{HOST_HTTPS_PORT}:127.0.0.1" \
  -i "https://{SERVER_DOMAIN}:{HOST_HTTPS_PORT}/mtls-test.txt"
```

> `--resolve` keeps the domain name used for certificate validation while directing the actual connection to the local Docker server at `127.0.0.1`.
>
> If the server certificate needs an explicit trust setting, such as a self-signed certificate, add `--cacert "{SERVER_CA_CERTIFICATE_PATH}"`. To trust a self-signed server certificate directly, specify that certificate file.
