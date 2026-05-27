# Little Rip — Setup Guide

## Step-by-step: Get it running on your iPhone

### 1. Install Xcode
Download from the Mac App Store if you don't have it.

### 2. Create the Xcode Project
1. Open Xcode → Create a new Xcode project
2. Choose **iOS → App**
3. Product Name: **LittleRip**
4. Organization Identifier: **com.little-rip**
5. Interface: **SwiftUI**
6. Language: **Swift**
7. Save to: wherever you want
8. **Delete** the auto-generated `ContentView.swift` and `LittleRipApp.swift`

### 3. Add the Source Files
Drag all the `.swift` files from this folder into your Xcode project:
- `LittleRipApp.swift`
- `AppState.swift`
- `ContentView.swift`
- `CharacterSetupView.swift`
- `MainChatView.swift`
- `LLMEngine.swift`
- `TTSEngine.swift`
- `SpeechManager.swift`
- `AudioManager.swift`
- `VoiceSetupView.swift`

### 4. Add Package Dependencies
In Xcode: **File → Add Package Dependencies**

| Package | URL |
|---------|-----|
| llama.cpp (LLM) | `https://github.com/StanfordBDHG/llama.cpp` |
| kokoro-ios (TTS) | `https://github.com/mlalma/kokoro-ios` |
| MLX Swift | `https://github.com/ml-explore/mlx-swift` |

### 5. Build Settings
1. Select your project → Build Settings
2. Search for **"C++ and Objective-C Interoperability"**
3. Set to **C++ / Objective-C++** (required for llama.cpp)

### 6. Capabilities
1. Select your target → Signing & Capabilities
2. Add: **Audio, AirPlay, and Picture in Picture**
3. Add: **Speech** (if listed)
4. Make sure **Microphone** and **Bluetooth** permissions are in Info.plist (they are already)

### 7. Add Models

#### LLM Model
Download a GGUF model and add it to the app:
1. Go to https://huggingface.co/models?sort=trending&search=llama+3.2+gguf
2. Download `Llama-3.2-3B-Instruct-Q4_K_M.gguf` (~2GB)
3. In Xcode, add it to your project or copy it to the app's Documents directory on the device

#### Kokoro TTS Model
1. Download from https://huggingface.co/prince-canuma/Kokoro-82M
2. Add `kokoro-v1_0.safetensors` to your project Resources

### 8. Connect Bluetooth
1. Pair your Bluetooth mic and speaker in iOS Settings → Bluetooth
2. Little Rip will auto-detect and route audio through them

### 9. Build & Run
1. Connect your iPhone via USB
2. Select your iPhone as the run destination in Xcode
3. Hit **⌘R** or the Play button
4. Define your character
5. Hit the mic button and start talking!

---

## Troubleshooting

### "Model not found"
Make sure the GGUF file is in the app's Documents directory. You can add it through Xcode's device file transfer or download it within the app.

### Bluetooth not working
- Make sure the BT device is paired in iOS Settings first
- Check that both `NSBluetoothAlwaysUsageDescription` and `NSBluetoothPeripheralUsageDescription` are in Info.plist
- AVAudioSession needs `.allowBluetooth` option

### App expires after 7 days
Free Apple Developer accounts can only sideload for 7 days. Either:
- Re-sign each week (annoying but free)
- Pay $99/year for a proper Apple Developer account

### Speech recognition not working
- Go to Settings → Privacy → Speech Recognition and grant permission
- `SFSpeechAudioBufferRecognitionRequest.requiresOnDeviceRecognition = true` ensures it works offline