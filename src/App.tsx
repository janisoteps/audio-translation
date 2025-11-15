import './App.css'
import { DefaultTranslateView, IphoneTranslateView } from './components'

/**
 * App Component
 * 
 * Detects the platform and renders the appropriate translation view:
 * - iPhone/iPad: Uses ElevenLabs for speech recognition (Web Speech API not supported)
 * - Android/Desktop: Uses Web Speech API (Chrome/Edge)
 */

// Detect if user is on iOS device
const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent)

// Force iPhone view for testing (controlled by environment variable)
// Set VITE_FORCE_IPHONE_VIEW=true in .env to enable
const FORCE_IPHONE_VIEW = import.meta.env.VITE_FORCE_IPHONE_VIEW === 'true'

function App() {
  // Render iPhone-specific view with ElevenLabs integration
  if (isIOS || FORCE_IPHONE_VIEW) {
    return <IphoneTranslateView />
  }

  // Render default view with Web Speech API for Android/Desktop
  return <DefaultTranslateView />
}

export default App
