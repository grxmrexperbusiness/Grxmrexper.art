# Setting up your login system

This turns your site into a small Git-backed CMS. Logging in means logging
in with your actual GitHub account — there's no password stored anywhere in
this code, so there's nothing in the JavaScript for someone to find and
bypass.

Three things need to exist before it works: your site's repo (you already
have this), a GitHub OAuth App (2 minutes), and a tiny free Cloudflare
Worker that relays the login handshake (5 minutes). Do them in this order.

## 1. Copy these files into your GitHub Pages repo

Drop everything from this folder into the root of your repo, replacing your
current `index.html`:

```
index.html
data/trusted.json
data/quotes.json
data/work.json
images/avatar.jpg
images/uploads/...
admin/index.html
admin/config.yml
```

(`oauth-worker/` and this `SETUP.md` don't need to go in the repo — they're
just for the next steps.)

Commit and push. Your site should look and behave exactly like it did
before — the only difference is the trusted-by row, the portfolio grid, and
the testimonials now load from the `data/*.json` files instead of being
baked into the HTML.

## 2. Create a GitHub OAuth App

1. Go to **github.com/settings/developers** → **OAuth Apps** → **New OAuth App**.
2. Fill it in:
   - **Application name**: anything, e.g. `Grxmrexper CMS`
   - **Homepage URL**: your site's URL, e.g. `https://yourusername.github.io/yourrepo`
   - **Authorization callback URL**: `https://YOUR-WORKER-SUBDOMAIN.workers.dev/callback`
     (you'll get the exact Worker URL in step 3 — you can come back and fill
     this in after, GitHub lets you edit it later)
3. Click **Register application**.
4. Copy the **Client ID**, and click **Generate a new client secret** and copy that too. Keep the secret private — don't commit it anywhere.

## 3. Deploy the Cloudflare Worker (the OAuth relay)

This is the one piece that has to run *somewhere* other than GitHub Pages,
because GitHub requires a server for the token exchange. Cloudflare's free
tier covers this completely — no credit card needed.

1. Sign up / log in at **dash.cloudflare.com** (free plan is fine).
2. Install Wrangler (Cloudflare's CLI) if you don't have it:
   ```
   npm install -g wrangler
   ```
3. From the `oauth-worker/` folder:
   ```
   wrangler login
   wrangler deploy
   ```
4. Set your GitHub OAuth App's credentials as Worker secrets:
   ```
   wrangler secret put GITHUB_CLIENT_ID
   wrangler secret put GITHUB_CLIENT_SECRET
   ```
   (paste the values from step 2 when prompted)
5. Wrangler will print your Worker's URL, something like:
   ```
   https://grxmrexper-cms-auth.YOUR-SUBDOMAIN.workers.dev
   ```
6. Go back to your GitHub OAuth App settings and make sure the
   **Authorization callback URL** is exactly that URL + `/callback`.

## 4. Point the CMS at your Worker and repo

Open `admin/config.yml` in your repo and fill in the two placeholders:

```yaml
backend:
  name: github
  repo: yourusername/yourrepo          # <-- your actual repo path
  branch: main
  base_url: https://grxmrexper-cms-auth.YOUR-SUBDOMAIN.workers.dev  # <-- your Worker URL, no trailing slash
  auth_endpoint: auth
```

Commit and push.

## 5. Log in

Visit `https://yourusername.github.io/yourrepo/admin/` — you'll get a
"Login with GitHub" button. It sends you to GitHub's real login screen, you
approve access, and you land in the CMS with three sections: **Trusted By**,
**Testimonials**, and **Portfolio thumbnails**. Adding, editing, or removing
an entry there commits straight to your repo, and GitHub Pages rebuilds the
live site automatically within a minute or two.

Only GitHub accounts with push access to your repo can log in at all —
that's the real security boundary, and it's the same one protecting your
code right now.

## One thing to fix

The `Obi_Block` avatar image in your original file had 2 corrupted bytes at
the very end (likely from how it got embedded originally) — I recovered it
and it looks fine, but worth re-uploading a fresh copy through the CMS once
this is live, just to be safe.
