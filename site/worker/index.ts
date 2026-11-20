import { getPublicKeyAsync, signAsync, verifyAsync } from "@noble/ed25519";

interface AssetFetcher {
  fetch(request: Request): Promise<Response>;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T>(): Promise<T | null>;
  run(): Promise<unknown>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  exec(query: string): Promise<unknown>;
}

interface Env {
  ASSETS: AssetFetcher;
  DB: D1Database;
  APP_ORIGIN: string;
  DISCORD_CLIENT_ID?: string;
  DISCORD_CLIENT_SECRET?: string;
  SESSION_SECRET?: string;
  LICENSE_SIGNING_KEY?: string;
  DISCORD_PUBLIC_KEY?: string;
  DISCORD_BOT_TOKEN?: string;
  DISCORD_GUILD_ID?: string;
}

interface Session {
  sub: string;
  name: string;
  avatar: string | null;
  exp: number;
}

interface OAuthState {
  state: string;
  returnTo: string;
  exp: number;
}

interface LicenseRow {
  license_key: string;
  license_id: string;
  recipient: string;
  issued_at: number;
}

interface DiscordProfile {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
}

interface DiscordInteraction {
  id: string;
  application_id: string;
  type: number;
  guild_id?: string;
  member?: {
    user?: DiscordProfile;
    permissions?: string;
  };
  user?: DiscordProfile;
  data?: {
    name?: string;
    custom_id?: string;
  };
}

interface DiscordRole {
  id: string;
  name: string;
  position: number;
}

interface DiscordChannel {
  id: string;
  name: string;
  type: number;
}

interface DiscordGuildConfig {
  guild_id: string;
  verified_role_id: string;
  verified_channel_id: string;
  verify_channel_id: string;
}

const APP_PUBLIC_KEY_HEX =
  "67e84ef1b07bb38eaacc4b2d48c16a5051420423ba9e25d31b848aebbec3164f";
const DISCORD_AUTHORIZE = "https://discord.com/oauth2/authorize";
const DISCORD_TOKEN = "https://discord.com/api/oauth2/token";
const DISCORD_ME = "https://discord.com/api/users/@me";
const SESSION_TTL = 30 * 24 * 60 * 60 * 1000;
const OAUTH_TTL = 10 * 60 * 1000;
const DISCORD_API = "https://discord.com/api/v10";
const DISCORD_VIEW_CHANNEL = 1024;
const DISCORD_SEND_MESSAGES = 2048;
const DISCORD_READ_HISTORY = 65536;
const DISCORD_MANAGE_GUILD = 32;
const DISCORD_ADMINISTRATOR = 8;
const DISCORD_VERIFIED_ALLOW =
  DISCORD_VIEW_CHANNEL | DISCORD_SEND_MESSAGES | DISCORD_READ_HISTORY;

let schemaReady: Promise<unknown> | undefined;
let discordSchemaReady: Promise<unknown> | undefined;
let cachedSeed: Uint8Array | undefined;
let hmacKey: CryptoKey | undefined;
let hmacSecret = "";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    try {
      const route = await routeRequest(request, env, url);
      if (route) return route;
    } catch (error) {
      console.error(
        "request failed:",
        error instanceof Error ? error.message : "unknown error",
      );
      return text("Something went wrong. Try again.", 500);
    }

    const response = await env.ASSETS.fetch(request);
    if (response.status !== 404 || request.method !== "GET") return response;

    if (/\.[a-z0-9]+$/i.test(url.pathname)) return response;

    const notFound = await env.ASSETS.fetch(
      new Request(new URL("/404.html", url), {
        method: "GET",
        headers: request.headers,
      }),
    );
    if (!notFound.ok) return response;

    return new Response(notFound.body, {
      status: 404,
      headers: notFound.headers,
    });
  },
};

async function routeRequest(
  request: Request,
  env: Env,
  url: URL,
): Promise<Response | null> {
  if (url.pathname === "/auth/discord/signin") {
    if (request.method !== "GET") return text("Method not allowed.", 405);
    return signIn(env, url);
  }

  if (url.pathname === "/auth/discord/callback") {
    if (request.method !== "GET") return text("Method not allowed.", 405);
    return callback(request, env, url);
  }

  if (url.pathname === "/auth/discord/signout") {
    if (request.method !== "POST") return text("Method not allowed.", 405);
    return signOut(request, env, url);
  }

  if (url.pathname === "/api/session") {
    if (request.method !== "GET") return text("Method not allowed.", 405);
    return sessionResponse(request, env);
  }

  if (url.pathname === "/api/account") {
    if (request.method !== "GET") return json({ error: "Method not allowed." }, 405);
    return accountResponse(request, env);
  }

  if (url.pathname === "/api/license") {
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
    return licenseResponse(request, env);
  }

  if (url.pathname === "/api/discord/interactions") {
    if (request.method !== "POST") return text("Method not allowed.", 405);
    return discordInteraction(request, env);
  }

  if (url.pathname === "/api/discord/widget") {
    if (request.method !== "GET") return json({ error: "Method not allowed." }, 405);
    return discordWidget(env);
  }

  if (
    url.pathname.startsWith("/downloads/") &&
    (request.method === "GET" || request.method === "HEAD")
  ) {
    const session = await readSession(request, env);
    if (!session && discordConfigured(env)) {
      const target = new URL("/auth/discord/signin", origin(env));
      target.searchParams.set("returnTo", `${url.pathname}${url.search}`);
      return redirect(target.toString());
    }
  }

  return null;
}

async function signIn(env: Env, url: URL): Promise<Response> {
  if (!discordConfigured(env)) {
    return text("Discord sign-in is not configured yet.", 503);
  }
  if (!sessionSecret(env)) {
    return text("Discord sign-in is not configured yet.", 503);
  }

  const returnTo = safeReturnTo(url.searchParams.get("returnTo")) ?? "/account";
  const state = randomHex(24);
  const sealed = await seal<OAuthState>(
    { state, returnTo, exp: Date.now() + OAUTH_TTL },
    env,
  );

  const target = new URL(DISCORD_AUTHORIZE);
  target.searchParams.set("response_type", "code");
  target.searchParams.set("client_id", env.DISCORD_CLIENT_ID!);
  target.searchParams.set("redirect_uri", redirectUri(env));
  target.searchParams.set("scope", "identify");
  target.searchParams.set("state", state);

  const headers = new Headers();
  headers.set("Cache-Control", "no-store");
  headers.append(
    "Set-Cookie",
    cookie(oauthCookieName(env), sealed, OAUTH_TTL / 1000, isSecure(env)),
  );

  return redirect(target.toString(), headers);
}

async function callback(request: Request, env: Env, url: URL): Promise<Response> {
  if (!discordConfigured(env)) {
    return text("Discord sign-in is not configured yet.", 503);
  }
  if (!sessionSecret(env)) {
    return text("Discord sign-in is not configured yet.", 503);
  }

  const headers = new Headers();
  headers.set("Cache-Control", "no-store");
  headers.append("Set-Cookie", clearCookie(oauthCookieName(env), isSecure(env)));

  const stateParam = url.searchParams.get("state") ?? "";
  const rawState = cookieValue(request, oauthCookieName(env));
  const stored = rawState ? await unseal<OAuthState>(rawState, env) : null;

  if (
    !stored ||
    stored.exp < Date.now() ||
    !stateParam ||
    stored.state !== stateParam
  ) {
    return redirect("/account?error=discord_state", headers);
  }

  if (url.searchParams.get("error")) {
    return redirect("/account?error=discord", headers);
  }

  const code = url.searchParams.get("code");
  if (!code) return redirect("/account?error=discord", headers);

  let profile: DiscordProfile;
  try {
    const tokens = await exchangeCode(code, env);
    profile = await fetchProfile(tokens);
  } catch (error) {
    console.error(
      "discord auth failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    return redirect("/account?error=discord", headers);
  }

  const name = discordName(profile);
  const avatar = profile.avatar
    ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png?size=128`
    : null;

  const sealed = await seal<Session>(
    {
      sub: `discord:${profile.id}`,
      name,
      avatar,
      exp: Date.now() + SESSION_TTL,
    },
    env,
  );

  headers.append(
    "Set-Cookie",
    cookie(sessionCookieName(env), sealed, SESSION_TTL / 1000, isSecure(env)),
  );

  return redirect(stored.returnTo, headers);
}

async function signOut(request: Request, env: Env, url: URL): Promise<Response> {
  if (!sameOrigin(request, env)) return text("Forbidden.", 403);

  let returnTo = "/";
  try {
    const form = await request.formData();
    returnTo = safeReturnTo(String(form.get("returnTo") ?? "")) ?? "/";
  } catch {
    returnTo = "/";
  }

  const headers = new Headers();
  headers.set("Cache-Control", "no-store");
  headers.append(
    "Set-Cookie",
    clearCookie(sessionCookieName(env), isSecure(env)),
  );

  return redirect(returnTo || url.pathname, headers);
}

async function sessionResponse(request: Request, env: Env): Promise<Response> {
  const session = await readSession(request, env);
  return json({
    user: session ? publicUser(session) : null,
    discordConfigured: discordConfigured(env),
  });
}

async function accountResponse(request: Request, env: Env): Promise<Response> {
  const session = await readSession(request, env);
  if (!session) return json({ error: "Sign in required." }, 401);

  await ensureSchema(env);
  const license = await findLicense(env, session.sub);

  return json({
    user: publicUser(session),
    license: license ? publicLicense(license) : null,
  });
}

async function licenseResponse(request: Request, env: Env): Promise<Response> {
  if (!sameOrigin(request, env)) return json({ error: "Forbidden." }, 403);

  const session = await readSession(request, env);
  if (!session) return json({ error: "Sign in required." }, 401);

  await ensureSchema(env);

  let license = await findLicense(env, session.sub);
  if (!license) {
    const issued = await createLicense(env, session);
    await env.DB.prepare(
      `INSERT OR IGNORE INTO licenses
        (user_sub, license_key, license_id, recipient, issued_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
      .bind(
        session.sub,
        issued.key,
        issued.id,
        issued.recipient,
        issued.issuedAt,
      )
      .run();

    license = await findLicense(env, session.sub);
    if (!license) throw new Error("license row missing after insert");
  }

  return json({ license: publicLicense(license) });
}

async function exchangeCode(code: string, env: Env): Promise<string> {
  const body = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID!,
    client_secret: env.DISCORD_CLIENT_SECRET!,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri(env),
  });

  const response = await fetch(DISCORD_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) throw new Error(`discord token ${response.status}`);

  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("discord token missing");
  return data.access_token;
}

async function fetchProfile(accessToken: string): Promise<DiscordProfile> {
  const response = await fetch(DISCORD_ME, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) throw new Error(`discord profile ${response.status}`);

  const data = (await response.json()) as DiscordProfile;
  if (!data.id || !data.username) throw new Error("discord profile incomplete");
  return data;
}

async function readSession(request: Request, env: Env): Promise<Session | null> {
  if (!sessionSecret(env)) return null;

  const raw = cookieValue(request, sessionCookieName(env));
  if (!raw) return null;

  const session = await unseal<Session>(raw, env);
  if (!session || !session.sub || session.exp < Date.now()) return null;
  return session;
}

function publicUser(session: Session) {
  return { name: session.name, avatar: session.avatar };
}

function publicLicense(license: LicenseRow) {
  return {
    key: license.license_key,
    id: license.license_id,
    recipient: license.recipient,
    issuedAt: license.issued_at,
    expiresAt: null,
    plan: "full",
  };
}

function ensureSchema(env: Env): Promise<unknown> {
  schemaReady ??= env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS licenses (
      user_sub TEXT PRIMARY KEY,
      license_key TEXT NOT NULL,
      license_id TEXT NOT NULL UNIQUE,
      recipient TEXT NOT NULL,
      issued_at INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  )
    .run()
    .catch((error) => {
      schemaReady = undefined;
      throw error;
    });

  return schemaReady;
}

async function findLicense(env: Env, userSub: string): Promise<LicenseRow | null> {
  return env.DB.prepare(
    `SELECT license_key, license_id, recipient, issued_at
     FROM licenses
     WHERE user_sub = ?`,
  )
    .bind(userSub)
    .first<LicenseRow>();
}

async function createLicense(
  env: Env,
  session: Session,
): Promise<{ key: string; id: string; recipient: string; issuedAt: number }> {
  const seed = await signingSeed(env);
  const recipient = recipientName(session.name);
  const issuedAt = Date.now();
  const seconds = Math.floor(issuedAt / 1000);
  const id = `lic_${randomHex(10)}`;

  const payload = JSON.stringify({
    v: 1,
    id,
    name: recipient,
    issued: seconds,
    expires: null,
    plan: "full",
  });

  const encoded = base64Url(new TextEncoder().encode(payload));
  const signature = await signAsync(new TextEncoder().encode(encoded), seed);

  return {
    key: `LYRICA1.${encoded}.${base64Url(signature)}`,
    id,
    recipient,
    issuedAt,
  };
}

async function signingSeed(env: Env): Promise<Uint8Array> {
  if (cachedSeed) return cachedSeed;

  const value = env.LICENSE_SIGNING_KEY?.trim() ?? "";
  if (!/^[0-9a-f]{64}$/i.test(value)) {
    throw new Error("LICENSE_SIGNING_KEY is not a 32-byte hex seed");
  }

  const seed = Uint8Array.from(value.match(/../g)!.map((pair) => parseInt(pair, 16)));
  const publicKey = await getPublicKeyAsync(seed);

  if (hex(publicKey) !== APP_PUBLIC_KEY_HEX) {
    throw new Error("LICENSE_SIGNING_KEY does not match the app's public key");
  }

  cachedSeed = seed;
  return seed;
}

function recipientName(name: string): string {
  return name
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80) || "Lyrica user";
}

function discordName(profile: DiscordProfile): string {
  return recipientName(profile.global_name || profile.username);
}

function discordConfigured(env: Env): boolean {
  return Boolean(env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET);
}

function sessionSecret(env: Env): string | null {
  const value = env.SESSION_SECRET?.trim() ?? "";
  return value.length >= 32 ? value : null;
}

function origin(env: Env): string {
  return env.APP_ORIGIN.replace(/\/+$/g, "");
}

function redirectUri(env: Env): string {
  return `${origin(env)}/auth/discord/callback`;
}

function isSecure(env: Env): boolean {
  return origin(env).startsWith("https://");
}

function sessionCookieName(env: Env): string {
  return `${isSecure(env) ? "__Host-" : ""}lyrica_session`;
}

function oauthCookieName(env: Env): string {
  return `${isSecure(env) ? "__Host-" : ""}lyrica_oauth`;
}

async function seal<T>(payload: T, env: Env): Promise<string> {
  const encoded = base64Url(
    new TextEncoder().encode(JSON.stringify(payload)),
  );
  const signature = base64Url(await hmac(env, encoded));
  return `${encoded}.${signature}`;
}

async function unseal<T>(token: string, env: Env): Promise<T | null> {
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;

  const [encoded, signature] = parts;
  const expected = await hmac(env, encoded);
  const actual = fromBase64Url(signature);
  if (!actual || !equalBytes(expected, actual)) return null;

  const payload = fromBase64Url(encoded);
  if (!payload) return null;

  try {
    return JSON.parse(new TextDecoder().decode(payload)) as T;
  } catch {
    return null;
  }
}

async function hmac(env: Env, value: string): Promise<Uint8Array> {
  const secret = sessionSecret(env);
  if (!secret) throw new Error("SESSION_SECRET is not configured");

  if (!hmacKey || hmacSecret !== secret) {
    hmacKey = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    hmacSecret = secret;
  }

  return new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      hmacKey,
      new TextEncoder().encode(value),
    ),
  );
}

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a[index] ^ b[index];
  }
  return diff === 0;
}

function cookieValue(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;

  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=") || null;
  }

  return null;
}

function cookie(
  name: string,
  value: string,
  maxAge: number,
  secure: boolean,
): string {
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(maxAge)}${secure ? "; Secure" : ""}`;
}

function clearCookie(name: string, secure: boolean): string {
  return `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`;
}

function sameOrigin(request: Request, env: Env): boolean {
  const requestOrigin = request.headers.get("origin");
  if (requestOrigin && requestOrigin !== "null") {
    return requestOrigin === origin(env);
  }
  return request.headers.get("sec-fetch-site") === "same-origin";
}

function safeReturnTo(value: string | null | undefined): string | null {
  if (!value) return null;
  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    value.startsWith("/auth/")
  ) {
    return null;
  }
  return value;
}

async function discordInteraction(
  request: Request,
  env: Env,
): Promise<Response> {
  const signature = request.headers.get("x-signature-ed25519") ?? "";
  const timestamp = request.headers.get("x-signature-timestamp") ?? "";
  const publicKey = env.DISCORD_PUBLIC_KEY?.trim() ?? "";

  if (
    !/^[0-9a-f]{64}$/i.test(publicKey) ||
    !/^[0-9a-f]{128}$/i.test(signature) ||
    !timestamp
  ) {
    return text("Invalid request signature.", 401);
  }

  const timestampSeconds = Number(timestamp);
  if (
    !Number.isFinite(timestampSeconds) ||
    Math.abs(Date.now() / 1000 - timestampSeconds) > 300
  ) {
    return text("Invalid request signature.", 401);
  }

  const body = await request.text();
  let valid = false;

  try {
    valid = await verifyAsync(
      fromHex(signature),
      new TextEncoder().encode(timestamp + body),
      fromHex(publicKey),
    );
  } catch {
    valid = false;
  }

  if (!valid) return text("Invalid request signature.", 401);

  let interaction: DiscordInteraction;
  try {
    interaction = JSON.parse(body) as DiscordInteraction;
  } catch {
    return text("Invalid interaction.", 400);
  }

  if (interaction.type === 1) return interactionJson({ type: 1 });
  if (interaction.type === 2) return discordCommand(interaction, env);
  if (interaction.type === 3) return discordComponent(interaction, env);
  return interactionJson(ephemeral("Unsupported interaction."));
}

async function discordCommand(
  interaction: DiscordInteraction,
  env: Env,
): Promise<Response> {
  if (interaction.data?.name !== "setup") {
    return interactionJson(ephemeral("Unknown command."));
  }

  const guildId = interaction.guild_id;
  if (!guildId) {
    return interactionJson(ephemeral("Run /setup in a server."));
  }

  let permissions = 0n;
  try {
    permissions = BigInt(interaction.member?.permissions ?? "0");
  } catch {
    permissions = 0n;
  }

  if (
    (permissions &
      (BigInt(DISCORD_ADMINISTRATOR) | BigInt(DISCORD_MANAGE_GUILD))) ===
    0n
  ) {
    return interactionJson(
      ephemeral("You need Manage Server to run Lyrica setup."),
    );
  }

  const applicationId =
    interaction.application_id || env.DISCORD_CLIENT_ID || "";

  try {
    const message = await setupDiscordGuild(guildId, applicationId, env);
    return interactionJson(ephemeral(message));
  } catch (error) {
    console.error(
      "discord setup failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    return interactionJson(
      ephemeral(
        "Setup failed. Give the Lyrica bot Manage Roles and Manage Channels, and make sure its role is above Verified, then run /setup again.",
      ),
    );
  }
}

async function setupDiscordGuild(
  guildId: string,
  applicationId: string,
  env: Env,
): Promise<string> {
  await ensureDiscordSchema(env);

  const existing = await env.DB.prepare(
    `SELECT guild_id, verified_role_id, verified_channel_id, verify_channel_id
     FROM discord_guilds
     WHERE guild_id = ?`,
  )
    .bind(guildId)
    .first<DiscordGuildConfig>();

  if (existing) {
    return [
      "Lyrica verification is already set up here.",
      `Verified role: <@&${existing.verified_role_id}>`,
      `Private channel: <#${existing.verified_channel_id}>`,
      `Verify channel: <#${existing.verify_channel_id}>`,
    ].join("\n");
  }

  const roles = await discordApi<DiscordRole[]>(
    env,
    `/guilds/${guildId}/roles`,
  );

  let role = roles.find((item) => item.name.toLowerCase() === "verified");
  if (!role) {
    role = await discordApi<DiscordRole>(env, `/guilds/${guildId}/roles`, {
      method: "POST",
      body: JSON.stringify({
        name: "Verified",
        color: 0x3ddc97,
        hoist: false,
        mentionable: false,
        permissions: "0",
      }),
    });
  }

  const channels = await discordApi<DiscordChannel[]>(
    env,
    `/guilds/${guildId}/channels`,
  );
  const botId = applicationId || env.DISCORD_CLIENT_ID || "";

  const verifiedOverwrites: Array<{
    id: string;
    type: number;
    allow?: string;
    deny?: string;
  }> = [
    { id: guildId, type: 0, deny: String(DISCORD_VIEW_CHANNEL) },
    {
      id: role.id,
      type: 0,
      allow: String(DISCORD_VERIFIED_ALLOW),
    },
  ];
  if (botId) {
    verifiedOverwrites.push({
      id: botId,
      type: 1,
      allow: String(DISCORD_VIEW_CHANNEL),
    });
  }

  let verified = channels.find(
    (item) => item.type === 0 && item.name.toLowerCase() === "verified",
  );
  if (!verified) {
    verified = await discordApi<DiscordChannel>(
      env,
      `/guilds/${guildId}/channels`,
      {
        method: "POST",
        body: JSON.stringify({
          name: "verified",
          type: 0,
          topic: "Lyrica members with a claimed license key.",
          permission_overwrites: verifiedOverwrites,
        }),
      },
    );
  } else {
    await discordApi(env, `/channels/${verified.id}`, {
      method: "PATCH",
      body: JSON.stringify({ permission_overwrites: verifiedOverwrites }),
    });
  }

  const verifyOverwrites: Array<{
    id: string;
    type: number;
    allow?: string;
    deny?: string;
  }> = [
    {
      id: guildId,
      type: 0,
      allow: String(DISCORD_VIEW_CHANNEL | DISCORD_READ_HISTORY),
      deny: String(DISCORD_SEND_MESSAGES),
    },
  ];
  if (botId) {
    verifyOverwrites.push({
      id: botId,
      type: 1,
      allow: String(DISCORD_VERIFIED_ALLOW),
    });
  }

  let verify = channels.find(
    (item) => item.type === 0 && item.name.toLowerCase() === "verify",
  );
  if (!verify) {
    verify = await discordApi<DiscordChannel>(
      env,
      `/guilds/${guildId}/channels`,
      {
        method: "POST",
        body: JSON.stringify({
          name: "verify",
          type: 0,
          topic: `Sign in at ${origin(env)}/account/, claim a Lyrica key, then press Verify.`,
          permission_overwrites: verifyOverwrites,
        }),
      },
    );
  } else {
    await discordApi(env, `/channels/${verify.id}`, {
      method: "PATCH",
      body: JSON.stringify({ permission_overwrites: verifyOverwrites }),
    });
  }

  await discordApi(env, `/channels/${verify.id}/messages`, {
    method: "POST",
    body: JSON.stringify({
      content: [
        "**Verify for Lyrica**",
        `1. Sign in at <${origin(env)}/account/> and claim your free key.`,
        "2. Press **Verify** below.",
        "",
        `The bot checks the key on your Discord account, then gives you the **Verified** role and access to <#${verified.id}>.`,
      ].join("\n"),
      allowed_mentions: { parse: [] },
      components: [
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 1,
              label: "Verify",
              custom_id: "lyrica_verify",
            },
          ],
        },
      ],
    }),
  });

  await env.DB.prepare(
    `INSERT OR REPLACE INTO discord_guilds
      (guild_id, verified_role_id, verified_channel_id, verify_channel_id)
     VALUES (?, ?, ?, ?)`,
  )
    .bind(guildId, role.id, verified.id, verify.id)
    .run();

  return [
    "Lyrica verification is set up.",
    `Verified role: <@&${role.id}>`,
    `Private channel: <#${verified.id}>`,
    `Verify channel: <#${verify.id}>`,
    "",
    `Members claim a key at ${origin(env)}/account/, then press Verify in <#${verify.id}>.`,
  ].join("\n");
}

async function discordComponent(
  interaction: DiscordInteraction,
  env: Env,
): Promise<Response> {
  if (interaction.data?.custom_id !== "lyrica_verify") {
    return interactionJson(ephemeral("Unknown button."));
  }

  const guildId = interaction.guild_id;
  const user = interaction.member?.user ?? interaction.user;
  if (!guildId || !user?.id) {
    return interactionJson(ephemeral("Use this button in a server."));
  }

  await ensureDiscordSchema(env);
  const config = await env.DB.prepare(
    `SELECT guild_id, verified_role_id, verified_channel_id, verify_channel_id
     FROM discord_guilds
     WHERE guild_id = ?`,
  )
    .bind(guildId)
    .first<DiscordGuildConfig>();

  if (!config) {
    return interactionJson(
      ephemeral("This server is not set up yet. An admin can run /setup."),
    );
  }

  await ensureSchema(env);
  const license = await env.DB.prepare(
    `SELECT 1 AS found FROM licenses WHERE user_sub = ?`,
  )
    .bind(`discord:${user.id}`)
    .first<{ found: number }>();

  if (!license) {
    return interactionJson(
      ephemeral(
        `No Lyrica key found for this Discord account. Sign in at ${origin(env)}/account/, claim your free key, then press Verify again.`,
      ),
    );
  }

  try {
    await discordApi(
      env,
      `/guilds/${guildId}/members/${user.id}/roles/${config.verified_role_id}`,
      { method: "PUT" },
    );
  } catch (error) {
    console.error(
      "discord role grant failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    return interactionJson(
      ephemeral(
        "Could not assign the Verified role. The bot's role must be above Verified and it needs Manage Roles.",
      ),
    );
  }

  return interactionJson(
    ephemeral(
      `Verified. You now have access to <#${config.verified_channel_id}>.`,
    ),
  );
}

async function discordWidget(env: Env): Promise<Response> {
  const guildId = env.DISCORD_GUILD_ID?.trim() || "1573169716480970872";

  try {
    const response = await fetch(
      `https://discord.com/api/guilds/${encodeURIComponent(guildId)}/widget.json`,
      {
        headers: { Accept: "application/json" },
        cf: { cacheTtl: 300, cacheEverything: true },
      } as RequestInit,
    );

    if (!response.ok) return widgetUnavailable();

    const data = (await response.json()) as {
      name?: string;
      presence_count?: number;
      members?: unknown[];
    };

    if (typeof data.presence_count !== "number") return widgetUnavailable();

    const body = JSON.stringify({
      available: true,
      name: data.name || "Lyrica",
      online: data.presence_count,
      members: Array.isArray(data.members) ? data.members.length : null,
    });

    return new Response(body, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=300, s-maxage=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return widgetUnavailable();
  }
}

function widgetUnavailable(): Response {
  return new Response(JSON.stringify({ available: false }), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=60",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function discordApi<T = unknown>(
  env: Env,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = env.DISCORD_BOT_TOKEN?.trim();
  if (!token) throw new Error("DISCORD_BOT_TOKEN is not configured");

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bot ${token}`);
  if (init.body) headers.set("Content-Type", "application/json");

  const response = await fetch(`${DISCORD_API}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Discord API ${response.status}: ${detail.slice(0, 300)}`,
    );
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function ensureDiscordSchema(env: Env): Promise<unknown> {
  discordSchemaReady ??= env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS discord_guilds (
      guild_id TEXT PRIMARY KEY,
      verified_role_id TEXT NOT NULL,
      verified_channel_id TEXT NOT NULL,
      verify_channel_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  )
    .run()
    .catch((error) => {
      discordSchemaReady = undefined;
      throw error;
    });

  return discordSchemaReady;
}

function interactionJson(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function ephemeral(content: string) {
  return { type: 4, data: { content, flags: 64 } };
}

function fromHex(value: string): Uint8Array {
  const normalized = value.trim();
  if (!/^[0-9a-f]*$/i.test(normalized) || normalized.length % 2 !== 0) {
    return new Uint8Array();
  }

  return Uint8Array.from(
    normalized.match(/../g)?.map((pair) => parseInt(pair, 16)) ?? [],
  );
}

function randomHex(bytes: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";

  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array | null {
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

function redirect(location: string, headers = new Headers()): Response {
  headers.set("Location", location);
  headers.set("Cache-Control", "no-store");
  return new Response(null, { status: 303, headers });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function text(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
