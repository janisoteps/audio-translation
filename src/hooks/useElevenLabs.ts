import { useState, useCallback } from 'react'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8787'

interface UseElevenLabsReturn {
  token: string | null
  isLoading: boolean
  error: Error | null
  getToken: (password: string) => Promise<string>
  clearToken: () => void
}

/**
 * Custom hook for ElevenLabs integration
 * Manages token fetching and caching from the backend
 */
export const useElevenLabs = (): UseElevenLabsReturn => {
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const getToken = useCallback(async (password: string): Promise<string> => {
    // Always fetch a fresh token (tokens are single-use only)
    if (!password) {
      throw new Error('Password is required')
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`${BACKEND_URL}/api/eleven/auth?password=${encodeURIComponent(password)}`)
      
      if (!response.ok) {
        throw new Error(`Failed to get ElevenLabs token: ${response.statusText}`)
      }

      const data = await response.json()
      const newToken = data.token

      if (!newToken) {
        throw new Error('Token not found in response')
      }

      // Store token in state but NOT in localStorage (single-use only)
      setToken(newToken)
      return newToken
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error occurred')
      setError(error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [])

  const clearToken = useCallback(() => {
    setToken(null)
    setError(null)
  }, [])

  return {
    token,
    isLoading,
    error,
    getToken,
    clearToken,
  }
}

