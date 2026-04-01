import { supabaseRequest } from '@/lib/storage/supabase'

export async function supabaseServerRequest<T>(
  table: string,
  init: Parameters<typeof supabaseRequest<T>>[1] = {}
): Promise<T> {
  return await supabaseRequest<T>(table, init)
}
