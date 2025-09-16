#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env, String};

fn create_registry_contract<'a>(env: &Env, owner: &Address, fee_wallet: &Address) -> Address {
    let contract_id = env.register(StellarWizardRegistry, ());
    let client = StellarWizardRegistryClient::new(env, &contract_id);
    
    // Use 0% fee for tests to avoid token transfer issues
    client.initialize(owner, &0u32, fee_wallet);
    contract_id
}

#[test]
fn test_initialize() {
    let env = Env::default();
    env.mock_all_auths();

    let owner = Address::generate(&env);
    let fee_wallet = Address::generate(&env);
    
    let contract_id = env.register(StellarWizardRegistry, ());
    let client = StellarWizardRegistryClient::new(&env, &contract_id);

    // Test successful initialization
    client.initialize(&owner, &0u32, &fee_wallet);
    
    let config = client.get_config();
    assert_eq!(config.owner, owner);
    assert_eq!(config.fee_bps, 0u32);
    assert_eq!(config.fee_wallet, fee_wallet);
    assert_eq!(config.paused, false);
}

#[test]
#[should_panic(expected = "Contract already initialized")]
fn test_initialize_twice() {
    let env = Env::default();
    env.mock_all_auths();

    let owner = Address::generate(&env);
    let fee_wallet = Address::generate(&env);
    
    let contract_id = env.register(StellarWizardRegistry, ());
    let client = StellarWizardRegistryClient::new(&env, &contract_id);

    client.initialize(&owner, &0u32, &fee_wallet);
    // This should panic
    client.initialize(&owner, &0u32, &fee_wallet);
}

#[test]
fn test_log_and_route() {
    let env = Env::default();
    env.mock_all_auths();

    let owner = Address::generate(&env);
    let fee_wallet = Address::generate(&env);
    let user = Address::generate(&env);
    let token = Address::generate(&env);
    
    let contract_id = create_registry_contract(&env, &owner, &fee_wallet);
    let client = StellarWizardRegistryClient::new(&env, &contract_id);

    let action_id = client.log_and_route(
        &user,
        &ActionType::NFT,
        &String::from_str(&env, "test_hash"),
        &String::from_str(&env, "payload_ref"),
        &String::from_str(&env, "testnet"),
        &10000i128,
        &token,
    );

    assert_eq!(action_id, 1u64);

    // Verify record was created
    let record = client.get_record(&action_id);
    assert_eq!(record.id, 1u64);
    assert_eq!(record.user, user);
    assert_eq!(record.action_type, ActionType::NFT);
    assert_eq!(record.plan_hash, String::from_str(&env, "test_hash"));
    assert_eq!(record.fee_amount, 0i128); // 0% fee in tests
    assert_eq!(record.total_amount, 10000i128);

    // Verify user index was updated
    let user_records = client.get_user_records(&user);
    assert_eq!(user_records.len(), 1);
    assert_eq!(user_records.first().unwrap(), 1u64);
}

#[test]
fn test_append_tx_ref() {
    let env = Env::default();
    env.mock_all_auths();

    let owner = Address::generate(&env);
    let fee_wallet = Address::generate(&env);
    let user = Address::generate(&env);
    let token = Address::generate(&env);
    
    let contract_id = create_registry_contract(&env, &owner, &fee_wallet);
    let client = StellarWizardRegistryClient::new(&env, &contract_id);

    let action_id = client.log_and_route(
        &user,
        &ActionType::DEFI,
        &String::from_str(&env, "test_hash"),
        &String::from_str(&env, "payload_ref"),
        &String::from_str(&env, "testnet"),
        &5000i128,
        &token,
    );

    // Add transaction reference
    client.append_tx_ref(&user, &action_id, &String::from_str(&env, "tx_hash_123"));

    // Verify tx ref was added
    let record = client.get_record(&action_id);
    assert_eq!(record.tx_refs.len(), 1);
    assert_eq!(record.tx_refs.first().unwrap(), String::from_str(&env, "tx_hash_123"));

    // Add another tx ref
    client.append_tx_ref(&user, &action_id, &String::from_str(&env, "tx_hash_456"));
    
    let updated_record = client.get_record(&action_id);
    assert_eq!(updated_record.tx_refs.len(), 2);
}

#[test]
fn test_unauthorized_append_tx_ref() {
    let env = Env::default();
    env.mock_all_auths();

    let owner = Address::generate(&env);
    let fee_wallet = Address::generate(&env);
    let user = Address::generate(&env);
    let other_user = Address::generate(&env);
    let token = Address::generate(&env);
    
    let contract_id = create_registry_contract(&env, &owner, &fee_wallet);
    let client = StellarWizardRegistryClient::new(&env, &contract_id);

    let action_id = client.log_and_route(
        &user,
        &ActionType::NFT,
        &String::from_str(&env, "test_hash"),
        &String::from_str(&env, "payload_ref"),
        &String::from_str(&env, "testnet"),
        &1000i128,
        &token,
    );

    // Try to append tx ref with different user - should fail
    let result = client.try_append_tx_ref(&other_user, &action_id, &String::from_str(&env, "tx_hash"));
    assert_eq!(result, Err(Ok(RegistryError::NotAuthorized)));
}

#[test]
fn test_fee_management() {
    let env = Env::default();
    env.mock_all_auths();

    let owner = Address::generate(&env);
    let fee_wallet = Address::generate(&env);
    let new_fee_wallet = Address::generate(&env);
    
    let contract_id = create_registry_contract(&env, &owner, &fee_wallet);
    let client = StellarWizardRegistryClient::new(&env, &contract_id);

    // Test fee rate update
    client.set_fee_bps(&500u32); // 5%
    let config = client.get_config();
    assert_eq!(config.fee_bps, 500u32);

    // Test fee wallet update
    client.set_fee_wallet(&new_fee_wallet);
    let updated_config = client.get_config();
    assert_eq!(updated_config.fee_wallet, new_fee_wallet);
}

#[test]
fn test_invalid_fee_rate() {
    let env = Env::default();
    env.mock_all_auths();

    let owner = Address::generate(&env);
    let fee_wallet = Address::generate(&env);
    
    let contract_id = create_registry_contract(&env, &owner, &fee_wallet);
    let client = StellarWizardRegistryClient::new(&env, &contract_id);

    // Try to set fee rate above maximum (10%)
    let result = client.try_set_fee_bps(&1500u32);
    assert_eq!(result, Err(Ok(RegistryError::InvalidFeeRate)));
}

#[test]
fn test_pause_functionality() {
    let env = Env::default();
    env.mock_all_auths();

    let owner = Address::generate(&env);
    let fee_wallet = Address::generate(&env);
    let user = Address::generate(&env);
    let token = Address::generate(&env);
    
    let contract_id = create_registry_contract(&env, &owner, &fee_wallet);
    let client = StellarWizardRegistryClient::new(&env, &contract_id);

    // Pause the contract
    client.set_paused(&true);
    
    let config = client.get_config();
    assert_eq!(config.paused, true);

    // Try to log action while paused - should fail
    let result = client.try_log_and_route(
        &user,
        &ActionType::NFT,
        &String::from_str(&env, "test_hash"),
        &String::from_str(&env, "payload_ref"),
        &String::from_str(&env, "testnet"),
        &1000i128,
        &token,
    );
    assert_eq!(result, Err(Ok(RegistryError::ContractPaused)));

    // Unpause and try again
    client.set_paused(&false);
    let action_id = client.log_and_route(
        &user,
        &ActionType::NFT,
        &String::from_str(&env, "test_hash"),
        &String::from_str(&env, "payload_ref"),
        &String::from_str(&env, "testnet"),
        &1000i128,
        &token,
    );
    assert_eq!(action_id, 1u64);
}

#[test]
fn test_ownership_transfer() {
    let env = Env::default();
    env.mock_all_auths();

    let owner = Address::generate(&env);
    let fee_wallet = Address::generate(&env);
    let new_owner = Address::generate(&env);
    
    let contract_id = create_registry_contract(&env, &owner, &fee_wallet);
    let client = StellarWizardRegistryClient::new(&env, &contract_id);

    // Transfer ownership
    client.transfer_ownership(&new_owner);
    
    let config = client.get_config();
    assert_eq!(config.owner, new_owner);
}

#[test]
fn test_get_records_range() {
    let env = Env::default();
    env.mock_all_auths();

    let owner = Address::generate(&env);
    let fee_wallet = Address::generate(&env);
    let user = Address::generate(&env);
    let token = Address::generate(&env);
    
    let contract_id = create_registry_contract(&env, &owner, &fee_wallet);
    let client = StellarWizardRegistryClient::new(&env, &contract_id);

    // Create multiple records
    client.log_and_route(
        &user,
        &ActionType::NFT,
        &String::from_str(&env, "hash_1"),
        &String::from_str(&env, "payload_ref"),
        &String::from_str(&env, "testnet"),
        &1000i128,
        &token,
    );
    client.log_and_route(
        &user,
        &ActionType::NFT,
        &String::from_str(&env, "hash_2"),
        &String::from_str(&env, "payload_ref"),
        &String::from_str(&env, "testnet"),
        &2000i128,
        &token,
    );
    client.log_and_route(
        &user,
        &ActionType::NFT,
        &String::from_str(&env, "hash_3"),
        &String::from_str(&env, "payload_ref"),
        &String::from_str(&env, "testnet"),
        &3000i128,
        &token,
    );
    client.log_and_route(
        &user,
        &ActionType::NFT,
        &String::from_str(&env, "hash_4"),
        &String::from_str(&env, "payload_ref"),
        &String::from_str(&env, "testnet"),
        &4000i128,
        &token,
    );
    client.log_and_route(
        &user,
        &ActionType::NFT,
        &String::from_str(&env, "hash_5"),
        &String::from_str(&env, "payload_ref"),
        &String::from_str(&env, "testnet"),
        &5000i128,
        &token,
    );

    // Test range query
    let records = client.get_records_range(&2u64, &3u32);
    assert_eq!(records.len(), 3);
    assert_eq!(records.get(0).unwrap().id, 2u64);
    assert_eq!(records.get(1).unwrap().id, 3u64);
    assert_eq!(records.get(2).unwrap().id, 4u64);

    // Test total records
    let total = client.get_total_records();
    assert_eq!(total, 5u64);
}

#[test]
fn test_zero_amount_rejected() {
    let env = Env::default();
    env.mock_all_auths();

    let owner = Address::generate(&env);
    let fee_wallet = Address::generate(&env);
    let user = Address::generate(&env);
    let token = Address::generate(&env);
    
    let contract_id = create_registry_contract(&env, &owner, &fee_wallet);
    let client = StellarWizardRegistryClient::new(&env, &contract_id);

    // Try to log action with zero amount - should fail
    let result = client.try_log_and_route(
        &user,
        &ActionType::NFT,
        &String::from_str(&env, "test_hash"),
        &String::from_str(&env, "payload_ref"),
        &String::from_str(&env, "testnet"),
        &0i128,
        &token,
    );
    assert_eq!(result, Err(Ok(RegistryError::InvalidAmount)));
}