#!/bin/bash
set -e

echo "🚀 Deploying Stellar Wizard Registry Contract..."

# Navigate to backend directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
cd "$BACKEND_DIR"

# Check if WASM file exists
REGISTRY_WASM_FILE="./target/stellar_wizard_registry.wasm"
if [ ! -f "$REGISTRY_WASM_FILE" ]; then
    echo "❌ Registry WASM file not found. Please run ./scripts/build.sh first"
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

if [ -z "$NFT_CONTRACT_ID" ]; then
    echo "❌ NFT_CONTRACT_ID not found in .env. Please run ./scripts/deploy-nft.sh first"
    exit 1
fi

echo "📋 Using deployer account: $DEPLOYER_PUBLIC"
echo "📋 NFT Contract ID: $NFT_CONTRACT_ID"

# Deploy the Registry contract
echo "📦 Installing Registry contract..."
REGISTRY_CONTRACT_ID=$(soroban contract install \
    --wasm "$REGISTRY_WASM_FILE" \
    --source-account stellar-wizard \
    --network testnet \
    2>/dev/null)

if [ $? -eq 0 ] && [ ! -z "$REGISTRY_CONTRACT_ID" ]; then
    echo "✅ Registry Contract deployed successfully!"
    echo "📝 Contract ID: $REGISTRY_CONTRACT_ID"
    
    # Update .env file with the contract ID
    echo "💾 Updating .env file..."
    sed -i.bak "s/REGISTRY_CONTRACT_ID=.*/REGISTRY_CONTRACT_ID=$REGISTRY_CONTRACT_ID/" .env
    rm -f .env.bak
    
    echo "💾 REGISTRY_CONTRACT_ID saved to .env"
    
    # Initialize the Registry contract
    echo ""
    echo "🔧 Initializing Registry contract..."
    soroban contract invoke \
        --id "$REGISTRY_CONTRACT_ID" \
        --source-account stellar-wizard \
        --network testnet \
        -- \
        initialize \
        --owner "$DEPLOYER_PUBLIC" \
        --nft_contract "$NFT_CONTRACT_ID"
        
    if [ $? -eq 0 ]; then
        echo "✅ Registry contract initialized successfully!"
    else
        echo "⚠️  Registry deployment succeeded but initialization failed"
        echo "   You may need to initialize manually"
    fi
    
    echo ""
    echo "🔧 Next steps:"
    echo "   1. Run ./scripts/set-config.sh to configure fee settings"
    echo "   2. Test the deployment with verification commands"
    echo ""
    echo "📋 For reference:"
    echo "   Registry Contract ID: $REGISTRY_CONTRACT_ID"
    echo "   NFT Contract ID: $NFT_CONTRACT_ID"
    
else
    echo "❌ Registry Contract deployment failed"
    exit 1
fi