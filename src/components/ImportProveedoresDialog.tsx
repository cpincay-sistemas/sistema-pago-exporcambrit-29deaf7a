import { useState, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, FileSpreadsheet, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

interface ProvRow {
  razon_social: string;
  ruc_ci: string;
  banco: string;
  numero_cuenta: string;
  tipo_cuenta: string;
  email_cobros: string;
  codigo: string;
}

type Step = "upload" | "preview" | "importing" | "result";

const COL_MAP: Record<string, keyof ProvRow> = {
  razon_social: "razon_social",
  proveedor: "razon_social",
  nombre: "razon_social",
  ruc: "ruc_ci",
  ruc_ci: "ruc_ci",
  ci: "ruc_ci",
  banco: "banco",
  cuenta: "numero_cuenta",
  numero_cuenta: "numero_cuenta",
  nro_cuenta: "numero_cuenta",
  tipo: "tipo_cuenta",
  tipo_cuenta: "tipo_cuenta",
  email: "email_cobros",
  email_cobros: "email_cobros",
  correo: "email_cobros",
  codigo: "codigo",
  codigo_proveedor: "codigo",
};

function norm(name: string): string {
  return name.toLowerCase().trim()
    .replace(/[áà]/g, "a").replace(/[éè]/g, "e").replace(/[íì]/g, "i").replace(/[óò]/g, "o").replace(/[úù]/g, "u")
    .replace(/[°º]/g, "").replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
}

export default function ImportProveedoresDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [rows, setRows] = useState<ProvRow[]>([]);
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState("");
  const [resultMsg, setResultMsg] = useState<{ created: number; updated: number; skipped: number } | null>(null);

  const reset = useCallback(() => {
    setStep("upload"); setRows([]); setProgress(0); setFileName(""); setResultMsg(null);
    if (fileRef.current) fileRef.current.value = "";
  }, []);

  const handleClose = (v: boolean) => { if (!v) reset(); onOpenChange(v); };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: "array", cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
        if (raw.length === 0) { toast.error("Archivo vacío"); return; }

        const headers = Object.keys(raw[0]);
        const colMapping: Record<string, keyof ProvRow> = {};
        for (const h of headers) {
          const n = norm(h);
          if (COL_MAP[n]) colMapping[h] = COL_MAP[n];
        }

        const mapped: ProvRow[] = raw.map((r) => {
          const row: any = { razon_social: "", ruc_ci: "", banco: "", numero_cuenta: "", tipo_cuenta: "CORRIENTE", email_cobros: "", codigo: "" };
          for (const [orig, target] of Object.entries(colMapping)) {
            row[target] = String(r[orig] || "").trim();
          }
          // F1: Split CODIGO|RUC
          if (row.codigo && row.codigo.includes("|")) {
            const parts = row.codigo.split("|");
            row.codigo = parts[0].trim();
            if (!row.ruc_ci) row.ruc_ci = parts[1]?.trim() || "";
          }
          if (!row.tipo_cuenta || !["CORRIENTE", "AHORROS"].includes(row.tipo_cuenta.toUpperCase())) {
            row.tipo_cuenta = "CORRIENTE";
          } else {
            row.tipo_cuenta = row.tipo_cuenta.toUpperCase();
          }
          return row;
        }).filter((r) => r.razon_social);

        if (mapped.length === 0) { toast.error("No se encontraron filas con RAZON SOCIAL"); return; }
        setRows(mapped);
        setStep("preview");
      } catch { toast.error("Error al leer archivo"); }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImport = async () => {
    setStep("importing");
    setProgress(0);

    const { data: existing } = await supabase.from("proveedores").select("id, codigo, razon_social, ruc_ci");
    const existingList = existing || [];
    const byRuc = new Map(existingList.filter((p) => p.ruc_ci).map((p) => [p.ruc_ci.toLowerCase(), p]));
    const byName = new Map(existingList.map((p) => [p.razon_social.toLowerCase(), p]));

    let created = 0, updated = 0, skipped = 0;
    let autoCode = existingList.length;

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const match = (r.ruc_ci ? byRuc.get(r.ruc_ci.toLowerCase()) : null) || byName.get(r.razon_social.toLowerCase());

      if (match) {
        // Update
        const updateData: any = {};
        if (r.banco) updateData.banco = r.banco;
        if (r.numero_cuenta) updateData.numero_cuenta = r.numero_cuenta;
        if (r.tipo_cuenta) updateData.tipo_cuenta = r.tipo_cuenta;
        if (r.email_cobros) updateData.email_cobros = r.email_cobros;
        if (r.ruc_ci && r.ruc_ci !== "0000000000001") updateData.ruc_ci = r.ruc_ci;
        if (Object.keys(updateData).length > 0) {
          await supabase.from("proveedores").update(updateData).eq("id", match.id);
          updated++;
        } else {
          skipped++;
        }
      } else {
        // Create
        autoCode++;
        const codigo = r.codigo || `PROV-${String(autoCode).padStart(3, "0")}`;
        const { error } = await supabase.from("proveedores").insert({
          codigo,
          razon_social: r.razon_social,
          ruc_ci: r.ruc_ci || "0000000000001",
          banco: r.banco,
          numero_cuenta: r.numero_cuenta,
          tipo_cuenta: r.tipo_cuenta as "CORRIENTE" | "AHORROS",
          email_cobros: r.email_cobros,
          activo: true,
        });
        if (!error) created++;
        else skipped++;
      }
      setProgress(((i + 1) / rows.length) * 100);
    }

    setProgress(100);
    setResultMsg({ created, updated, skipped });
    setStep("result");
    if (created > 0 || updated > 0) queryClient.invalidateQueries({ queryKey: ["proveedores"] });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet size={20} className="text-primary" />
            Importar Proveedores
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-8 w-full text-center hover:border-primary/50 transition-colors cursor-pointer" onClick={() => fileRef.current?.click()}>
              <Upload size={40} className="mx-auto text-muted-foreground mb-3" />
              <p className="text-sm font-medium">Subir archivo CSV o Excel</p>
            </div>
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFile} />
            <p className="text-xs text-muted-foreground">Columnas: RAZON SOCIAL, RUC, BANCO, CUENTA, TIPO, EMAIL, CODIGO</p>
          </div>
        )}

        {step === "preview" && (
          <div className="flex flex-col gap-3 min-h-0">
            <div className="flex items-center justify-between">
              <p className="text-sm"><span className="font-medium">{fileName}</span> — {rows.length} proveedores</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={reset}>Cancelar</Button>
                <Button size="sm" onClick={handleImport}>Importar</Button>
              </div>
            </div>
            <ScrollArea className="flex-1 max-h-[300px] rounded border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2 text-left">Razón Social</th>
                    <th className="px-3 py-2 text-left">RUC</th>
                    <th className="px-3 py-2 text-left">Banco</th>
                    <th className="px-3 py-2 text-left">Cuenta</th>
                    <th className="px-3 py-2 text-left">Tipo</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 5).map((r, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="px-3 py-1.5">{r.razon_social}</td>
                      <td className="px-3 py-1.5">{r.ruc_ci || "—"}</td>
                      <td className="px-3 py-1.5">{r.banco || "—"}</td>
                      <td className="px-3 py-1.5">{r.numero_cuenta || "—"}</td>
                      <td className="px-3 py-1.5">{r.tipo_cuenta}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 5 && <p className="text-xs text-muted-foreground text-center py-2">y {rows.length - 5} más…</p>}
            </ScrollArea>
          </div>
        )}

        {step === "importing" && (
          <div className="flex flex-col items-center gap-4 py-12">
            <FileSpreadsheet size={40} className="text-primary animate-pulse" />
            <p className="text-sm font-medium">Procesando proveedores…</p>
            <Progress value={progress} className="w-full max-w-md" />
            <p className="text-xs text-muted-foreground">{Math.round(progress)}%</p>
          </div>
        )}

        {step === "result" && resultMsg && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-3 text-center">
                <CheckCircle2 size={20} className="mx-auto text-green-600 mb-1" />
                <p className="text-lg font-bold text-green-700">{resultMsg.created}</p>
                <p className="text-xs text-green-600">Creados</p>
              </div>
              <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3 text-center">
                <CheckCircle2 size={20} className="mx-auto text-blue-600 mb-1" />
                <p className="text-lg font-bold text-blue-700">{resultMsg.updated}</p>
                <p className="text-xs text-blue-600">Actualizados</p>
              </div>
              <div className="rounded-lg bg-muted border p-3 text-center">
                <XCircle size={20} className="mx-auto text-muted-foreground mb-1" />
                <p className="text-lg font-bold">{resultMsg.skipped}</p>
                <p className="text-xs text-muted-foreground">Sin cambios</p>
              </div>
            </div>
            <Button className="w-full" onClick={() => handleClose(false)}>Cerrar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
