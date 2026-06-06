-- Curriculum units — the Oak National Academy unit (chapter) layer between
-- subject/year_group and individual topics.
--
-- One curriculum_unit = one Oak teaching unit (e.g. "The Black Death and the
-- Silk Road"). Many units can point at the same broad topic (e.g. 9 units →
-- "Medieval Britain 1066–1509"). This is a display/context layer only — it
-- does not change quiz or progress logic.
--
-- Additive: new table + nullable FK on topics. No existing rows modified.

CREATE TABLE IF NOT EXISTS curriculum_units (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id     UUID        NOT NULL REFERENCES subjects(id),
  year_group_id  UUID        NOT NULL REFERENCES year_groups(id),
  title          TEXT        NOT NULL,           -- Oak unit title, verbatim
  description    TEXT,                           -- optional subtitle / enquiry question
  order_index    INT         NOT NULL DEFAULT 0, -- Oak teaching sequence
  oak_unit_slug  TEXT        UNIQUE,             -- e.g. "the-black-death-and-the-silk-roads-..."
  oak_confidence TEXT,                           -- 'high' | 'medium' | 'low' from topic map
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Topics point at their Oak unit (nullable — hand-seeded topics have no unit)
ALTER TABLE topics
  ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES curriculum_units(id);

-- Fast lookups: all units for a subject+year, all topics in a unit
CREATE INDEX IF NOT EXISTS idx_curriculum_units_subj_year
  ON curriculum_units(subject_id, year_group_id, order_index);

CREATE INDEX IF NOT EXISTS idx_topics_unit_id
  ON topics(unit_id);
