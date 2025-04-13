// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./Contract1.sol";

contract C2 is C1{
    
    constructor() C1(msg.sender) {
    }
}