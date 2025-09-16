import { NextRequest } from 'next/server';

export interface AuthResult {
  publicKey: string | null;
  authMethod: 'kit' | 'google' | null;
}

/**
 * Extract user's wallet public key from request headers
 * This function expects the client to send wallet info in headers
 */
export async function getUserPublicKey(request: NextRequest): Promise<string | null> {
  try {
    // Check for wallet address in headers (sent from client)
    const walletAddress = request.headers.get('x-wallet-address');
    const authMethod = request.headers.get('x-auth-method');

    if (walletAddress && authMethod) {
      // Basic validation - Stellar public keys start with G and are 56 characters
      if (walletAddress.startsWith('G') && walletAddress.length === 56) {
        return walletAddress;
      }
    }

    return null;
  } catch (error) {
    console.error('Error extracting wallet address:', error);
    return null;
  }
}

/**
 * Extract full auth information from request
 */
export async function getAuthInfo(request: NextRequest): Promise<AuthResult> {
  try {
    const publicKey = await getUserPublicKey(request);
    const authMethod = request.headers.get('x-auth-method') as 'kit' | 'google' | null;

    return {
      publicKey,
      authMethod: publicKey ? authMethod : null
    };
  } catch (error) {
    console.error('Error extracting auth info:', error);
    return {
      publicKey: null,
      authMethod: null
    };
  }
}

/**
 * Validate that user is authenticated
 */
export async function requireAuth(request: NextRequest): Promise<string> {
  const publicKey = await getUserPublicKey(request);

  if (!publicKey) {
    throw new Error('Authentication required. Please connect your wallet.');
  }

  return publicKey;
}