# 🎭 Live Translation

A real-time speech translation web application designed for live theater performances and events. Listen to speech in one language and get instant translations with audio playback through your AirPods or headphones.

![React](https://img.shields.io/badge/React-18.3.1-blue?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6.2-blue?logo=typescript)
![Vite](https://img.shields.io/badge/Vite-6.0.1-purple?logo=vite)

## ✨ Features

- 🎤 **Real-time Speech Recognition** - Continuous audio capture and transcription using the Web Speech API
- 🌍 **Multi-language Support** - Translate from various languages to English
- 🔊 **Instant Audio Playback** - Hear translations immediately through your headphones
- 📱 **Mobile-First Design** - Optimized for use on smartphones during live events
- ⚡ **Low Latency** - Phrases are split and translated every 7 words for near-instant results
- 🎯 **Smart Queue Management** - Independent processing pipelines for smooth, uninterrupted translation

## 🚀 Quick Start

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- A modern web browser (Chrome recommended)
- Microphone access

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd audio-translation
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:5173`

### Building for Production

```bash
npm run build
```

The production-ready files will be in the `dist/` directory.

## 📖 How to Use

1. **Select Source Language** - Choose the language being spoken from the dropdown menu
2. **Grant Microphone Access** - Allow the browser to access your microphone when prompted
3. **Click Start** - Press the ▶ Start button to begin listening and translating
4. **Listen** - Translations will automatically play through your device's audio output
5. **Click Stop** - Press ⏹ Stop when you're done

### Recommended Setup for Theater

- Use AirPods or wireless earbuds for discreet listening
- Keep phone in your pocket or on silent mode
- Ensure stable internet connection for translation API
- Test audio volume before the performance starts

## 🏗️ Architecture

The application uses a **4-process pipeline** architecture for maximum efficiency:

```
┌─────────────────────────────────────────────────────────────┐
│  PROCESS 1: Speech Recognition                              │
│  Listens to audio → Transcribes to text → Adds to queue    │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  PROCESS 2: Phrase Creation                                 │
│  Watches word queue → Groups into 7-word phrases           │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  PROCESS 3: Translation                                     │
│  Watches phrase queue → Translates via Google API          │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  PROCESS 4: Audio Playback                                  │
│  Watches translation queue → Speaks via Speech Synthesis   │
└─────────────────────────────────────────────────────────────┘
```

### Key Technical Features

- **Smart Duplicate Prevention** - Tracks all processed text to avoid re-translating on speech recognition restarts
- **Concurrent Translation Lock** - Prevents multiple simultaneous translations
- **Safety Timeouts** - 15-second timeout ensures playback never gets stuck
- **Automatic Restart** - Speech recognition automatically restarts if interrupted
- **Word-Level Splitting** - Processes interim results for ultra-low latency

## 🛠️ Technology Stack

- **Frontend Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Speech Recognition**: Web Speech API (`webkitSpeechRecognition`)
- **Text-to-Speech**: Web Speech API (`SpeechSynthesis`)
- **Translation**: Google Translate API (public endpoint)
- **Styling**: CSS3 with mobile-responsive design

## 🌐 Browser Compatibility

| Browser | Speech Recognition | Text-to-Speech | Recommended |
|---------|-------------------|----------------|-------------|
| Chrome (Desktop) | ✅ | ✅ | ✅ |
| Chrome (Android) | ✅ | ✅ | ✅ |
| Safari (iOS) | ⚠️ Limited | ✅ | ⚠️ |
| Firefox | ❌ | ✅ | ❌ |
| Edge | ✅ | ✅ | ✅ |

**Note**: Chrome on Android provides the best experience due to superior speech recognition support.

## ⚙️ Configuration

### Adjusting Translation Speed

You can modify the phrase length in `App.tsx`:

```typescript
const WORDS_PER_PHRASE = 7 // Change to 5 or 10 to adjust translation frequency
```

- **Lower value** (5): Faster translations, more frequent but shorter phrases
- **Higher value** (10): Slightly delayed but longer, more context-aware phrases

### Changing Speech Rate

Modify the speech rate in `App.tsx`:

```typescript
utterance.rate = 1.0 // Range: 0.1 to 10 (1.0 is normal speed)
```

## 🎯 Use Cases

- 🎭 **Theater Performances** - Real-time translation for foreign language plays
- 🎤 **Conferences** - Live translation for international speakers
- 📺 **Live Events** - Translate commentary or announcements
- 🎓 **Education** - Language learning and comprehension assistance
- 🤝 **Meetings** - Cross-language business communications

## ⚠️ Limitations

- Requires stable internet connection for translation API
- Speech recognition quality depends on audio clarity
- Background noise may affect transcription accuracy
- Translation quality varies by language pair
- May have slight delay (1-3 seconds) depending on speech rate

## 🔮 Future Enhancements

- [ ] Offline translation support using local models
- [ ] Multiple target language options
- [ ] Adjustable translation speed settings in UI
- [ ] Save/export translation history
- [ ] Custom vocabulary for technical terms
- [ ] Speaker identification for multi-person conversations
- [ ] Dark mode
- [ ] PWA support for offline functionality

## 📝 License

This project is open source and available under the MIT License.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 💡 Tips for Best Results

1. **Speak Clearly**: Ensure the speaker articulates words clearly
2. **Reduce Background Noise**: Use in quiet environments when possible
3. **Check Audio Levels**: Test both input (microphone) and output (speakers/earbuds)
4. **Stay Connected**: Maintain a stable internet connection
5. **Use Chrome**: Best browser support for Web Speech API

## 🐛 Troubleshooting

### No audio is being captured
- Check microphone permissions in browser settings
- Ensure microphone is not muted or being used by another application
- Try refreshing the page and granting permissions again

### Translations are delayed
- Check your internet connection speed
- Try reducing the `WORDS_PER_PHRASE` value for faster processing
- Ensure no other bandwidth-intensive tasks are running

### Audio playback is choppy
- Close other tabs or applications
- Reduce browser's audio processing load
- Try lowering the speech rate

---

**Made with ❤️ for breaking language barriers**  
Author: Janis Dzikevics
