-- Allow admin to delete facturas
CREATE POLICY "Admin can delete facturas"
ON public.facturas
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'ADMIN'::app_role));

-- Allow admin to delete programaciones
CREATE POLICY "Admin can delete programaciones"
ON public.programaciones
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'ADMIN'::app_role));

-- Allow admin to delete pagos_ejecutados
CREATE POLICY "Admin can delete pagos_ejecutados"
ON public.pagos_ejecutados
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'ADMIN'::app_role));