-- A journal day can now skip the opening-question picker entirely and start as
-- a freeform entry. freeform_started_at records when the user chose "write
-- freely": it both flags the entry as freeform (so the picker is bypassed) and
-- anchors the five-minute timer, since a freeform entry has no opening message.

ALTER TABLE journal_entries ADD COLUMN freeform_started_at timestamptz;
