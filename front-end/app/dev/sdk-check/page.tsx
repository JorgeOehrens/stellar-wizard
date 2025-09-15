'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, CheckCircle, Clock, Wallet, Server, FileText } from 'lucide-react';
import { StellarWalletsKit, WalletNetwork } from '@creit.tech/stellar-wallets-kit';
import { Contract, SorobanRpc, TransactionBuilder, Networks, Account, Operation } from '@stellar/stellar-sdk';

const SOROBAN_RPC_URL = process.env.NEXT_PUBLIC_SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org';
const TEST_TOKEN_CONTRACT_ID = process.env.NEXT_PUBLIC_TEST_TOKEN_CONTRACT_ID || 'CBQJQF4D7H5E34MS3M54IG7HINNYYVSBQO5K7ZCKTYIQIYGRX72UKGZ5';

interface TestResult {
  status: 'pending' | 'running' | 'success' | 'error';
  message: string;
  data?: any;
}

export default function SdkCheckPage() {
  const [walletKit, setWalletKit] = useState<StellarWalletsKit | null>(null);
  const [publicKey, setPublicKey] = useState<string>('');
  const [rpcClient, setRpcClient] = useState<SorobanRpc.Server | null>(null);

  useEffect(() => {
    setRpcClient(new SorobanRpc.Server(SOROBAN_RPC_URL));
  }, []);
  
  const [walletTest, setWalletTest] = useState<TestResult>({ status: 'pending', message: 'Not started' });
  const [rpcTest, setRpcTest] = useState<TestResult>({ status: 'pending', message: 'Not started' });
  const [signTest, setSignTest] = useState<TestResult>({ status: 'pending', message: 'Not started' });
  const [tokenTest, setTokenTest] = useState<TestResult>({ status: 'pending', message: 'Not started' });

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-gray-400" />;
      case 'running':
        return <Clock className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusBadge = (status: TestResult['status']) => {
    const variants = {
      pending: 'secondary' as const,
      running: 'default' as const,
      success: 'default' as const,
      error: 'destructive' as const
    };
    
    const colors = {
      pending: 'bg-gray-100 text-gray-700',
      running: 'bg-blue-100 text-blue-700',
      success: 'bg-green-100 text-green-700',
      error: 'bg-red-100 text-red-700'
    };

    return (
      <Badge variant={variants[status]} className={colors[status]}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const connectWallet = async () => {
    setWalletTest({ status: 'running', message: 'Connecting to Freighter...' });
    
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
            setWalletTest({ 
              status: 'success', 
              message: 'Connected successfully',
              data: { address: address.substring(0, 8) + '...' + address.substring(address.length - 8) }
            });
          } catch (error) {
            setWalletTest({ 
              status: 'error', 
              message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
            });
          }
        }
      });
    } catch (error) {
      setWalletTest({ 
        status: 'error', 
        message: `Failed to initialize wallet: ${error instanceof Error ? error.message : 'Unknown error'}` 
      });
    }
  };

  const testRpcPing = async () => {
    if (!rpcClient) {
      setRpcTest({ status: 'error', message: 'RPC client not initialized' });
      return;
    }

    setRpcTest({ status: 'running', message: 'Pinging Soroban RPC...' });
    
    try {
      const response = await rpcClient.getLatestLedger();
      setRpcTest({ 
        status: 'success', 
        message: 'RPC connection successful',
        data: { 
          ledger: response.sequence,
          url: SOROBAN_RPC_URL
        }
      });
    } catch (error) {
      setRpcTest({ 
        status: 'error', 
        message: `RPC connection failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      });
    }
  };

  const testSignTransaction = async () => {
    if (!walletKit || !publicKey) {
      setSignTest({ status: 'error', message: 'Wallet not connected' });
      return;
    }

    setSignTest({ status: 'running', message: 'Creating and signing dummy transaction...' });

    try {
      const account = new Account(publicKey, '0');
      const transaction = new TransactionBuilder(account, {
        fee: '100',
        networkPassphrase: Networks.TESTNET,
      })
      .addOperation(Operation.bumpSequence({ bumpTo: '1' }))
      .setTimeout(30)
      .build();

      const xdr = transaction.toXDR();
      
      const { signedTxXdr } = await walletKit.signTransaction(xdr, {
        networkPassphrase: Networks.TESTNET,
      });

      setSignTest({ 
        status: 'success', 
        message: 'Transaction signed successfully',
        data: { 
          originalXdr: xdr.substring(0, 20) + '...',
          signedXdr: signedTxXdr.substring(0, 20) + '...'
        }
      });
    } catch (error) {
      setSignTest({ 
        status: 'error', 
        message: `Transaction signing failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      });
    }
  };

  const readTokenInfo = async () => {
    if (!rpcClient) {
      setTokenTest({ status: 'error', message: 'RPC client not initialized' });
      return;
    }

    setTokenTest({ status: 'running', message: 'Reading token contract info...' });

    try {
      const contract = new Contract(TEST_TOKEN_CONTRACT_ID);
      
      const nameOp = contract.call('name');
      const symbolOp = contract.call('symbol');
      const decimalsOp = contract.call('decimals');

      const account = new Account('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', '0');
      
      const nameBuilder = new TransactionBuilder(account, {
        fee: '100',
        networkPassphrase: Networks.TESTNET,
      }).addOperation(nameOp).setTimeout(30);
      
      const symbolBuilder = new TransactionBuilder(account, {
        fee: '100', 
        networkPassphrase: Networks.TESTNET,
      }).addOperation(symbolOp).setTimeout(30);
      
      const decimalsBuilder = new TransactionBuilder(account, {
        fee: '100',
        networkPassphrase: Networks.TESTNET,
      }).addOperation(decimalsOp).setTimeout(30);

      const [nameResult, symbolResult, decimalsResult] = await Promise.all([
        rpcClient.simulateTransaction(nameBuilder.build()),
        rpcClient.simulateTransaction(symbolBuilder.build()),
        rpcClient.simulateTransaction(decimalsBuilder.build())
      ]);

      let tokenInfo: any = {};

      if (nameResult.result) {
        try {
          tokenInfo.name = contract.spec.funcResToNative('name', nameResult.result.retval);
        } catch (e) {
          tokenInfo.name = `Raw: ${nameResult.result.retval}`;
        }
      }

      if (symbolResult.result) {
        try {
          tokenInfo.symbol = contract.spec.funcResToNative('symbol', symbolResult.result.retval);
        } catch (e) {
          tokenInfo.symbol = `Raw: ${symbolResult.result.retval}`;
        }
      }

      if (decimalsResult.result) {
        try {
          tokenInfo.decimals = contract.spec.funcResToNative('decimals', decimalsResult.result.retval);
        } catch (e) {
          tokenInfo.decimals = `Raw: ${decimalsResult.result.retval}`;
        }
      }

      setTokenTest({ 
        status: 'success', 
        message: 'Token info retrieved successfully',
        data: tokenInfo
      });
    } catch (error) {
      setTokenTest({ 
        status: 'error', 
        message: `Token info retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      });
    }
  };

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">SDK Smoke Test</h1>
          <p className="text-muted-foreground">
            Test Stellar Wallets Kit and Soroban SDK integration with Testnet
          </p>
        </div>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Wallet Connection Test
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getStatusIcon(walletTest.status)}
                  <span>{walletTest.message}</span>
                  {getStatusBadge(walletTest.status)}
                </div>
                <Button onClick={connectWallet} disabled={walletTest.status === 'running'}>
                  Connect Freighter
                </Button>
              </div>
              {walletTest.data && (
                <div className="text-sm text-muted-foreground">
                  Connected Address: {walletTest.data.address}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                RPC Connection Test
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getStatusIcon(rpcTest.status)}
                  <span>{rpcTest.message}</span>
                  {getStatusBadge(rpcTest.status)}
                </div>
                <Button onClick={testRpcPing} disabled={rpcTest.status === 'running' || !rpcClient}>
                  Ping RPC
                </Button>
              </div>
              {rpcTest.data && (
                <div className="text-sm text-muted-foreground space-y-1">
                  <div>Latest Ledger: {rpcTest.data.ledger}</div>
                  <div>RPC URL: {rpcTest.data.url}</div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Transaction Signing Test  
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getStatusIcon(signTest.status)}
                  <span>{signTest.message}</span>
                  {getStatusBadge(signTest.status)}
                </div>
                <Button 
                  onClick={testSignTransaction} 
                  disabled={signTest.status === 'running' || !publicKey}
                >
                  Sign Dummy XDR
                </Button>
              </div>
              {signTest.data && (
                <div className="text-sm text-muted-foreground space-y-1">
                  <div>Original XDR: {signTest.data.originalXdr}</div>
                  <div>Signed XDR: {signTest.data.signedXdr}</div>
                </div>
              )}
            </CardContent>
          </Card>

          <Separator />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                Token Contract Test
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Contract ID: {TEST_TOKEN_CONTRACT_ID}
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getStatusIcon(tokenTest.status)}
                  <span>{tokenTest.message}</span>
                  {getStatusBadge(tokenTest.status)}
                </div>
                <Button onClick={readTokenInfo} disabled={tokenTest.status === 'running' || !rpcClient}>
                  Read Token Info
                </Button>
              </div>
              {tokenTest.data && (
                <div className="text-sm text-muted-foreground space-y-1">
                  <div>Name: {JSON.stringify(tokenTest.data.name)}</div>
                  <div>Symbol: {JSON.stringify(tokenTest.data.symbol)}</div>
                  <div>Decimals: {JSON.stringify(tokenTest.data.decimals)}</div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="text-xs text-muted-foreground text-center">
          Network: Testnet | RPC: {SOROBAN_RPC_URL}
        </div>
      </div>
    </div>
  );
}