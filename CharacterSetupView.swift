import SwiftUI

/// First screen — define who your character is
struct CharacterSetupView: View {
    @EnvironmentObject var appState: AppState
    @Binding var showCharacterSetup: Bool
    @State private var characterText: String = ""
    
    private let examples = [
        "A grumpy but wise old pirate named Captain Hook who speaks in nautical metaphors",
        "A cheerful AI robot named Beep who loves learning about humans",
        "A medieval wizard named Eldric who gives cryptic but helpful advice",
        "A sassy cat named Whiskers who thinks humans are their servants",
    ]
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 24) {
                    // Header
                    VStack(spacing: 8) {
                        Text("🧠")
                            .font(.system(size: 64))
                        Text("Little Rip")
                            .font(.largeTitle.bold())
                        Text("Who am I talking to?")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                    .padding(.top, 40)
                    
                    // Character input
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Describe your character")
                            .font(.headline)
                        TextEditor(text: $characterText)
                            .frame(minHeight: 120)
                            .padding(8)
                            .background(Color(.systemGray6))
                            .cornerRadius(12)
                            .overlay(
                                RoundedRectangle(cornerRadius: 12)
                                    .stroke(Color.accentColor.opacity(0.3), lineWidth: 1)
                            )
                        Text("The AI will become this character. It will stay in character and speak as them.")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    .padding(.horizontal)
                    
                    // Examples
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Or pick a template")
                            .font(.headline)
                            .padding(.horizontal)
                        
                        ForEach(examples, id: \.self) { example in
                            Button {
                                characterText = example
                            } label: {
                                HStack {
                                    Image(systemName: "person.fill")
                                        .foregroundColor(.accentColor)
                                    Text(example)
                                        .font(.subheadline)
                                        .multilineTextAlignment(.leading)
                                    Spacer()
                                }
                                .padding(12)
                                .background(Color(.systemGray6))
                                .cornerRadius(10)
                            }
                        }
                    }
                    .padding(.horizontal)
                    
                    // Start button
                    Button {
                        appState.characterDefinition = characterText
                        showCharacterSetup = false
                    } label: {
                        Text("Bring Them to Life")
                            .font(.headline)
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(characterText.isEmpty ? Color.gray : Color.accentColor)
                            .cornerRadius(12)
                    }
                    .disabled(characterText.isEmpty)
                    .padding(.horizontal)
                    .padding(.bottom, 40)
                }
            }
            .navigationBarHidden(true)
        }
    }
}