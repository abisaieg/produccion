-- Un detalle (packaging, insert, tela…) puede llevar VARIAS imágenes, cada
-- una con su propio texto, además del texto general del detalle.
-- Reusamos la tabla de fotos: si spec_id tiene valor, la foto es de ese
-- detalle; si no, es de la galería del estilo.

alter table public.fotos
  add column if not exists spec_id uuid
  references public.especificaciones(id) on delete cascade;

create index if not exists idx_fotos_spec on public.fotos(spec_id);
