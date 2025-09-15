import { invokeWithFreighter, ContractCallParams, TransactionResult, formatAmount } from './soroban';

const SOROSWAP_ROUTER_ID = process.env.NEXT_PUBLIC_SOROSWAP_ROUTER_ID!;

export interface SwapParams {
  tokenInId: string;
  tokenOutId: string;
  amountIn: string;
  amountOutMin: string;
  walletKit: any;
  userAddress: string;
}

export async function swapTokens({
  tokenInId,
  tokenOutId,
  amountIn,
  amountOutMin,
  walletKit,
  userAddress
}: SwapParams): Promise<TransactionResult> {
  const { Address } = await import('@stellar/stellar-sdk');
  
  // Convert amounts to proper format (assuming 7 decimals for Stellar tokens)
  const amountInFormatted = formatAmount(amountIn, 7);
  const amountOutMinFormatted = formatAmount(amountOutMin, 7);
  
  const args = [
    Address.fromString(tokenInId),      // token_a
    Address.fromString(tokenOutId),     // token_b
    amountInFormatted,                  // amount_a
    amountOutMinFormatted,              // amount_b_min
    Address.fromString(userAddress),    // to
    Math.floor(Date.now() / 1000) + 300 // deadline (5 minutes from now)
  ];

  const callParams: ContractCallParams = {
    contractId: SOROSWAP_ROUTER_ID,
    method: 'swap_exact_tokens_for_tokens',
    args,
    walletKit,
    userAddress
  };

  return invokeWithFreighter(callParams);
}

export interface SwapPlan {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  estimatedAmountOut: string;
  minimumAmountOut: string;
  slippage: string;
  deadline: string;
}

export function buildSwapPlan({
  tokenInId,
  tokenOutId,
  amountIn,
  amountOutMin
}: Omit<SwapParams, 'walletKit' | 'userAddress'>): SwapPlan {
  const deadline = new Date(Date.now() + 5 * 60 * 1000).toLocaleTimeString();
  
  return {
    tokenIn: tokenInId.substring(0, 8) + '...' + tokenInId.slice(-8),
    tokenOut: tokenOutId.substring(0, 8) + '...' + tokenOutId.slice(-8),
    amountIn,
    estimatedAmountOut: 'TBD (requires pool data)',
    minimumAmountOut: amountOutMin,
    slippage: '1%', // Default slippage
    deadline
  };
}