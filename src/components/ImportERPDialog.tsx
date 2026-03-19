import { useState, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";

interface ImportRow {
  proveedor: string;
  factura: string;
  motivo: string;
  fecha_emision: string;
  fecha_vencimiento: string;
  saldo: number;
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

interface ImportResult {
  inserted: number;
  duplicates: number;
  errors: ValidationError[];
  manualReview: { row: number; proveedor: string }[];
}

type Step = "upload" | "preview" | "importing" | "result";

const COLUMN_MAP: Record<string, keyof ImportRow> = {
  proveedor: "proveedor",
  razon_social: "proveedor",
  razón_social: "proveedor",
  supplier: "proveedor",
  factura: "factura",
  numero_factura: "factura",
  invoice: "factura",
  motivo: "motivo",
  descripcion: "motivo",
  description: "motivo",
  concepto: "motivo",
  fecha_emision: "fecha_emision",
  emision: "fecha_emision",
  emission_date: "fecha_emision",
  fecha_vencimiento: "fecha_vencimiento",
  vencimiento: "fecha_vencimiento",
  due_date: "fecha_vencimiento",
  saldo: "saldo",
  saldo_total: "saldo",
  monto: "saldo",
  amount: "saldo",
  total: "saldo",
};

function normalizeColumnName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, "_").replace(/[áà]/g, "a").replace(/[éè]/g, "e").replace(/[íì]/g, "i").replace(/[óò]/g, "o").replace(/[úù]/g, "u");
}

function parseDate(val: any): string | null {
  if (!val) return null;
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, "0");
    const d = String(val.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = String(val).trim();
  // Try YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // Try DD/MM/YYYY or DD-MM-YYYY
  const m1 = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m1) return `${m1[3]}-${m1[2].padStart(2, "0")}-${m1[1].padStart(2, "0")}`;
  // Try MM/DD/YYYY
  const m2 = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m2) {
    const parsed = new Date(s);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split("T")[0];
    }
  }
  // Try Excel serial number
  if (/^\d{5}$/.test(s)) {
    const d = new Date((parseInt(s) - 25569) * 86400000);
    if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  }
  return null;
}

function isValidDate(dateStr: string): boolean {
  const d = new Date(dateStr + "T00:00:00");
  return !isNaN(d.getTime()) && d.getFullYear() > 2000;
}

export default function ImportERPDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [fileName, setFileName] = useState("");

  const reset = useCallback(() => {
    setStep("upload");
    setRows([]);
    setProgress(0);
    setResult(null);
    setFileName("");
    if (fileRef.current) fileRef.current.value = "";
  }, []);

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

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

        if (raw.length === 0) {
          toast.error("El archivo está vacío");
          return;
        }

        // Map columns
        const headers = Object.keys(raw[0]);
        const colMapping: Record<string, keyof ImportRow> = {};
        for (const h of headers) {
          const norm = normalizeColumnName(h);
          if (COLUMN_MAP[norm]) colMapping[h] = COLUMN_MAP[norm];
        }

        const mapped: ImportRow[] = raw.map((r) => {
          const row: any = { proveedor: "", factura: "", motivo: "", fecha_emision: "", fecha_vencimiento: "", saldo: 0 };
          for (const [orig, target] of Object.entries(colMapping)) {
            row[target] = r[orig];
          }
          row.fecha_emision = parseDate(row.fecha_emision) || String(row.fecha_emision);
          row.fecha_vencimiento = parseDate(row.fecha_vencimiento) || String(row.fecha_vencimiento);
          row.saldo = parseFloat(String(row.saldo).replace(/[,$]/g, "")) || 0;
          row.proveedor = String(row.proveedor).trim();
          row.factura = String(row.factura).trim();
          row.motivo = String(row.motivo).trim();
          return row;
        });

        setRows(mapped);
        setStep("preview");
      } catch {
        toast.error("Error al leer el archivo");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImport = async () => {
    setStep("importing");
    setProgress(0);

    const errors: ValidationError[] = [];
    const manualReview: { row: number; proveedor: string }[] = [];
    const validRows: any[] = [];

    // Fetch existing proveedores and facturas
    const [provRes, factRes] = await Promise.all([
      supabase.from("proveedores").select("codigo, razon_social"),
      supabase.from("facturas").select("numero_factura, codigo_proveedor"),
    ]);
    const proveedores = provRes.data || [];
    const existingFacturas = new Set((factRes.data || []).map((f) => `${f.numero_factura}|${f.codigo_proveedor}`));

    const provByName = new Map<string, { codigo: string; razon_social: string }>();
    for (const p of proveedores) {
      provByName.set(p.razon_social.toLowerCase(), p);
    }

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rowNum = i + 2; // Excel row (header=1)
      let hasError = false;

      // Validate required fields
      if (!r.proveedor) { errors.push({ row: rowNum, field: "proveedor", message: "Proveedor vacío" }); hasError = true; }
      if (!r.factura) { errors.push({ row: rowNum, field: "factura", message: "Factura vacía" }); hasError = true; }
      if (!r.fecha_emision || !isValidDate(r.fecha_emision)) { errors.push({ row: rowNum, field: "fecha_emision", message: "Fecha emisión inválida" }); hasError = true; }
      if (!r.fecha_vencimiento || !isValidDate(r.fecha_vencimiento)) { errors.push({ row: rowNum, field: "fecha_vencimiento", message: "Fecha vencimiento inválida" }); hasError = true; }
      if (isNaN(r.saldo) || r.saldo <= 0) { errors.push({ row: rowNum, field: "saldo", message: "Saldo inválido" }); hasError = true; }

      if (hasError) { setProgress(((i + 1) / rows.length) * 100); continue; }

      // Check proveedor exists
      const prov = provByName.get(r.proveedor.toLowerCase());
      if (!prov) {
        manualReview.push({ row: rowNum, proveedor: r.proveedor });
        setProgress(((i + 1) / rows.length) * 100);
        continue;
      }

      // Check duplicate
      const key = `${r.factura}|${prov.codigo}`;
      if (existingFacturas.has(key)) {
        errors.push({ row: rowNum, field: "factura", message: `Factura duplicada: ${r.factura}` });
        setProgress(((i + 1) / rows.length) * 100);
        continue;
      }

      existingFacturas.add(key);
      validRows.push({
        numero_factura: r.factura,
        razon_social: prov.razon_social,
        codigo_proveedor: prov.codigo,
        motivo: r.motivo,
        fecha_emision: r.fecha_emision,
        fecha_vencimiento: r.fecha_vencimiento,
        saldo_total: r.saldo,
        observaciones: `Importado por ${user?.email || "sistema"} el ${new Date().toLocaleString("es-EC")}`,
      });

      setProgress(((i + 1) / rows.length) * 100);
    }

    // Insert in batches of 50
    let inserted = 0;
    const batchSize = 50;
    for (let i = 0; i < validRows.length; i += batchSize) {
      const batch = validRows.slice(i, i + batchSize);
      const { error } = await supabase.from("facturas").insert(batch);
      if (error) {
        errors.push({ row: 0, field: "db", message: `Error BD: ${error.message}` });
      } else {
        inserted += batch.length;
      }
      setProgress(50 + ((i + batchSize) / validRows.length) * 50);
    }

    setProgress(100);
    setResult({ inserted, duplicates: errors.filter((e) => e.message.includes("duplicada")).length, errors, manualReview });
    setStep("result");
    if (inserted > 0) queryClient.invalidateQueries({ queryKey: ["facturas"] });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet size={20} className="text-primary" />
            Importar desde ERP
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-8 w-full text-center hover:border-primary/50 transition-colors cursor-pointer" onClick={() => fileRef.current?.click()}>
              <Upload size={40} className="mx-auto text-muted-foreground mb-3" />
              <p className="text-sm font-medium">Arrastra o haz clic para subir</p>
              <p className="text-xs text-muted-foreground mt-1">CSV o Excel (.xlsx)</p>
            </div>
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFile} />
            <div className="text-xs text-muted-foreground space-y-1 w-full">
              <p className="font-medium">Columnas esperadas:</p>
              <p>proveedor, factura, motivo, fecha_emision, fecha_vencimiento, saldo</p>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="flex flex-col gap-3 min-h-0">
            <div className="flex items-center justify-between">
              <p className="text-sm"><span className="font-medium">{fileName}</span> — {rows.length} registros</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={reset}>Cancelar</Button>
                <Button size="sm" onClick={handleImport}>Importar {rows.length} registros</Button>
              </div>
            </div>
            <ScrollArea className="flex-1 max-h-[400px] rounded border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2 text-left">#</th>
                    <th className="px-3 py-2 text-left">Proveedor</th>
                    <th className="px-3 py-2 text-left">Factura</th>
                    <th className="px-3 py-2 text-left">Motivo</th>
                    <th className="px-3 py-2 text-left">Emisión</th>
                    <th className="px-3 py-2 text-left">Vencimiento</th>
                    <th className="px-3 py-2 text-right">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 100).map((r, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-3 py-1.5 text-muted-foreground">{i + 1}</td>
                      <td className="px-3 py-1.5 max-w-[150px] truncate">{r.proveedor}</td>
                      <td className="px-3 py-1.5">{r.factura}</td>
                      <td className="px-3 py-1.5 max-w-[120px] truncate">{r.motivo}</td>
                      <td className="px-3 py-1.5">{r.fecha_emision}</td>
                      <td className="px-3 py-1.5">{r.fecha_vencimiento}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">${r.saldo.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 100 && <p className="text-xs text-muted-foreground text-center py-2">Mostrando 100 de {rows.length} registros</p>}
            </ScrollArea>
          </div>
        )}

        {step === "importing" && (
          <div className="flex flex-col items-center gap-4 py-12">
            <FileSpreadsheet size={40} className="text-primary animate-pulse" />
            <p className="text-sm font-medium">Importando registros…</p>
            <Progress value={progress} className="w-full max-w-md" />
            <p className="text-xs text-muted-foreground">{Math.round(progress)}%</p>
          </div>
        )}

        {step === "result" && result && (
          <div className="flex flex-col gap-4 min-h-0">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-3 text-center">
                <CheckCircle2 size={20} className="mx-auto text-green-600 mb-1" />
                <p className="text-lg font-bold text-green-700">{result.inserted}</p>
                <p className="text-xs text-green-600">Importados</p>
              </div>
              <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-3 text-center">
                <AlertTriangle size={20} className="mx-auto text-yellow-600 mb-1" />
                <p className="text-lg font-bold text-yellow-700">{result.manualReview.length}</p>
                <p className="text-xs text-yellow-600">Revisión manual</p>
              </div>
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-center">
                <XCircle size={20} className="mx-auto text-red-600 mb-1" />
                <p className="text-lg font-bold text-red-700">{result.errors.length}</p>
                <p className="text-xs text-red-600">Errores</p>
              </div>
            </div>

            {result.manualReview.length > 0 && (
              <div>
                <p className="text-xs font-medium text-yellow-700 mb-1">Proveedores no encontrados (revisión manual):</p>
                <ScrollArea className="max-h-[120px] rounded border border-yellow-500/20 bg-yellow-50/50">
                  <div className="p-2 space-y-1">
                    {result.manualReview.map((r, i) => (
                      <p key={i} className="text-xs">Fila {r.row}: <span className="font-medium">{r.proveedor}</span></p>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {result.errors.length > 0 && (
              <div>
                <p className="text-xs font-medium text-red-700 mb-1">Detalle de errores:</p>
                <ScrollArea className="max-h-[150px] rounded border border-red-500/20 bg-red-50/50">
                  <div className="p-2 space-y-1">
                    {result.errors.map((e, i) => (
                      <p key={i} className="text-xs">Fila {e.row}: <span className="font-medium">{e.message}</span> ({e.field})</p>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            <Button className="w-full" onClick={() => handleClose(false)}>Cerrar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
