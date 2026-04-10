-- ─────────────────────────────────────────────────────────────
-- PropNest Realty — Supabase Schema
-- Run this in your Supabase SQL editor
-- ─────────────────────────────────────────────────────────────

-- VIEWINGS table
create table if not exists viewings (
  id              uuid primary key default gen_random_uuid(),
  client_name     text not null,
  phone           text not null,
  agent           text not null,
  property_type   text not null,
  area            text,
  date            date not null,
  time_slot       text not null,
  status          text not null default 'confirmed',   -- confirmed | cancelled | completed
  notes           text,
  whatsapp_sent   boolean default false,
  gcal_event_id   text,
  created_at      timestamptz default now()
);

-- INDEX for fast queries
create index if not exists idx_viewings_date          on viewings(date);
create index if not exists idx_viewings_agent         on viewings(agent);
create index if not exists idx_viewings_status        on viewings(status);
create index if not exists idx_viewings_property_type on viewings(property_type);

-- AGENT CONFIG table (how many viewings per agent per day)
create table if not exists agent_config (
  id          serial primary key,
  agent       text unique not null,
  max_slots   int not null default 8
);

-- Seed default agents (TIME_SLOTS has 8 entries, used as default)
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