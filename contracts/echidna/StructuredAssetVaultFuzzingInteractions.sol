// SPDX-License-Identifier: BUSL-1.1
// Business Source License 1.1
// License text copyright (c) 2017 MariaDB Corporation Ab, All Rights Reserved. "Business Source License" is a trademark of MariaDB Corporation Ab.

// Parameters
// Licensor: TrueFi Foundation Ltd.
// Licensed Work: Structured Credit Vaults. The Licensed Work is (c) 2022 TrueFi Foundation Ltd.
// Additional Use Grant: Any uses listed and defined at this [LICENSE](https://github.com/trusttoken/contracts-carbon/license.md)
// Change Date: December 31, 2025
// Change License: MIT

pragma solidity ^0.8.18;

import {StructuredAssetVaultFuzzingInit} from "./StructuredAssetVaultFuzzingInit.sol";
import {Status} from "../interfaces/IStructuredAssetVault.sol";

uint256 constant DAY = 1 days;

contract StructuredAssetVaultFuzzingInteractions is StructuredAssetVaultFuzzingInit {
    uint256 internal previousTotalAssets;
    Status internal previousStatus;

    constructor() {
        previousStatus = structuredAssetVault.status();
        previousTotalAssets = structuredAssetVault.totalAssets();
    }

    function updateTotalAssets() public {
        previousTotalAssets = structuredAssetVault.totalAssets();
    }

    function updatePreviousStatus() public {
        previousStatus = structuredAssetVault.status();
    }

    function updateCheckpoints() public {
        structuredAssetVault.updateCheckpoints();
    }

    function disburse(
        uint256 rawAmount,
        uint256 newOutstandingAssets,
        string calldata newAssetReportId
    ) public {
        uint256 amount = rawAmount % structuredAssetVault.virtualTokenBalance();
        manager.disburse(structuredAssetVault, address(borrower), amount, newOutstandingAssets, newAssetReportId);
    }

    function repay(
        uint256 rawPrincipalRepaid,
        uint256 rawInterestRepaid,
        uint256 newOutstandingAssets,
        string calldata newAssetReportId
    ) public {
        uint256 principalRepaid = rawPrincipalRepaid % token.balanceOf(address(manager));
        uint256 interestRepaid = rawInterestRepaid % token.balanceOf(address(manager));
        manager.repay(structuredAssetVault, principalRepaid, interestRepaid, newOutstandingAssets, newAssetReportId);
    }

    function start() public {
        manager.start(structuredAssetVault);
    }

    function close() public {
        manager.close(structuredAssetVault);
    }

    function _getNumberOfTranches() internal view returns (uint256) {
        return structuredAssetVault.getTranches().length;
    }
}
