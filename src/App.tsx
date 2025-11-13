import { useState, useEffect, useRef } from 'react'
import './App.css'

// Type definitions for Speech Recognition API
interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
}

interface SpeechRecognitionEvent {
  resultIndex: number
  results: SpeechRecognitionResultList
}

interface SpeechRecognitionResultList {
  length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
  length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
  isFinal: boolean
}

interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}

interface SpeechRecognitionErrorEvent {
  error: string
  message: string
}

declare var SpeechRecognition: {
  new (): SpeechRecognition
}

declare var webkitSpeechRecognition: {
  new (): SpeechRecognition
}

declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition
    webkitSpeechRecognition: typeof SpeechRecognition
  }
}

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

const WORDS_PER_PHRASE = 10

function App() {
  const [selectedLanguage, setSelectedLanguage] = useState<string>('lv')
  const [isListening, setIsListening] = useState(false)
  
  // STATE ARRAYS - The core of our architecture
  const [wordArray, setWordArray] = useState<string[]>([]) // Process 1 fills this
  const [phraseArray, setPhraseArray] = useState<string[]>([]) // Process 2 fills this
  const [translatedArray, setTranslatedArray] = useState<string[]>([]) // Process 3 fills this
  
  // Display states
  const [currentTranslation, setCurrentTranslation] = useState<string>('')
  const [recentTranslations, setRecentTranslations] = useState<string[]>([])
  
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const synthesisRef = useRef<SpeechSynthesis | null>(null)
  const isSpeakingRef = useRef<boolean>(false)
  const isTranslatingRef = useRef<boolean>(false) // Prevent concurrent translations
  const lastInterimRef = useRef<string>('') // Track last interim text to avoid duplicates
  const processedWordCountRef = useRef<number>(0) // Track how many words we've processed from interim
  const allProcessedTextRef = useRef<string>('') // Track ALL text we've ever processed to prevent duplicates

  // PROCESS 1: Listen to audio and add words to WORD ARRAY
  useEffect(() => {
    if (!isListening) return

    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      const recognition = new SpeechRecognition()
      
      recognition.continuous = true
      recognition.interimResults = true // Use interim results for real-time processing
      recognition.lang = selectedLanguage === 'lv' ? 'lv-LV' : `${selectedLanguage}-${selectedLanguage.toUpperCase()}`
      
      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interimTranscript = ''
        let finalTranscript = ''
        
        // Collect all results
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' '
          } else {
            interimTranscript += transcript
          }
        }
        
        // Process FINAL transcript
        if (finalTranscript.trim()) {
          const transcript = finalTranscript.trim()
          
          // Check if this FINAL text overlaps with what we already processed as INTERIM
          let textToAdd = transcript
          
          if (lastInterimRef.current && transcript.startsWith(lastInterimRef.current)) {
            // The FINAL starts with text we already processed as interim - skip that portion
            textToAdd = transcript.substring(lastInterimRef.current.length).trim()
          } else if (allProcessedTextRef.current && transcript.startsWith(allProcessedTextRef.current)) {
            // The FINAL starts with text we processed before - skip that portion
            textToAdd = transcript.substring(allProcessedTextRef.current.length).trim()
          }
          
          if (textToAdd) {
            // Split into words and add to WORD ARRAY (only NEW words)
            const words = textToAdd.split(/\s+/).filter((w: string) => w.length > 0)
            
            setWordArray(prev => [...prev, ...words])
            
            // Update our record of all processed text
            allProcessedTextRef.current = (allProcessedTextRef.current + ' ' + textToAdd).trim()
          }
          
          // Clear interim tracking since we got the final version
          lastInterimRef.current = ''
          processedWordCountRef.current = 0
        }
        // Process INTERIM: when reaches 10+ words beyond what we've already processed
        else if (interimTranscript.trim()) {
          const currentInterim = interimTranscript.trim()
          const words = currentInterim.split(/\s+/).filter((w: string) => w.length > 0)
          
          // Calculate how many NEW words are available (beyond what we've processed)
          const unprocessedWordCount = words.length - processedWordCountRef.current
          
          // When we have 10+ unprocessed words
          if (unprocessedWordCount >= WORDS_PER_PHRASE) {
            // Take next 10 words (starting from where we left off)
            const phraseWords = words.slice(processedWordCountRef.current, processedWordCountRef.current + WORDS_PER_PHRASE)
            const phrase = phraseWords.join(' ')
            
            // Add phrase directly to PHRASE ARRAY (bypass WORD ARRAY for speed)
            setPhraseArray(prev => [...prev, phrase])
            
            // Update our tracking of processed text and word count
            allProcessedTextRef.current = (allProcessedTextRef.current + ' ' + phrase).trim()
            processedWordCountRef.current += WORDS_PER_PHRASE
            lastInterimRef.current = currentInterim
          }
        }
      }
      
      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        if (event.error === 'no-speech' || event.error === 'audio-capture') {
          return
        }
      }
      
      recognition.onend = () => {
        if (isListening) {
          try {
            recognition.start()
          } catch (e) {
            // Silently handle restart errors
          }
        }
      }
      
      recognitionRef.current = recognition
      
      try {
        recognition.start()
      } catch (error) {
        alert('Failed to start speech recognition. Please check microphone permissions.')
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
        recognitionRef.current = null
      }
    }
  }, [isListening, selectedLanguage])

  // PROCESS 2: Watch WORD ARRAY, when reaches 10 words, move to PHRASE ARRAY
  useEffect(() => {
    if (wordArray.length >= WORDS_PER_PHRASE) {
      // Take first 10 words
      const wordsToProcess = wordArray.slice(0, WORDS_PER_PHRASE)
      const phrase = wordsToProcess.join(' ')
      
      // Remove those words from WORD ARRAY and add phrase to PHRASE ARRAY
      setWordArray(prev => prev.slice(WORDS_PER_PHRASE))
      setPhraseArray(prev => [...prev, phrase])
    }
  }, [wordArray])

  // PROCESS 3: Watch PHRASE ARRAY, translate phrases and move to TRANSLATED ARRAY
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
        const translation = data[0][0][0]
        
        // Remove from PHRASE ARRAY and add to TRANSLATED ARRAY
        setPhraseArray(prev => prev.slice(1))
        setTranslatedArray(prev => [...prev, translation])
        setRecentTranslations(prev => [...prev, translation].slice(-3))
      } catch (error) {
        // On error, still remove from phrase array to avoid blocking
        setPhraseArray(prev => prev.slice(1))
      } finally {
        isTranslatingRef.current = false
      }
    }

    translateNextPhrase()
  }, [phraseArray, selectedLanguage])

  // PROCESS 4: Watch TRANSLATED ARRAY, speak phrases and remove them
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
      }, 15000) // 15 second safety timeout
      
      utterance.onend = () => {
        clearTimeout(safetyTimeout)
        isSpeakingRef.current = false
        // Remove from TRANSLATED ARRAY
        setTranslatedArray(prev => prev.slice(1))
      }
      
      utterance.onerror = () => {
        clearTimeout(safetyTimeout)
        isSpeakingRef.current = false
        // Remove from TRANSLATED ARRAY even on error
        setTranslatedArray(prev => prev.slice(1))
      }
      
      synthesisRef.current.speak(utterance)
    }

    speakNextPhrase()
  }, [translatedArray])

  const handleStartStop = () => {
    if (isListening) {
      setIsListening(false)
    } else {
      // Clear all arrays and refs
      setWordArray([])
      setPhraseArray([])
      setTranslatedArray([])
      setCurrentTranslation('')
      setRecentTranslations([])
      lastInterimRef.current = ''
      processedWordCountRef.current = 0
      allProcessedTextRef.current = ''
      isTranslatingRef.current = false
      isSpeakingRef.current = false
      setIsListening(true)
    }
  }

  // Initialize speech synthesis
  useEffect(() => {
    if ('speechSynthesis' in window) {
      synthesisRef.current = window.speechSynthesis
    }
  }, [])

  return (
    <div className="app">
      <div className="container">
        <h1>Live Translation</h1>
        
        <div className="controls">
          <div className="language-selector">
            <label htmlFor="language-select">Input Language:</label>
            <select
              id="language-select"
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              disabled={isListening}
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </select>
          </div>
          
          <button
            className={`start-stop-btn ${isListening ? 'listening' : ''}`}
            onClick={handleStartStop}
          >
            {isListening ? '⏹ Stop' : '▶ Start'}
          </button>
        </div>

        {isListening && (
          <div className="status-indicator">
            <span className="pulse-dot"></span>
            Listening...
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

export default App
