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

## Request verification (access_id)

Every request must include **`access_id`** in the query string. It must match the configured `CTIX_ACCESS_ID` (env). If it is missing or wrong, the proxy returns `401 Unauthorized`. This lets you ensure only callers that know the access ID can use the proxy.

## Usage

After deployment, call the proxy instead of CTIX directly. Replace your CTIX base URL with your Vercel URL, keep the same path, and add `access_id` to the query.

**Example**

- CTIX: `GET https://tenant.cyware.com/ctixapi/ingestion/threat-data/list/`
- Proxy: `GET https://your-app.vercel.app/api/ingestion/threat-data/list/?access_id=YOUR_ACCESS_ID`

Supported methods: `GET`, `POST`, `PUT`, `DELETE`. Request body and query parameters are forwarded (except `access_id`, which is only used for verification); auth params are added automatically.

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
