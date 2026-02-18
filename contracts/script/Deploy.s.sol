// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {VoiceBetEscrow} from "../src/VoiceBetEscrow.sol";

contract DeployVoiceBetEscrow is Script {
    // Monad Mainnet USDC (Circle CCTP)
    address constant USDC_MONAD = 0x754704Bc059F8C67012fEd69BC8A327a5aafb603;

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address oracle = vm.envAddress("ORACLE_ADDRESS");
        address treasury = vm.envAddress("TREASURY_ADDRESS");

        vm.startBroadcast(deployerKey);

        VoiceBetEscrow escrow = new VoiceBetEscrow(USDC_MONAD, oracle, treasury);

        console.log("VoiceBetEscrow deployed at:", address(escrow));
        console.log("  USDC:", USDC_MONAD);
        console.log("  Oracle:", oracle);
        console.log("  Treasury:", treasury);

        vm.stopBroadcast();
    }
}
