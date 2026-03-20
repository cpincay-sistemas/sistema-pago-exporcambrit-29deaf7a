CREATE POLICY "Admin can delete historico"
ON public.historico
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'ADMIN'::app_role));