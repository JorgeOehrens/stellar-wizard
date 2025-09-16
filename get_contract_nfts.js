const { rpc } = require('@stellar/stellar-sdk');

async function getContractNFTs() {
  const contractId = 'CCUD6UI4DEVSXIX4YSNFNLK6HEAVXSKBYTQHZ5B6GIATEBYSWMONJM7G';

  try {
    const sorobanUrl = 'https://soroban-testnet.stellar.org';
    const sorobanServer = new rpc.Server(sorobanUrl);

    // Get current ledger info
    const latestLedger = await sorobanServer.getLatestLedger();
    const currentLedger = latestLedger.sequence;

    // Use the most recent range possible (last 10,000 ledgers)
    const startLedger = Math.max(currentLedger - 10000, 442466);

    console.log(`🔍 Contract: ${contractId}`);
    console.log(`📊 Searching ledgers ${startLedger} to ${currentLedger}`);

    // Get all contract events
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
      console.log('\n❌ No events found for this contract.');
      console.log('\nPossible reasons:');
      console.log('1. Contract hasn\'t been used to mint NFTs');
      console.log('2. NFTs were minted outside the available ledger range');
      console.log('3. Contract uses different event patterns');

      // Try to get transactions instead
      console.log('\n🔍 Trying alternative: Check recent ledgers for contract usage...');

      // Check the last few ledgers for any activity
      for (let i = 0; i < 5; i++) {
        const checkLedger = currentLedger - i;
        try {
          const ledgerEvents = await sorobanServer.getEvents({
            startLedger: checkLedger,
            endLedger: checkLedger,
            filters: [
              {
                type: 'contract',
                contractIds: [contractId]
              }
            ]
          });

          if (ledgerEvents.events && ledgerEvents.events.length > 0) {
            console.log(`📍 Found activity in ledger ${checkLedger}`);
          }
        } catch (e) {
          // Skip errors for individual ledgers
        }
      }

      return [];
    }

    // Process events
    console.log('\n📋 Events found:');
    const nfts = [];

    events.events.forEach((event, index) => {
      console.log(`\n--- Event ${index + 1} ---`);
      console.log(`Ledger: ${event.ledger}`);
      console.log(`TX Hash: ${event.txHash}`);
      console.log(`Contract: ${event.contractId}`);
      console.log(`Type: ${event.type}`);
      console.log(`Time: ${event.ledgerClosedAt}`);

      if (event.topic) {
        console.log(`Topic: ${JSON.stringify(event.topic, null, 2)}`);
      }

      if (event.value) {
        console.log(`Value: ${JSON.stringify(event.value, null, 2)}`);
      }

      // Try to extract NFT-like data
      try {
        const eventStr = JSON.stringify(event);

        // Look for common NFT patterns
        if (eventStr.includes('mint') || eventStr.includes('transfer') || eventStr.includes('token')) {
          console.log('🎯 Potential NFT operation detected!');

          // Try to extract token information
          const numbers = eventStr.match(/\d+/g);
          if (numbers) {
            console.log(`📝 Found numeric values: ${numbers.join(', ')}`);

            // Create NFT-like object
            numbers.forEach(num => {
              nfts.push({
                id: `${contractId}#${num}`,
                contractId: contractId,
                tokenId: num,
                name: `NFT #${num}`,
                txHash: event.txHash,
                ledger: event.ledger,
                createdAt: event.ledgerClosedAt
              });
            });
          }
        }
      } catch (e) {
        console.log('⚠️ Could not parse event data');
      }
    });

    console.log('\n📊 Summary:');
    console.log(`Total events: ${events.events.length}`);
    console.log(`Potential NFTs extracted: ${nfts.length}`);

    if (nfts.length > 0) {
      console.log('\n🎨 Extracted NFTs:');
      nfts.forEach((nft, index) => {
        console.log(`${index + 1}. ${nft.name} (Token ID: ${nft.tokenId})`);
        console.log(`   TX: https://stellar.expert/explorer/testnet/tx/${nft.txHash}`);
      });
    }

    return nfts;

  } catch (error) {
    console.error('❌ Error:', error);
    return [];
  }
}

// Run
getContractNFTs()
  .then((nfts) => {
    if (nfts.length > 0) {
      console.log(`\n✅ Found ${nfts.length} potential NFTs!`);
      console.log('\nJSON output:');
      console.log(JSON.stringify(nfts, null, 2));
    } else {
      console.log('\n❌ No NFTs found in this contract.');
      console.log('\nThe contract at CCUD6UI4DEVSXIX4YSNFNLK6HEAVXSKBYTQHZ5B6GIATEBYSWMONJM7G');
      console.log('appears to have no NFT minting activity in the available ledger range.');
    }
  })
  .catch(console.error);