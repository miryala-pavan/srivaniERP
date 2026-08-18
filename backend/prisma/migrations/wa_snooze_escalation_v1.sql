-- ─── WhatsApp snooze + escalation-reminder v1 ─────────────────────────────────
-- Adds snoozedUntil (defer a conversation until a chosen time) and
-- lastEscalationTier (tracks which unread-age reminder tier has already
-- fired, reset when the conversation is marked read or resolved) to
-- WaConversation.

ALTER TABLE wa_conversation
  ADD COLUMN IF NOT EXISTS "snoozedUntil"       TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastEscalationTier" INTEGER NOT NULL DEFAULT 0;
