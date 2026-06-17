import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import crypto from "node:crypto";

const envPath = new URL("../.env", import.meta.url);
const envText = readFileSync(envPath, "utf8");
function getVar(name) {
  const m = envText.match(new RegExp(`^${name}=(.*)$`, "m"));
  return m ? m[1].trim() : "";
}

const CLIENT_KEY = getVar("TIKTOK_CLIENT_KEY");
const REDIRECT_URI = "https://dash.1of1futbol.com/api/auth/tiktok/callback";
const SCOPES = "user.info.basic,user.info.profile,user.info.stats,video.list,video.upload";

function base64url(buf) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const codeVerifier = base64url(crypto.randomBytes(48));
const codeChallenge = base64url(crypto.createHash("sha256").update(codeVerifier).digest());

writeFileSync(new URL("./.tiktok-code-verifier", import.meta.url), codeVerifier);

const authUrl =
  `https://www.tiktok.com/v2/auth/authorize/?client_key=${CLIENT_KEY}` +
  `&scope=${encodeURIComponent(SCOPES)}` +
  `&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&state=tiktok-setup` +
  `&code_challenge=${codeChallenge}&code_challenge_method=S256`;

console.log("\n" + authUrl + "\n");

try {
  execSync(`powershell -Command "Start-Process '${authUrl}'"`);
} catch {
  console.log("Copia o link acima e abre no browser.");
}
