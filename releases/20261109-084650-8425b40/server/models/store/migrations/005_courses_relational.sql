-- 005 — Cursos → módulos → aulas, e pontos de oração, em tabelas relacionais.
-- A tabela JSONB fica como legacy_courses (não se apaga nada).

-- Validação prévia: a migração falha (sem alterações) se houver dados que as
-- novas chaves não aceitem, com a lista do que corrigir.
DO $$
DECLARE bad text;
BEGIN
  -- O id da aula passa a ser único em toda a plataforma (é usado nos endereços e nos vídeos).
  SELECT string_agg(DISTINCT lesson_id, ', ') INTO bad FROM (
    SELECT l.value->>'id' AS lesson_id
      FROM courses c
     CROSS JOIN LATERAL jsonb_array_elements(COALESCE(c.doc->'modules', '[]'::jsonb)) AS m(value)
     CROSS JOIN LATERAL jsonb_array_elements(COALESCE(m.value->'lessons', '[]'::jsonb)) AS l(value)
     GROUP BY l.value->>'id' HAVING count(*) > 1
  ) duplicated;
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Aulas com o mesmo id (em cursos ou módulos diferentes; corrija antes de migrar): %', bad;
  END IF;

  SELECT string_agg(course_module, ', ') INTO bad FROM (
    SELECT c.id || '/' || (m.value->>'id') AS course_module
      FROM courses c
     CROSS JOIN LATERAL jsonb_array_elements(COALESCE(c.doc->'modules', '[]'::jsonb)) AS m(value)
     GROUP BY c.id, m.value->>'id' HAVING count(*) > 1
  ) duplicated;
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Módulos repetidos no mesmo curso (corrija antes de migrar): %', bad;
  END IF;

  SELECT string_agg(id, ', ') INTO bad FROM courses
   WHERE COALESCE(doc->>'publishAt', '') <> ''
     AND doc->>'publishAt' !~ '^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?)?$';
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Cursos com publishAt em formato desconhecido (corrija antes de migrar): %', bad;
  END IF;
END $$;

ALTER TABLE courses RENAME TO legacy_courses;
ALTER INDEX courses_pkey RENAME TO legacy_courses_pkey;

-- Valores de categoria/nível usados em cursos mas que já não estão nas
-- Configurações passam a opções (rótulo = id), para não perder a ligação.
INSERT INTO course_field_options (field, id, label, label_en, position)
SELECT f.field, f.value, f.value, '', 1000 + row_number() OVER (PARTITION BY f.field ORDER BY f.value)
  FROM (
    SELECT DISTINCT 'category' AS field, doc->>'category' AS value FROM legacy_courses
    UNION
    SELECT DISTINCT 'level', doc->>'level' FROM legacy_courses
  ) f
 WHERE COALESCE(f.value, '') <> ''
   AND NOT EXISTS (SELECT 1 FROM course_field_options o WHERE o.field = f.field AND o.id = f.value);

CREATE TABLE courses (
  id text PRIMARY KEY,
  position bigint NOT NULL DEFAULT 0,
  title text NOT NULL,
  -- Opções das Configurações; NULL = campo desligado / sem valor.
  category text,
  category_field text NOT NULL DEFAULT 'category' CHECK (category_field = 'category'),
  level text,
  level_field text NOT NULL DEFAULT 'level' CHECK (level_field = 'level'),
  status text NOT NULL CHECK (status IN ('published', 'draft', 'hidden', 'scheduled')),
  access text NOT NULL DEFAULT 'premium' CHECK (access IN ('free', 'premium')),
  -- Data e hora locais de publicação agendada (campo datetime-local, sem fuso).
  publish_at timestamp,
  instructor text NOT NULL DEFAULT '',
  cover text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  featured boolean NOT NULL DEFAULT false,
  updated_at timestamptz,
  views integer NOT NULL DEFAULT 0 CHECK (views >= 0),
  students integer NOT NULL DEFAULT 0 CHECK (students >= 0),
  FOREIGN KEY (category_field, category) REFERENCES course_field_options (field, id),
  FOREIGN KEY (level_field, level) REFERENCES course_field_options (field, id)
);
CREATE INDEX courses_category_idx ON courses (category);
CREATE INDEX courses_level_idx ON courses (level);

-- O id do módulo só é único dentro do curso.
CREATE TABLE course_modules (
  course_id text NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
  id text NOT NULL,
  position integer NOT NULL,
  title text NOT NULL DEFAULT '',
  PRIMARY KEY (course_id, id)
);

CREATE TABLE lessons (
  id text PRIMARY KEY,
  course_id text NOT NULL,
  module_id text NOT NULL,
  position integer NOT NULL,
  title text NOT NULL DEFAULT '',
  free boolean NOT NULL DEFAULT false,
  -- Vídeo carregado (videos/<id>.mp4): todos os campos ou nenhum.
  video_name text,
  video_size bigint CHECK (video_size >= 0),
  video_duration double precision CHECK (video_duration >= 0),
  video_type text,
  CHECK ((video_name IS NULL) = (video_size IS NULL)
     AND (video_name IS NULL) = (video_duration IS NULL)
     AND (video_name IS NULL) = (video_type IS NULL)),
  UNIQUE (id, course_id),
  FOREIGN KEY (course_id, module_id) REFERENCES course_modules (course_id, id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX lessons_module_idx ON lessons (course_id, module_id, position);

-- Pontos de oração do curso (lesson_id NULL) ou de uma aula desse curso.
CREATE TABLE prayer_points (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  course_id text NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
  lesson_id text,
  position integer NOT NULL,
  text text NOT NULL CHECK (text <> ''),
  FOREIGN KEY (lesson_id, course_id) REFERENCES lessons (id, course_id) ON DELETE CASCADE
);
CREATE INDEX prayer_points_course_idx ON prayer_points (course_id, lesson_id, position);

INSERT INTO courses (id, position, title, category, level, status, access, publish_at, instructor, cover, description, featured, updated_at, views, students)
SELECT id, position,
       COALESCE(doc->>'title', ''),
       NULLIF(doc->>'category', ''),
       NULLIF(doc->>'level', ''),
       COALESCE(doc->>'status', 'draft'),
       COALESCE(NULLIF(doc->>'access', ''), 'premium'),
       NULLIF(doc->>'publishAt', '')::timestamp,
       COALESCE(doc->>'instructor', ''),
       COALESCE(doc->>'cover', ''),
       COALESCE(doc->>'description', ''),
       COALESCE((doc->>'featured')::boolean, false),
       -- `updated` era o minuto em UTC, sem designador de fuso.
       NULLIF(doc->>'updated', '')::timestamp AT TIME ZONE 'UTC',
       COALESCE((doc->>'views')::numeric::integer, 0),
       COALESCE((doc->>'students')::numeric::integer, 0)
  FROM legacy_courses;

INSERT INTO course_modules (course_id, id, position, title)
SELECT c.id, m.value->>'id', m.ordinality - 1, COALESCE(m.value->>'title', '')
  FROM legacy_courses c
 CROSS JOIN LATERAL jsonb_array_elements(COALESCE(c.doc->'modules', '[]'::jsonb)) WITH ORDINALITY AS m(value, ordinality);

INSERT INTO lessons (id, course_id, module_id, position, title, free, video_name, video_size, video_duration, video_type)
SELECT l.value->>'id', c.id, m.value->>'id', l.ordinality - 1,
       COALESCE(l.value->>'title', ''),
       COALESCE((l.value->>'free')::boolean, false),
       CASE WHEN jsonb_typeof(l.value->'video') = 'object' THEN COALESCE(l.value->'video'->>'name', '') END,
       CASE WHEN jsonb_typeof(l.value->'video') = 'object' THEN COALESCE((l.value->'video'->>'size')::numeric::bigint, 0) END,
       CASE WHEN jsonb_typeof(l.value->'video') = 'object' THEN COALESCE((l.value->'video'->>'duration')::double precision, 0) END,
       CASE WHEN jsonb_typeof(l.value->'video') = 'object' THEN COALESCE(l.value->'video'->>'type', '') END
  FROM legacy_courses c
 CROSS JOIN LATERAL jsonb_array_elements(COALESCE(c.doc->'modules', '[]'::jsonb)) WITH ORDINALITY AS m(value, ordinality)
 CROSS JOIN LATERAL jsonb_array_elements(COALESCE(m.value->'lessons', '[]'::jsonb)) WITH ORDINALITY AS l(value, ordinality);

INSERT INTO prayer_points (course_id, lesson_id, position, text)
SELECT c.id, NULL, p.ordinality - 1, p.value
  FROM legacy_courses c
 CROSS JOIN LATERAL jsonb_array_elements_text(
         CASE WHEN jsonb_typeof(c.doc->'prayerPoints') = 'array' THEN c.doc->'prayerPoints' ELSE '[]'::jsonb END
       ) WITH ORDINALITY AS p(value, ordinality)
 WHERE p.value <> '';

INSERT INTO prayer_points (course_id, lesson_id, position, text)
SELECT c.id, l.value->>'id', p.ordinality - 1, p.value
  FROM legacy_courses c
 CROSS JOIN LATERAL jsonb_array_elements(COALESCE(c.doc->'modules', '[]'::jsonb)) AS m(value)
 CROSS JOIN LATERAL jsonb_array_elements(COALESCE(m.value->'lessons', '[]'::jsonb)) AS l(value)
 CROSS JOIN LATERAL jsonb_array_elements_text(
         CASE WHEN jsonb_typeof(l.value->'prayerPoints') = 'array' THEN l.value->'prayerPoints' ELSE '[]'::jsonb END
       ) WITH ORDINALITY AS p(value, ordinality)
 WHERE p.value <> '';
