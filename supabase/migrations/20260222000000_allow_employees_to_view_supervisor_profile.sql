CREATE POLICY "Employees can view their supervisor's profile"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.supervisor_employee_mappings
    WHERE employee_id = auth.uid()
    AND supervisor_id = profiles.user_id
  )
);
