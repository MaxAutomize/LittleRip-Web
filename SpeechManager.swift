import Foundation
import Speech
import AVFoundation

/// Handles real-time speech recognition from Bluetooth microphone
/// Uses Apple's on-device Speech framework — works offline, supports Bluetooth audio input

class SpeechManager: NSObject, ObservableObject {
    private let speechRecognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))!
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private var audioEngine: AVAudioEngine?
    
    /// Called with the final transcript when the user stops speaking
    var onTranscript: ((String) -> Void)?
    
    /// Accumulated transcript fragments
    private var accumulatedText: String = ""
    
    override init() {
        super.init()
        requestPermissions()
    }
    
    // MARK: - Permissions
    
    private func requestPermissions() {
        SFSpeechRecognizer.requestAuthorization { status in
            switch status {
            case .authorized:
                print("✅ Speech recognition authorized")
            case .denied:
                print("❌ Speech recognition denied")
            case .restricted:
                print("⚠️ Speech recognition restricted")
            case .notDetermined:
                print("❓ Speech recognition not determined")
            @unknown default:
                break
            }
        }
        
        AVAudioSession.sharedInstance().requestRecordPermission { granted in
            print(granted ? "✅ Microphone access granted" : "❌ Microphone access denied")
        }
    }
    
    // MARK: - Start/Stop
    
    func startListening(onTranscript: @escaping (String) -> Void) {
        self.onTranscript = onTranscript
        accumulatedText = ""
        
        // Cancel any existing task
        stopListening()
        
        // Set up audio engine
        audioEngine = AVAudioEngine()
        let inputNode = audioEngine!.inputNode
        
        // Configure for Bluetooth microphone if available
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(.record, mode: .measurement, options: [.allowBluetooth])
            try session.setActive(true)
        } catch {
            print("⚠️ Audio session config error: \(error)")
        }
        
        // Create recognition request
        recognitionRequest = SFSpeechAudioBufferRecognitionRequest()
        recognitionRequest!.requiresOnDeviceRecognition = true  // Force on-device
        recognitionRequest!.shouldReportPartialResults = true
        
        // Start recognition task
        recognitionTask = speechRecognizer.recognitionTask(with: recognitionRequest!) { [weak self] result, error in
            guard let self = self else { return }
            
            if let result = result {
                self.accumulatedText = result.bestTranscription.formattedString
            }
            
            if error != nil || result?.isFinal == true {
                // Recognition ended — send final transcript
                if !self.accumulatedText.isEmpty {
                    self.onTranscript?(self.accumulatedText)
                }
            }
        }
        
        // Install audio tap
        let recordingFormat = inputNode.outputFormat(forBus: 0)
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) { [weak self] buffer, _ in
            self?.recognitionRequest?.append(buffer)
        }
        
        // Start audio engine
        do {
            try audioEngine?.start()
        } catch {
            print("❌ Audio engine start error: \(error)")
        }
    }
    
    func stopListening() {
        audioEngine?.inputNode.removeTap(onBus: 0)
        audioEngine?.stop()
        recognitionRequest?.endAudio()
        recognitionTask?.cancel()
        recognitionRequest = nil
        recognitionTask = nil
    }
}