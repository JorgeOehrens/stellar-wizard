#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, contracterror, contractmeta,
    Address, Env, String, Vec, log, symbol_short,
    token,
};

mod test;

// Metadata
contractmeta!(
    key = "Description",
    val = "Stellar Wizard Registry - Track and route NFT/DeFi operations with commission"
);

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum RegistryError {
    NotAuthorized = 1,
    InvalidAmount = 2,
    InvalidAddress = 3,
    RecordNotFound = 4,
    ContractPaused = 5,
    InvalidFeeRate = 6,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ActionType {
    NFT,
    DEFI,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ActionRecord {
    pub id: u64,
    pub user: Address,
    pub action_type: ActionType,
    pub plan_hash: String,
    pub payload_ref: String,
    pub timestamp: u64,
    pub network: String,
    pub tx_refs: Vec<String>,
    pub fee_amount: i128,
    pub total_amount: i128,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Config {
    pub owner: Address,
    pub fee_bps: u32,        // basis points (200 = 2%)
    pub fee_wallet: Address,
    pub paused: bool,
}

#[contracttype]
pub enum DataKey {
    Config,
    NextId,
    Record(u64),
    UserRecords(Address),
}

const MAX_FEE_BPS: u32 = 1000; // 10% maximum fee

#[contract]
pub struct StellarWizardRegistry;

#[contractimpl]
impl StellarWizardRegistry {
    /// Initialize the contract with owner and fee configuration
    pub fn initialize(
        env: Env,
        owner: Address,
        fee_bps: u32,
        fee_wallet: Address,
    ) -> Result<(), RegistryError> {
        if env.storage().instance().has(&DataKey::Config) {
            panic!("Contract already initialized");
        }

        if fee_bps > MAX_FEE_BPS {
            return Err(RegistryError::InvalidFeeRate);
        }

        let config = Config {
            owner: owner.clone(),
            fee_bps,
            fee_wallet,
            paused: false,
        };

        env.storage().instance().set(&DataKey::Config, &config);
        env.storage().instance().set(&DataKey::NextId, &1u64);

        log!(
            &env,
            "Registry initialized with owner: {:?}, fee_bps: {}, fee_wallet: {:?}",
            owner,
            fee_bps,
            config.fee_wallet
        );

        Ok(())
    }

    /// Log an action and route with commission (main function)
    pub fn log_and_route(
        env: Env,
        user: Address,
        action_type: ActionType,
        plan_hash: String,
        payload_ref: String,
        network: String,
        total_amount: i128,
        token_address: Address,
    ) -> Result<u64, RegistryError> {
        let config = Self::get_config(&env)?;
        
        if config.paused {
            return Err(RegistryError::ContractPaused);
        }

        // Require user authorization
        user.require_auth();

        if total_amount <= 0 {
            return Err(RegistryError::InvalidAmount);
        }

        // Calculate fee
        let fee_amount = (total_amount * config.fee_bps as i128) / 10000i128;
        
        // Get next ID
        let id = env.storage().instance().get(&DataKey::NextId).unwrap_or(1u64);
        env.storage().instance().set(&DataKey::NextId, &(id + 1));

        // Create record
        let record = ActionRecord {
            id,
            user: user.clone(),
            action_type: action_type.clone(),
            plan_hash: plan_hash.clone(),
            payload_ref,
            timestamp: env.ledger().timestamp(),
            network,
            tx_refs: Vec::new(&env),
            fee_amount,
            total_amount,
        };

        // Store record
        env.storage().persistent().set(&DataKey::Record(id), &record);
        
        // Update user index
        let mut user_records: Vec<u64> = env.storage()
            .persistent()
            .get(&DataKey::UserRecords(user.clone()))
            .unwrap_or(Vec::new(&env));
        user_records.push_back(id);
        env.storage().persistent().set(&DataKey::UserRecords(user.clone()), &user_records);

        // Transfer fee if amount > 0
        if fee_amount > 0 {
            let token_client = token::Client::new(&env, &token_address);
            token_client.transfer(&user, &config.fee_wallet, &fee_amount);

            // Emit fee paid event
            env.events().publish(
                (symbol_short!("fee_paid"),),
                (id, config.fee_wallet.clone(), fee_amount)
            );
        }

        // Emit action logged event
        env.events().publish(
            (symbol_short!("action"),),
            (id, user, action_type, plan_hash, fee_amount)
        );

        log!(&env, "Action logged with ID: {}, fee: {}", id, fee_amount);

        Ok(id)
    }

    /// Append transaction reference after execution
    pub fn append_tx_ref(
        env: Env,
        user: Address,
        id: u64,
        tx_ref: String,
    ) -> Result<(), RegistryError> {
        user.require_auth();

        let mut record: ActionRecord = env.storage()
            .persistent()
            .get(&DataKey::Record(id))
            .ok_or(RegistryError::RecordNotFound)?;

        // Verify user owns this record
        if record.user != user {
            return Err(RegistryError::NotAuthorized);
        }

        record.tx_refs.push_back(tx_ref.clone());
        env.storage().persistent().set(&DataKey::Record(id), &record);

        log!(&env, "TX ref added to record {}: {}", id, tx_ref);

        Ok(())
    }

    /// Get a specific record by ID
    pub fn get_record(env: Env, id: u64) -> Result<ActionRecord, RegistryError> {
        env.storage()
            .persistent()
            .get(&DataKey::Record(id))
            .ok_or(RegistryError::RecordNotFound)
    }

    /// Get all record IDs for a user
    pub fn get_user_records(env: Env, user: Address) -> Vec<u64> {
        env.storage()
            .persistent()
            .get(&DataKey::UserRecords(user))
            .unwrap_or(Vec::new(&env))
    }

    /// Get contract configuration
    pub fn get_config(env: &Env) -> Result<Config, RegistryError> {
        env.storage()
            .instance()
            .get(&DataKey::Config)
            .ok_or(RegistryError::RecordNotFound)
    }

    /// Update fee rate (owner only)
    pub fn set_fee_bps(env: Env, fee_bps: u32) -> Result<(), RegistryError> {
        let mut config = Self::get_config(&env)?;
        config.owner.require_auth();

        if fee_bps > MAX_FEE_BPS {
            return Err(RegistryError::InvalidFeeRate);
        }

        config.fee_bps = fee_bps;
        env.storage().instance().set(&DataKey::Config, &config);

        log!(&env, "Fee rate updated to {} bps", fee_bps);

        Ok(())
    }

    /// Update fee wallet (owner only)
    pub fn set_fee_wallet(env: Env, fee_wallet: Address) -> Result<(), RegistryError> {
        let mut config = Self::get_config(&env)?;
        config.owner.require_auth();

        config.fee_wallet = fee_wallet.clone();
        env.storage().instance().set(&DataKey::Config, &config);

        log!(&env, "Fee wallet updated to: {:?}", fee_wallet);

        Ok(())
    }

    /// Pause contract (owner only)
    pub fn set_paused(env: Env, paused: bool) -> Result<(), RegistryError> {
        let mut config = Self::get_config(&env)?;
        config.owner.require_auth();

        config.paused = paused;
        env.storage().instance().set(&DataKey::Config, &config);

        log!(&env, "Contract paused status: {}", paused);

        Ok(())
    }

    /// Transfer ownership (owner only)
    pub fn transfer_ownership(env: Env, new_owner: Address) -> Result<(), RegistryError> {
        let mut config = Self::get_config(&env)?;
        config.owner.require_auth();

        config.owner = new_owner.clone();
        env.storage().instance().set(&DataKey::Config, &config);

        log!(&env, "Ownership transferred to: {:?}", new_owner);

        Ok(())
    }

    /// Get total number of records
    pub fn get_total_records(env: &Env) -> u64 {
        env.storage().instance().get(&DataKey::NextId).unwrap_or(1u64) - 1
    }

    /// Get records in range (for pagination)
    pub fn get_records_range(env: Env, start: u64, limit: u32) -> Vec<ActionRecord> {
        let mut records = Vec::new(&env);
        let max_records = Self::get_total_records(&env);
        let end = if limit == 0 { max_records } else { start + limit as u64 - 1 };
        let actual_end = if end > max_records { max_records } else { end };

        for id in start..=actual_end {
            if let Ok(record) = Self::get_record(env.clone(), id) {
                records.push_back(record);
            }
        }

        records
    }
}