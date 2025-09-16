# Stellar Wizard NFT Contract

This NFT contract is built using OpenZeppelin Stellar libraries, providing a secure and standardized implementation of NFT functionality with role-based access control.

## Overview

The contract extends OpenZeppelin's NFT and AccessControl modules to create a fully-featured NFT implementation with:

- **Standard NFT functionality**: Minting, transferring, approvals
- **Role-based access control**: Only authorized minters can create NFTs
- **Collection metadata**: Name, symbol, base URI, and royalties
- **Factory integration**: Designed to work with the Registry/Factory pattern

## Dependencies

The contract relies on OpenZeppelin Stellar libraries:

```toml
[dependencies]
soroban-sdk = "22.0.0"
oz-nft = { package = "openzeppelin-stellar-nft", git = "https://github.com/OpenZeppelin/stellar-contracts", branch = "main" }
oz-access-control = { package = "openzeppelin-stellar-access-control", git = "https://github.com/OpenZeppelin/stellar-contracts", branch = "main" }
```

## Contract Functions

### Initialization

```rust
pub fn init(
    env: Env,
    owner: Address,
    name: String,
    symbol: String,
    uri_base: String,
    royalties_bps: u32,
)
```

Initializes the NFT contract with collection metadata. Grants `DEFAULT_ADMIN_ROLE` to the owner.

**Parameters:**
- `owner`: Address that will have admin privileges
- `name`: Collection name (e.g., "Stellar Wizards")
- `symbol`: Collection symbol (e.g., "SWIZ")
- `uri_base`: Base URI for token metadata (e.g., "https://api.example.com/metadata")
- `royalties_bps`: Royalty percentage in basis points (e.g., 250 = 2.5%)

### Minting

```rust
pub fn mint(env: Env, to: Address, amount: u32) -> u32
```

Mints new NFTs to the specified address. Only callable by addresses with `MINTER_ROLE`.

**Returns:** The first token ID that was minted.

### Access Control

```rust
pub fn set_minter(env: Env, new_minter: Address)
```

Grants `MINTER_ROLE` to the specified address. Only callable by addresses with `DEFAULT_ADMIN_ROLE`.

### Standard NFT Functions

The contract exposes all standard NFT functions through OpenZeppelin modules:

- `name()`, `symbol()`: Collection information
- `token_uri(token_id)`: Returns metadata URI as `{uri_base}/{token_id}.json`
- `owner_of(token_id)`: Returns the owner of a specific token
- `balance_of(owner)`: Returns the number of tokens owned by an address
- `approve(to, token_id)`: Approve another address to transfer a specific token
- `transfer_from(from, to, token_id)`: Transfer a token (with proper authorization)

### Metadata Functions

```rust
pub fn get_collection_metadata(env: Env) -> CollectionMetadata
pub fn get_royalties(env: Env) -> u32
```

## Role-Based Access Control

The contract uses OpenZeppelin's AccessControl pattern:

- **DEFAULT_ADMIN_ROLE**: Can grant/revoke other roles, assigned to owner on init
- **MINTER_ROLE**: Can mint new NFTs, typically assigned to Factory contract

### Access Control Functions

```rust
pub fn has_role(env: Env, role: Symbol, account: Address) -> bool
pub fn grant_role(env: Env, role: Symbol, account: Address)
pub fn revoke_role(env: Env, role: Symbol, account: Address)
pub fn renounce_role(env: Env, role: Symbol, account: Address)
```

## Building & Deployment

### 1. Build the Contract

```bash
cd backend
./scripts/build.sh
```

This compiles the contract and generates the WASM file at `./target/stellar_wizard_nft.wasm`.

### 2. Deploy to Testnet

```bash
./scripts/deploy-nft.sh
```

This script will:
- Deploy the contract to Stellar testnet
- Save both HEX and StrKey contract addresses to `.env`:
  - `NFT_CONTRACT_ID_HEX`: Hex format contract ID
  - `NFT_CONTRACT_ADDRESS`: C... format contract address
- Display deployment information

## Usage Examples

### 1. Initialize NFT Contract

```bash
stellar contract invoke \
  --id $NFT_CONTRACT_ADDRESS \
  --source $DEPLOYER_SECRET \
  --network testnet \
  -- \
  init \
  --owner $OWNER_ADDRESS \
  --name "Stellar Wizards" \
  --symbol "SWIZ" \
  --uri_base "https://api.stellarwizards.com/metadata" \
  --royalties_bps 250
```

### 2. Set Registry as Minter

```bash
stellar contract invoke \
  --id $NFT_CONTRACT_ADDRESS \
  --source $OWNER_SECRET \
  --network testnet \
  -- \
  set_minter \
  --new_minter $REGISTRY_ADDRESS
```

### 3. Mint NFTs (via Registry)

The Registry contract will call the mint function after a collection is created and users request NFTs.

### 4. Read Collection Metadata

```bash
# Get collection name
stellar contract invoke \
  --id $NFT_CONTRACT_ADDRESS \
  --network testnet \
  -- \
  name

# Get collection symbol
stellar contract invoke \
  --id $NFT_CONTRACT_ADDRESS \
  --network testnet \
  -- \
  symbol

# Get token URI
stellar contract invoke \
  --id $NFT_CONTRACT_ADDRESS \
  --network testnet \
  -- \
  token_uri \
  --token_id 1
```

## Integration with Registry

The typical flow for integration with the Factory/Registry system:

1. **Registry deploys NFT contract** via `create_collection`
2. **Registry calls `init`** with collection metadata
3. **Registry calls `set_minter`** to grant itself minting permissions
4. **Users mint NFTs** through Registry, which calls `mint` on this contract

## Testing

Run the comprehensive test suite:

```bash
cd backend/contracts/nft
cargo test
```

### Test Coverage

The tests verify:

- ✅ Contract initialization with proper metadata storage
- ✅ Role-based access control (admin and minter roles)
- ✅ Minting functionality and restrictions
- ✅ Token URI generation (`{uri_base}/{token_id}.json`)
- ✅ Standard NFT operations (transfer, approval)
- ✅ Integration with OpenZeppelin modules
- ✅ Multiple minting scenarios
- ✅ Royalty information storage

## Security Features

- **Role-based access control**: Only authorized addresses can mint
- **OpenZeppelin foundation**: Built on battle-tested, audited libraries
- **Standard compliance**: Implements expected NFT interfaces
- **Proper authorization**: All state-changing functions require appropriate permissions

## Environment Variables

After deployment, these variables are added to `.env`:

```bash
# NFT Contract Information
NFT_CONTRACT_ID_HEX=<hex_contract_id>
NFT_CONTRACT_ADDRESS=CA<strkey_address>
```

## Troubleshooting

### Common Issues

1. **Deployment fails**: Ensure you have sufficient XLM balance and proper network configuration
2. **Minting fails**: Verify the caller has `MINTER_ROLE`
3. **Authorization errors**: Check that the correct secret key is being used for operations

### Verification

To verify the contract is working correctly:

```bash
# Check if contract is deployed
stellar contract invoke --id $NFT_CONTRACT_ADDRESS --network testnet -- name

# Verify minter role
stellar contract invoke --id $NFT_CONTRACT_ADDRESS --network testnet -- has_role --role MINTER --account $MINTER_ADDRESS
```

## Next Steps

1. Deploy the Factory/Registry contract: `./scripts/deploy-registry.sh`
2. Set up the Registry to use this NFT contract
3. Test end-to-end NFT creation flow
4. Configure frontend to interact with deployed contracts