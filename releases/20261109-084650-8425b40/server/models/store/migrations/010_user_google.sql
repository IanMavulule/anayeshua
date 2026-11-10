-- Entrada com Google: a conta Google (claim `sub`) fica ligada ao membro.
-- Uma conta só com Google não tem palavra-passe (password_hash vazio).
ALTER TABLE users ADD COLUMN google_id text;
CREATE UNIQUE INDEX users_google_id_key ON users (google_id) WHERE google_id IS NOT NULL;
