import { readFileSync } from "node:fs";

const path = "C:/Users/Tom/Downloads/Pagamentos Emitidos.csv";
const raw = readFileSync(path, "utf8");
const buf = readFileSync(path);
console.log("Bytes:", buf.length, "| BOM:", buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf ? "yes" : "no");

const lines = raw.split(/\r?\n/);
console.log("Total lines:", lines.length);
for (let i = 0; i < Math.min(5, lines.length); i++) {
  console.log(`L${i}:`, JSON.stringify(lines[i]));
}
// Guess separator
const first = lines[0] ?? "";
const sep = first.split(";").length > first.split(",").length ? ";" : ",";
console.log("Probable separator:", sep);
console.log("Columns:", first.split(sep));
