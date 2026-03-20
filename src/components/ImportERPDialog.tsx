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
  codigo_proveedor: string;
  ruc_ci: string;
  factura: string;
  motivo: string;
  fecha_emision: string;
  fecha_vencimiento: string;
  saldo: number;
  doc_interno: string;
  observaciones: string;
  periodo: string;
  dias_credito: number;
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
  created_providers: string[];
}

type Step = "upload" | "preview" | "importing" | "result";

const COLUMN_MAP: Record<string, keyof ImportRow> = {
  proveedor: "proveedor",
  razon_social: "proveedor",
  supplier: "proveedor",
  proveedor_codigo: "codigo_proveedor",
  codigo_proveedor: "codigo_proveedor",
  codigo: "codigo_proveedor",
  factura: "factura",
  numero_factura: "factura",
  invoice: "factura",
  n_documento: "factura",
  no_documento: "factura",
  numero_documento: "factura",
  documento: "factura",
  motivo: "motivo",
  descripcion: "motivo",
  description: "motivo",
  concepto: "motivo",
  fecha_emision: "fecha_emision",
  fecha_de_emision: "fecha_emision",
  emision: "fecha_emision",
  fecha_vencimiento: "fecha_vencimiento",
  vencimiento: "fecha_vencimiento",
  saldo: "saldo",
  saldo_total: "saldo",
  monto: "saldo",
  amount: "saldo",
  total: "saldo",
  doc_interno: "doc_interno",
  doc__interno: "doc_interno",
  documento_interno: "doc_interno",
  observaciones: "observaciones",
  periodo: "periodo",
  dias_credito: "dias_credito",
};

function normalizeColumnName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[áà]/g, "a")
    .replace(/[éè]/g, "e")
    .replace(/[íì]/g, "i")
    .replace(/[óò]/g, "o")
    .replace(/[úù]/g, "u")
    .replace(/[°º]/g, "")
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function parseLocalizedNumber(val: any): number {
  if (val === null || val === undefined || val === "") return 0;
  if (typeof val === "number") return val;
  let s = String(val).trim().replace(/[$\s]/g, "");
  if (!s) return 0;
  const negative = s.startsWith("-");
  if (negative) s = s.substring(1);
  // Detect format: if both . and , exist, the last one is the decimal separator
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  if (lastDot > -1 && lastComma > -1) {
    if (lastComma > lastDot) {
      // 9.820,80 → remove dots, replace comma with dot
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      // 9,820.80 → remove commas
      s = s.replace(/,/g, "");
    }
  } else if (lastComma > -1) {
    // Could be 9820,80 (decimal) or 9,820 (thousands)
    const afterComma = s.substring(lastComma + 1);
    if (afterComma.length <= 2) {
      s = s.replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  }
  const num = parseFloat(s);
  if (isNaN(num)) return 0;
  return negative ? -num : num;
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
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m1 = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m1) return `${m1[3]}-${m1[2].padStart(2, "0")}-${m1[1].padStart(2, "0")}`;
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

        const headers = Object.keys(raw[0]);
        const colMapping: Record<string, keyof ImportRow> = {};
        for (const h of headers) {
          const norm = normalizeColumnName(h);
          if (COLUMN_MAP[norm]) colMapping[h] = COLUMN_MAP[norm];
        }

        const mapped: ImportRow[] = raw.map((r) => {
          const row: any = { proveedor: "", codigo_proveedor: "", factura: "", motivo: "", fecha_emision: "", fecha_vencimiento: "", saldo: 0, doc_interno: "", observaciones: "", periodo: "", dias_credito: 0 };
          for (const [orig, target] of Object.entries(colMapping)) {
            row[target] = r[orig];
          }
          row.fecha_emision = parseDate(row.fecha_emision) || String(row.fecha_emision);
          row.fecha_vencimiento = parseDate(row.fecha_vencimiento) || String(row.fecha_vencimiento);
          row.saldo = parseLocalizedNumber(row.saldo);
          row.proveedor = String(row.proveedor || "").trim();
          // F1: Split CODIGO|RUC
          let rawCodigo = String(row.codigo_proveedor || "").trim();
          if (rawCodigo.includes("|")) {
            const parts = rawCodigo.split("|");
            row.codigo_proveedor = parts[0].trim();
            row.ruc_ci = parts[1]?.trim() || "";
          } else {
            row.codigo_proveedor = rawCodigo;
            row.ruc_ci = "";
          }
          row.factura = String(row.factura || "").trim();
          row.motivo = String(row.motivo || "").trim();
          row.doc_interno = String(row.doc_interno || "").trim();
          row.observaciones = String(row.observaciones || "").trim();
          row.periodo = String(row.periodo || "").trim();
          row.dias_credito = parseInt(String(row.dias_credito)) || 0;
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
    const createdProviders: string[] = [];
    const validRows: any[] = [];

    const [provRes, factRes] = await Promise.all([
      supabase.from("proveedores").select("codigo, razon_social, ruc_ci"),
      supabase.from("facturas").select("numero_factura, codigo_proveedor"),
    ]);
    const proveedores = provRes.data || [];
    const existingFacturas = new Set((factRes.data || []).map((f) => `${f.codigo_proveedor}|${f.numero_factura}`));

    const provByName = new Map<string, { codigo: string; razon_social: string }>();
    const provByCodigo = new Map<string, { codigo: string; razon_social: string }>();
    for (const p of proveedores) {
      provByName.set(p.razon_social.toLowerCase(), p);
      provByCodigo.set(p.codigo, p);
    }

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rowNum = i + 2;
      let hasError = false;

      if (!r.factura) { errors.push({ row: rowNum, field: "factura", message: "Factura vacía" }); hasError = true; }
      if (!r.fecha_emision || !isValidDate(r.fecha_emision)) { errors.push({ row: rowNum, field: "fecha_emision", message: "Fecha emisión inválida" }); hasError = true; }
      if (!r.fecha_vencimiento || !isValidDate(r.fecha_vencimiento)) { errors.push({ row: rowNum, field: "fecha_vencimiento", message: "Fecha vencimiento inválida" }); hasError = true; }
      // saldo: accept any number including negatives and zero
      if (isNaN(r.saldo)) { errors.push({ row: rowNum, field: "saldo", message: "Saldo inválido" }); hasError = true; }

      if (hasError) { setProgress(((i + 1) / rows.length) * 50); continue; }

      // Look up proveedor: by codigo first, then by razon_social
      let prov = r.codigo_proveedor ? provByCodigo.get(r.codigo_proveedor) : null;
      if (!prov) prov = r.proveedor ? provByName.get(r.proveedor.toLowerCase()) : null;

      // If not found and we have enough info, auto-create
      if (!prov) {
        const codigo = r.codigo_proveedor || `PROV-${String(proveedores.length + createdProviders.length + 1).padStart(3, "0")}`;
        const razon = r.proveedor || codigo;
        if (!razon && !codigo) {
          errors.push({ row: rowNum, field: "proveedor", message: "Proveedor vacío" });
          setProgress(((i + 1) / rows.length) * 50);
          continue;
        }
        const { error: insertErr } = await supabase.from("proveedores").insert({
          codigo,
          razon_social: razon,
          ruc_ci: r.ruc_ci || "0000000000001",
          activo: true,
        });
        if (insertErr) {
          errors.push({ row: rowNum, field: "proveedor", message: `Error creando proveedor: ${insertErr.message}` });
          setProgress(((i + 1) / rows.length) * 50);
          continue;
        }
        prov = { codigo, razon_social: razon };
        provByCodigo.set(codigo, prov);
        provByName.set(razon.toLowerCase(), prov);
        createdProviders.push(razon);
      }

      // Duplicate check: codigo_proveedor + numero_factura
      const key = `${prov.codigo}|${r.factura}`;
      if (existingFacturas.has(key)) {
        errors.push({ row: rowNum, field: "factura", message: `Duplicada: ${prov.codigo} + ${r.factura}` });
        setProgress(((i + 1) / rows.length) * 50);
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
        doc_interno: r.doc_interno || undefined,
        periodo: r.periodo || undefined,
        dias_credito: r.dias_credito || 0,
        observaciones: r.observaciones
          ? `${r.observaciones} | Importado por ${user?.email || "sistema"} el ${new Date().toLocaleString("es-EC")}`
          : `Importado por ${user?.email || "sistema"} el ${new Date().toLocaleString("es-EC")}`,
      });

      setProgress(((i + 1) / rows.length) * 50);
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
    setResult({
      inserted,
      duplicates: errors.filter((e) => e.message.includes("Duplicada")).length,
      errors,
      created_providers: createdProviders,
    });
    setStep("result");
    if (inserted > 0) {
      queryClient.invalidateQueries({ queryKey: ["facturas"] });
      queryClient.invalidateQueries({ queryKey: ["proveedores"] });
    }
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
              <p className="font-medium">Columnas soportadas:</p>
              <p>PERIODO, PROVEEDOR CODIGO, RAZON SOCIAL, N° DOCUMENTO, MOTIVO, DOC. INTERNO, OBSERVACIONES, FECHA DE EMISION, FECHA VENCIMIENTO, DIAS CREDITO, SALDO TOTAL</p>
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
                    <th className="px-3 py-2 text-left">Código</th>
                    <th className="px-3 py-2 text-left">Proveedor</th>
                    <th className="px-3 py-2 text-left">Factura</th>
                    <th className="px-3 py-2 text-left">Emisión</th>
                    <th className="px-3 py-2 text-left">Vencimiento</th>
                    <th className="px-3 py-2 text-right">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 100).map((r, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-3 py-1.5 text-muted-foreground">{i + 1}</td>
                      <td className="px-3 py-1.5">{r.codigo_proveedor}</td>
                      <td className="px-3 py-1.5 max-w-[150px] truncate">{r.proveedor}</td>
                      <td className="px-3 py-1.5">{r.factura}</td>
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
              <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3 text-center">
                <CheckCircle2 size={20} className="mx-auto text-blue-600 mb-1" />
                <p className="text-lg font-bold text-blue-700">{result.created_providers.length}</p>
                <p className="text-xs text-blue-600">Proveedores creados</p>
              </div>
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-center">
                <XCircle size={20} className="mx-auto text-red-600 mb-1" />
                <p className="text-lg font-bold text-red-700">{result.errors.length}</p>
                <p className="text-xs text-red-600">Errores</p>
              </div>
            </div>

            {result.created_providers.length > 0 && (
              <div>
                <p className="text-xs font-medium text-blue-700 mb-1">Proveedores creados automáticamente:</p>
                <ScrollArea className="max-h-[100px] rounded border border-blue-500/20 bg-blue-50/50">
                  <div className="p-2 space-y-1">
                    {result.created_providers.map((p, i) => (
                      <p key={i} className="text-xs font-medium">{p}</p>
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
