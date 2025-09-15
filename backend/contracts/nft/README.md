# Stellar Wizard NFT Contract

A Soroban smart contract implementing ERC-721-like NFT functionality for the Stellar blockchain.

## Features

- **ERC-721-like Interface**: Standard NFT functions (mint, transfer, balance_of, owner_of)
- **Collection Metadata**: Store collection name, symbol, URI, supply, and royalties
- **Registry Integration**: Only authorized Registry contract can mint NFTs
- **Supply Management**: Enforces maximum supply limits (1-10,000 NFTs)
- **Royalty Support**: Built-in royalty percentage (0-10%)

## Contract Functions

### Initialization
```rust
init(owner: Address, name: String, symbol: String, uri: String, supply: u32, royalties: u32)
```

### Core NFT Functions
```rust
mint(to: Address, amount: u32) -> u32        // Returns first token ID minted
transfer(from: Address, to: Address, token_id: u32)
balance_of(owner: Address) -> u32
owner_of(token_id: u32) -> Address
```

### Registry Management
```rust
set_registry(registry: Address)              // Only owner can set
```

### Metadata & Info
```rust
get_collection_info() -> CollectionMetadata
get_total_minted() -> u32
get_next_token_id() -> u32
get_owner() -> Address
get_registry() -> Option<Address>
```

## Building & Deployment

1. **Build the contract:**
   ```bash
   ./build.sh
   ```

2. **Deploy to testnet:**
   ```bash
   ./deploy.sh testnet
   ```

3. **Deploy to mainnet:**
   ```bash
   ./deploy.sh mainnet
   ```

## Integration with Registry

The NFT contract is designed to work with the Registry contract:

1. Deploy NFT contract
2. Initialize with collection metadata
3. Set Registry contract address using `set_registry()`
4. Registry can now call `mint()` to create NFTs for users

## Data Storage

- **Instance Storage**: Contract metadata, owner, registry, counters
- **Persistent Storage**: Token ownership and balances (survives contract upgrades)

## Security Features

- **Authorization**: Only Registry (or owner if no registry set) can mint
- **Supply Limits**: Cannot exceed maximum supply
- **Validation**: Input validation for all parameters
- **Ownership**: Proper ownership checks for transfers

## Testing

Run the included tests:
```bash
cargo test
```

Tests cover:
- Contract initialization
- Minting with supply limits
- Token transfers
- Balance tracking
- Authorization checks