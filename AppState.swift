import SwiftUI
import Combine

/// Central app state — holds the character definition, conversation, and engine status
class AppState: ObservableObject {
    // MARK: - Character
    @Published var characterDefinition: String = "" {
        didSet { rebuildSystemPrompt() }
    }
    @Published var systemPrompt: String = ""
    
    // MARK: - Conversation
    @Published var messages: [ChatMessage] = []
    @Published var isListening: Bool = false
    @Published var isThinking: Bool = false
    @Published var isSpeaking: Bool = false
    
    // MARK: - Engine Status
    @Published var llmLoaded: Bool = false
    @Published var ttsLoaded: Bool = false
    @Published var modelName: String = "Llama-3.2-3B-Instruct-Q4_K_M"
    
    // MARK: - Voice
    @Published var voiceProfileName: String = "Default"
    @Published var availableVoices: [String] = ["Default", "Custom"]
    
    // MARK: - Audio Routing
    @Published var bluetoothMicAvailable: Bool = false
    @Published var bluetoothSpeakerAvailable: Bool = false
    @Published var useBluetoothAudio: Bool = true
    
    private func rebuildSystemPrompt() {
        if characterDefinition.isEmpty {
            systemPrompt = ""
        } else {
            systemPrompt = """
            You are now impersonating the following character. Stay in character at all times. Never break character. Never acknowledge that you are an AI. Respond as this character would, with their voice, mannerisms, and personality.
            
            CHARACTER:
            \(characterDefinition)
            """
        }
    }
    
    func addMessage(_ message: ChatMessage) {
        messages.append(message)
    }
    
    func clearConversation() {
        messages.removeAll()
    }
}

struct ChatMessage: Identifiable {
    let id = UUID()
    let role: Role
    let content: String
    let timestamp: Date
    
    enum Role {
        case user
        case assistant
        case system
    }
}