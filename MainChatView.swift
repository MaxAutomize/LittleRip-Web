import SwiftUI

/// Main conversation screen — mic button, conversation, controls
struct MainChatView: View {
    @EnvironmentObject var appState: AppState
    @Binding var showCharacterSetup: Bool
    @StateObject private var speechManager = SpeechManager()
    @StateObject private var audioManager = AudioManager()
    
    var body: some View {
        VStack(spacing: 0) {
            // Top bar
            HStack {
                Button {
                    showCharacterSetup = true
                } label: {
                    Image(systemName: "person.crop.circle")
                        .font(.title2)
                }
                
                Spacer()
                
                VStack {
                    Text("Little Rip")
                        .font(.headline)
                    statusLabel
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                
                Spacer()
                
                Button {
                    appState.clearConversation()
                } label: {
                    Image(systemName: "trash")
                        .font(.title2)
                }
            }
            .padding()
            .background(Color(.systemBackground))
            
            Divider()
            
            // Conversation
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 12) {
                        ForEach(appState.messages) { msg in
                            MessageBubble(message: msg)
                                .id(msg.id)
                        }
                    }
                    .padding()
                }
                .onChange(of: appState.messages.count) { _ in
                    if let last = appState.messages.last {
                        proxy.scrollTo(last.id, anchor: .bottom)
                    }
                }
            }
            
            Divider()
            
            // Bottom control bar
            VStack(spacing: 12) {
                // Status indicators
                HStack(spacing: 16) {
                    StatusDot(label: "Listen", active: appState.isListening, color: .blue)
                    StatusDot(label: "Think", active: appState.isThinking, color: .orange)
                    StatusDot(label: "Speak", active: appState.isSpeaking, color: .green)
                    Spacer()
                    if appState.useBluetoothAudio {
                        Image(systemName: "headphones")
                            .foregroundColor(.blue)
                    }
                }
                .font(.caption)
                .padding(.horizontal)
                
                // Mic button
                Button {
                    toggleListening()
                } label: {
                    ZStack {
                        Circle()
                            .fill(appState.isListening ? Color.red : Color.accentColor)
                            .frame(width: 72, height: 72)
                        Image(systemName: appState.isListening ? "stop.fill" : "mic.fill")
                            .font(.title)
                            .foregroundColor(.white)
                    }
                }
                .padding(.bottom, 8)
            }
            .padding(.vertical)
            .background(Color(.systemBackground))
        }
    }
    
    @ViewBuilder
    private var statusLabel: some View {
        if appState.isListening {
            Text("Listening...")
        } else if appState.isThinking {
            Text("Thinking...")
        } else if appState.isSpeaking {
            Text("Speaking...")
        } else {
            Text("Tap to talk")
        }
    }
    
    private func toggleListening() {
        if appState.isListening {
            speechManager.stopListening()
            appState.isListening = false
        } else {
            // Set up audio routing for Bluetooth
            audioManager.configureBluetoothAudio()
            
            speechManager.startListening { transcript in
                // User said something → send to LLM
                let userMsg = ChatMessage(role: .user, content: transcript, timestamp: Date())
                appState.addMessage(userMsg)
                
                appState.isThinking = true
                
                // Generate response
                LLMEngine.shared.generate(
                    systemPrompt: appState.systemPrompt,
                    messages: appState.messages
                ) { response in
                    DispatchQueue.main.async {
                        appState.isThinking = false
                        let assistantMsg = ChatMessage(role: .assistant, content: response, timestamp: Date())
                        appState.addMessage(assistantMsg)
                        
                        // Speak the response
                        appState.isSpeaking = true
                        TTSEngine.shared.speak(text: response, voice: appState.voiceProfileName) {
                            DispatchQueue.main.async {
                                appState.isSpeaking = false
                            }
                        }
                    }
                }
            }
            appState.isListening = true
        }
    }
}

// MARK: - Subviews

struct MessageBubble: View {
    let message: ChatMessage
    
    var body: some View {
        HStack {
            if message.role == .user { Spacer() }
            
            VStack(alignment: message.role == .user ? .trailing : .leading, spacing: 4) {
                Text(message.content)
                    .padding(12)
                    .background(
                        message.role == .user
                        ? Color.accentColor.opacity(0.2)
                        : Color(.systemGray6)
                    )
                    .cornerRadius(16)
                
                Text(message.timestamp, style: .time)
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
            
            if message.role == .assistant { Spacer() }
        }
    }
}

struct StatusDot: View {
    let label: String
    let active: Bool
    let color: Color
    
    var body: some View {
        HStack(spacing: 4) {
            Circle()
                .fill(active ? color : Color.gray.opacity(0.3))
                .frame(width: 8, height: 8)
            Text(label)
                .foregroundColor(active ? .primary : .secondary)
        }
    }
}