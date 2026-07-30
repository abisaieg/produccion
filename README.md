# Producción

Sistema para desarrollar productos con fábricas de China: fichas con fotos,
detalles variables (packaging, insert, bolsa…), medidas, colores con cantidad
por medida, notas, y exportación a Excel para mandarle al proveedor.

**App**: https://abisaieg.github.io/produccion/
**Acceso**: PIN de 4 dígitos.

## Cómo está armado

- **Base de datos**: Supabase (proyecto `produccion`, ref `dfdulkxffygnglnncbun`).
  Tablas: `productos`, `especificaciones`, `fotos`, `medidas`, `colores`,
  `variantes` (la matriz medida × color), `notas`, `traducciones` (cache).
  RLS cerrada: solo lee/escribe el usuario autenticado detrás del PIN.
- **Fotos**: Supabase Storage, bucket `fotos`. Se comprimen en el navegador
  a 1600 px antes de subir.
- **En vivo**: Supabase Realtime. Si alguien edita desde otra computadora,
  la pantalla se actualiza sola.
- **Excel**: se arma en el navegador con ExcelJS (se carga solo al exportar).
- **Traducción al inglés**: Edge Function `traducir` (Claude Haiku) con cache
  en la tabla `traducciones`, para que el mismo texto no se traduzca dos veces.
- **App**: Vite + React + TypeScript + Tailwind, publicada en GitHub Pages.

## Trabajar en el proyecto

```bash
cd web
npm install
npm run dev      # desarrollo
npm run build    # compilar
npm run deploy   # publicar a GitHub Pages
```

## Base de datos

Consultas de administración (corre como `postgres`, saltea RLS):

```bash
TOKEN=$(security find-generic-password -s "Supabase CLI" -w)
curl -X POST "https://api.supabase.com/v1/projects/dfdulkxffygnglnncbun/database/query" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"query":"select * from productos"}'
```

## Edge Function de traducción

```bash
supabase functions deploy traducir --project-ref dfdulkxffygnglnncbun
supabase secrets set ANTHROPIC_API_KEY=sk-ant-... --project-ref dfdulkxffygnglnncbun
```

Si la función no está desplegada o falla, el Excel sale igual, solo que sin
las traducciones.
