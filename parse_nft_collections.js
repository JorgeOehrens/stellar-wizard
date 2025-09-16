const { rpc } = require('@stellar/stellar-sdk');

function parseBuffer(buffer) {
  if (buffer && buffer.data) {
    return Buffer.from(buffer.data).toString('utf8');
  }
  return '';
}

function parseScVal(scVal) {
  if (!scVal) return null;

  switch (scVal._switch?.name) {
    case 'scvString':
      return parseBuffer(scVal._value);
    case 'scvSymbol':
      return parseBuffer(scVal._value);
    case 'scvU128':
      return scVal._value?._attributes?.lo?._value || '0';
    case 'scvAddress':
      if (scVal._arm === 'address' && scVal._value) {
        // Convert contract address to readable format
        const addressData = scVal._value._value || scVal._value;
        if (addressData && addressData.data) {
          return Buffer.from(addressData.data).toString('hex').toUpperCase();
        }
      }
      return 'ADDRESS_PARSE_ERROR';
    default:
      return JSON.stringify(scVal);
  }
}

async function parseNFTCollections() {
  const contractId = 'CCUD6UI4DEVSXIX4YSNFNLK6HEAVXSKBYTQHZ5B6GIATEBYSWMONJM7G';

  try {
    const sorobanUrl = 'https://soroban-testnet.stellar.org';
    const sorobanServer = new rpc.Server(sorobanUrl);

    const latestLedger = await sorobanServer.getLatestLedger();
    const currentLedger = latestLedger.sequence;
    const startLedger = Math.max(currentLedger - 10000, 442466);

    console.log(`🔍 Parsing NFT Collections from contract: ${contractId}`);
    console.log(`📊 Ledger range: ${startLedger} to ${currentLedger}`);

    const events = await sorobanServer.getEvents({
      startLedger: startLedger,
      filters: [
        {
          type: 'contract',
          contractIds: [contractId]
        }
      ],
      limit: 1000
    });

    console.log(`📦 Found ${events.events?.length || 0} events`);

    if (!events.events || events.events.length === 0) {
      return [];
    }

    const collections = [];

    events.events.forEach((event, index) => {
      try {
        console.log(`\n--- Parsing Event ${index + 1} ---`);

        // Check if this is a collection creation event
        const firstTopic = event.topic?.[0];
        const eventType = parseScVal(firstTopic);

        if (eventType === 'col_creat') {
          console.log('✅ Collection creation event detected');

          // Parse the event topics
          const collectionId = parseScVal(event.topic[1]); // u128 ID
          const contractAddress = parseScVal(event.topic[2]); // Contract address
          const collectionName = parseScVal(event.topic[3]); // Collection name
          const collectionSymbol = parseScVal(event.topic[4]); // Collection symbol
          const creatorAddress = parseScVal(event.topic[5]); // Creator address

          // Parse the event value (should contain "CollectionCreated")
          const valueEvent = parseScVal(event.value?._value?.[0]);

          console.log(`Collection ID: ${collectionId}`);
          console.log(`Collection Name: ${collectionName}`);
          console.log(`Collection Symbol: ${collectionSymbol}`);
          console.log(`Contract Address: ${contractAddress}`);
          console.log(`Creator: ${creatorAddress}`);
          console.log(`Event Type: ${valueEvent}`);

          collections.push({
            id: collectionId,
            name: collectionName,
            symbol: collectionSymbol,
            contractAddress: contractAddress,
            creatorAddress: creatorAddress,
            factoryContract: contractId,
            txHash: event.txHash,
            ledger: event.ledger,
            createdAt: event.ledgerClosedAt
          });

        } else {
          console.log(`⚠️ Unknown event type: ${eventType}`);
        }

      } catch (error) {
        console.log(`❌ Error parsing event ${index + 1}:`, error.message);
      }
    });

    return collections;

  } catch (error) {
    console.error('❌ Error:', error);
    return [];
  }
}

// Run
parseNFTCollections()
  .then((collections) => {
    console.log(`\n🎨 FOUND ${collections.length} NFT COLLECTIONS:`);

    if (collections.length > 0) {
      collections.forEach((collection, index) => {
        console.log(`\n${index + 1}. ${collection.name} (${collection.symbol})`);
        console.log(`   Collection ID: ${collection.id}`);
        console.log(`   Contract: ${collection.contractAddress}`);
        console.log(`   Created: ${collection.createdAt}`);
        console.log(`   TX: https://stellar.expert/explorer/testnet/tx/${collection.txHash}`);
      });

      console.log('\n📋 JSON Summary:');
      console.log(JSON.stringify(collections, null, 2));

      console.log('\n💡 IMPORTANT:');
      console.log('These are NFT COLLECTIONS, not individual NFTs.');
      console.log('Each collection is a separate contract that can mint individual NFTs.');
      console.log('To get individual NFTs, you need to query each collection contract.');

    } else {
      console.log('❌ No NFT collections found.');
    }
  })
  .catch(console.error);