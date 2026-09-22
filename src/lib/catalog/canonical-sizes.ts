// Alguns produtos existem duplicados no Shopify (criados em separado para
// Adulto/Criança ou para bundles) mas representam o mesmo item físico em
// tamanhos diferentes. Esta função normaliza esses produtos/variantes para
// um único produto + tamanho canónico, para que dashboards que agrupam por
// produto (ex: Movimentos de Inventário) não os mostrem como itens distintos.
//
// Confirmado com o dono do negócio (Set 2026):
// - Meias Antiderrapantes: só existem 2 tamanhos reais — EU 36-40 (Criança) e
//   EU 40-48 (Adulto) — independentemente de em qual dos 3 produtos Shopify
//   duplicados (grip-socks / pro-grip-socks / kids-pro-grip-socks) a variante
//   está listada.
// - Caneleiras Embutidas: só existem 4 tamanhos reais — S/M/L/XL — que cruzam
//   as linhas Adulto e Criança:
//     S  = Criança MINI/Pequeno
//     M  = Criança MIDI/Médio  = Adulto MINI/Pequeno (mesmo tamanho físico)
//     L  = Adulto MIDI/Médio
//     XL = Adulto MAXI/Grande
//   Criança MAXI/Grande não existe como tamanho real (stock sempre 0).

export type CanonicalVariant = {
  productKey: string;
  productLabel: string;
  variantKey: string;
  variantLabel: string;
};

const MEIAS_HANDLES = new Set(["grip-socks", "pro-grip-socks", "kids-pro-grip-socks"]);
const CANELEIRAS_SIMPLE_HANDLES = new Set(["shin-pad-sleeve", "kids-built-in-shin-pads"]);
const CANELEIRAS_PACKPRO_HANDLES = new Set([
  "pre-szn-bundle-shin-pad-sleeve",
  "pro-package-kids-built-in-shin-pads",
]);

const COLORS = ["Branco", "Preto", "Azul", "Vermelho", "Verde", "Amarelo"];

function normalizeColor(title: string): string | null {
  return COLORS.find((c) => title.includes(c)) ?? null;
}

function meiasSize(title: string): string | null {
  if (/EU\s*36-40/i.test(title)) return "EU 36-40";
  if (/EU\s*40-48/i.test(title)) return "EU 40-48";
  return null;
}

function caneleirasSize(title: string): "S" | "M" | "L" | "XL" | null {
  const isCrianca = /Crian[çc]a/i.test(title);
  const isAdulto = /Adulto/i.test(title);
  const hasMini = /\bMINI\b/i.test(title) || /Pequeno/i.test(title);
  const hasMidi = /\bMIDI\b/i.test(title) || /M[ée]dio/i.test(title);
  const hasMaxi = /\bMAXI\b/i.test(title) || /Grande/i.test(title);

  if (isCrianca) {
    if (hasMini) return "S";
    if (hasMidi) return "M";
    return null; // Criança MAXI/Grande — tamanho descontinuado, não canonizar
  }
  if (isAdulto) {
    if (hasMini) return "M";
    if (hasMidi) return "L";
    if (hasMaxi) return "XL";
    return null;
  }
  // Produtos "duplicados" só de criança onde o título já não repete "Criança"
  // (ex: variantes tipo "MINI / Branco" no produto "Caneleiras Embutidas - Criança")
  if (hasMini) return "S";
  if (hasMidi) return "M";
  return null;
}

export function canonicalizeVariant(
  productHandle: string | null,
  variantTitle: string,
): CanonicalVariant | null {
  if (productHandle && MEIAS_HANDLES.has(productHandle)) {
    const size = meiasSize(variantTitle);
    if (!size) return null;
    const color = normalizeColor(variantTitle);
    return {
      productKey: "meias-antiderrapantes",
      productLabel: "Meias Antiderrapantes",
      variantKey: `${color ?? "?"}-${size}`,
      variantLabel: color ? `${color} / ${size}` : size,
    };
  }

  if (productHandle && (CANELEIRAS_SIMPLE_HANDLES.has(productHandle) || CANELEIRAS_PACKPRO_HANDLES.has(productHandle))) {
    const size = caneleirasSize(variantTitle);
    if (!size) return null;
    const color = normalizeColor(variantTitle);
    const isPackPro = CANELEIRAS_PACKPRO_HANDLES.has(productHandle);
    return {
      productKey: isPackPro ? "caneleiras-embutidas-pack-pro" : "caneleiras-embutidas",
      productLabel: isPackPro ? "Pack Pro - Caneleiras Embutidas" : "Caneleiras Embutidas",
      variantKey: `${color ?? "?"}-${size}`,
      variantLabel: color ? `${color} / ${size}` : size,
    };
  }

  return null;
}
