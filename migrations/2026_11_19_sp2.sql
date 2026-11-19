-- BACK UP RAILWAY DATABASE BEFORE APPLYING.
-- Verify current pickup_queue.status enum before changing it.
-- Retain legacy gate_slot column as the Slot A/B identifier.
ALTER TABLE duty_schedule ADD COLUMN gate_code ENUM('A','B') NOT NULL DEFAULT 'A' AFTER gate_slot;
-- Existing assignments default to Gate A; verify/correct them manually.
-- For ENUM status columns containing the standard ATG lifecycle:
ALTER TABLE pickup_queue MODIFY COLUMN status ENUM('REQUESTED','ARRIVED','PREPARING','READY','PICKED_UP','CANCELLED') NOT NULL;
