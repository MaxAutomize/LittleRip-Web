# Little Rip 🎤🧠🎧

Your own voice-powered local AI character running entirely on your iPhone.

- **LLM**: [llama.cpp](https://github.com/ggml-org/llama.cpp) (GGUF models, Metal GPU acceleration)
- **Speech-to-Text**: Apple Speech Framework (on-device, Bluetooth mic support)
- **Text-to-Speech**: [Kokoro TTS](https://github.com/mlalma/kokoro-ios) (82M params, on-device, voice cloning)
- **100% offline** — nothing leaves your phone

## Setup

### 1. Open in Xcode
Double-click `LittleRip.xcodeproj` (you'll create this after adding SPM deps).

### 2. Add Swift Package Dependencies
In Xcode: File → Add Package Dependencies:

| Package | URL | Notes |
|---------|-----|-------|
| llama.cpp | `https://github.com/StanfordBDHG/llama.cpp` | C++ interop required |
| kokoro-ios | `https://github.com/mlalma/kokoro-ios` | MLX Swift + eSpeak NG |
| MLX Swift | `https://github.com/ml-explore/mlx-swift` | Required by kokoro |

### 3. Build Settings
- Set **C++ and Objective-C Interoperability** to `C++ / Objective-C++`
- Add capability: **Microphone** (Speech recognition)
- Add capability: **Bluetooth** (Audio routing)

### 4. Add Models
- **LLM**: Place a GGUF model in the app's Documents directory (e.g. `Llama-3.2-3B-Instruct-Q4_K_M.gguf`)
- **TTS**: Kokoro model weights go in app Resources

### 5. Configure Your Character
When you launch Little Rip, you set the character. Example:
- "You are a grumpy old pirate named Captain Hook"
- "You are a cheerful robot assistant named Beep"
- Anything you want — the system prompt is blank until YOU define it

## Architecture

```
Bluetooth Mic → Apple Speech (STT) → Text → llama.cpp (character prompt) → Text → Kokoro TTS → Bluetooth Speaker
```

## Voice Cloning
Kokoro supports voice embeddings from short audio clips. Record 3-5 seconds of any voice in the app and it becomes the voice of your character.

## Requirements
- iPhone with A15 chip or later (A17 Pro / A18 Pro recommended)
- iOS 17.0+
- 4GB+ free storage for models