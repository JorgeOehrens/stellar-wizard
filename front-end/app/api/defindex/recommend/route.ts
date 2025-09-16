import { NextRequest, NextResponse } from 'next/server';
import {
  parseVaultData,
  extractVaultFeatures,
  clusterVaults,
  recommendVaults,
  UserRiskProfile,
  VaultData
} from '@/lib/vault-analysis';

export interface RecommendationRequest {
  amount: number;
  riskTolerance: 'Conservative' | 'Balanced' | 'Aggressive';
  timeHorizon: number; // months
  liquidityNeeds?: 'Low' | 'Medium' | 'High';
  experienceLevel?: 'Beginner' | 'Intermediate' | 'Advanced';
}

export interface RecommendationResponse {
  recommendation: {
    vaultAddress: string;
    asset: string;
    estimatedApy: number;
    riskLevel: string;
    tvl: number;
    rationale: string;
  };
  alternatives: Array<{
    vaultAddress: string;
    asset: string;
    estimatedApy: number;
    riskLevel: string;
    tvl: number;
    rationale: string;
  }>;
  assumptions: {
    apySource: string;
    riskAssessment: string;
  };
}

/**
 * POST /api/defindex/recommend
 * Recommends vaults based on user profile
 */
export async function POST(request: NextRequest) {
  try {
    const body: RecommendationRequest = await request.json();

    // Validate required fields
    if (!body.amount || !body.riskTolerance || !body.timeHorizon) {
      return NextResponse.json(
        { error: 'Missing required fields: amount, riskTolerance, timeHorizon' },
        { status: 400 }
      );
    }

    // Fetch vault data (in real app, this would come from external API)
    const vaultData = await getVaultData();

    // Parse and analyze vault data
    const parsedVaults = parseVaultData(vaultData);
    const features = extractVaultFeatures(parsedVaults);
    const clusters = clusterVaults(features);

    // Create user profile
    const userProfile: UserRiskProfile = {
      riskTolerance: body.riskTolerance,
      liquidityNeeds: body.liquidityNeeds || 'Medium',
      timeHorizon: body.timeHorizon,
      experienceLevel: body.experienceLevel || 'Intermediate'
    };

    // Get recommendations
    const recommendations = recommendVaults(features, clusters, userProfile, 3);

    if (recommendations.length === 0) {
      return NextResponse.json(
        { error: 'No suitable vaults found for your profile' },
        { status: 404 }
      );
    }

    // Format response
    const response: RecommendationResponse = {
      recommendation: {
        vaultAddress: recommendations[0].vaultAddress,
        asset: getAssetSymbol(recommendations[0].asset),
        estimatedApy: recommendations[0].estimatedApy,
        riskLevel: recommendations[0].riskLevel,
        tvl: recommendations[0].tvl,
        rationale: recommendations[0].rationale
      },
      alternatives: recommendations.slice(1).map(rec => ({
        vaultAddress: rec.vaultAddress,
        asset: getAssetSymbol(rec.asset),
        estimatedApy: rec.estimatedApy,
        riskLevel: rec.riskLevel,
        tvl: rec.tvl,
        rationale: rec.rationale
      })),
      assumptions: {
        apySource: `Estimated APY based on ${body.riskTolerance.toLowerCase()} risk cluster analysis`,
        riskAssessment: `Risk assessment based on TVL, asset stability, and strategy concentration for ${body.timeHorizon}-month horizon`
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error in vault recommendation:', error);
    return NextResponse.json(
      { error: 'Failed to generate recommendations' },
      { status: 500 }
    );
  }
}

async function getVaultData(): Promise<VaultData[]> {
  // In production, this would fetch from external API
  // For now, return the sample data
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

function getAssetSymbol(assetAddress: string): string {
  const assetMap: Record<string, string> = {
    'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75': 'USDT',
    'CDTKPWPLOURQA2SGTKTUQOWRCBZEORB4BWBOMJ3D3ZTQQSGE5F6JBQLV': 'USDC',
    'CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA': 'STABLE'
  };

  return assetMap[assetAddress] || 'TOKEN';
}