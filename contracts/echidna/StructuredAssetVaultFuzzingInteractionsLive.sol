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

import {StructuredAssetVaultFuzzingInitLive} from "./StructuredAssetVaultFuzzingInitLive.sol";
import {DeficitCheckpoint} from "../interfaces/IStructuredAssetVault.sol";
import {Status} from "../interfaces/IStructuredAssetVault.sol";

uint256 constant DAY = 1 days;

contract StructuredAssetVaultFuzzingInteractionsLive is StructuredAssetVaultFuzzingInitLive {
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
        uint256 rawNewOutstandingAssets,
        string calldata newAssetReportId,
        bool optimistic
    ) public {
        structuredAssetVault.updateCheckpoints();
        uint256 amount;
        uint256 newOutstandingAssets;
        if (!optimistic) {
            amount = (rawAmount % structuredAssetVault.virtualTokenBalance()) + 1;
            newOutstandingAssets = rawNewOutstandingAssets;
        } else {
            amount = (rawAmount % structuredAssetVault.virtualTokenBalance()) + 1;
            uint256 oldOutstandingAssets = structuredAssetVault.outstandingAssets();
            uint256 equityValue = equityTranche.totalAssets();
            (uint256 lowerBound, uint256 upperBound) = _expectedEquityBounds();
            uint256 totalDeficit = _totalDeficit();
            uint256 newOutstandingAssetsLowerBound = lowerBound + oldOutstandingAssets + amount - equityValue + totalDeficit;
            uint256 newOutstandingAssetsUpperBound = upperBound + oldOutstandingAssets + amount - equityValue + totalDeficit;
            newOutstandingAssets =
                (rawNewOutstandingAssets % (newOutstandingAssetsUpperBound - newOutstandingAssetsLowerBound)) +
                newOutstandingAssetsLowerBound;
        }
        manager.disburse(structuredAssetVault, address(borrower), amount, newOutstandingAssets, newAssetReportId);
        if (optimistic) {
            assert(_expectedEquityRateMatched());
        }
    }

    function repay(
        uint256 rawPrincipalRepaid,
        uint256 rawInterestRepaid,
        uint256 rawNewOutstandingAssets,
        string calldata newAssetReportId,
        bool optimistic
    ) public {
        uint256 principalRepaid;
        uint256 interestRepaid;
        uint256 newOutstandingAssets;
        if (!optimistic) {
            principalRepaid = rawPrincipalRepaid % structuredAssetVault.outstandingPrincipal();
            interestRepaid = rawInterestRepaid % (token.balanceOf(address(manager)) - principalRepaid);
            newOutstandingAssets = rawNewOutstandingAssets;
        } else {
            principalRepaid = rawPrincipalRepaid % structuredAssetVault.outstandingPrincipal();
            interestRepaid = rawInterestRepaid % (token.balanceOf(address(manager)) - principalRepaid);
            uint256 oldOutstandingAssets = structuredAssetVault.outstandingAssets();
            uint256 equityValue = equityTranche.totalAssets();
            (uint256 lowerBound, uint256 upperBound) = _expectedEquityBounds();
            uint256 totalDeficit = _totalDeficit();
            uint256 newOutstandingAssetsLowerBound;
            if (lowerBound + oldOutstandingAssets + totalDeficit > principalRepaid + interestRepaid + equityValue) {
                newOutstandingAssetsLowerBound =
                    lowerBound +
                    oldOutstandingAssets -
                    principalRepaid -
                    interestRepaid -
                    equityValue +
                    totalDeficit;
            } else {
                newOutstandingAssetsLowerBound = 0;
            }
            uint256 newOutstandingAssetsUpperBound = upperBound +
                oldOutstandingAssets -
                principalRepaid -
                interestRepaid -
                equityValue +
                totalDeficit;
            newOutstandingAssets =
                (rawNewOutstandingAssets % (newOutstandingAssetsUpperBound - newOutstandingAssetsLowerBound)) +
                newOutstandingAssetsLowerBound;
        }
        manager.repay(structuredAssetVault, principalRepaid, interestRepaid, newOutstandingAssets, newAssetReportId);
    }

    function close() public {
        manager.close(structuredAssetVault);
    }

    function _totalDeficit() internal view returns (uint256) {
        uint256 totalDeficit = 0;
        for (uint256 i = 1; i < _getNumberOfTranches(); i++) {
            (, , , , DeficitCheckpoint memory checkpoint) = structuredAssetVault.tranchesData(i);
            totalDeficit += checkpoint.deficit;
        }

        return totalDeficit;
    }
}
