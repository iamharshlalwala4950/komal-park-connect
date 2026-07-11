import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pniuqioremyuomrvntaw.supabase.co'; // Replace with your actual project URL
const supabaseAnonKey = 'sb_publishable_kUfB0p6IpeOhwUEBQ1nxgg_kuv56JUr';           // Replace with your actual API key

export const supabase = createClient(supabaseUrl, supabaseAnonKey);