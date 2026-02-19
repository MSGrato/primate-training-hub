-- Add updated_by column to trainings to track which coordinator last edited a training
ALTER TABLE public.trainings ADD COLUMN updated_by UUID REFERENCES auth.users(id);
