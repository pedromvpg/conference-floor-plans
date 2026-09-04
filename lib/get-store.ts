import { DemoStore } from "./store-demo";
import { isSupabaseConfigured } from "./store";
import { createAdminSupabase } from "./supabase/admin";
import { SupabaseStore } from "./store-supabase";
import type { Store } from "./store";

let demo: DemoStore | null = null;

export function getStore(): Store {
  if (isSupabaseConfigured()) {
    const sb = createAdminSupabase();
    if (!sb) throw new Error("Supabase admin client missing");
    return new SupabaseStore(sb);
  }
  if (!demo) demo = new DemoStore();
  return demo;
}
