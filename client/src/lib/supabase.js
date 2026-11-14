import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://fesfjcyxcuxvdujhozvn.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZlc2ZqY3l4Y3V4dmR1amhvenZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQyOTgwNjAsImV4cCI6MjEwOTg3NDA2MH0.Bu5GKUgmvIQBt4qwSEGxB8ZU13mm51rDb9A4dtYLCx8";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: "implicit",
  },
});
