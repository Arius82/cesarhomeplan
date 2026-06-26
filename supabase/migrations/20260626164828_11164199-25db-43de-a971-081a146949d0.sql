
CREATE TABLE public.user_planner (
  name text PRIMARY KEY,
  week text NOT NULL DEFAULT '',
  tasks jsonb NOT NULL DEFAULT '{}'::jsonb,
  checked jsonb NOT NULL DEFAULT '{}'::jsonb,
  theme text NOT NULL DEFAULT 'blue',
  icon text NOT NULL DEFAULT '🏠',
  custom_bg_color text NOT NULL DEFAULT '#ffffff',
  custom_text_color text NOT NULL DEFAULT '#000000',
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_planner TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_planner TO authenticated;
GRANT ALL ON public.user_planner TO service_role;

ALTER TABLE public.user_planner ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read planner" ON public.user_planner FOR SELECT USING (true);
CREATE POLICY "Anyone can insert planner" ON public.user_planner FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update planner" ON public.user_planner FOR UPDATE USING (true) WITH CHECK (true);

ALTER TABLE public.user_planner REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_planner;
