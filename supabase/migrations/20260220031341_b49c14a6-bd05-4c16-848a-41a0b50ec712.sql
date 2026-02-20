CREATE POLICY "Employees can view own supervisor mapping"
ON public.supervisor_employee_mappings
FOR SELECT
USING (auth.uid() = employee_id);