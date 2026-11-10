-- 002 — Configurações em colunas e opções de categoria/nível numa tabela própria.
-- O documento antigo fica em legacy_settings (não se apaga nada).

ALTER TABLE settings RENAME TO legacy_settings;
ALTER INDEX settings_pkey RENAME TO legacy_settings_pkey;

CREATE TABLE settings (
  id integer PRIMARY KEY CHECK (id = 1),
  name text NOT NULL,
  email text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  moderation boolean NOT NULL DEFAULT true,
  comments boolean NOT NULL DEFAULT true,
  signups boolean NOT NULL DEFAULT true,
  maintenance boolean NOT NULL DEFAULT false,
  -- Campos do curso que a administração pode desligar.
  categories_enabled boolean NOT NULL DEFAULT true,
  levels_enabled boolean NOT NULL DEFAULT true
);

-- Opções configuráveis dos cursos. Os cursos referenciam-nas por (field, id)
-- (chave estrangeira a partir da migração dos cursos).
CREATE TABLE course_field_options (
  field text NOT NULL CHECK (field IN ('category', 'level')),
  id text NOT NULL CHECK (id <> ''),
  label text NOT NULL,
  label_en text NOT NULL DEFAULT '',
  position integer NOT NULL,
  PRIMARY KEY (field, id)
);

-- Valores por omissão desta versão (iguais a DEFAULT_SETTINGS em database.ts),
-- completados com o que estava guardado (o documento guardado tem precedência,
-- chave a chave, como o `{ ...fallback, ...doc }` do código anterior).
CREATE TEMPORARY TABLE migrating_settings ON COMMIT DROP AS
SELECT '{
  "name": "Ana Yeshua - Holy Ghost Ministering",
  "email": "",
  "description": "Ministério Profético · Espírito Santo · Mulheres e Propósito.",
  "moderation": true,
  "comments": true,
  "signups": true,
  "maintenance": false,
  "categories": {
    "enabled": true,
    "options": [
      { "id": "espirito-santo", "label": "Ministério do Espírito Santo", "labelEn": "Ministry of the Holy Spirit" },
      { "id": "profetico", "label": "Ministério Profético", "labelEn": "Prophetic ministry" },
      { "id": "mulheres", "label": "Mulheres e Propósito", "labelEn": "Women and purpose" },
      { "id": "palavra", "label": "Palavra de Deus", "labelEn": "Word of God" },
      { "id": "oracao", "label": "Oração, Intercessão e Adoração", "labelEn": "Prayer, intercession and worship" },
      { "id": "ministerial", "label": "Actividade Ministerial", "labelEn": "Ministerial activity" }
    ]
  },
  "levels": {
    "enabled": true,
    "options": [
      { "id": "iniciante", "label": "Iniciante", "labelEn": "Beginner" },
      { "id": "intermedio", "label": "Intermédio", "labelEn": "Intermediate" },
      { "id": "avancado", "label": "Avançado", "labelEn": "Advanced" }
    ]
  }
}'::jsonb || COALESCE((SELECT doc FROM legacy_settings WHERE id = 1), '{}'::jsonb) AS doc;

INSERT INTO settings (id, name, email, description, moderation, comments, signups, maintenance, categories_enabled, levels_enabled)
SELECT 1,
       doc->>'name',
       COALESCE(doc->>'email', ''),
       COALESCE(doc->>'description', ''),
       COALESCE((doc->>'moderation')::boolean, true),
       COALESCE((doc->>'comments')::boolean, true),
       COALESCE((doc->>'signups')::boolean, true),
       COALESCE((doc->>'maintenance')::boolean, false),
       COALESCE((doc->'categories'->>'enabled')::boolean, true),
       COALESCE((doc->'levels'->>'enabled')::boolean, true)
  FROM migrating_settings;

INSERT INTO course_field_options (field, id, label, label_en, position)
SELECT f.field, o.value->>'id', COALESCE(o.value->>'label', o.value->>'id'), COALESCE(o.value->>'labelEn', ''), o.ordinality - 1
  FROM migrating_settings s
 CROSS JOIN LATERAL (VALUES ('category', s.doc->'categories'), ('level', s.doc->'levels')) AS f(field, value)
 CROSS JOIN LATERAL jsonb_array_elements(
         CASE WHEN jsonb_typeof(f.value->'options') = 'array' THEN f.value->'options' ELSE '[]'::jsonb END
       ) WITH ORDINALITY AS o(value, ordinality)
 WHERE COALESCE(o.value->>'id', '') <> '';
