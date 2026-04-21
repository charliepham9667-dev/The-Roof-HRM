-- Raise the file size limit for marketing plan assets so we can store the
-- full marketing / event / branding decks (original limit was 15 MiB, several
-- reference PDFs exceed that). 100 MiB is plenty for decks + branding kits.

UPDATE storage.buckets
SET file_size_limit = 104857600  -- 100 MiB
WHERE id = 'marketing-plan-assets';
