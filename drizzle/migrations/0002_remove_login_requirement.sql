DO $$ DECLARE r record; BEGIN
FOR r IN SELECT policyname, tablename FROM pg_policies WHERE schemaname='public' AND tablename IN ('user_planner','monthly_routines') LOOP
EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename); END LOOP; END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_planner TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monthly_routines TO anon, authenticated;
CREATE POLICY "Family access" ON public.user_planner FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Family access" ON public.monthly_routines FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
DO $$ DECLARE f record; BEGIN
FOR f IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'planner\_%' LOOP
EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated', f.sig); END LOOP; END $$;