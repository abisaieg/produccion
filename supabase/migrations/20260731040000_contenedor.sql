-- Un contenedor por diseño: se carga el total de unidades del contenedor y
-- la matriz se completa en porcentajes. Cada celda dice qué porcentaje del
-- contenedor lleva ese color en esa medida; la fila da el porcentaje de la
-- medida y la columna el del color.
alter table public.configuraciones
  add column if not exists total_unidades integer;
