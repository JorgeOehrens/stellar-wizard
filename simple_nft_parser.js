const { rpc } = require('@stellar/stellar-sdk');

async function getNFTCollections() {
  const contractId = 'CCUD6UI4DEVSXIX4YSNFNLK6HEAVXSKBYTQHZ5B6GIATEBYSWMONJM7G';

  try {
    const sorobanUrl = 'https://soroban-testnet.stellar.org';
    const sorobanServer = new rpc.Server(sorobanUrl);

    const latestLedger = await sorobanServer.getLatestLedger();
    const currentLedger = latestLedger.sequence;
    const startLedger = Math.max(currentLedger - 10000, 442466);

    console.log(`🔍 Getting NFT data from contract: ${contractId}`);

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

    const collections = [];

    if (events.events) {
      events.events.forEach((event, index) => {
        // Extract collection ID from the second topic (u128 value)
        const collectionId = event.topic?.[1]?._value?._attributes?.lo?._value;

        // Try to extract collection name from the 4th topic (string)
        let collectionName = 'Unknown Collection';
        if (event.topic?.[3]?._value?.data) {
          try {
            collectionName = Buffer.from(event.topic[3]._value.data).toString('utf8');
          } catch (e) {
            collectionName = `Collection ${collectionId || index + 1}`;
          }
        }

        // Try to extract symbol from the 5th topic (string)
        let symbol = 'UNKN';
        if (event.topic?.[4]?._value?.data) {
          try {
            symbol = Buffer.from(event.topic[4]._value.data).toString('utf8');
          } catch (e) {
            symbol = 'UNKN';
          }
        }

        // Try to extract contract address from the 3rd topic
        let contractAddress = 'Unknown';
        if (event.topic?.[2]?._value?._value?.data) {
          try {
            contractAddress = Buffer.from(event.topic[2]._value._value.data).toString('hex').toUpperCase();
          } catch (e) {
            contractAddress = 'Unknown';
          }
        }

        collections.push({
          id: collectionId || (index + 1).toString(),
          name: collectionName,
          symbol: symbol,
          contractAddress: contractAddress,
          factoryContract: contractId,
          txHash: event.txHash,
          ledger: event.ledger,
          createdAt: event.ledgerClosedAt,
          explorerUrl: `https://stellar.expert/explorer/testnet/tx/${event.txHash}`
        });
      });
    }

    return collections;

  } catch (error) {
    console.error('❌ Error:', error);
    return [];
  }
}

// Run
getNFTCollections()
  .then((collections) => {
    console.log(`\n🎨 EXTRACTED ${collections.length} NFT COLLECTIONS:`);

    if (collections.length > 0) {
      collections.forEach((collection, index) => {
        console.log(`\n${index + 1}. ${collection.name} (${collection.symbol})`);
        console.log(`   Collection ID: ${collection.id}`);
        console.log(`   Contract Address: ${collection.contractAddress.substring(0, 10)}...`);
        console.log(`   Created: ${collection.createdAt}`);
        console.log(`   Explorer: ${collection.explorerUrl}`);
      });

      console.log('\n📋 Complete JSON data:');
      console.log(JSON.stringify(collections, null, 2));

      console.log('\n✅ SUMMARY:');
      console.log(`Found ${collections.length} NFT collections created through this factory contract.`);
      console.log('Each collection is a separate smart contract that can mint individual NFTs.');
      console.log('The contract you provided is an NFT FACTORY that creates NFT collections.');

    } else {
      console.log('❌ No collections found.');
    }
  })
  .catch(console.error);