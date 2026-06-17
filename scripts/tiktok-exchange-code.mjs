import { readFileSync, writeFileSync } from "node:fs";

const code = process.argv[2];
if (!code) {
  console.error("Uso: node scripts/tiktok-exchange-code.mjs <code>");
  process.exit(1);
}

const envPath = new URL("../.env", import.meta.url);
const envText = readFileSync(envPath, "utf8");
function getVar(name) {
  const m = envText.match(new RegExp(`^${name}=(.*)$`, "m"));
  return m ? m[1].trim() : "";
}

const CLIENT_KEY = getVar("TIKTOK_CLIENT_KEY");
const CLIENT_SECRET = getVar("TIKTOK_CLIENT_SECRET");
const REDIRECT_URI = "https://dash.1of1futbol.com/api/auth/tiktok/callback";
const codeVerifier = readFileSync(new URL("./.tiktok-code-verifier", import.meta.url), "utf8").trim();

const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-cache" },
  body: new URLSearchParams({
    client_key: CLIENT_KEY,
    client_secret: CLIENT_SECRET,
    code,
    grant_type: "authorization_code",
    redirect_uri: REDIRECT_URI,
    code_verifier: codeVerifier,
  }),
});
const data = await res.json();

if (data.error) {
  console.error("Erro:", data);
  process.exit(1);
}

console.log("\n--- Tokens obtidos ---");
console.log(data);

const updated = envText
  .replace(/^TIKTOK_ACCESS_TOKEN=.*$/m, `TIKTOK_ACCESS_TOKEN=${data.access_token}`)
  .replace(/^TIKTOK_REFRESH_TOKEN=.*$/m, `TIKTOK_REFRESH_TOKEN=${data.refresh_token}`)
  .replace(/^TIKTOK_OPEN_ID=.*$/m, `TIKTOK_OPEN_ID=${data.open_id}`);
writeFileSync(envPath, updated);
console.log("\n.env atualizado.\n");
