# Stellar Wizard Factory/Registry Contract

A comprehensive Factory contract that deploys and manages NFT collections on the Stellar blockchain. Users interact exclusively with the Factory, which handles NFT contract deployment, initialization, and minting behind the scenes.

## Overview

The Factory/Registry contract serves as the central hub for NFT collection management:

- **Deploys NFT contracts**: Creates new OpenZeppelin-based NFT contracts on demand
- **Manages collections**: Maintains a registry of all deployed collections
- **Handles minting**: Routes minting requests to the appropriate NFT contracts
- **Fee management**: Collects and routes platform fees
- **Access control**: Manages minter permissions across all collections

## Architecture

```
Users → Factory Contract → Individual NFT Contracts
                ↓
        Collection Registry
        Mint History
        Fee Management
```

## Contract Functions

### Initialization

```rust
pub fn initialize(
    env: Env,
    owner: Address,
    fee_bps: u32,
    fee_wallet: Address,
    nft_wasm_hash: Bytes,
)
```

Initializes the Factory with configuration parameters.

**Parameters:**
- `owner`: Factory owner with admin privileges
- `fee_bps`: Platform fee in basis points (200 = 2%)
- `fee_wallet`: Address to receive platform fees
- `nft_wasm_hash`: WASM hash of the NFT contract for deployments

### Collection Management

```rust
pub fn create_collection(
    env: Env,
    name: String,
    symbol: String,
    uri_base: String,
    royalties_bps: u32,
) -> u128
```

Creates a new NFT collection by:
1. Deploying a new NFT contract instance
2. Initializing it with the provided metadata
3. Setting the Factory as the minter
4. Storing collection metadata in the registry

**Returns:** Collection ID for future operations.

```rust
pub fn get_collection(env: Env, collection_id: u128) -> CollectionMetadata
pub fn list_collections(env: Env, cursor: Option<u128>, limit: Option<u32>) -> Vec<CollectionSummary>
pub fn list_by_creator(env: Env, creator: Address) -> Vec<u128>
```

### Minting

```rust
pub fn mint(
    env: Env,
    collection_id: u128,
    to: Address,
    amount: u32,
)
```

Mints NFTs through the Factory:
1. Validates the collection exists
2. Calculates and logs platform fees
3. Calls mint on the target NFT contract
4. Records the mint in the history

### Fee Management

The Factory automatically calculates fees based on the configured `fee_bps`:

```rust
// Base fee per NFT: 0.1 XLM
let base_fee_per_nft = 1_000_000u128;
let total_base_fee = base_fee_per_nft * amount as u128;
let fee = (total_base_fee * config.fee_bps as u128) / 10000;
```

### Configuration

```rust
pub fn set_config(env: Env, fee_bps: u32, fee_wallet: Address, nft_wasm_hash: Bytes)
pub fn get_config(env: Env) -> Config
```

Update Factory configuration (owner only).

## Data Structures

### CollectionMetadata

```rust
pub struct CollectionMetadata {
    pub contract_id: Address,    // Deployed NFT contract address
    pub name: String,           // Collection name
    pub symbol: String,         // Collection symbol
    pub creator: Address,       // Collection creator
    pub uri_base: String,       // Base URI for metadata
    pub royalties_bps: u32,     // Royalty percentage in BPS
    pub created_at: u64,        // Creation timestamp
}
```

### MintRecord

```rust
pub struct MintRecord {
    pub user: Address,          // Recipient address
    pub amount: u32,           // Number of NFTs minted
    pub timestamp: u64,        // Mint timestamp
    pub fee_paid: u128,        // Platform fee paid
}
```

## Events

```rust
pub enum Event {
    CollectionCreated {
        collection_id: u128,
        contract_id: Address,
        name: String,
        symbol: String,
        creator: Address,
    },
    MintLogged {
        collection_id: u128,
        to: Address,
        amount: u32,
        fee_amount: u128,
    },
    FeePaid {
        to: Address,
        amount: u128,
    },
}
```

## Storage

- **collections**: `Map<u128 => CollectionMetadata>` - Registry of all collections
- **by_creator**: `Map<Address => Vec<u128>>` - Collections by creator
- **collection_mints**: `Map<u128 => Vec<MintRecord>>` - Mint history per collection
- **config**: Factory configuration
- **next_collection_id**: Auto-incrementing collection counter

## Deployment & Setup

### 1. Build the Contracts

```bash
cd backend
./scripts/build.sh
```

This builds both the Factory and NFT contracts.

### 2. Deploy Factory

```bash
./scripts/deploy-factory.sh
```

This script will:
- Upload the NFT contract WASM to get its hash
- Deploy the Factory contract
- Initialize the Factory with configuration
- Save addresses to `.env`:
  - `FACTORY_CONTRACT_ID_HEX`: Hex format
  - `FACTORY_CONTRACT_ADDRESS`: StrKey format
  - `NFT_WASM_HASH`: For factory deployments

### 3. Create Collections

```bash
# Create with specific parameters
./scripts/create-collection.sh "My Collection" "MYCOL" "https://api.example.com/metadata" 250

# Or create with demo defaults
./scripts/create-collection.sh
```

### 4. Mint NFTs

```bash
# Mint specific amount to address
./scripts/mint-from-factory.sh 1 G...USER_ADDRESS 5

# Mint 1 NFT to deployer
./scripts/mint-from-factory.sh 1

# Use saved collection and defaults
./scripts/mint-from-factory.sh
```

## Integration Flow

### For Collection Creators

1. **Create Collection**: Call `create_collection()` with metadata
2. **Get Collection Info**: Use returned collection ID to get details
3. **Monitor Mints**: Check mint history and events

### For Users

1. **Browse Collections**: Use `list_collections()` to see available collections
2. **Mint NFTs**: Call `mint()` with collection ID and recipient
3. **Interact with NFTs**: Use the deployed NFT contract for transfers, approvals

### For Frontend Applications

```javascript
// Create a collection
const collectionId = await factoryContract.create_collection({
    name: "My NFT Collection",
    symbol: "MNC",
    uri_base: "https://api.mynfts.com/metadata",
    royalties_bps: 250
});

// Mint NFTs
await factoryContract.mint({
    collection_id: collectionId,
    to: userAddress,
    amount: 5
});

// Get collection details
const collection = await factoryContract.get_collection({
    collection_id: collectionId
});

// Interact with the NFT contract directly
const nftContract = new Contract(collection.contract_id);
const tokenOwner = await nftContract.owner_of({ token_id: 1 });
```

## Testing

Run the comprehensive test suite:

```bash
cd backend/contracts/factory_registry
cargo test
```

### Test Coverage

- ✅ Factory initialization and configuration
- ✅ Collection creation and metadata storage
- ✅ Fee calculation and management
- ✅ Mint tracking and history
- ✅ Pagination and listing functions
- ✅ Error handling and validation
- ✅ Integration with NFT contracts

## Environment Variables

After deployment, these variables are added to `.env`:

```bash
# Factory/Registry Contract Information
FACTORY_CONTRACT_ID_HEX=<hex_contract_id>
FACTORY_CONTRACT_ADDRESS=CA<strkey_address>
NFT_WASM_HASH=<nft_wasm_hash>

# Last Created Collection (updated by scripts)
LAST_COLLECTION_ID=1
LAST_COLLECTION_NAME="Demo Collection"
LAST_COLLECTION_SYMBOL="DEMO"

# Configuration
FEE_WALLET=G...  # Fee recipient address
FEE_BPS=200      # 2% platform fee
```

## Advanced Usage

### Batch Operations

Create multiple collections and mint in batches:

```bash
# Create multiple collections
for name in "Art" "Music" "Gaming"; do
    ./scripts/create-collection.sh "$name Collection" "${name^^}" "https://api.${name,,}.com" 250
done

# Batch mint to multiple users
for user in $USER_LIST; do
    ./scripts/mint-from-factory.sh 1 $user 1
done
```

### Collection Analytics

```bash
# Get factory statistics
stellar contract invoke --id $FACTORY_CONTRACT_ADDRESS --network testnet -- get_total_collections

# List all collections
stellar contract invoke --id $FACTORY_CONTRACT_ADDRESS --network testnet -- list_collections

# Get creator's collections
stellar contract invoke --id $FACTORY_CONTRACT_ADDRESS --network testnet -- list_by_creator --creator $CREATOR_ADDRESS

# Get mint history
stellar contract invoke --id $FACTORY_CONTRACT_ADDRESS --network testnet -- get_collection_mints --collection_id 1
```

### Direct NFT Contract Interaction

Once a collection is created, you can interact directly with its NFT contract:

```bash
# Get NFT contract address
COLLECTION_DETAILS=$(stellar contract invoke --id $FACTORY_CONTRACT_ADDRESS --network testnet -- get_collection --collection_id 1)
NFT_ADDRESS=$(echo "$COLLECTION_DETAILS" | grep -o 'C[A-Z0-9]\{55\}')

# Check token ownership
stellar contract invoke --id $NFT_ADDRESS --network testnet -- owner_of --token_id 1

# Transfer NFT
stellar contract invoke --id $NFT_ADDRESS --source $USER_SECRET --network testnet -- transfer_from --from $USER1 --to $USER2 --token_id 1

# Get token metadata URI
stellar contract invoke --id $NFT_ADDRESS --network testnet -- token_uri --token_id 1
```

## Troubleshooting

### Common Issues

1. **Factory deployment fails**
   - Ensure sufficient XLM balance for deployment
   - Check network connectivity
   - Verify WASM files are built: `./scripts/build.sh`

2. **Collection creation fails**
   - Verify Factory is deployed and initialized
   - Check royalties_bps ≤ 10000 (100%)
   - Ensure valid string parameters

3. **Minting fails**
   - Collection must exist
   - Factory must have minter role on NFT contract
   - Recipient address must be valid Stellar address

### Verification Commands

```bash
# Check Factory configuration
stellar contract invoke --id $FACTORY_CONTRACT_ADDRESS --network testnet -- get_config

# Verify collection exists
stellar contract invoke --id $FACTORY_CONTRACT_ADDRESS --network testnet -- get_collection --collection_id 1

# Check NFT contract has Factory as minter
stellar contract invoke --id $NFT_ADDRESS --network testnet -- has_role --role MINTER --account $FACTORY_CONTRACT_ADDRESS
```

## Security Considerations

- **Owner Controls**: Only Factory owner can update configuration
- **Minter Role**: Factory automatically sets itself as minter for deployed NFTs
- **Fee Validation**: Fee BPS limited to ≤ 10000 (100%)
- **Input Validation**: All parameters validated before processing
- **Event Logging**: All operations logged for transparency

## Next Steps

1. **Frontend Integration**: Build UI that interacts with Factory contract
2. **Metadata Services**: Set up IPFS or API for NFT metadata
3. **Marketplace**: Create secondary market for traded NFTs
4. **Analytics Dashboard**: Track collection performance and usage