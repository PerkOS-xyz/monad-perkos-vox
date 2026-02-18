// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {VoiceBetEscrow} from "../src/VoiceBetEscrow.sol";
import {ERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract VoiceBetEscrowTest is Test {
    VoiceBetEscrow public escrow;
    MockUSDC public usdc;

    address oracle = makeAddr("oracle");
    address treasury = makeAddr("treasury");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    bytes32 betId1 = keccak256("bet-001");
    uint256 betAmount = 250_000; // $0.25
    uint64 deadline;

    function setUp() public {
        usdc = new MockUSDC();
        escrow = new VoiceBetEscrow(address(usdc), oracle, treasury);
        deadline = uint64(block.timestamp + 1 days);

        // Fund users
        usdc.mint(alice, 10_000_000); // $10
        usdc.mint(bob, 10_000_000);   // $10

        // Approve escrow
        vm.prank(alice);
        usdc.approve(address(escrow), type(uint256).max);
        vm.prank(bob);
        usdc.approve(address(escrow), type(uint256).max);
    }

    function test_CreateBet() public {
        vm.prank(alice);
        escrow.createBet(betId1, bob, betAmount, "BTC > 100K", "crypto_price", deadline);

        VoiceBetEscrow.Bet memory bet = escrow.getBet(betId1);
        assertEq(bet.partyA, alice);
        assertEq(bet.partyB, bob);
        assertEq(bet.amount, betAmount);
        assertEq(uint8(bet.status), uint8(VoiceBetEscrow.BetStatus.Pending));
        assertEq(usdc.balanceOf(address(escrow)), betAmount);
    }

    function test_MatchBet() public {
        vm.prank(alice);
        escrow.createBet(betId1, bob, betAmount, "BTC > 100K", "crypto_price", deadline);

        vm.prank(bob);
        escrow.matchBet(betId1);

        VoiceBetEscrow.Bet memory bet = escrow.getBet(betId1);
        assertEq(uint8(bet.status), uint8(VoiceBetEscrow.BetStatus.Active));
        assertEq(usdc.balanceOf(address(escrow)), betAmount * 2);
    }

    function test_ResolveBet_WinnerA() public {
        _createAndMatchBet();

        uint256 aliceBefore = usdc.balanceOf(alice);
        uint256 treasuryBefore = usdc.balanceOf(treasury);

        vm.prank(oracle);
        escrow.resolveBet(betId1, alice);

        VoiceBetEscrow.Bet memory bet = escrow.getBet(betId1);
        assertEq(uint8(bet.status), uint8(VoiceBetEscrow.BetStatus.Resolved));
        assertEq(bet.winner, alice);

        // Winner gets 2x - 2% fee
        uint256 totalPot = betAmount * 2;  // 500_000
        uint256 fee = (totalPot * 200) / 10_000; // 10_000
        uint256 payout = totalPot - fee; // 490_000

        assertEq(usdc.balanceOf(alice) - aliceBefore, payout);
        assertEq(usdc.balanceOf(treasury) - treasuryBefore, fee);
        assertEq(usdc.balanceOf(address(escrow)), 0);
    }

    function test_ResolveBet_WinnerB() public {
        _createAndMatchBet();

        uint256 bobBefore = usdc.balanceOf(bob);

        vm.prank(oracle);
        escrow.resolveBet(betId1, bob);

        uint256 totalPot = betAmount * 2;
        uint256 fee = (totalPot * 200) / 10_000;
        uint256 payout = totalPot - fee;

        assertEq(usdc.balanceOf(bob) - bobBefore, payout);
    }

    function test_CancelBet() public {
        vm.prank(alice);
        escrow.createBet(betId1, bob, betAmount, "BTC > 100K", "crypto_price", deadline);

        uint256 aliceBefore = usdc.balanceOf(alice);

        vm.prank(alice);
        escrow.cancelBet(betId1);

        VoiceBetEscrow.Bet memory bet = escrow.getBet(betId1);
        assertEq(uint8(bet.status), uint8(VoiceBetEscrow.BetStatus.Cancelled));
        assertEq(usdc.balanceOf(alice) - aliceBefore, betAmount); // Refunded
    }

    function test_ClaimExpired() public {
        _createAndMatchBet();

        // Warp past deadline
        vm.warp(deadline + 1);

        uint256 aliceBefore = usdc.balanceOf(alice);
        uint256 bobBefore = usdc.balanceOf(bob);

        escrow.claimExpired(betId1);

        assertEq(usdc.balanceOf(alice) - aliceBefore, betAmount);
        assertEq(usdc.balanceOf(bob) - bobBefore, betAmount);
    }

    function test_Stats() public {
        _createAndMatchBet();

        (uint256 total, uint256 volume, uint256 resolved) = escrow.getStats();
        assertEq(total, 1);
        assertEq(volume, betAmount * 2); // Both sides funded
        assertEq(resolved, 0);

        vm.prank(oracle);
        escrow.resolveBet(betId1, alice);

        (, , resolved) = escrow.getStats();
        assertEq(resolved, 1);
    }

    function test_RevertWhen_NonOracleResolve() public {
        _createAndMatchBet();
        vm.prank(alice);
        vm.expectRevert(VoiceBetEscrow.OnlyOracle.selector);
        escrow.resolveBet(betId1, alice);
    }

    function test_RevertWhen_InvalidWinner() public {
        _createAndMatchBet();
        vm.prank(oracle);
        vm.expectRevert(VoiceBetEscrow.InvalidWinner.selector);
        escrow.resolveBet(betId1, treasury);
    }

    function test_RevertWhen_BetTooSmall() public {
        vm.prank(alice);
        vm.expectRevert(VoiceBetEscrow.InvalidAmount.selector);
        escrow.createBet(betId1, bob, 100, "test", "fun", deadline);
    }

    function test_RevertWhen_BetTooLarge() public {
        usdc.mint(alice, 100_000_000);
        vm.prank(alice);
        vm.expectRevert(VoiceBetEscrow.InvalidAmount.selector);
        escrow.createBet(betId1, bob, 20_000_000, "test", "fun", deadline);
    }

    function test_RevertWhen_MatchOwnBet() public {
        vm.prank(alice);
        escrow.createBet(betId1, bob, betAmount, "test", "fun", deadline);
        vm.prank(alice);
        vm.expectRevert(VoiceBetEscrow.NotParty.selector);
        escrow.matchBet(betId1);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────

    function _createAndMatchBet() internal {
        vm.prank(alice);
        escrow.createBet(betId1, bob, betAmount, "BTC > 100K", "crypto_price", deadline);
        vm.prank(bob);
        escrow.matchBet(betId1);
    }
}
