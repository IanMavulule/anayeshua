-- 001 — Linha de base: o esquema de documentos JSONB que `ensureSchema` criava.
-- Idempotente (IF NOT EXISTS): numa base criada pela versão anterior não muda
-- nada e só fica registada como aplicada. As migrações seguintes passam cada
-- colecção para tabelas relacionais e renomeiam estas para legacy_*.

CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  position bigint NOT NULL DEFAULT 0,
  doc jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS courses (
  id text PRIMARY KEY,
  position bigint NOT NULL DEFAULT 0,
  doc jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS events (
  id text PRIMARY KEY,
  position bigint NOT NULL DEFAULT 0,
  doc jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS testimonies (
  id text PRIMARY KEY,
  position bigint NOT NULL DEFAULT 0,
  doc jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS posts (
  id text PRIMARY KEY,
  position bigint NOT NULL DEFAULT 0,
  doc jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS questions (
  id text PRIMARY KEY,
  position bigint NOT NULL DEFAULT 0,
  doc jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS feedback (
  id text PRIMARY KEY,
  position bigint NOT NULL DEFAULT 0,
  doc jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS payments (
  id text PRIMARY KEY,
  position bigint NOT NULL DEFAULT 0,
  doc jsonb NOT NULL
);

-- Um e-mail, uma conta (o código já normaliza para minúsculas).
CREATE UNIQUE INDEX IF NOT EXISTS users_email_key ON users ((lower(doc->>'email')));
CREATE INDEX IF NOT EXISTS questions_user_idx ON questions ((doc->>'userId'));
CREATE INDEX IF NOT EXISTS payments_user_idx ON payments ((doc->>'userId'));

CREATE TABLE IF NOT EXISTS settings (
  id int PRIMARY KEY CHECK (id = 1),
  doc jsonb NOT NULL
);
