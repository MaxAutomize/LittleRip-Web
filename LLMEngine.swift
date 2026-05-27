import Foundation

/// Wraps llama.cpp for on-device inference
/// In Xcode: add StanfordBDHG/llama.cpp Swift Package dependency
///
/// Usage:
///   LLMEngine.shared.loadModel(name: "Llama-3.2-3B-Instruct-Q4_K_M")
///   LLMEngine.shared.generate(systemPrompt:messages:) { response in ... }

class LLMEngine {
    static let shared = LLMEngine()
    
    private var isModelLoaded = false
    private var modelPath: String?
    
    private init() {}
    
    // MARK: - Model Management
    
    /// Load a GGUF model from the app's Documents directory
    func loadModel(name: String, completion: @escaping (Bool) -> Void) {
        let documentsDir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let modelURL = documentsDir.appendingPathComponent("\(name).gguf")
        
        // Check if model file exists
        guard FileManager.default.fileExists(atPath: modelURL.path) else {
            print("❌ Model not found at: \(modelURL.path)")
            print("💡 Place your GGUF model in: \(documentsDir.path)")
            completion(false)
            return
        }
        
        self.modelPath = modelURL.path
        
        // TODO: Initialize llama.cpp context here
        // When the SPM package is added, this becomes:
        //
        // let params = llama_model_load_default_params()
        // let context = llama_init_from_file(modelPath, params)
        //
        // For now, this is a placeholder that shows the integration point.
        
        self.isModelLoaded = true
        completion(true)
    }
    
    // MARK: - Generation
    
    /// Generate a response given the system prompt and conversation history
    func generate(
        systemPrompt: String,
        messages: [ChatMessage],
        completion: @escaping (String) -> Void
    ) {
        guard isModelLoaded else {
            completion("Model not loaded. Add a GGUF model file to get started.")
            return
        }
        
        // Build the prompt in chat template format
        let prompt = buildPrompt(systemPrompt: systemPrompt, messages: messages)
        
        // TODO: Run llama.cpp inference
        // When the SPM package is integrated:
        //
        // 1. Create llama_context
        // 2. Tokenize the prompt
        // 3. Run llama_decode in a loop
        // 4. Sample tokens until EOS
        // 5. Decode tokens back to string
        // 6. Call completion(result)
        //
        // This runs on a background thread to keep UI responsive
        
        DispatchQueue.global(qos: .userInitiated).async {
            // Placeholder: simulate thinking delay
            Thread.sleep(forTimeInterval: 1.0)
            
            // In production, this is the actual llama.cpp generation
            let response = "[LLM response will appear here once llama.cpp is integrated]"
            
            DispatchQueue.main.async {
                completion(response)
            }
        }
    }
    
    // MARK: - Prompt Formatting
    
    /// Format messages into Llama-style chat template
    private func buildPrompt(systemPrompt: String, messages: [ChatMessage]) -> String {
        var parts: [String] = []
        
        if !systemPrompt.isEmpty {
            parts.append("<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n\(systemPrompt)<|eot_id|>")
        }
        
        for msg in messages {
            let header: String
            switch msg.role {
            case .user: header = "user"
            case .assistant: header = "assistant"
            case .system: header = "system"
            }
            parts.append("<|start_header_id|>\(header)<|end_header_id|>\n\n\(msg.content)<|eot_id|>")
        }
        
        // Add assistant header to prompt generation
        parts.append("<|start_header_id|>assistant<|end_header_id|>\n\n")
        
        return parts.joined()
    }
    
    /// Format for other model families (Phi, Gemma, etc.)
    private func buildGenericPrompt(systemPrompt: String, messages: [ChatMessage]) -> String {
        var parts: [String] = []
        
        if !systemPrompt.isEmpty {
            parts.append("System: \(systemPrompt)")
        }
        
        for msg in messages {
            switch msg.role {
            case .user: parts.append("User: \(msg.content)")
            case .assistant: parts.append("Assistant: \(msg.content)")
            case .system: parts.append("System: \(msg.content)")
            }
        }
        
        parts.append("Assistant:")
        return parts.joined(separator: "\n\n")
    }
}