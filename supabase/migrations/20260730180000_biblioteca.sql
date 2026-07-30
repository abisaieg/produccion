-- Biblioteca de opciones reutilizables.
--
-- El caso real: un acolchado en 4 estilos, cada uno con su packaging, su
-- insert, su tela. Sin esto habría que escribir y fotografiar el mismo
-- packaging cuatro veces. Con esto se carga una vez, con su foto, y en cada
-- estilo se ELIGE de una lista visual.

create table if not exists public.opciones (
  id          uuid primary key default gen_random_uuid(),
  tipo        text not null,          -- "Packaging", "Insert", "Tela"...
  nombre      text not null,          -- "Bolsa PVC con cierre"
  detalle     text,                   -- "logo impreso 2 colores, 0.12 mm"
  foto        text,
  usos        integer not null default 0,   -- para ordenar por lo más usado
  created_at  timestamptz not null default now()
);
create index if not exists idx_opciones_tipo on public.opciones(tipo);

-- de qué opción de la biblioteca salió este detalle (si salió de una)
alter table public.especificaciones
  add column if not exists opcion_id uuid references public.opciones(id) on delete set null;

-- los tipos que ya se usaron, para sugerirlos al crear un detalle nuevo
create or replace view public.v_tipos_opcion as
select tipo, count(*)::int as cantidad
from public.opciones
group by tipo
order by count(*) desc;

alter table public.opciones enable row level security;
drop policy if exists "acceso_total_auth" on public.opciones;
create policy "acceso_total_auth" on public.opciones
  for all to authenticated using (true) with check (true);
revoke all on public.opciones from anon;
grant all on public.opciones to authenticated;

revoke all on public.v_tipos_opcion from anon;
grant select on public.v_tipos_opcion to authenticated;

alter publication supabase_realtime add table public.opciones;

-- sumar un uso cada vez que se elige la opción
create or replace function public.contar_uso_opcion()
returns trigger language plpgsql security definer as $$
begin
  if new.opcion_id is not null and
     (tg_op = 'INSERT' or old.opcion_id is distinct from new.opcion_id) then
    update public.opciones set usos = usos + 1 where id = new.opcion_id;
  end if;
  return new;
end $$;

drop trigger if exists trg_uso_opcion on public.especificaciones;
create trigger trg_uso_opcion after insert or update on public.especificaciones
  for each row execute function public.contar_uso_opcion();
