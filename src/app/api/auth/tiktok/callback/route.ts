import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  if (error) {
    return new Response(`<h2>Erro: ${error}</h2><p>${req.nextUrl.searchParams.get("error_description") ?? ""}</p>`, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  return new Response(
    `<html><body style="font-family:sans-serif;padding:40px;max-width:600px;margin:0 auto">
      <h2>Autorizado!</h2>
      <p>Copia este código e cola de volta no terminal:</p>
      <textarea readonly style="width:100%;height:80px;font-size:14px;padding:8px">${code ?? ""}</textarea>
    </body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}
