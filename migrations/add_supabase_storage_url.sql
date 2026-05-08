-- Add Supabase Storage URL column to rag_files
-- This stores the direct URL to PDFs uploaded to Supabase Storage

ALTER TABLE IF EXISTS public.rag_files
ADD COLUMN IF NOT EXISTS supabase_storage_url TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_rag_files_supabase_url 
  ON public.rag_files(supabase_storage_url);

-- Add comment
COMMENT ON COLUMN public.rag_files.supabase_storage_url IS 'Direct URL to PDF stored in Supabase Storage for WhatsApp delivery';
