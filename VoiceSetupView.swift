import SwiftUI

/// View for cloning a custom voice for your character
struct VoiceSetupView: View {
    @EnvironmentObject var appState: AppState
    @State private var isRecording = false
    @State private var recordingSeconds = 0
    @State private var customVoiceName = ""
    @State private var showRecording = false
    
    private let presetVoices = [
        "af_bella": "Bella (F, warm)",
        "af_nicole": "Nicole (F, professional)",
        "af_sarah": "Sarah (F, friendly)",
        "am_adam": "Adam (M, deep)",
        "am_michael": "Michael (M, clear)",
        "bf_emma": "Emma (F, British)",
        "bm_george": "George (M, British)",
    ]
    
    var body: some View {
        NavigationView {
            List {
                // Current voice
                Section("Current Voice") {
                    HStack {
                        Image(systemName: "waveform.circle.fill")
                            .foregroundColor(.accentColor)
                        Text(appState.voiceProfileName)
                            .font(.headline)
                        Spacer()
                        Text("Active")
                            .font(.caption)
                            .foregroundColor(.green)
                    }
                }
                
                // Preset voices
                Section("Preset Voices") {
                    ForEach(presetVoices.sorted(by: { $0.key < $1.key }), id: \.key) { key, label in
                        Button {
                            appState.voiceProfileName = key
                        } label: {
                            HStack {
                                Image(systemName: appState.voiceProfileName == key ? "checkmark.circle.fill" : "circle")
                                    .foregroundColor(appState.voiceProfileName == key ? .green : .gray)
                                Text(label)
                                Spacer()
                            }
                        }
                    }
                }
                
                // Clone your own voice
                Section("Clone a Custom Voice") {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Record 3-5 seconds of the voice you want to clone")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                        
                        TextField("Voice name", text: $customVoiceName)
                            .textFieldStyle(.roundedBorder)
                        
                        if isRecording {
                            HStack {
                                RecordingIndicator(seconds: recordingSeconds)
                                Spacer()
                                Button("Stop") {
                                    stopRecording()
                                }
                                .foregroundColor(.red)
                            }
                        } else {
                            Button {
                                startRecording()
                            } label: {
                                Label("Start Recording", systemImage: "mic.circle.fill")
                                    .foregroundColor(.red)
                            }
                        }
                    }
                    .padding(.vertical, 4)
                }
                
                // Info
                Section {
                    VStack(alignment: .leading, spacing: 8) {
                        Label("Kokoro TTS runs on-device", systemImage: "lock.shield")
                        Label("Voice data never leaves your phone", systemImage: "iphone")
                        Label("3.3x faster than real-time", systemImage: "bolt.fill")
                    }
                    .font(.caption)
                    .foregroundColor(.secondary)
                }
            }
            .navigationTitle("Voice Settings")
        }
    }
    
    private func startRecording() {
        isRecording = true
        recordingSeconds = 0
        
        // Timer to count seconds
        Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { timer in
            recordingSeconds += 1
            if recordingSeconds >= 10 {
                timer.invalidate()
                stopRecording()
            }
        }
    }
    
    private func stopRecording() {
        isRecording = false
        
        guard recordingSeconds >= 3 else {
            return // Need at least 3 seconds
        }
        
        let voiceName = customVoiceName.isEmpty ? "Custom_\(Date().timeIntervalSince1970)" : customVoiceName
        
        // TODO: When Kokoro is integrated:
        // 1. Save the recorded audio
        // 2. Call TTSEngine.shared.cloneVoice(from: audioURL, name: voiceName)
        // 3. Add to available voices
        
        appState.voiceProfileName = voiceName
        appState.availableVoices.append(voiceName)
    }
}

struct RecordingIndicator: View {
    let seconds: Int
    
    var body: some View {
        HStack(spacing: 8) {
            Circle()
                .fill(Color.red)
                .frame(width: 12, height: 12)
                .opacity(seconds % 2 == 0 ? 1.0 : 0.3)
                .animation(.easeInOut(duration: 0.5).repeatForever(autoreverses: true), value: seconds)
            
            Text("REC \(seconds)s")
                .font(.caption.monospacedDigit())
                .foregroundColor(.red)
        }
    }
}