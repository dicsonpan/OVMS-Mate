import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Safe access to environment variables
const getEnv = (key: string) => {
  try {
    // @ts-ignore
    return import.meta.env?.[key] || '';
  } catch (e) {
    return '';
  }
};

const getClient = (): SupabaseClient | null => {
  // 1. Try to load from LocalStorage (User Settings)
  try {
    const savedConfigStr = localStorage.getItem('ovms_config');
    if (savedConfigStr) {
      const config = JSON.parse(savedConfigStr);
      if (config.supabaseUrl && config.supabaseKey) {
        return createClient(config.supabaseUrl, config.supabaseKey);
      }
    }
  } catch (e) {
    console.error("Error reading config from localStorage", e);
  }

  // 2. Fallback to Environment Variables
  const envUrl = getEnv('VITE_SUPABASE_URL');
  const envKey = getEnv('VITE_SUPABASE_ANON_KEY');

  if (envUrl && envKey) {
    return createClient(envUrl, envKey);
  }

  return null;
};

export const supabase = getClient();

export const isSupabaseConfigured = () => !!supabase;