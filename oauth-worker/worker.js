/**
 * Minimal GitHub OAuth relay for Decap CMS, running as a Cloudflare Worker.
 *
 * GitHub's OAuth flow requires a server-side step to trade an auth code for
 * an access token (that trade needs your Client Secret, which must never
 * reach the browser). This Worker is that server-side step — nothing more.
 * It does not store passwords or sessions; GitHub's own login screen is
 * what actually authenticates you.
 *
 * Routes:
 *   GET /auth      -> redirects to GitHub's login/consent screen
 *   GET /callback  -> GitHub redirects back here with a code; this trades
 *                     it for a token and hands it back to the Decap CMS
 *                     popup via postMessage.
 *
 * Required Worker secrets (set with `wrangler secret put NAME`):
 *   GITHUB_CLIENT_ID
 *   GITHUB_CLIENT_SECRET
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/auth") {
      const redirectUri = `${url.origin}/callback`;
      const authorizeUrl = new URL("https://github.com/login/oauth/authorize");
      authorizeUrl.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
      authorizeUrl.searchParams.set("redirect_uri", redirectUri);
      authorizeUrl.searchParams.set("scope", "repo,user");
      return Response.redirect(authorizeUrl.toString(), 302);
    }

    if (url.pathname === "/callback") {
      const code = url.searchParams.get("code");
      if (!code) {
        return new Response("Missing ?code from GitHub", { status: 400 });
      }

      const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code,
        }),
      });
      const tokenData = await tokenRes.json();

      if (tokenData.error || !tokenData.access_token) {
        const message = tokenData.error_description || tokenData.error || "Unknown error from GitHub";
        return new Response(renderCallbackPage("error", message), {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }

      const payload = JSON.stringify({ token: tokenData.access_token, provider: "github" });
      return new Response(renderCallbackPage("success", payload), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    return new Response("Not found. Try /auth", { status: 404 });
  },
};

// This is the exact handshake Decap CMS's popup window expects:
// 1. Tell the opener we're ready ("authorizing:github").
// 2. Wait for the opener's reply (Decap sends one automatically).
// 3. Send the final "authorization:github:<state>:<payload>" message back.
function renderCallbackPage(state, content) {
  const safeContent = content.replace(/</g, "\\u003c");
  return `<!doctype html>
<html><body>
<script>
(function() {
  function receiveMessage(e) {
    window.opener.postMessage(
      'authorization:github:${state}:${safeContent}',
      e.origin
    );
    window.removeEventListener('message', receiveMessage, false);
  }
  window.addEventListener('message', receiveMessage, false);
  window.opener.postMessage('authorizing:github', '*');
})();
</script>
<p>You can close this window.</p>
</body></html>`;
}
