-- A receipt has exactly one payer across all of its lines (every line of a
-- receipt is always written with the same payer_id). Move payer_id onto
-- receipts itself instead of duplicating it on every line.

alter table receipts add column if not exists payer_id uuid references payers(id);

update receipts r
set payer_id = rl.payer_id
from receipt_lines rl
where rl.receipt_id = r.id
  and rl.payer_id is not null
  and r.payer_id is null;

alter table receipt_lines drop column if exists payer_id;
