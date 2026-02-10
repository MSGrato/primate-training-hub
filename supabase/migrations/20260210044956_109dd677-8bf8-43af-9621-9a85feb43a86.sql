
-- Roles enum
CREATE TYPE public.app_role AS ENUM ('employee', 'supervisor', 'coordinator');

-- Training categories
CREATE TYPE public.training_category AS ENUM ('onboarding', 'on_the_job', 'sop');

-- Training frequency
CREATE TYPE public.training_frequency AS ENUM ('one_time', 'annual', 'semi_annual', 'as_needed');

-- Approval status
CREATE TYPE public.approval_status AS ENUM ('pending', 'approved', 'rejected');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  net_id TEXT NOT NULL UNIQUE,
  job_title_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles table (separate per security requirements)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);

-- Job titles
CREATE TABLE public.job_titles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add FK to profiles
ALTER TABLE public.profiles ADD CONSTRAINT fk_profiles_job_title FOREIGN KEY (job_title_id) REFERENCES public.job_titles(id) ON DELETE SET NULL;

-- Job tags
CREATE TABLE public.job_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Job title to tag mapping
CREATE TABLE public.job_title_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_title_id UUID REFERENCES public.job_titles(id) ON DELETE CASCADE NOT NULL,
  job_tag_id UUID REFERENCES public.job_tags(id) ON DELETE CASCADE NOT NULL,
  UNIQUE(job_title_id, job_tag_id)
);

-- Trainings
CREATE TABLE public.trainings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category training_category NOT NULL,
  frequency training_frequency NOT NULL DEFAULT 'one_time',
  content_url TEXT,
  content_type TEXT DEFAULT 'link',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Training to tag assignments
CREATE TABLE public.training_tag_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  training_id UUID REFERENCES public.trainings(id) ON DELETE CASCADE NOT NULL,
  job_tag_id UUID REFERENCES public.job_tags(id) ON DELETE CASCADE NOT NULL,
  UNIQUE(training_id, job_tag_id)
);

-- User training assignments
CREATE TABLE public.user_training_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  training_id UUID REFERENCES public.trainings(id) ON DELETE CASCADE NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, training_id)
);

-- Training completions
CREATE TABLE public.training_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  training_id UUID REFERENCES public.trainings(id) ON DELETE CASCADE NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  status approval_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Supervisor-employee mappings
CREATE TABLE public.supervisor_employee_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supervisor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  employee_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  UNIQUE(supervisor_id, employee_id)
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_titles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_title_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_tag_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_training_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supervisor_employee_mappings ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checking
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

-- Timestamp update function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Timestamp triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_trainings_updated_at BEFORE UPDATE ON public.trainings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies

-- Profiles: users see own, supervisors see employees, coordinators see all
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Coordinators can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'coordinator'));
CREATE POLICY "Supervisors can view employee profiles" ON public.profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.supervisor_employee_mappings WHERE supervisor_id = auth.uid() AND employee_id = profiles.user_id)
);
CREATE POLICY "Coordinators can insert profiles" ON public.profiles FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'coordinator'));
CREATE POLICY "Coordinators can update profiles" ON public.profiles FOR UPDATE USING (public.has_role(auth.uid(), 'coordinator'));
CREATE POLICY "Coordinators can delete profiles" ON public.profiles FOR DELETE USING (public.has_role(auth.uid(), 'coordinator'));

-- User roles: users see own, coordinators see all
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Coordinators can view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'coordinator'));
CREATE POLICY "Supervisors can view employee roles" ON public.user_roles FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.supervisor_employee_mappings WHERE supervisor_id = auth.uid() AND employee_id = user_roles.user_id)
);
CREATE POLICY "Coordinators can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'coordinator'));

-- Job titles: readable by all authenticated, writable by coordinators
CREATE POLICY "Authenticated can view job titles" ON public.job_titles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Coordinators can manage job titles" ON public.job_titles FOR ALL USING (public.has_role(auth.uid(), 'coordinator'));

-- Job tags: readable by all authenticated, writable by coordinators
CREATE POLICY "Authenticated can view job tags" ON public.job_tags FOR SELECT TO authenticated USING (true);
CREATE POLICY "Coordinators can manage job tags" ON public.job_tags FOR ALL USING (public.has_role(auth.uid(), 'coordinator'));

-- Job title tags: readable by all authenticated, writable by coordinators
CREATE POLICY "Authenticated can view job title tags" ON public.job_title_tags FOR SELECT TO authenticated USING (true);
CREATE POLICY "Coordinators can manage job title tags" ON public.job_title_tags FOR ALL USING (public.has_role(auth.uid(), 'coordinator'));

-- Trainings: readable by all authenticated, writable by coordinators
CREATE POLICY "Authenticated can view trainings" ON public.trainings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Coordinators can manage trainings" ON public.trainings FOR ALL USING (public.has_role(auth.uid(), 'coordinator'));

-- Training tag assignments: readable by all authenticated, writable by coordinators
CREATE POLICY "Authenticated can view training tags" ON public.training_tag_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Coordinators can manage training tags" ON public.training_tag_assignments FOR ALL USING (public.has_role(auth.uid(), 'coordinator'));

-- User training assignments: users see own, supervisors see employees, coordinators see all
CREATE POLICY "Users can view own assignments" ON public.user_training_assignments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Coordinators can view all assignments" ON public.user_training_assignments FOR SELECT USING (public.has_role(auth.uid(), 'coordinator'));
CREATE POLICY "Supervisors can view employee assignments" ON public.user_training_assignments FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.supervisor_employee_mappings WHERE supervisor_id = auth.uid() AND employee_id = user_training_assignments.user_id)
);
CREATE POLICY "Coordinators can manage assignments" ON public.user_training_assignments FOR ALL USING (public.has_role(auth.uid(), 'coordinator'));

-- Training completions: users see own, supervisors see employees, coordinators see all
CREATE POLICY "Users can view own completions" ON public.training_completions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own completions" ON public.training_completions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Coordinators can view all completions" ON public.training_completions FOR SELECT USING (public.has_role(auth.uid(), 'coordinator'));
CREATE POLICY "Supervisors can view employee completions" ON public.training_completions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.supervisor_employee_mappings WHERE supervisor_id = auth.uid() AND employee_id = training_completions.user_id)
);
CREATE POLICY "Supervisors can update employee completions" ON public.training_completions FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.supervisor_employee_mappings WHERE supervisor_id = auth.uid() AND employee_id = training_completions.user_id)
);
CREATE POLICY "Coordinators can manage completions" ON public.training_completions FOR ALL USING (public.has_role(auth.uid(), 'coordinator'));

-- Supervisor-employee mappings: supervisors see own, coordinators see all
CREATE POLICY "Supervisors can view own mappings" ON public.supervisor_employee_mappings FOR SELECT USING (auth.uid() = supervisor_id);
CREATE POLICY "Coordinators can view all mappings" ON public.supervisor_employee_mappings FOR SELECT USING (public.has_role(auth.uid(), 'coordinator'));
CREATE POLICY "Coordinators can manage mappings" ON public.supervisor_employee_mappings FOR ALL USING (public.has_role(auth.uid(), 'coordinator'));

-- Auto-create profile trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, net_id)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), COALESCE(NEW.raw_user_meta_data->>'net_id', NEW.email));
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'employee');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Storage bucket for training materials
INSERT INTO storage.buckets (id, name, public) VALUES ('training-materials', 'training-materials', true);

CREATE POLICY "Authenticated can view training materials" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'training-materials');
CREATE POLICY "Coordinators can upload training materials" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'training-materials' AND public.has_role(auth.uid(), 'coordinator'));
CREATE POLICY "Coordinators can update training materials" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'training-materials' AND public.has_role(auth.uid(), 'coordinator'));
CREATE POLICY "Coordinators can delete training materials" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'training-materials' AND public.has_role(auth.uid(), 'coordinator'));
