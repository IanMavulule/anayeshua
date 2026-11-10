-- 003 — Agenda de eventos e conteúdo diário (posts) em colunas.
-- As tabelas JSONB ficam como legacy_events / legacy_posts (não se apaga nada).

-- Validação prévia: datas que não se possam converter fazem falhar a migração
-- (sem alterações) com a lista dos registos a corrigir.
DO $$
DECLARE bad text;
BEGIN
  SELECT string_agg(id, ', ') INTO bad FROM events
   WHERE COALESCE(doc->>'date', '') <> ''
     AND doc->>'date' !~ '^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?)?$';
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Eventos com data em formato desconhecido (corrija antes de migrar): %', bad;
  END IF;
  SELECT string_agg(id, ', ') INTO bad FROM posts
   WHERE COALESCE(doc->>'publishAt', '') = '' OR COALESCE(doc->>'createdAt', '') = '';
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Posts sem publishAt/createdAt (corrija antes de migrar): %', bad;
  END IF;
END $$;

ALTER TABLE events RENAME TO legacy_events;
ALTER INDEX events_pkey RENAME TO legacy_events_pkey;
ALTER TABLE posts RENAME TO legacy_posts;
ALTER INDEX posts_pkey RENAME TO legacy_posts_pkey;

CREATE TABLE events (
  id text PRIMARY KEY,
  position bigint NOT NULL DEFAULT 0,
  title text NOT NULL,
  kind text NOT NULL DEFAULT '',
  -- Data e hora locais do evento (campo datetime-local, sem fuso).
  starts_at timestamp,
  place text NOT NULL DEFAULT '',
  entry text NOT NULL DEFAULT '',
  status text NOT NULL CHECK (status IN ('published', 'draft')),
  description text NOT NULL DEFAULT ''
);
CREATE INDEX events_starts_at_idx ON events (starts_at);

CREATE TABLE posts (
  id text PRIMARY KEY,
  position bigint NOT NULL DEFAULT 0,
  type text NOT NULL CHECK (type IN ('daily-message', 'note', 'prayer-point')),
  title text NOT NULL,
  body text NOT NULL,
  language text NOT NULL CHECK (language IN ('pt', 'en')),
  publish_at timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('published', 'draft')),
  premium boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL
);
CREATE INDEX posts_publish_at_idx ON posts (publish_at);

INSERT INTO events (id, position, title, kind, starts_at, place, entry, status, description)
SELECT id, position,
       COALESCE(doc->>'title', ''),
       COALESCE(doc->>'kind', ''),
       NULLIF(doc->>'date', '')::timestamp,
       COALESCE(doc->>'place', ''),
       COALESCE(doc->>'entry', ''),
       COALESCE(doc->>'status', 'draft'),
       COALESCE(doc->>'description', '')
  FROM legacy_events;

INSERT INTO posts (id, position, type, title, body, language, publish_at, status, premium, created_at)
SELECT id, position,
       doc->>'type',
       COALESCE(doc->>'title', ''),
       COALESCE(doc->>'body', ''),
       COALESCE(doc->>'language', 'pt'),
       (doc->>'publishAt')::timestamptz,
       COALESCE(doc->>'status', 'draft'),
       COALESCE((doc->>'premium')::boolean, false),
       (doc->>'createdAt')::timestamptz
  FROM legacy_posts;
