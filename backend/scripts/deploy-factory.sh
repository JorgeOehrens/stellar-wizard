#!/bin/bash
set -e

echo "🚀 Deploying Stellar Wizard Factory/Registry Contract..."

# Navigate to backend directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
cd "$BACKEND_DIR"

# Source helper functions
source "$SCRIPT_DIR/lib.sh"

# Check prerequisites
check_stellar_sdk

# Check if WASM files exist
FACTORY_WASM_FILE="./target/stellar_wizard_factory_registry.wasm"
NFT_WASM_FILE="./target/stellar_wizard_nft.wasm"

if [ ! -f "$FACTORY_WASM_FILE" ]; then
    echo "❌ Factory/Registry WASM file not found. Please run ./scripts/build.sh first"
    exit 1
fi

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

if [ -z "$FEE_WALLET" ]; then
    echo "❌ FEE_WALLET not found in .env. Please set it in .env file"
    exit 1
fi

echo "📋 Using deployer account: $DEPLOYER_PUBLIC"
echo "📋 Fee wallet: $FEE_WALLET"

# Step 1: Upload NFT WASM to get hash for factory
NFT_WASM_HASH=$(upload_wasm "$NFT_WASM_FILE" "$DEPLOYER_SECRET" "testnet" "$NETWORK_PASSPHRASE")
if [ $? -ne 0 ]; then
    exit 1
fi

# Step 2: Deploy the Factory/Registry contract
echo "📦 Deploying Factory/Registry contract..."
FACTORY_CONTRACT_ID_HEX=$(stellar contract upload \
    --wasm "$FACTORY_WASM_FILE" \
    --source "$DEPLOYER_SECRET" \
    --network testnet \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    2>&1 | tail -1)

if [ $? -ne 0 ] || [ -z "$FACTORY_CONTRACT_ID_HEX" ]; then
    echo "❌ Factory/Registry contract deployment failed"
    exit 1
fi

echo "✅ Factory/Registry contract deployed successfully!"
echo "📝 Contract ID (HEX): $FACTORY_CONTRACT_ID_HEX"

# Convert HEX to StrKey format
FACTORY_CONTRACT_ADDRESS=$(stellar contract id parse "$FACTORY_CONTRACT_ID_HEX" --network testnet)
echo "📝 Contract Address (StrKey): $FACTORY_CONTRACT_ADDRESS"

# Step 3: Initialize the Factory/Registry contract
echo "🔧 Initializing Factory/Registry contract..."
stellar contract invoke \
    --id "$FACTORY_CONTRACT_ADDRESS" \
    --source "$DEPLOYER_SECRET" \
    --network testnet \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    -- \
    initialize \
    --owner "$DEPLOYER_PUBLIC" \
    --fee_bps ${FEE_BPS:-200} \
    --fee_wallet "$FEE_WALLET" \
    --nft_wasm_hash "$NFT_WASM_HASH"

if [ $? -eq 0 ]; then
    echo "✅ Factory/Registry contract initialized successfully!"
else
    echo "⚠️  Factory deployment succeeded but initialization failed"
    echo "   You may need to initialize manually"
fi

# Update .env file with both HEX and StrKey addresses
echo "💾 Updating .env file..."

# Remove old entries if they exist
grep -v "^FACTORY_CONTRACT_ID_HEX=" .env > .env.tmp || true
grep -v "^FACTORY_CONTRACT_ADDRESS=" .env.tmp > .env.tmp2 || true
grep -v "^NFT_WASM_HASH=" .env.tmp2 > .env.tmp3 || true
mv .env.tmp3 .env
rm -f .env.tmp .env.tmp2

# Add new entries
echo "" >> .env
echo "# Factory/Registry Contract Information" >> .env
echo "FACTORY_CONTRACT_ID_HEX=$FACTORY_CONTRACT_ID_HEX" >> .env
echo "FACTORY_CONTRACT_ADDRESS=$FACTORY_CONTRACT_ADDRESS" >> .env
echo "NFT_WASM_HASH=$NFT_WASM_HASH" >> .env

echo "💾 Contract addresses and WASM hash saved to .env"
echo ""
echo "🔧 Next steps:"
echo "   1. Run ./scripts/create-collection.sh to create your first NFT collection"
echo "   2. Run ./scripts/mint-from-factory.sh to mint NFTs"
echo ""
echo "📋 For reference:"
echo "   Factory Contract ID (HEX): $FACTORY_CONTRACT_ID_HEX"
echo "   Factory Contract Address (StrKey): $FACTORY_CONTRACT_ADDRESS"
echo "   NFT WASM Hash: $NFT_WASM_HASH"
echo "   Fee Wallet: $FEE_WALLET"
echo "   Fee BPS: ${FEE_BPS:-200} (${FEE_BPS:-2}%)"