#!/bin/bash
set -e

echo "🔧 Configuring Stellar Wizard Registry Contract..."

# Navigate to backend directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
cd "$BACKEND_DIR"

# Check if .env exists and load it
if [ ! -f ".env" ]; then
    echo "❌ .env file not found. Please run ./scripts/init-deployer.sh first"
    exit 1
fi

# Source the .env file
source .env

if [ -z "$REGISTRY_CONTRACT_ID" ]; then
    echo "❌ REGISTRY_CONTRACT_ID not found in .env. Please run ./scripts/deploy-registry.sh first"
    exit 1
fi

if [ -z "$FEE_WALLET" ]; then
    echo "❌ FEE_WALLET not set in .env. Please set it to your commission wallet address"
    echo "   Example: FEE_WALLET=GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
    exit 1
fi

# Default to 200 basis points (2%) if not set
if [ -z "$FEE_BPS" ]; then
    FEE_BPS=200
    echo "ℹ️  Using default fee rate: $FEE_BPS basis points (2%)"
fi

echo "📋 Registry Contract ID: $REGISTRY_CONTRACT_ID"
echo "📋 Fee Wallet: $FEE_WALLET"
echo "📋 Fee Rate: $FEE_BPS basis points"

# Set the fee wallet
echo ""
echo "💰 Setting fee wallet..."
soroban contract invoke \
    --id "$REGISTRY_CONTRACT_ID" \
    --source-account stellar-wizard \
    --network testnet \
    -- \
    set_fee_wallet \
    --fee_wallet "$FEE_WALLET"

if [ $? -eq 0 ]; then
    echo "✅ Fee wallet set successfully!"
else
    echo "❌ Failed to set fee wallet"
    exit 1
fi

# Set the fee rate
echo ""
echo "📊 Setting fee rate..."
soroban contract invoke \
    --id "$REGISTRY_CONTRACT_ID" \
    --source-account stellar-wizard \
    --network testnet \
    -- \
    set_fee_bps \
    --fee_bps "$FEE_BPS"

if [ $? -eq 0 ]; then
    echo "✅ Fee rate set successfully!"
else
    echo "❌ Failed to set fee rate"
    exit 1
fi

# Verify configuration
echo ""
echo "🔍 Verifying configuration..."
CONFIG=$(soroban contract invoke \
    --id "$REGISTRY_CONTRACT_ID" \
    --source-account stellar-wizard \
    --network testnet \
    -- \
    get_config 2>/dev/null)

if [ $? -eq 0 ]; then
    echo "✅ Configuration verified!"
    echo "📋 Current config: $CONFIG"
else
    echo "⚠️  Could not verify configuration, but settings were applied"
fi

echo ""
echo "🎉 Registry contract configuration completed!"
echo ""
echo "📋 Summary:"
echo "   Registry Contract: $REGISTRY_CONTRACT_ID"
echo "   Fee Wallet: $FEE_WALLET"
echo "   Fee Rate: $FEE_BPS basis points"
echo ""
echo "✅ Your Stellar Wizard backend is ready for use!"
echo ""
echo "🧪 Test your deployment:"
echo "   soroban contract invoke --id $REGISTRY_CONTRACT_ID --network testnet -- get_config"