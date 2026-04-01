import { getSupabaseRuntimeConfig } from '@/lib/storage/supabase'

export function getSupabaseBrowserClientConfig() {
  const config = getSupabaseRuntimeConfig()

  return {
    url: config.url,
    publishableKey: config.publishableKey,
  }
}
