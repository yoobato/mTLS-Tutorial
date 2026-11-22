# Test Certificates

Create two self-signed CAs and three client certificates to test client authentication. The allowed institution identifier <small>(the Subject DN `serialNumber`)</small> is `123456789` in this lab.

| File | Issuing CA | Institution identifier | Case |
| --- | --- | --- | --- |
| `valid-cli.crt` | `valid-ca.crt` | `123456789` | Trusted CA + matching institution identifier |
| `invalid-sn-cli.crt` | `valid-ca.crt` | `987654321` | Trusted CA + mismatched institution identifier |
| `invalid-ca-cli.crt` | `invalid-ca.crt` | `123456789` | Untrusted CA + matching institution identifier |

## 1. Create two test CAs

```bash
mkdir -p "{WORKING_DIRECTORY}"
cd "{WORKING_DIRECTORY}"
mkdir -p certs
cd certs

# Trusted CA certificate + private key
openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
  -keyout valid-ca.key -out valid-ca.crt \
  -subj '/C=KR/L=Seoul/O=KFTC/CN=Test CA'

# Untrusted CA certificate + private key
openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
  -keyout invalid-ca.key -out invalid-ca.crt \
  -subj '/C=KR/L=Seoul/O=KFTC/CN=Untrusted Test CA'
```

> `-nodes` leaves the private key unencrypted.
>
> Keep the CA private key only where certificates are signed. Copy **only the CA certificate to the web server**.

The commands use the default OpenSSL configuration to generate the CA certificates. Check that **both certificates contain `CA:TRUE`**:

```bash
openssl x509 -in valid-ca.crt -noout -text
openssl x509 -in invalid-ca.crt -noout -text
```

> If `CA:TRUE` is missing, your OpenSSL configuration has not specified a CA extension. Add `-addext 'basicConstraints=critical,CA:TRUE'` to the generation commands above and generate the certificates again.

## 2. Generate private keys and CSRs

A CSR contains the public key and the applicant's Subject information. The `/serialNumber=...` attribute in `-subj` is the institution identifier in the Subject DN, with OID `2.5.4.5`.

```bash
# Trusted CA + matching institution identifier
openssl genrsa -out valid-cli.key 2048
openssl req -new -key valid-cli.key -out valid-cli.csr \
  -subj '/C=KR/L=Seoul/O=KFTC/serialNumber=123456789'

# Trusted CA + mismatched institution identifier
openssl genrsa -out invalid-sn-cli.key 2048
openssl req -new -key invalid-sn-cli.key -out invalid-sn-cli.csr \
  -subj '/C=KR/L=Seoul/O=KFTC/serialNumber=987654321'

# Untrusted CA + matching institution identifier
openssl genrsa -out invalid-ca-cli.key 2048
openssl req -new -key invalid-ca-cli.key -out invalid-ca-cli.csr \
  -subj '/C=KR/L=Seoul/O=KFTC/serialNumber=123456789'
```

## 3. Issue client certificates

The CA constructs a certificate from the CSR and **signs the certificate with its CA private key**.

```bash
# Trusted CA + matching institution identifier
openssl x509 -req -in valid-cli.csr \
  -CA valid-ca.crt -CAkey valid-ca.key \
  -out valid-cli.crt

# Trusted CA + mismatched institution identifier
openssl x509 -req -in invalid-sn-cli.csr \
  -CA valid-ca.crt -CAkey valid-ca.key \
  -out invalid-sn-cli.crt

# Untrusted CA + matching institution identifier
openssl x509 -req -in invalid-ca-cli.csr \
  -CA invalid-ca.crt -CAkey invalid-ca.key \
  -out invalid-ca-cli.crt
```

## 4. Check the certificates

```bash
openssl x509 -in valid-cli.crt -noout -subject -issuer -nameopt RFC2253
openssl verify -purpose sslclient -CAfile valid-ca.crt valid-cli.crt
openssl verify -purpose sslclient -CAfile valid-ca.crt invalid-sn-cli.crt
openssl verify -purpose sslclient -CAfile valid-ca.crt invalid-ca-cli.crt
```

Only the final command should fail certificate validation. The certificate with a mismatched institution identifier passes certificate validation; the web server rejects it later during the institution identifier check.

> **For a production Open Banking integration**
>
> This tutorial uses test CAs that you create yourself. In production, use **the CA certificates and institution identifiers specified in the Open Banking integration guidance**.
