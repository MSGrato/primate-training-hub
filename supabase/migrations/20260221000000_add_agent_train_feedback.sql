CREATE TABLE public.agent_train_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  prompt text NOT NULL,
  response_summary text NOT NULL,
  intent text,
  rating smallint NOT NULL CHECK (rating IN (1, -1)),
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.agent_train_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own feedback"
ON public.agent_train_feedback
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own feedback"
ON public.agent_train_feedback
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Coordinators can view all feedback"
ON public.agent_train_feedback
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'coordinator'
  )
);
