-- Add birthday and profile photo fields to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birthday DATE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;
