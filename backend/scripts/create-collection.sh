#!/bin/bash
set -e

echo "🎨 Creating NFT Collection via Factory..."

# Navigate to backend directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
cd "$BACKEND_DIR"

# Check if .env exists and load it
if [ ! -f ".env" ]; then
    echo "❌ .env file not found. Please run ./scripts/deploy-factory.sh first"
    exit 1
fi

# Source the .env file
source .env

if [ -z "$FACTORY_CONTRACT_ADDRESS" ]; then
    echo "❌ FACTORY_CONTRACT_ADDRESS not found in .env. Please run ./scripts/deploy-factory.sh first"
    exit 1
fi

if [ -z "$DEPLOYER_PUBLIC" ]; then
    echo "❌ DEPLOYER_PUBLIC not found in .env. Please run ./scripts/init-deployer.sh first"
    exit 1
fi

# Get collection details from arguments or use defaults
if [ $# -eq 4 ]; then
    NAME="$1"
    SYMBOL="$2"
    URI_BASE="$3"
    ROYALTIES="$4"
else
    echo "📋 No arguments provided, using demo collection details..."
    NAME="Stellar Wizards Demo"
    SYMBOL="SWIZD"
    URI_BASE="https://api.stellarwizards.com/metadata"
    ROYALTIES="250"  # 2.5%

    echo "Usage: $0 <name> <symbol> <uri_base> <royalties_bps>"
    echo "Example: $0 \"Cyber Wizards\" \"CZWZ\" \"https://ipfs.io/ipfs/...\" 500"
    echo ""
    echo "📋 Using defaults for demo:"
fi

echo "📋 Factory Contract: $FACTORY_CONTRACT_ADDRESS"
echo "📋 Creator: $DEPLOYER_PUBLIC"
echo "📋 Collection: $NAME ($SYMBOL)"
echo "📋 URI Base: $URI_BASE"
echo "📋 Royalties: $ROYALTIES bps ($(echo "scale=2; $ROYALTIES/100" | bc)%)"
echo ""

# Confirm before proceeding if using defaults
if [ $# -ne 4 ]; then
    read -p "🤔 Continue with demo collection creation? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Collection creation cancelled"
        echo "   Run with arguments: $0 \"Your Collection\" \"SYMBOL\" \"https://your-api.com/metadata\" 250"
        exit 1
    fi
fi

# Create the collection
echo "🚀 Creating collection..."
RESULT=$(stellar contract invoke \
    --id "$FACTORY_CONTRACT_ADDRESS" \
    --source "$DEPLOYER_SECRET" \
    --network testnet \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    -- \
    create_collection \
    --caller "$DEPLOYER_PUBLIC" \
    --name "$NAME" \
    --symbol "$SYMBOL" \
    --uri_base "$URI_BASE" \
    --royalties_bps "$ROYALTIES" \
    2>&1)

if [ $? -eq 0 ]; then
    # Extract collection ID from result
    COLLECTION_ID=$(echo "$RESULT" | grep -o '[0-9]\+' | tail -1)

    if [ -z "$COLLECTION_ID" ]; then
        echo "⚠️  Collection may have been created but couldn't extract ID from:"
        echo "$RESULT"
        echo ""
        echo "🔧 You can check collections with:"
        echo "   stellar contract invoke --id $FACTORY_CONTRACT_ADDRESS --network testnet -- list_collections"
        exit 0
    fi

    echo "✅ Collection created successfully!"
    echo "📝 Collection ID: $COLLECTION_ID"

    # Get collection details to show contract address
    echo "🔍 Getting collection details..."
    COLLECTION_DETAILS=$(stellar contract invoke \
        --id "$FACTORY_CONTRACT_ADDRESS" \
        --network testnet \
        --network-passphrase "$NETWORK_PASSPHRASE" \
        -- \
        get_collection \
        --collection_id "$COLLECTION_ID" \
        2>&1)

    if [ $? -eq 0 ]; then
        echo "📋 Collection Details:"
        echo "$COLLECTION_DETAILS"

        # Try to extract the NFT contract address (this is a simplified approach)
        NFT_CONTRACT_ADDRESS=$(echo "$COLLECTION_DETAILS" | grep -o 'C[A-Z0-9]\{55\}' | head -1)
        if [ ! -z "$NFT_CONTRACT_ADDRESS" ]; then
            echo ""
            echo "📝 NFT Contract Address: $NFT_CONTRACT_ADDRESS"
        fi
    else
        echo "⚠️  Collection created but couldn't retrieve details:"
        echo "$COLLECTION_DETAILS"
    fi

    # Update .env with last created collection ID for convenience
    echo "" >> .env
    echo "# Last Created Collection ($(date))" >> .env
    echo "LAST_COLLECTION_ID=$COLLECTION_ID" >> .env
    echo "LAST_COLLECTION_NAME=\"$NAME\"" >> .env
    echo "LAST_COLLECTION_SYMBOL=\"$SYMBOL\"" >> .env

    echo ""
    echo "💾 Collection ID saved to .env as LAST_COLLECTION_ID"
    echo ""
    echo "🔧 Next steps:"
    echo "   1. Run './scripts/mint-from-factory.sh $COLLECTION_ID <recipient_address> <amount>' to mint NFTs"
    echo "   2. Or run './scripts/mint-from-factory.sh' to use saved collection and mint to deployer"
    echo ""
    echo "📋 Example mint commands:"
    echo "   ./scripts/mint-from-factory.sh $COLLECTION_ID $DEPLOYER_PUBLIC 5"
    echo "   ./scripts/mint-from-factory.sh  # Uses saved collection ID and defaults"

else
    echo "❌ Collection creation failed:"
    echo "$RESULT"
    echo ""
    echo "🔧 Troubleshooting:"
    echo "   1. Make sure the Factory contract is deployed: ./scripts/deploy-factory.sh"
    echo "   2. Check that you have sufficient XLM balance"
    echo "   3. Verify network connectivity to Stellar testnet"
    exit 1
fi