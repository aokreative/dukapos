-- Enforce 1-to-1 relationship between an owner and their shop tenant
ALTER TABLE shops ADD CONSTRAINT shops_owner_id_key UNIQUE (owner_id);
