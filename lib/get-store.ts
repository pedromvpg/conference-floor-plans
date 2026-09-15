import { DemoStore } from "./store-demo";
import { canUseDemoStore, isSupabaseConfigured, supabaseRequiredError } from "./store";
import { createAdminSupabase } from "./supabase/admin";
import { SupabaseStore } from "./store-supabase";
import type { Store } from "./store";

let demo: DemoStore | null = null;

export function getStore(): Store {
  if (isSupabaseConfigured()) {
    const sb = createAdminSupabase();
    if (!sb) throw supabaseRequiredError();
    return new SupabaseStore(sb);
  }
  if (!canUseDemoStore()) {
    throw supabaseRequiredError();
  }
  if (!demo) demo = new DemoStore();
  return demo;
}
