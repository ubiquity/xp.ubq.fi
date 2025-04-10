import { createClient } from '@supabase/supabase-js';

// Default values for development
const supabaseUrl = process.env.SUPABASE_URL || 'https://mock.supabase.co';
const supabaseKey = process.env.SUPABASE_API_KEY || 'mock-key-for-development-only';

// Check if we're using mock credentials
const isMockMode = supabaseUrl === 'https://mock.supabase.co';

if (isMockMode) {
  console.warn('Using mock Supabase client. Data will be simulated.');
} else if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase credentials are incomplete. Data fetching may fail.');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// For development, we'll also export a flag to check if we're in mock mode
export const isUsingMockData = isMockMode;
