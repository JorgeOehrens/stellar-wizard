#!/bin/bash
set -e

echo "🚀 Initializing Stellar Wizard Deployer Account..."

# Check if soroban CLI is installed
if ! command -v soroban &> /dev/null; then
    echo "❌ Soroban CLI not found. Please install it first:"
    echo "   cargo install --locked soroban-cli"
    exit 1
fi

# Navigate to backend directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
cd "$BACKEND_DIR"

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo "📝 Created .env file from example"
else
    echo "📝 Using existing .env file"
fi

# Generate deployer account
echo "🔑 Generating new deployer account..."
soroban keys generate stellar-wizard --network testnet

# Get the public key
DEPLOYER_PUBLIC=$(soroban keys address stellar-wizard)
echo "📋 Deployer public key: $DEPLOYER_PUBLIC"

# Get the secret key for .env
DEPLOYER_SECRET=$(soroban keys show stellar-wizard)

# Fund the account via friendbot
echo "💰 Funding deployer account via friendbot..."
soroban keys fund stellar-wizard --network testnet

# Wait a moment for funding to complete
sleep 3

# Verify account is funded
echo "✅ Checking account balance..."
soroban keys balance stellar-wizard --network testnet

# Update .env file with the generated keys
echo "📝 Updating .env file..."

# Use sed to update the .env file
sed -i.bak "s/DEPLOYER_PUBLIC=.*/DEPLOYER_PUBLIC=$DEPLOYER_PUBLIC/" .env
sed -i.bak "s/DEPLOYER_SECRET=.*/DEPLOYER_SECRET=$DEPLOYER_SECRET/" .env

echo ""
echo "✅ Deployer account initialized successfully!"
echo "📋 Public Key: $DEPLOYER_PUBLIC"
echo "🔐 Secret Key: $DEPLOYER_SECRET"
echo "💾 Credentials saved to .env"
echo ""
echo "🔧 Next steps:"
echo "   1. Run ./scripts/build.sh to compile contracts"
echo "   2. Run ./scripts/deploy-nft.sh to deploy NFT contract"
echo "   3. Run ./scripts/deploy-registry.sh to deploy Registry contract"
echo "   4. Run ./scripts/set-config.sh to configure fee settings"

# Cleanup backup file
rm -f .env.bak