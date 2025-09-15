#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, log, symbol_short, Address, Env, Map, String, Symbol,
};

#[derive(Clone)]
#[contracttype]
pub struct CollectionMetadata {
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub supply: u32,
    pub royalties: u32,
}

#[derive(Clone)]
#[contracttype]
pub struct TokenInfo {
    pub owner: Address,
    pub token_id: u32,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    CollectionMeta,
    Owner,
    Registry,
    NextTokenId,
    TokenOwner(u32),
    Balance(Address),
    TotalMinted,
}

const OWNER: Symbol = symbol_short!("OWNER");
const REGISTRY: Symbol = symbol_short!("REGISTRY");
const COLLECTION: Symbol = symbol_short!("COLLECT");
const NEXT_TOKEN: Symbol = symbol_short!("NEXT_TOK");
const TOTAL_MINTED: Symbol = symbol_short!("TOTAL");

#[contract]
pub struct NFTContract;

#[contractimpl]
impl NFTContract {
    pub fn init(
        env: Env,
        owner: Address,
        name: String,
        symbol: String,
        uri: String,
        supply: u32,
        royalties: u32,
    ) {
        if env.storage().instance().has(&DataKey::Owner) {
            panic!("Contract already initialized");
        }

        if supply == 0 || supply > 10000 {
            panic!("Invalid supply: must be between 1 and 10,000");
        }

        if royalties > 10 {
            panic!("Invalid royalties: must be 10% or less");
        }

        let metadata = CollectionMetadata {
            name: name.clone(),
            symbol: symbol.clone(),
            uri,
            supply,
            royalties,
        };

        env.storage().instance().set(&DataKey::Owner, &owner);
        env.storage().instance().set(&DataKey::CollectionMeta, &metadata);
        env.storage().instance().set(&DataKey::NextTokenId, &1u32);
        env.storage().instance().set(&DataKey::TotalMinted, &0u32);

        log!(
            &env,
            "NFT Contract initialized: {} ({}) with supply {}",
            name,
            symbol,
            supply
        );
    }

    pub fn set_registry(env: Env, registry: Address) {
        let owner: Address = env.storage().instance().get(&DataKey::Owner).unwrap();
        owner.require_auth();

        env.storage().instance().set(&DataKey::Registry, &registry);
        log!(&env, "Registry set to: {}", registry);
    }

    pub fn mint(env: Env, to: Address, amount: u32) -> u32 {
        let registry: Option<Address> = env.storage().instance().get(&DataKey::Registry);
        
        if let Some(registry_addr) = registry {
            registry_addr.require_auth();
        } else {
            let owner: Address = env.storage().instance().get(&DataKey::Owner).unwrap();
            owner.require_auth();
        }

        let metadata: CollectionMetadata = env
            .storage()
            .instance()
            .get(&DataKey::CollectionMeta)
            .unwrap();

        let total_minted: u32 = env
            .storage()
            .instance()
            .get(&DataKey::TotalMinted)
            .unwrap_or(0);

        if total_minted + amount > metadata.supply {
            panic!("Exceeds maximum supply");
        }

        let next_token_id: u32 = env
            .storage()
            .instance()
            .get(&DataKey::NextTokenId)
            .unwrap_or(1);

        let mut current_balance: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::Balance(to.clone()))
            .unwrap_or(0);

        for i in 0..amount {
            let token_id = next_token_id + i;
            env.storage()
                .persistent()
                .set(&DataKey::TokenOwner(token_id), &to);
            current_balance += 1;
        }

        env.storage()
            .persistent()
            .set(&DataKey::Balance(to.clone()), &current_balance);

        env.storage()
            .instance()
            .set(&DataKey::NextTokenId, &(next_token_id + amount));

        env.storage()
            .instance()
            .set(&DataKey::TotalMinted, &(total_minted + amount));

        log!(
            &env,
            "Minted {} NFTs to {}, starting from token ID {}",
            amount,
            to,
            next_token_id
        );

        next_token_id
    }

    pub fn transfer(env: Env, from: Address, to: Address, token_id: u32) {
        from.require_auth();

        let current_owner: Option<Address> = env
            .storage()
            .persistent()
            .get(&DataKey::TokenOwner(token_id));

        match current_owner {
            Some(owner) => {
                if owner != from {
                    panic!("Not owner of token");
                }
            }
            None => panic!("Token does not exist"),
        }

        let mut from_balance: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::Balance(from.clone()))
            .unwrap_or(0);

        let mut to_balance: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::Balance(to.clone()))
            .unwrap_or(0);

        if from_balance == 0 {
            panic!("Insufficient balance");
        }

        from_balance -= 1;
        to_balance += 1;

        env.storage()
            .persistent()
            .set(&DataKey::TokenOwner(token_id), &to);
        env.storage()
            .persistent()
            .set(&DataKey::Balance(from.clone()), &from_balance);
        env.storage()
            .persistent()
            .set(&DataKey::Balance(to.clone()), &to_balance);

        log!(
            &env,
            "Transferred token {} from {} to {}",
            token_id,
            from,
            to
        );
    }

    pub fn balance_of(env: Env, owner: Address) -> u32 {
        env.storage()
            .persistent()
            .get(&DataKey::Balance(owner))
            .unwrap_or(0)
    }

    pub fn owner_of(env: Env, token_id: u32) -> Address {
        env.storage()
            .persistent()
            .get(&DataKey::TokenOwner(token_id))
            .unwrap_or_else(|| panic!("Token does not exist"))
    }

    pub fn get_collection_info(env: Env) -> CollectionMetadata {
        env.storage()
            .instance()
            .get(&DataKey::CollectionMeta)
            .unwrap()
    }

    pub fn get_total_minted(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::TotalMinted)
            .unwrap_or(0)
    }

    pub fn get_next_token_id(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::NextTokenId)
            .unwrap_or(1)
    }

    pub fn get_owner(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Owner)
            .unwrap()
    }

    pub fn get_registry(env: Env) -> Option<Address> {
        env.storage()
            .instance()
            .get(&DataKey::Registry)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Address, Env};

    #[test]
    fn test_init_and_mint() {
        let env = Env::default();
        let contract_id = env.register_contract(None, NFTContract);
        let client = NFTContractClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        let user = Address::generate(&env);

        client.init(
            &owner,
            &String::from_str(&env, "Test NFTs"),
            &String::from_str(&env, "TNFT"),
            &String::from_str(&env, "https://example.com/metadata"),
            &100,
            &5,
        );

        let first_token_id = client.mint(&user, &5);
        assert_eq!(first_token_id, 1);
        assert_eq!(client.balance_of(&user), 5);
        assert_eq!(client.owner_of(&1), user);
        assert_eq!(client.get_total_minted(), 5);
    }

    #[test]
    fn test_transfer() {
        let env = Env::default();
        let contract_id = env.register_contract(None, NFTContract);
        let client = NFTContractClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        let user1 = Address::generate(&env);
        let user2 = Address::generate(&env);

        client.init(
            &owner,
            &String::from_str(&env, "Test NFTs"),
            &String::from_str(&env, "TNFT"),
            &String::from_str(&env, "https://example.com/metadata"),
            &100,
            &5,
        );

        client.mint(&user1, &1);
        assert_eq!(client.owner_of(&1), user1);
        assert_eq!(client.balance_of(&user1), 1);

        client.transfer(&user1, &user2, &1);
        assert_eq!(client.owner_of(&1), user2);
        assert_eq!(client.balance_of(&user1), 0);
        assert_eq!(client.balance_of(&user2), 1);
    }

    #[test]
    #[should_panic(expected = "Exceeds maximum supply")]
    fn test_mint_exceeds_supply() {
        let env = Env::default();
        let contract_id = env.register_contract(None, NFTContract);
        let client = NFTContractClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        let user = Address::generate(&env);

        client.init(
            &owner,
            &String::from_str(&env, "Test NFTs"),
            &String::from_str(&env, "TNFT"),
            &String::from_str(&env, "https://example.com/metadata"),
            &10,
            &5,
        );

        client.mint(&user, &15);
    }
}