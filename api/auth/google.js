/**
 * Vercel Serverless Function — Google OAuth Flow
 *
 * GET /api/auth/google          → Redirects to Google consent screen
 * GET /api/auth/google?code=... → Exchanges code for tokens, returns refresh token
 *
 * Scopes: Calendar + Sheets
 */

const { google } = require("googleapis");

const SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/spreadsheets",
];

module.exports = async function handler(req, res) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET required" });
  }

  const baseUrl = `https://${req.headers.host}`;
  const redirectUri = `${baseUrl}/api/auth/google`;

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  // If we have a code, exchange it
  if (req.query.code) {
    try {
      const { tokens } = await oauth2.getToken(req.query.code);
      return res.status(200).json({
        message: "Authorization successful! Copy the refresh_token below and set it as GOOGLE_REFRESH_TOKEN in Vercel.",
        refresh_token: tokens.refresh_token,
        access_token: tokens.access_token ? "[received]" : null,
        scopes: tokens.scope,
      });
    } catch (err) {
      return res.status(400).json({ error: "Token exchange failed", details: err.message });
    }
  }

  // Otherwise, redirect to consent screen
  const authUrl = oauth2.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
  });

  return res.redirect(authUrl);
};
