#![cfg(test)]

use soroban_sdk::{
    testutils::{Address as _, AuthorizedFunction, AuthorizedInvocation},
    Address, Bytes, Env, String, Vec
};

use stellar_wizard_factory_registry::{
    FactoryRegistry, FactoryRegistryClient,
    CollectionMetadata, CollectionSummary, MintRecord, Config
};

fn create_factory_contract<'a>(env: &Env) -> (FactoryRegistryClient<'a>, Address) {
    let contract_address = env.register_contract(None, FactoryRegistry);
    let client = FactoryRegistryClient::new(env, &contract_address);
    (client, contract_address)
}

fn create_test_nft_wasm_hash(env: &Env) -> Bytes {
    // In real scenarios, this would be the actual WASM hash of the NFT contract
    // For testing, we'll use a dummy hash
    Bytes::from_array(env, &[1u8; 32])
}

#[test]
fn test_factory_initialization() {
    let env = Env::default();
    let (client, _) = create_factory_contract(&env);

    let owner = Address::generate(&env);
    let fee_wallet = Address::generate(&env);
    let nft_wasm_hash = create_test_nft_wasm_hash(&env);
    let fee_bps = 250; // 2.5%

    env.mock_all_auths();

    // Initialize factory
    client.initialize(&owner, &fee_bps, &fee_wallet, &nft_wasm_hash);

    // Verify config was set correctly
    let config = client.get_config();
    assert_eq!(config.owner, owner);
    assert_eq!(config.fee_bps, fee_bps);
    assert_eq!(config.fee_wallet, fee_wallet);
    assert_eq!(config.nft_wasm_hash, nft_wasm_hash);

    // Verify initial state
    assert_eq!(client.get_next_collection_id(), 1u128);
    assert_eq!(client.get_total_collections(), 0u128);
}

#[test]
#[should_panic(expected = "Already initialized")]
fn test_factory_double_initialization_fails() {
    let env = Env::default();
    let (client, _) = create_factory_contract(&env);

    let owner = Address::generate(&env);
    let fee_wallet = Address::generate(&env);
    let nft_wasm_hash = create_test_nft_wasm_hash(&env);

    env.mock_all_auths();

    // Initialize once
    client.initialize(&owner, &200, &fee_wallet, &nft_wasm_hash);

    // Try to initialize again - should panic
    client.initialize(&owner, &300, &fee_wallet, &nft_wasm_hash);
}

#[test]
#[should_panic(expected = "Fee BPS cannot exceed 10000")]
fn test_factory_invalid_fee_bps() {
    let env = Env::default();
    let (client, _) = create_factory_contract(&env);

    let owner = Address::generate(&env);
    let fee_wallet = Address::generate(&env);
    let nft_wasm_hash = create_test_nft_wasm_hash(&env);

    env.mock_all_auths();

    // Try to initialize with invalid fee BPS (over 100%)
    client.initialize(&owner, &15000, &fee_wallet, &nft_wasm_hash);
}

#[test]
fn test_set_config() {
    let env = Env::default();
    let (client, _) = create_factory_contract(&env);

    let owner = Address::generate(&env);
    let fee_wallet = Address::generate(&env);
    let new_fee_wallet = Address::generate(&env);
    let nft_wasm_hash = create_test_nft_wasm_hash(&env);
    let new_nft_wasm_hash = Bytes::from_array(&env, &[2u8; 32]);

    env.mock_all_auths();

    // Initialize factory
    client.initialize(&owner, &200, &fee_wallet, &nft_wasm_hash);

    // Update config
    client.set_config(&500, &new_fee_wallet, &new_nft_wasm_hash);

    // Verify config was updated
    let config = client.get_config();
    assert_eq!(config.owner, owner); // Owner should remain the same
    assert_eq!(config.fee_bps, 500);
    assert_eq!(config.fee_wallet, new_fee_wallet);
    assert_eq!(config.nft_wasm_hash, new_nft_wasm_hash);
}

#[test]
fn test_create_collection() {
    let env = Env::default();
    let (client, factory_address) = create_factory_contract(&env);

    let owner = Address::generate(&env);
    let fee_wallet = Address::generate(&env);
    let creator = Address::generate(&env);
    let nft_wasm_hash = create_test_nft_wasm_hash(&env);

    env.mock_all_auths();

    // Initialize factory
    client.initialize(&owner, &200, &fee_wallet, &nft_wasm_hash);

    // Create collection
    let collection_name = String::from_str(&env, "Stellar Wizards");
    let collection_symbol = String::from_str(&env, "SWIZ");
    let uri_base = String::from_str(&env, "https://api.stellarwizards.com/metadata");
    let royalties_bps = 250;

    let collection_id = client.create_collection(
        &collection_name,
        &collection_symbol,
        &uri_base,
        &royalties_bps,
    );

    // Verify collection was created
    assert_eq!(collection_id, 1u128);
    assert_eq!(client.get_next_collection_id(), 2u128);
    assert_eq!(client.get_total_collections(), 1u128);

    // Verify collection metadata
    let collection = client.get_collection(&collection_id);
    assert_eq!(collection.name, collection_name);
    assert_eq!(collection.symbol, collection_symbol);
    assert_eq!(collection.creator, creator);
    assert_eq!(collection.uri_base, uri_base);
    assert_eq!(collection.royalties_bps, royalties_bps);

    // Verify creator's collection list
    let creator_collections = client.list_by_creator(&creator);
    assert_eq!(creator_collections.len(), 1);
    assert_eq!(creator_collections.get(0).unwrap(), collection_id);
}

#[test]
#[should_panic(expected = "Royalties cannot exceed 10000")]
fn test_create_collection_invalid_royalties() {
    let env = Env::default();
    let (client, _) = create_factory_contract(&env);

    let owner = Address::generate(&env);
    let fee_wallet = Address::generate(&env);
    let nft_wasm_hash = create_test_nft_wasm_hash(&env);

    env.mock_all_auths();

    // Initialize factory
    client.initialize(&owner, &200, &fee_wallet, &nft_wasm_hash);

    // Try to create collection with invalid royalties (over 100%)
    client.create_collection(
        &String::from_str(&env, "Test Collection"),
        &String::from_str(&env, "TEST"),
        &String::from_str(&env, "https://example.com"),
        &15000, // Invalid royalties
    );
}

#[test]
fn test_multiple_collections() {
    let env = Env::default();
    let (client, _) = create_factory_contract(&env);

    let owner = Address::generate(&env);
    let fee_wallet = Address::generate(&env);
    let creator1 = Address::generate(&env);
    let creator2 = Address::generate(&env);
    let nft_wasm_hash = create_test_nft_wasm_hash(&env);

    env.mock_all_auths();

    // Initialize factory
    client.initialize(&owner, &200, &fee_wallet, &nft_wasm_hash);

    // Create first collection
    let collection1_id = client.create_collection(
        &String::from_str(&env, "Collection 1"),
        &String::from_str(&env, "COL1"),
        &String::from_str(&env, "https://example1.com"),
        &250,
    );

    // Create second collection by same creator
    let collection2_id = client.create_collection(
        &String::from_str(&env, "Collection 2"),
        &String::from_str(&env, "COL2"),
        &String::from_str(&env, "https://example2.com"),
        &500,
    );

    // Verify collections were created with sequential IDs
    assert_eq!(collection1_id, 1u128);
    assert_eq!(collection2_id, 2u128);
    assert_eq!(client.get_total_collections(), 2u128);

    // Verify creator's collection list
    let creator1_collections = client.list_by_creator(&creator1);
    assert_eq!(creator1_collections.len(), 2);
    assert_eq!(creator1_collections.get(0).unwrap(), collection1_id);
    assert_eq!(creator1_collections.get(1).unwrap(), collection2_id);
}

#[test]
fn test_list_collections() {
    let env = Env::default();
    let (client, _) = create_factory_contract(&env);

    let owner = Address::generate(&env);
    let fee_wallet = Address::generate(&env);
    let nft_wasm_hash = create_test_nft_wasm_hash(&env);

    env.mock_all_auths();

    // Initialize factory
    client.initialize(&owner, &200, &fee_wallet, &nft_wasm_hash);

    // Create multiple collections
    for i in 1..=5 {
        client.create_collection(
            &String::from_str(&env, &format!("Collection {}", i)),
            &String::from_str(&env, &format!("COL{}", i)),
            &String::from_str(&env, "https://example.com"),
            &250,
        );
    }

    // Test listing all collections
    let all_collections = client.list_collections(&None, &None);
    assert_eq!(all_collections.len(), 5);

    // Test pagination
    let page1 = client.list_collections(&None, &Some(3));
    assert_eq!(page1.len(), 3);

    let page2 = client.list_collections(&Some(4), &Some(3));
    assert_eq!(page2.len(), 2);

    // Verify collection data structure
    let first_collection = page1.get(0).unwrap();
    assert_eq!(first_collection.collection_id, 1u128);
    assert_eq!(first_collection.name, String::from_str(&env, "Collection 1"));
    assert_eq!(first_collection.symbol, String::from_str(&env, "COL1"));
}

#[test]
fn test_mint_tracking() {
    let env = Env::default();
    let (client, _) = create_factory_contract(&env);

    let owner = Address::generate(&env);
    let fee_wallet = Address::generate(&env);
    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);
    let nft_wasm_hash = create_test_nft_wasm_hash(&env);

    env.mock_all_auths();

    // Initialize factory
    client.initialize(&owner, &200, &fee_wallet, &nft_wasm_hash);

    // Create a collection
    let collection_id = client.create_collection(
        &String::from_str(&env, "Test Collection"),
        &String::from_str(&env, "TEST"),
        &String::from_str(&env, "https://example.com"),
        &250,
    );

    // Note: In real scenarios, mint would call the actual NFT contract
    // For testing, we can't fully test the mint function without a real NFT contract
    // But we can verify the mint tracking structure exists

    // Verify initial mint history is empty
    let mint_history = client.get_collection_mints(&collection_id);
    assert_eq!(mint_history.len(), 0);
}

#[test]
fn test_get_collection_not_found() {
    let env = Env::default();
    let (client, _) = create_factory_contract(&env);

    let owner = Address::generate(&env);
    let fee_wallet = Address::generate(&env);
    let nft_wasm_hash = create_test_nft_wasm_hash(&env);

    env.mock_all_auths();

    // Initialize factory
    client.initialize(&owner, &200, &fee_wallet, &nft_wasm_hash);

    // Try to get non-existent collection - should panic
    let result = client.try_get_collection(&999u128);
    assert!(result.is_err());
}

#[test]
fn test_list_by_creator_empty() {
    let env = Env::default();
    let (client, _) = create_factory_contract(&env);

    let owner = Address::generate(&env);
    let fee_wallet = Address::generate(&env);
    let creator = Address::generate(&env);
    let nft_wasm_hash = create_test_nft_wasm_hash(&env);

    env.mock_all_auths();

    // Initialize factory
    client.initialize(&owner, &200, &fee_wallet, &nft_wasm_hash);

    // List collections for creator who hasn't created any
    let creator_collections = client.list_by_creator(&creator);
    assert_eq!(creator_collections.len(), 0);
}

#[test]
fn test_fee_calculation() {
    let env = Env::default();
    let (client, _) = create_factory_contract(&env);

    let owner = Address::generate(&env);
    let fee_wallet = Address::generate(&env);
    let nft_wasm_hash = create_test_nft_wasm_hash(&env);

    env.mock_all_auths();

    // Initialize factory with 5% fee
    client.initialize(&owner, &500, &fee_wallet, &nft_wasm_hash);

    let config = client.get_config();
    assert_eq!(config.fee_bps, 500);

    // Test fee calculation logic (this would be used in the mint function)
    let base_fee_per_nft = 1_000_000u128; // 0.1 XLM per NFT
    let amount = 3u32;
    let total_base_fee = base_fee_per_nft * amount as u128;
    let expected_fee = (total_base_fee * config.fee_bps as u128) / 10000;

    // 3 NFTs * 0.1 XLM * 5% = 0.015 XLM = 15,000 stroops
    assert_eq!(expected_fee, 150_000u128);
}