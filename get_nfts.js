const { rpc } = require('@stellar/stellar-sdk');

async function fetchNFTsFromContract() {
  const contractId = 'CCUD6UI4DEVSXIX4YSNFNLK6HEAVXSKBYTQHZ5B6GIATEBYSWMONJM7G';
  const network = 'testnet';

  try {
    const sorobanUrl = 'https://soroban-testnet.stellar.org';
    console.log(`🔍 Fetching NFTs from contract: ${contractId} on ${network}`);

    const sorobanServer = new rpc.Server(sorobanUrl);

    // Get the latest ledger to determine a valid range
    const latestLedger = await sorobanServer.getLatestLedger();
    const ledgerNumber = latestLedger.sequence;
    // Use a range of last 100,000 ledgers to catch more events
    const startLedger = Math.max(ledgerNumber - 100000, 1);
    console.log(`📊 Using ledger range: ${startLedger} to ${ledgerNumber}`);

    // Query contract events for NFT minting/creation
    const contractEvents = await sorobanServer.getEvents({
      startLedger,
      filters: [
        {
          type: 'contract',
          contractIds: [contractId]
        }
      ],
      limit: 200
    });

    console.log(`📦 Found ${contractEvents.events?.length || 0} events for contract ${contractId}`);

    if (contractEvents.events && contractEvents.events.length > 0) {
      console.log('\n📋 Event Details:');
      contractEvents.events.forEach((event, index) => {
        console.log(`\nEvent ${index + 1}:`);
        console.log(`  - Ledger: ${event.ledger}`);
        console.log(`  - Type: ${event.type}`);
        console.log(`  - Contract ID: ${event.contractId}`);
        console.log(`  - Topic: ${JSON.stringify(event.topic)}`);
        console.log(`  - Value: ${JSON.stringify(event.value)}`);
        console.log(`  - Tx Hash: ${event.txHash}`);
        console.log(`  - Created At: ${event.ledgerClosedAt}`);
      });
    } else {
      console.log('❌ No events found for this contract.');
      console.log('This could mean:');
      console.log('  - The contract hasn\'t minted any NFTs yet');
      console.log('  - The events are outside the ledger range');
      console.log('  - The contract uses a different event structure');
    }

    return contractEvents.events || [];

  } catch (error) {
    console.error('❌ Error fetching NFTs from contract:', error);
    return [];
  }
}

// Run the function
fetchNFTsFromContract()
  .then((events) => {
    console.log(`\n✅ Completed. Found ${events.length} events.`);
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });