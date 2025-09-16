#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, log, Address, Bytes, BytesN, Env, String, Vec, Symbol, symbol_short, IntoVal, TryFromVal
};

#[derive(Clone)]
#[contracttype]
pub struct Config {
    pub owner: Address,
    pub fee_bps: u32,       // basis points (200 = 2%)
    pub fee_wallet: Address,
    pub nft_wasm_hash: BytesN<32>, // reference to NFT WASM for deployments
}

#[derive(Clone)]
#[contracttype]
pub struct CollectionMetadata {
    pub contract_id: Address,
    pub name: String,
    pub symbol: String,
    pub creator: Address,
    pub uri_base: String,
    pub royalties_bps: u32,
    pub created_at: u64,
}

#[derive(Clone)]
#[contracttype]
pub struct CollectionSummary {
    pub collection_id: u128,
    pub contract_id: Address,
    pub name: String,
    pub symbol: String,
    pub creator: Address,
    pub created_at: u64,
}

#[derive(Clone)]
#[contracttype]
pub struct MintRecord {
    pub user: Address,
    pub amount: u32,
    pub timestamp: u64,
    pub fee_paid: u128,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Config,
    NextCollectionId,
    Collection(u128),
    CreatorCollections(Address),
    CollectionMints(u128),
    NameToCollection(String),
    ContractToCollection(Address),
}

#[derive(Clone)]
#[contracttype]
pub enum Event {
    CollectionCreated,
    MintLogged,
    FeePaid,
}

pub const MINTER_ROLE: Symbol = symbol_short!("MINTER");

#[contract]
pub struct FactoryRegistry;

#[contractimpl]
impl FactoryRegistry {
    /// Initialize the factory with config
    pub fn initialize(
        env: Env,
        owner: Address,
        fee_bps: u32,
        fee_wallet: Address,
        nft_wasm_hash: BytesN<32>,
    ) {
        if env.storage().persistent().has(&DataKey::Config) {
            panic!("Already initialized");
        }

        owner.require_auth();

        if fee_bps > 10000 {
            panic!("Fee BPS cannot exceed 10000 (100%)");
        }

        let config = Config {
            owner: owner.clone(),
            fee_bps,
            fee_wallet,
            nft_wasm_hash,
        };

        env.storage().persistent().set(&DataKey::Config, &config);
        env.storage().persistent().set(&DataKey::NextCollectionId, &1u128);

        log!(&env, "Factory initialized with owner: {}", owner);
    }

    /// Update factory configuration (owner only)
    pub fn set_config(
        env: Env,
        fee_bps: u32,
        fee_wallet: Address,
        nft_wasm_hash: BytesN<32>,
    ) {
        let config: Config = env.storage().persistent().get(&DataKey::Config).unwrap();
        config.owner.require_auth();

        if fee_bps > 10000 {
            panic!("Fee BPS cannot exceed 10000 (100%)");
        }

        let new_config = Config {
            owner: config.owner,
            fee_bps,
            fee_wallet: fee_wallet.clone(),
            nft_wasm_hash,
        };

        env.storage().persistent().set(&DataKey::Config, &new_config);
        log!(&env, "Config updated: fee_bps={}, fee_wallet={}", fee_bps, fee_wallet.clone());
    }

    /// Create a new NFT collection using OpenZeppelin NFT contract
    pub fn create_collection(
        env: Env,
        caller: Address,
        name: String,
        symbol: String,
        uri_base: String,
        royalties_bps: u32,
    ) -> u128 {
        caller.require_auth();

        let config: Config = env.storage().persistent().get(&DataKey::Config).unwrap();
        let collection_id: u128 = env.storage().persistent()
            .get(&DataKey::NextCollectionId)
            .unwrap_or(1u128);

        if royalties_bps > 10000 {
            panic!("Royalties cannot exceed 10000 (100%)");
        }

        // Deploy new NFT contract instance using the OpenZeppelin NFT WASM
        // Use collection_id as salt for deterministic addresses
        let mut salt_bytes = [0u8; 32];
        let id_bytes = collection_id.to_be_bytes();
        // Copy the u128 bytes (16 bytes) to the end of the salt array
        for (i, &byte) in id_bytes.iter().enumerate() {
            if i < 16 {
                salt_bytes[16 + i] = byte;
            }
        }
        let salt_hash = BytesN::from_array(&env, &salt_bytes);

        // The WASM hash should already be a BytesN<32>, convert it properly
        let wasm_hash = config.nft_wasm_hash;

        // Deploy and initialize the NFT contract in one step
        // deploy_v2 will call the constructor with the provided arguments
        let contract_id = env.deployer().with_current_contract(salt_hash).deploy_v2(
            wasm_hash,
            (
                &caller,           // creator as initial owner
                &name,
                &symbol,
                &uri_base,
                &royalties_bps,
            )
        );

        // The NFT contract is initialized with the caller as owner/admin
        // They can manage minting and other permissions as needed

        // Create collection record
        let collection = CollectionMetadata {
            contract_id: contract_id.clone(),
            name: name.clone(),
            symbol: symbol.clone(),
            creator: caller.clone(),
            uri_base: uri_base.clone(),
            royalties_bps,
            created_at: env.ledger().timestamp(),
        };

        // Store collection
        env.storage().persistent().set(&DataKey::Collection(collection_id), &collection);

        // Store lookup mappings for Registry functionality
        env.storage().persistent().set(&DataKey::NameToCollection(name.clone()), &collection_id);
        env.storage().persistent().set(&DataKey::ContractToCollection(contract_id.clone()), &collection_id);

        // Update creator's collection list
        let mut creator_collections: Vec<u128> = env.storage().persistent()
            .get(&DataKey::CreatorCollections(caller.clone()))
            .unwrap_or(Vec::new(&env));
        creator_collections.push_back(collection_id);
        env.storage().persistent().set(&DataKey::CreatorCollections(caller.clone()), &creator_collections);

        // Update next collection ID
        env.storage().persistent().set(&DataKey::NextCollectionId, &(collection_id + 1));

        // Emit event
        env.events().publish((
            symbol_short!("col_creat"),
            collection_id,
            contract_id.clone(),
            name.clone(),
            symbol.clone(),
            caller.clone(),
        ), Event::CollectionCreated);

        log!(&env, "Collection {} created with ID: {}, contract: {}",
             symbol, collection_id, contract_id);
        collection_id
    }

    /// Mint NFTs through the factory (with fee handling)
    pub fn mint(
        env: Env,
        collection_id: u128,
        to: Address,
        amount: u32,
    ) {
        to.require_auth();

        let config: Config = env.storage().persistent().get(&DataKey::Config).unwrap();
        let collection: CollectionMetadata = env.storage().persistent()
            .get(&DataKey::Collection(collection_id))
            .ok_or("Collection not found")
            .unwrap();

        // Calculate and handle fees if applicable
        let fee_amount = if config.fee_bps > 0 {
            // Charge a base fee per NFT minted
            let base_fee_per_nft = 1_000_000u128; // 0.1 XLM per NFT
            let total_base_fee = base_fee_per_nft * amount as u128;
            let fee = (total_base_fee * config.fee_bps as u128) / 10000;

            if fee > 0 {
                // For simplicity, we assume the fee is paid in the native asset
                // In a real implementation, you'd handle the actual transfer here
                log!(&env, "Fee of {} would be charged to {}", fee, config.fee_wallet);

                // Emit fee paid event
                env.events().publish((
                    symbol_short!("fee_paid"),
                    fee,
                    config.fee_wallet.clone(),
                ), Event::FeePaid);
            }
            fee
        } else {
            0u128
        };

        // Call mint on the child NFT contract
        // Factory has minter role, so this should succeed
        // mint(env, caller, to, amount)
        let first_token_id = env.invoke_contract::<u32>(
            &collection.contract_id,
            &symbol_short!("mint"),
            Vec::from_array(&env, [
                env.current_contract_address().into_val(&env),
                to.clone().into_val(&env),
                amount.into_val(&env),
            ])
        );

        // Log the mint for registry
        let mint_record = MintRecord {
            user: to.clone(),
            amount,
            timestamp: env.ledger().timestamp(),
            fee_paid: fee_amount,
        };

        let mut collection_mints: Vec<MintRecord> = env.storage().persistent()
            .get(&DataKey::CollectionMints(collection_id))
            .unwrap_or(Vec::new(&env));
        collection_mints.push_back(mint_record);
        env.storage().persistent().set(&DataKey::CollectionMints(collection_id), &collection_mints);

        // Emit mint logged event
        env.events().publish((
            symbol_short!("mint_log"),
            collection_id,
            to.clone(),
            amount,
            fee_amount,
        ), Event::MintLogged);

        log!(&env, "Minted {} NFTs for collection {}, starting from token ID {}",
             amount, collection_id, first_token_id);
    }

    /// Get collection details
    pub fn get_collection(env: Env, collection_id: u128) -> CollectionMetadata {
        env.storage().persistent()
            .get(&DataKey::Collection(collection_id))
            .ok_or("Collection not found")
            .unwrap()
    }

    /// List collections with pagination
    pub fn list_collections(env: Env, cursor: Option<u128>, limit: Option<u32>) -> Vec<CollectionSummary> {
        let next_id: u128 = env.storage().persistent()
            .get(&DataKey::NextCollectionId)
            .unwrap_or(1u128);

        let start = cursor.unwrap_or(1u128);
        let limit = limit.unwrap_or(10u32);
        let end = (start + limit as u128).min(next_id);

        let mut collections = Vec::new(&env);

        for id in start..end {
            if let Some(collection) = env.storage().persistent().get::<DataKey, CollectionMetadata>(&DataKey::Collection(id)) {
                collections.push_back(CollectionSummary {
                    collection_id: id,
                    contract_id: collection.contract_id,
                    name: collection.name,
                    symbol: collection.symbol,
                    creator: collection.creator,
                    created_at: collection.created_at,
                });
            }
        }

        collections
    }

    /// List collections by creator
    pub fn list_by_creator(env: Env, creator: Address) -> Vec<u128> {
        env.storage().persistent()
            .get(&DataKey::CreatorCollections(creator))
            .unwrap_or(Vec::new(&env))
    }

    /// Get mint history for a collection
    pub fn get_collection_mints(env: Env, collection_id: u128) -> Vec<MintRecord> {
        env.storage().persistent()
            .get(&DataKey::CollectionMints(collection_id))
            .unwrap_or(Vec::new(&env))
    }

    /// Get current config
    pub fn get_config(env: Env) -> Config {
        env.storage().persistent().get(&DataKey::Config).unwrap()
    }

    /// Get next collection ID
    pub fn get_next_collection_id(env: Env) -> u128 {
        env.storage().persistent()
            .get(&DataKey::NextCollectionId)
            .unwrap_or(1u128)
    }

    /// Get total number of collections
    pub fn get_total_collections(env: Env) -> u128 {
        let next_id: u128 = env.storage().persistent()
            .get(&DataKey::NextCollectionId)
            .unwrap_or(1u128);
        if next_id > 1 { next_id - 1 } else { 0 }
    }

    /// Find collection by name
    pub fn find_by_name(env: Env, name: String) -> Option<CollectionMetadata> {
        if let Some(collection_id) = env.storage().persistent().get::<DataKey, u128>(&DataKey::NameToCollection(name)) {
            env.storage().persistent().get(&DataKey::Collection(collection_id))
        } else {
            None
        }
    }

    /// Find collection by contract ID
    pub fn find_by_contract_id(env: Env, contract_id: Address) -> Option<CollectionMetadata> {
        if let Some(collection_id) = env.storage().persistent().get::<DataKey, u128>(&DataKey::ContractToCollection(contract_id)) {
            env.storage().persistent().get(&DataKey::Collection(collection_id))
        } else {
            None
        }
    }

    /// Get collection metadata by contract ID (for Registry interface)
    pub fn get_collection_by_contract(env: Env, contract_id: Address) -> CollectionMetadata {
        let collection_id: u128 = env.storage().persistent()
            .get(&DataKey::ContractToCollection(contract_id))
            .ok_or("Collection not found")
            .unwrap();

        env.storage().persistent()
            .get(&DataKey::Collection(collection_id))
            .ok_or("Collection metadata not found")
            .unwrap()
    }
}