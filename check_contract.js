const { rpc, Address, scValToBigInt, scValToNative } = require('@stellar/stellar-sdk');

async function checkContract() {
  const contractId = 'CCUD6UI4DEVSXIX4YSNFNLK6HEAVXSKBYTQHZ5B6GIATEBYSWMONJM7G';
  const network = 'testnet';

  try {
    const sorobanUrl = 'https://soroban-testnet.stellar.org';
    console.log(`🔍 Checking contract: ${contractId} on ${network}`);

    const sorobanServer = new rpc.Server(sorobanUrl);

    // Get the latest ledger first
    const latestLedger = await sorobanServer.getLatestLedger();
    const ledgerNumber = latestLedger.sequence;
    console.log(`📊 Current ledger: ${ledgerNumber}`);

    // 1. Check contract information
    console.log('\n🏗️ Contract Information:');
    try {
      const contractData = await sorobanServer.getContractData(contractId);
      console.log('Contract data:', JSON.stringify(contractData, null, 2));
    } catch (error) {
      console.log('Could not get contract data:', error.message);
    }

    // 2. Get all events from a wider range (last 200k ledgers)
    const startLedger = Math.max(ledgerNumber - 200000, 1);
    console.log(`\n📦 Searching events from ledger ${startLedger} to ${ledgerNumber}`);

    const allEvents = await sorobanServer.getEvents({
      startLedger,
      filters: [
        {
          type: 'contract',
          contractIds: [contractId]
        }
      ],
      limit: 500
    });

    console.log(`Found ${allEvents.events?.length || 0} total events`);

    if (allEvents.events && allEvents.events.length > 0) {
      console.log('\n📋 All Events:');
      allEvents.events.forEach((event, index) => {
        console.log(`\nEvent ${index + 1}:`);
        console.log(`  - Ledger: ${event.ledger}`);
        console.log(`  - Type: ${event.type}`);
        console.log(`  - Topic: ${JSON.stringify(event.topic)}`);
        console.log(`  - Value: ${JSON.stringify(event.value)}`);
        console.log(`  - Created At: ${event.ledgerClosedAt}`);
      });
    }

    // 3. Try to call common NFT contract methods
    console.log('\n🔧 Trying to call contract methods:');

    // Try to get total supply
    try {
      const totalSupplyResult = await sorobanServer.simulateTransaction({
        method: 'total_supply',
        args: [],
        contractId: contractId
      });
      console.log('Total supply result:', totalSupplyResult);
    } catch (error) {
      console.log('Total supply method not available or failed:', error.message);
    }

    // Try to get owner count
    try {
      const ownerCountResult = await sorobanServer.simulateTransaction({
        method: 'owner_count',
        args: [],
        contractId: contractId
      });
      console.log('Owner count result:', ownerCountResult);
    } catch (error) {
      console.log('Owner count method not available or failed:', error.message);
    }

    // 4. Check for system events (not just contract events)
    console.log('\n🌐 Checking for system events...');
    const systemEvents = await sorobanServer.getEvents({
      startLedger,
      filters: [
        {
          type: 'system',
          contractIds: [contractId]
        }
      ],
      limit: 100
    });

    console.log(`Found ${systemEvents.events?.length || 0} system events`);
    if (systemEvents.events && systemEvents.events.length > 0) {
      systemEvents.events.forEach((event, index) => {
        console.log(`\nSystem Event ${index + 1}:`);
        console.log(`  - Ledger: ${event.ledger}`);
        console.log(`  - Type: ${event.type}`);
        console.log(`  - Topic: ${JSON.stringify(event.topic)}`);
        console.log(`  - Value: ${JSON.stringify(event.value)}`);
      });
    }

    return {
      contractEvents: allEvents.events || [],
      systemEvents: systemEvents.events || []
    };

  } catch (error) {
    console.error('❌ Error checking contract:', error);
    return { contractEvents: [], systemEvents: [] };
  }
}

// Run the function
checkContract()
  .then((result) => {
    console.log(`\n✅ Completed. Found ${result.contractEvents.length} contract events and ${result.systemEvents.length} system events.`);

    if (result.contractEvents.length === 0 && result.systemEvents.length === 0) {
      console.log('\n💡 Suggestions:');
      console.log('  1. The contract might not have any NFTs minted yet');
      console.log('  2. Try checking the contract source code to understand its structure');
      console.log('  3. Look for transaction history instead of events');
      console.log('  4. The contract might use a different event pattern');
    }

    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });