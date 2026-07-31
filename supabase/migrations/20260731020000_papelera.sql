-- Papelera: guarda lo que se borra, con todos sus datos.
--
-- Un color borrado sin querer se llevaba su nombre, su foto y sus cantidades
-- sin dejar rastro: no había forma de saber siquiera cómo se llamaba.

create table if not exists public.papelera (
  id          bigserial primary key,
  tabla       text not null,
  registro_id uuid not null,
  producto_id uuid,
  datos       jsonb not null,
  borrado_en  timestamptz not null default now()
);
create index if not exists idx_papelera_fecha on public.papelera(borrado_en desc);
create index if not exists idx_papelera_producto on public.papelera(producto_id);

create or replace function public.guardar_en_papelera()
returns trigger language plpgsql security definer as $$
declare pid uuid;
begin
  begin
    pid := old.producto_id;
  exception when others then
    pid := null;
  end;

  insert into public.papelera (tabla, registro_id, producto_id, datos)
  values (tg_table_name, old.id, pid, to_jsonb(old));
  return old;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'productos','configuraciones','especificaciones','fotos',
    'medidas','colores','variantes','notas','opciones'
  ] loop
    execute format('drop trigger if exists trg_papelera on public.%I', t);
    execute format(
      'create trigger trg_papelera before delete on public.%I
         for each row execute function public.guardar_en_papelera()', t);
  end loop;
end $$;

alter table public.papelera enable row level security;
drop policy if exists "acceso_total_auth" on public.papelera;
create policy "acceso_total_auth" on public.papelera
  for all to authenticated using (true) with check (true);
revoke all on public.papelera from anon;
grant all on public.papelera to authenticated;
grant usage, select on sequence public.papelera_id_seq to authenticated;
