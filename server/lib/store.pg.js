// Postgres store — used when DATABASE_URL is set (works with Supabase, Neon,
// Render Postgres, or any Postgres). Same interface as the memory store, so the
// rest of the app doesn't change. `pg` is imported lazily so the server runs
// without it when no database is configured.

function rowToTenant(r) {
  if (!r) return null
  return {
    id: r.id,
    business: r.business,
    phone: r.phone,
    planId: r.plan_id,
    cycle: r.cycle,
    autoRenew: r.auto_renew,
    createdAt: Number(r.created_at),
    trialEndsAt: Number(r.trial_ends_at),
    currentPeriodEnd: Number(r.current_period_end),
    lastPaymentAt: r.last_payment_at == null ? null : Number(r.last_payment_at),
    lastChargeAttemptAt: r.last_charge_attempt_at == null ? null : Number(r.last_charge_attempt_at),
    invoices: r.invoices || [],
  }
}

export async function createPgStore(connectionString) {
  const { default: pg } = await import('pg')
  const pool = new pg.Pool({
    connectionString,
    ssl: /supabase|render|neon|amazonaws/i.test(connectionString) ? { rejectUnauthorized: false } : undefined,
    max: 5,
  })

  async function ensureSchema() {
    await pool.query(`
      create table if not exists tenants (
        id uuid primary key,
        business text not null,
        phone text unique,
        plan_id text not null default 'standard',
        cycle text not null default 'monthly',
        auto_renew boolean not null default true,
        created_at bigint not null,
        trial_ends_at bigint not null,
        current_period_end bigint not null,
        last_payment_at bigint,
        last_charge_attempt_at bigint,
        invoices jsonb not null default '[]'::jsonb
      );
      create index if not exists idx_tenants_phone on tenants(phone);
    `)
  }

  return {
    kind: 'postgres',
    async init() {
      await ensureSchema()
    },
    async all() {
      const { rows } = await pool.query('select * from tenants')
      return rows.map(rowToTenant)
    },
    async getById(id) {
      const { rows } = await pool.query('select * from tenants where id = $1', [id])
      return rowToTenant(rows[0])
    },
    async getByPhone(phone) {
      const { rows } = await pool.query('select * from tenants where phone = $1', [phone])
      return rowToTenant(rows[0])
    },
    async put(t) {
      await pool.query(
        `insert into tenants
          (id, business, phone, plan_id, cycle, auto_renew, created_at, trial_ends_at,
           current_period_end, last_payment_at, last_charge_attempt_at, invoices)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         on conflict (id) do update set
           business=excluded.business, phone=excluded.phone, plan_id=excluded.plan_id,
           cycle=excluded.cycle, auto_renew=excluded.auto_renew,
           trial_ends_at=excluded.trial_ends_at, current_period_end=excluded.current_period_end,
           last_payment_at=excluded.last_payment_at,
           last_charge_attempt_at=excluded.last_charge_attempt_at, invoices=excluded.invoices`,
        [
          t.id, t.business, t.phone, t.planId, t.cycle, t.autoRenew, t.createdAt, t.trialEndsAt,
          t.currentPeriodEnd, t.lastPaymentAt, t.lastChargeAttemptAt, JSON.stringify(t.invoices || []),
        ],
      )
      return t
    },
  }
}
