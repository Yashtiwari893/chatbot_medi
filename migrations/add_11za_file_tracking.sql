-- Add 11za file ID tracking to RAG system
-- This migration allows storing 11za file IDs alongside Drive links

-- 1. Add elevenza_file_id to rag_files table
ALTER TABLE rag_files
ADD COLUMN IF NOT EXISTS elevenza_file_id TEXT,
ADD COLUMN IF NOT EXISTS elevenza_auth_token TEXT,
ADD COLUMN IF NOT EXISTS elevenza_origin TEXT,
ADD COLUMN IF NOT EXISTS source_drive_link TEXT;

-- 2. Add elevenza_file_id to rag_chunks for individual chunk tracking
ALTER TABLE rag_chunks
ADD COLUMN IF NOT EXISTS elevenza_file_id TEXT,
ADD COLUMN IF NOT EXISTS source_drive_link TEXT;

-- 3. Create index for elevenza file ID lookups
CREATE INDEX IF NOT EXISTS idx_rag_files_elevenza_file_id
  ON rag_files(elevenza_file_id);

CREATE INDEX IF NOT EXISTS idx_rag_chunks_elevenza_file_id
  ON rag_chunks(elevenza_file_id);

-- 4. Add elevenza tracking to phone_document_mapping
ALTER TABLE phone_document_mapping
ADD COLUMN IF NOT EXISTS elevenza_file_id TEXT;

CREATE INDEX IF NOT EXISTS idx_phone_document_mapping_elevenza_file_id
  ON phone_document_mapping(elevenza_file_id);

-- 5. Create a view for elevenza-enabled mappings
CREATE OR REPLACE VIEW phone_elevenza_mappings AS
SELECT
    pdm.id,
    pdm.phone_number,
    pdm.file_id,
    rf.name AS file_name,
    pdm.elevenza_file_id,
    rf.elevenza_file_id AS parent_elevenza_file_id,
    pdm.created_at,
    pdm.updated_at
FROM phone_document_mapping pdm
LEFT JOIN rag_files rf ON pdm.file_id = rf.id
WHERE pdm.elevenza_file_id IS NOT NULL
   OR rf.elevenza_file_id IS NOT NULL;
