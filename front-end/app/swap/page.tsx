'use client';

import { useState, useContext } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowDown, ExternalLink, CheckCircle, AlertCircle } from 'lucide-react';
import { swapTokens, buildSwapPlan, SwapPlan } from '@/lib/soroswap';
import { TransactionResult } from '@/lib/soroban';
import { StellarWalletsKit, WalletNetwork } from '@creit.tech/stellar-wallets-kit';

const TOKEN_A_ID = process.env.NEXT_PUBLIC_TOKEN_A_ID!;
const TOKEN_B_ID = process.env.NEXT_PUBLIC_TOKEN_B_ID!;

export default function SwapPage() {
  const [walletKit, setWalletKit] = useState<StellarWalletsKit | null>(null);
  const [publicKey, setPublicKey] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);

  // Form state
  const [tokenInId, setTokenInId] = useState(TOKEN_A_ID);
  const [tokenOutId, setTokenOutId] = useState(TOKEN_B_ID);
  const [amount, setAmount] = useState('');
  const [amountOutMin, setAmountOutMin] = useState('');

  // Plan and execution state
  const [plan, setPlan] = useState<SwapPlan | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<TransactionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const connectWallet = async () => {
    try {
      const kit = new StellarWalletsKit({
        network: WalletNetwork.TESTNET,
        selectedWalletId: 'freighter',
        modules: []
      });

      await kit.openModal({
        onWalletSelected: async (option) => {
          try {
            kit.setWallet(option.id);
            const { address } = await kit.getAddress();
            
            setWalletKit(kit);
            setPublicKey(address);
            setIsConnected(true);
            setError(null);
          } catch (error) {
            setError(`Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      });
    } catch (error) {
      setError(`Failed to initialize wallet: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const buildPlan = () => {
    if (!amount || !amountOutMin) {
      setError('Please fill in all amounts');
      return;
    }

    const swapPlan = buildSwapPlan({
      tokenInId,
      tokenOutId,
      amountIn: amount,
      amountOutMin
    });

    setPlan(swapPlan);
    setResult(null);
    setError(null);
  };

  const executeSwap = async () => {
    if (!walletKit || !publicKey || !plan) {
      setError('Wallet not connected or plan not built');
      return;
    }

    setIsExecuting(true);
    setError(null);

    try {
      const txResult = await swapTokens({
        tokenInId,
        tokenOutId,
        amountIn: amount,
        amountOutMin,
        walletKit,
        userAddress: publicKey
      });

      setResult(txResult);
      setPlan(null); // Clear plan after successful execution
    } catch (error) {
      setError(`Swap failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsExecuting(false);
    }
  };

  const switchTokens = () => {
    setTokenInId(tokenOutId);
    setTokenOutId(tokenInId);
    setPlan(null);
    setResult(null);
    setError(null);
  };

  return (
    <div className="container mx-auto py-8 max-w-2xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Token Swap</h1>
          <p className="text-muted-foreground">
            Swap tokens using Soroswap on Stellar Testnet
          </p>
        </div>

        {/* Wallet Connection */}
        <Card>
          <CardHeader>
            <CardTitle>Wallet Connection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isConnected ? (
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span>Connected: {publicKey.substring(0, 8)}...{publicKey.slice(-8)}</span>
                <Badge className="bg-green-100 text-green-700">Testnet</Badge>
              </div>
            ) : (
              <Button onClick={connectWallet} className="w-full">
                Connect Freighter Wallet
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Swap Form */}
        <Card>
          <CardHeader>
            <CardTitle>Swap Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tokenIn">Token In Contract ID</Label>
              <Input
                id="tokenIn"
                value={tokenInId}
                onChange={(e) => setTokenInId(e.target.value)}
                placeholder="CC...TOKEN_A"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Amount In</Label>
              <Input
                id="amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="100.0"
                type="number"
                step="0.0000001"
              />
            </div>

            <div className="flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={switchTokens}
                className="rounded-full p-2"
              >
                <ArrowDown className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tokenOut">Token Out Contract ID</Label>
              <Input
                id="tokenOut"
                value={tokenOutId}
                onChange={(e) => setTokenOutId(e.target.value)}
                placeholder="CC...TOKEN_B"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="amountOutMin">Minimum Amount Out</Label>
              <Input
                id="amountOutMin"
                value={amountOutMin}
                onChange={(e) => setAmountOutMin(e.target.value)}
                placeholder="95.0"
                type="number"
                step="0.0000001"
              />
            </div>

            <Button onClick={buildPlan} className="w-full" disabled={!amount || !amountOutMin}>
              Build Plan
            </Button>
          </CardContent>
        </Card>

        {/* Plan Display */}
        {plan && (
          <Card>
            <CardHeader>
              <CardTitle>Swap Plan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <strong>From:</strong> {plan.tokenIn}
                </div>
                <div>
                  <strong>To:</strong> {plan.tokenOut}
                </div>
                <div>
                  <strong>Amount In:</strong> {plan.amountIn}
                </div>
                <div>
                  <strong>Min Amount Out:</strong> {plan.minimumAmountOut}
                </div>
                <div>
                  <strong>Slippage:</strong> {plan.slippage}
                </div>
                <div>
                  <strong>Deadline:</strong> {plan.deadline}
                </div>
              </div>
              
              <Separator />
              
              <Button 
                onClick={executeSwap} 
                className="w-full" 
                disabled={!isConnected || isExecuting}
              >
                {isExecuting ? 'Executing Swap...' : 'Execute Swap'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Result Display */}
        {result && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                Swap Successful
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div>
                  <strong>Transaction Hash:</strong>
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
  );
}