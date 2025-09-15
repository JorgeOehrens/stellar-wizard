#!/bin/bash
set -e

echo "🔨 Building Stellar Wizard Contracts..."

# Navigate to backend directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
cd "$BACKEND_DIR"

# Check if we're in the right directory
if [ ! -f "contracts/registry/Cargo.toml" ] || [ ! -f "contracts/nft/Cargo.toml" ]; then
    echo "❌ Contracts not found. Make sure you're running this from the backend directory."
    exit 1
fi

# Install wasm32 target if not present
echo "🎯 Ensuring wasm32-unknown-unknown target is installed..."
rustup target add wasm32-unknown-unknown

# Create target directory for built contracts
mkdir -p target

echo ""
echo "🔨 Building NFT Contract..."
cd contracts/nft

# Build NFT contract
cargo build --target wasm32-unknown-unknown --release

# Check if NFT build was successful
NFT_WASM_FILE="target/wasm32-unknown-unknown/release/stellar_wizard_nft.wasm"
if [ -f "$NFT_WASM_FILE" ]; then
    NFT_SIZE=$(du -h "$NFT_WASM_FILE" | cut -f1)
    echo "✅ NFT Contract built successfully!"
    echo "📦 WASM size: $NFT_SIZE"
    # Copy to shared target directory
    cp "$NFT_WASM_FILE" "../../target/"
else
    echo "❌ NFT Contract build failed"
    exit 1
fi

echo ""
echo "🔨 Building Registry Contract..."
cd ../registry

# Build Registry contract
cargo build --target wasm32-unknown-unknown --release

# Check if Registry build was successful
REGISTRY_WASM_FILE="target/wasm32-unknown-unknown/release/stellar_wizard_registry.wasm"
if [ -f "$REGISTRY_WASM_FILE" ]; then
    REGISTRY_SIZE=$(du -h "$REGISTRY_WASM_FILE" | cut -f1)
    echo "✅ Registry Contract built successfully!"
    echo "📦 WASM size: $REGISTRY_SIZE"
    # Copy to shared target directory
    cp "$REGISTRY_WASM_FILE" "../../target/"
else
    echo "❌ Registry Contract build failed"
    exit 1
fi

echo ""
echo "🎉 All contracts built successfully!"
echo "📁 WASM files available in: ./target/"
echo "   - stellar_wizard_nft.wasm"
echo "   - stellar_wizard_registry.wasm"
echo ""
echo "🔧 Next steps:"
echo "   1. Run ./scripts/deploy-nft.sh to deploy NFT contract"
echo "   2. Run ./scripts/deploy-registry.sh to deploy Registry contract"