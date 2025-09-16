/**
 * Enhanced vault types with complete investment details
 */

export interface ChosenVault {
  vaultId: string;           // C… address
  network: "testnet" | "mainnet";
  assetId: string;           // underlying asset C…
  tvl: string;               // total_amount (base units) from totalManagedFundsBefore
  allocations: Array<{       // from strategy_allocations
    strategyId: string;      // C… address
    amount: string;          // base units
    percent: number;         // computed = amount / total_amount * 100
  }>;
  idleAmount: string;        // base units
  idlePercent: number;       // computed
  totalSupply: string;       // totalSupplyBefore
  assumedApy: number;        // % used in projection (explicit or inferred)
  riskLabel: "Conservative" | "Balanced" | "Aggressive";
  rationale: string;
}

export interface ApiCall {
  method: string;
  path: string;
  purpose: string;
  status?: 'pending' | 'completed' | 'failed';
}

export interface InvestmentSummary {
  vault: ChosenVault;
  investment: {
    amountHuman: string;     // "100 USDC"
    amountBase: string;      // "1000000000" (base units)
    horizon: number;         // months
    liquidityPreference: string;
  };
  projections: Array<{
    months: number;
    balance: number;
    balanceHuman: string;
  }>;
  apiCalls: ApiCall[];
  stellarExpertLink: string;
}

export interface FallbackPolicy {
  step: 'lower_constraints' | 'top_tvl_stable' | 'error_with_options';
  attempted: boolean;
  result?: ChosenVault | null;
}

/**
 * Convert raw vault data to ChosenVault format
 */
export function normalizeVault(
  vaultData: any,
  parsedData: any,
  riskLevel: "Conservative" | "Balanced" | "Aggressive",
  assumedApy: number,
  rationale: string,
  network: "testnet" | "mainnet"
): ChosenVault {
  const totalAmount = parseFloat(parsedData.total_amount);
  const idleAmount = parseFloat(parsedData.idle_amount);

  // Calculate strategy allocations with percentages
  const allocations = parsedData.strategy_allocations.map((alloc: any) => {
    const amount = parseFloat(alloc.amount);
    return {
      strategyId: alloc.strategy_address,
      amount: alloc.amount,
      percent: totalAmount > 0 ? (amount / totalAmount) * 100 : 0
    };
  });

  // Calculate idle percentage
  const idlePercent = totalAmount > 0 ? (idleAmount / totalAmount) * 100 : 0;

  return {
    vaultId: vaultData.vault,
    network,
    assetId: parsedData.asset,
    tvl: parsedData.total_amount,
    allocations,
    idleAmount: parsedData.idle_amount,
    idlePercent,
    totalSupply: vaultData.totalSupplyBefore,
    assumedApy,
    riskLabel: riskLevel,
    rationale
  };
}

/**
 * Generate Stellar Expert link for vault contract
 */
export function getStellarExpertLink(vaultId: string, network: "testnet" | "mainnet"): string {
  const networkPath = network === 'testnet' ? 'testnet' : 'public';
  return `https://stellar.expert/explorer/${networkPath}/contract/${vaultId}`;
}

/**
 * Convert amount to base units (assuming 7 decimal places for Stellar)
 */
export function toBaseUnits(amount: number): string {
  return Math.floor(amount * 1e7).toString();
}

/**
 * Convert base units to human readable format
 */
export function toHumanUnits(baseUnits: string, decimals: number = 7): number {
  return parseFloat(baseUnits) / Math.pow(10, decimals);
}

/**
 * Get asset symbol from address mapping
 */
export function getAssetSymbol(assetAddress: string): string {
  const assetMap: Record<string, string> = {
    'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75': 'USDT',
    'CDTKPWPLOURQA2SGTKTUQOWRCBZEORB4BWBOMJ3D3ZTQQSGE5F6JBQLV': 'USDC',
    'CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA': 'STABLE'
  };

  return assetMap[assetAddress] || 'TOKEN';
}