# CTIX API proxy (Vercel)

Serverless proxy that forwards requests to the CTIX API and adds HMAC authentication (AccessID + Expires + Signature) using credentials from environment variables.

## Environment variables

Set these in **Vercel → Project → Settings → Environment Variables**:

| Variable | Description |
|----------|-------------|
| `CTIX_API_URL` | CTIX base URL (e.g. `https://your-tenant.cyware.com/ctixapi`) |
| `CTIX_ACCESS_ID` | Access ID from CTIX Open API configuration |
| `CTIX_SECRET_KEY` | Secret key from CTIX Open API configuration |
| `REQUIRE_ACCESS_ID` | Optional. Set to `true`, `1`, or `yes` to require `access_id` in the query string (must match `CTIX_ACCESS_ID`). If unset, no access_id check is performed. |

## Auth

The proxy uses the same HMAC scheme as CTIX Open API:

- `to_sign = AccessID + "\n" + Expires` (Expires = current Unix timestamp + 28s)
- `Signature = Base64(HMAC-SHA1(secret_key, to_sign))`
- Every request is sent with query parameters: `AccessID`, `Expires`, `Signature`.

## Request verification (access_id, optional)

If **`REQUIRE_ACCESS_ID`** is set to `true`, `1`, or `yes`, every request must include **`access_id`** in the query string and it must match `CTIX_ACCESS_ID`; otherwise the proxy returns `401 Unauthorized`. If `REQUIRE_ACCESS_ID` is not set, the proxy does not check `access_id` and any request is accepted.

## Usage

After deployment, call the proxy instead of CTIX directly. Replace your CTIX base URL with your Vercel URL and keep the same path.

**Examples**

- CTIX: `GET https://tenant.cyware.com/ctixapi/ingestion/threat-data/list/`
- Proxy (no check): `GET https://your-app.vercel.app/api/ingestion/threat-data/list/`
- Proxy (when `REQUIRE_ACCESS_ID=true`): `GET https://your-app.vercel.app/api/ingestion/threat-data/list/?access_id=YOUR_ACCESS_ID`

Supported methods: `GET`, `POST`, `PUT`, `DELETE`. Request body and query parameters are forwarded (except `access_id`, which is stripped and only used for verification when enabled); auth params are added automatically.

## Deploy on Vercel

### Option 1: Vercel CLI (run in your terminal)

```bash
cd /Users/utkarsh.garg/PycharmProjects/jff/ctix-proxy/vercel-proxy
npx vercel
```

- First time: log in or sign up when prompted; choose **Create new project** or link an existing one.
- After the first deploy, use `npx vercel --prod` to deploy to production.

**Before the proxy works**, add env vars in the Vercel dashboard: **Project → Settings → Environment Variables** → add `CTIX_API_URL`, `CTIX_ACCESS_ID`, `CTIX_SECRET_KEY`, then redeploy.

### Option 2: Connect Git (GitHub/GitLab/Bitbucket)

1. Push this folder to a Git repo.
2. Go to [vercel.com](https://vercel.com) → **Add New** → **Project**.
3. Import the repo; set **Root Directory** to `vercel-proxy` (if the repo root is the parent).
4. In **Settings → Environment Variables**, add `CTIX_API_URL`, `CTIX_ACCESS_ID`, `CTIX_SECRET_KEY`.
5. Deploy.

### After deploy

Set **Framework Preset** to **Other** in **Settings → General** so Vercel doesn’t treat the project as Next.js. Your proxy URL will be like `https://your-project.vercel.app/api/<path>`.
