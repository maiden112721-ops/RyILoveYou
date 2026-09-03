CREATE TABLE IF NOT EXISTS letters (
  id BIGSERIAL PRIMARY KEY,
  title VARCHAR(180) NOT NULL CHECK (char_length(trim(title)) > 0),
  content TEXT NOT NULL CHECK (char_length(trim(content)) > 0),
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reminders (
  id BIGSERIAL PRIMARY KEY,
  title VARCHAR(180) NOT NULL CHECK (char_length(trim(title)) > 0),
  description TEXT NOT NULL DEFAULT '',
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  start_time TIME NULL,
  end_time TIME NULL,
  color VARCHAR(7) NOT NULL DEFAULT '#D66B83' CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
  recurrence_rule TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date),
  CHECK (start_time IS NULL OR end_time IS NULL OR end_time > start_time)
);

CREATE TABLE IF NOT EXISTS wallets (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL CHECK (char_length(trim(name)) > 0),
  target_amount NUMERIC(14, 2) NULL CHECK (target_amount IS NULL OR target_amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transactions (
  id BIGSERIAL PRIMARY KEY,
  wallet_id BIGINT NULL REFERENCES wallets(id) ON DELETE SET NULL,
  type VARCHAR(12) NOT NULL CHECK (type IN ('deposit', 'withdrawal')),
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  merchant_or_source VARCHAR(180) NOT NULL CHECK (char_length(trim(merchant_or_source)) > 0),
  description TEXT NOT NULL DEFAULT '',
  transaction_date TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS letters_created_at_idx ON letters (created_at DESC);
CREATE INDEX IF NOT EXISTS reminders_date_idx ON reminders (start_date, end_date);
CREATE INDEX IF NOT EXISTS transactions_wallet_date_idx ON transactions (wallet_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS transactions_date_idx ON transactions (transaction_date DESC);