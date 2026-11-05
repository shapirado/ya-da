-- Seed the 4 weekly class groups for the single class type (חוג אומנות),
-- only if none exist yet. Day/time/color are placeholders meant to be
-- edited from the classes settings page.
-- Colors match the design system's swatch palette (terracotta, mustard,
-- sage, teal) used by the classes settings page's color picker.
insert into class_groups (day, time, color)
select v.day, v.time, v.color
from (values
  ('ראשון', '16:00', '#b85a36'),
  ('שני', '16:30', '#e0a93a'),
  ('שלישי', '17:00', '#8fa581'),
  ('רביעי', '16:00', '#4f8a8b')
) as v(day, time, color)
where not exists (select 1 from class_groups);
