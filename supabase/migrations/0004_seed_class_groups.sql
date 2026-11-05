-- Seed the 4 weekly class groups for the single class type (חוג אומנות),
-- only if none exist yet. Day/time/color are placeholders meant to be
-- edited from the classes settings page.
insert into class_groups (day, time, color)
select v.day, v.time, v.color
from (values
  ('ראשון', '16:00', '#c97b4a'),
  ('שני', '16:30', '#8a9a5b'),
  ('שלישי', '17:00', '#d4a94e'),
  ('רביעי', '16:00', '#6f8faa')
) as v(day, time, color)
where not exists (select 1 from class_groups);
