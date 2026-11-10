-- 009 — Foto opcional de cada evento (caminho local /uploads/... ou /brand/...; '' = sem foto).
ALTER TABLE events ADD COLUMN image text NOT NULL DEFAULT '';
