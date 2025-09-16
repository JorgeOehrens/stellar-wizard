/**
 * Vault Analysis and Clustering Engine for DeFindex
 * Implements risk-based clustering and recommendation system
 */

export interface VaultData {
  vault: string;
  totalManagedFundsBefore: string;
  totalSupplyBefore: string;
}

export interface ParsedVaultData {
  vaultAddress: string;
  asset: string;
  totalAmount: number;
  idleAmount: number;
  investedAmount: number;
  totalSupply: number;
  strategyAllocations: Array<{
    amount: number;
    paused: boolean;
    strategy_address: string;
  }>;
}

export interface VaultFeatures {
  vaultAddress: string;
  asset: string;
  tvl: number; // Total Value Locked (normalized 0-1)
  idleRatio: number; // idle_amount / total_amount (0-1)
  concentration: number; // Herfindahl index on strategy allocations (0-1)
  assetStability: number; // 1 for stable assets, 0 for volatile (0-1)
  growthRate: number; // Estimated growth rate from historical data (normalized)
  sharesOutstanding: number; // Total supply (normalized)
}

export interface VaultCluster {
  id: string;
  name: string;
  riskLevel: 'Conservative' | 'Balanced' | 'Aggressive';
  description: string;
  expectedApy: number;
  vaultAddresses: string[];
}

export interface VaultRecommendation {
  vaultAddress: string;
  asset: string;
  cluster: VaultCluster;
  score: number; // Match score for user profile (0-1)
  rationale: string;
  estimatedApy: number;
  tvl: number;
  riskLevel: 'Conservative' | 'Balanced' | 'Aggressive';
}

export interface UserRiskProfile {
  riskTolerance: 'Conservative' | 'Balanced' | 'Aggressive';
  liquidityNeeds: 'Low' | 'Medium' | 'High';
  timeHorizon: number; // months
  experienceLevel: 'Beginner' | 'Intermediate' | 'Advanced';
}

// Known stable assets on Stellar
const STABLE_ASSETS = new Set([
  'CDTKPWPLOURQA2SGTKTUQOWRCBZEORB4BWBOMJ3D3ZTQQSGE5F6JBQLV', // USDC
  'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75', // USDT equivalent
  'CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA'  // Another stable
]);

/**
 * Parse raw vault data from DeFindex API
 */
export function parseVaultData(vaults: VaultData[]): ParsedVaultData[] {
  return vaults.map(vault => {
    try {
      const fundsData = JSON.parse(vault.totalManagedFundsBefore);

      return {
        vaultAddress: vault.vault,
        asset: fundsData.asset,
        totalAmount: parseInt(fundsData.total_amount) / 1e7, // Convert from stroops
        idleAmount: parseInt(fundsData.idle_amount) / 1e7,
        investedAmount: parseInt(fundsData.invested_amount) / 1e7,
        totalSupply: parseInt(vault.totalSupplyBefore) / 1e7,
        strategyAllocations: fundsData.strategy_allocations.map((alloc: any) => ({
          amount: parseInt(alloc.amount) / 1e7,
          paused: alloc.paused,
          strategy_address: alloc.strategy_address
        }))
      };
    } catch (error) {
      console.error('Error parsing vault data:', error);
      return {
        vaultAddress: vault.vault,
        asset: '',
        totalAmount: 0,
        idleAmount: 0,
        investedAmount: 0,
        totalSupply: 0,
        strategyAllocations: []
      };
    }
  });
}

/**
 * Extract features for clustering analysis
 */
export function extractVaultFeatures(vaults: ParsedVaultData[]): VaultFeatures[] {
  // Calculate normalization ranges
  const tvlValues = vaults.map(v => v.totalAmount).filter(t => t > 0);
  const maxTvl = Math.max(...tvlValues);
  const minTvl = Math.min(...tvlValues);

  const supplyValues = vaults.map(v => v.totalSupply).filter(s => s > 0);
  const maxSupply = Math.max(...supplyValues);
  const minSupply = Math.min(...supplyValues);

  return vaults.map(vault => {
    // Calculate idle ratio
    const idleRatio = vault.totalAmount > 0 ? vault.idleAmount / vault.totalAmount : 0;

    // Calculate Herfindahl concentration index
    const totalAllocated = vault.strategyAllocations.reduce((sum, alloc) => sum + alloc.amount, 0);
    const concentration = totalAllocated > 0
      ? vault.strategyAllocations.reduce((sum, alloc) => {
          const share = alloc.amount / totalAllocated;
          return sum + (share * share);
        }, 0)
      : 0;

    // Determine asset stability
    const assetStability = STABLE_ASSETS.has(vault.asset) ? 1 : 0;

    // Normalize TVL (0-1)
    const normalizedTvl = maxTvl > minTvl
      ? (vault.totalAmount - minTvl) / (maxTvl - minTvl)
      : 0;

    // Normalize supply
    const normalizedSupply = maxSupply > minSupply
      ? (vault.totalSupply - minSupply) / (maxSupply - minSupply)
      : 0;

    return {
      vaultAddress: vault.vaultAddress,
      asset: vault.asset,
      tvl: normalizedTvl,
      idleRatio,
      concentration,
      assetStability,
      growthRate: 0, // TODO: Calculate from historical data
      sharesOutstanding: normalizedSupply
    };
  });
}

/**
 * Cluster vaults into risk categories using heuristic rules
 */
export function clusterVaults(features: VaultFeatures[]): VaultCluster[] {
  const conservative: string[] = [];
  const balanced: string[] = [];
  const aggressive: string[] = [];

  features.forEach(feature => {
    // Skip vaults with zero TVL
    if (feature.tvl === 0) return;

    const riskScore = calculateRiskScore(feature);

    if (riskScore <= 0.33) {
      conservative.push(feature.vaultAddress);
    } else if (riskScore <= 0.66) {
      balanced.push(feature.vaultAddress);
    } else {
      aggressive.push(feature.vaultAddress);
    }
  });

  return [
    {
      id: 'conservative',
      name: 'Conservative',
      riskLevel: 'Conservative',
      description: 'Large TVL, stable assets, diversified strategies with low concentration',
      expectedApy: 6,
      vaultAddresses: conservative
    },
    {
      id: 'balanced',
      name: 'Balanced',
      riskLevel: 'Balanced',
      description: 'Medium TVL, mix of stable and volatile assets, moderate concentration',
      expectedApy: 12,
      vaultAddresses: balanced
    },
    {
      id: 'aggressive',
      name: 'Aggressive',
      riskLevel: 'Aggressive',
      description: 'Smaller TVL or high concentration, volatile assets, higher expected returns',
      expectedApy: 20,
      vaultAddresses: aggressive
    }
  ];
}

/**
 * Calculate risk score for a vault (0 = lowest risk, 1 = highest risk)
 */
function calculateRiskScore(feature: VaultFeatures): number {
  // High TVL = lower risk (invert TVL)
  const tvlRisk = 1 - feature.tvl;

  // High idle ratio = lower deployment efficiency = higher risk
  const idleRisk = feature.idleRatio;

  // High concentration = higher risk
  const concentrationRisk = feature.concentration;

  // Stable assets = lower risk (invert stability)
  const assetRisk = 1 - feature.assetStability;

  // Weighted combination
  return (
    tvlRisk * 0.3 +           // 30% weight on TVL
    idleRisk * 0.2 +          // 20% weight on idle ratio
    concentrationRisk * 0.3 + // 30% weight on concentration
    assetRisk * 0.2           // 20% weight on asset type
  );
}

/**
 * Recommend vaults based on user risk profile
 */
export function recommendVaults(
  features: VaultFeatures[],
  clusters: VaultCluster[],
  userProfile: UserRiskProfile,
  topN: number = 3
): VaultRecommendation[] {
  const targetCluster = clusters.find(c => c.riskLevel === userProfile.riskTolerance);
  if (!targetCluster) return [];

  // Score each vault in the target cluster
  const recommendations: VaultRecommendation[] = [];

  targetCluster.vaultAddresses.forEach(vaultAddress => {
    const feature = features.find(f => f.vaultAddress === vaultAddress);
    if (!feature) return;

    const score = calculateUserMatchScore(feature, userProfile);
    const rationale = generateRationale(feature, userProfile, targetCluster);

    recommendations.push({
      vaultAddress,
      asset: feature.asset,
      cluster: targetCluster,
      score,
      rationale,
      estimatedApy: targetCluster.expectedApy,
      tvl: feature.tvl,
      riskLevel: targetCluster.riskLevel
    });
  });

  // Sort by score and return top N
  return recommendations
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}

/**
 * Calculate how well a vault matches the user's profile
 */
function calculateUserMatchScore(feature: VaultFeatures, profile: UserRiskProfile): number {
  let score = 0.5; // Base score

  // Experience level adjustments
  if (profile.experienceLevel === 'Beginner') {
    // Prefer stable assets and higher TVL
    score += feature.assetStability * 0.2;
    score += feature.tvl * 0.2;
    score -= feature.concentration * 0.1; // Prefer diversified
  } else if (profile.experienceLevel === 'Advanced') {
    // Can handle more concentration and complexity
    score += feature.concentration * 0.1;
  }

  // Liquidity needs
  if (profile.liquidityNeeds === 'High') {
    // Prefer lower idle ratios (more liquid)
    score -= feature.idleRatio * 0.15;
  }

  // Time horizon
  if (profile.timeHorizon >= 24) {
    // Long-term can handle more volatility
    score += (1 - feature.assetStability) * 0.1;
  } else if (profile.timeHorizon <= 6) {
    // Short-term prefers stability
    score += feature.assetStability * 0.15;
  }

  return Math.max(0, Math.min(1, score));
}

/**
 * Generate explanation for why a vault was recommended
 */
function generateRationale(
  feature: VaultFeatures,
  profile: UserRiskProfile,
  cluster: VaultCluster
): string {
  const reasons: string[] = [];

  if (feature.assetStability > 0.5) {
    reasons.push('stable asset base');
  }

  if (feature.tvl > 0.7) {
    reasons.push('strong TVL indicating community trust');
  }

  if (feature.concentration < 0.5) {
    reasons.push('diversified strategy allocation');
  }

  if (feature.idleRatio < 0.3) {
    reasons.push('efficient capital deployment');
  }

  const reasonText = reasons.length > 0
    ? reasons.join(', ')
    : 'balanced risk-return profile';

  return `Recommended for ${profile.riskTolerance.toLowerCase()} investors due to ${reasonText}. Aligns with your ${profile.timeHorizon}-month investment horizon.`;
}

/**
 * Get vault details by address
 */
export function getVaultDetails(vaultAddress: string, features: VaultFeatures[]): VaultFeatures | null {
  return features.find(f => f.vaultAddress === vaultAddress) || null;
}

/**
 * Calculate projections for investment returns
 */
export interface ProjectionInput {
  principal: number;
  apy: number;
  months: number;
  monthlyContribution?: number;
}

export interface ProjectionResult {
  months: number;
  balance: number;
  totalContributions: number;
  totalReturns: number;
}

export function calculateProjections(input: ProjectionInput): ProjectionResult[] {
  const { principal, apy, monthlyContribution = 0 } = input;
  const monthlyRate = Math.pow(1 + apy / 100, 1 / 12) - 1;

  const projections: ProjectionResult[] = [];
  let currentBalance = principal;
  let totalContributions = principal;

  for (let month = 1; month <= 24; month++) {
    // Apply monthly growth
    currentBalance *= (1 + monthlyRate);

    // Add monthly contribution if any
    if (monthlyContribution > 0) {
      currentBalance += monthlyContribution;
      totalContributions += monthlyContribution;
    }

    // Record projections at 6, 12, 18, 24 months
    if ([6, 12, 18, 24].includes(month)) {
      projections.push({
        months: month,
        balance: currentBalance,
        totalContributions,
        totalReturns: currentBalance - totalContributions
      });
    }
  }

  return projections;
}