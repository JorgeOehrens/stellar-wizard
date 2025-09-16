import React from 'react';
import MarkdownRenderer from './ui/markdown-renderer';

const exampleMarkdown = `# 🎨 NFT Creation Guide

Welcome to the **Stellar NFT Wizard**! This is a demonstration of our markdown rendering capabilities.

## ✨ Features Available

- **Bold text** and *italic text*
- Lists and sublists
- Code blocks with syntax highlighting
- Tables and quotes
- Links and more!

### 📝 Code Example

Here's how you can create an NFT collection:

\`\`\`json
{
  "name": "My Collection",
  "symbol": "MC",
  "totalSupply": 1000,
  "royalties": 5.0
}
\`\`\`

### 📊 Collection Stats

| Property | Value |
|----------|-------|
| Network | Stellar Testnet |
| Token Standard | SEP-41 |
| Max Supply | 10,000 |

> **Tip:** Always test your NFTs on testnet first before deploying to mainnet!

### 🔗 Useful Links

- [Stellar Documentation](https://developers.stellar.org)
- [NFT Marketplace](https://stellar.expert)

---

Ready to create your first NFT? Let's get started! 🚀`;

export default function MarkdownExample() {
  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-card text-card-foreground border rounded-lg p-6">
        <MarkdownRenderer
          content={exampleMarkdown}
          className="prose prose-sm max-w-none dark:prose-invert"
        />
      </div>
    </div>
  );
}