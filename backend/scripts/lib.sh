#!/bin/bash

# =============================================================================
# Stellar Contract Deployment Helper Functions
# =============================================================================

# Check if Node.js and @stellar/stellar-sdk are available
check_stellar_sdk() {
    if ! command -v node &> /dev/null; then
        echo "❌ Node.js is required for StrKey encoding. Please install Node.js."
        exit 1
    fi
    
    if ! node -e "require('@stellar/stellar-sdk')" 2>/dev/null; then
        echo "❌ @stellar/stellar-sdk is not installed."
        echo "📦 Run: npm install -D @stellar/stellar-sdk"
        echo "   (from the backend directory)"
        exit 1
    fi
}

# Convert hex contract ID to StrKey format (C...)
encode_contract_strkey() {
    local HEX="$1"
    if [ -z "$HEX" ]; then
        echo "❌ encode_contract_strkey: hex value is required"
        return 1
    fi
    
    # Validate hex format (64 characters)
    if [[ ! "$HEX" =~ ^[a-fA-F0-9]{64}$ ]]; then
        echo "❌ encode_contract_strkey: invalid hex format (expected 64 hex characters)"
        return 1
    fi
    
    node -e "
        const { StrKey } = require('@stellar/stellar-sdk');
        try {
            const result = StrKey.encodeContract(Buffer.from('$HEX', 'hex'));
            console.log(result);
        } catch (error) {
            console.error('Error encoding StrKey:', error.message);
            process.exit(1);
        }
    "
}

# Upsert a key-value pair in .env file (no duplicates)
upsert_env() {
    local KEY="$1"
    local VAL="$2"
    
    if [ -z "$KEY" ] || [ -z "$VAL" ]; then
        echo "❌ upsert_env: key and value are required"
        return 1
    fi
    
    # Escape special characters in the value for sed
    local ESCAPED_VAL=$(printf '%s\n' "$VAL" | sed 's/[[\.*^$()+?{|]/\\&/g')
    
    if grep -q "^$KEY=" .env 2>/dev/null; then
        # Key exists, update it
        sed -i.bak "s|^$KEY=.*|$KEY=$ESCAPED_VAL|" .env
        rm -f .env.bak
    else
        # Key doesn't exist, append it
        echo "$KEY=$VAL" >> .env
    fi
}

# Deploy contract and save both hex and StrKey formats to .env
deploy_contract_with_ids() {
    local CONTRACT_NAME="$1"  # e.g., "NFT", "FACTORY", "REGISTRY"
    local WASM_FILE="$2"
    local DEPLOYER_SECRET="$3"
    local NETWORK="$4"
    local NETWORK_PASSPHRASE="$5"
    
    if [ -z "$CONTRACT_NAME" ] || [ -z "$WASM_FILE" ] || [ -z "$DEPLOYER_SECRET" ]; then
        echo "❌ deploy_contract_with_ids: CONTRACT_NAME, WASM_FILE, and DEPLOYER_SECRET are required"
        return 1
    fi
    
    # Set defaults
    NETWORK="${NETWORK:-testnet}"
    NETWORK_PASSPHRASE="${NETWORK_PASSPHRASE:-Test SDF Network ; September 2015}"
    
    echo "📦 Deploying $CONTRACT_NAME contract..."
    
    # Deploy the contract
    local CONTRACT_ID_HEX
    CONTRACT_ID_HEX=$(stellar contract install \
        --wasm "$WASM_FILE" \
        --source "$DEPLOYER_SECRET" \
        --network "$NETWORK" \
        --network-passphrase "$NETWORK_PASSPHRASE" \
        2>&1 | tail -1)
    
    if [ $? -ne 0 ] || [ -z "$CONTRACT_ID_HEX" ]; then
        echo "❌ $CONTRACT_NAME contract deployment failed"
        return 1
    fi
    
    # Convert to StrKey format
    local CONTRACT_ADDRESS
    CONTRACT_ADDRESS=$(encode_contract_strkey "$CONTRACT_ID_HEX")
    
    if [ $? -ne 0 ] || [ -z "$CONTRACT_ADDRESS" ]; then
        echo "❌ Failed to encode StrKey for $CONTRACT_NAME contract"
        return 1
    fi
    
    # Save both formats to .env
    local HEX_KEY="${CONTRACT_NAME}_CONTRACT_ID_HEX"
    local ADDRESS_KEY="${CONTRACT_NAME}_CONTRACT_ADDRESS"
    
    upsert_env "$HEX_KEY" "$CONTRACT_ID_HEX"
    upsert_env "$ADDRESS_KEY" "$CONTRACT_ADDRESS"
    
    # Display results
    echo "✅ $CONTRACT_NAME contract deployed successfully!"
    echo "📝 Contract ID (hex): $CONTRACT_ID_HEX"
    echo "🏷️  Contract Address (StrKey): $CONTRACT_ADDRESS"
    echo "💾 Saved to .env as $HEX_KEY and $ADDRESS_KEY"
    echo ""
    echo "💡 Use StrKey (C...) in frontend/wallet integrations"
    
    # Return the hex ID for further use in scripts
    echo "$CONTRACT_ID_HEX"
}

# Upload WASM and return hash
upload_wasm() {
    local WASM_FILE="$1"
    local DEPLOYER_SECRET="$2"
    local NETWORK="$3"
    local NETWORK_PASSPHRASE="$4"
    
    NETWORK="${NETWORK:-testnet}"
    NETWORK_PASSPHRASE="${NETWORK_PASSPHRASE:-Test SDF Network ; September 2015}"
    
    echo "📦 Uploading WASM file: $WASM_FILE"
    
    local WASM_HASH
    WASM_HASH=$(stellar contract install \
        --wasm "$WASM_FILE" \
        --source "$DEPLOYER_SECRET" \
        --network "$NETWORK" \
        --network-passphrase "$NETWORK_PASSPHRASE" \
        2>&1 | tail -1)
    
    if [ $? -ne 0 ] || [ -z "$WASM_HASH" ]; then
        echo "❌ WASM upload failed"
        return 1
    fi
    
    echo "✅ WASM uploaded successfully!"
    echo "📝 WASM Hash: $WASM_HASH"
    echo "$WASM_HASH"
}

# Print deployment summary
print_deployment_summary() {
    echo ""
    echo "📋 ==================== DEPLOYMENT SUMMARY ===================="
    echo ""
    
    if [ -f ".env" ]; then
        echo "🔍 Contract Addresses in .env:"
        grep "_CONTRACT_" .env | sort
        echo ""
    fi
    
    echo "🔧 Next steps:"
    echo "   • Frontend/wallets should use StrKey addresses (C...)"
    echo "   • CLI tools can use either format"
    echo "   • All values are saved in .env for easy access"
    echo ""
    echo "=============================================================="
}