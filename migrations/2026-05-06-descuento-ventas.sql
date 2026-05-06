-- =============================================================
-- Fix 5.14 — Descuento en ventas
-- =============================================================
-- Objetivo: permitir aplicar un descuento porcentual al subtotal
-- de items en una venta, antes de sumar el delivery.
--
-- Decisiones de diseno:
-- - descuento_pct numeric(5,2) admite 0.00 a 100.00 con dos
--   decimales (ej. 12.50 %). CHECK constraint valida el rango.
-- - descuento_usd numeric(14,2) guarda el monto en USD ya
--   calculado (no se recalcula al vuelo en cada query). CHECK
--   asegura que sea no-negativo.
-- - Ambos NOT NULL DEFAULT 0 para que las ventas viejas se vean
--   afectadas retroactivamente con valor 0 (sin necesidad de
--   backfill). El render condicional en factura/Ver hace que la
--   linea solo se dibuje si descuento_usd > 0.
-- - IF NOT EXISTS permite re-ejecutar la migracion sin error.
-- - Sin indices: son campos de display/calculo, no de filtrado.
-- - Sin trigger: total_usd se recalcula en JS al guardar la venta
--   (consistente con el resto del sistema).
--
-- Ejecutar manualmente en Supabase SQL Editor.
-- =============================================================

ALTER TABLE ventas
  ADD COLUMN IF NOT EXISTS descuento_pct numeric(5,2) NOT NULL DEFAULT 0
    CHECK (descuento_pct >= 0 AND descuento_pct <= 100),
  ADD COLUMN IF NOT EXISTS descuento_usd numeric(14,2) NOT NULL DEFAULT 0
    CHECK (descuento_usd >= 0);

-- =============================================================
-- Verificacion post-migracion (descomentar para correr)
-- =============================================================
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'ventas'
--   AND column_name IN ('descuento_pct','descuento_usd')
-- ORDER BY column_name;
--
-- -- Confirmar que las constraints quedaron creadas
-- SELECT conname, pg_get_constraintdef(oid) AS def
-- FROM pg_constraint
-- WHERE conrelid = 'ventas'::regclass
--   AND conname LIKE '%descuento%';
--
-- -- Confirmar que las ventas existentes tienen 0 (default aplicado)
-- SELECT count(*) AS total,
--        count(*) FILTER (WHERE descuento_pct = 0) AS con_pct_cero,
--        count(*) FILTER (WHERE descuento_usd = 0) AS con_usd_cero
-- FROM ventas;
