// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {TestContract} from "./TestContract.sol";
import {IStructuredAssetVault} from "../interfaces/IStructuredAssetVault.sol";

struct DisburseArgs {
    address recipient;
    uint256 amount;
    uint256 outstandingAssets;
    string assetReportId;
}

struct DepositArgs {
    uint256 amount;
    address receiver;
}

contract MultiAction is TestContract {
    IStructuredAssetVault public assetVault;

    constructor(IStructuredAssetVault _assetVault) {
        assetVault = _assetVault;
    }

    function disburseAndDeposit(
        DisburseArgs calldata disburseArgs,
        DepositArgs calldata depositArgs,
        uint256 trancheIdx
    ) external {
        assetVault.disburseThenUpdateState(
            disburseArgs.recipient,
            disburseArgs.amount,
            disburseArgs.outstandingAssets,
            disburseArgs.assetReportId
        );
        assetVault.asset().approve(address(assetVault.tranches(trancheIdx)), type(uint256).max);
        assetVault.tranches(trancheIdx).deposit(depositArgs.amount, depositArgs.receiver);
    }
}
