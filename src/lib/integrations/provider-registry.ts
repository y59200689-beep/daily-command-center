import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const providers = ["google", "gmail", "google_drive", "github", "strava"] as const;
export type Provider = (typeof providers)[number];

type ProviderConfig = { label: string; clientId: string | undefined; clientSecret: string | undefined; redirectUri: string | undefined; authorizationUrl: string; tokenUrl: string; scopes: string[] };

export function configFor(provider: Provider): ProviderConfig {
  const google = { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET };
  if (provider === "google") return { label: "Google Calendar", ...google, redirectUri: process.env.GOOGLE_REDIRECT_URI, authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth", tokenUrl: "https://oauth2.googleapis.com/token", scopes: ["openid", "email", "https://www.googleapis.com/auth/calendar.events", "https://www.googleapis.com/auth/calendar.calendarlist.readonly"] };
  if (provider === "gmail") return { label: "Gmail", ...google, redirectUri: process.env.GMAIL_REDIRECT_URI, authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth", tokenUrl: "https://oauth2.googleapis.com/token", scopes: ["openid", "email", "https://www.googleapis.com/auth/gmail.metadata", ...(process.env.GMAIL_ENABLE_SEND === "true" ? ["https://www.googleapis.com/auth/gmail.send"] : [])] };
  if (provider === "google_drive") return { label: "Google Drive", ...google, redirectUri: process.env.GOOGLE_DRIVE_REDIRECT_URI, authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth", tokenUrl: "https://oauth2.googleapis.com/token", scopes: ["openid", "email", "https://www.googleapis.com/auth/drive.metadata.readonly"] };
  if (provider === "github") return { label: "GitHub", clientId: process.env.GITHUB_CLIENT_ID, clientSecret: process.env.GITHUB_CLIENT_SECRET, redirectUri: process.env.GITHUB_REDIRECT_URI, authorizationUrl: "https://github.com/login/oauth/authorize", tokenUrl: "https://github.com/login/oauth/access_token", scopes: ["read:user", "repo:status", "public_repo"] };
  return { label: "Strava", clientId: process.env.STRAVA_CLIENT_ID, clientSecret: process.env.STRAVA_CLIENT_SECRET, redirectUri: process.env.STRAVA_REDIRECT_URI, authorizationUrl: "https://www.strava.com/oauth/authorize", tokenUrl: "https://www.strava.com/oauth/token", scopes: ["read,activity:read_all"] };
}

const cookieName = (provider: Provider) => `dcc_oauth_${provider}`;
const verifier = () => randomBytes(48).toString("base64url");
const challenge = (value: string) => createHash("sha256").update(value).digest("base64url");

export async function beginOAuth(provider: Provider) {
  const config = configFor(provider);
  if (!config.clientId || !config.redirectUri) throw new Error(`${config.label} credentials are not configured.`);
  const state = randomBytes(32).toString("base64url"); const codeVerifier = verifier();
  const store = await cookies();
  store.set(cookieName(provider), JSON.stringify({ state, codeVerifier }), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 600 });
  const url = new URL(config.authorizationUrl);
  url.searchParams.set("client_id", config.clientId); url.searchParams.set("redirect_uri", config.redirectUri); url.searchParams.set("response_type", "code"); url.searchParams.set("state", state);
  if (provider === "strava") { url.searchParams.set("approval_prompt", "force"); url.searchParams.set("scope", config.scopes.join(",")); }
  else { url.searchParams.set("scope", config.scopes.join(" ")); url.searchParams.set("access_type", "offline"); url.searchParams.set("prompt", "consent"); url.searchParams.set("code_challenge", challenge(codeVerifier)); url.searchParams.set("code_challenge_method", "S256"); }
  return url;
}

export async function consumeOAuthState(provider: Provider, state: string | null) {
  const store = await cookies(); const value = store.get(cookieName(provider))?.value; store.delete(cookieName(provider));
  if (!state || !value) return null;
  try { const parsed = JSON.parse(value) as { state?: string; codeVerifier?: string }; if (!parsed.state || !parsed.codeVerifier || parsed.state.length !== state.length || !timingSafeEqual(Buffer.from(parsed.state), Buffer.from(state))) return null; return parsed.codeVerifier; } catch { return null; }
}

export function safeProvider(value: string): Provider | null { return providers.includes(value as Provider) ? value as Provider : null; }
