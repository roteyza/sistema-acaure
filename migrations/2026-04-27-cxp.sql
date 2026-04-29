-- =============================================================
-- Fix 5.13 — Cuentas por Pagar (CxP)
-- =============================================================
-- Objetivo: agregar un modulo de obligaciones financieras
-- (pasivo laboral, servicios, honorarios, impuestos, credito,
--  bonos, prestamo, otros) separado de las compras de mercaderia.
--
-- Decisiones de diseno:
-- - El recalculo de saldo_pendiente y status se hace en JS, no
--   en trigger SQL (consistencia con compras/ventas).
-- - Los pagos viven en movimientos_financieros con un cxp_id nuevo
--   (mismo patron que venta_id y compra_id existentes).
-- - Sin RLS: control de acceso a nivel UI via NAV por rol.
--
-- Ejecutar manualmente en Supabase SQL Editor.
-- =============================================================

-- 1. Tabla principal -------------------------------------------
CREATE TABLE cxp (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proveedor_id        uuid NOT NULL REFERENCES proveedores(id) ON DELETE RESTRICT,
  categoria           text NOT NULL,
  concepto            text NOT NULL,
  monto_usd           numeric(14,2) NOT NULL CHECK (monto_usd > 0),
  saldo_pendiente     numeric(14,2) NOT NULL,
  fecha_creacion      date NOT NULL DEFAULT CURRENT_DATE,
  fecha_vencimiento   date,
  status              text NOT NULL DEFAULT 'pendiente',
  tasa_bcv_dia        numeric(14,2),
  tasa_paralelo_dia   numeric(14,2),
  notas               text,
  usuario_id          uuid REFERENCES usuarios(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT cxp_categoria_chk CHECK (categoria IN (
    'pasivo_laboral','servicios','honorarios','impuestos',
    'credito_bancario','bonos','prestamo','otros'
  )),
  CONSTRAINT cxp_status_chk CHECK (status IN (
    'pendiente','parcial','pagada','anulada'
  )),
  CONSTRAINT cxp_saldo_chk CHECK (saldo_pendiente >= 0 AND saldo_pendiente <= monto_usd)
);

-- 2. Indices ---------------------------------------------------
CREATE INDEX idx_cxp_proveedor   ON cxp (proveedor_id);
CREATE INDEX idx_cxp_status      ON cxp (status) WHERE status NOT IN ('pagada','anulada');
CREATE INDEX idx_cxp_fecha_venc  ON cxp (fecha_vencimiento) WHERE status NOT IN ('pagada','anulada');
CREATE INDEX idx_cxp_categoria   ON cxp (categoria);

-- 3. Trigger para mantener updated_at --------------------------
CREATE OR REPLACE FUNCTION cxp_set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cxp_updated_at_trg
  BEFORE UPDATE ON cxp
  FOR EACH ROW
  EXECUTE FUNCTION cxp_set_updated_at();

-- 4. Extender movimientos_financieros con FK a cxp -------------
-- El recalculo de saldo NO se hace por trigger; vive en JS.
ALTER TABLE movimientos_financieros
  ADD COLUMN cxp_id uuid REFERENCES cxp(id) ON DELETE RESTRICT;

CREATE INDEX idx_movfin_cxp
  ON movimientos_financieros (cxp_id)
  WHERE cxp_id IS NOT NULL;

-- =============================================================
-- Verificacion post-migracion (correr manualmente para confirmar)
-- =============================================================
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'cxp'
-- ORDER BY ordinal_position;
--
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'movimientos_financieros' AND column_name = 'cxp_id';
--
-- SELECT indexname FROM pg_indexes WHERE tablename = 'cxp';
