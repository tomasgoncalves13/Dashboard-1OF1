// Eupago Management API client. OAuth client_credentials → Bearer.

const BASE = process.env.EUPAGO_API_BASE ?? "https://clientes.eupago.pt";

type TokenResp = { transactionStatus: string; access_token: string; token_type: string; expires_in: number };

let cached: { token: string; expiresAt: number } | null = null;

export async function getEupagoToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 30_000) return cached.token;

  const client_id = process.env.EUPAGO_CLIENT_ID;
  const client_secret = process.env.EUPAGO_CLIENT_SECRET;
  if (!client_id || !client_secret) throw new Error("EUPAGO_CLIENT_ID / EUPAGO_CLIENT_SECRET not set");

  const res = await fetch(`${BASE}/api/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id, client_secret, grant_type: "client_credentials" }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Eupago auth failed: ${res.status} ${await res.text()}`);
  const json: TokenResp = await res.json();
  if (!json.access_token) throw new Error(`Eupago auth returned no token: ${JSON.stringify(json)}`);

  cached = { token: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return cached.token;
}

export type EupagoTransaction = {
  trid: string;
  entity?: string;
  reference?: string;
  amount: number;
  identifier?: string;
  datePayment: string;
  dateTransfer?: string;
  bookingDate?: string;
  status: string;
  local?: string;
  commission?: number;
  commissionIva?: number;
  totalCommission?: number;
  channelId?: string;
  channelName?: string;
  paymentMethod?: string;
};

/** List transactions by status. Eupago caps the window at the last ~3 months. */
export async function listEupagoTransactions(status: "paga" | "transferida" = "paga"): Promise<EupagoTransaction[]> {
  const token = await getEupagoToken();
  const url = `${BASE}/api/management/v1.02/transactions?status=${status}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Eupago list failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.transactionList ?? [];
}

/** Best-effort method inference. Eupago doesn't always set `paymentMethod`. */
export function inferMethod(t: EupagoTransaction): string {
  if (t.paymentMethod) return t.paymentMethod.toUpperCase();
  // Multibanco references are 9 digits with entity (e.g. 10045, 10076, 21964)
  if (t.entity && t.reference) return "MULTIBANCO";
  return "UNKNOWN";
}
