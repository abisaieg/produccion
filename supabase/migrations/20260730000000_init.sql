-- Sistema de desarrollo de producto con fabricas (China)
-- Proyecto Supabase: produccion (ref dfdulkxffygnglnncbun)

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- productos
create table if not exists public.productos (
  id           uuid primary key default gen_random_uuid(),
  nombre       text not null,
  codigo       text,                       -- SKU interno / referencia
  proveedor    text,                       -- fabrica china
  categoria    text,
  estado       text not null default 'idea',
  -- idea | cotizando | muestra | aprobado | produccion | cerrado
  descripcion  text,
  pendiente    text,                       -- "que falta definir" -> retomar donde dejaste
  foto         text,                       -- url de la foto de muestra principal
  moneda       text not null default 'USD',
  archivado    boolean not null default false,
  orden        integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ------------------------------------------------- detalles variables (specs)
-- packaging, insert si/no, bolsa PVC, tipo de costura, etiqueta, etc.
-- cada spec puede llevar su propia foto de ejemplo ("la bolsa asi")
create table if not exists public.especificaciones (
  id           uuid primary key default gen_random_uuid(),
  producto_id  uuid not null references public.productos(id) on delete cascade,
  nombre       text not null,              -- "Packaging"
  valor        text,                       -- "Bolsa PVC con cierre, logo 2 colores"
  foto         text,                       -- foto de ejemplo de esta spec
  definido     boolean not null default false,
  orden        integer not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists idx_specs_producto on public.especificaciones(producto_id);

-- ------------------------------------------------------- galeria de ejemplos
create table if not exists public.fotos (
  id           uuid primary key default gen_random_uuid(),
  producto_id  uuid not null references public.productos(id) on delete cascade,
  url          text not null,
  titulo       text,
  orden        integer not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists idx_fotos_producto on public.fotos(producto_id);

-- ----------------------------------------------------------------- medidas
create table if not exists public.medidas (
  id           uuid primary key default gen_random_uuid(),
  producto_id  uuid not null references public.productos(id) on delete cascade,
  nombre       text not null,              -- "2 plazas", "King"
  detalle      text,                       -- "240 x 260 cm"
  precio_unit  numeric(12,4),              -- opcional (FOB unitario)
  orden        integer not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists idx_medidas_producto on public.medidas(producto_id);

-- ----------------------------------------------------------------- colores
create table if not exists public.colores (
  id           uuid primary key default gen_random_uuid(),
  producto_id  uuid not null references public.productos(id) on delete cascade,
  nombre       text not null,              -- "Beige"
  hex          text,                       -- muestra visual opcional
  foto         text,                       -- foto/estampa de referencia
  orden        integer not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists idx_colores_producto on public.colores(producto_id);

-- ------------------------------------------- matriz medida x color = cantidad
create table if not exists public.variantes (
  id           uuid primary key default gen_random_uuid(),
  producto_id  uuid not null references public.productos(id) on delete cascade,
  medida_id    uuid not null references public.medidas(id) on delete cascade,
  color_id     uuid not null references public.colores(id) on delete cascade,
  cantidad     integer not null default 0,
  precio_unit  numeric(12,4),              -- pisa al precio de la medida si se carga
  notas        text,
  updated_at   timestamptz not null default now(),
  unique (medida_id, color_id)
);
create index if not exists idx_variantes_producto on public.variantes(producto_id);

-- ------------------------------------------------------------------- notas
create table if not exists public.notas (
  id           uuid primary key default gen_random_uuid(),
  producto_id  uuid not null references public.productos(id) on delete cascade,
  texto        text not null,
  autor        text,
  created_at   timestamptz not null default now()
);
create index if not exists idx_notas_producto on public.notas(producto_id);

-- --------------------------------------------------------------- updated_at
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_productos_touch on public.productos;
create trigger trg_productos_touch before update on public.productos
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_variantes_touch on public.variantes;
create trigger trg_variantes_touch before update on public.variantes
  for each row execute function public.touch_updated_at();

-- tocar el producto cuando cambia cualquier hijo, para ver "ultima actividad"
create or replace function public.touch_producto()
returns trigger language plpgsql security definer as $$
declare pid uuid;
begin
  pid := coalesce(new.producto_id, old.producto_id);
  update public.productos set updated_at = now() where id = pid;
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['especificaciones','fotos','medidas','colores','variantes','notas'] loop
    execute format('drop trigger if exists trg_touch_padre on public.%I', t);
    execute format(
      'create trigger trg_touch_padre after insert or update or delete on public.%I
         for each row execute function public.touch_producto()', t);
  end loop;
end $$;

-- --------------------------------------------------------------------- vista
create or replace view public.v_resumen_producto as
select
  p.id,
  p.nombre,
  p.estado,
  coalesce(sum(v.cantidad), 0)::bigint as unidades,
  coalesce(sum(v.cantidad * coalesce(v.precio_unit, m.precio_unit, 0)), 0)::numeric as total,
  count(distinct m.id)::int as n_medidas,
  count(distinct c.id)::int as n_colores
from public.productos p
left join public.variantes v on v.producto_id = p.id
left join public.medidas   m on m.id = v.medida_id
left join public.colores   c on c.id = v.color_id
group by p.id, p.nombre, p.estado;

-- ----------------------------------------------------------------------- RLS
-- acceso solo para el usuario autenticado detras del PIN; anon no ve nada
do $$
declare t text;
begin
  foreach t in array array['productos','especificaciones','fotos','medidas','colores','variantes','notas'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "acceso_total_auth" on public.%I', t);
    execute format(
      'create policy "acceso_total_auth" on public.%I
         for all to authenticated using (true) with check (true)', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant all on public.%I to authenticated', t);
  end loop;
end $$;

revoke all on public.v_resumen_producto from anon;
grant select on public.v_resumen_producto to authenticated;
