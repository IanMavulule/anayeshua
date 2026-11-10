-- 004 — Utilizadores em colunas e a subscrição actual numa tabela própria (1:1).
-- A tabela JSONB fica como legacy_users (não se apaga nada).

DO $$
DECLARE bad text;
BEGIN
  SELECT string_agg(id, ', ') INTO bad FROM users
   WHERE jsonb_typeof(doc->'subscription') = 'object'
     AND (doc->'subscription'->>'plan' IS DISTINCT FROM '200' AND doc->'subscription'->>'plan' IS DISTINCT FROM '500'
          OR COALESCE(doc->'subscription'->>'startedAt', '') = '' OR COALESCE(doc->'subscription'->>'expiresAt', '') = '');
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Utilizadores com subscrição inválida (plano ou datas; corrija antes de migrar): %', bad;
  END IF;
END $$;

ALTER TABLE users RENAME TO legacy_users;
ALTER INDEX users_pkey RENAME TO legacy_users_pkey;
ALTER INDEX users_email_key RENAME TO legacy_users_email_key;

CREATE TABLE users (
  id text PRIMARY KEY,
  position bigint NOT NULL DEFAULT 0,
  name text NOT NULL,
  email text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  language text NOT NULL DEFAULT 'pt' CHECK (language IN ('pt', 'en')),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);
CREATE UNIQUE INDEX users_email_key ON users (lower(email));

-- Subscrição Premium actual de cada membro (no máximo uma: user_id é a chave).
-- A chave estrangeira para payments é acrescentada quando os pagamentos passarem a colunas.
CREATE TABLE subscriptions (
  user_id text PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  plan text NOT NULL CHECK (plan IN ('200', '500')),
  started_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  -- Fim da assistência pessoal; NULL = sem assistência.
  assistance_expires_at timestamptz,
  payment_id text
);
CREATE INDEX subscriptions_expires_at_idx ON subscriptions (expires_at);

INSERT INTO users (id, position, name, email, password_hash, role, status, language, created_at, last_login_at)
SELECT id, position,
       COALESCE(doc->>'name', ''),
       COALESCE(doc->>'email', ''),
       COALESCE(doc->>'passwordHash', ''),
       COALESCE(doc->>'role', 'member'),
       COALESCE(doc->>'status', 'active'),
       COALESCE(doc->>'language', 'pt'),
       COALESCE(NULLIF(doc->>'createdAt', '')::timestamptz, now()),
       NULLIF(doc->>'lastLoginAt', '')::timestamptz
  FROM legacy_users;

-- Registos antigos sem assistanceExpiresAt: o plano com assistência (500) dava-a
-- até ao fim da subscrição (mesma regra que assistanceEnd em userModel.ts).
INSERT INTO subscriptions (user_id, plan, started_at, expires_at, assistance_expires_at, payment_id)
SELECT id,
       doc->'subscription'->>'plan',
       (doc->'subscription'->>'startedAt')::timestamptz,
       (doc->'subscription'->>'expiresAt')::timestamptz,
       CASE
         WHEN doc->'subscription' ? 'assistanceExpiresAt' THEN NULLIF(doc->'subscription'->>'assistanceExpiresAt', '')::timestamptz
         WHEN doc->'subscription'->>'plan' = '500' THEN (doc->'subscription'->>'expiresAt')::timestamptz
       END,
       NULLIF(doc->'subscription'->>'paymentId', '')
  FROM legacy_users
 WHERE jsonb_typeof(doc->'subscription') = 'object';
