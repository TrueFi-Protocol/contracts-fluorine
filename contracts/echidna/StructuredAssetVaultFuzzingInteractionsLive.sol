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

import {MAX_TOKENS} from "./StructuredAssetVaultFuzzingInitCapitalFormation.sol";
import {StructuredAssetVaultFuzzingInitLive} from "./StructuredAssetVaultFuzzingInitLive.sol";
import {Status} from "../interfaces/IStructuredAssetVault.sol";
import {Checkpoint, ITrancheVault} from "../interfaces/ITrancheVault.sol";

uint256 constant DAY = 1 days;

enum OperationVariant {
    Pessimistic,
    Expected,
    Optimistic
}

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

    function disburseThenUpdateState(
        uint256 rawAmount,
        uint256 rawNewOutstandingAssets,
        string calldata newAssetReportId,
        OperationVariant variant
    ) public {
        structuredAssetVault.updateCheckpoints();
        uint256 amount = (rawAmount % structuredAssetVault.virtualTokenBalance()) + 1;
        uint256 newOutstandingAssets = _prepareUpdate(rawNewOutstandingAssets, variant) + amount;
        manager.disburseThenUpdateState(structuredAssetVault, address(borrower), amount, newOutstandingAssets, newAssetReportId);
        if (variant == OperationVariant.Expected) {
            assert(_expectedEquityRateMatched());
        }
    }

    function updateStateThenRepay(
        uint256 rawNewOutstandingAssets,
        uint256 rawPrincipalRepaid,
        uint256 rawInterestRepaid,
        string calldata newAssetReportId,
        OperationVariant variant
    ) public {
        uint256 principalRepaid = rawPrincipalRepaid % structuredAssetVault.outstandingPrincipal();
        uint256 interestRepaid = rawInterestRepaid % (token.balanceOf(address(manager)) - principalRepaid);
        uint256 newOutstandingAssets = _prepareUpdate(rawNewOutstandingAssets, variant);

        manager.updateStateThenRepay(structuredAssetVault, newOutstandingAssets, principalRepaid, interestRepaid, newAssetReportId);
        if (variant == OperationVariant.Expected) {
            assert(_expectedEquityRateMatched());
        }
    }

    function close() public {
        manager.close(structuredAssetVault);
    }

    function _totalDeficit() internal view returns (uint256) {
        uint256 totalDeficit = 0;
        ITrancheVault[] memory tranches = structuredAssetVault.getTranches();
        for (uint256 i = 1; i < _getNumberOfTranches(); i++) {
            Checkpoint memory checkpoint = tranches[i].getCheckpoint();
            totalDeficit += checkpoint.deficit;
        }

        return totalDeficit;
    }

    function _prepareUpdate(uint256 rawNewOutstandingAssets, OperationVariant variant) internal view returns (uint256) {
        (uint256 lowerBound, uint256 upperBound) = _outstandingAssetsBounds();
        if (variant == OperationVariant.Pessimistic) {
            return rawNewOutstandingAssets % lowerBound;
        } else if (variant == OperationVariant.Expected) {
            return (rawNewOutstandingAssets % (upperBound - lowerBound)) + lowerBound;
        } else {
            return (rawNewOutstandingAssets % MAX_TOKENS) + upperBound;
        }
    }

    function _outstandingAssetsBounds() internal view returns (uint256, uint256) {
        (uint256 _equityLowerBound, uint256 _equityUpperBound) = _expectedEquityBounds();
        uint256 oldOutstandingAssets = structuredAssetVault.outstandingAssets();
        uint256 equityValue = equityTranche.totalAssets();
        uint256 totalDeficit = _totalDeficit();
        uint256 outstandingAssetsLowerBound = _equityLowerBound + oldOutstandingAssets - equityValue + totalDeficit;
        uint256 outstandingAssetsUpperBound = _equityUpperBound + oldOutstandingAssets - equityValue + totalDeficit;
        return (outstandingAssetsLowerBound, outstandingAssetsUpperBound);
    }
}
