-- Make training-materials bucket private
UPDATE storage.buckets SET public = false WHERE id = 'training-materials';