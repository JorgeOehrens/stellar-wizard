const { rpc } = require('@stellar/stellar-sdk');

async function findNFTs() {
  const contractId = 'CCUD6UI4DEVSXIX4YSNFNLK6HEAVXSKBYTQHZ5B6GIATEBYSWMONJM7G';
  const network = 'testnet';

  try {
    const sorobanUrl = 'https://soroban-testnet.stellar.org';
    console.log(`🔍 Searching for NFTs in contract: ${contractId}`);

    const sorobanServer = new rpc.Server(sorobanUrl);

    // Get valid ledger range
    const latestLedger = await sorobanServer.getLatestLedger();
    const ledgerNumber = latestLedger.sequence;

    // Use valid range (from error message: 442461 - current)
    const startLedger = 442461;
    console.log(`📊 Valid ledger range: ${startLedger} to ${ledgerNumber}`);

    // 1. Get ALL events within valid range
    console.log('\n🔍 Searching for all contract events...');
    const contractEvents = await sorobanServer.getEvents({
      startLedger: startLedger,
      filters: [
        {
          type: 'contract',
          contractIds: [contractId]
        }
      ],
      limit: 1000
    });

    console.log(`📦 Found ${contractEvents.events?.length || 0} contract events`);

    if (contractEvents.events && contractEvents.events.length > 0) {
      console.log('\n📋 Contract Events Found:');
      contractEvents.events.forEach((event, index) => {
        console.log(`\nEvent ${index + 1}:`);
        console.log(`  - Ledger: ${event.ledger}`);
        console.log(`  - Transaction Hash: ${event.txHash}`);
        console.log(`  - Type: ${event.type}`);
        console.log(`  - Contract ID: ${event.contractId}`);
        console.log(`  - Topic: ${JSON.stringify(event.topic, null, 2)}`);
        console.log(`  - Value: ${JSON.stringify(event.value, null, 2)}`);
        console.log(`  - Created At: ${event.ledgerClosedAt}`);

        // Try to parse potential NFT-related data
        if (event.topic || event.value) {
          console.log('  - Possible NFT data:');
          try {
            // Look for patterns that might indicate NFT operations
            const topicStr = JSON.stringify(event.topic);
            const valueStr = JSON.stringify(event.value);

            if (topicStr.includes('mint') || topicStr.includes('transfer') || topicStr.includes('token')) {
              console.log('    🎯 Potential NFT mint/transfer event detected!');
            }

            // Look for numeric IDs that could be token IDs
            const numberMatches = (topicStr + valueStr).match(/\d+/g);
            if (numberMatches) {
              console.log(`    📝 Found numbers (potential token IDs): ${numberMatches.join(', ')}`);
            }
          } catch (e) {
            console.log('    ⚠️ Could not parse event data');
          }
        }
      });

      // Summary
      console.log('\n📊 Summary:');
      console.log(`Total events found: ${contractEvents.events.length}`);

      const uniqueTxHashes = [...new Set(contractEvents.events.map(e => e.txHash))];
      console.log(`Unique transactions: ${uniqueTxHashes.length}`);

      if (uniqueTxHashes.length > 0) {
        console.log('\n🔗 Transaction Hashes:');
        uniqueTxHashes.forEach((hash, index) => {
          console.log(`  ${index + 1}. ${hash}`);
          console.log(`     View: https://stellar.expert/explorer/testnet/tx/${hash}`);
        });
      }

      return contractEvents.events;
    } else {
      console.log('\n❌ No events found for this contract in the valid ledger range.');
      console.log('\nThis means:');
      console.log('  1. No NFTs have been minted from this contract, OR');
      console.log('  2. The contract doesn\'t emit events, OR');
      console.log('  3. The NFTs were created before the available ledger history');

      return [];
    }

  } catch (error) {
    console.error('❌ Error:', error);
    return [];
  }
}

// Run the function
findNFTs()
  .then((events) => {
    if (events.length > 0) {
      console.log(`\n✅ SUCCESS: Found ${events.length} events that might contain NFT data!`);
      console.log('\nNext steps:');
      console.log('1. Check the transaction hashes on Stellar Expert');
      console.log('2. Look at the event data to identify actual NFT tokens');
      console.log('3. Parse the events to extract token IDs and metadata');
    } else {
      console.log('\n🔍 No NFT events found. The contract might:');
      console.log('  - Not have any NFTs minted yet');
      console.log('  - Use a different event structure');
      console.log('  - Store NFT data differently');
    }
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });