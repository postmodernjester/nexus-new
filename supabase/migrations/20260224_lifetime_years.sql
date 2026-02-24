-- Lifetime page: year-by-year journal entries
CREATE TABLE IF NOT EXISTS lifetime_years (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  year integer NOT NULL,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, year)
);

-- RLS
ALTER TABLE lifetime_years ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own lifetime years"
  ON lifetime_years FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own lifetime years"
  ON lifetime_years FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own lifetime years"
  ON lifetime_years FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own lifetime years"
  ON lifetime_years FOR DELETE
  USING (auth.uid() = user_id);
