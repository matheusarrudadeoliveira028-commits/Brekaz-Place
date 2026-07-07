import { createClient } from '@supabase/supabase-js';

// Pegue esses dados lá no painel do Supabase em Settings > API
const supabaseUrl = 'https://obwjikxhzpojwctlcywk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9id2ppa3hoenBvandjdGxjeXdrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzM0ODEyNiwiZXhwIjoyMDk4OTI0MTI2fQ.hkX623V0NcqyQ9y6OnjrtyourEVEiJyDVQRfxnCGLQ8';

export const supabase = createClient(supabaseUrl, supabaseKey);