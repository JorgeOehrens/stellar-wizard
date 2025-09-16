#!/bin/bash
set -e

echo "🪙 Minting NFTs via Factory..."

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

if [ -z "$DEPLOYER_SECRET" ]; then
    echo "❌ DEPLOYER_SECRET not found in .env. Please run ./scripts/init-deployer.sh first"
    exit 1
fi

# Handle arguments with intelligent defaults
if [ $# -eq 3 ]; then
    COLLECTION_ID="$1"
    RECIPIENT="$2"
    AMOUNT="$3"
elif [ $# -eq 0 ] && [ ! -z "$LAST_COLLECTION_ID" ]; then
    # Use saved collection and deployer as recipient
    COLLECTION_ID="$LAST_COLLECTION_ID"
    RECIPIENT="$DEPLOYER_PUBLIC"
    AMOUNT="1"
    echo "📋 No arguments provided, using saved collection and defaults:"
    echo "   Collection ID: $COLLECTION_ID"
    echo "   Recipient: $RECIPIENT (deployer)"
    echo "   Amount: $AMOUNT NFT"
    echo ""
elif [ $# -eq 2 ]; then
    COLLECTION_ID="$1"
    RECIPIENT="$2"
    AMOUNT="1"
    echo "📋 Amount not specified, defaulting to 1 NFT"
elif [ $# -eq 1 ]; then
    COLLECTION_ID="$1"
    RECIPIENT="$DEPLOYER_PUBLIC"
    AMOUNT="1"
    echo "📋 Recipient not specified, minting to deployer with 1 NFT"
else
    echo "Usage: $0 [collection_id] [recipient_address] [amount]"
    echo ""
    echo "Examples:"
    echo "  $0 1 G...USER_ADDRESS 5     # Mint 5 NFTs to specific address"
    echo "  $0 1 G...USER_ADDRESS       # Mint 1 NFT to specific address"
    echo "  $0 1                        # Mint 1 NFT to deployer"
    echo "  $0                          # Use last created collection, mint 1 to deployer"
    echo ""
    if [ ! -z "$LAST_COLLECTION_ID" ]; then
        echo "📋 Last created collection: $LAST_COLLECTION_ID ($LAST_COLLECTION_NAME)"
        read -p "🤔 Mint 1 NFT from collection $LAST_COLLECTION_ID to deployer? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            COLLECTION_ID="$LAST_COLLECTION_ID"
            RECIPIENT="$DEPLOYER_PUBLIC"
            AMOUNT="1"
        else
            echo "❌ Minting cancelled"
            exit 1
        fi
    else
        echo "❌ No collection ID provided and no last collection found"
        echo "   Create a collection first: ./scripts/create-collection.sh"
        exit 1
    fi
fi

echo "📋 Factory Contract: $FACTORY_CONTRACT_ADDRESS"
echo "📋 Collection ID: $COLLECTION_ID"
echo "📋 Recipient: $RECIPIENT"
echo "📋 Amount: $AMOUNT NFTs"
echo ""

# Get collection details first
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

    # Try to extract collection name from details
    COLLECTION_NAME=$(echo "$COLLECTION_DETAILS" | grep -o '"[^"]*"' | head -1 | tr -d '"' || echo "Unknown")
    echo ""
    echo "📝 Minting $AMOUNT NFTs from '$COLLECTION_NAME' collection..."
else
    echo "❌ Failed to get collection details. Collection ID $COLLECTION_ID may not exist."
    echo "   Check available collections:"
    echo "   stellar contract invoke --id $FACTORY_CONTRACT_ADDRESS --network testnet -- list_collections"
    exit 1
fi

# Confirm minting if more than 1 NFT
if [ "$AMOUNT" -gt 1 ]; then
    read -p "🤔 Confirm minting $AMOUNT NFTs to $RECIPIENT? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Minting cancelled"
        exit 1
    fi
fi

# Mint the NFTs
echo "🚀 Minting $AMOUNT NFTs..."
RESULT=$(stellar contract invoke \
    --id "$FACTORY_CONTRACT_ADDRESS" \
    --source "$DEPLOYER_SECRET" \
    --network testnet \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    -- \
    mint \
    --collection_id "$COLLECTION_ID" \
    --to "$RECIPIENT" \
    --amount "$AMOUNT" \
    2>&1)

if [ $? -eq 0 ]; then
    echo "✅ Minting successful!"

    # Try to extract the first token ID from the result
    FIRST_TOKEN_ID=$(echo "$RESULT" | grep -o '[0-9]\+' | head -1)
    if [ ! -z "$FIRST_TOKEN_ID" ]; then
        echo "📝 First Token ID: $FIRST_TOKEN_ID"
        if [ "$AMOUNT" -gt 1 ]; then
            LAST_TOKEN_ID=$((FIRST_TOKEN_ID + AMOUNT - 1))
            echo "📝 Token ID Range: $FIRST_TOKEN_ID - $LAST_TOKEN_ID"
        fi
    fi

    # Get mint history for this collection
    echo "📋 Getting updated mint history..."
    MINT_HISTORY=$(stellar contract invoke \
        --id "$FACTORY_CONTRACT_ADDRESS" \
        --network testnet \
        --network-passphrase "$NETWORK_PASSPHRASE" \
        -- \
        get_collection_mints \
        --collection_id "$COLLECTION_ID" \
        2>&1)

    if [ $? -eq 0 ]; then
        echo "📋 Recent Mint History for Collection $COLLECTION_ID:"
        echo "$MINT_HISTORY" | tail -10  # Show last 10 lines
    fi

    echo ""
    echo "🎉 $AMOUNT NFTs successfully minted to $RECIPIENT!"
    echo "💰 Platform fees have been automatically calculated and logged"

    # Show NFT contract address for direct interaction
    NFT_CONTRACT_ADDRESS=$(echo "$COLLECTION_DETAILS" | grep -o 'C[A-Z0-9]\{55\}' | head -1)
    if [ ! -z "$NFT_CONTRACT_ADDRESS" ]; then
        echo ""
        echo "🔗 NFT Contract Address: $NFT_CONTRACT_ADDRESS"
        echo "📋 You can interact directly with the NFT contract for transfers, approvals, etc."
        echo ""
        echo "📋 Example commands:"
        echo "   # Check token ownership"
        echo "   stellar contract invoke --id $NFT_CONTRACT_ADDRESS --network testnet -- owner_of --token_id $FIRST_TOKEN_ID"
        echo ""
        echo "   # Check user balance"
        echo "   stellar contract invoke --id $NFT_CONTRACT_ADDRESS --network testnet -- balance_of --owner $RECIPIENT"
        echo ""
        echo "   # Get token URI"
        echo "   stellar contract invoke --id $NFT_CONTRACT_ADDRESS --network testnet -- token_uri --token_id $FIRST_TOKEN_ID"
    fi

else
    echo "❌ Minting failed:"
    echo "$RESULT"
    echo ""
    echo "🔧 Common issues:"
    echo "   1. Collection doesn't exist - create one with: ./scripts/create-collection.sh"
    echo "   2. Insufficient XLM balance for transaction fees"
    echo "   3. Network connectivity issues"
    echo "   4. Invalid recipient address format"
    exit 1
fi