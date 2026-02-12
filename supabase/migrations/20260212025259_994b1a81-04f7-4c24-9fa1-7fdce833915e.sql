ALTER TABLE public.job_titles ADD COLUMN description text;
ALTER TABLE public.profiles ADD COLUMN is_active boolean NOT NULL DEFAULT true;