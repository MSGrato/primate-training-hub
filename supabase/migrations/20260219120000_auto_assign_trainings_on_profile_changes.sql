CREATE OR REPLACE FUNCTION public.assign_required_trainings_for_user(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count INTEGER := 0;
BEGIN
  INSERT INTO public.user_training_assignments (user_id, training_id)
  SELECT
    p.user_id,
    tta.training_id
  FROM public.profiles p
  JOIN public.job_title_tags jtt
    ON jtt.job_title_id = p.job_title_id
  JOIN public.training_tag_assignments tta
    ON tta.job_tag_id = jtt.job_tag_id
  WHERE p.user_id = p_user_id
    AND p.is_active = true
    AND p.job_title_id IS NOT NULL
  ON CONFLICT (user_id, training_id) DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_required_trainings_for_all_users()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count INTEGER := 0;
BEGIN
  INSERT INTO public.user_training_assignments (user_id, training_id)
  SELECT
    p.user_id,
    tta.training_id
  FROM public.profiles p
  JOIN public.job_title_tags jtt
    ON jtt.job_title_id = p.job_title_id
  JOIN public.training_tag_assignments tta
    ON tta.job_tag_id = jtt.job_tag_id
  WHERE p.is_active = true
    AND p.job_title_id IS NOT NULL
  ON CONFLICT (user_id, training_id) DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_profile_training_assignments()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.is_active = true AND NEW.job_title_id IS NOT NULL THEN
      PERFORM public.assign_required_trainings_for_user(NEW.user_id);
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.is_active = true
      AND NEW.job_title_id IS NOT NULL
      AND (
        NEW.job_title_id IS DISTINCT FROM OLD.job_title_id
        OR (OLD.is_active = false AND NEW.is_active = true)
      ) THEN
      PERFORM public.assign_required_trainings_for_user(NEW.user_id);
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assign_profile_trainings_on_profile_change ON public.profiles;

CREATE TRIGGER assign_profile_trainings_on_profile_change
AFTER INSERT OR UPDATE OF job_title_id, is_active ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.handle_profile_training_assignments();

SELECT public.assign_required_trainings_for_all_users();
