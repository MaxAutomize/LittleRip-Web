// swift-tools-version: 5.9

import PackageDescription

let package = Package(
    name: "LittleRip",
    platforms: [.iOS(.v17)],
    products: [
        .library(name: "LittleRip", targets: ["LittleRip"]),
    ],
    dependencies: [
        // On-device LLM inference via llama.cpp
        // .package(url: "https://github.com/StanfordBDHG/llama.cpp", from: "0.0.0"),
        
        // On-device TTS via Kokoro (MLX Swift)
        // .package(url: "https://github.com/mlalma/kokoro-ios", branch: "main"),
        
        // MLX Swift (required by kokoro-ios)
        // .package(url: "https://github.com/ml-explore/mlx-swift", from: "0.0.0"),
    ],
    targets: [
        .executableTarget(
            name: "LittleRip",
            dependencies: [
                // .product(name: "llama", package: "llama.cpp"),
                // .product(name: "KokoroSwift", package: "kokoro-ios"),
                // .product(name: "MLX", package: "mlx-swift"),
            ],
            path: "Sources"
        ),
    ]
)