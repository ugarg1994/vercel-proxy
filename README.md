# CTIX API proxy (Vercel)

Serverless proxy that forwards requests to the CTIX API and adds HMAC authentication (AccessID + Expires + Signature) using credentials from environment variables.

## Environment variables

Set these in **Vercel → Project → Settings → Environment Variables**:

| Variable | Description |
|----------|-------------|
| `CTIX_API_URL` | CTIX base URL (e.g. `https://your-tenant.cyware.com/ctixapi`) |
| `CTIX_ACCESS_ID` | Access ID from CTIX Open API configuration |
| `CTIX_SECRET_KEY` | Secret key from CTIX Open API configuration |

## Auth

The proxy uses the same HMAC scheme as CTIX Open API:

- `to_sign = AccessID + "\n" + Expires` (Expires = current Unix timestamp + 28s)
- `Signature = Base64(HMAC-SHA1(secret_key, to_sign))`
- Every request is sent with query parameters: `AccessID`, `Expires`, `Signature`.

## Usage

After deployment, call the proxy instead of CTIX directly. Replace your CTIX base URL with your Vercel URL and keep the same path.

**Example**

- CTIX: `GET https://tenant.cyware.com/ctixapi/ingestion/threat-data/list/`
- Proxy: `GET https://your-app.vercel.app/api/ingestion/threat-data/list/`

Supported methods: `GET`, `POST`, `PUT`, `DELETE`. Request body and query parameters are forwarded; auth params are added automatically.

## Deploy

```bash
cd ctix-proxy
vercel
```

Or connect the repo to Vercel and deploy from the dashboard.
