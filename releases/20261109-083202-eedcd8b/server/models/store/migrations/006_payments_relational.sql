-- 006 — Pagamentos em colunas, ligados ao membro e à subscrição que activaram.
-- A tabela JSONB fica como legacy_payments (não se apaga nada).

DO $$
DECLARE bad text;
BEGIN
  SELECT string_agg(DISTINCT doc->>'partnerTransactionId', ', ') INTO bad FROM (
    SELECT doc FROM payments
     WHERE doc->>'partnerTransactionId' IN (
       SELECT doc->>'partnerTransactionId' FROM payments GROUP BY 1 HAVING count(*) > 1)
  ) duplicated;
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Pagamentos com o mesmo partnerTransactionId (corrija antes de migrar): %', bad;
  END IF;

  SELECT string_agg(id, ', ') INTO bad FROM payments
   WHERE COALESCE(doc->>'partnerTransactionId', '') = ''
      OR COALESCE(doc->>'createdAt', '') = ''
      OR doc->>'plan' IS NULL OR doc->>'plan' NOT IN ('200', '500')
      OR doc->>'method' IS NULL OR doc->>'method' NOT IN ('mpesa', 'emola', 'mkesh', 'imali')
      OR doc->>'status' IS NULL OR doc->>'status' NOT IN ('pending', 'confirmed', 'failed', 'expired')
      OR COALESCE((doc->>'amount')::numeric, 0) <= 0;
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Pagamentos com campos inválidos (plano, método, estado, valor, datas ou partnerTransactionId; corrija antes de migrar): %', bad;
  END IF;
END $$;

ALTER TABLE payments RENAME TO legacy_payments;
ALTER INDEX payments_pkey RENAME TO legacy_payments_pkey;
ALTER INDEX payments_user_idx RENAME TO legacy_payments_user_idx;

CREATE TABLE payments (
  id text PRIMARY KEY,
  position bigint NOT NULL DEFAULT 0,
  -- O histórico de pagamentos fica mesmo que a conta seja apagada.
  user_id text REFERENCES users (id) ON DELETE SET NULL,
  plan text NOT NULL CHECK (plan IN ('200', '500')),
  amount integer NOT NULL CHECK (amount > 0),
  method text NOT NULL CHECK (method IN ('mpesa', 'emola', 'mkesh', 'imali')),
  account_masked text NOT NULL DEFAULT '',
  status text NOT NULL CHECK (status IN ('pending', 'confirmed', 'failed', 'expired')),
  provider text NOT NULL DEFAULT '',
  -- Id de 12 caracteres enviado ao iMaliWay.
  partner_transaction_id text NOT NULL UNIQUE,
  -- transaction_id devolvido pelo iMaliWay.
  provider_ref text,
  failure_reason text,
  created_at timestamptz NOT NULL,
  expires_at timestamptz,
  confirmed_at timestamptz,
  last_checked_at timestamptz
);
CREATE INDEX payments_user_idx ON payments (user_id);
CREATE INDEX payments_status_idx ON payments (status);
CREATE INDEX payments_provider_ref_idx ON payments (provider_ref);

-- Pagamentos de contas já apagadas ficam sem membro (como fará ON DELETE SET NULL).
INSERT INTO payments (id, position, user_id, plan, amount, method, account_masked, status, provider,
                      partner_transaction_id, provider_ref, failure_reason, created_at, expires_at, confirmed_at, last_checked_at)
SELECT p.id, p.position,
       u.id,
       p.doc->>'plan',
       (p.doc->>'amount')::numeric::integer,
       p.doc->>'method',
       COALESCE(p.doc->>'accountMasked', ''),
       p.doc->>'status',
       COALESCE(p.doc->>'provider', ''),
       p.doc->>'partnerTransactionId',
       NULLIF(p.doc->>'providerRef', ''),
       NULLIF(p.doc->>'failureReason', ''),
       (p.doc->>'createdAt')::timestamptz,
       NULLIF(p.doc->>'expiresAt', '')::timestamptz,
       NULLIF(p.doc->>'confirmedAt', '')::timestamptz,
       NULLIF(p.doc->>'lastCheckedAt', '')::timestamptz
  FROM legacy_payments p
  LEFT JOIN users u ON u.id = p.doc->>'userId';

-- A subscrição aponta para o pagamento que a activou; referências a pagamentos
-- inexistentes (ex.: subscrição dada manualmente) ficam a NULL.
UPDATE subscriptions s SET payment_id = NULL
 WHERE payment_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.id = s.payment_id);
ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES payments (id) ON DELETE SET NULL;
