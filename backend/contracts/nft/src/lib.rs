#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, Env, String, Symbol
};

use stellar_access::access_control::{set_admin, AccessControl};
use stellar_macros::{default_impl, only_admin};
use stellar_tokens::non_fungible::{Base, NonFungibleToken};

#[derive(Clone)]
#[contracttype]
pub struct CollectionMetadata {
    pub name: String,
    pub symbol: String,
    pub uri_base: String,
    pub royalties_bps: u32,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    CollectionMetadata,
    Initialized,
    NextTokenId,
}

#[contract]
pub struct NFTContract;

#[contractimpl]
impl NFTContract {
    pub fn __constructor(
        env: Env,
        owner: Address,
        name: String,
        symbol: String,
        uri_base: String,
        royalties_bps: u32,
    ) {
        // Check if already initialized
        if env.storage().instance().has(&DataKey::Initialized) {
            panic!("Contract already initialized");
        }

        if royalties_bps > 10000 {
            panic!("Royalties cannot exceed 10000 basis points (100%)");
        }

        // Set admin for access control
        set_admin(&env, &owner);

        // Store collection metadata
        let metadata = CollectionMetadata {
            name: name.clone(),
            symbol: symbol.clone(),
            uri_base: uri_base.clone(),
            royalties_bps,
        };

        env.storage().instance().set(&DataKey::CollectionMetadata, &metadata);
        env.storage().instance().set(&DataKey::Initialized, &true);
        env.storage().instance().set(&DataKey::NextTokenId, &1u32);

        // Set metadata in the NFT base
        Base::set_metadata(&env, uri_base.clone(), name.clone(), symbol.clone());
    }

    pub fn mint(env: &Env, caller: Address, to: Address, amount: u32) -> u32 {
        // Check if caller has minter role
        let minter_role = symbol_short!("minter");
        if !<NFTContract as AccessControl>::has_role(env, caller.clone(), minter_role).is_some() {
            panic!("Caller is not a minter");
        }
        // Get next token ID
        let next_token_id: u32 = env.storage().instance()
            .get(&DataKey::NextTokenId)
            .unwrap_or(1u32);

        // Mint tokens sequentially
        for i in 0..amount {
            let token_id = next_token_id + i;
            Base::mint(env, &to, token_id);
        }

        // Update next token ID
        env.storage().instance().set(&DataKey::NextTokenId, &(next_token_id + amount));

        next_token_id
    }

    #[only_admin]
    pub fn set_minter(env: &Env, admin: Address, new_minter: Address) {
        <NFTContract as AccessControl>::grant_role(env, admin, new_minter, symbol_short!("minter"));
    }

    pub fn get_collection_metadata(env: &Env) -> CollectionMetadata {
        env.storage().instance().get(&DataKey::CollectionMetadata).unwrap()
    }

    pub fn get_royalties(env: &Env) -> u32 {
        let metadata: CollectionMetadata = env.storage().instance()
            .get(&DataKey::CollectionMetadata)
            .unwrap();
        metadata.royalties_bps
    }

    pub fn check_role(env: &Env, account: Address, role: Symbol) -> bool {
        <NFTContract as AccessControl>::has_role(env, account, role).is_some()
    }

    #[only_admin]
    pub fn assign_role(env: &Env, admin: Address, account: Address, role: Symbol) {
        <NFTContract as AccessControl>::grant_role(env, admin, account, role);
    }

    #[only_admin]
    pub fn remove_role(env: &Env, admin: Address, account: Address, role: Symbol) {
        <NFTContract as AccessControl>::revoke_role(env, admin, account, role);
    }

    pub fn contract_admin(env: &Env) -> Address {
        <NFTContract as AccessControl>::get_admin(env).expect("Admin not set")
    }

    pub fn total_supply(env: &Env) -> u32 {
        let next_token_id: u32 = env.storage().instance()
            .get(&DataKey::NextTokenId)
            .unwrap_or(1u32);
        next_token_id - 1
    }
}

// Implement the NonFungibleToken trait using the OpenZeppelin Base
#[default_impl]
#[contractimpl]
impl NonFungibleToken for NFTContract {
    type ContractType = Base;

    fn token_uri(env: &Env, _token_id: u32) -> String {
        let metadata: CollectionMetadata = env.storage().instance()
            .get(&DataKey::CollectionMetadata)
            .unwrap();

        // For simplicity, return base URI with token ID as hex
        // This avoids complex string manipulation in no_std environment
        metadata.uri_base
    }
}

// Implement AccessControl trait
#[default_impl]
#[contractimpl]
impl AccessControl for NFTContract {}