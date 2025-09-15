'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { PiggyBank, TrendingUp, ExternalLink, AlertCircle } from 'lucide-react';
import { supply, borrow, buildLendingPlan, LendingPlan } from '@/lib/blend';
import { TransactionResult } from '@/lib/soroban';
import { useWallet } from '../providers/WalletProvider';
import TopNav from '@/components/TopNav';

const BLEND_MARKET_USDC_ID = process.env.NEXT_PUBLIC_BLEND_MARKET_USDC_ID!;

export default function LendPage() {
  const { publicKey, signTransaction, isConnected } = useWallet();

  // Form state
  const [marketId, setMarketId] = useState(BLEND_MARKET_USDC_ID);
  const [supplyAmount, setSupplyAmount] = useState('');
  const [borrowAmount, setBorrowAmount] = useState('');
  const [enableBorrow, setEnableBorrow] = useState(false);

  // Plan and execution state
  const [plan, setPlan] = useState<LendingPlan | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [results, setResults] = useState<TransactionResult[]>([]);
  const [error, setError] = useState<string | null>(null);


  const buildPlan = () => {
    if (!supplyAmount && !borrowAmount) {
      setError('Please specify at least a supply or borrow amount');
      return;
    }

    if (borrowAmount && !supplyAmount) {
      setError('Cannot borrow without supplying collateral first');
      return;
    }

    const lendingPlan = buildLendingPlan({
      marketId,
      supplyAmount: supplyAmount || undefined,
      borrowAmount: enableBorrow ? borrowAmount || undefined : undefined
    });

    setPlan(lendingPlan);
    setResults([]);
    setError(null);
  };

  const executeLending = async () => {
    if (!publicKey || !plan) {
      setError('Wallet not connected or plan not built');
      return;
    }

    setIsExecuting(true);
    setError(null);
    const txResults: TransactionResult[] = [];

    try {
      // Execute supply if specified
      if (supplyAmount) {
        const supplyResult = await supply({
          marketId,
          amount: supplyAmount,
          signTransaction,
          userAddress: publicKey
        });
        txResults.push(supplyResult);
      }

      // Execute borrow if specified and enabled
      if (enableBorrow && borrowAmount) {
        // Small delay between transactions
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const borrowResult = await borrow({
          marketId,
          amount: borrowAmount,
          signTransaction,
          userAddress: publicKey
        });
        txResults.push(borrowResult);
      }

      setResults(txResults);
      setPlan(null); // Clear plan after successful execution
    } catch (error) {
      setError(`Lending operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-light dark:bg-bg-dark">
      <TopNav />
      <div className="pt-28">
        <div className="max-w-xl mx-auto p-6 space-y-4">
          <div>
            <h1 className="text-3xl font-bold">Lending & Borrowing</h1>
            <p className="text-muted-foreground">
              Supply and borrow assets using Blend Protocol on Stellar Testnet
            </p>
          </div>

          {/* Lending Form */}
          <Card>
          <CardHeader>
            <CardTitle>Lending Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="market">Market Contract ID</Label>
              <Input
                id="market"
                value={marketId}
                onChange={(e) => setMarketId(e.target.value)}
                placeholder="CC...MARKET_USDC"
              />
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <PiggyBank className="h-5 w-5 text-green-600" />
                <h3 className="text-lg font-semibold">Supply</h3>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="supplyAmount">Supply Amount</Label>
                <Input
                  id="supplyAmount"
                  value={supplyAmount}
                  onChange={(e) => setSupplyAmount(e.target.value)}
                  placeholder="1000.0"
                  type="number"
                  step="0.0000001"
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold">Borrow (Optional)</h3>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="enableBorrow"
                  checked={enableBorrow}
                  onCheckedChange={(checked) => setEnableBorrow(checked as boolean)}
                />
                <Label
                  htmlFor="enableBorrow"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Enable borrowing after supply
                </Label>
              </div>
              
              {enableBorrow && (
                <div className="space-y-2">
                  <Label htmlFor="borrowAmount">Borrow Amount</Label>
                  <Input
                    id="borrowAmount"
                    value={borrowAmount}
                    onChange={(e) => setBorrowAmount(e.target.value)}
                    placeholder="500.0"
                    type="number"
                    step="0.0000001"
                  />
                </div>
              )}
            </div>

            <Button onClick={buildPlan} className="w-full" disabled={!supplyAmount && !borrowAmount}>
              Build Plan
            </Button>
          </CardContent>
        </Card>

        {/* Plan Display */}
        {plan && (
          <Card>
            <CardHeader>
              <CardTitle>Lending Plan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div><strong>Market:</strong> {plan.market}</div>
                {plan.supplyAmount && (
                  <div><strong>Supply Amount:</strong> {plan.supplyAmount}</div>
                )}
                {plan.borrowAmount && (
                  <div><strong>Borrow Amount:</strong> {plan.borrowAmount}</div>
                )}
                <div><strong>Estimated APY:</strong> {plan.estimatedAPY}</div>
              </div>
              
              <div className="space-y-2">
                <strong>Actions to execute:</strong>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {plan.actions.map((action, index) => (
                    <li key={index}>{action}</li>
                  ))}
                </ul>
              </div>
              
              <Separator />
              
              <Button 
                onClick={executeLending} 
                className="w-full" 
                disabled={!isConnected || isExecuting}
              >
                {isExecuting ? 'Executing Plan...' : 'Execute Plan'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Results Display */}
        {results.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                Operations Completed
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {results.map((result, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-2">
                  <div className="font-semibold">
                    Transaction {index + 1}
                  </div>
                  <div>
                    <strong>Hash:</strong>
                    <div className="font-mono text-sm break-all">{result.txHash}</div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => window.open(result.explorerUrl, '_blank')}
                    className="w-full"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View on Stellar Expert
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          )}
        </div>
      </div>
    </div>
  );
}