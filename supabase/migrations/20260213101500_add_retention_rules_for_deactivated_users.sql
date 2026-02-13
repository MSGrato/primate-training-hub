ALTER TABLE public.profiles
  ADD COLUMN deactivated_at TIMESTAMPTZ;

UPDATE public.profiles
SET deactivated_at = now()
WHERE is_active = false
  AND deactivated_at IS NULL;

CREATE OR REPLACE FUNCTION public.sync_profile_deactivation_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.is_active = false AND OLD.is_active = true THEN
    NEW.deactivated_at = now();
  ELSIF NEW.is_active = true AND OLD.is_active = false THEN
    NEW.deactivated_at = NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_profile_deactivation_timestamp
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_deactivation_timestamp();

CREATE OR REPLACE FUNCTION public.purge_expired_deactivated_user_reports()
RETURNS TABLE (
  user_id UUID,
  deleted_training_completions BIGINT,
  deleted_training_assignments BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user RECORD;
  completion_count BIGINT;
  assignment_count BIGINT;
BEGIN
  FOR target_user IN
    SELECT p.user_id
    FROM public.profiles p
    WHERE p.is_active = false
      AND p.deactivated_at IS NOT NULL
      AND p.deactivated_at <= now() - interval '6 years'
  LOOP
    DELETE FROM public.training_completions tc
    WHERE tc.user_id = target_user.user_id;
    GET DIAGNOSTICS completion_count = ROW_COUNT;

    DELETE FROM public.user_training_assignments uta
    WHERE uta.user_id = target_user.user_id;
    GET DIAGNOSTICS assignment_count = ROW_COUNT;

    user_id := target_user.user_id;
    deleted_training_completions := completion_count;
    deleted_training_assignments := assignment_count;
    RETURN NEXT;
  END LOOP;
END;
$$;
