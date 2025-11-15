import { useState, useEffect, useCallback, useRef } from 'react'
import { useElevenLabs, useElevenLabsScribe } from '../hooks'

interface Language {
  code: string
  name: string
}

const LANGUAGES: Language[] = [
  { code: 'lv', name: 'Latvian' },
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ru', name: 'Russian' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
]

const PASSWORD_STORAGE_KEY = 'elevenlabs_password'

export function IphoneTranslateView() {
  const [selectedLanguage, setSelectedLanguage] = useState<string>('lv')
  const { token, getToken, isLoading, error, clearToken } = useElevenLabs()
  
  // Password management
  const [password, setPassword] = useState<string>(() => {
    return localStorage.getItem(PASSWORD_STORAGE_KEY) || ''
  })
  const [passwordInput, setPasswordInput] = useState<string>('')
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  
  // Translation pipeline states (similar to DefaultTranslateView)
  const [phraseArray, setPhraseArray] = useState<string[]>([])
  const [translatedArray, setTranslatedArray] = useState<string[]>([])
  const [currentTranslation, setCurrentTranslation] = useState<string>('')
  const [recentTranslations, setRecentTranslations] = useState<string[]>([])
  
  // Refs for concurrency control and speech synthesis
  const synthesisRef = useRef<SpeechSynthesis | null>(null)
  const isTranslatingRef = useRef<boolean>(false)
  const isSpeakingRef = useRef<boolean>(false)
  
  // Handle committed phrases from ElevenLabs
  const handlePhrase = useCallback((phrase: string) => {
    setPhraseArray(prev => [...prev, phrase])
  }, [])
  
  // ElevenLabs Scribe integration
  const scribe = useElevenLabsScribe({
    onPhrase: handlePhrase,
    language: selectedLanguage,
  })

  // Initialize speech synthesis
  useEffect(() => {
    if ('speechSynthesis' in window) {
      synthesisRef.current = window.speechSynthesis
    }
  }, [])

  // Fetch token when password is set and token is not available
  useEffect(() => {
    if (password && !token && !isLoading) {
      getToken(password).catch(() => {
        // Token fetch failed, might need to re-authenticate
      })
    }
  }, [password, token, isLoading, getToken])

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!passwordInput.trim()) {
      setAuthError('Please enter a password')
      return
    }

    setIsAuthenticating(true)
    setAuthError(null)

    try {
      // Fetch token with password
      await getToken(passwordInput)
      
      // Store password in localStorage
      localStorage.setItem(PASSWORD_STORAGE_KEY, passwordInput)
      setPassword(passwordInput)
      setPasswordInput('')
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setIsAuthenticating(false)
    }
  }

  const handleLogout = () => {
    // Clear everything
    localStorage.removeItem(PASSWORD_STORAGE_KEY)
    clearToken()
    setPassword('')
    setPasswordInput('')
    setAuthError(null)
  }

  // Translation Pipeline - Process 1: Translate phrases
  useEffect(() => {
    if (phraseArray.length === 0) return
    if (isTranslatingRef.current) return // Prevent concurrent translations

    const translateNextPhrase = async () => {
      isTranslatingRef.current = true
      const phrase = phraseArray[0]
      
      try {
        const response = await fetch(
          `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${selectedLanguage}&tl=en&dt=t&q=${encodeURIComponent(phrase)}`
        )
        
        if (!response.ok) {
          throw new Error('Translation failed')
        }
        
        const data = await response.json()
        // Google Translate returns translation in segments, combine them all
        const translation = data[0].map((segment: any) => segment[0]).join('')
        
        // Remove from phrase array and add to translated array
        setPhraseArray(prev => prev.slice(1))
        setTranslatedArray(prev => [...prev, translation])
        setRecentTranslations(prev => [...prev, translation].slice(-3))
      } catch {
        // On error, still remove from phrase array to avoid blocking
        setPhraseArray(prev => prev.slice(1))
      } finally {
        isTranslatingRef.current = false
      }
    }

    translateNextPhrase()
  }, [phraseArray, selectedLanguage])

  // Translation Pipeline - Process 2: Speak translated phrases
  useEffect(() => {
    if (translatedArray.length === 0) return
    if (isSpeakingRef.current) return // Wait for current speech to finish

    const speakNextPhrase = () => {
      const phrase = translatedArray[0]
      
      setCurrentTranslation(phrase)
      
      if (!synthesisRef.current) {
        synthesisRef.current = window.speechSynthesis
      }
      
      isSpeakingRef.current = true
      const utterance = new SpeechSynthesisUtterance(phrase)
      utterance.lang = 'en-US'
      utterance.rate = 1.0
      utterance.pitch = 1.0
      utterance.volume = 1.0
      
      // Safety timeout in case onend doesn't fire (browser bugs)
      const safetyTimeout = setTimeout(() => {
        isSpeakingRef.current = false
        setTranslatedArray(prev => prev.slice(1))
      }, 15000)
      
      utterance.onend = () => {
        clearTimeout(safetyTimeout)
        isSpeakingRef.current = false
        setTranslatedArray(prev => prev.slice(1))
      }
      
      utterance.onerror = () => {
        clearTimeout(safetyTimeout)
        isSpeakingRef.current = false
        setTranslatedArray(prev => prev.slice(1))
      }
      
      synthesisRef.current.speak(utterance)
    }

    speakNextPhrase()
  }, [translatedArray])

  const handleStartStop = async () => {
    if (scribe.isConnected) {
      // Stop recording
      scribe.disconnect()
      // DON'T clear arrays - let the translation pipeline complete naturally
      // But reset the refs to prevent any stuck states
      isTranslatingRef.current = false
      isSpeakingRef.current = false
    } else {
      try {
        if (!password) {
          throw new Error('Password not available')
        }
        
        // Clear previous session's data when starting fresh
        setPhraseArray([])
        setTranslatedArray([])
        setCurrentTranslation('')
        
        // Reset refs for clean start
        isTranslatingRef.current = false
        isSpeakingRef.current = false
        
        // Prime speech synthesis for iOS (must happen on user interaction)
        if (window.speechSynthesis) {
          // Speak empty utterance to "wake up" iOS speech synthesis
          const primeUtterance = new SpeechSynthesisUtterance('')
          window.speechSynthesis.speak(primeUtterance)
        }
        
        // Fetch a fresh token (tokens are single-use only)
        const freshToken = await getToken(password)
        
        // Connect to ElevenLabs with the fresh token
        await scribe.connect(freshToken)
      } catch (err) {
        alert('Failed to start speech recognition: ' + (err instanceof Error ? err.message : err))
      }
    }
  }

  // Show password prompt if not authenticated
  if (!password) {
    return (
      <div className="app">
        <div className="container" style={{ maxWidth: '500px', margin: '0 auto' }}>
          <h1>Live Translation</h1>
          <p style={{ 
            background: '#e3f2fd', 
            padding: '1rem', 
            borderRadius: '8px',
            marginBottom: '1.5rem',
            color: '#1976d2'
          }}>
            📱 <strong>iPhone Version</strong>
          </p>

          <div style={{
            background: 'white',
            padding: '2rem',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            <h2 style={{ marginTop: 0, marginBottom: '1rem' }}>🔐 Authentication Required</h2>
            <p style={{ color: '#666', marginBottom: '1.5rem' }}>
              Please enter your password to access ElevenLabs speech recognition.
            </p>

            <form onSubmit={handlePasswordSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="password-input" style={{ 
                  display: 'block', 
                  marginBottom: '0.5rem',
                  fontWeight: 500 
                }}>
                  Password:
                </label>
                <input
                  id="password-input"
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Enter your password"
                  disabled={isAuthenticating}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    fontSize: '1rem',
                    border: '2px solid #ddd',
                    borderRadius: '8px',
                    boxSizing: 'border-box'
                  }}
                  autoFocus
                />
              </div>

              {authError && (
                <div style={{
                  background: '#fee',
                  color: '#c33',
                  padding: '0.75rem',
                  borderRadius: '6px',
                  marginBottom: '1rem',
                  fontSize: '0.9rem'
                }}>
                  ❌ {authError}
                </div>
              )}

              <button
                type="submit"
                disabled={isAuthenticating || !passwordInput.trim()}
                style={{
                  width: '100%',
                  padding: '0.875rem',
                  fontSize: '1rem',
                  fontWeight: 600,
                  background: isAuthenticating ? '#ccc' : '#1976d2',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: isAuthenticating ? 'not-allowed' : 'pointer'
                }}
              >
                {isAuthenticating ? '🔄 Authenticating...' : '✓ Submit'}
              </button>
            </form>

            <p style={{ 
              marginTop: '1.5rem', 
              fontSize: '0.875rem', 
              color: '#999',
              textAlign: 'center' 
            }}>
              Your password is stored locally and used to fetch authentication tokens.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Main UI - shown when authenticated
  return (
    <div className="app">
      <div className="container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h1 style={{ margin: 0 }}>Live Translation</h1>
          <button
            onClick={handleLogout}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              background: '#f5f5f5',
              border: '1px solid #ddd',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            🚪 Logout
          </button>
        </div>

        <p style={{ 
          background: '#e3f2fd', 
          padding: '1rem', 
          borderRadius: '8px',
          marginBottom: '1rem',
          color: '#1976d2'
        }}>
          📱 <strong>iPhone Version</strong> - Using ElevenLabs
          {token && <span style={{ marginLeft: '0.5rem' }}>✓ Authenticated</span>}
        </p>

        {error && (
          <div style={{
            background: '#fee',
            color: '#c33',
            padding: '0.75rem',
            borderRadius: '6px',
            marginBottom: '1rem',
            fontSize: '0.9rem'
          }}>
            ⚠️ Token error: {error.message}
          </div>
        )}
        
        <div className="controls">
          <div className="language-selector">
            <label htmlFor="language-select">Input Language:</label>
            <select
              id="language-select"
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              disabled={scribe.isConnected}
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </select>
          </div>
          
          <button
            className={`start-stop-btn ${scribe.isConnected ? 'listening' : ''}`}
            onClick={handleStartStop}
            disabled={!token}
          >
            {scribe.isConnected ? '⏹ Stop' : '▶ Start'}
          </button>
        </div>

        {scribe.isConnected && (
          <div className="status-indicator">
            <span className="pulse-dot"></span>
            Listening...
          </div>
        )}

        {scribe.partialTranscript && (
          <div style={{
            background: '#f5f5f5',
            padding: '0.75rem',
            borderRadius: '6px',
            marginBottom: '1rem',
            fontSize: '0.9rem',
            color: '#666',
            fontStyle: 'italic'
          }}>
            Live: {scribe.partialTranscript}
          </div>
        )}

        <div className="transcription-section">
          <h2>Phrases Waiting for Translation ({selectedLanguage})</h2>
          <div className="text-display transcribed">
            {phraseArray.length > 0 ? phraseArray.join(' • ') : <span className="placeholder">Phrases waiting for translation will appear here...</span>}
          </div>
        </div>

        <div className="translation-section">
          <h2>Current Translation (English)</h2>
          <div className="text-display translated">
            {currentTranslation || <span className="placeholder">Current phrase will appear here...</span>}
          </div>
        </div>

        {recentTranslations.length > 0 && (
          <div className="sentences-section">
            <h3>Recent Translations:</h3>
            <div className="sentences-list">
              {recentTranslations.map((sentence, index) => (
                <div key={index} className="sentence-item">
                  {sentence}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

