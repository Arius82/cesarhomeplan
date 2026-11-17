CREATE TABLE public.monthly_routines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_name text NOT NULL,
  title text NOT NULL,
  day_of_month integer,
  specific_date date,
  completed jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monthly_routines TO anon, authenticated;
GRANT ALL ON public.monthly_routines TO service_role;
ALTER TABLE public.monthly_routines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read routines" ON public.monthly_routines FOR SELECT USING (true);
CREATE POLICY "Anyone can insert routines" ON public.monthly_routines FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update routines" ON public.monthly_routines FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete routines" ON public.monthly_routines FOR DELETE USING (true);
ALTER TABLE public.monthly_routines REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.monthly_routines;