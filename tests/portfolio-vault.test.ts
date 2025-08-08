 
import { describe, it, expect, beforeEach } from "vitest";

interface Asset {
	assetContract: string;
	amount: bigint;
}

interface InvestorBalance {
	balance: bigint;
}

interface Event {
	eventType: string;
	investor: string | null;
	amount: bigint | null;
	assetId: bigint | null;
	caller: string;
	blockHeight: bigint;
	timestamp: bigint;
}

interface MockContract {
	manager: string;
	portfolioId: bigint;
	tokenContract: string;
	contractEnabled: boolean;
	totalValueLocked: bigint;
	investorBalances: Map<string, InvestorBalance>;
	assets: Map<string, Asset>;
	events: Map<string, Event>;
	lastEventId: bigint;

	isManager(caller: string): boolean;
	initialize(
		caller: string,
		portfolioId: bigint,
		tokenContract: string
	): { value: boolean } | { error: number };
	setEnabled(
		caller: string,
		enabled: boolean
	): { value: boolean } | { error: number };
	deposit(
		caller: string,
		amount: bigint
	): { value: boolean } | { error: number };
	withdraw(
		caller: string,
		amount: bigint
	): { value: boolean } | { error: number };
	addAsset(
		caller: string,
		assetId: bigint,
		assetContract: string,
		amount: bigint
	): { value: boolean } | { error: number };
	removeAsset(
		caller: string,
		assetId: bigint
	): { value: boolean } | { error: number };
}

const mockContract: MockContract = {
	manager: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
	portfolioId: 0n,
	tokenContract: "SP000000000000000000002Q6VF78",
	contractEnabled: true,
	totalValueLocked: 0n,
	investorBalances: new Map(),
	assets: new Map(),
	events: new Map(),
	lastEventId: 0n,

	isManager(caller: string) {
		return caller === this.manager;
	},

	initialize(caller: string, portfolioId: bigint, tokenContract: string) {
		if (!this.isManager(caller)) return { error: 100 };
		if (!this.contractEnabled) return { error: 102 };
		if (tokenContract === "SP000000000000000000002Q6VF78")
			return { error: 103 };
		if (portfolioId === 0n) return { error: 106 };
		this.portfolioId = portfolioId;
		this.tokenContract = tokenContract;
		this.events.set((++this.lastEventId).toString(), {
			eventType: "vault-initialized",
			investor: null,
			amount: null,
			assetId: null,
			caller,
			blockHeight: 100n,
			timestamp: 1234567890n,
		});
		return { value: true };
	},

	setEnabled(caller: string, enabled: boolean) {
		if (!this.isManager(caller)) return { error: 100 };
		this.contractEnabled = enabled;
		this.events.set((++this.lastEventId).toString(), {
			eventType: enabled ? "vault-enabled" : "vault-disabled",
			investor: null,
			amount: null,
			assetId: null,
			caller,
			blockHeight: 100n,
			timestamp: 1234567890n,
		});
		return { value: enabled };
	},

	deposit(caller: string, amount: bigint) {
		if (!this.contractEnabled) return { error: 102 };
		if (amount === 0n) return { error: 101 };
		if (this.tokenContract === "SP000000000000000000002Q6VF78")
			return { error: 105 };
		const currentBalance = this.investorBalances.get(caller)?.balance || 0n;
		this.investorBalances.set(caller, { balance: currentBalance + amount });
		this.totalValueLocked += amount;
		this.events.set((++this.lastEventId).toString(), {
			eventType: "deposit",
			investor: caller,
			amount,
			assetId: null,
			caller,
			blockHeight: 100n,
			timestamp: 1234567890n,
		});
		return { value: true };
	},

	withdraw(caller: string, amount: bigint) {
		if (!this.contractEnabled) return { error: 102 };
		if (amount === 0n) return { error: 101 };
		const currentBalance = this.investorBalances.get(caller)?.balance || 0n;
		if (currentBalance < amount) return { error: 104 };
		this.investorBalances.set(caller, { balance: currentBalance - amount });
		this.totalValueLocked -= amount;
		this.events.set((++this.lastEventId).toString(), {
			eventType: "withdraw",
			investor: caller,
			amount,
			assetId: null,
			caller,
			blockHeight: 100n,
			timestamp: 1234567890n,
		});
		return { value: true };
	},

	addAsset(
		caller: string,
		assetId: bigint,
		assetContract: string,
		amount: bigint
	) {
		if (!this.isManager(caller)) return { error: 100 };
		if (!this.contractEnabled) return { error: 102 };
		if (amount === 0n) return { error: 101 };
		if (assetContract === "SP000000000000000000002Q6VF78")
			return { error: 103 };
		if (this.assets.has(assetId.toString())) return { error: 107 };
		this.assets.set(assetId.toString(), { assetContract, amount });
		this.events.set((++this.lastEventId).toString(), {
			eventType: "asset-added",
			investor: null,
			amount,
			assetId,
			caller,
			blockHeight: 100n,
			timestamp: 1234567890n,
		});
		return { value: true };
	},

	removeAsset(caller: string, assetId: bigint) {
		if (!this.isManager(caller)) return { error: 100 };
		if (!this.contractEnabled) return { error: 102 };
		if (!this.assets.has(assetId.toString())) return { error: 107 };
		const asset = this.assets.get(assetId.toString())!;
		this.assets.delete(assetId.toString());
		this.events.set((++this.lastEventId).toString(), {
			eventType: "asset-removed",
			investor: null,
			amount: asset.amount,
			assetId,
			caller,
			blockHeight: 100n,
			timestamp: 1234567890n,
		});
		return { value: true };
	},
};

describe("Mosaic Portfolio Vault Contract", () => {
	beforeEach(() => {
		mockContract.manager = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";
		mockContract.portfolioId = 0n;
		mockContract.tokenContract = "SP000000000000000000002Q6VF78";
		mockContract.contractEnabled = true;
		mockContract.totalValueLocked = 0n;
		mockContract.investorBalances = new Map();
		mockContract.assets = new Map();
		mockContract.events = new Map();
		mockContract.lastEventId = 0n;
	});

	it("should allow manager to initialize vault", () => {
		const result = mockContract.initialize(
			mockContract.manager,
			1n,
			"ST2CY5..."
		);
		expect(result).toEqual({ value: true });
		expect(mockContract.portfolioId).toBe(1n);
		expect(mockContract.tokenContract).toBe("ST2CY5...");
		expect(mockContract.events.get("1")?.eventType).toBe("vault-initialized");
	});

	it("should prevent non-manager from initializing vault", () => {
		const result = mockContract.initialize("ST2CY5...", 1n, "ST3NB...");
		expect(result).toEqual({ error: 100 });
	});

	it("should prevent initialization with zero portfolio ID", () => {
		const result = mockContract.initialize(
			mockContract.manager,
			0n,
			"ST2CY5..."
		);
		expect(result).toEqual({ error: 106 });
	});

	it("should allow manager to set enabled state", () => {
		const result = mockContract.setEnabled(mockContract.manager, false);
		expect(result).toEqual({ value: false });
		expect(mockContract.contractEnabled).toBe(false);
		expect(mockContract.events.get("1")?.eventType).toBe("vault-disabled");
	});

	it("should prevent non-manager from setting enabled state", () => {
		const result = mockContract.setEnabled("ST2CY5...", false);
		expect(result).toEqual({ error: 100 });
	});

	it("should allow investor to deposit funds", () => {
		mockContract.initialize(mockContract.manager, 1n, "ST2CY5...");
		const result = mockContract.deposit("ST3NB...", 1000n);
		expect(result).toEqual({ value: true });
		expect(mockContract.investorBalances.get("ST3NB...")?.balance).toBe(1000n);
		expect(mockContract.totalValueLocked).toBe(1000n);
		expect(mockContract.events.get("2")?.eventType).toBe("deposit");
	});

	it("should prevent deposit with zero amount", () => {
		mockContract.initialize(mockContract.manager, 1n, "ST2CY5...");
		const result = mockContract.deposit("ST3NB...", 0n);
		expect(result).toEqual({ error: 101 });
	});

	it("should prevent deposit when contract is disabled", () => {
		mockContract.initialize(mockContract.manager, 1n, "ST2CY5...");
		mockContract.setEnabled(mockContract.manager, false);
		const result = mockContract.deposit("ST3NB...", 1000n);
		expect(result).toEqual({ error: 102 });
	});

	it("should allow investor to withdraw funds", () => {
		mockContract.initialize(mockContract.manager, 1n, "ST2CY5...");
		mockContract.deposit("ST3NB...", 1000n);
		const result = mockContract.withdraw("ST3NB...", 500n);
		expect(result).toEqual({ value: true });
		expect(mockContract.investorBalances.get("ST3NB...")?.balance).toBe(500n);
		expect(mockContract.totalValueLocked).toBe(500n);
		expect(mockContract.events.get("3")?.eventType).toBe("withdraw");
	});

	it("should prevent withdrawal with insufficient balance", () => {
		mockContract.initialize(mockContract.manager, 1n, "ST2CY5...");
		mockContract.deposit("ST3NB...", 500n);
		const result = mockContract.withdraw("ST3NB...", 1000n);
		expect(result).toEqual({ error: 104 });
	});

	it("should allow manager to add asset", () => {
		const result = mockContract.addAsset(
			mockContract.manager,
			1n,
			"ST4RE...",
			1000n
		);
		expect(result).toEqual({ value: true });
		expect(mockContract.assets.get("1")).toEqual({
			assetContract: "ST4RE...",
			amount: 1000n,
		});
		expect(mockContract.events.get("1")?.eventType).toBe("asset-added");
	});

	it("should prevent non-manager from adding asset", () => {
		const result = mockContract.addAsset("ST2CY5...", 1n, "ST4RE...", 1000n);
		expect(result).toEqual({ error: 100 });
	});

	it("should prevent adding asset with zero amount", () => {
		const result = mockContract.addAsset(
			mockContract.manager,
			1n,
			"ST4RE...",
			0n
		);
		expect(result).toEqual({ error: 101 });
	});

	it("should allow manager to remove asset", () => {
		mockContract.addAsset(mockContract.manager, 1n, "ST4RE...", 1000n);
		const result = mockContract.removeAsset(mockContract.manager, 1n);
		expect(result).toEqual({ value: true });
		expect(mockContract.assets.has("1")).toBe(false);
		expect(mockContract.events.get("2")?.eventType).toBe("asset-removed");
	});

	it("should prevent removing non-existent asset", () => {
		const result = mockContract.removeAsset(mockContract.manager, 1n);
		expect(result).toEqual({ error: 107 });
	});
});