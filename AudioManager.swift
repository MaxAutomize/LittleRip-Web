import Foundation
import AVFoundation
import CoreBluetooth

/// Manages Bluetooth audio routing — mic input and speaker output
/// iOS natively routes audio to/from Bluetooth when AVAudioSession is configured correctly

class AudioManager: NSObject, ObservableObject {
    private var bluetoothManager: CBCentralManager?
    
    override init() {
        super.init()
        bluetoothManager = CBCentralManager(delegate: self, queue: nil)
        configureBluetoothAudio()
    }
    
    /// Configure audio session for Bluetooth input and output
    func configureBluetoothAudio() {
        let session = AVAudioSession.sharedInstance()
        
        do {
            // This is the key configuration:
            // .playAndRecord allows both mic input and speaker output
            // .allowBluetooth enables Bluetooth HFP (both mic + speaker)
            // .allowBluetoothA2DP enables A2DP for high-quality speaker output
            try session.setCategory(
                .playAndRecord,
                mode: .default,
                options: [.allowBluetooth, .allowBluetoothA2DP, .defaultToSpeaker]
            )
            try session.setActive(true)
            
            print("✅ Bluetooth audio configured")
            print("🎤 Input: \(session.currentRoute.inputs)")
            print("🎧 Output: \(session.currentRoute.outputs)")
        } catch {
            print("❌ Audio session error: \(error)")
        }
    }
    
    /// Switch audio output between Bluetooth speaker and phone speaker
    func switchOutput(to option: AudioOutput) {
        let session = AVAudioSession.sharedInstance()
        
        do {
            switch option {
            case .bluetooth:
                try session.setCategory(.playAndRecord, mode: .default, options: [.allowBluetooth, .allowBluetoothA2DP])
            case .phoneSpeaker:
                try session.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker])
            }
            try session.setActive(true)
        } catch {
            print("❌ Switch output error: \(error)")
        }
    }
    
    enum AudioOutput {
        case bluetooth
        case phoneSpeaker
    }
}

// MARK: - Bluetooth Discovery

extension AudioManager: CBCentralManagerDelegate {
    func centralManagerDidUpdateState(_ central: CBCentralManager) {
        switch central.state {
        case .poweredOn:
            print("✅ Bluetooth powered on")
            central.scanForPeripherals(withServices: nil, options: nil)
        case .poweredOff:
            print("⚠️ Bluetooth powered off")
        case .unauthorized:
            print("❌ Bluetooth unauthorized")
        default:
            break
        }
    }
    
    func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral, advertisementData: [String: Any], rssi RSSI: NSNumber) {
        // Found a Bluetooth device — could be a mic or speaker
        print("📡 Found: \(peripheral.name ?? "Unknown")")
    }
}