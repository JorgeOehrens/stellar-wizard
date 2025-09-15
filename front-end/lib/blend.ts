import { invokeWithFreighter, ContractCallParams, TransactionResult, formatAmount } from './soroban';

const BLEND_CORE_ID = process.env.NEXT_PUBLIC_BLEND_CORE_ID!;

export interface SupplyParams {
  marketId: string;
  amount: string;
  walletKit: any;
  userAddress: string;
}

export interface BorrowParams {
  marketId: string;
  amount: string;
  walletKit: any;
  userAddress: string;
}

export async function supply({
  marketId,
  amount,
  walletKit,
  userAddress
}: SupplyParams): Promise<TransactionResult> {
  const { Address } = await import('@stellar/stellar-sdk');
  
  // Convert amount to proper format (assuming 7 decimals)
  const amountFormatted = formatAmount(amount, 7);
  
  const args = [
    Address.fromString(userAddress),  // from (user address)
    Address.fromString(marketId),     // pool_id (market contract)
    amountFormatted                   // amount
  ];

  const callParams: ContractCallParams = {
    contractId: BLEND_CORE_ID,
    method: 'supply',
    args,
    walletKit,
    userAddress
  };

  return invokeWithFreighter(callParams);
}

export async function borrow({
  marketId,
  amount,
  walletKit,
  userAddress
}: BorrowParams): Promise<TransactionResult> {
  const { Address } = await import('@stellar/stellar-sdk');
  
  // Convert amount to proper format (assuming 7 decimals)
  const amountFormatted = formatAmount(amount, 7);
  
  const args = [
    Address.fromString(userAddress),  // from (user address)  
    Address.fromString(marketId),     // pool_id (market contract)
    amountFormatted                   // amount
  ];

  const callParams: ContractCallParams = {
    contractId: BLEND_CORE_ID,
    method: 'borrow',
    args,
    walletKit,
    userAddress
  };

  return invokeWithFreighter(callParams);
}

export interface LendingPlan {
  market: string;
  supplyAmount?: string;
  borrowAmount?: string;
  actions: string[];
  estimatedAPY: string;
}

export function buildLendingPlan({
  marketId,
  supplyAmount,
  borrowAmount
}: {
  marketId: string;
  supplyAmount?: string;
  borrowAmount?: string;
}): LendingPlan {
  const actions: string[] = [];
  
  if (supplyAmount) {
    actions.push(`Supply ${supplyAmount} tokens`);
  }
  
  if (borrowAmount) {
    actions.push(`Borrow ${borrowAmount} tokens`);
  }

  return {
    market: marketId.substring(0, 8) + '...' + marketId.slice(-8),
    supplyAmount,
    borrowAmount,
    actions,
    estimatedAPY: 'TBD (requires market data)'
  };
}