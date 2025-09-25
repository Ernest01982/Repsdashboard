import { createClient } from '@supabase/supabase-js'
import { Database } from './database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

// Enhanced error handler for Supabase requests
export const handleSupabaseError = (error: any, operation: string) => {
  console.error(`Supabase ${operation} error:`, error)
  
  if (error?.code === '54001') {
    return {
      message: 'Database configuration issue detected. Please contact support.',
      details: 'Stack depth limit exceeded - this requires database configuration changes.',
      userMessage: 'There\'s a temporary issue with the database. Please try again later or contact support.'
    }
  }
  
  if (error?.code === 'PGRST116') {
    return {
      message: 'Row Level Security policy violation',
      userMessage: 'You don\'t have permission to access this data.'
    }
  }
  
  return {
    message: error?.message || 'An unexpected error occurred',
    userMessage: error?.message || 'Something went wrong. Please try again.'
  }
}