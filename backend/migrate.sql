-- VIATRA database migration
-- Run this in pgAdmin Query Tool

-- Add new columns to violations table
ALTER TABLE violations ADD COLUMN IF NOT EXISTS speed_kmh FLOAT;
ALTER TABLE violations ADD COLUMN IF NOT EXISTS legal_section VARCHAR(100);
ALTER TABLE violations ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE violations ADD COLUMN IF NOT EXISTS all_violations VARCHAR(200);
ALTER TABLE violations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE;

-- Update admin email to VIATRA
UPDATE officers SET email = 'admin@viatra.gov.in' WHERE role = 'admin';

-- Confirm
SELECT 'Migration complete!' as status;
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'violations' ORDER BY ordinal_position;
