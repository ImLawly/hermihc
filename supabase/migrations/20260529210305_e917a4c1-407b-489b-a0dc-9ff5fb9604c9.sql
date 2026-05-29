
-- ============================================================
-- SISTEMA DE HISTORIAS MÉDICAS - ESQUEMA BASE
-- ============================================================

-- ENUMS
CREATE TYPE public.app_role AS ENUM ('admin','especialista','r3','r2','r1','enfermeria','traslado');
CREATE TYPE public.service_type AS ENUM ('obstetricia','pediatria','cirugia_general','cirugia_pediatrica','traumatologia','anestesiologia');
CREATE TYPE public.location_type AS ENUM ('consulta_externa','emergencia','hospitalizacion');
CREATE TYPE public.patient_status AS ENUM ('activa','archivada');
CREATE TYPE public.record_status AS ENUM ('pendiente_revision','confirmado');
CREATE TYPE public.discharge_type AS ENUM ('alta_medica','contraopinion');
CREATE TYPE public.cedula_type AS ENUM ('V','E');

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  cedula TEXT,
  approved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- USER ROLES (por servicio)
-- ============================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  service public.service_type, -- NULL para admin/traslado
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role, service)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- FUNCIONES DE SEGURIDAD (SECURITY DEFINER)
-- ============================================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin')
$$;

CREATE OR REPLACE FUNCTION public.has_service_access(_user_id UUID, _service public.service_type)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND (role = 'admin' OR service = _service)
  )
$$;

CREATE OR REPLACE FUNCTION public.can_review_records(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('especialista','r3','r2','admin')
  )
$$;

CREATE OR REPLACE FUNCTION public.is_medical_staff(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('especialista','r3','r2','r1','admin')
  )
$$;

CREATE OR REPLACE FUNCTION public.is_nurse(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'enfermeria')
$$;

-- ============================================================
-- PROFILES RLS
-- ============================================================
CREATE POLICY "profiles_self_select" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid()
  ));
CREATE POLICY "profiles_self_insert" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_admin(auth.uid()));

-- USER_ROLES RLS
CREATE POLICY "user_roles_self_read" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "user_roles_admin_write" ON public.user_roles FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ============================================================
-- TRIGGER: crear profile + bootstrap primer admin
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  user_count INT;
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));

  -- Primer usuario del sistema => admin auto-aprobado
  SELECT count(*) INTO user_count FROM auth.users;
  IF user_count = 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
    UPDATE public.profiles SET approved = true WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- PACIENTES
-- ============================================================
CREATE TABLE public.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cedula_type public.cedula_type NOT NULL,
  cedula_number TEXT NOT NULL,
  nombres TEXT NOT NULL,
  apellidos TEXT NOT NULL,
  fecha_nacimiento DATE NOT NULL,
  telefono TEXT,
  direccion TEXT,
  service public.service_type NOT NULL,
  current_location public.location_type NOT NULL DEFAULT 'emergencia',
  current_bed TEXT,
  status public.patient_status NOT NULL DEFAULT 'activa',
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(cedula_type, cedula_number)
);
CREATE INDEX idx_patients_service ON public.patients(service, status);
CREATE INDEX idx_patients_cedula ON public.patients(cedula_number);
GRANT SELECT, INSERT, UPDATE ON public.patients TO authenticated;
GRANT ALL ON public.patients TO service_role;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patients_service_read" ON public.patients FOR SELECT TO authenticated
  USING (public.has_service_access(auth.uid(), service));
CREATE POLICY "patients_medical_insert" ON public.patients FOR INSERT TO authenticated
  WITH CHECK (public.is_medical_staff(auth.uid()) AND public.has_service_access(auth.uid(), service));
CREATE POLICY "patients_medical_update" ON public.patients FOR UPDATE TO authenticated
  USING (public.is_medical_staff(auth.uid()) AND public.has_service_access(auth.uid(), service));

-- ============================================================
-- ADMISSIONS (HOJA FRONTAL - Pestaña 1)
-- ============================================================
CREATE TABLE public.admissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  service public.service_type NOT NULL,
  location public.location_type NOT NULL,
  bed TEXT,
  admission_date TIMESTAMPTZ NOT NULL,
  motivo_consulta TEXT,
  historia_enfermedad_actual TEXT,
  -- Antecedentes
  antecedentes_personales TEXT,
  antecedentes_familiares TEXT,
  antecedentes_quirurgicos TEXT,
  habitos_psicobiologicos TEXT,
  antecedentes_ginecobstetricos JSONB DEFAULT '{}'::jsonb, -- {gesta,para,abortos,cesareas,partos,detalles}
  -- Examen físico ingreso (signos vitales)
  examen_fisico JSONB DEFAULT '{}'::jsonb, -- {ta,tam,fc,fr,temp,sato2,peso,talla,descripcion}
  -- Labs/imagen
  labs_ingreso TEXT,
  -- Diagnósticos
  impresion_diagnostica TEXT,
  comentario_ingreso TEXT,
  -- Egreso
  diagnostico_egreso TEXT,
  discharge_type public.discharge_type,
  discharge_at TIMESTAMPTZ,
  -- Revisión / Auditoría
  record_status public.record_status NOT NULL DEFAULT 'pendiente_revision',
  status public.patient_status NOT NULL DEFAULT 'activa',
  created_by UUID NOT NULL REFERENCES auth.users(id),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_admissions_patient ON public.admissions(patient_id);
CREATE INDEX idx_admissions_service_status ON public.admissions(service, status);
GRANT SELECT, INSERT, UPDATE ON public.admissions TO authenticated;
GRANT ALL ON public.admissions TO service_role;
ALTER TABLE public.admissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admissions_service_read" ON public.admissions FOR SELECT TO authenticated
  USING (public.has_service_access(auth.uid(), service));
CREATE POLICY "admissions_medical_insert" ON public.admissions FOR INSERT TO authenticated
  WITH CHECK (public.is_medical_staff(auth.uid()) AND public.has_service_access(auth.uid(), service));
CREATE POLICY "admissions_medical_update" ON public.admissions FOR UPDATE TO authenticated
  USING (public.is_medical_staff(auth.uid()) AND public.has_service_access(auth.uid(), service));

-- ============================================================
-- EVOLUCIONES (Pestaña 2)
-- ============================================================
CREATE TABLE public.evolutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id UUID NOT NULL REFERENCES public.admissions(id) ON DELETE CASCADE,
  evolution_at TIMESTAMPTZ NOT NULL,
  diagnostico_actual TEXT,
  subjetivo TEXT,
  objetivo JSONB DEFAULT '{}'::jsonb, -- {ta,tam,fc,fr,sato2,examen_fisico}
  plan TEXT,
  record_status public.record_status NOT NULL DEFAULT 'pendiente_revision',
  created_by UUID NOT NULL REFERENCES auth.users(id),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_evolutions_admission ON public.evolutions(admission_id, evolution_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.evolutions TO authenticated;
GRANT ALL ON public.evolutions TO service_role;
ALTER TABLE public.evolutions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "evolutions_read" ON public.evolutions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admissions a WHERE a.id = admission_id AND public.has_service_access(auth.uid(), a.service)));
CREATE POLICY "evolutions_insert" ON public.evolutions FOR INSERT TO authenticated
  WITH CHECK (public.is_medical_staff(auth.uid()) AND EXISTS (SELECT 1 FROM public.admissions a WHERE a.id = admission_id AND public.has_service_access(auth.uid(), a.service)));
CREATE POLICY "evolutions_update" ON public.evolutions FOR UPDATE TO authenticated
  USING (public.is_medical_staff(auth.uid()) AND EXISTS (SELECT 1 FROM public.admissions a WHERE a.id = admission_id AND public.has_service_access(auth.uid(), a.service)));

-- ============================================================
-- ÓRDENES MÉDICAS (Pestaña 3)
-- ============================================================
CREATE TABLE public.medical_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id UUID NOT NULL REFERENCES public.admissions(id) ON DELETE CASCADE,
  order_at TIMESTAMPTZ NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{n,text,medication,dose,route,times:["08:00","14:00"]}]
  record_status public.record_status NOT NULL DEFAULT 'pendiente_revision',
  created_by UUID NOT NULL REFERENCES auth.users(id),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_orders_admission ON public.medical_orders(admission_id, order_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.medical_orders TO authenticated;
GRANT ALL ON public.medical_orders TO service_role;
ALTER TABLE public.medical_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orders_read" ON public.medical_orders FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admissions a WHERE a.id = admission_id AND public.has_service_access(auth.uid(), a.service)));
CREATE POLICY "orders_insert" ON public.medical_orders FOR INSERT TO authenticated
  WITH CHECK (public.is_medical_staff(auth.uid()) AND EXISTS (SELECT 1 FROM public.admissions a WHERE a.id = admission_id AND public.has_service_access(auth.uid(), a.service)));
CREATE POLICY "orders_update" ON public.medical_orders FOR UPDATE TO authenticated
  USING (public.is_medical_staff(auth.uid()) AND EXISTS (SELECT 1 FROM public.admissions a WHERE a.id = admission_id AND public.has_service_access(auth.uid(), a.service)));

-- Administración de tratamientos (check de enfermería)
CREATE TABLE public.order_administrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.medical_orders(id) ON DELETE CASCADE,
  item_index INT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  administered_at TIMESTAMPTZ,
  administered_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_admin_scheduled ON public.order_administrations(scheduled_at);
GRANT SELECT, INSERT, UPDATE ON public.order_administrations TO authenticated;
GRANT ALL ON public.order_administrations TO service_role;
ALTER TABLE public.order_administrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_read" ON public.order_administrations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.medical_orders mo JOIN public.admissions a ON a.id=mo.admission_id WHERE mo.id=order_id AND public.has_service_access(auth.uid(), a.service)));
CREATE POLICY "admin_insert" ON public.order_administrations FOR INSERT TO authenticated
  WITH CHECK (public.is_medical_staff(auth.uid()) OR public.is_nurse(auth.uid()));
CREATE POLICY "admin_update_nurse" ON public.order_administrations FOR UPDATE TO authenticated
  USING (public.is_nurse(auth.uid()) OR public.is_medical_staff(auth.uid()));

-- ============================================================
-- MONITOREO (Pestaña 4)
-- ============================================================
CREATE TABLE public.monitoring_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id UUID NOT NULL REFERENCES public.admissions(id) ON DELETE CASCADE,
  recorded_at TIMESTAMPTZ NOT NULL,
  ta TEXT, tam NUMERIC, fc INT, fr INT, sato2 INT,
  fcf INT, du TEXT, mf TEXT,
  performed_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_monitoring_admission ON public.monitoring_entries(admission_id, recorded_at DESC);
GRANT SELECT, INSERT ON public.monitoring_entries TO authenticated;
GRANT ALL ON public.monitoring_entries TO service_role;
ALTER TABLE public.monitoring_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mon_read" ON public.monitoring_entries FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admissions a WHERE a.id = admission_id AND public.has_service_access(auth.uid(), a.service)));
CREATE POLICY "mon_insert" ON public.monitoring_entries FOR INSERT TO authenticated
  WITH CHECK ((public.is_medical_staff(auth.uid()) OR public.is_nurse(auth.uid())) AND EXISTS (SELECT 1 FROM public.admissions a WHERE a.id = admission_id AND public.has_service_access(auth.uid(), a.service)));

-- LABORATORIOS (sábana)
CREATE TABLE public.lab_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id UUID NOT NULL REFERENCES public.admissions(id) ON DELETE CASCADE,
  sampled_at TIMESTAMPTZ NOT NULL,
  parametro TEXT NOT NULL,
  valor TEXT NOT NULL,
  unidad TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_labs_admission ON public.lab_results(admission_id, sampled_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lab_results TO authenticated;
GRANT ALL ON public.lab_results TO service_role;
ALTER TABLE public.lab_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lab_read" ON public.lab_results FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admissions a WHERE a.id = admission_id AND public.has_service_access(auth.uid(), a.service)));
CREATE POLICY "lab_write" ON public.lab_results FOR ALL TO authenticated
  USING (public.is_medical_staff(auth.uid()) AND EXISTS (SELECT 1 FROM public.admissions a WHERE a.id = admission_id AND public.has_service_access(auth.uid(), a.service)))
  WITH CHECK (public.is_medical_staff(auth.uid()) AND EXISTS (SELECT 1 FROM public.admissions a WHERE a.id = admission_id AND public.has_service_access(auth.uid(), a.service)));

-- ============================================================
-- INTERCONSULTAS (Pestaña 5)
-- ============================================================
CREATE TABLE public.interconsultations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id UUID NOT NULL REFERENCES public.admissions(id) ON DELETE CASCADE,
  target_service public.service_type NOT NULL,
  diagnosticos TEXT,
  comentario TEXT NOT NULL,
  respuesta TEXT,
  responded_by UUID REFERENCES auth.users(id),
  responded_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_inter_admission ON public.interconsultations(admission_id);
GRANT SELECT, INSERT, UPDATE ON public.interconsultations TO authenticated;
GRANT ALL ON public.interconsultations TO service_role;
ALTER TABLE public.interconsultations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inter_read" ON public.interconsultations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admissions a WHERE a.id = admission_id AND (public.has_service_access(auth.uid(), a.service) OR public.has_service_access(auth.uid(), target_service))));
CREATE POLICY "inter_insert" ON public.interconsultations FOR INSERT TO authenticated
  WITH CHECK (public.is_medical_staff(auth.uid()) AND EXISTS (SELECT 1 FROM public.admissions a WHERE a.id = admission_id AND public.has_service_access(auth.uid(), a.service)));
CREATE POLICY "inter_update" ON public.interconsultations FOR UPDATE TO authenticated
  USING (public.is_medical_staff(auth.uid()) AND EXISTS (SELECT 1 FROM public.admissions a WHERE a.id = admission_id AND (public.has_service_access(auth.uid(), a.service) OR public.has_service_access(auth.uid(), target_service))));

-- NOTAS (médicas / aclaratorias / enfermería)
CREATE TYPE public.note_type AS ENUM ('medica','aclaratoria','enfermeria');
CREATE TABLE public.clinical_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id UUID NOT NULL REFERENCES public.admissions(id) ON DELETE CASCADE,
  tipo public.note_type NOT NULL,
  note_at TIMESTAMPTZ NOT NULL,
  contenido TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notes_admission ON public.clinical_notes(admission_id, note_at DESC);
GRANT SELECT, INSERT ON public.clinical_notes TO authenticated;
GRANT ALL ON public.clinical_notes TO service_role;
ALTER TABLE public.clinical_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notes_read" ON public.clinical_notes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admissions a WHERE a.id = admission_id AND public.has_service_access(auth.uid(), a.service)));
CREATE POLICY "notes_insert_medical" ON public.clinical_notes FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.admissions a WHERE a.id = admission_id AND public.has_service_access(auth.uid(), a.service))
    AND (
      (tipo IN ('medica','aclaratoria') AND public.is_medical_staff(auth.uid()))
      OR (tipo = 'enfermeria' AND (public.is_nurse(auth.uid()) OR public.is_medical_staff(auth.uid())))
    )
  );

-- ============================================================
-- NOTAS DE PARTO / OPERATORIA (Pestaña 6)
-- ============================================================
CREATE TABLE public.delivery_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id UUID NOT NULL REFERENCES public.admissions(id) ON DELETE CASCADE,
  expulsion_at TIMESTAMPTZ NOT NULL,
  descripcion TEXT NOT NULL,
  diagnostico_egreso_mesa TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.delivery_notes TO authenticated;
GRANT ALL ON public.delivery_notes TO service_role;
ALTER TABLE public.delivery_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "del_read" ON public.delivery_notes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admissions a WHERE a.id = admission_id AND public.has_service_access(auth.uid(), a.service)));
CREATE POLICY "del_write" ON public.delivery_notes FOR INSERT TO authenticated
  WITH CHECK (public.is_medical_staff(auth.uid()) AND EXISTS (SELECT 1 FROM public.admissions a WHERE a.id = admission_id AND public.has_service_access(auth.uid(), a.service)));

CREATE TABLE public.operative_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id UUID NOT NULL REFERENCES public.admissions(id) ON DELETE CASCADE,
  surgery_at TIMESTAMPTZ NOT NULL,
  diagnosticos_preoperatorios TEXT,
  cirujano TEXT, primer_ayudante TEXT, segundo_ayudante TEXT, tercer_ayudante TEXT,
  instrumentista TEXT, circulante TEXT, anestesiologo TEXT,
  monitor_anestesiologo TEXT, monitor_cirujano TEXT,
  descripcion TEXT NOT NULL,
  hallazgos TEXT,
  rn_peso NUMERIC, rn_talla NUMERIC,
  diagnostico_postoperatorio TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.operative_notes TO authenticated;
GRANT ALL ON public.operative_notes TO service_role;
ALTER TABLE public.operative_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "op_read" ON public.operative_notes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admissions a WHERE a.id = admission_id AND public.has_service_access(auth.uid(), a.service)));
CREATE POLICY "op_write" ON public.operative_notes FOR INSERT TO authenticated
  WITH CHECK (public.is_medical_staff(auth.uid()) AND EXISTS (SELECT 1 FROM public.admissions a WHERE a.id = admission_id AND public.has_service_access(auth.uid(), a.service)));

-- ============================================================
-- TRASLADOS / UBICACIONES (alertas a personal de Traslado)
-- ============================================================
CREATE TABLE public.patient_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  from_location public.location_type,
  to_location public.location_type NOT NULL,
  from_bed TEXT, to_bed TEXT,
  changed_by UUID NOT NULL REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_transfers_patient ON public.patient_transfers(patient_id, changed_at DESC);
GRANT SELECT, INSERT ON public.patient_transfers TO authenticated;
GRANT ALL ON public.patient_transfers TO service_role;
ALTER TABLE public.patient_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transfers_read" ON public.patient_transfers FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'traslado')
    OR public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.patients p WHERE p.id = patient_id AND public.has_service_access(auth.uid(), p.service))
  );
CREATE POLICY "transfers_insert" ON public.patient_transfers FOR INSERT TO authenticated
  WITH CHECK (public.is_medical_staff(auth.uid()) OR public.is_nurse(auth.uid()));

-- ============================================================
-- NOTIFICACIONES
-- ============================================================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  target_role public.app_role,
  target_service public.service_type,
  kind TEXT NOT NULL, -- 'transfer','medication','interconsult','review'
  title TEXT NOT NULL,
  body TEXT,
  payload JSONB DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notif_user ON public.notifications(user_id, created_at DESC);
CREATE INDEX idx_notif_role ON public.notifications(target_role, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notif_read" ON public.notifications FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (target_role IS NOT NULL AND public.has_role(auth.uid(), target_role)
        AND (target_service IS NULL OR public.has_service_access(auth.uid(), target_service)))
  );
CREATE POLICY "notif_update_own" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR (target_role IS NOT NULL AND public.has_role(auth.uid(), target_role)));
CREATE POLICY "notif_insert" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================
-- AUDIT LOGS (inmutables)
-- ============================================================
CREATE TABLE public.audit_logs (
  id BIGSERIAL PRIMARY KEY,
  table_name TEXT NOT NULL,
  row_id TEXT,
  operation TEXT NOT NULL, -- INSERT/UPDATE/DELETE
  user_id UUID,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  before_data JSONB,
  after_data JSONB
);
CREATE INDEX idx_audit_table ON public.audit_logs(table_name, performed_at DESC);
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_admin_read" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.audit_trigger()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.audit_logs(table_name, row_id, operation, user_id, before_data, after_data)
  VALUES (
    TG_TABLE_NAME,
    COALESCE((CASE WHEN TG_OP='DELETE' THEN OLD.id ELSE NEW.id END)::text, NULL),
    TG_OP,
    auth.uid(),
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) END
  );
  RETURN COALESCE(NEW, OLD);
END; $$;

-- Aplicar auditoría a tablas críticas
CREATE TRIGGER audit_patients AFTER INSERT OR UPDATE OR DELETE ON public.patients FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER audit_admissions AFTER INSERT OR UPDATE OR DELETE ON public.admissions FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER audit_evolutions AFTER INSERT OR UPDATE OR DELETE ON public.evolutions FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER audit_orders AFTER INSERT OR UPDATE OR DELETE ON public.medical_orders FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER audit_notes AFTER INSERT OR UPDATE OR DELETE ON public.clinical_notes FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER audit_inter AFTER INSERT OR UPDATE OR DELETE ON public.interconsultations FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER audit_delivery AFTER INSERT OR UPDATE OR DELETE ON public.delivery_notes FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER audit_oper AFTER INSERT OR UPDATE OR DELETE ON public.operative_notes FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER audit_transfers AFTER INSERT ON public.patient_transfers FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER tg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER tg_patients_updated BEFORE UPDATE ON public.patients FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER tg_admissions_updated BEFORE UPDATE ON public.admissions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER tg_evolutions_updated BEFORE UPDATE ON public.evolutions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger: cuando cambia ubicación de paciente → registra transfer + notifica a traslado
CREATE OR REPLACE FUNCTION public.handle_patient_location_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.current_location IS DISTINCT FROM OLD.current_location OR COALESCE(NEW.current_bed,'') <> COALESCE(OLD.current_bed,'') THEN
    INSERT INTO public.patient_transfers(patient_id, from_location, to_location, from_bed, to_bed, changed_by)
    VALUES (NEW.id, OLD.current_location, NEW.current_location, OLD.current_bed, NEW.current_bed, auth.uid());

    INSERT INTO public.notifications(target_role, kind, title, body, payload)
    VALUES (
      'traslado','transfer',
      'Reubicación de paciente',
      NEW.nombres||' '||NEW.apellidos||' • Cama '||COALESCE(NEW.current_bed,'-')||' • '||OLD.current_location::text||' → '||NEW.current_location::text,
      jsonb_build_object('patient_id', NEW.id, 'from', OLD.current_location, 'to', NEW.current_location, 'bed', NEW.current_bed)
    );
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER tg_patient_transfer AFTER UPDATE ON public.patients FOR EACH ROW EXECUTE FUNCTION public.handle_patient_location_change();
