-- 007 — Testemunhos, dúvidas e feedback da assistência em colunas, ligados ao
-- membro, ao curso e à aula. As tabelas JSONB ficam como legacy_testimonies,
-- legacy_questions e legacy_feedback (não se apaga nada).

DO $$
DECLARE bad text;
BEGIN
  SELECT string_agg(id, ', ') INTO bad FROM testimonies
   WHERE COALESCE(doc->>'date', '') !~ '^\d{4}-\d{2}-\d{2}$'
      OR COALESCE(doc->>'status', '') NOT IN ('pending', 'published', 'hidden');
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Testemunhos com data (AAAA-MM-DD) ou estado inválidos (corrija antes de migrar): %', bad;
  END IF;

  SELECT string_agg(id, ', ') INTO bad FROM questions
   WHERE COALESCE(doc->>'createdAt', '') = ''
      OR COALESCE(doc->>'status', '') NOT IN ('open', 'answered');
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Dúvidas com data ou estado inválidos (corrija antes de migrar): %', bad;
  END IF;

  SELECT string_agg(id, ', ') INTO bad FROM feedback
   WHERE COALESCE(doc->>'createdAt', '') = ''
      OR COALESCE(doc->>'rating', '') !~ '^[1-5]$';
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Feedback com data ou avaliação (1 a 5) inválidas (corrija antes de migrar): %', bad;
  END IF;
END $$;

ALTER TABLE testimonies RENAME TO legacy_testimonies;
ALTER INDEX testimonies_pkey RENAME TO legacy_testimonies_pkey;
ALTER TABLE questions RENAME TO legacy_questions;
ALTER INDEX questions_pkey RENAME TO legacy_questions_pkey;
ALTER INDEX questions_user_idx RENAME TO legacy_questions_user_idx;
ALTER TABLE feedback RENAME TO legacy_feedback;
ALTER INDEX feedback_pkey RENAME TO legacy_feedback_pkey;

-- Testemunhos ficam publicados mesmo que a conta, o curso ou a aula desapareçam
-- (o nome e a origem foram copiados no momento do envio).
CREATE TABLE testimonies (
  id text PRIMARY KEY,
  position bigint NOT NULL DEFAULT 0,
  user_id text REFERENCES users (id) ON DELETE SET NULL,
  name text NOT NULL DEFAULT '',
  text text NOT NULL,
  course_id text REFERENCES courses (id) ON DELETE SET NULL,
  lesson_id text REFERENCES lessons (id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'hidden')),
  -- Dia do envio (data de calendário, sem hora).
  date date NOT NULL
);
CREATE INDEX testimonies_lesson_idx ON testimonies (lesson_id);
CREATE INDEX testimonies_course_idx ON testimonies (course_id);

-- Uma dúvida pertence ao membro (apagar a conta apaga as dúvidas); a aula é
-- opcional e guarda-se o título no momento da pergunta.
CREATE TABLE questions (
  id text PRIMARY KEY,
  position bigint NOT NULL DEFAULT 0,
  user_id text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  subject text NOT NULL DEFAULT '',
  body text NOT NULL,
  course_id text REFERENCES courses (id) ON DELETE SET NULL,
  lesson_id text REFERENCES lessons (id) ON DELETE SET NULL,
  course_title text,
  lesson_title text,
  answer text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'answered')),
  created_at timestamptz NOT NULL,
  answered_at timestamptz
);
CREATE INDEX questions_user_idx ON questions (user_id);
CREATE INDEX questions_lesson_idx ON questions (lesson_id);

CREATE TABLE assistance_feedback (
  id text PRIMARY KEY,
  position bigint NOT NULL DEFAULT 0,
  user_id text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL
);
CREATE INDEX assistance_feedback_user_idx ON assistance_feedback (user_id);

-- Referências a contas, cursos ou aulas que já não existem ficam a NULL.
INSERT INTO testimonies (id, position, user_id, name, text, course_id, lesson_id, source, status, date)
SELECT t.id, t.position, u.id, COALESCE(t.doc->>'name', ''), COALESCE(t.doc->>'text', ''), c.id, l.id,
       COALESCE(t.doc->>'source', ''), t.doc->>'status', (t.doc->>'date')::date
  FROM legacy_testimonies t
  LEFT JOIN users u ON u.id = t.doc->>'userId'
  LEFT JOIN courses c ON c.id = t.doc->>'courseId'
  LEFT JOIN lessons l ON l.id = t.doc->>'lessonId';

-- Dúvidas e feedback de contas já apagadas não têm dono: não são copiados e
-- ficam apenas em legacy_questions / legacy_feedback.
INSERT INTO questions (id, position, user_id, name, email, subject, body, course_id, lesson_id,
                       course_title, lesson_title, answer, status, created_at, answered_at)
SELECT q.id, q.position, u.id, COALESCE(q.doc->>'name', ''), COALESCE(q.doc->>'email', ''),
       COALESCE(q.doc->>'subject', ''), COALESCE(q.doc->>'body', ''), c.id, l.id,
       q.doc->>'courseTitle', q.doc->>'lessonTitle', COALESCE(q.doc->>'answer', ''), q.doc->>'status',
       (q.doc->>'createdAt')::timestamptz, NULLIF(q.doc->>'answeredAt', '')::timestamptz
  FROM legacy_questions q
  JOIN users u ON u.id = q.doc->>'userId'
  LEFT JOIN courses c ON c.id = q.doc->>'courseId'
  LEFT JOIN lessons l ON l.id = q.doc->>'lessonId';

INSERT INTO assistance_feedback (id, position, user_id, name, rating, comment, created_at)
SELECT f.id, f.position, u.id, COALESCE(f.doc->>'name', ''), (f.doc->>'rating')::smallint,
       COALESCE(f.doc->>'comment', ''), (f.doc->>'createdAt')::timestamptz
  FROM legacy_feedback f
  JOIN users u ON u.id = f.doc->>'userId';
