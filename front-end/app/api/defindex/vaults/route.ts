import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/defindex/vaults
 * Returns the DeFindex vaults data for analysis
 */
export async function GET(request: NextRequest) {
  try {
    // Get network from query parameter, default to mainnet
    const { searchParams } = new URL(request.url);
    const network = searchParams.get('network') || 'mainnet';

    // Real mainnet vault data provided by user
    const mainnetVaultData = {
      "data": {
        "deFindexVaults": {
          "nodes": [
            {
              "vault": "CBNKCU3HGFKHFOF7JTGXQCNKE3G3DXS5RDBQUKQMIIECYKXPIOUGB2S3",
              "totalManagedFundsBefore": "{\"asset\":\"CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75\",\"idle_amount\":\"0\",\"invested_amount\":\"3947586213424\",\"strategy_allocations\":[{\"amount\":\"0\",\"paused\":false,\"strategy_address\":\"CDB2WMKQQNVZMEBY7Q7GZ5C7E7IAFSNMZ7GGVD6WKTCEWK7XOIAVZSAP\"},{\"amount\":\"3947586213424\",\"paused\":false,\"strategy_address\":\"CCSRX5E4337QMCMC3KO3RDFYI57T5NZV5XB3W3TWE4USCASKGL5URKJL\"}],\"total_amount\":\"3947586213424\"}",
              "totalSupplyBefore": "3815786978098"
            },
            {
              "vault": "CBGC65JVYZZTGPVHURM32GFMMTUQJZVRTB6QAQDLNP4FG3LVFS5XJ7L2",
              "totalManagedFundsBefore": "{\"asset\":\"CDTKPWPLOURQA2SGTKTUQOWRCBZEORB4BWBOMJ3D3ZTQQSGE5F6JBQLV\",\"idle_amount\":\"0\",\"invested_amount\":\"0\",\"strategy_allocations\":[{\"amount\":\"0\",\"paused\":false,\"strategy_address\":\"CA33NXYN7H3EBDSA3U2FPSULGJTTL3FQRHD2ADAAPTKS3FUJOE73735A\"},{\"amount\":\"0\",\"paused\":false,\"strategy_address\":\"CC5CE6MWISDXT3MLNQ7R3FVILFVFEIH3COWGH45GJKL6BD2ZHF7F7JVI\"}],\"total_amount\":\"0\"}",
              "totalSupplyBefore": "0"
            },
            {
              "vault": "CAIZ3NMNPEN5SQISJV7PD2YY6NI6DIPFA4PCRUBOGDE4I7A3DXDLK5OI",
              "totalManagedFundsBefore": "{\"asset\":\"CDTKPWPLOURQA2SGTKTUQOWRCBZEORB4BWBOMJ3D3ZTQQSGE5F6JBQLV\",\"idle_amount\":\"0\",\"invested_amount\":\"1394372678474\",\"strategy_allocations\":[{\"amount\":\"0\",\"paused\":false,\"strategy_address\":\"CC5CE6MWISDXT3MLNQ7R3FVILFVFEIH3COWGH45GJKL6BD2ZHF7F7JVI\"},{\"amount\":\"1394372678474\",\"paused\":false,\"strategy_address\":\"CA33NXYN7H3EBDSA3U2FPSULGJTTL3FQRHD2ADAAPTKS3FUJOE73735A\"}],\"total_amount\":\"1394372678474\"}",
              "totalSupplyBefore": "1358165225423"
            },
            {
              "vault": "CA5RG7DCLMNJFRMG3LP2VDUBWCZ4QTZ776VCEQKWBPGDUAJAT26K2OXM",
              "totalManagedFundsBefore": "{\"asset\":\"CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA\",\"idle_amount\":\"50000000\",\"invested_amount\":\"0\",\"strategy_allocations\":[{\"amount\":\"0\",\"paused\":false,\"strategy_address\":\"CDPWNUW7UMCSVO36VAJSQHQECISPJLCVPDASKHRC5SEROAAZDUQ5DG2Z\"}],\"total_amount\":\"50000000\"}",
              "totalSupplyBefore": "50000000"
            },
            {
              "vault": "CB3LKO733H3STIDCKWY4H25FH426HA7WSERMJ3CZBQTKPOESKZ7LGOWA",
              "totalManagedFundsBefore": "{\"asset\":\"CDTKPWPLOURQA2SGTKTUQOWRCBZEORB4BWBOMJ3D3ZTQQSGE5F6JBQLV\",\"idle_amount\":\"0\",\"invested_amount\":\"0\",\"strategy_allocations\":[{\"amount\":\"0\",\"paused\":false,\"strategy_address\":\"CA33NXYN7H3EBDSA3U2FPSULGJTTL3FQRHD2ADAAPTKS3FUJOE73735A\"},{\"amount\":\"0\",\"paused\":false,\"strategy_address\":\"CC5CE6MWISDXT3MLNQ7R3FVILFVFEIH3COWGH45GJKL6BD2ZHF7F7JVI\"}],\"total_amount\":\"0\"}",
              "totalSupplyBefore": "0"
            },
            {
              "vault": "CCFWKCD52JNSQLN5OS4F7EG6BPDT4IRJV6KODIEIZLWPM35IKHOKT6S2",
              "totalManagedFundsBefore": "{\"asset\":\"CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75\",\"idle_amount\":\"1000000\",\"invested_amount\":\"0\",\"strategy_allocations\":[{\"amount\":\"0\",\"paused\":false,\"strategy_address\":\"CDB2WMKQQNVZMEBY7Q7GZ5C7E7IAFSNMZ7GGVD6WKTCEWK7XOIAVZSAP\"},{\"amount\":\"0\",\"paused\":false,\"strategy_address\":\"CCSRX5E4337QMCMC3KO3RDFYI57T5NZV5XB3W3TWE4USCASKGL5URKJL\"}],\"total_amount\":\"1000000\"}",
              "totalSupplyBefore": "1000000"
            },
            {
              "vault": "CCLJFYWNVMNLF3TFO2AJMYFGMI2EBP5U3BWPOL437IKGHNUJYOWIHTV3",
              "totalManagedFundsBefore": "{\"asset\":\"CDTKPWPLOURQA2SGTKTUQOWRCBZEORB4BWBOMJ3D3ZTQQSGE5F6JBQLV\",\"idle_amount\":\"1000000\",\"invested_amount\":\"0\",\"strategy_allocations\":[{\"amount\":\"0\",\"paused\":false,\"strategy_address\":\"CC5CE6MWISDXT3MLNQ7R3FVILFVFEIH3COWGH45GJKL6BD2ZHF7F7JVI\"},{\"amount\":\"0\",\"paused\":false,\"strategy_address\":\"CA33NXYN7H3EBDSA3U2FPSULGJTTL3FQRHD2ADAAPTKS3FUJOE73735A\"}],\"total_amount\":\"1000000\"}",
              "totalSupplyBefore": "1000000"
            },
            {
              "vault": "CBDZYJVQJQT7QJ7ZTMGNGZ7RR3DF32LERLZ26A2HLW5FNJ4OOZCLI3OG",
              "totalManagedFundsBefore": "{\"asset\":\"CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75\",\"idle_amount\":\"0\",\"invested_amount\":\"112395766\",\"strategy_allocations\":[{\"amount\":\"0\",\"paused\":false,\"strategy_address\":\"CDB2WMKQQNVZMEBY7Q7GZ5C7E7IAFSNMZ7GGVD6WKTCEWK7XOIAVZSAP\"},{\"amount\":\"112395766\",\"paused\":false,\"strategy_address\":\"CCSRX5E4337QMCMC3KO3RDFYI57T5NZV5XB3W3TWE4USCASKGL5URKJL\"}],\"total_amount\":\"112395766\"}",
              "totalSupplyBefore": "108393142"
            }
          ]
        }
      }
    };

    // Testnet vault data (smaller set for testing)
    const testnetVaultData = {
      "data": {
        "deFindexVaults": {
          "nodes": [
            {
              "vault": "CC767WIU5QGJMXYHDDYJAJEF2YWPHOXOZDWD3UUAZVS4KQPRXCKPT2YZ",
              "totalManagedFundsBefore": "{\"asset\":\"CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75\",\"idle_amount\":\"30000001\",\"invested_amount\":\"60005917\",\"strategy_allocations\":[{\"amount\":\"0\",\"paused\":false,\"strategy_address\":\"CDB2WMKQQNVZMEBY7Q7GZ5C7E7IAFSNMZ7GGVD6WKTCEWK7XOIAVZSAP\"},{\"amount\":\"60005917\",\"paused\":false,\"strategy_address\":\"CCSRX5E4337QMCMC3KO3RDFYI57T5NZV5XB3W3TWE4USCASKGL5URKJL\"}],\"total_amount\":\"90005918\"}",
              "totalSupplyBefore": "17999859"
            },
            {
              "vault": "CAIZ3NMNPEN5SQISJV7PD2YY6NI6DIPFA4PCRUBOGDE4I7A3DXDLK5OI",
              "totalManagedFundsBefore": "{\"asset\":\"CDTKPWPLOURQA2SGTKTUQOWRCBZEORB4BWBOMJ3D3ZTQQSGE5F6JBQLV\",\"idle_amount\":\"0\",\"invested_amount\":\"1394372678474\",\"strategy_allocations\":[{\"amount\":\"0\",\"paused\":false,\"strategy_address\":\"CC5CE6MWISDXT3MLNQ7R3FVILFVFEIH3COWGH45GJKL6BD2ZHF7F7JVI\"},{\"amount\":\"1394372678474\",\"paused\":false,\"strategy_address\":\"CA33NXYN7H3EBDSA3U2FPSULGJTTL3FQRHD2ADAAPTKS3FUJOE73735A\"}],\"total_amount\":\"1394372678474\"}",
              "totalSupplyBefore": "1358165225423"
            }
          ]
        }
      }
    };

    // Return appropriate data based on network
    const vaultData = network === 'testnet' ? testnetVaultData : mainnetVaultData;

    return NextResponse.json(vaultData);
  } catch (error) {
    console.error('Error fetching vault data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vault data' },
      { status: 500 }
    );
  }
}