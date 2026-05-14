"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { uploadEupagoPayoutsAction } from "./actions";

export function EupagoUpload() {
  const [pending, start] = useTransition();
  const [file, setFile] = useState<File | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return toast.error("Seleciona um ficheiro CSV");
    const fd = new FormData();
    fd.append("file", file);
    start(async () => {
      try {
        const res = await uploadEupagoPayoutsAction(fd);
        toast.success(`Importados ${res.upserted} payouts da Eupago`);
        setFile(null);
        const input = document.getElementById("eupago-file") as HTMLInputElement | null;
        if (input) input.value = "";
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro a importar");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <p className="text-sm font-medium">Eupago · Pagamentos Emitidos (CSV)</p>
        <p className="text-xs text-muted-foreground">
          Exporta no backoffice da Eupago e faz upload aqui. O ficheiro é deduplicado pelo "Nome Ficheiro" SEPA, por isso podes reenviar à vontade.
        </p>
      </div>
      <div className="flex gap-2 items-center">
        <Input
          id="eupago-file"
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="max-w-sm"
        />
        <Button type="submit" disabled={pending || !file}>
          {pending ? "A importar..." : "Importar"}
        </Button>
      </div>
    </form>
  );
}
