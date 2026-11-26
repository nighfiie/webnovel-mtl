CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

CREATE POLICY "Users can read own roles"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all roles"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.novels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid,
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  original_title text,
  language_mode text NOT NULL DEFAULT 'single',
  translated_language text DEFAULT 'English',
  original_language text DEFAULT 'Chinese',
  original_author text,
  synopsis text,
  cover_url text,
  featured_image_url text,
  category text NOT NULL DEFAULT 'Fantasy',
  genres text[] NOT NULL DEFAULT '{}',
  tags text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'ongoing',
  total_chapters integer NOT NULL DEFAULT 0,
  rating numeric(3,2) NOT NULL DEFAULT 4.50,
  view_count integer NOT NULL DEFAULT 0,
  weekly_views integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.novels TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.novels TO authenticated;
GRANT ALL ON public.novels TO service_role;

ALTER TABLE public.novels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view novels"
  ON public.novels
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admins can insert novels"
  ON public.novels
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update novels"
  ON public.novels
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete novels"
  ON public.novels
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.chapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  novel_id uuid NOT NULL REFERENCES public.novels(id) ON DELETE CASCADE,
  number numeric NOT NULL,
  title text NOT NULL,
  content_translated text,
  content_original text,
  source_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (novel_id, number)
);

CREATE INDEX chapters_novel_id_number_idx ON public.chapters (novel_id, number);

GRANT SELECT ON public.chapters TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chapters TO authenticated;
GRANT ALL ON public.chapters TO service_role;

ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view chapters"
  ON public.chapters
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admins can insert chapters"
  ON public.chapters
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update chapters"
  ON public.chapters
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete chapters"
  ON public.chapters
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.sync_novel_chapter_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.novels
    SET total_chapters = (SELECT count(*) FROM public.chapters WHERE novel_id = OLD.novel_id),
        updated_at = now()
    WHERE id = OLD.novel_id;
    RETURN OLD;
  ELSE
    UPDATE public.novels
    SET total_chapters = (SELECT count(*) FROM public.chapters WHERE novel_id = NEW.novel_id),
        updated_at = now()
    WHERE id = NEW.novel_id;
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER sync_novel_chapter_count_trigger
  AFTER INSERT OR DELETE ON public.chapters
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_novel_chapter_count();