-- 008 — Conversão dos vídeos em várias qualidades (HLS) e registo de
-- problemas do servidor para a administração.

-- Uma linha por aula e qualidade. Sem chave estrangeira para `lessons`: o
-- vídeo pode ser carregado antes de o curso ser guardado (a aula ainda não
-- existe na base), e a conversão depende só do ficheiro em videos/<id>.mp4.
CREATE TABLE video_renditions (
  lesson_id text NOT NULL CHECK (lesson_id ~ '^[A-Za-z0-9_-]{1,64}$'),
  quality text NOT NULL CHECK (quality IN ('360p', '480p', '720p')),
  -- Tamanho e data do MP4 original quando a tarefa foi criada; se o vídeo for
  -- substituído a meio, a conversão antiga é descartada.
  source_version text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'ready', 'failed', 'skipped')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error text,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  width integer CHECK (width > 0),
  height integer CHECK (height > 0),
  bandwidth integer CHECK (bandwidth > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (lesson_id, quality)
);
CREATE INDEX video_renditions_queue_idx ON video_renditions (status, next_attempt_at);

-- Problemas do servidor mostrados só à administração (painel Servidor).
CREATE TABLE server_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  level text NOT NULL CHECK (level IN ('error', 'warning', 'info')),
  source text NOT NULL CHECK (source <> ''),
  message text NOT NULL CHECK (message <> ''),
  detail text,
  resolved_at timestamptz
);
CREATE INDEX server_events_created_idx ON server_events (created_at DESC);
CREATE INDEX server_events_open_idx ON server_events (level) WHERE resolved_at IS NULL;
