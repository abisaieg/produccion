-- Un producto puede tener varias configuraciones (ej: acolchado a cuadros y a rayas).
-- Cada configuracion es independiente: sus medidas, colores, cantidades, precios,
-- detalles y fotos. Los detalles generales del producto siguen viviendo en
-- especificaciones con config_id nulo.

create table if not exists public.configuraciones (
  id           uuid primary key default gen_random_uuid(),
  producto_id  uuid not null references public.productos(id) on delete cascade,
  nombre       text not null,
  descripcion  text,
  foto         text,
  orden        integer not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists idx_config_producto on public.configuraciones(producto_id);

-- medidas, colores y galeria pasan a colgar de la configuracion
alter table public.medidas
  add column if not exists config_id uuid references public.configuraciones(id) on delete cascade;
alter table public.colores
  add column if not exists config_id uuid references public.configuraciones(id) on delete cascade;
alter table public.fotos
  add column if not exists config_id uuid references public.configuraciones(id) on delete cascade;

-- las specs pueden ser del producto (config_id nulo) o de una configuracion
alter table public.especificaciones
  add column if not exists config_id uuid references public.configuraciones(id) on delete cascade;

alter table public.variantes
  add column if not exists config_id uuid references public.configuraciones(id) on delete cascade;

create index if not exists idx_medidas_config   on public.medidas(config_id);
create index if not exists idx_colores_config   on public.colores(config_id);
create index if not exists idx_fotos_config     on public.fotos(config_id);
create index if not exists idx_specs_config     on public.especificaciones(config_id);
create index if not exists idx_variantes_config on public.variantes(config_id);

-- tocar el producto cuando cambia una configuracion
drop trigger if exists trg_touch_padre on public.configuraciones;
create trigger trg_touch_padre after insert or update or delete on public.configuraciones
  for each row execute function public.touch_producto();

-- todo producto nuevo arranca con una configuracion, asi la app no tiene que
-- lidiar con productos sin ninguna
create or replace function public.crear_config_inicial()
returns trigger language plpgsql security definer as $$
begin
  insert into public.configuraciones (producto_id, nombre, orden)
  values (new.id, 'Principal', 0);
  return new;
end $$;

drop trigger if exists trg_config_inicial on public.productos;
create trigger trg_config_inicial after insert on public.productos
  for each row execute function public.crear_config_inicial();

-- RLS y realtime igual que el resto
alter table public.configuraciones enable row level security;
drop policy if exists "acceso_total_auth" on public.configuraciones;
create policy "acceso_total_auth" on public.configuraciones
  for all to authenticated using (true) with check (true);
revoke all on public.configuraciones from anon;
grant all on public.configuraciones to authenticated;

alter publication supabase_realtime add table public.configuraciones;

-- la vista de resumen ahora cuenta por producto sumando todas sus configuraciones
drop view if exists public.v_resumen_producto;
create view public.v_resumen_producto as
select
  p.id,
  p.nombre,
  p.estado,
  coalesce(sum(v.cantidad), 0)::bigint as unidades,
  coalesce(sum(v.cantidad * coalesce(v.precio_unit, m.precio_unit, 0)), 0)::numeric as total,
  -- subconsulta, no join: un join con configuraciones multiplicaría las
  -- filas de variantes y duplicaría unidades y totales
  (select count(*) from public.configuraciones cf where cf.producto_id = p.id)::int
    as n_configuraciones,
  count(distinct m.id)::int as n_medidas,
  count(distinct c.id)::int as n_colores
from public.productos p
left join public.variantes v on v.producto_id = p.id
left join public.medidas   m on m.id = v.medida_id
left join public.colores   c on c.id = v.color_id
group by p.id, p.nombre, p.estado;

revoke all on public.v_resumen_producto from anon;
grant select on public.v_resumen_producto to authenticated;
