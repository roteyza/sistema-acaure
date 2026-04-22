const SUPABASE_URL = 'https://rthwwkqilzqoeblpgzdw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0aHd3a3FpbHpxb2VibHBnemR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNzAzOTksImV4cCI6MjA4OTg0NjM5OX0.bqhfJS24pn8uuEgsz1RTvpewG8WtCRv65PFacvrUbVs';
const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);