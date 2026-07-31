-- Cargar el pedido por porcentajes en vez de por unidades.
--
-- Así se arma un pedido de verdad: se parte del contenedor y se decide qué
-- porcentaje va a cada medida, y dentro de cada medida qué porcentaje lleva
-- cada color. Las unidades salen de esa cuenta.

alter table public.productos
  add column if not exists total_contenedor integer;

alter table public.configuraciones
  add column if not exists porcentaje numeric(7,3);

alter table public.medidas
  add column if not exists porcentaje numeric(7,3);

alter table public.variantes
  add column if not exists porcentaje numeric(7,3);
