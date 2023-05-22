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

import {StructuredAssetVaultFuzzingInitClosed} from "./StructuredAssetVaultFuzzingInitClosed.sol";
import {TrancheVaultFuzzingInteractions} from "./TrancheVaultFuzzingInteractions.sol";
import {Status} from "../interfaces/IStructuredAssetVault.sol";

uint256 constant DAY = 1 days;

contract StructuredAssetVaultFuzzingInteractionsClosed is StructuredAssetVaultFuzzingInitClosed, TrancheVaultFuzzingInteractions {
    uint256 internal previousTotalAssets;
    uint256 internal previousTokenBalance;
    Status internal previousStatus;

    constructor() {
        previousStatus = structuredAssetVault.status();
        previousTokenBalance = token.balanceOf(address(structuredAssetVault));
        previousTotalAssets = structuredAssetVault.totalAssets();
    }

    function updateTotalAssets() public {
        previousTotalAssets = structuredAssetVault.totalAssets();
    }

    function updatePreviousTokenBalance() public {
        previousTokenBalance = token.balanceOf(address(structuredAssetVault));
    }

    function updatePreviousStatus() public {
        previousStatus = structuredAssetVault.status();
    }

    function updateCheckpoints() public {
        structuredAssetVault.updateCheckpoints();
    }

    function updateStateThenRepay(
        uint256 newOutstandingAssets,
        uint256 rawPrincipalRepaid,
        uint256 rawInterestRepaid,
        string calldata newAssetReportId
    ) public {
        uint256 principalRepaid = rawPrincipalRepaid % structuredAssetVault.outstandingPrincipal();
        uint256 interestRepaid = rawInterestRepaid % (token.balanceOf(address(manager)) - principalRepaid);
        manager.updateStateThenRepay(structuredAssetVault, newOutstandingAssets, principalRepaid, interestRepaid, newAssetReportId);
    }
}
