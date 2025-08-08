;; Mosaic Portfolio Factory Contract
;; Clarity v2
;; Manages creation and registry of portfolio vault instances with robust access controls and event logging

(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INVALID-PORTFOLIO-NAME u101)
(define-constant ERR-PORTFOLIO-EXISTS u102)
(define-constant ERR-INVALID-MANAGER u103)
(define-constant ERR-ZERO-ADDRESS u104)
(define-constant ERR-CONTRACT-DISABLED u105)
(define-constant ERR-INVALID-FEE u106)
(define-constant ERR-INVALID-STRATEGY-ID u107)
(define-constant ERR-INVALID-MAX-PORTFOLIOS u108)
(define-constant ERR-INVALID-DESCRIPTION u109)

;; Contract state
(define-data-var contract-admin principal tx-sender)
(define-data-var contract-enabled bool true)
(define-data-var portfolio-count uint u0)
(define-data-var max-portfolio-fee uint u1000) ;; 10% max fee (in basis points)

;; Portfolio registry
(define-map portfolios
  { portfolio-id: uint }
  {
    name: (string-ascii 64),
    manager: principal,
    vault-contract: principal,
    token-contract: principal,
    created-at: uint,
    management-fee: uint, ;; in basis points
    performance-fee: uint, ;; in basis points
    strategy-id: (optional uint),
    is-active: bool
  }
)

;; Manager permissions
(define-map manager-permissions
  { manager: principal }
  { can-create: bool, max-portfolios: uint, portfolios-created: uint }
)

;; Strategy registry for future automation
(define-map strategies
  { strategy-id: uint }
  { description: (string-ascii 256), creator: principal, is-approved: bool }
)

;; Event tracking
(define-data-var last-event-id uint u0)

(define-map events
  { event-id: uint }
  {
    event-type: (string-ascii 32),
    portfolio-id: (optional uint),
    caller: principal,
    block-height: uint,
    timestamp: uint
  }
)

;; Private helper: check if caller is admin
(define-private (is-admin)
  (is-eq tx-sender (var-get contract-admin))
)

;; Private helper: validate portfolio name
(define-private (validate-portfolio-name (name (string-ascii 64)))
  (and (> (len name) u0) (<= (len name) u64))
)

;; Private helper: validate description
(define-private (validate-description (description (string-ascii 256)))
  (and (> (len description) u0) (<= (len description) u256))
)

;; Private helper: log event
(define-private (log-event (event-type (string-ascii 32)) (portfolio-id (optional uint)))
  (let
    (
      (event-id (+ (var-get last-event-id) u1))
    )
    (map-set events
      { event-id: event-id }
      {
        event-type: event-type,
        portfolio-id: portfolio-id,
        caller: tx-sender,
        block-height: block-height,
        timestamp: (unwrap-panic (get-block-info? time block-height))
      }
    )
    (var-set last-event-id event-id)
    (ok event-id)
  )
)

;; Admin: Transfer contract admin rights
(define-public (transfer-admin (new-admin principal))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (is-eq new-admin 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (var-set contract-admin new-admin)
    (try! (log-event "admin-transferred" none))
    (ok true)
  )
)

;; Admin: Toggle contract enabled state
(define-public (set-enabled (enabled bool))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (var-set contract-enabled enabled)
    (try! (log-event (if enabled "contract-enabled" "contract-disabled") none))
    (ok enabled)
  )
)

;; Admin: Set maximum portfolio fee
(define-public (set-max-portfolio-fee (fee uint))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (asserts! (<= fee u10000) (err ERR-INVALID-FEE)) ;; Max 100%
    (var-set max-portfolio-fee fee)
    (try! (log-event "max-fee-updated" none))
    (ok true)
  )
)

;; Admin: Approve manager
(define-public (approve-manager (manager principal) (can-create bool) (max-portfolios uint))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (is-eq manager 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (asserts! (> max-portfolios u0) (err ERR-INVALID-MAX-PORTFOLIOS))
    (map-set manager-permissions
      { manager: manager }
      { can-create: can-create, max-portfolios: max-portfolios, portfolios-created: u0 }
    )
    (try! (log-event "manager-approved" none))
    (ok true)
  )
)

;; Manager: Create new portfolio
(define-public (create-portfolio
  (name (string-ascii 64))
  (vault-contract principal)
  (token-contract principal)
  (management-fee uint)
  (performance-fee uint)
  (strategy-id (optional uint))
)
  (begin
    (let
      (
        (manager tx-sender)
        (portfolio-id (+ (var-get portfolio-count) u1))
        (manager-data (default-to { can-create: false, max-portfolios: u0, portfolios-created: u0 }
          (map-get? manager-permissions { manager: manager })))
      )
      (asserts! (var-get contract-enabled) (err ERR-CONTRACT-DISABLED))
      (asserts! (get can-create manager-data) (err ERR-NOT-AUTHORIZED))
      (asserts! (< (get portfolios-created manager-data) (get max-portfolios manager-data))
        (err ERR-NOT-AUTHORIZED))
      (asserts! (validate-portfolio-name name) (err ERR-INVALID-PORTFOLIO-NAME))
      (asserts! (is-none (map-get? portfolios { portfolio-id: portfolio-id }))
        (err ERR-PORTFOLIO-EXISTS))
      (asserts! (not (is-eq vault-contract 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
      (asserts! (not (is-eq token-contract 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
      (asserts! (and (<= management-fee (var-get max-portfolio-fee))
                    (<= performance-fee (var-get max-portfolio-fee))) (err ERR-INVALID-FEE))
      (asserts! (or (is-none strategy-id)
                    (is-some (map-get? strategies { strategy-id: (unwrap-panic strategy-id) })))
        (err ERR-INVALID-STRATEGY-ID))
      
      (map-set portfolios
        { portfolio-id: portfolio-id }
        {
          name: name,
          manager: manager,
          vault-contract: vault-contract,
          token-contract: token-contract,
          created-at: block-height,
          management-fee: management-fee,
          performance-fee: performance-fee,
          strategy-id: strategy-id,
          is-active: true
        }
      )
      (map-set manager-permissions
        { manager: manager }
        (merge manager-data { portfolios-created: (+ (get portfolios-created manager-data) u1) })
      )
      (var-set portfolio-count portfolio-id)
      (try! (log-event "portfolio-created" (some portfolio-id)))
      (ok portfolio-id)
    )
  )
)

;; Manager: Register strategy
(define-public (register-strategy (description (string-ascii 256)) (strategy-id uint))
  (begin
    (asserts! (var-get contract-enabled) (err ERR-CONTRACT-DISABLED))
    (asserts! (validate-description description) (err ERR-INVALID-DESCRIPTION))
    (asserts! (> strategy-id u0) (err ERR-INVALID-STRATEGY-ID))
    (asserts! (is-none (map-get? strategies { strategy-id: strategy-id }))
      (err ERR-INVALID-STRATEGY-ID))
    (map-set strategies
      { strategy-id: strategy-id }
      { description: description, creator: tx-sender, is-approved: false }
    )
    (try! (log-event "strategy-registered" none))
    (ok strategy-id)
  )
)

;; Admin: Approve strategy
(define-public (approve-strategy (strategy-id uint))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (asserts! (> strategy-id u0) (err ERR-INVALID-STRATEGY-ID))
    (let
      (
        (strategy (unwrap-panic (map-get? strategies { strategy-id: strategy-id })))
      )
      (map-set strategies
        { strategy-id: strategy-id }
        (merge strategy { is-approved: true })
      )
      (try! (log-event "strategy-approved" none))
      (ok true)
    )
  )
)

;; Read-only: Get portfolio details
(define-read-only (get-portfolio (portfolio-id uint))
  (ok (default-to
    {
      name: "",
      manager: 'SP000000000000000000002Q6VF78,
      vault-contract: 'SP000000000000000000002Q6VF78,
      token-contract: 'SP000000000000000000002Q6VF78,
      created-at: u0,
      management-fee: u0,
      performance-fee: u0,
      strategy-id: none,
      is-active: false
    }
    (map-get? portfolios { portfolio-id: portfolio-id }))
  )
)

;; Read-only: Get manager permissions
(define-read-only (get-manager-permissions (manager principal))
  (ok (default-to
    { can-create: false, max-portfolios: u0, portfolios-created: u0 }
    (map-get? manager-permissions { manager: manager }))
  )
)

;; Read-only: Get strategy details
(define-read-only (get-strategy (strategy-id uint))
  (ok (default-to

    { description: "", creator: 'SP000000000000000000002Q6VF78, is-approved: false }
    (map-get? strategies { strategy-id: strategy-id }))
  )
)

;; Read-only: Get portfolio count
(define-read-only (get-portfolio-count)
  (ok (var-get portfolio-count))
)

;; Read-only: Get contract admin
(define-read-only (get-admin)
  (ok (var-get contract-admin))
)

;; Read-only: Check if contract is enabled
(define-read-only (get-enabled)
  (ok (var-get contract-enabled))
)

;; Read-only: Get max portfolio fee
(define-read-only (get-max-portfolio-fee)
  (ok (var-get max-portfolio-fee))
)

;; Read-only: Get event details
(define-read-only (get-event (event-id uint))
  (ok (default-to
    {
      event-type: "",
      portfolio-id: none,
      caller: 'SP000000000000000000002Q6VF78,
      block-height: u0,
      timestamp: u0
    }
    (map-get? events { event-id: event-id }))
  )
)