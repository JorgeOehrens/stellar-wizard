# Stellar Wizard Backend

Complete smart contract backend for the Stellar Wizard NFT creation platform, built with Soroban smart contracts.

## Overview

The backend consists of two main smart contracts:

- **Registry Contract**: Main router that handles user requests, fee collection, and coordinates NFT creation
- **NFT Contract**: ERC-721-like contract that mints and manages individual NFT collections

## Prerequisites

Before you begin, ensure you have the following installed:

1. **Rust (nightly toolchain)**
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   rustup default nightly
   ```

2. **Soroban CLI**
   ```bash
   cargo install --locked soroban-cli
   ```

3. **wasm32 target**
   ```bash
   rustup target add wasm32-unknown-unknown
   ```

4. **Basic utilities** (for scripts)
   ```bash
   # On macOS
   brew install bc

   # On Ubuntu/Debian
   sudo apt install bc
   ```

## Quick Start

Follow these steps to deploy and configure the Stellar Wizard backend on testnet:

### 1. Initialize Deployer Account

Generate a new deployer account and fund it with testnet XLM:

```bash
cd backend
./scripts/init-deployer.sh
```

This script will:
- Generate a new Stellar keypair
- Fund the account using Friendbot
- Save credentials to `.env`

### 2. Build Contracts

Compile both contracts to WASM:

```bash
./scripts/build.sh
```

This will build both the NFT and Registry contracts and copy WASM files to `./target/`.

### 3. Deploy NFT Contract

Deploy the NFT contract first:

```bash
./scripts/deploy-nft.sh
```

This will:
- Deploy the NFT contract to testnet
- Save `NFT_CONTRACT_ID` to `.env`

### 4. Deploy Registry Contract

Deploy the Registry contract and connect it to the NFT contract:

```bash
./scripts/deploy-registry.sh
```

This will:
- Deploy the Registry contract to testnet
- Initialize it with the NFT contract address
- Save `REGISTRY_CONTRACT_ID` to `.env`

### 5. Configure Fee Settings

Set your fee wallet and rate:

```bash
# First, edit .env and set your FEE_WALLET address
nano .env

# Then run the configuration script
./scripts/set-config.sh
```

This will:
- Set the fee collection wallet
- Set the fee rate (default: 200 basis points = 2%)
- Verify the configuration

### 6. Verify Deployment

Test your deployment with these commands:

```bash
# Check Registry configuration
soroban contract invoke \
  --id $REGISTRY_CONTRACT_ID \
  --network testnet \
  -- get_config

# Check Registry stats
soroban contract invoke \
  --id $REGISTRY_CONTRACT_ID \
  --network testnet \
  -- get_total_records
```

## Contract Details

### Registry Contract

**Location**: `contracts/registry/`

**Key Functions**:
- `initialize(owner, nft_contract)` - Initialize with NFT contract
- `log_and_route(user, action_type, params, amount)` - Main entry point
- `set_fee_wallet(fee_wallet)` - Set commission wallet
- `set_fee_bps(fee_bps)` - Set fee rate (0-1000 basis points)
- `get_config()` - Get current configuration

### NFT Contract

**Location**: `contracts/nft/`

**Key Functions**:
- `init(owner, name, symbol, uri, supply, royalties)` - Initialize collection
- `mint(to, amount)` - Mint NFTs (Registry-only)
- `transfer(from, to, token_id)` - Transfer NFT
- `balance_of(owner)` - Get token count
- `owner_of(token_id)` - Get token owner

## Environment Variables

Your `.env` file should contain:

```bash
# Deployer account (auto-generated)
DEPLOYER_PUBLIC=GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
DEPLOYER_SECRET=SXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

# Fee collection wallet (set this to your wallet)
FEE_WALLET=GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

# Contract addresses (auto-populated by deployment)
REGISTRY_CONTRACT_ID=CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
NFT_CONTRACT_ID=CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

# Fee rate in basis points (200 = 2%)
FEE_BPS=200
```

## Testing

Run contract tests:

```bash
# Test NFT contract
cd contracts/nft
cargo test

# Test Registry contract
cd ../registry
cargo test
```

## Integration with Frontend

The frontend should call the Registry contract with these parameters:

```typescript
// Example NFT creation call
const params = {
  user: "GUSER...", // User's Stellar address
  action_type: "NFT",
  params: JSON.stringify({
    collectionName: "My NFTs",
    symbol: "MYNFT",
    totalSupply: 100,
    mediaUrl: "https://...",
    royaltiesPct: 5
  }),
  amount: "10000000" // 1 XLM in stroops
};
```

## Mainnet Deployment

To deploy to mainnet:

1. Change network in scripts from `testnet` to `mainnet`
2. Fund your deployer account with real XLM
3. Run the same deployment steps
4. Update your frontend `.env` with mainnet contract IDs

## Troubleshooting

### Common Issues

**"Contract not found" error**:
- Make sure you're in the `/backend` directory
- Run `./scripts/build.sh` first

**"Account not funded" error**:
- Re-run `./scripts/init-deployer.sh`
- Check account balance: `soroban keys balance stellar-wizard --network testnet`

**"Invalid fee wallet" error**:
- Ensure `FEE_WALLET` in `.env` is a valid Stellar address (starts with G, 56 characters)

**"Permission denied" on scripts**:
- Make scripts executable: `chmod +x scripts/*.sh`

### Getting Help

- Check the Soroban documentation: https://soroban.stellar.org/
- Stellar Discord: https://discord.gg/stellar
- Stellar Stack Exchange: https://stellar.stackexchange.com/

## File Structure

```
backend/
├── contracts/
│   ├── nft/
│   │   ├── src/lib.rs        # NFT contract implementation
│   │   ├── Cargo.toml        # NFT dependencies
│   │   └── README.md         # NFT contract docs
│   └── registry/
│       ├── src/lib.rs        # Registry contract implementation
│       ├── Cargo.toml        # Registry dependencies
│       └── test.rs           # Registry tests
├── scripts/
│   ├── init-deployer.sh      # Initialize deployer account
│   ├── build.sh              # Build all contracts
│   ├── deploy-nft.sh         # Deploy NFT contract
│   ├── deploy-registry.sh    # Deploy Registry contract
│   └── set-config.sh         # Configure contracts
├── target/                   # Built WASM files
├── .env.example              # Environment template
├── .env                      # Your environment (created by scripts)
└── README.md                 # This file
```

## Security Notes

- Keep your `DEPLOYER_SECRET` secure and never commit it to version control
- The `FEE_WALLET` should be a wallet you control for collecting commissions
- Consider using a multisig wallet for mainnet deployments
- Regularly backup your `.env` file securely

## License

This project is part of the Stellar Wizard platform.