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
NFT_CONTRACT_ID_HEX=$(stellar contract upload \
    --wasm "$NFT_WASM_FILE" \
    --source "$DEPLOYER_SECRET" \
    --network testnet \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    2>&1 | tail -1)

if [ $? -eq 0 ] && [ ! -z "$NFT_CONTRACT_ID_HEX" ]; then
    echo "✅ NFT Contract deployed successfully!"
    echo "📝 Contract ID (HEX): $NFT_CONTRACT_ID_HEX"

    # Convert HEX to StrKey format
    NFT_CONTRACT_ADDRESS=$(stellar contract address contract --id "$NFT_CONTRACT_ID_HEX" --network testnet)
    echo "📝 Contract Address (StrKey): $NFT_CONTRACT_ADDRESS"

    # Update .env file with both formats
    echo "💾 Updating .env file..."

    # Remove old entries if they exist
    grep -v "^NFT_CONTRACT_ID_HEX=" .env > .env.tmp || true
    grep -v "^NFT_CONTRACT_ADDRESS=" .env.tmp > .env.tmp2 || true
    mv .env.tmp2 .env
    rm -f .env.tmp

    # Add new entries
    echo "" >> .env
    echo "# NFT Contract Information" >> .env
    echo "NFT_CONTRACT_ID_HEX=$NFT_CONTRACT_ID_HEX" >> .env
    echo "NFT_CONTRACT_ADDRESS=$NFT_CONTRACT_ADDRESS" >> .env

    echo "💾 NFT contract addresses saved to .env"
    echo ""
    echo "🔧 Next steps:"
    echo "   1. Run ./scripts/deploy-registry.sh to deploy Registry contract"
    echo "   2. Initialize NFT contract with your collection metadata"
    echo ""
    echo "📋 For reference:"
    echo "   NFT Contract ID (HEX): $NFT_CONTRACT_ID_HEX"
    echo "   NFT Contract Address (StrKey): $NFT_CONTRACT_ADDRESS"

else
    echo "❌ NFT Contract deployment failed"
    exit 1
fi