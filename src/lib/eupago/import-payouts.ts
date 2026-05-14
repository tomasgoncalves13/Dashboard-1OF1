import { prisma } from "@/lib/prisma";

// Eupago "Pagamentos Emitidos" export columns (semicolon-delimited, quoted, BOM-prefixed):
// Estado;Data;Data de Pagamento;Valor(€);Valor Pago(€);Comissão(€);IVA(€);IBAN;Nome Ficheiro;Período transações
// Dates are MM/DD/YYYY despite being a Portuguese export.

export type PayoutRow = {
  status: string;
  issuedAt: Date;
  paymentDate: Date;
  netAmount: number;
  grossAmount: number;
  commission: number;
  iva: number;
  iban: string;
  fileRef: string;
  periodStart: Date | null;
  periodEnd: Date | null;
};

function stripBom(s: string) {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

/** Split a CSV line with double-quoted fields and `;` separator. */
function splitCsvLine(line: string, sep = ";"): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (c === sep && !inQ) {
      out.push(cur); cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/** "05/11/2026" → Date (MM/DD/YYYY). */
function parseUSDate(s: string): Date {
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) throw new Error(`Bad date: ${s}`);
  const [, mm, dd, yyyy] = m;
  return new Date(Date.UTC(+yyyy, +mm - 1, +dd));
}

/** "04/20/2026, 00:00:00 - 05/10/2026, 23:59:59" → [Date, Date] | null */
function parsePeriod(s: string): { from: Date | null; to: Date | null } {
  const parts = s.split("-").map((p) => p.trim());
  if (parts.length !== 2) return { from: null, to: null };
  const tryParse = (str: string) => {
    const m = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!m) return null;
    return new Date(Date.UTC(+m[3], +m[1] - 1, +m[2]));
  };
  return { from: tryParse(parts[0]), to: tryParse(parts[1]) };
}

export function parseEupagoPayoutsCsv(raw: string): PayoutRow[] {
  const text = stripBom(raw).replace(/\r/g, "");
  const lines = text.split("\n").filter((l) => l.length > 0);
  if (lines.length < 2) return [];

  const header = splitCsvLine(lines[0]).map((h) => h.replace(/^"|"$/g, "").trim());
  const idx = {
    status: header.findIndex((h) => /Estado/i.test(h)),
    issuedAt: header.findIndex((h) => h === "Data" || /^Data$/i.test(h)),
    paymentDate: header.findIndex((h) => /Data\s*de\s*Pagamento/i.test(h)),
    valor: header.findIndex((h) => /^Valor\b/i.test(h) && !/Pago/i.test(h)),
    valorPago: header.findIndex((h) => /Valor\s*Pago/i.test(h)),
    commission: header.findIndex((h) => /Comiss/i.test(h)),
    iva: header.findIndex((h) => /IVA/i.test(h)),
    iban: header.findIndex((h) => /IBAN/i.test(h)),
    fileRef: header.findIndex((h) => /Nome\s*Ficheiro/i.test(h)),
    period: header.findIndex((h) => /Per.odo/i.test(h)),
  };
  const missing = Object.entries(idx).filter(([, v]) => v < 0);
  if (missing.length > 0) throw new Error(`CSV missing columns: ${missing.map((m) => m[0]).join(", ")}`);

  const rows: PayoutRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const f = splitCsvLine(lines[i]).map((s) => s.replace(/^"|"$/g, ""));
    if (f.length < header.length) continue;
    const period = parsePeriod(f[idx.period]);
    rows.push({
      status: f[idx.status],
      issuedAt: parseUSDate(f[idx.issuedAt]),
      paymentDate: parseUSDate(f[idx.paymentDate]),
      netAmount: parseFloat(f[idx.valor]) || 0,
      grossAmount: parseFloat(f[idx.valorPago]) || 0,
      commission: parseFloat(f[idx.commission]) || 0,
      iva: parseFloat(f[idx.iva]) || 0,
      iban: f[idx.iban],
      fileRef: f[idx.fileRef],
      periodStart: period.from,
      periodEnd: period.to,
    });
  }
  return rows;
}

export async function importEupagoPayouts(storeId: string, raw: string) {
  const rows = parseEupagoPayoutsCsv(raw);
  let upserted = 0;
  for (const r of rows) {
    await prisma.eupagoPayout.upsert({
      where: { storeId_fileRef: { storeId, fileRef: r.fileRef } },
      update: {
        status: r.status,
        issuedAt: r.issuedAt,
        paymentDate: r.paymentDate,
        netAmount: r.netAmount.toFixed(2),
        grossAmount: r.grossAmount.toFixed(2),
        commission: r.commission.toFixed(2),
        iva: r.iva.toFixed(2),
        iban: r.iban || null,
        periodStart: r.periodStart,
        periodEnd: r.periodEnd,
        source: "CSV",
      },
      create: {
        storeId,
        fileRef: r.fileRef,
        status: r.status,
        issuedAt: r.issuedAt,
        paymentDate: r.paymentDate,
        netAmount: r.netAmount.toFixed(2),
        grossAmount: r.grossAmount.toFixed(2),
        commission: r.commission.toFixed(2),
        iva: r.iva.toFixed(2),
        iban: r.iban || null,
        periodStart: r.periodStart,
        periodEnd: r.periodEnd,
        source: "CSV",
      },
    });
    upserted++;
  }
  return { upserted, rows: rows.length };
}
