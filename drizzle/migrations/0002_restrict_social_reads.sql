DROP POLICY "Profiles viewable" ON public.profiles;
DROP POLICY "Reviews viewable" ON public.reviews;
DROP POLICY "Comments viewable" ON public.comments;
REVOKE SELECT ON public.profiles FROM anon;
REVOKE SELECT ON public.reviews FROM anon;
REVOKE SELECT ON public.comments FROM anon;
CREATE POLICY "Signed-in can view profiles" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Signed-in can view reviews" ON public.reviews FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Signed-in can view comments" ON public.comments FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);