-- Add key_links JSONB column to profiles so world profile pages can display links
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS key_links JSONB DEFAULT '[]'::jsonb;

-- Copy existing key_links from auth.users metadata into profiles for users who saved them there
UPDATE public.profiles p
SET key_links = (
  SELECT COALESCE(u.raw_user_meta_data->'key_links', '[]'::jsonb)
  FROM auth.users u
  WHERE u.id = p.id
)
WHERE p.key_links = '[]'::jsonb
  AND EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = p.id
      AND u.raw_user_meta_data->'key_links' IS NOT NULL
      AND u.raw_user_meta_data->'key_links' != '[]'::jsonb
  );
