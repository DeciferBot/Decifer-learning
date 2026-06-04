// Shopify OAuth callback — exchanges authorization code for a permanent access token.
// This route is called once during setup. It logs the token to the server console
// so you can copy it into your environment variables.
// SECURITY: delete or disable this route after setup is complete.

import { NextResponse } from 'next/server'

const SHOPIFY_CLIENT_ID     = process.env.SHOPIFY_CLIENT_ID ?? ''
const SHOPIFY_CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET ?? ''
const SHOP                  = 'u60pku-b0.myshopify.com'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const code  = searchParams.get('code')
  const shop  = searchParams.get('shop')
  const error = searchParams.get('error')

  if (error) {
    return new Response(`Shopify auth error: ${error}`, { status: 400 })
  }

  if (!code || !shop) {
    return new Response('Missing code or shop parameter', { status: 400 })
  }

  if (shop !== SHOP) {
    return new Response('Shop mismatch', { status: 400 })
  }

  // Exchange code for access token
  const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id:     SHOPIFY_CLIENT_ID,
      client_secret: SHOPIFY_CLIENT_SECRET,
      code,
    }),
  })

  if (!tokenRes.ok) {
    const text = await tokenRes.text()
    return new Response(`Token exchange failed: ${text}`, { status: 500 })
  }

  const data = await tokenRes.json() as { access_token?: string; scope?: string }

  if (!data.access_token) {
    return new Response('No access token in response', { status: 500 })
  }

  // Return the token in the browser so you can copy it into Vercel env vars
  return new Response(`
    <html>
      <body style="font-family:monospace;padding:40px;background:#0a0a0a;color:#00ff00;">
        <h2 style="color:white;">✅ Shopify connected successfully</h2>
        <p style="color:#aaa;">Copy this token into Vercel as <strong style="color:white;">SHOPIFY_ADMIN_ACCESS_TOKEN</strong></p>
        <p style="color:#aaa;">Scopes granted: ${data.scope}</p>
        <div style="background:#111;border:1px solid #333;padding:20px;border-radius:8px;word-break:break-all;font-size:14px;">
          ${data.access_token}
        </div>
        <p style="color:#ff4444;margin-top:20px;">⚠️ Delete the /api/shopify/callback route after copying this token.</p>
      </body>
    </html>
  `, {
    status: 200,
    headers: { 'Content-Type': 'text/html' },
  })
}
