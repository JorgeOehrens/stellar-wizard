import { NextRequest, NextResponse } from 'next/server';
import {
  parseVaultData,
  extractVaultFeatures,
  clusterVaults,
  recommendVaults,
  UserRiskProfile,
  VaultData,
  calculateProjections
} from '@/lib/vault-analysis';
import {
  ChosenVault,
  ApiCall,
  InvestmentSummary,
  FallbackPolicy,
  normalizeVault,
  getStellarExpertLink,
  toBaseUnits,
  toHumanUnits,
  getAssetSymbol
} from '@/lib/vault-types';

export interface RecommendAndProjectRequest {
  amountBase: string;
  risk: 'Conservative' | 'Balanced' | 'Aggressive';
  horizonMonths: 6 | 12 | 18 | 24;
  network: 'testnet' | 'mainnet';
  liquidityNeeds?: 'Low' | 'Medium' | 'High';
  experienceLevel?: 'Beginner' | 'Intermediate' | 'Advanced';
}

export interface RecommendAndProjectResponse {
  vault: ChosenVault;
  projection: Array<{
    months: number;
    amountHuman: string;
    amountBase: string;
  }>;
  apiCalls: ApiCall[];
  success: boolean;
  fallbackUsed?: string;
}

/**
 * POST /api/defindex/recommend-and-project
 * Combined vault recommendation and projection with guaranteed vault selection
 */
export async function POST(request: NextRequest) {
  const apiCalls: ApiCall[] = [];
  let fallbackPolicy: FallbackPolicy = { step: 'lower_constraints', attempted: false };

  try {
    const body: RecommendAndProjectRequest = await request.json();

    // Validate required fields
    if (!body.amountBase || !body.risk || !body.horizonMonths || !body.network) {
      return NextResponse.json(
        { error: 'Missing required fields: amountBase, risk, horizonMonths, network' },
        { status: 400 }
      );
    }

    const amountHuman = toHumanUnits(body.amountBase);

    // Step 1: Fetch vault data
    apiCalls.push({
      method: 'GET',
      path: '/api/defindex/vaults',
      purpose: 'Fetch vault universe (cached JSON)',
      status: 'completed'
    });

    const vaultData = await getVaultData(body.network);
    const parsedVaults = parseVaultData(vaultData);
    const features = extractVaultFeatures(parsedVaults);
    const clusters = clusterVaults(features);

    // Step 2: Attempt primary recommendation
    apiCalls.push({
      method: 'POST',
      path: '/api/defindex/recommend',
      purpose: 'Cluster & score vaults from user profile; returns vaultId + rationale',
      status: 'completed'
    });

    let chosenVault: ChosenVault | null = null;
    let fallbackUsed: string | undefined;

    // Primary recommendation attempt
    const userProfile: UserRiskProfile = {
      riskTolerance: body.risk,
      liquidityNeeds: body.liquidityNeeds || 'Medium',
      timeHorizon: body.horizonMonths,
      experienceLevel: body.experienceLevel || 'Intermediate'
    };

    let recommendations = recommendVaults(features, clusters, userProfile, 3);

    // Execute fallback policy if no recommendations
    if (recommendations.length === 0) {
      // Fallback 1: Lower constraints (widen risk tolerance)
      fallbackPolicy.attempted = true;
      const relaxedProfile = { ...userProfile };

      if (body.risk === 'Conservative') {
        relaxedProfile.riskTolerance = 'Balanced';
      } else if (body.risk === 'Aggressive') {
        relaxedProfile.riskTolerance = 'Balanced';
      }

      recommendations = recommendVaults(features, clusters, relaxedProfile, 3);
      if (recommendations.length > 0) {
        fallbackUsed = `Widened risk tolerance from ${body.risk} to Balanced`;
      }
    }

    if (recommendations.length === 0) {
      // Fallback 2: Top TVL stable asset vault
      const stableVaults = features.filter(f => f.assetStability > 0.5 && f.tvl > 0)
        .sort((a, b) => b.tvl - a.tvl);

      if (stableVaults.length > 0) {
        const topStableVault = stableVaults[0];
        const vaultRawData = vaultData.find(v => v.vault === topStableVault.vaultAddress);
        if (vaultRawData) {
          const parsedData = JSON.parse(vaultRawData.totalManagedFundsBefore);
          chosenVault = normalizeVault(
            vaultRawData,
            parsedData,
            'Conservative',
            6, // Conservative APY
            'Fallback: Top TVL stable asset vault selected for safety',
            body.network
          );
          fallbackUsed = 'Selected top TVL stable asset vault as fallback';
        }
      }
    } else {
      // Use primary recommendation
      const rec = recommendations[0];
      const vaultRawData = vaultData.find(v => v.vault === rec.vaultAddress);
      if (vaultRawData) {
        const parsedData = JSON.parse(vaultRawData.totalManagedFundsBefore);
        chosenVault = normalizeVault(
          vaultRawData,
          parsedData,
          rec.riskLevel,
          rec.estimatedApy,
          rec.rationale,
          body.network
        );
      }
    }

    // Final fallback: Error if still no vault
    if (!chosenVault) {
      return NextResponse.json({
        error: 'No suitable vaults found',
        fallbackOptions: [
          'Try Balanced risk tolerance',
          'Use top TVL stable vault',
          'See all available vaults'
        ],
        apiCalls
      }, { status: 404 });
    }

    // Step 3: Calculate projections
    apiCalls.push({
      method: 'POST',
      path: '/api/defindex/project',
      purpose: 'Compute 6/12/18/24-month projections from assumedApy',
      status: 'completed'
    });

    const projectionInput = {
      principal: amountHuman,
      apy: chosenVault.assumedApy,
      months: 24 // Get all projections up to 24 months
    };

    const projectionResults = calculateProjections(projectionInput);

    // Format projections for response
    const projections = projectionResults.map(proj => ({
      months: proj.months,
      amountHuman: `${proj.balance.toFixed(2)} ${getAssetSymbol(chosenVault.assetId)}`,
      amountBase: toBaseUnits(proj.balance)
    }));

    const response: RecommendAndProjectResponse = {
      vault: chosenVault,
      projection: projections,
      apiCalls,
      success: true,
      fallbackUsed
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error in recommend-and-project:', error);

    // Add failed API call
    apiCalls.push({
      method: 'ERROR',
      path: '/api/defindex/recommend-and-project',
      purpose: 'Combined recommendation failed',
      status: 'failed'
    });

    return NextResponse.json({
      error: 'Failed to generate vault recommendation',
      apiCalls,
      success: false
    }, { status: 500 });
  }
}

async function getVaultData(network: string = 'mainnet'): Promise<VaultData[]> {
  // Fetch vault data from the vaults endpoint
  try {
    const port = process.env.PORT || '3000';
    const baseUrl = process.env.BASE_URL || `http://localhost:${port}`;

    const response = await fetch(`${baseUrl}/api/defindex/vaults?network=${network}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch vault data: ${response.status}`);
    }

    const data = await response.json();
    return data.data.deFindexVaults.nodes;
  } catch (error) {
    console.error('Error fetching vault data:', error);
    // Fallback to local data if fetch fails
    return [
    {
      "vault": "CBNKCU3HGFKHFOF7JTGXQCNKE3G3DXS5RDBQUKQMIIECYKXPIOUGB2S3",
      "totalManagedFundsBefore": "{\"asset\":\"CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75\",\"idle_amount\":\"0\",\"invested_amount\":\"3947586213424\",\"strategy_allocations\":[{\"amount\":\"0\",\"paused\":false,\"strategy_address\":\"CDB2WMKQQNVZMEBY7Q7GZ5C7E7IAFSNMZ7GGVD6WKTCEWK7XOIAVZSAP\"},{\"amount\":\"3947586213424\",\"paused\":false,\"strategy_address\":\"CCSRX5E4337QMCMC3KO3RDFYI57T5NZV5XB3W3TWE4USCASKGL5URKJL\"}],\"total_amount\":\"3947586213424\"}",
      "totalSupplyBefore": "3815786978098"
    },
    {
      "vault": "CAIZ3NMNPEN5SQISJV7PD2YY6NI6DIPFA4PCRUBOGDE4I7A3DXDLK5OI",
      "totalManagedFundsBefore": "{\"asset\":\"CDTKPWPLOURQA2SGTKTUQOWRCBZEORB4BWBOMJ3D3ZTQQSGE5F6JBQLV\",\"idle_amount\":\"0\",\"invested_amount\":\"1394372678474\",\"strategy_allocations\":[{\"amount\":\"0\",\"paused\":false,\"strategy_address\":\"CC5CE6MWISDXT3MLNQ7R3FVILFVFEIH3COWGH45GJKL6BD2ZHF7F7JVI\"},{\"amount\":\"1394372678474\",\"paused\":false,\"strategy_address\":\"CA33NXYN7H3EBDSA3U2FPSULGJTTL3FQRHD2ADAAPTKS3FUJOE73735A\"}],\"total_amount\":\"1394372678474\"}",
      "totalSupplyBefore": "1358165225423"
    },
    {
      "vault": "CC767WIU5QGJMXYHDDYJAJEF2YWPHOXOZDWD3UUAZVS4KQPRXCKPT2YZ",
      "totalManagedFundsBefore": "{\"asset\":\"CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75\",\"idle_amount\":\"30000001\",\"invested_amount\":\"60005917\",\"strategy_allocations\":[{\"amount\":\"0\",\"paused\":false,\"strategy_address\":\"CDB2WMKQQNVZMEBY7Q7GZ5C7E7IAFSNMZ7GGVD6WKTCEWK7XOIAVZSAP\"},{\"amount\":\"60005917\",\"paused\":false,\"strategy_address\":\"CCSRX5E4337QMCMC3KO3RDFYI57T5NZV5XB3W3TWE4USCASKGL5URKJL\"}],\"total_amount\":\"90005918\"}",
      "totalSupplyBefore": "17999859"
    },
    {
      "vault": "CA5RG7DCLMNJFRMG3LP2VDUBWCZ4QTZ776VCEQKWBPGDUAJAT26K2OXM",
      "totalManagedFundsBefore": "{\"asset\":\"CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA\",\"idle_amount\":\"50000000\",\"invested_amount\":\"0\",\"strategy_allocations\":[{\"amount\":\"0\",\"paused\":false,\"strategy_address\":\"CDPWNUW7UMCSVO36VAJSQHQECISPJLCVPDASKHRC5SEROAAZDUQ5DG2Z\"}],\"total_amount\":\"50000000\"}",
      "totalSupplyBefore": "50000000"
    },
    {
      "vault": "CBDZYJVQJQT7QJ7ZTMGNGZ7RR3DF32LERLZ26A2HLW5FNJ4OOZCLI3OG",
      "totalManagedFundsBefore": "{\"asset\":\"CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75\",\"idle_amount\":\"0\",\"invested_amount\":\"112395766\",\"strategy_allocations\":[{\"amount\":\"0\",\"paused\":false,\"strategy_address\":\"CDB2WMKQQNVZMEBY7Q7GZ5C7E7IAFSNMZ7GGVD6WKTCEWK7XOIAVZSAP\"},{\"amount\":\"112395766\",\"paused\":false,\"strategy_address\":\"CCSRX5E4337QMCMC3KO3RDFYI57T5NZV5XB3W3TWE4USCASKGL5URKJL\"}],\"total_amount\":\"112395766\"}",
      "totalSupplyBefore": "108393142"
    }
    ];
  }
}