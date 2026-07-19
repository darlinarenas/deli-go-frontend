-- BHUZ: reparar pedidos de comida activos sin clave de entrega.
-- Ejecutar una sola vez en Supabase SQL Editor después de desplegar el backend.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivery_code VARCHAR(6),
  ADD COLUMN IF NOT EXISTS delivery_code_hash TEXT,
  ADD COLUMN IF NOT EXISTS delivery_code_plain TEXT,
  ADD COLUMN IF NOT EXISTS delivery_code_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivery_code_attempts INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivered_by_driver_id TEXT;

WITH pendientes AS (
  SELECT id, LPAD((ABS(HASHTEXT(id || CLOCK_TIMESTAMP()::text)) % 1000000)::text, 6, '0') AS code
  FROM orders
  WHERE LOWER(COALESCE(status,'')) NOT IN ('entregado','cancelado')
    AND delivery_code_verified_at IS NULL
    AND COALESCE(NULLIF(delivery_code,''), NULLIF(delivery_code_plain,'')) IS NULL
)
UPDATE orders o
SET delivery_code = p.code,
    delivery_code_plain = p.code,
    delivery_code_attempts = 0,
    updated_at = NOW()
FROM pendientes p
WHERE o.id = p.id;

SELECT id, public_order_number, status, delivery_code, delivery_job_id, driver_id
FROM orders
WHERE LOWER(COALESCE(status,'')) NOT IN ('entregado','cancelado')
ORDER BY created_at DESC;
