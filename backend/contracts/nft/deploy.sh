#!/bin/bash
set -e

# Configuration
NETWORK=${1:-testnet}
WASM_FILE="../../target/stellar_wizard_nft.wasm"
CONTRACT_NAME="stellar-wizard-nft"

if [ "$NETWORK" != "testnet" ] && [ "$NETWORK" != "mainnet" ]; then
    echo "Usage: $0 [testnet|mainnet]"
    echo "Default: testnet"
    exit 1
fi

echo "🚀 Deploying NFT Contract to Stellar $NETWORK..."

# Check if WASM file exists
if [ ! -f "$WASM_FILE" ]; then
    echo "❌ WASM file not found. Please run ./build.sh first"
    exit 1
fi

# Deploy the contract
echo "📦 Installing contract..."
CONTRACT_ID=$(soroban contract install \
    --wasm "$WASM_FILE" \
    --source-account stellar-wizard \
    --network "$NETWORK" \
    2>/dev/null)

if [ $? -eq 0 ]; then
    echo "✅ Contract deployed successfully!"
    echo "📝 Contract ID: $CONTRACT_ID"
    echo ""
    echo "🔧 Add this to your .env file:"
    echo "NFT_CONTRACT_ID=$CONTRACT_ID"
    echo ""
    echo "📋 Next steps:"
    echo "1. Initialize the contract with init() function"
    echo "2. Set the registry address with set_registry()"
    echo "3. Update your Registry contract to call this NFT contract"
else
    echo "❌ Deployment failed"
    exit 1
fi