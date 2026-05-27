import SwiftUI

struct ContentView: View {
    @EnvironmentObject var appState: AppState
    @State private var showCharacterSetup = true
    
    var body: some View {
        ZStack {
            if showCharacterSetup && appState.characterDefinition.isEmpty {
                CharacterSetupView(showCharacterSetup: $showCharacterSetup)
            } else {
                MainChatView(showCharacterSetup: $showCharacterSetup)
            }
        }
        .animation(.easeInOut(duration: 0.3), value: showCharacterSetup)
    }
}