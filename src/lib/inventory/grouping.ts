// Agrupamento partilhado de InventoryItem — usado em /inventory e
// /inventory/movements para que os dois ecrãs mostrem os mesmos grupos.

export type InventoryItemLite = { name: string; family: string };

export function groupOf(i: InventoryItemLite): string {
  if (i.family === "Grip Socks") return i.name.includes("(Kids)") ? "Grip Socks Criança" : "Grip Socks";
  if (i.family === "Sock Sleeves") return i.name.includes("(Kids)") ? "Sock Sleeves Criança" : "Sock Sleeves";
  return i.family;
}

export const GROUP_ORDER = [
  "Built-In Shin Pads",
  "Grip Socks",
  "Grip Socks Criança",
  "Sock Sleeves",
  "Sock Sleeves Criança",
  "Mini Shin Pads",
  "Airflow",
  "Outros",
];

const FAMILY_PREFIX: Record<string, string> = {
  "Built-In Shin Pads": "Built-In Shin Pad ",
  "Mini Shin Pads": "Mini Shin Pad ",
  "Airflow": "Airflow ",
  "Grip Socks": "Grip Sock ",
  "Sock Sleeves": "Sock Sleeve ",
};

export function shortName(i: InventoryItemLite): string {
  let n = i.name;
  const pre = FAMILY_PREFIX[i.family];
  if (pre && n.startsWith(pre)) n = n.slice(pre.length);
  n = n.replace(/\s*\((Adulto|Kids)\)\s*$/, "").trim();
  return n || i.name;
}
