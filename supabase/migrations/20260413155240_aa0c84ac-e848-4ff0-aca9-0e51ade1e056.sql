ALTER TABLE public.facturas 
ADD COLUMN tipo text NOT NULL DEFAULT 'FACTURA',
ADD COLUMN referencia_proforma_id uuid DEFAULT NULL;