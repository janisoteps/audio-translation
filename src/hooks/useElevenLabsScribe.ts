import { useCallback, useRef } from 'react'
import { useScribe } from '@elevenlabs/react'

interface UseElevenLabsScribeProps {
  onPhrase: (phrase: string) => void
  language?: string
}

interface UseElevenLabsScribeReturn {
  isConnected: boolean
  partialTranscript: string
  committedTranscripts: Array<{ id: string; text: string }>
  connect: (token: string) => Promise<void>
  disconnect: () => void
}

const WORDS_PER_PHRASE = 10 // Split into 10-word chunks for translation

/**
 * Custom hook for ElevenLabs real-time speech transcription
 * Wraps the @elevenlabs/react useScribe hook with our app logic
 */
export const useElevenLabsScribe = ({
  onPhrase,
  language,
}: UseElevenLabsScribeProps): UseElevenLabsScribeReturn => {
  // Track how many words we've already processed from partial transcripts
  const processedWordCountRef = useRef<number>(0)
  
  const scribe = useScribe({
    modelId: 'scribe_v2_realtime',
    languageCode: language || 'lv', // Specify language for transcription
    
    onPartialTranscript: (data) => {
      // Process partial transcripts when they reach 10+ unprocessed words
      if (data.text && data.text.trim()) {
        const currentPartial = data.text.trim()
        const words = currentPartial.split(/\s+/).filter(w => w.length > 0)
        
        // Calculate how many NEW words are available
        const unprocessedWordCount = words.length - processedWordCountRef.current
        
        // When we have 10+ unprocessed words, extract and process them
        if (unprocessedWordCount >= WORDS_PER_PHRASE) {
          // Take next 10 words starting from where we left off
          const phraseWords = words.slice(
            processedWordCountRef.current, 
            processedWordCountRef.current + WORDS_PER_PHRASE
          )
          const phrase = phraseWords.join(' ')
          
          // Send phrase to translation pipeline
          onPhrase(phrase)
          
          // Update our tracking
          processedWordCountRef.current += WORDS_PER_PHRASE
        }
      }
    },
    
    onCommittedTranscript: (data) => {
      // When transcript is committed, process any remaining unprocessed words
      if (data.text && data.text.trim()) {
        const words = data.text.trim().split(/\s+/).filter(w => w.length > 0)
        
        // If there are remaining words that weren't processed as partial
        if (words.length > processedWordCountRef.current) {
          const remainingWords = words.slice(processedWordCountRef.current)
          const remainingPhrase = remainingWords.join(' ')
          
          if (remainingPhrase) {
            onPhrase(remainingPhrase)
          }
        }
        
        // Reset counter for next transcript
        processedWordCountRef.current = 0
      }
    },
    
    onCommittedTranscriptWithTimestamps: () => {
      // Timestamps available if needed in the future
    },
  })

  const connect = useCallback(
    async (token: string) => {
      await scribe.connect({
        token,
        microphone: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      })
    },
    [scribe]
  )

  const disconnect = useCallback(() => {
    scribe.disconnect()
    // Reset word counter when disconnecting
    processedWordCountRef.current = 0
  }, [scribe])

  return {
    isConnected: scribe.isConnected,
    partialTranscript: scribe.partialTranscript || '',
    committedTranscripts: scribe.committedTranscripts || [],
    connect,
    disconnect,
  }
}

