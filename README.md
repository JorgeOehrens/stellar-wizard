# 🧙‍♂️ Stellar Wizard - From Prompt to Blockchain in One Click

**AI-Powered NFT Creation and Blockchain Interaction Platform for Stellar**

![Stellar Wizard](https://img.shields.io/badge/Stellar-Wizard-FFD600?style=for-the-badge&logo=stellar&logoColor=black)
![Next.js](https://img.shields.io/badge/Next.js-15.2.4-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4-412991?style=for-the-badge&logo=openai&logoColor=white)
![Soroban](https://img.shields.io/badge/Soroban-Smart%20Contracts-00D4FF?style=for-the-badge&logo=stellar&logoColor=white)

## 🌟 Overview

Stellar Wizard is a revolutionary platform that enables users to create NFT collections, deploy DeFi strategies, and interact with the Stellar blockchain using natural language. No coding required—just describe what you want to build and watch it come to life!

### ✨ Key Features

- 🎨 **AI-Powered NFT Creation** - Create collections using natural language
- 🤖 **Intelligent Artwork Generation** - AI-generated images with iterative styling
- 🔐 **Multi-Auth Support** - Google OAuth and Freighter wallet integration
- 🚀 **One-Click Deployment** - From concept to blockchain in seconds
- 💰 **Balance Tracking** - Real-time wallet balance display and management
- 📋 **Smart Contract Explorer** - Direct integration with Stellar Expert
- 🎯 **Factory Pattern** - Scalable NFT collection deployment

## 🏗️ Architecture

### Frontend Stack
- **Framework**: Next.js 15.2.4 with TypeScript
- **Styling**: Tailwind CSS with custom HackMeridian theme
- **UI Components**: Radix UI primitives with custom design system
- **Authentication**: Google OAuth + Stellar Wallets Kit
- **State Management**: React Context API
- **Image Generation**: OpenAI DALL-E integration
- **Blockchain**: Stellar SDK + Soroban smart contracts

### Smart Contracts
- **Language**: Rust (Soroban)
- **Pattern**: Factory/Registry pattern for scalable NFT deployment
- **Network**: Stellar Testnet (Mainnet coming soon)
- **Contract ID**: `CD3W76OGYGHT4X5TMNUXWGEEVUBES67D3ZU4BALSW3BO23IMPT6E662A`

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Stellar CLI (for smart contract interaction)
- OpenAI API key
- Google OAuth credentials (optional)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/stellar-wizard.git
cd stellar-wizard

# Install dependencies
cd front-end
npm install

# Set up environment variables
cp .env.example .env.local
# Add your API keys and configuration
```

### Environment Variables

```env
# OpenAI
OPENAI_API_KEY=your_openai_api_key

# Google OAuth (optional)
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id

# Stellar Network
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_FACTORY_CONTRACT_ID=CD3W76OGYGHT4X5TMNUXWGEEVUBES67D3ZU4BALSW3BO23IMPT6E662A

# Supabase (for image storage)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Development

```bash
# Start development server
npm run dev

# Open browser
open http://localhost:3000
```

## 🔗 Smart Contracts

### Factory Pattern Architecture

Our smart contract system uses a Factory/Registry pattern for efficient NFT collection deployment:

```rust
// Factory Contract Functions
pub fn create_collection(
    env: Env,
    creator: Address,
    name: String,
    symbol: String,
    uri_base: String,
    royalties_bps: u32,
) -> Result<u64, Error>

pub fn mint(
    env: Env,
    collection_id: u64,
    to: Address,
    amount: u64,
) -> Result<(), Error>
```

### Contract Deployment

1. **Factory Contract**: Deployed once, handles all collection creation
2. **Collection Contracts**: Individual NFT contracts created via factory
3. **Fee Routing**: Automatic fee distribution and royalty handling

### CLI Commands

```bash
# Create a new NFT collection
stellar contract invoke \
  --id CD3W76OGYGHT4X5TMNUXWGEEVUBES67D3ZU4BALSW3BO23IMPT6E662A \
  --source deployer \
  --network testnet \
  -- create_collection \
  --creator G...YOUR_ADDRESS \
  --name "My Collection" \
  --symbol "MYC" \
  --uri_base "https://api.example.com/metadata/" \
  --royalties 250

# Mint NFTs to a collection
stellar contract invoke \
  --id CD3W76OGYGHT4X5TMNUXWGEEVUBES67D3ZU4BALSW3BO23IMPT6E662A \
  --source deployer \
  --network testnet \
  -- mint \
  --collection_id 1 \
  --to G...RECIPIENT_ADDRESS \
  --amount 100
```

## 🎨 AI Features

### Natural Language Processing
- **Intent Recognition**: Understands user requirements from conversational input
- **Parameter Extraction**: Automatically extracts collection details (name, supply, etc.)
- **Validation**: Ensures all required fields are collected before proceeding

### Image Generation
- **DALL-E Integration**: High-quality AI-generated artwork
- **Iterative Styling**: Users can refine images with additional prompts
- **Multiple Variants**: Generate variations of the same concept
- **Metadata Tracking**: Full history of image generations and modifications

### Conversation Flow
```
User: "I want to create a collection about space cats"
AI: "Great! I'll help you create a space cats NFT collection.
     What would you like to call it?"
User: "Cosmic Felines"
AI: "Perfect! How many NFTs should we create in the Cosmic Felines collection?"
User: "500"
AI: "Excellent! Would you like me to generate artwork for your space cats?"
```

## 🔐 Authentication & Wallet Integration

### Supported Wallets
- **Freighter**: Native Stellar wallet browser extension
- **Google OAuth**: Social authentication with Stellar account creation
- **Hardware Wallets**: Via Stellar Wallets Kit integration

### Authentication Flow
```typescript
// Google OAuth Flow
const result = await socialSDK.authenticateWithGoogleCredential(credentialResponse);
if (result.success) {
  setPublicKey(result.account.publicKey);
  setAuthMethod('google');
}

// Freighter Wallet Flow
await kit.openModal({
  onWalletSelected: async (option) => {
    kit.setWallet(option.id);
    const { address } = await kit.getAddress();
    setPublicKey(address);
    setAuthMethod('kit');
  }
});
```

### Balance Management
- **Real-time Updates**: Automatic balance refresh on network/wallet changes
- **Multi-Asset Support**: XLM and custom Stellar assets
- **Manual Refresh**: User-triggered balance updates

## 🎯 User Experience

### Conversational Interface
- **Chat-based Creation**: Natural language NFT collection setup
- **Progress Tracking**: Visual progress indicators through creation steps
- **Error Handling**: Graceful fallbacks and helpful error messages

### Workflow Phases
1. **🗣️ Chat Collection**: AI-guided collection parameter gathering
2. **🎨 Artwork Creation**: AI image generation with iterative refinement
3. **✅ Plan Review**: Final confirmation of all collection details
4. **📋 CLI Commands**: Generated commands for manual deployment (optional)
5. **🚀 Deployment**: Automated smart contract interaction

### Responsive Design
- **Mobile-First**: Optimized for all device sizes
- **Dark/Light Themes**: Automatic theme detection and manual toggle
- **Accessibility**: WCAG compliant with screen reader support

## 🔧 Technical Implementation

### State Management
```typescript
interface NFTPlan {
  collectionName?: string;
  symbol?: string;
  totalSupply?: number;
  description?: string;
  royaltiesPct?: number;
  mediaUrl?: string;
  mediaPrompt?: string;
  airdrop?: { recipient: string; amount?: number } | null;
  network: 'TESTNET' | 'MAINNET';
  isComplete: boolean;
  needsInfo: string[];
}
```

### API Routes
- `/api/ai/nft-wizard` - AI conversation handling
- `/api/ai/image/generate` - DALL-E image generation
- `/api/nft/mint` - Smart contract transaction building
- `/api/stellar/submit` - Transaction submission to Stellar network

### Image Pipeline
1. **Generation**: OpenAI DALL-E API integration
2. **Storage**: Supabase storage with CDN
3. **Optimization**: Next.js Image component with lazy loading
4. **Metadata**: IPFS-compatible metadata generation

## 🚧 Upcoming Features

### DeFi Integration
- **Yield Farming**: Automated farming strategies
- **Lending & Borrowing**: Decentralized lending protocols
- **Auto-Trading**: AI-powered trading bots

### Advanced NFT Features
- **Marketplace**: Built-in NFT marketplace
- **Batch Operations**: Bulk minting and transfers
- **Metadata Upgrades**: Dynamic NFT metadata updates
- **Royalty Distribution**: Automated royalty payments

## 📊 Project Structure

```
stellar-wizard/
├── front-end/                 # Next.js frontend application
│   ├── app/                   # App router pages
│   │   ├── providers/         # React context providers
│   │   ├── api/              # API route handlers
│   │   ├── nfts/             # NFT creation page
│   │   ├── defi/             # DeFi features (coming soon)
│   │   ├── dashboard/        # User dashboard
│   │   ├── created/          # User's created collections
│   │   ├── marketplace/      # NFT marketplace
│   │   ├── swap/            # Token swap interface
│   │   └── lend/            # Lending platform
│   ├── components/           # Reusable React components
│   │   ├── ui/              # Base UI components
│   │   ├── NFTCreator.tsx   # Main NFT creation interface
│   │   ├── NFTCard.tsx      # NFT display component
│   │   ├── NFTDetailModal.tsx # NFT detail view
│   │   ├── HeroSection.tsx  # Landing page hero
│   │   ├── TopNav.tsx       # Navigation component
│   │   ├── ChatMessage.tsx  # Chat UI component
│   │   ├── ChatPane.jsx     # Chat interface
│   │   └── ...
│   ├── hooks/               # Custom React hooks
│   │   └── useLike.ts      # Like functionality hook
│   ├── lib/                # Utility libraries
│   │   ├── auth.ts         # Authentication utilities
│   │   └── jsonStore.ts    # JSON data storage
│   ├── data/               # Static data files
│   │   └── likes.json      # Likes storage
│   ├── styles/             # Global styles and themes
│   └── public/             # Static assets
│       ├── stellar.svg     # Stellar logo
│       ├── wizzard.svg     # Wizard mascot
│       ├── magic-ball.svg  # Magic ball decoration
│       └── background.webp # Background image
├── backend/                 # Backend services and contracts
│   ├── contracts/          # Soroban smart contracts
│   │   └── nft_factory/    # NFT Factory contract
│   ├── scripts/            # Deployment and utility scripts
│   │   ├── create-collection.sh
│   │   ├── deploy-factory.sh
│   │   └── mint-from-factory.sh
│   ├── target/             # Compiled contracts
│   └── .env               # Environment configuration
├── stellar-social-sdk/      # Social authentication SDK
│   ├── src/                # SDK source code
│   ├── dist/               # Compiled SDK
│   └── node_modules/       # SDK dependencies
├── node_modules/           # Root dependencies
├── check_contract.js       # Contract verification script
├── get_nfts.js            # NFT fetching utility
├── parse_nft_collections.js # Collection parser
├── simple_nft_parser.js   # Simple NFT parser
├── package.json           # Root package config
└── README.md              # This file
```

## 🛠️ Development Workflow

### Local Development
```bash
# Start development server
npm run dev

# Type checking
npm run type-check

# Linting
npm run lint

# Build for production
npm run build
```

### Smart Contract Development
```bash
# Build contracts
cargo build --target wasm32-unknown-unknown --release

# Deploy to testnet
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/nft_factory.wasm \
  --source deployer \
  --network testnet

# Run tests
cargo test
```

### Testing Strategy
- **Unit Tests**: Individual component testing
- **Integration Tests**: API route testing
- **E2E Tests**: Full user flow testing
- **Smart Contract Tests**: Soroban contract testing

## 📈 Performance Optimizations

### Frontend Optimizations
- **Code Splitting**: Dynamic imports for large components
- **Image Optimization**: Next.js Image component with WebP
- **Bundle Analysis**: Webpack bundle analyzer for size optimization
- **Caching**: Aggressive caching strategies for API responses

### Smart Contract Optimizations
- **Gas Efficiency**: Optimized Rust code for minimal transaction fees
- **Batch Operations**: Multiple operations in single transaction
- **State Minimization**: Efficient data storage patterns

## 🔒 Security Considerations

### Frontend Security
- **Input Validation**: Comprehensive input sanitization
- **XSS Protection**: Content Security Policy implementation
- **API Rate Limiting**: Request throttling and abuse prevention
- **Environment Variable Security**: Proper secret management

### Smart Contract Security
- **Access Controls**: Proper authorization checks
- **Reentrancy Protection**: Guards against common attacks
- **Input Validation**: Comprehensive parameter validation
- **Audit Readiness**: Clean, documented code for security reviews

## 🤝 Contributing

We welcome contributions from the community! Please see our contributing guidelines:

1. **Fork the Repository**: Create your own fork of the project
2. **Create Feature Branch**: `git checkout -b feature/amazing-feature`
3. **Commit Changes**: `git commit -m 'Add amazing feature'`
4. **Push to Branch**: `git push origin feature/amazing-feature`
5. **Open Pull Request**: Submit PR with detailed description

### Development Guidelines
- Follow TypeScript strict mode
- Use conventional commit messages
- Add tests for new features
- Update documentation as needed
- Follow the established code style

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Stellar Development Foundation** for the amazing blockchain platform
- **OpenAI** for powerful AI capabilities
- **Vercel** for seamless deployment and hosting
- **HackMeridian** community for inspiration and support

## 📞 Support

- **Documentation**: [docs.stellarwizard.com](https://docs.stellarwizard.com)
- **Discord**: [Join our community](https://discord.gg/stellarwizard)
- **Issues**: [GitHub Issues](https://github.com/your-org/stellar-wizard/issues)
- **Email**: support@stellarwizard.com

---

**Built with ❤️ for the Stellar ecosystem**

*From prompt to blockchain in one click* 🚀