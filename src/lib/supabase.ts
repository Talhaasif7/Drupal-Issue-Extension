import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// Use placeholders to prevent top-level crash if env vars are missing during local check
const effectiveUrl = supabaseUrl || 'https://your-project.supabase.co'
const effectiveKey = supabaseAnonKey || 'your-anon-key'

export const supabase = createClient(effectiveUrl, effectiveKey)

export interface TrackedProject {
  id?: string
  project_name: string
  created_at?: string
}

export interface DrupalIssueRecord {
  id?: string
  nid: string
  project_name: string
  title: string
  status: string
  priority: string
  category: string
  last_changed: number
  created_at?: string
}
