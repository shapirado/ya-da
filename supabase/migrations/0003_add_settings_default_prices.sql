-- Minimal single-row settings table for the two default pricing figures
-- used as a starting point when adding a new child (e.g. on the families
-- page). Not a generic key-value settings system: just two numbers.
create table if not exists settings (
  id text primary key default 'default',
  default_full_price integer,
  default_discount_price integer
);

insert into settings (id, default_full_price, default_discount_price)
values ('default', null, null)
on conflict (id) do nothing;
