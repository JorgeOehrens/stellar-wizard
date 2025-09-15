#!/bin/bash

# Stellar Wizard Registry - Deploy to Testnet
# This script deploys the contract to Stellar testnet

set -e

echo "🚀 Deploying Stellar Wizard Registry to Testnet..."

# Navigate to backend directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
cd "$BACKEND_DIR"

# Load environment variables
if [ ! -f ".env" ]; then
    echo "❌ .env file not found. Run ./scripts/init-deployer.sh first."
    exit 1
fi

source .env

# Check required variables
if [ -z "$DEPLOYER_PUBLIC" ]; then
    echo "❌ DEPLOYER_PUBLIC not set. Run ./scripts/init-deployer.sh first."
    exit 1
fi

if [ -z "$FEE_WALLET" ] || [ "$FEE_WALLET" = "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX" ]; then
    echo "❌ FEE_WALLET not set in .env file. Please set your commission wallet address."
    exit 1
fi

# Check if contract is built
WASM_FILE="contracts/registry/target/wasm32-unknown-unknown/release/stellar_wizard_registry.wasm"
if [ ! -f "$WASM_FILE" ]; then
    echo "❌ Contract WASM not found. Run ./scripts/build.sh first."
    exit 1
fi

echo "📋 Deploying with:"
echo "   Deployer: $DEPLOYER_PUBLIC"
echo "   Fee Wallet: $FEE_WALLET"
echo "   Fee Rate: ${DEFAULT_FEE_BPS:-200} bps"

# Deploy the contract
echo "🚀 Deploying contract..."
REGISTRY_CONTRACT_ID=$(soroban contract deploy \
    --wasm "$WASM_FILE" \
    --source deployer \
    --network testnet)

echo "✅ Contract deployed!"
echo "📋 Contract ID: $REGISTRY_CONTRACT_ID"

# Initialize the contract
echo "🔧 Initializing contract..."
soroban contract invoke \
    --id "$REGISTRY_CONTRACT_ID" \
    --source deployer \
    --network testnet \
    -- \
    initialize \
    --owner "$DEPLOYER_PUBLIC" \
    --fee_bps "${DEFAULT_FEE_BPS:-200}" \
    --fee_wallet "$FEE_WALLET"

echo "✅ Contract initialized successfully!"

# Update .env file with contract ID
echo "📝 Updating .env file with contract ID..."
if grep -q "REGISTRY_CONTRACT_ID=" .env; then
    sed -i.bak "s/REGISTRY_CONTRACT_ID=.*/REGISTRY_CONTRACT_ID=$REGISTRY_CONTRACT_ID/" .env
else
    echo "REGISTRY_CONTRACT_ID=$REGISTRY_CONTRACT_ID" >> .env
fi

# Update frontend .env.local
FRONTEND_ENV="../front-end/.env.local"
echo "📝 Updating frontend environment..."
if [ -f "$FRONTEND_ENV" ]; then
    if grep -q "NEXT_PUBLIC_REGISTRY_CONTRACT_ID=" "$FRONTEND_ENV"; then
        sed -i.bak "s/NEXT_PUBLIC_REGISTRY_CONTRACT_ID=.*/NEXT_PUBLIC_REGISTRY_CONTRACT_ID=$REGISTRY_CONTRACT_ID/" "$FRONTEND_ENV"
    else
        echo "NEXT_PUBLIC_REGISTRY_CONTRACT_ID=$REGISTRY_CONTRACT_ID" >> "$FRONTEND_ENV"
    fi
else
    echo "NEXT_PUBLIC_REGISTRY_CONTRACT_ID=$REGISTRY_CONTRACT_ID" > "$FRONTEND_ENV"
fi

# Cleanup backup files
rm -f .env.bak
rm -f "$FRONTEND_ENV.bak"

echo ""
echo "🎉 Deployment Complete!"
echo "📋 Contract ID: $REGISTRY_CONTRACT_ID"
echo "🌐 Network: Testnet"
echo "💰 Fee Wallet: $FEE_WALLET"
echo "💸 Fee Rate: ${DEFAULT_FEE_BPS:-200} bps (${DEFAULT_FEE_BPS:-200/100}%)"
echo ""
echo "🔗 View on Stellar Expert:"
echo "   https://stellar.expert/explorer/testnet/contract/$REGISTRY_CONTRACT_ID"
echo ""
echo "Next steps:"
echo "1. Contract is ready to receive log_and_route calls"
echo "2. Frontend .env.local has been updated"
echo "3. Use ./scripts/set-config.sh to modify settings"