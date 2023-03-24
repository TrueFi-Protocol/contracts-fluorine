// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

contract TestContract {
    constructor() {
        require(block.chainid == 31337, "TC: Only for testing");
    }
}
