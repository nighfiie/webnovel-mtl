DROP POLICY "Signed-in can view reviews" ON public.reviews;
DROP POLICY "Signed-in can view comments" ON public.comments;
DROP POLICY "Signed-in can view profiles" ON public.profiles;
CREATE POLICY "Own or admin view reviews" ON public.reviews FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Own or admin view comments" ON public.comments FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Own or admin view profiles" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id OR public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.get_novel_reviews(_novel_id uuid)
RETURNS TABLE (id uuid, user_id uuid, rating smallint, body text, created_at timestamptz, display_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, r.user_id, r.rating, r.body, r.created_at, p.display_name
  FROM public.reviews r LEFT JOIN public.profiles p ON p.id = r.user_id
  WHERE r.novel_id = _novel_id AND auth.uid() IS NOT NULL
  ORDER BY r.created_at DESC LIMIT 100
$$;
CREATE OR REPLACE FUNCTION public.get_chapter_comments(_chapter_id uuid)
RETURNS TABLE (id uuid, user_id uuid, body text, created_at timestamptz, display_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.user_id, c.body, c.created_at, p.display_name
  FROM public.comments c LEFT JOIN public.profiles p ON p.id = c.user_id
  WHERE c.chapter_id = _chapter_id AND auth.uid() IS NOT NULL
  ORDER BY c.created_at ASC LIMIT 200
$$;
REVOKE EXECUTE ON FUNCTION public.get_novel_reviews(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_chapter_comments(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_novel_reviews(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_chapter_comments(uuid) TO authenticated;