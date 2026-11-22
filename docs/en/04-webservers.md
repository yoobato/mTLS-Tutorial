# Web Server Configuration

Add **client certificate validation and an institution identifier check** to the web server.

## 🔐 Prepare the trusted CA certificate

Configure **`valid-ca.crt` from [3. Test Certificates](../certificates/) as the trusted CA**. Do not add `invalid-ca.crt` to the trusted CA list. Do not place CA private keys or client private keys on the web server.

## ⚙️ Add mTLS settings

This tutorial allows requests only when **certificate validation succeeds and the Subject DN `serialNumber` is `123456789`**.

The regular expression checks the allowed institution identifier **regardless of where `serialNumber` appears in the Subject DN**. It checks attribute boundaries, so the same text embedded inside another attribute's value does not satisfy the condition.

<div class="tls-tabs" data-tabs="mtls-config-1">
<div class="tls-tablist" role="tablist" aria-label="Select a web server">
<button type="button" id="mtls-config-1-nginx-tab" role="tab" aria-selected="true" aria-controls="mtls-config-1-nginx-panel" tabindex="0">Nginx</button>
<button type="button" id="mtls-config-1-apache-tab" role="tab" aria-selected="false" aria-controls="mtls-config-1-apache-panel" tabindex="-1">Apache</button>
</div>
<section class="tls-tabpanel" id="mtls-config-1-nginx-panel" role="tabpanel" aria-labelledby="mtls-config-1-nginx-tab" tabindex="0">

This example adds mTLS to the HTTPS configuration from [2. Prerequisites](../environment/).

Include this configuration **inside the `http {}` block** in `nginx.conf`.

```nginx
##### [START] Add mTLS: institution identifier check #####
# $ssl_client_s_dn: Subject DN of the client certificate
map $ssl_client_s_dn $mtls_allowed {
    # Institution identifier does not match (default = 0)
    default 0;

    # Institution identifier matches = 1
    "~^(?:[A-Za-z0-9.-]+=(?:\\\\.|[^,+\\\\])*[,+])*serialNumber=123456789(?:[,+]|$)" 1;
}
##### [END] Add mTLS #####

server {
    listen 443 ssl;
    server_name {SERVER_DOMAIN};

    ssl_certificate "{SERVER_CERTIFICATE_PATH}";
    ssl_certificate_key "{SERVER_PRIVATE_KEY_PATH}";

    root "{STATIC_FILES_DIRECTORY}";

    ##### [START] Add mTLS: client authentication and access control #####
    ssl_client_certificate "{CLIENT_CA_CERTIFICATE_PATH}";
    # Validate the client certificate chain against the trusted CA
    ssl_verify_client on;

    # Institution identifier does not match
    if ($mtls_allowed = 0) {
        return 403;
    }
    ##### [END] Add mTLS #####
}
```

> `$ssl_client_serial` is the certificate's own serial number. This lab uses `$ssl_client_s_dn`, which provides the Subject DN.

For a directly installed Nginx, check and reload the configuration. If you use Docker, follow [**Mount the CA certificate in Docker**](#mount-the-ca-certificate-in-docker) below.

```bash
sudo nginx -t
sudo nginx -s reload
```

</section>
<section class="tls-tabpanel" id="mtls-config-1-apache-panel" role="tabpanel" aria-labelledby="mtls-config-1-apache-tab" tabindex="0" hidden>

This example adds mTLS to the HTTPS configuration from [2. Prerequisites](../environment/).

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

    ##### [START] Add mTLS: client authentication and institution identifier check #####
    SSLCACertificateFile "{CLIENT_CA_CERTIFICATE_PATH}"
    # Validate the client certificate chain against the trusted CA
    SSLVerifyClient require

    <Location "/">
        # Allow access only if the institution identifier matches
        Require expr "%{SSL_CLIENT_S_DN} =~ m#^(?:[A-Za-z0-9.-]+=(?:\\\\.|[^,+\\\\])*[,+])*serialNumber=123456789(?:[,+]|$)#"
    </Location>
    ##### [END] Add mTLS #####
</VirtualHost>
```

For a directly installed Apache, check and reload the configuration. If you use Docker, follow [**Mount the CA certificate in Docker**](#mount-the-ca-certificate-in-docker) below.

```bash
sudo apachectl configtest
sudo apachectl graceful
```

> Depending on your distribution, the command may be named `apache2ctl`.

</section>
</div>

## 🐳 Mount the CA certificate in Docker

Update the configuration file downloaded in Prerequisites to match the example above. Add the following mount option **before the image name in the `docker run` command**:

```bash
--mount "type=bind,src={HOST_CLIENT_CA_CERTIFICATE_PATH},dst={CLIENT_CA_CERTIFICATE_PATH},readonly"
```

- `{HOST_CLIENT_CA_CERTIFICATE_PATH}`: the absolute path to `valid-ca.crt` on the host.
- `{CLIENT_CA_CERTIFICATE_PATH}`: the same absolute container path specified in the web server configuration.

You cannot add a mount to a running container. Remove the existing lab container, then recreate it using the updated `docker run` command.

```bash
docker rm -f "{CONTAINER_NAME}"
```

Keep the existing mounts for the server certificate, private key, and static files.

> **For a production Open Banking integration**
>
> Replace the test CA <small>(valid-ca.crt)</small> and test institution identifier <small>(123456789)</small> with **the CA certificates and institution identifiers specified in the Open Banking integration guidance**. Error responses <small>(HTTP 403 in the identifier check above)</small> must also follow the Open Banking specifications.
