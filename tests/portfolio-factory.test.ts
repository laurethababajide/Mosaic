 
import { describe, it, expect, beforeEach } from "vitest";

interface Portfolio {
  name: string;
  manager: string;
  vaultContract: string;
  tokenContract: string;
  createdAt: bigint;
  managementFee: bigint;
  performanceFee: bigint;
  strategyId: bigint | null;
  isActive: boolean;
}

interface ManagerPermissions {
  canCreate: boolean;
  maxPortfolios: bigint;
  portfoliosCreated: bigint;
}

interface Strategy {
  description: string;
  creator: string;
  isApproved: boolean;
}

interface Event {
  eventType: string;
  portfolioId: bigint | null;
  caller: string;
  blockHeight: bigint;
  timestamp: bigint;
}

interface MockContract {
  admin: string;
  contractEnabled: boolean;
  portfolioCount: bigint;
  maxPortfolioFee: bigint;
  portfolios: Map<string, Portfolio>;
  managerPermissions: Map<string, ManagerPermissions>;
  strategies: Map<string, Strategy>;
  events: Map<string, Event>;
  lastEventId: bigint;

  isAdmin(caller: string): boolean;
  setEnabled(caller: string, enabled: boolean): { value: boolean } | { error: number };
  setMaxPortfolioFee(caller: string, fee: bigint): { value: boolean } | { error: number };
  approveManager(caller: string, manager: string, canCreate: boolean, maxPortfolios: bigint): { value: boolean } | { error: number };
  createPortfolio(
    caller: string,
    name: string,
    vaultContract: string,
    tokenContract: string,
    managementFee: bigint,
    performanceFee: bigint,
    strategyId: bigint | null
  ): { value: bigint } | { error: number };
  registerStrategy(caller: string, description: string, strategyId: bigint): { value: bigint } | { error: number };
  approveStrategy(caller: string, strategyId: bigint): { value: boolean } | { error: number };
}

const mockContract: MockContract = {
  admin: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
  contractEnabled: true,
  portfolioCount: 0n,
  maxPortfolioFee: 1000n,
  portfolios: new Map(),
  managerPermissions: new Map(),
  strategies: new Map(),
  events: new Map(),
  lastEventId: 0n,

  isAdmin(caller: string) {
    return caller === this.admin;
  },

  setEnabled(caller: string, enabled: boolean) {
    if (!this.isAdmin(caller)) return { error: 100 };
    this.contractEnabled = enabled;
    this.events.set((++this.lastEventId).toString(), {
      eventType: enabled ? "contract-enabled" : "contract-disabled",
      portfolioId: null,
      caller,
      blockHeight: 100n,
      timestamp: 1234567890n
    });
    return { value: enabled };
  },

  setMaxPortfolioFee(caller: string, fee: bigint) {
    if (!this.isAdmin(caller)) return { error: 100 };
    if (fee > 10000n) return { error: 106 };
    this.maxPortfolioFee = fee;
    this.events.set((++this.lastEventId).toString(), {
      eventType: "max-fee-updated",
      portfolioId: null,
      caller,
      blockHeight: 100n,
      timestamp: 1234567890n
    });
    return { value: true };
  },

  approveManager(caller: string, manager: string, canCreate: boolean, maxPortfolios: bigint) {
    if (!this.isAdmin(caller)) return { error: 100 };
    if (manager === "SP000000000000000000002Q6VF78") return { error: 104 };
    if (maxPortfolios === 0n) return { error: 108 };
    this.managerPermissions.set(manager, { canCreate, maxPortfolios, portfoliosCreated: 0n });
    this.events.set((++this.lastEventId).toString(), {
      eventType: "manager-approved",
      portfolioId: null,
      caller,
      blockHeight: 100n,
      timestamp: 1234567890n
    });
    return { value: true };
  },

  createPortfolio(caller: string, name: string, vaultContract: string, tokenContract: string, managementFee: bigint, performanceFee: bigint, strategyId: bigint | null) {
    if (!this.contractEnabled) return { error: 105 };
    const managerData = this.managerPermissions.get(caller) || { canCreate: false, maxPortfolios: 0n, portfoliosCreated: 0n };
    if (!managerData.canCreate) return { error: 100 };
    if (managerData.portfoliosCreated >= managerData.maxPortfolios) return { error: 100 };
    if (name.length === 0 || name.length > 64) return { error: 101 };
    if (vaultContract === "SP000000000000000000002Q6VF78" || tokenContract === "SP000000000000000000002Q6VF78") return { error: 104 };
    if (managementFee > this.maxPortfolioFee || performanceFee > this.maxPortfolioFee) return { error: 106 };
    if (strategyId !== null && !this.strategies.has(strategyId.toString())) return { error: 107 };

    const portfolioId = ++this.portfolioCount;
    this.portfolios.set(portfolioId.toString(), {
      name,
      manager: caller,
      vaultContract,
      tokenContract,
      createdAt: 100n,
      managementFee,
      performanceFee,
      strategyId,
      isActive: true
    });
    this.managerPermissions.set(caller, { ...managerData, portfoliosCreated: managerData.portfoliosCreated + 1n });
    this.events.set((++this.lastEventId).toString(), {
      eventType: "portfolio-created",
      portfolioId,
      caller,
      blockHeight: 100n,
      timestamp: 1234567890n
    });
    return { value: portfolioId };
  },

  registerStrategy(caller: string, description: string, strategyId: bigint) {
    if (!this.contractEnabled) return { error: 105 };
    if (description.length === 0 || description.length > 256) return { error: 109 };
    if (strategyId === 0n) return { error: 107 };
    if (this.strategies.has(strategyId.toString())) return { error: 107 };
    this.strategies.set(strategyId.toString(), { description, creator: caller, isApproved: false });
    this.events.set((++this.lastEventId).toString(), {
      eventType: "strategy-registered",
      portfolioId: null,
      caller,
      blockHeight: 100n,
      timestamp: 1234567890n
    });
    return { value: strategyId };
  },

  approveStrategy(caller: string, strategyId: bigint) {
    if (!this.isAdmin(caller)) return { error: 100 };
    if (strategyId === 0n) return { error: 107 };
    const strategy = this.strategies.get(strategyId.toString());
    if (!strategy) return { error: 107 };
    this.strategies.set(strategyId.toString(), { ...strategy, isApproved: true });
    this.events.set((++this.lastEventId).toString(), {
      eventType: "strategy-approved",
      portfolioId: null,
      caller,
      blockHeight: 100n,
      timestamp: 1234567890n
    });
    return { value: true };
  }
};

describe("Mosaic Portfolio Factory Contract", () => {
  beforeEach(() => {
    mockContract.admin = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";
    mockContract.contractEnabled = true;
    mockContract.portfolioCount = 0n;
    mockContract.maxPortfolioFee = 1000n;
    mockContract.portfolios = new Map();
    mockContract.managerPermissions = new Map();
    mockContract.strategies = new Map();
    mockContract.events = new Map();
    mockContract.lastEventId = 0n;
  });

  it("should allow admin to set contract enabled state", () => {
    const result = mockContract.setEnabled(mockContract.admin, false);
    expect(result).toEqual({ value: false });
    expect(mockContract.contractEnabled).toBe(false);
    expect(mockContract.events.get("1")?.eventType).toBe("contract-disabled");
  });

  it("should prevent non-admin from setting enabled state", () => {
    const result = mockContract.setEnabled("ST2CY5...", false);
    expect(result).toEqual({ error: 100 });
  });

  it("should allow admin to set max portfolio fee", () => {
    const result = mockContract.setMaxPortfolioFee(mockContract.admin, 500n);
    expect(result).toEqual({ value: true });
    expect(mockContract.maxPortfolioFee).toBe(500n);
    expect(mockContract.events.get("1")?.eventType).toBe("max-fee-updated");
  });

  it("should prevent invalid fee settings", () => {
    const result = mockContract.setMaxPortfolioFee(mockContract.admin, 15000n);
    expect(result).toEqual({ error: 106 });
  });

  it("should allow admin to approve manager", () => {
    const result = mockContract.approveManager(mockContract.admin, "ST2CY5...", true, 5n);
    expect(result).toEqual({ value: true });
    expect(mockContract.managerPermissions.get("ST2CY5...")).toEqual({
      canCreate: true,
      maxPortfolios: 5n,
      portfoliosCreated: 0n
    });
    expect(mockContract.events.get("1")?.eventType).toBe("manager-approved");
  });

  it("should prevent approving manager with zero max portfolios", () => {
    const result = mockContract.approveManager(mockContract.admin, "ST2CY5...", true, 0n);
    expect(result).toEqual({ error: 108 });
  });

  it("should allow approved manager to create portfolio", () => {
    mockContract.approveManager(mockContract.admin, "ST2CY5...", true, 5n);
    const result = mockContract.createPortfolio(
      "ST2CY5...",
      "Test Portfolio",
      "ST3NB...",
      "ST4RE...",
      500n,
      300n,
      null
    );
    expect(result).toEqual({ value: 1n });
    const portfolio = mockContract.portfolios.get("1");
    expect(portfolio).toEqual({
      name: "Test Portfolio",
      manager: "ST2CY5...",
      vaultContract: "ST3NB...",
      tokenContract: "ST4RE...",
      createdAt: 100n,
      managementFee: 500n,
      performanceFee: 300n,
      strategyId: null,
      isActive: true
    });
    expect(mockContract.events.get("2")?.eventType).toBe("portfolio-created");
  });

  it("should prevent portfolio creation with invalid name", () => {
    mockContract.approveManager(mockContract.admin, "ST2CY5...", true, 5n);
    const result = mockContract.createPortfolio(
      "ST2CY5...",
      "",
      "ST3NB...",
      "ST4RE...",
      500n,
      300n,
      null
    );
    expect(result).toEqual({ error: 101 });
  });

  it("should prevent portfolio creation when contract is disabled", () => {
    mockContract.setEnabled(mockContract.admin, false);
    mockContract.approveManager(mockContract.admin, "ST2CY5...", true, 5n);
    const result = mockContract.createPortfolio(
      "ST2CY5...",
      "Test Portfolio",
      "ST3NB...",
      "ST4RE...",
      500n,
      300n,
      null
    );
    expect(result).toEqual({ error: 105 });
  });

  it("should allow manager to register strategy", () => {
    const result = mockContract.registerStrategy("ST2CY5...", "Test Strategy", 1n);
    expect(result).toEqual({ value: 1n });
    expect(mockContract.strategies.get("1")).toEqual({
      description: "Test Strategy",
      creator: "ST2CY5...",
      isApproved: false
    });
    expect(mockContract.events.get("1")?.eventType).toBe("strategy-registered");
  });

  it("should prevent strategy registration with invalid description", () => {
    const result = mockContract.registerStrategy("ST2CY5...", "", 1n);
    expect(result).toEqual({ error: 109 });
  });

  it("should prevent strategy registration with zero strategy ID", () => {
    const result = mockContract.registerStrategy("ST2CY5...", "Test Strategy", 0n);
    expect(result).toEqual({ error: 107 });
  });

  it("should allow admin to approve strategy", () => {
    mockContract.registerStrategy("ST2CY5...", "Test Strategy", 1n);
    const result = mockContract.approveStrategy(mockContract.admin, 1n);
    expect(result).toEqual({ value: true });
    expect(mockContract.strategies.get("1")?.isApproved).toBe(true);
    expect(mockContract.events.get("2")?.eventType).toBe("strategy-approved");
  });

  it("should prevent approving strategy with zero ID", () => {
    const result = mockContract.approveStrategy(mockContract.admin, 0n);
    expect(result).toEqual({ error: 107 });
  });
});