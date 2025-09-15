#!/bin/bash
set -e

echo "🚀 Deploying Stellar Wizard NFT Contract..."

# Navigate to backend directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
cd "$BACKEND_DIR"

# Check if WASM file exists
NFT_WASM_FILE="./target/stellar_wizard_nft.wasm"
if [ ! -f "$NFT_WASM_FILE" ]; then
    echo "❌ NFT WASM file not found. Please run ./scripts/build.sh first"
    exit 1
fi

# Check if .env exists and load it
if [ ! -f ".env" ]; then
    echo "❌ .env file not found. Please run ./scripts/init-deployer.sh first"
    exit 1
fi

# Source the .env file to get deployer info
source .env

if [ -z "$DEPLOYER_PUBLIC" ]; then
    echo "❌ DEPLOYER_PUBLIC not found in .env. Please run ./scripts/init-deployer.sh first"
    exit 1
fi

echo "📋 Using deployer account: $DEPLOYER_PUBLIC"

# Deploy the NFT contract
echo "📦 Installing NFT contract..."
NFT_CONTRACT_ID=$(soroban contract install \
    --wasm "$NFT_WASM_FILE" \
    --source-account stellar-wizard \
    --network testnet \
    2>/dev/null)

if [ $? -eq 0 ] && [ ! -z "$NFT_CONTRACT_ID" ]; then
    echo "✅ NFT Contract deployed successfully!"
    echo "📝 Contract ID: $NFT_CONTRACT_ID"
    
    # Update .env file with the contract ID
    echo "💾 Updating .env file..."
    sed -i.bak "s/NFT_CONTRACT_ID=.*/NFT_CONTRACT_ID=$NFT_CONTRACT_ID/" .env
    rm -f .env.bak
    
    echo "💾 NFT_CONTRACT_ID saved to .env"
    echo ""
    echo "🔧 Next steps:"
    echo "   1. Run ./scripts/deploy-registry.sh to deploy Registry contract"
    echo "   2. Initialize NFT contract with your collection metadata"
    echo ""
    echo "📋 For reference:"
    echo "   NFT Contract ID: $NFT_CONTRACT_ID"
    
else
    echo "❌ NFT Contract deployment failed"
    exit 1
fi