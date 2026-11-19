DROP POLICY IF EXISTS "Anyone can delete routines" ON public.monthly_routines;
DROP POLICY IF EXISTS "Anyone can insert routines" ON public.monthly_routines;
DROP POLICY IF EXISTS "Anyone can read routines" ON public.monthly_routines;
DROP POLICY IF EXISTS "Anyone can update routines" ON public.monthly_routines;
DROP POLICY IF EXISTS "Anyone can insert planner" ON public.user_planner;
DROP POLICY IF EXISTS "Anyone can read planner" ON public.user_planner;
DROP POLICY IF EXISTS "Anyone can update planner" ON public.user_planner;

REVOKE ALL ON public.monthly_routines FROM anon;
REVOKE ALL ON public.user_planner FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monthly_routines TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_planner TO authenticated;

CREATE POLICY "Signed-in can read routines" ON public.monthly_routines FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Signed-in can insert routines" ON public.monthly_routines FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Signed-in can update routines" ON public.monthly_routines FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Signed-in can delete routines" ON public.monthly_routines FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Signed-in can read planner" ON public.user_planner FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Signed-in can insert planner" ON public.user_planner FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Signed-in can update planner" ON public.user_planner FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

REVOKE EXECUTE ON FUNCTION public.planner_add_task(text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.planner_edit_task(text, text, integer, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.planner_ensure_row(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.planner_remove_task(text, text, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.planner_toggle_check(text, text, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.planner_update_meta(text, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.planner_add_task(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.planner_edit_task(text, text, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.planner_ensure_row(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.planner_remove_task(text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.planner_toggle_check(text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.planner_update_meta(text, text, text, text, text, text) TO authenticated;