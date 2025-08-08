;; Mosaic Portfolio Token Contract
;; Clarity v2
;; Issues ERC-20-style tokens representing fractional ownership in a portfolio

(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INSUFFICIENT-BALANCE u101)
(define-constant ERR-INVALID-AMOUNT u102)
(define-constant ERR-ZERO-ADDRESS u103)
(define-constant ERR-CONTRACT-DISABLED u104)
(define-constant ERR-INVALID-VAULT u105)
(define-constant ERR-MAX-SUPPLY-REACHED u106)
(define-constant ERR-INVALID-ALLOWANCE u107)

;; Token metadata
(define-constant TOKEN-NAME "Mosaic Portfolio Token")
(define-constant TOKEN-SYMBOL "MPT")
(define-constant TOKEN-DECIMALS u6)
(define-constant MAX-SUPPLY u1000000000000) ;; 1B tokens (with 6 decimals)

;; Contract state
(define-data-var manager principal tx-sender)
(define-data-var vault-contract principal 'SP000000000000000000002Q6VF78)
(define-data-var contract-enabled bool true)
(define-data-var total-supply uint u0)

;; Balances and allowances
(define-map balances
  { account: principal }
  { balance: uint }
)

(define-map allowances
  { owner: principal, spender: principal }
  { allowance: uint }
)

;; Event tracking
(define-data-var last-event-id uint u0)

(define-map events
  { event-id: uint }
  {
    event-type: (string-ascii 32),
    account: (optional principal),
    spender: (optional principal),
    amount: (optional uint),
    caller: principal,
    block-height: uint,
    timestamp: uint
  }
)

;; Private helper: check if caller is manager
(define-private (is-manager)
  (is-eq tx-sender (var-get manager))
)

;; Private helper: check if caller is vault
(define-private (is-vault)
  (is-eq tx-sender (var-get vault-contract))
)

;; Private helper: validate amount
(define-private (validate-amount (amount uint))
  (> amount u0)
)

;; Private helper: log event
(define-private (log-event (event-type (string-ascii 32)) (account (optional principal)) (spender (optional principal)) (amount (optional uint)))
  (let
    (
      (event-id (+ (var-get last-event-id) u1))
    )
    (map-set events
      { event-id: event-id }
      {
        event-type: event-type,
        account: account,
        spender: spender,
        amount: amount,
        caller: tx-sender,
        block-height: block-height,
        timestamp: (unwrap-panic (get-block-info? time block-height))
      }
    )
    (var-set last-event-id event-id)
    (ok event-id)
  )
)

;; Manager: Initialize vault contract
(define-public (initialize (vault-contract- principal))
  (begin
    (asserts! (is-manager) (err ERR-NOT-AUTHORIZED))
    (asserts! (var-get contract-enabled) (err ERR-CONTRACT-DISABLED))
    (asserts! (not (is-eq vault-contract- 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (var-set vault-contract vault-contract-)
    (try! (log-event "vault-initialized" none none none))
    (ok true)
  )
)

;; Manager: Toggle contract enabled state
(define-public (set-enabled (enabled bool))
  (begin
    (asserts! (is-manager) (err ERR-NOT-AUTHORIZED))
    (var-set contract-enabled enabled)
    (try! (log-event (if enabled "token-enabled" "token-disabled") none none none))
    (ok enabled)
  )
)

;; Vault: Mint tokens
(define-public (mint (recipient principal) (amount uint))
  (begin
    (asserts! (is-vault) (err ERR-NOT-AUTHORIZED))
    (asserts! (var-get contract-enabled) (err ERR-CONTRACT-DISABLED))
    (asserts! (validate-amount amount) (err ERR-INVALID-AMOUNT))
    (asserts! (not (is-eq recipient 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (let
      (
        (new-supply (+ (var-get total-supply) amount))
      )
      (asserts! (<= new-supply MAX-SUPPLY) (err ERR-MAX-SUPPLY-REACHED))
      (map-set balances
        { account: recipient }
        { balance: (+ amount (default-to u0 (get balance (map-get? balances { account: recipient })))) }
      )
      (var-set total-supply new-supply)
      (try! (log-event "mint" (some recipient) none (some amount)))
      (ok true)
    )
  )
)

;; Vault: Burn tokens
(define-public (burn (amount uint))
  (begin
    (asserts! (is-vault) (err ERR-NOT-AUTHORIZED))
    (asserts! (var-get contract-enabled) (err ERR-CONTRACT-DISABLED))
    (asserts! (validate-amount amount) (err ERR-INVALID-AMOUNT))
    (let
      (
        (balance (default-to u0 (get balance (map-get? balances { account: tx-sender }))))
      )
      (asserts! (>= balance amount) (err ERR-INSUFFICIENT-BALANCE))
      (map-set balances
        { account: tx-sender }
        { balance: (- balance amount) }
      )
      (var-set total-supply (- (var-get total-supply) amount))
      (try! (log-event "burn" (some tx-sender) none (some amount)))
      (ok true)
    )
  )
)

;; User: Transfer tokens
(define-public (transfer (recipient principal) (amount uint))
  (begin
    (asserts! (var-get contract-enabled) (err ERR-CONTRACT-DISABLED))
    (asserts! (validate-amount amount) (err ERR-INVALID-AMOUNT))
    (asserts! (not (is-eq recipient 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (let
      (
        (sender-balance (default-to u0 (get balance (map-get? balances { account: tx-sender }))))
      )
      (asserts! (>= sender-balance amount) (err ERR-INSUFFICIENT-BALANCE))
      (map-set balances
        { account: tx-sender }
        { balance: (- sender-balance amount) }
      )
      (map-set balances
        { account: recipient }
        { balance: (+ amount (default-to u0 (get balance (map-get? balances { account: recipient })))) }
      )
      (try! (log-event "transfer" (some recipient) none (some amount)))
      (ok true)
    )
  )
)

;; User: Approve spender
(define-public (approve (spender principal) (amount uint))
  (begin
    (asserts! (var-get contract-enabled) (err ERR-CONTRACT-DISABLED))
    (asserts! (not (is-eq spender 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (map-set allowances
      { owner: tx-sender, spender: spender }
      { allowance: amount }
    )
    (try! (log-event "approve" none (some spender) (some amount)))
    (ok true)
  )
)

;; User: Transfer from (using allowance)
(define-public (transfer-from (owner principal) (recipient principal) (amount uint))
  (begin
    (asserts! (var-get contract-enabled) (err ERR-CONTRACT-DISABLED))
    (asserts! (validate-amount amount) (err ERR-INVALID-AMOUNT))
    (asserts! (not (is-eq owner 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (asserts! (not (is-eq recipient 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (let
      (
        (current-allowance (default-to u0 (get allowance (map-get? allowances { owner: owner, spender: tx-sender }))))
        (owner-balance (default-to u0 (get balance (map-get? balances { account: owner }))))
      )
      (asserts! (>= current-allowance amount) (err ERR-INVALID-ALLOWANCE))
      (asserts! (>= owner-balance amount) (err ERR-INSUFFICIENT-BALANCE))
      (map-set allowances
        { owner: owner, spender: tx-sender }
        { allowance: (- current-allowance amount) }
      )
      (map-set balances
        { account: owner }
        { balance: (- owner-balance amount) }
      )
      (map-set balances
        { account: recipient }
        { balance: (+ amount (default-to u0 (get balance (map-get? balances { account: recipient })))) }
      )
      (try! (log-event "transfer-from" (some recipient) (some tx-sender) (some amount)))
      (ok true)
    )
  )
)

;; Read-only: Get balance
(define-read-only (get-balance (account principal))
  (ok (default-to u0 (get balance (map-get? balances { account: account }))))
)

;; Read-only: Get allowance
(define-read-only (get-allowance (owner principal) (spender principal))
  (ok (default-to u0 (get allowance (map-get? allowances { owner: owner, spender: spender }))))
)

;; Read-only: Get total supply
(define-read-only (get-total-supply)
  (ok (var-get total-supply))
)

;; Read-only: Get manager
(define-read-only (get-manager)
  (ok (var-get manager))
)

;; Read-only: Get vault contract
(define-read-only (get-vault-contract)
  (ok (var-get vault-contract))
)

;; Read-only: Check if contract is enabled
(define-read-only (get-enabled)
  (ok (var-get contract-enabled))
)

;; Read-only: Get token metadata
(define-read-only (get-token-metadata)
  (ok {
    name: TOKEN-NAME,
    symbol: TOKEN-SYMBOL,
    decimals: TOKEN-DECIMALS,
    max-supply: MAX-SUPPLY
  })
)

;; Read-only: Get event details
(define-read-only (get-event (event-id uint))
  (ok (default-to
    {
      event-type: "",
      account: none,
      spender: none,
      amount: none,
      caller: 'SP000000000000000000002Q6VF78,
      block-height: u0,
      timestamp: u0
    }
    (map-get? events { event-id: event-id }))
  )
)