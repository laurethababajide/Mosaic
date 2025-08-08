 
;; Mosaic Portfolio Vault Contract
;; Clarity v2
;; Manages investor funds, portfolio assets, and interactions with portfolio tokens

(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INVALID-AMOUNT u101)
(define-constant ERR-CONTRACT-DISABLED u102)
(define-constant ERR-ZERO-ADDRESS u103)
(define-constant ERR-INSUFFICIENT-BALANCE u104)
(define-constant ERR-INVALID-TOKEN-CONTRACT u105)
(define-constant ERR-INVALID-PORTFOLIO u106)
(define-constant ERR-INVALID-ASSET u107)
(define-constant ERR-TRANSFER-FAILED u108)

;; Contract state
(define-data-var manager principal tx-sender)
(define-data-var portfolio-id uint u0)
(define-data-var token-contract principal 'SP000000000000000000002Q6VF78)
(define-data-var contract-enabled bool true)
(define-data-var total-value-locked uint u0)

;; Investor balances
(define-map investor-balances
  { investor: principal }
  { balance: uint }
)

;; Asset holdings
(define-map assets
  { asset-id: uint }
  { asset-contract: principal, amount: uint }
)

;; Event tracking
(define-data-var last-event-id uint u0)

(define-map events
  { event-id: uint }
  {
    event-type: (string-ascii 32),
    investor: (optional principal),
    amount: (optional uint),
    asset-id: (optional uint),
    caller: principal,
    block-height: uint,
    timestamp: uint
  }
)

;; Private helper: check if caller is manager
(define-private (is-manager)
  (is-eq tx-sender (var-get manager))
)

;; Private helper: validate amount
(define-private (validate-amount (amount uint))
  (> amount u0)
)

;; Private helper: log event
(define-private (log-event (event-type (string-ascii 32)) (investor (optional principal)) (amount (optional uint)) (asset-id (optional uint)))
  (let
    (
      (event-id (+ (var-get last-event-id) u1))
    )
    (map-set events
      { event-id: event-id }
      {
        event-type: event-type,
        investor: investor,
        amount: amount,
        asset-id: asset-id,
        caller: tx-sender,
        block-height: block-height,
        timestamp: (unwrap-panic (get-block-info? time block-height))
      }
    )
    (var-set last-event-id event-id)
    (ok event-id)
  )
)

;; Admin: Initialize vault
(define-public (initialize (portfolio-id- uint) (token-contract- principal))
  (begin
    (asserts! (is-manager) (err ERR-NOT-AUTHORIZED))
    (asserts! (var-get contract-enabled) (err ERR-CONTRACT-DISABLED))
    (asserts! (not (is-eq token-contract- 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (asserts! (> portfolio-id- u0) (err ERR-INVALID-PORTFOLIO))
    (var-set portfolio-id portfolio-id-)
    (var-set token-contract token-contract-)
    (try! (log-event "vault-initialized" none none none))
    (ok true)
  )
)

;; Admin: Toggle contract enabled state
(define-public (set-enabled (enabled bool))
  (begin
    (asserts! (is-manager) (err ERR-NOT-AUTHORIZED))
    (var-set contract-enabled enabled)
    (try! (log-event (if enabled "vault-enabled" "vault-disabled") none none none))
    (ok enabled)
  )
)

;; Investor: Deposit funds (STX)
(define-public (deposit (amount uint))
  (begin
    (asserts! (var-get contract-enabled) (err ERR-CONTRACT-DISABLED))
    (asserts! (validate-amount amount) (err ERR-INVALID-AMOUNT))
    (asserts! (not (is-eq (var-get token-contract) 'SP000000000000000000002Q6VF78)) (err ERR-INVALID-TOKEN-CONTRACT))
    (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))
    (map-set investor-balances
      { investor: tx-sender }
      { balance: (+ amount (default-to u0 (get balance (map-get? investor-balances { investor: tx-sender })))) }
    )
    (var-set total-value-locked (+ (var-get total-value-locked) amount))
    (try! (as-contract (contract-call? (var-get token-contract) mint tx-sender amount)))
    (try! (log-event "deposit" (some tx-sender) (some amount) none))
    (ok true)
  )
)

;; Investor: Withdraw funds
(define-public (withdraw (amount uint))
  (begin
    (asserts! (var-get contract-enabled) (err ERR-CONTRACT-DISABLED))
    (asserts! (validate-amount amount) (err ERR-INVALID-AMOUNT))
    (let
      (
        (investor-balance (default-to u0 (get balance (map-get? investor-balances { investor: tx-sender }))))
      )
      (asserts! (>= investor-balance amount) (err ERR-INSUFFICIENT-BALANCE))
      (map-set investor-balances
        { investor: tx-sender }
        { balance: (- investor-balance amount) }
      )
      (var-set total-value-locked (- (var-get total-value-locked) amount))
      (try! (as-contract (contract-call? (var-get token-contract) burn amount)))
      (try! (as-contract (stx-transfer? amount tx-sender tx-sender)))
      (try! (log-event "withdraw" (some tx-sender) (some amount) none))
      (ok true)
    )
  )
)

;; Manager: Add asset to portfolio
(define-public (add-asset (asset-id uint) (asset-contract principal) (amount uint))
  (begin
    (asserts! (is-manager) (err ERR-NOT-AUTHORIZED))
    (asserts! (var-get contract-enabled) (err ERR-CONTRACT-DISABLED))
    (asserts! (validate-amount amount) (err ERR-INVALID-AMOUNT))
    (asserts! (not (is-eq asset-contract 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (asserts! (is-none (map-get? assets { asset-id: asset-id })) (err ERR-INVALID-ASSET))
    (map-set assets
      { asset-id: asset-id }
      { asset-contract: asset-contract, amount: amount }
    )
    (try! (log-event "asset-added" none (some amount) (some asset-id)))
    (ok true)
  )
)

;; Manager: Remove asset from portfolio
(define-public (remove-asset (asset-id uint))
  (begin
    (asserts! (is-manager) (err ERR-NOT-AUTHORIZED))
    (asserts! (var-get contract-enabled) (err ERR-CONTRACT-DISABLED))
    (asserts! (is-some (map-get? assets { asset-id: asset-id })) (err ERR-INVALID-ASSET))
    (let
      (
        (asset (unwrap-panic (map-get? assets { asset-id: asset-id })))
      )
      (map-delete assets { asset-id: asset-id })
      (try! (log-event "asset-removed" none (some (get amount asset)) (some asset-id)))
      (ok true)
    )
  )
)

;; Read-only: Get investor balance
(define-read-only (get-investor-balance (investor principal))
  (ok (default-to u0 (get balance (map-get? investor-balances { investor: investor }))))
)

;; Read-only: Get asset details
(define-read-only (get-asset (asset-id uint))
  (ok (default-to
    { asset-contract: 'SP000000000000000000002Q6VF78, amount: u0 }
    (map-get? assets { asset-id: asset-id }))
  )
)

;; Read-only: Get total value locked
(define-read-only (get-total-value-locked)
  (ok (var-get total-value-locked))
)

;; Read-only: Get manager
(define-read-only (get-manager)
  (ok (var-get manager))
)

;; Read-only: Get portfolio ID
(define-read-only (get-portfolio-id)
  (ok (var-get portfolio-id))
)

;; Read-only: Get token contract
(define-read-only (get-token-contract)
  (ok (var-get token-contract))
)

;; Read-only: Check if contract is enabled
(define-read-only (get-enabled)
  (ok (var-get contract-enabled))
)

;; Read-only: Get event details
(define-read-only (get-event (event-id uint))
  (ok (default-to
    {
      event-type: "",
      investor: none,
      amount: none,
      asset-id: none,
      caller: 'SP000000000000000000002Q6VF78,
      block-height: u0,
      timestamp: u0
    }
    (map-get? events { event-id: event-id }))
  )
)