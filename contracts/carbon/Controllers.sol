pragma solidity ^0.8.18;

import {DepositController} from "contracts-carbon/contracts/controllers/DepositController.sol";
import {TransferController} from "contracts-carbon/contracts/controllers/TransferController.sol";
import {WithdrawController} from "contracts-carbon/contracts/controllers/WithdrawController.sol";
import {AllowAllLenderVerifier} from "contracts-carbon/contracts/lenderVerifiers/AllowAllLenderVerifier.sol";

contract DepositControllerWrapper is DepositController {}

contract TransferControllerWrapper is TransferController {}

contract WithdrawControllerWrapper is WithdrawController {}

contract AllowAllLenderVerifierWrapper is AllowAllLenderVerifier {}
