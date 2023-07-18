pragma solidity ^0.8.18;

import {DepositController} from "contracts-carbon/contracts/controllers/DepositController.sol";
import {TransferEnabledController} from "contracts-carbon/contracts/controllers/TransferEnabledController.sol";
import {WithdrawController} from "contracts-carbon/contracts/controllers/WithdrawController.sol";
import {AllowAllLenderVerifier} from "contracts-carbon/contracts/lenderVerifiers/AllowAllLenderVerifier.sol";

contract DepositControllerWrapper is DepositController {}

contract TransferControllerWrapper is TransferEnabledController {}

contract WithdrawControllerWrapper is WithdrawController {}

contract AllowAllLenderVerifierWrapper is AllowAllLenderVerifier {}
