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

import {StructuredAssetVaultFuzzingInteractionsWithLiveActions} from "./StructuredAssetVaultFuzzingInteractionsWithLiveActions.sol";
import {Status, TrancheData} from "../interfaces/IStructuredAssetVault.sol";
import {StructuredAssetVault} from "../StructuredAssetVault.sol";
import {ITrancheVault, Checkpoint} from "../interfaces/ITrancheVault.sol";
import {TrancheVault} from "../carbon/TrancheVault.sol";

uint256 constant DAY = 1 days;

contract StructuredAssetVaultFuzzingInvariantsWithLiveActions is StructuredAssetVaultFuzzingInteractionsWithLiveActions {
    function verify_statusIsNotCapitalFormation() public view {
        assert(structuredAssetVault.status() != Status.CapitalFormation);
    }

    function verify_virtualTokenBalanceEqualsTokenBalance() public view {
        assert(structuredAssetVault.virtualTokenBalance() == token.balanceOf(address(structuredAssetVault)));
    }

    function verify_updateCheckpointsContinuous() public {
        uint256[] memory waterfall_old = structuredAssetVault.calculateWaterfall();
        structuredAssetVault.updateCheckpoints();
        TrancheData[] memory trancheData_old = _getTranchesData();
        Checkpoint[] memory trancheCheckpoints_old = _getTrancheCheckpoints();
        structuredAssetVault.updateCheckpoints();
        uint256[] memory waterfall_new = structuredAssetVault.calculateWaterfall();
        TrancheData[] memory trancheData_new = _getTranchesData();
        Checkpoint[] memory trancheCheckpoints_new = _getTrancheCheckpoints();

        for (uint256 i = 0; i < waterfall_old.length; i++) {
            assert(waterfall_new[i] == waterfall_old[i]);

            assert(
                trancheData_new[i].deficitCheckpoint.deficit == trancheData_old[i].deficitCheckpoint.deficit &&
                    trancheData_new[i].deficitCheckpoint.timestamp == trancheData_old[i].deficitCheckpoint.timestamp
            );

            assert(
                trancheCheckpoints_new[i].totalAssets == trancheCheckpoints_old[i].totalAssets &&
                    trancheCheckpoints_new[i].protocolFeeRate == trancheCheckpoints_old[i].protocolFeeRate &&
                    trancheCheckpoints_new[i].timestamp == trancheCheckpoints_old[i].timestamp &&
                    trancheCheckpoints_new[i].unpaidFees == trancheCheckpoints_old[i].unpaidFees
            );
        }
    }

    function verify_onlyValidTransitions() public view {
        Status currentStatus = structuredAssetVault.status();
        assert(
            (previousStatus == Status.Live && currentStatus == Status.Live) ||
                (previousStatus == Status.Live && currentStatus == Status.Closed) ||
                (previousStatus == Status.Closed && currentStatus == Status.Closed)
        );
    }

    function verify_onlyValidStatuses() public view {
        Status status = structuredAssetVault.status();

        assert(status == Status.CapitalFormation || status == Status.Live || status == Status.Closed);
    }

    function verify_tokensAreDistributedCorrectlyOnClose() public {
        structuredAssetVault.updateCheckpoints();

        uint256[] memory assumedTrancheValues = new uint256[](3);
        for (uint256 i = 1; i < 3; i++) {
            assumedTrancheValues[i] = structuredAssetVault.assumedTrancheValue(i);
        }

        manager.close(structuredAssetVault);

        ITrancheVault[] memory trancheVaults = structuredAssetVault.getTranches();
        for (uint256 i = 2; i > 0; i--) {
            TrancheVault trancheVault = TrancheVault(address(trancheVaults[i]));
            TrancheVault lowerTrancheVault = TrancheVault(address(trancheVaults[i - 1]));

            uint256 trancheBalance = trancheVault.virtualTokenBalance();
            if (trancheBalance == assumedTrancheValues[i]) {
                continue;
            }

            assert(trancheBalance < assumedTrancheValues[i]);

            uint256 lowerTrancheBalance = lowerTrancheVault.virtualTokenBalance();
            assert(lowerTrancheBalance == 0);
        }

        revert();
    }

    function _getTranchesData() internal view returns (TrancheData[] memory) {
        ITrancheVault[] memory trancheVaults = structuredAssetVault.getTranches();
        TrancheData[] memory tranchesData = new TrancheData[](trancheVaults.length);

        for (uint256 i = 0; i < trancheVaults.length; i++) {
            tranchesData[i] = structuredAssetVault.getTrancheData(i);
        }

        return tranchesData;
    }

    function _getTrancheCheckpoints() internal view returns (Checkpoint[] memory) {
        ITrancheVault[] memory trancheVaults = structuredAssetVault.getTranches();
        Checkpoint[] memory trancheCheckpoints = new Checkpoint[](trancheVaults.length);
        for (uint256 i = 0; i < trancheVaults.length; i++) {
            trancheCheckpoints[i] = trancheVaults[i].getCheckpoint();
        }

        return trancheCheckpoints;
    }
}
