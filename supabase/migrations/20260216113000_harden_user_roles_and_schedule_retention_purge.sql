WITH ranked_roles AS (
  SELECT
    id,
    user_id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id
      ORDER BY
        CASE role
          WHEN 'coordinator' THEN 1
          WHEN 'supervisor' THEN 2
          ELSE 3
        END,
        id
    ) AS rank_order
  FROM public.user_roles
)
DELETE FROM public.user_roles ur
USING ranked_roles rr
WHERE ur.id = rr.id
  AND rr.rank_order > 1;

ALTER TABLE public.user_roles
  DROP CONSTRAINT IF EXISTS user_roles_user_id_role_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_roles_user_id_key'
      AND conrelid = 'public.user_roles'::regclass
  ) THEN
    ALTER TABLE public.user_roles
      ADD CONSTRAINT user_roles_user_id_key UNIQUE (user_id);
  END IF;
END;
$$;

DO $$
DECLARE
  existing_job RECORD;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_available_extensions
    WHERE name = 'pg_cron'
  ) THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron;

    FOR existing_job IN
      SELECT jobid
      FROM cron.job
      WHERE jobname = 'purge_expired_deactivated_user_reports_daily'
    LOOP
      PERFORM cron.unschedule(existing_job.jobid);
    END LOOP;

    PERFORM cron.schedule(
      'purge_expired_deactivated_user_reports_daily',
      '0 3 * * *',
      $job$SELECT public.purge_expired_deactivated_user_reports();$job$
    );
  END IF;
END;
$$;
