#!/bin/bash
set -e

echo "Building Stellar Wizard NFT Contract..."

# Clean previous builds
cargo clean

# Build the contract
cargo build --target wasm32-unknown-unknown --release

# Copy the wasm file to a more accessible location
mkdir -p ../../target
cp target/wasm32-unknown-unknown/release/stellar_wizard_nft.wasm ../../target/

echo "✅ NFT Contract built successfully!"
echo "📦 WASM file available at: ../../target/stellar_wizard_nft.wasm"