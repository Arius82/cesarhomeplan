
-- Ensure a row exists for a user (idempotent)
CREATE OR REPLACE FUNCTION public.planner_ensure_row(p_name text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_planner(name) VALUES (p_name)
  ON CONFLICT (name) DO NOTHING;
END$$;

-- Append a task to a given day
CREATE OR REPLACE FUNCTION public.planner_add_task(p_name text, p_day text, p_text text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.planner_ensure_row(p_name);
  UPDATE public.user_planner
  SET tasks = jsonb_set(
        COALESCE(tasks, '{}'::jsonb),
        ARRAY[p_day],
        COALESCE(tasks->p_day, '[]'::jsonb) || to_jsonb(p_text),
        true
      ),
      updated_at = now()
  WHERE name = p_name;
END$$;

-- Remove a task by index and re-key the checked map
CREATE OR REPLACE FUNCTION public.planner_remove_task(p_name text, p_day text, p_idx int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  arr jsonb;
  chk jsonb;
  new_chk jsonb := '{}'::jsonb;
  k text;
  v jsonb;
  parts text[];
  d text;
  i int;
BEGIN
  SELECT COALESCE(tasks->p_day, '[]'::jsonb), COALESCE(checked, '{}'::jsonb)
    INTO arr, chk
    FROM public.user_planner WHERE name = p_name;
  IF arr IS NULL OR p_idx < 0 OR p_idx >= jsonb_array_length(arr) THEN
    RETURN;
  END IF;
  arr := arr - p_idx;
  FOR k, v IN SELECT * FROM jsonb_each(chk) LOOP
    parts := string_to_array(k, '-');
    IF array_length(parts, 1) >= 2 THEN
      d := parts[1];
      BEGIN
        i := parts[2]::int;
      EXCEPTION WHEN others THEN
        new_chk := new_chk || jsonb_build_object(k, v);
        CONTINUE;
      END;
      IF d = p_day THEN
        IF i < p_idx THEN
          new_chk := new_chk || jsonb_build_object(k, v);
        ELSIF i > p_idx THEN
          new_chk := new_chk || jsonb_build_object(d || '-' || (i-1)::text, v);
        END IF;
      ELSE
        new_chk := new_chk || jsonb_build_object(k, v);
      END IF;
    ELSE
      new_chk := new_chk || jsonb_build_object(k, v);
    END IF;
  END LOOP;
  UPDATE public.user_planner
  SET tasks = jsonb_set(tasks, ARRAY[p_day], arr, true),
      checked = new_chk,
      updated_at = now()
  WHERE name = p_name;
END$$;

-- Edit a task text by index
CREATE OR REPLACE FUNCTION public.planner_edit_task(p_name text, p_day text, p_idx int, p_text text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  arr jsonb;
BEGIN
  SELECT COALESCE(tasks->p_day, '[]'::jsonb) INTO arr FROM public.user_planner WHERE name = p_name;
  IF arr IS NULL OR p_idx < 0 OR p_idx >= jsonb_array_length(arr) THEN
    RETURN;
  END IF;
  UPDATE public.user_planner
  SET tasks = jsonb_set(tasks, ARRAY[p_day, p_idx::text], to_jsonb(p_text), true),
      updated_at = now()
  WHERE name = p_name;
END$$;

-- Toggle checked flag for a task
CREATE OR REPLACE FUNCTION public.planner_toggle_check(p_name text, p_day text, p_idx int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  key text := p_day || '-' || p_idx::text;
  cur boolean;
BEGIN
  PERFORM public.planner_ensure_row(p_name);
  SELECT COALESCE((checked->>key)::boolean, false) INTO cur FROM public.user_planner WHERE name = p_name;
  UPDATE public.user_planner
  SET checked = jsonb_set(COALESCE(checked, '{}'::jsonb), ARRAY[key], to_jsonb(NOT cur), true),
      updated_at = now()
  WHERE name = p_name;
END$$;

-- Update one or more metadata fields (NULL = leave unchanged)
CREATE OR REPLACE FUNCTION public.planner_update_meta(
  p_name text,
  p_week text DEFAULT NULL,
  p_icon text DEFAULT NULL,
  p_bg text DEFAULT NULL,
  p_text_color text DEFAULT NULL,
  p_theme text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.planner_ensure_row(p_name);
  UPDATE public.user_planner
  SET week = COALESCE(p_week, week),
      icon = COALESCE(p_icon, icon),
      custom_bg_color = COALESCE(p_bg, custom_bg_color),
      custom_text_color = COALESCE(p_text_color, custom_text_color),
      theme = COALESCE(p_theme, theme),
      updated_at = now()
  WHERE name = p_name;
END$$;

GRANT EXECUTE ON FUNCTION public.planner_ensure_row(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.planner_add_task(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.planner_remove_task(text, text, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.planner_edit_task(text, text, int, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.planner_toggle_check(text, text, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.planner_update_meta(text, text, text, text, text, text) TO anon, authenticated;
