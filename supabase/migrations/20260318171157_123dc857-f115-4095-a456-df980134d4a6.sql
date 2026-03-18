
-- Enum types
CREATE TYPE public.tipo_cuenta AS ENUM ('CORRIENTE', 'AHORROS');
CREATE TYPE public.prioridad AS ENUM ('CRITICO', 'URGENTE', 'PROXIMO', 'AL_DIA');
CREATE TYPE public.estado_aprobacion AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO', 'EN_PROCESO', 'PAGADO');
CREATE TYPE public.forma_pago AS ENUM ('TRANSFERENCIA', 'CHEQUE', 'EFECTIVO', 'ACH');
CREATE TYPE public.estado_semana AS ENUM ('BORRADOR', 'APROBADO', 'ARCHIVADO');
CREATE TYPE public.estado_factura AS ENUM ('PAGADA_COMPLETA', 'ABONO_PARCIAL', 'PENDIENTE');
CREATE TYPE public.app_role AS ENUM ('ADMIN', 'TESORERO', 'APROBADOR', 'CONSULTA');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  activo BOOLEAN NOT NULL DEFAULT true,
  ultimo_acceso TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles table (separate from profiles per security guidelines)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'CONSULTA',
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Get user role function
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Trigger to auto-create profile + default role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nombre, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nombre', ''), NEW.email);
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'CONSULTA');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Profiles RLS
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid());
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'));
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid());
CREATE POLICY "Admins can update all profiles" ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'));

-- User roles RLS
CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'));
CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));
CREATE POLICY "Admins can update roles" ON public.user_roles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'));
CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'));

-- Proveedores table
CREATE TABLE public.proveedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  ruc_ci TEXT NOT NULL,
  razon_social TEXT NOT NULL,
  banco TEXT NOT NULL DEFAULT '',
  numero_cuenta TEXT NOT NULL DEFAULT '',
  tipo_cuenta tipo_cuenta NOT NULL DEFAULT 'CORRIENTE',
  email_cobros TEXT NOT NULL DEFAULT '',
  telefono TEXT NOT NULL DEFAULT '',
  fecha_verificacion DATE,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.proveedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view proveedores" ON public.proveedores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Tesorero/Admin can insert proveedores" ON public.proveedores FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN') OR public.has_role(auth.uid(), 'TESORERO'));
CREATE POLICY "Tesorero/Admin can update proveedores" ON public.proveedores FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN') OR public.has_role(auth.uid(), 'TESORERO'));
CREATE POLICY "Admin can delete proveedores" ON public.proveedores FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'));

-- Facturas CxP table
CREATE TABLE public.facturas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo TEXT NOT NULL DEFAULT '',
  codigo_proveedor TEXT NOT NULL REFERENCES public.proveedores(codigo),
  razon_social TEXT NOT NULL,
  numero_factura TEXT NOT NULL UNIQUE,
  motivo TEXT NOT NULL DEFAULT '',
  doc_interno TEXT NOT NULL DEFAULT '',
  observaciones TEXT NOT NULL DEFAULT '',
  fecha_emision DATE NOT NULL,
  fecha_vencimiento DATE NOT NULL,
  dias_credito INTEGER NOT NULL DEFAULT 0,
  saldo_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.facturas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view facturas" ON public.facturas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Tesorero/Admin can insert facturas" ON public.facturas FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN') OR public.has_role(auth.uid(), 'TESORERO'));
CREATE POLICY "Tesorero/Admin can update facturas" ON public.facturas FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN') OR public.has_role(auth.uid(), 'TESORERO'));

-- Programaciones semanales
CREATE TABLE public.programaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  semana TEXT NOT NULL UNIQUE,
  aprobado_por TEXT NOT NULL DEFAULT '',
  limite_disponible NUMERIC(12,2) NOT NULL DEFAULT 50000,
  fecha_aprobacion DATE,
  estado_semana estado_semana NOT NULL DEFAULT 'BORRADOR',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.programaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view programaciones" ON public.programaciones FOR SELECT TO authenticated USING (true);
CREATE POLICY "Tesorero/Admin can insert programaciones" ON public.programaciones FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN') OR public.has_role(auth.uid(), 'TESORERO'));
CREATE POLICY "Tesorero/Admin can update programaciones" ON public.programaciones FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN') OR public.has_role(auth.uid(), 'TESORERO'));

-- Líneas de programación
CREATE TABLE public.lineas_programacion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  semana_id UUID NOT NULL REFERENCES public.programaciones(id) ON DELETE CASCADE,
  razon_social TEXT NOT NULL,
  codigo_proveedor TEXT NOT NULL,
  numero_factura TEXT NOT NULL,
  fecha_vencimiento DATE NOT NULL,
  estado_aprobacion estado_aprobacion NOT NULL DEFAULT 'PENDIENTE',
  dias_vencidos INTEGER NOT NULL DEFAULT 0,
  prioridad prioridad NOT NULL DEFAULT 'AL_DIA',
  forma_pago forma_pago NOT NULL DEFAULT 'TRANSFERENCIA',
  banco_destino TEXT NOT NULL DEFAULT '',
  cuenta_destino TEXT NOT NULL DEFAULT '',
  saldo_real_pendiente NUMERIC(12,2) NOT NULL DEFAULT 0,
  monto_a_pagar NUMERIC(12,2) NOT NULL DEFAULT 0,
  observaciones TEXT NOT NULL DEFAULT '',
  responsable_pago TEXT NOT NULL DEFAULT '',
  fecha_programada DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.lineas_programacion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view lineas" ON public.lineas_programacion FOR SELECT TO authenticated USING (true);
CREATE POLICY "Tesorero/Admin can insert lineas" ON public.lineas_programacion FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN') OR public.has_role(auth.uid(), 'TESORERO'));
CREATE POLICY "Tesorero/Admin/Aprobador can update lineas" ON public.lineas_programacion FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN') OR public.has_role(auth.uid(), 'TESORERO') OR public.has_role(auth.uid(), 'APROBADOR'));
CREATE POLICY "Tesorero/Admin can delete lineas" ON public.lineas_programacion FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN') OR public.has_role(auth.uid(), 'TESORERO'));

-- Pagos ejecutados
CREATE TABLE public.pagos_ejecutados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_linea INTEGER NOT NULL DEFAULT 0,
  fecha_pago DATE NOT NULL DEFAULT CURRENT_DATE,
  codigo_proveedor TEXT NOT NULL,
  razon_social TEXT NOT NULL,
  numero_factura TEXT NOT NULL,
  monto_pagado NUMERIC(12,2) NOT NULL DEFAULT 0,
  forma_pago forma_pago NOT NULL DEFAULT 'TRANSFERENCIA',
  banco_origen TEXT NOT NULL DEFAULT '',
  banco_destino TEXT NOT NULL DEFAULT '',
  numero_transferencia TEXT NOT NULL DEFAULT '',
  cuenta_destino TEXT NOT NULL DEFAULT '',
  saldo_pendiente NUMERIC(12,2) NOT NULL DEFAULT 0,
  responsable TEXT NOT NULL DEFAULT '',
  aprobado_por TEXT NOT NULL DEFAULT '',
  observaciones TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pagos_ejecutados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view pagos" ON public.pagos_ejecutados FOR SELECT TO authenticated USING (true);
CREATE POLICY "Tesorero/Admin can insert pagos" ON public.pagos_ejecutados FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN') OR public.has_role(auth.uid(), 'TESORERO'));
CREATE POLICY "Tesorero/Admin can update pagos" ON public.pagos_ejecutados FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN') OR public.has_role(auth.uid(), 'TESORERO'));

-- Histórico
CREATE TABLE public.historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_linea INTEGER NOT NULL DEFAULT 0,
  semana TEXT NOT NULL,
  periodo TEXT NOT NULL DEFAULT '',
  fecha_archivo DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_pago DATE NOT NULL,
  codigo_proveedor TEXT NOT NULL,
  razon_social TEXT NOT NULL,
  numero_factura TEXT NOT NULL,
  monto_pagado NUMERIC(12,2) NOT NULL DEFAULT 0,
  forma_pago forma_pago NOT NULL DEFAULT 'TRANSFERENCIA',
  banco_origen TEXT NOT NULL DEFAULT '',
  banco_destino TEXT NOT NULL DEFAULT '',
  numero_transferencia TEXT NOT NULL DEFAULT '',
  cuenta_destino TEXT NOT NULL DEFAULT '',
  saldo_pendiente NUMERIC(12,2) NOT NULL DEFAULT 0,
  responsable TEXT NOT NULL DEFAULT '',
  aprobado_por TEXT NOT NULL DEFAULT '',
  observaciones TEXT NOT NULL DEFAULT '',
  prioridad prioridad NOT NULL DEFAULT 'AL_DIA',
  dias_vencidos INTEGER NOT NULL DEFAULT 0,
  fecha_vencimiento DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view historico" ON public.historico FOR SELECT TO authenticated USING (true);
CREATE POLICY "Tesorero/Admin can insert historico" ON public.historico FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN') OR public.has_role(auth.uid(), 'TESORERO'));
