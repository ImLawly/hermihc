
-- 1) Push subscriptions
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_own_select" ON public.push_subscriptions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "push_own_insert" ON public.push_subscriptions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "push_own_delete" ON public.push_subscriptions
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 2) Realtime para notifications
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
DO $$ BEGIN
  PERFORM 1 FROM pg_publication_tables
   WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications';
  IF NOT FOUND THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
  END IF;
END $$;

-- 3) Triggers de notificaciones de dominio

-- Interconsulta creada -> notifica al target_service
CREATE OR REPLACE FUNCTION public.notify_new_interconsult()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_patient record;
BEGIN
  SELECT p.nombres, p.apellidos INTO v_patient
  FROM public.admissions a JOIN public.patients p ON p.id = a.patient_id
  WHERE a.id = NEW.admission_id;

  INSERT INTO public.notifications(target_role, target_service, kind, title, body, payload)
  VALUES (
    'especialista', NEW.target_service, 'interconsult_new',
    'Nueva interconsulta',
    COALESCE(v_patient.nombres||' '||v_patient.apellidos, 'Paciente')||' — '||LEFT(NEW.comentario, 120),
    jsonb_build_object('admission_id', NEW.admission_id, 'interconsult_id', NEW.id, 'target_service', NEW.target_service)
  );
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_new_interconsult ON public.interconsultations;
CREATE TRIGGER trg_notify_new_interconsult
AFTER INSERT ON public.interconsultations
FOR EACH ROW EXECUTE FUNCTION public.notify_new_interconsult();

-- Interconsulta respondida -> notifica al creador
CREATE OR REPLACE FUNCTION public.notify_interconsult_answered()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.respuesta IS DISTINCT FROM OLD.respuesta AND NEW.respuesta IS NOT NULL THEN
    INSERT INTO public.notifications(user_id, kind, title, body, payload)
    VALUES (
      NEW.created_by, 'interconsult_answer',
      'Interconsulta respondida',
      LEFT(NEW.respuesta, 160),
      jsonb_build_object('admission_id', NEW.admission_id, 'interconsult_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_interconsult_answered ON public.interconsultations;
CREATE TRIGGER trg_notify_interconsult_answered
AFTER UPDATE ON public.interconsultations
FOR EACH ROW EXECUTE FUNCTION public.notify_interconsult_answered();

-- Registro pendiente de R1 -> notifica a R2/R3/especialistas del servicio
CREATE OR REPLACE FUNCTION public.notify_pending_review_evolution()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_service service_type;
BEGIN
  IF NEW.record_status = 'pendiente_revision' AND public.has_role(NEW.created_by, 'r1') THEN
    SELECT a.service INTO v_service FROM public.admissions a WHERE a.id = NEW.admission_id;
    INSERT INTO public.notifications(target_role, target_service, kind, title, body, payload)
    VALUES (
      'especialista', v_service, 'review_pending',
      'Evolución pendiente de revisión',
      'Un R1 registró una evolución que requiere tu confirmación.',
      jsonb_build_object('admission_id', NEW.admission_id, 'evolution_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_pending_review_evolution ON public.evolutions;
CREATE TRIGGER trg_notify_pending_review_evolution
AFTER INSERT ON public.evolutions
FOR EACH ROW EXECUTE FUNCTION public.notify_pending_review_evolution();

CREATE OR REPLACE FUNCTION public.notify_pending_review_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_service service_type;
BEGIN
  IF NEW.record_status = 'pendiente_revision' AND public.has_role(NEW.created_by, 'r1') THEN
    SELECT a.service INTO v_service FROM public.admissions a WHERE a.id = NEW.admission_id;
    INSERT INTO public.notifications(target_role, target_service, kind, title, body, payload)
    VALUES (
      'especialista', v_service, 'review_pending',
      'Orden médica pendiente de revisión',
      'Un R1 registró una orden que requiere tu confirmación.',
      jsonb_build_object('admission_id', NEW.admission_id, 'order_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_pending_review_order ON public.medical_orders;
CREATE TRIGGER trg_notify_pending_review_order
AFTER INSERT ON public.medical_orders
FOR EACH ROW EXECUTE FUNCTION public.notify_pending_review_order();
