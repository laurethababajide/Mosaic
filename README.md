# Mosaic

A blockchain-powered decentralized asset management platform that allows anyone to create, invest in, and transparently manage tokenized portfolios — all on-chain.

---

## Overview

Mosaic consists of five main smart contracts that together form a transparent, secure, and performance-driven portfolio management ecosystem:

1. **Portfolio Factory Contract** – Deploys and tracks new tokenized portfolios.
2. **Portfolio Vault Contract** – Holds assets and manages portfolio-specific rules.
3. **Portfolio Token Contract** – Issues tradable ERC-20-style tokens representing portfolio shares.
4. **Performance Fee Contract** – Automatically calculates and distributes fees to portfolio managers based on performance.
5. **Treasury Router Contract** – Handles fund flows between portfolios, managers, and investors.

---

## Features

- **Create tokenized portfolios** with customizable asset strategies  
- **Fractional ownership** via portfolio share tokens  
- **On-chain performance tracking** for transparency  
- **Automated fee payouts** to managers only when portfolios perform  
- **Investor-friendly deposit and withdrawal system**  
- **Full transparency** with every asset visible on-chain  

---

## Smart Contracts

### Portfolio Factory Contract
- Deploys new portfolio vaults
- Registers portfolio metadata (name, manager, asset whitelist)
- Emits events for portfolio creation
- Enables permissionless portfolio setup

### Portfolio Vault Contract
- Holds and manages portfolio assets
- Allows investor deposits and withdrawals
- Executes buy/sell actions for assets (via integrated DEX calls or oracles)
- Enforces asset allocation rules

### Portfolio Token Contract
- ERC-20-style fungible tokens representing portfolio shares
- Minted when investors deposit, burned when they withdraw
- Tradable across marketplaces for liquidity

### Performance Fee Contract
- Calculates manager fees based on portfolio profit
- Automates fee payouts in the same asset or stablecoins
- Tracks historical fee performance

### Treasury Router Contract
- Routes deposits and withdrawals to correct vaults
- Distributes fees to managers
- Maintains an on-chain log of all financial movements

---

## Installation

1. Install [Clarinet CLI](https://docs.hiro.so/clarinet/getting-started)  
2. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/mosaic.git
    ```
3. Run tests:
    ```bash
    npm test
    ```
4. Deploy contracts:
    ```bash
    clarinet deploy
    ```

--- 

## Usage

Each smart contract can function independently but is designed to integrate seamlessly for a complete decentralized asset management experience.
Refer to individual contract documentation for available functions, parameters, and usage examples.

---

## License

MIT License