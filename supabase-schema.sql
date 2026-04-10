-- ─────────────────────────────────────────────────────────────
-- PropNest Realty — Supabase Schema
-- Run this in your Supabase SQL editor
-- ─────────────────────────────────────────────────────────────

-- VIEWINGS table
create table if not exists viewings (
  id              uuid primary key default gen_random_uuid(),
  client_name     text,
  phone           text,
  date            date,
  time_slot       text,
  agent           text,
  property_type   text,
  area            text,
  budget          text,
  status          text default 'scheduled',
  notes           text,
  whatsapp_sent   boolean default false,
  gcal_event_id   text,
  created_at      timestamp default now()
);

-- INDEX for fast queries
create index if not exists idx_viewings_date          on viewings(date);
create index if not exists idx_viewings_agent         on viewings(agent);
create index if not exists idx_viewings_status        on viewings(status);
create index if not exists idx_viewings_property_type on viewings(property_type);

-- AGENT CONFIG table (how many viewings per agent per day)
create table if not exists agent_config (
  agent       text primary key,
  max_slots   int default 8
);

-- Seed default agents
insert into agent_config (agent, max_slots) values
  ('Rohan Mehta',      8),
  ('Preethi Srinivas', 8),
  ('Aakash Verma',     8),
  ('Divya Krishnan',   8),
  ('Sanjay Rao',       8)
on conflict (agent) do nothing;

-- RLS (Row Level Security) — allow all for now (lock down in production)
alter table viewings      enable row level security;
alter table agent_config  enable row level security;

create policy "Allow all" on viewings      for all using (true) with check (true);
create policy "Allow all" on agent_config  for all using (true) with check (true);




-- -- ─────────────────────────────────────────────────────────────
-- -- PropNest Realty — Migration (run this instead of the full schema)
-- -- ─────────────────────────────────────────────────────────────

-- -- 1. Add missing "budget" column to viewings
-- alter table viewings add column if not exists budget text;

-- -- 2. Drop NOT NULL constraints
-- alter table viewings alter column client_name  drop not null;
-- alter table viewings alter column phone        drop not null;
-- alter table viewings alter column agent        drop not null;
-- alter table viewings alter column property_type drop not null;
-- alter table viewings alter column date         drop not null;
-- alter table viewings alter column time_slot    drop not null;

-- -- 3. Change status default from 'confirmed' to 'scheduled'
-- alter table viewings alter column status set default 'scheduled';

-- -- 4. Migrate agent_config — drop old table and recreate with text primary key
-- drop table if exists agent_config cascade;

-- create table agent_config (
--   agent       text primary key,
--   max_slots   int default 8
-- );

-- insert into agent_config (agent, max_slots) values
--   ('Rohan Mehta',      8),
--   ('Preethi Srinivas', 8),
--   ('Aakash Verma',     8),
--   ('Divya Krishnan',   8),
--   ('Sanjay Rao',       8)
-- on conflict (agent) do nothing;

-- -- 5. Re-enable RLS + policies for agent_config (dropped with cascade above)
-- alter table agent_config enable row level security;
-- create policy "Allow all" on agent_config for all using (true) with check (true);