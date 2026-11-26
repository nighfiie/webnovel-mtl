ALTER TABLE public.novels ADD COLUMN reviews_count integer NOT NULL DEFAULT 0 CHECK (reviews_count >= 0);
ALTER TABLE public.novels ALTER COLUMN rating SET DEFAULT 0;
CREATE OR REPLACE FUNCTION public.sync_novel_rating() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE affected uuid[];
BEGIN
  IF TG_OP = 'INSERT' THEN affected := ARRAY[NEW.novel_id];
  ELSIF TG_OP = 'DELETE' THEN affected := ARRAY[OLD.novel_id];
  ELSE affected := ARRAY[OLD.novel_id, NEW.novel_id]; END IF;
  PERFORM id FROM public.novels WHERE id = ANY(affected) ORDER BY id FOR UPDATE;
  UPDATE public.novels n SET
    rating = COALESCE((SELECT round(avg(r.rating)::numeric, 2) FROM public.reviews r WHERE r.novel_id = n.id), 0),
    reviews_count = (SELECT count(*)::integer FROM public.reviews r WHERE r.novel_id = n.id)
  WHERE n.id = ANY(affected);
  RETURN NULL;
END $$;
UPDATE public.novels n SET rating = COALESCE((SELECT round(avg(r.rating)::numeric, 2) FROM public.reviews r WHERE r.novel_id = n.id), 0), reviews_count = (SELECT count(*)::integer FROM public.reviews r WHERE r.novel_id = n.id);