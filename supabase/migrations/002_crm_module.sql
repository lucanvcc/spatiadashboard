-- ============================================================
-- Spatia CRM Module — additions for Phase 2
-- Run after 001_initial_schema.sql
-- ============================================================

-- Add contact_id to notes for CRM contact history
alter table notes add column if not exists contact_id uuid references contacts(id) on delete cascade;
create index if not exists idx_notes_contact_id on notes(contact_id);

-- Add 'rejected' to email_status enum (for human review queue rejections)
alter type email_status add value if not exists 'rejected';
