// Simulador do Plano Q4 (cenários, inventário por variante, opções de envio).
// O HTML vem de /api/plano-q4 com stock e vendas atuais da base de dados.
export default function PlanoQ4Page() {
  return (
    <iframe
      src="/api/plano-q4"
      title="Plano Q4"
      className="w-full rounded-md border"
      style={{ height: "calc(100vh - 6rem)" }}
    />
  );
}
