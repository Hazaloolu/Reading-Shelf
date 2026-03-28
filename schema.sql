-- Run this in your Supabase SQL editor

-- Articles table
create table if not exists articles (
  id          bigserial primary key,
  title       text not null,
  link        text,
  note        text,
  sent_count  integer not null default 0,
  is_read     boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Config table (single row)
create table if not exists config (
  id              integer primary key default 1,
  phone           text,
  instance        text,
  token           text,
  send_hour       integer not null default 7,
  send_minute     integer not null default 0,
  last_sent_date  text,
  last_sent_id    bigint references articles(id) on delete set null
);

-- Seed one config row
insert into config (id) values (1) on conflict (id) do nothing;
