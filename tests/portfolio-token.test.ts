import { describe, it, expect, beforeEach } from "vitest";

interface Balance {
	balance: bigint;
}

interface Allowance {
	allowance: bigint;
}

interface Event {
	eventType: string;
	account: string | null;
	spender: string | null;
	amount: bigint | null;
	caller: string;
	blockHeight: bigint;
	timestamp: bigint;
}

interface MockContract {
	manager: string;
	vaultContract: string;
	contractEnabled: boolean;
	totalSupply: bigint;
	balances: Map<string, Balance>;
	allowances: Map<string, Allowance>;
	events: Map<string, Event>;
	lastEventId: bigint;
	MAX_SUPPLY: bigint;

	isManager(caller: string): boolean;
	isVault(caller: string): boolean;
	initialize(
		caller: string,
		vaultContract: string
	): { value: boolean } | { error: number };
	setEnabled(
		caller: string,
		enabled: boolean
	): { value: boolean } | { error: number };
	mint(
		caller: string,
		recipient: string,
		amount: bigint
	): { value: boolean } | { error: number };
	burn(caller: string, amount: bigint): { value: boolean } | { error: number };
	transfer(
		caller: string,
		recipient: string,
		amount: bigint
	): { value: boolean } | { error: number };
	approve(
		caller: string,
		spender: string,
		amount: bigint
	): { value: boolean } | { error: number };
	transferFrom(
		caller: string,
		owner: string,
		recipient: string,
		amount: bigint
	): { value: boolean } | { error: number };
}

const mockContract: MockContract = {
	manager: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
	vaultContract: "SP000000000000000000002Q6VF78",
	contractEnabled: true,
	totalSupply: 0n,
	balances: new Map(),
	allowances: new Map(),
	events: new Map(),
	lastEventId: 0n,
	MAX_SUPPLY: 1000000000000n,

	isManager(caller: string) {
		return caller === this.manager;
	},

	isVault(caller: string) {
		return caller === this.vaultContract;
	},

	initialize(caller: string, vaultContract: string) {
		if (!this.isManager(caller)) return { error: 100 };
		if (!this.contractEnabled) return { error: 104 };
		if (vaultContract === "SP000000000000000000002Q6VF78")
			return { error: 103 };
		this.vaultContract = vaultContract;
		this.events.set((++this.lastEventId).toString(), {
			eventType: "vault-initialized",
			account: null,
			spender: null,
			amount: null,
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
			eventType: enabled ? "token-enabled" : "token-disabled",
			account: null,
			spender: null,
			amount: null,
			caller,
			blockHeight: 100n,
			timestamp: 1234567890n,
		});
		return { value: enabled };
	},

	mint(caller: string, recipient: string, amount: bigint) {
		if (!this.contractEnabled) return { error: 104 };
		if (!this.isVault(caller)) return { error: 100 };
		if (amount === 0n) return { error: 102 };
		if (recipient === "SP000000000000000000002Q6VF78") return { error: 103 };
		if (this.totalSupply + amount > this.MAX_SUPPLY) return { error: 106 };
		const currentBalance = this.balances.get(recipient)?.balance || 0n;
		this.balances.set(recipient, { balance: currentBalance + amount });
		this.totalSupply += amount;
		this.events.set((++this.lastEventId).toString(), {
			eventType: "mint",
			account: recipient,
			spender: null,
			amount,
			caller,
			blockHeight: 100n,
			timestamp: 1234567890n,
		});
		return { value: true };
	},

	burn(caller: string, amount: bigint) {
		if (!this.contractEnabled) return { error: 104 };
		if (!this.isVault(caller)) return { error: 100 };
		if (amount === 0n) return { error: 102 };
		const currentBalance = this.balances.get(caller)?.balance || 0n;
		if (currentBalance < amount) return { error: 101 };
		this.balances.set(caller, { balance: currentBalance - amount });
		this.totalSupply -= amount;
		this.events.set((++this.lastEventId).toString(), {
			eventType: "burn",
			account: caller,
			spender: null,
			amount,
			caller,
			blockHeight: 100n,
			timestamp: 1234567890n,
		});
		return { value: true };
	},

	transfer(caller: string, recipient: string, amount: bigint) {
		if (!this.contractEnabled) return { error: 104 };
		if (amount === 0n) return { error: 102 };
		if (recipient === "SP000000000000000000002Q6VF78") return { error: 103 };
		const currentBalance = this.balances.get(caller)?.balance || 0n;
		if (currentBalance < amount) return { error: 101 };
		this.balances.set(caller, { balance: currentBalance - amount });
		const recipientBalance = this.balances.get(recipient)?.balance || 0n;
		this.balances.set(recipient, { balance: recipientBalance + amount });
		this.events.set((++this.lastEventId).toString(), {
			eventType: "transfer",
			account: recipient,
			spender: null,
			amount,
			caller,
			blockHeight: 100n,
			timestamp: 1234567890n,
		});
		return { value: true };
	},

	approve(caller: string, spender: string, amount: bigint) {
		if (!this.contractEnabled) return { error: 104 };
		if (spender === "SP000000000000000000002Q6VF78") return { error: 103 };
		this.allowances.set(`${caller}:${spender}`, { allowance: amount });
		this.events.set((++this.lastEventId).toString(), {
			eventType: "approve",
			account: null,
			spender,
			amount,
			caller,
			blockHeight: 100n,
			timestamp: 1234567890n,
		});
		return { value: true };
	},

	transferFrom(
		caller: string,
		owner: string,
		recipient: string,
		amount: bigint
	) {
		if (!this.contractEnabled) return { error: 104 };
		if (amount === 0n) return { error: 102 };
		if (
			owner === "SP000000000000000000002Q6VF78" ||
			recipient === "SP000000000000000000002Q6VF78"
		)
			return { error: 103 };
		const currentAllowance =
			this.allowances.get(`${owner}:${caller}`)?.allowance || 0n;
		if (currentAllowance < amount) return { error: 107 };
		const ownerBalance = this.balances.get(owner)?.balance || 0n;
		if (ownerBalance < amount) return { error: 101 };
		this.allowances.set(`${owner}:${caller}`, {
			allowance: currentAllowance - amount,
		});
		this.balances.set(owner, { balance: ownerBalance - amount });
		const recipientBalance = this.balances.get(recipient)?.balance || 0n;
		this.balances.set(recipient, { balance: recipientBalance + amount });
		this.events.set((++this.lastEventId).toString(), {
			eventType: "transfer-from",
			account: recipient,
			spender: caller,
			amount,
			caller,
			blockHeight: 100n,
			timestamp: 1234567890n,
		});
		return { value: true };
	},
};

describe("Mosaic Portfolio Token Contract", () => {
	beforeEach(() => {
		mockContract.manager = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";
		mockContract.vaultContract = "SP000000000000000000002Q6VF78";
		mockContract.contractEnabled = true;
		mockContract.totalSupply = 0n;
		mockContract.balances = new Map();
		mockContract.allowances = new Map();
		mockContract.events = new Map();
		mockContract.lastEventId = 0n;
	});

	it("should allow manager to initialize vault contract", () => {
		const result = mockContract.initialize(mockContract.manager, "ST2CY5...");
		expect(result).toEqual({ value: true });
		expect(mockContract.vaultContract).toBe("ST2CY5...");
		expect(mockContract.events.get("1")?.eventType).toBe("vault-initialized");
	});

	it("should prevent non-manager from initializing vault", () => {
		const result = mockContract.initialize("ST2CY5...", "ST3NB...");
		expect(result).toEqual({ error: 100 });
	});

	it("should prevent initialization with zero address", () => {
		const result = mockContract.initialize(
			mockContract.manager,
			"SP000000000000000000002Q6VF78"
		);
		expect(result).toEqual({ error: 103 });
	});

	it("should allow manager to set enabled state", () => {
		const result = mockContract.setEnabled(mockContract.manager, false);
		expect(result).toEqual({ value: false });
		expect(mockContract.contractEnabled).toBe(false);
		expect(mockContract.events.get("1")?.eventType).toBe("token-disabled");
	});

	it("should prevent non-manager from setting enabled state", () => {
		const result = mockContract.setEnabled("ST2CY5...", false);
		expect(result).toEqual({ error: 100 });
	});

	it("should allow vault to mint tokens", () => {
		mockContract.initialize(mockContract.manager, "ST2CY5...");
		const result = mockContract.mint("ST2CY5...", "ST3NB...", 1000n);
		expect(result).toEqual({ value: true });
		expect(mockContract.balances.get("ST3NB...")?.balance).toBe(1000n);
		expect(mockContract.totalSupply).toBe(1000n);
		expect(mockContract.events.get("2")?.eventType).toBe("mint");
	});

	it("should prevent non-vault from minting tokens", () => {
		const result = mockContract.mint("ST3NB...", "ST4RE...", 1000n);
		expect(result).toEqual({ error: 100 });
	});

	it("should prevent minting over max supply", () => {
		mockContract.initialize(mockContract.manager, "ST2CY5...");
		const result = mockContract.mint("ST2CY5...", "ST3NB...", 2000000000000n);
		expect(result).toEqual({ error: 106 });
	});

	it("should allow vault to burn tokens", () => {
		mockContract.initialize(mockContract.manager, "ST2CY5...");
		mockContract.mint("ST2CY5...", "ST2CY5...", 1000n); // Mint to vault itself
		const result = mockContract.burn("ST2CY5...", 500n);
		expect(result).toEqual({ value: true });
		expect(mockContract.balances.get("ST2CY5...")?.balance).toBe(500n);
		expect(mockContract.totalSupply).toBe(500n);
		expect(mockContract.events.get("3")?.eventType).toBe("burn");
	});

	it("should prevent burning with insufficient balance", () => {
		mockContract.initialize(mockContract.manager, "ST2CY5...");
		const result = mockContract.burn("ST2CY5...", 1000n);
		expect(result).toEqual({ error: 101 });
	});

	it("should allow user to transfer tokens", () => {
		mockContract.initialize(mockContract.manager, "ST2CY5...");
		mockContract.mint("ST2CY5...", "ST3NB...", 1000n);
		const result = mockContract.transfer("ST3NB...", "ST4RE...", 500n);
		expect(result).toEqual({ value: true });
		expect(mockContract.balances.get("ST3NB...")?.balance).toBe(500n);
		expect(mockContract.balances.get("ST4RE...")?.balance).toBe(500n);
		expect(mockContract.events.get("3")?.eventType).toBe("transfer");
	});

	it("should prevent transfer with insufficient balance", () => {
		mockContract.initialize(mockContract.manager, "ST2CY5...");
		const result = mockContract.transfer("ST3NB...", "ST4RE...", 1000n);
		expect(result).toEqual({ error: 101 });
	});

	it("should allow user to approve spender", () => {
		const result = mockContract.approve("ST3NB...", "ST4RE...", 1000n);
		expect(result).toEqual({ value: true });
		expect(mockContract.allowances.get("ST3NB...:ST4RE...")?.allowance).toBe(
			1000n
		);
		expect(mockContract.events.get("1")?.eventType).toBe("approve");
	});

	it("should allow transfer-from with sufficient allowance", () => {
		mockContract.initialize(mockContract.manager, "ST2CY5...");
		mockContract.mint("ST2CY5...", "ST3NB...", 1000n);
		mockContract.approve("ST3NB...", "ST4RE...", 1000n);
		const result = mockContract.transferFrom(
			"ST4RE...",
			"ST3NB...",
			"ST5TK...",
			500n
		);
		expect(result).toEqual({ value: true });
		expect(mockContract.balances.get("ST3NB...")?.balance).toBe(500n);
		expect(mockContract.balances.get("ST5TK...")?.balance).toBe(500n);
		expect(mockContract.allowances.get("ST3NB...:ST4RE...")?.allowance).toBe(
			500n
		);
		expect(mockContract.events.get("4")?.eventType).toBe("transfer-from");
	});

	it("should prevent transfer-from with insufficient allowance", () => {
		mockContract.initialize(mockContract.manager, "ST2CY5...");
		mockContract.mint("ST2CY5...", "ST3NB...", 1000n);
		mockContract.approve("ST3NB...", "ST4RE...", 500n);
		const result = mockContract.transferFrom(
			"ST4RE...",
			"ST3NB...",
			"ST5TK...",
			1000n
		);
		expect(result).toEqual({ error: 107 });
	});

	it("should prevent operations when contract is disabled", () => {
		mockContract.initialize(mockContract.manager, "ST2CY5...");
		mockContract.setEnabled(mockContract.manager, false);
		expect(mockContract.mint("ST2CY5...", "ST3NB...", 1000n)).toEqual({
			error: 104,
		});
		expect(mockContract.transfer("ST3NB...", "ST4RE...", 500n)).toEqual({
			error: 104,
		});
		expect(mockContract.approve("ST3NB...", "ST4RE...", 1000n)).toEqual({
			error: 104,
		});
	});
});
