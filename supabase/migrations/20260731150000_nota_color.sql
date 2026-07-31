-- Una nota por color: el tono exacto, el Pantone, con qué tela combina,
-- qué hay que aclararle a la fábrica sobre ese color puntual.
alter table public.colores add column if not exists nota text;
