#![cfg(test)]

use soroban_sdk::{
    testutils::{Address as _, AuthorizedFunction, AuthorizedInvocation},
    Address, Env, InvokeError, String, Symbol, symbol_short
};

use stellar_wizard_nft::{NFTContract, NFTContractClient, MINTER_ROLE};

fn create_nft_contract<'a>(env: &Env) -> (NFTContractClient<'a>, Address) {
    let contract_address = env.register_contract(None, NFTContract);
    let client = NFTContractClient::new(env, &contract_address);
    (client, contract_address)
}

#[test]
fn test_init_contract() {
    let env = Env::default();
    let (client, _) = create_nft_contract(&env);

    let owner = Address::generate(&env);
    let name = String::from_str(&env, "Stellar Wizards");
    let symbol = String::from_str(&env, "SWIZ");
    let uri_base = String::from_str(&env, "https://api.stellarwizards.com/metadata");
    let royalties_bps = 250; // 2.5%

    env.mock_all_auths();

    client.init(&owner, &name, &symbol, &uri_base, &royalties_bps);

    // Verify collection metadata
    let metadata = client.get_collection_metadata();
    assert_eq!(metadata.name, name);
    assert_eq!(metadata.symbol, symbol);
    assert_eq!(metadata.uri_base, uri_base);
    assert_eq!(metadata.royalties_bps, royalties_bps);

    // Verify basic NFT functions
    assert_eq!(client.name(), name);
    assert_eq!(client.symbol(), symbol);
    assert_eq!(client.total_supply(), 0);

    // Verify owner has default admin role
    assert!(client.has_role(&client.default_admin_role(), &owner));
}

#[test]
fn test_set_minter_and_mint() {
    let env = Env::default();
    let (client, _) = create_nft_contract(&env);

    let owner = Address::generate(&env);
    let minter = Address::generate(&env);
    let user = Address::generate(&env);

    env.mock_all_auths();

    // Initialize contract
    client.init(
        &owner,
        &String::from_str(&env, "Test NFTs"),
        &String::from_str(&env, "TEST"),
        &String::from_str(&env, "https://example.com"),
        &100,
    );

    // Set minter
    client.set_minter(&minter);

    // Verify minter has MINTER_ROLE
    assert!(client.has_role(&MINTER_ROLE, &minter));

    // Mint tokens
    let first_token_id = client.mint(&user, &3);
    assert_eq!(first_token_id, 1);

    // Verify minting results
    assert_eq!(client.total_supply(), 3);
    assert_eq!(client.balance_of(&user), 3);
    assert_eq!(client.owner_of(&1), user);
    assert_eq!(client.owner_of(&2), user);
    assert_eq!(client.owner_of(&3), user);
}

#[test]
fn test_mint_without_minter_role_fails() {
    let env = Env::default();
    let (client, _) = create_nft_contract(&env);

    let owner = Address::generate(&env);
    let non_minter = Address::generate(&env);
    let user = Address::generate(&env);

    env.mock_all_auths();

    // Initialize contract
    client.init(
        &owner,
        &String::from_str(&env, "Test NFTs"),
        &String::from_str(&env, "TEST"),
        &String::from_str(&env, "https://example.com"),
        &100,
    );

    // Try to mint without minter role - should fail
    let result = client.try_mint(&user, &1);
    assert!(result.is_err());
}

#[test]
fn test_token_uri() {
    let env = Env::default();
    let (client, _) = create_nft_contract(&env);

    let owner = Address::generate(&env);
    let minter = Address::generate(&env);
    let user = Address::generate(&env);

    env.mock_all_auths();

    let uri_base = String::from_str(&env, "https://api.example.com/metadata");

    // Initialize contract
    client.init(
        &owner,
        &String::from_str(&env, "Test NFTs"),
        &String::from_str(&env, "TEST"),
        &uri_base,
        &100,
    );

    // Set minter and mint a token
    client.set_minter(&minter);
    client.mint(&user, &1);

    // Test token URI generation
    let expected_uri = String::from_str(&env, "https://api.example.com/metadata/1.json");
    assert_eq!(client.token_uri(&1), expected_uri);

    let expected_uri_2 = String::from_str(&env, "https://api.example.com/metadata/42.json");
    assert_eq!(client.token_uri(&42), expected_uri_2);
}

#[test]
fn test_transfer_functionality() {
    let env = Env::default();
    let (client, _) = create_nft_contract(&env);

    let owner = Address::generate(&env);
    let minter = Address::generate(&env);
    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);

    env.mock_all_auths();

    // Initialize and setup
    client.init(
        &owner,
        &String::from_str(&env, "Test NFTs"),
        &String::from_str(&env, "TEST"),
        &String::from_str(&env, "https://example.com"),
        &100,
    );

    client.set_minter(&minter);
    client.mint(&user1, &1);

    // Initial state
    assert_eq!(client.owner_of(&1), user1);
    assert_eq!(client.balance_of(&user1), 1);
    assert_eq!(client.balance_of(&user2), 0);

    // Transfer token
    client.transfer_from(&user1, &user2, &1);

    // Verify transfer
    assert_eq!(client.owner_of(&1), user2);
    assert_eq!(client.balance_of(&user1), 0);
    assert_eq!(client.balance_of(&user2), 1);
}

#[test]
fn test_approval_functionality() {
    let env = Env::default();
    let (client, _) = create_nft_contract(&env);

    let owner = Address::generate(&env);
    let minter = Address::generate(&env);
    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);
    let approved = Address::generate(&env);

    env.mock_all_auths();

    // Initialize and setup
    client.init(
        &owner,
        &String::from_str(&env, "Test NFTs"),
        &String::from_str(&env, "TEST"),
        &String::from_str(&env, "https://example.com"),
        &100,
    );

    client.set_minter(&minter);
    client.mint(&user1, &1);

    // Approve user2 for token 1
    client.approve(&approved, &1);

    // Verify approval
    assert_eq!(client.get_approved(&1), Some(approved.clone()));

    // Test approval for all
    client.set_approval_for_all(&user2, &true);
    assert!(client.is_approved_for_all(&user1, &user2));

    // Revoke approval for all
    client.set_approval_for_all(&user2, &false);
    assert!(!client.is_approved_for_all(&user1, &user2));
}

#[test]
fn test_access_control_functions() {
    let env = Env::default();
    let (client, _) = create_nft_contract(&env);

    let owner = Address::generate(&env);
    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);

    env.mock_all_auths();

    // Initialize contract
    client.init(
        &owner,
        &String::from_str(&env, "Test NFTs"),
        &String::from_str(&env, "TEST"),
        &String::from_str(&env, "https://example.com"),
        &100,
    );

    let admin_role = client.default_admin_role();

    // Owner should have admin role
    assert!(client.has_role(&admin_role, &owner));
    assert!(!client.has_role(&admin_role, &user1));

    // Grant admin role to user1
    client.grant_role(&admin_role, &user1);
    assert!(client.has_role(&admin_role, &user1));

    // Grant minter role to user2
    client.grant_role(&MINTER_ROLE, &user2);
    assert!(client.has_role(&MINTER_ROLE, &user2));

    // Revoke minter role from user2
    client.revoke_role(&MINTER_ROLE, &user2);
    assert!(!client.has_role(&MINTER_ROLE, &user2));

    // Test role admin
    assert_eq!(client.get_role_admin(&MINTER_ROLE), admin_role);
}

#[test]
fn test_royalties() {
    let env = Env::default();
    let (client, _) = create_nft_contract(&env);

    let owner = Address::generate(&env);
    let royalties_bps = 750; // 7.5%

    env.mock_all_auths();

    // Initialize contract with royalties
    client.init(
        &owner,
        &String::from_str(&env, "Test NFTs"),
        &String::from_str(&env, "TEST"),
        &String::from_str(&env, "https://example.com"),
        &royalties_bps,
    );

    // Verify royalties are stored correctly
    assert_eq!(client.get_royalties(), royalties_bps);
}

#[test]
fn test_multiple_mints() {
    let env = Env::default();
    let (client, _) = create_nft_contract(&env);

    let owner = Address::generate(&env);
    let minter = Address::generate(&env);
    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);

    env.mock_all_auths();

    // Initialize and setup
    client.init(
        &owner,
        &String::from_str(&env, "Test NFTs"),
        &String::from_str(&env, "TEST"),
        &String::from_str(&env, "https://example.com"),
        &100,
    );

    client.set_minter(&minter);

    // First mint
    let first_token_id = client.mint(&user1, &3);
    assert_eq!(first_token_id, 1);
    assert_eq!(client.total_supply(), 3);
    assert_eq!(client.balance_of(&user1), 3);

    // Second mint
    let second_token_id = client.mint(&user2, &2);
    assert_eq!(second_token_id, 4);
    assert_eq!(client.total_supply(), 5);
    assert_eq!(client.balance_of(&user2), 2);

    // Verify ownership
    assert_eq!(client.owner_of(&1), user1);
    assert_eq!(client.owner_of(&2), user1);
    assert_eq!(client.owner_of(&3), user1);
    assert_eq!(client.owner_of(&4), user2);
    assert_eq!(client.owner_of(&5), user2);
}