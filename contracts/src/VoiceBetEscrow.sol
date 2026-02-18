// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";

/**
 * @title VoiceBetEscrow
 * @notice On-chain escrow for VoiceBet Arena — voice-powered micro-bets on Monad
 * @dev Designed for sub-second settlement on Monad (800ms finality)
 */
contract VoiceBetEscrow is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Types ───────────────────────────────────────────────────────────
    enum BetStatus {
        Pending,    // Created, waiting for party B to match
        Active,     // Both parties locked funds
        Resolved,   // Oracle resolved, winner paid
        Cancelled,  // Cancelled/expired, funds returned
        Expired     // Past deadline, auto-refundable
    }

    struct Bet {
        bytes32 id;
        address partyA;
        address partyB;
        uint256 amount;         // Amount per side (in USDC, 6 decimals)
        string condition;       // Human-readable bet condition
        string category;        // crypto_price, weather, sports, trivia, fun_social
        uint64 deadline;        // Unix timestamp
        BetStatus status;
        address winner;
        uint64 createdAt;
        uint64 resolvedAt;
    }

    // ─── State ───────────────────────────────────────────────────────────
    IERC20 public immutable usdc;
    address public oracle;          // OpenClaw facilitator wallet
    address public treasury;        // Platform fee recipient
    uint256 public feeBps = 200;    // 2% = 200 basis points
    uint256 public constant MAX_FEE_BPS = 500; // 5% max
    uint256 public constant MIN_BET = 10_000;   // $0.01 (6 decimals)
    uint256 public constant MAX_BET = 10_000_000; // $10.00

    mapping(bytes32 => Bet) public bets;
    mapping(bytes32 => bool) public partyAFunded;
    mapping(bytes32 => bool) public partyBFunded;

    uint256 public totalBets;
    uint256 public totalVolume;
    uint256 public totalResolved;

    // ─── Events ──────────────────────────────────────────────────────────
    event BetCreated(
        bytes32 indexed betId,
        address indexed partyA,
        address indexed partyB,
        uint256 amount,
        string condition,
        string category,
        uint64 deadline
    );
    event BetFunded(bytes32 indexed betId, address indexed party);
    event BetActive(bytes32 indexed betId);
    event BetResolved(bytes32 indexed betId, address indexed winner, uint256 payout, uint256 fee);
    event BetCancelled(bytes32 indexed betId);
    event BetExpired(bytes32 indexed betId);
    event OracleUpdated(address indexed oldOracle, address indexed newOracle);
    event FeeUpdated(uint256 oldFee, uint256 newFee);

    // ─── Errors ──────────────────────────────────────────────────────────
    error OnlyOracle();
    error InvalidAmount();
    error InvalidDeadline();
    error BetNotPending();
    error BetNotActive();
    error AlreadyFunded();
    error NotParty();
    error BetExpiredErr();
    error InvalidWinner();
    error ZeroAddress();

    // ─── Modifiers ───────────────────────────────────────────────────────
    modifier onlyOracle() {
        if (msg.sender != oracle) revert OnlyOracle();
        _;
    }

    // ─── Constructor ─────────────────────────────────────────────────────
    constructor(address _usdc, address _oracle, address _treasury) {
        if (_usdc == address(0) || _oracle == address(0) || _treasury == address(0)) revert ZeroAddress();
        usdc = IERC20(_usdc);
        oracle = _oracle;
        treasury = _treasury;
    }

    // ─── Core Functions ──────────────────────────────────────────────────

    /**
     * @notice Create a new bet and fund party A's side
     * @param betId Unique bet identifier (generated off-chain by OpenClaw)
     * @param partyB Address of the opponent
     * @param amount Bet amount per side in USDC (6 decimals)
     * @param condition Human-readable bet condition
     * @param category Bet category for oracle routing
     * @param deadline Unix timestamp for bet expiry
     */
    function createBet(
        bytes32 betId,
        address partyB,
        uint256 amount,
        string calldata condition,
        string calldata category,
        uint64 deadline
    ) external nonReentrant {
        if (amount < MIN_BET || amount > MAX_BET) revert InvalidAmount();
        if (deadline <= block.timestamp) revert InvalidDeadline();
        if (partyB == address(0) || partyB == msg.sender) revert ZeroAddress();
        if (bets[betId].createdAt != 0) revert AlreadyFunded(); // betId already used

        bets[betId] = Bet({
            id: betId,
            partyA: msg.sender,
            partyB: partyB,
            amount: amount,
            condition: condition,
            category: category,
            deadline: deadline,
            status: BetStatus.Pending,
            winner: address(0),
            createdAt: uint64(block.timestamp),
            resolvedAt: 0
        });

        // Fund party A
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        partyAFunded[betId] = true;

        totalBets++;
        totalVolume += amount;

        emit BetCreated(betId, msg.sender, partyB, amount, condition, category, deadline);
        emit BetFunded(betId, msg.sender);
    }

    /**
     * @notice Party B matches the bet by funding their side
     */
    function matchBet(bytes32 betId) external nonReentrant {
        Bet storage bet = bets[betId];
        if (bet.status != BetStatus.Pending) revert BetNotPending();
        if (msg.sender != bet.partyB) revert NotParty();
        if (block.timestamp >= bet.deadline) revert BetExpiredErr();
        if (partyBFunded[betId]) revert AlreadyFunded();

        usdc.safeTransferFrom(msg.sender, address(this), bet.amount);
        partyBFunded[betId] = true;
        bet.status = BetStatus.Active;

        totalVolume += bet.amount;

        emit BetFunded(betId, msg.sender);
        emit BetActive(betId);
    }

    /**
     * @notice Oracle resolves the bet and pays the winner
     * @param betId The bet to resolve
     * @param winner Address of the winner (must be partyA or partyB)
     */
    function resolveBet(bytes32 betId, address winner) external onlyOracle nonReentrant {
        Bet storage bet = bets[betId];
        if (bet.status != BetStatus.Active) revert BetNotActive();
        if (winner != bet.partyA && winner != bet.partyB) revert InvalidWinner();

        bet.status = BetStatus.Resolved;
        bet.winner = winner;
        bet.resolvedAt = uint64(block.timestamp);

        uint256 totalPot = bet.amount * 2;
        uint256 fee = (totalPot * feeBps) / 10_000;
        uint256 payout = totalPot - fee;

        // Pay winner
        usdc.safeTransfer(winner, payout);

        // Pay platform fee
        if (fee > 0) {
            usdc.safeTransfer(treasury, fee);
        }

        totalResolved++;

        emit BetResolved(betId, winner, payout, fee);
    }

    /**
     * @notice Cancel an unmatched bet (only party A or oracle)
     */
    function cancelBet(bytes32 betId) external nonReentrant {
        Bet storage bet = bets[betId];
        if (bet.status != BetStatus.Pending) revert BetNotPending();
        if (msg.sender != bet.partyA && msg.sender != oracle) revert NotParty();

        bet.status = BetStatus.Cancelled;

        // Refund party A
        if (partyAFunded[betId]) {
            usdc.safeTransfer(bet.partyA, bet.amount);
        }

        emit BetCancelled(betId);
    }

    /**
     * @notice Claim refund for expired bets (both parties get their funds back)
     */
    function claimExpired(bytes32 betId) external nonReentrant {
        Bet storage bet = bets[betId];
        if (bet.status != BetStatus.Active) revert BetNotActive();
        if (block.timestamp < bet.deadline) revert InvalidDeadline();

        bet.status = BetStatus.Expired;

        // Refund both parties
        usdc.safeTransfer(bet.partyA, bet.amount);
        usdc.safeTransfer(bet.partyB, bet.amount);

        emit BetExpired(betId);
    }

    // ─── Admin Functions ─────────────────────────────────────────────────

    function setOracle(address _oracle) external onlyOracle {
        if (_oracle == address(0)) revert ZeroAddress();
        emit OracleUpdated(oracle, _oracle);
        oracle = _oracle;
    }

    function setFee(uint256 _feeBps) external onlyOracle {
        require(_feeBps <= MAX_FEE_BPS, "Fee too high");
        emit FeeUpdated(feeBps, _feeBps);
        feeBps = _feeBps;
    }

    // ─── View Functions ──────────────────────────────────────────────────

    function getBet(bytes32 betId) external view returns (Bet memory) {
        return bets[betId];
    }

    function getStats() external view returns (uint256 _totalBets, uint256 _totalVolume, uint256 _totalResolved) {
        return (totalBets, totalVolume, totalResolved);
    }
}
