-- Drop the single-column unique constraint on numero_factura
ALTER TABLE public.facturas DROP CONSTRAINT facturas_numero_factura_key;

-- Add composite unique constraint: codigo_proveedor + numero_factura
ALTER TABLE public.facturas ADD CONSTRAINT facturas_codigo_proveedor_numero_factura_key UNIQUE (codigo_proveedor, numero_factura);