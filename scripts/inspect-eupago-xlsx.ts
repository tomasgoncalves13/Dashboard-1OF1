import * as XLSX from "xlsx";

const path = "C:/Users/Tom/Downloads/Plataforma Eupago.xlsx";
const wb = XLSX.readFile(path);
console.log("Sheets:", wb.SheetNames);
for (const name of wb.SheetNames) {
  const ws = wb.Sheets[name];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });
  console.log("=== Sheet:", name, "| rows:", rows.length);
  console.log("Header:", JSON.stringify(rows[0]));
  console.log("Row 1 :", JSON.stringify(rows[1]));
  console.log("Row 2 :", JSON.stringify(rows[2]));
  console.log("Row 3 :", JSON.stringify(rows[3]));
}
