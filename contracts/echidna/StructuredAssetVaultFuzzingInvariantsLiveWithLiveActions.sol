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
import {StructuredAssetVaultFuzzingInteractionsLiveWithLiveActions} from "./StructuredAssetVaultFuzzingInteractionsLiveWithLiveActions.sol";
import {Status, TrancheData} from "../interfaces/IStructuredAssetVault.sol";
import {StructuredAssetVault} from "../StructuredAssetVault.sol";
import {ITrancheVault, Checkpoint} from "../interfaces/ITrancheVault.sol";
import {TrancheVault} from "../carbon/TrancheVault.sol";

uint256 constant DAY = 1 days;

contract StructuredAssetVaultFuzzingInvariantsLiveWithLiveActions is StructuredAssetVaultFuzzingInteractionsLiveWithLiveActions {
    function verify_statusIsNotCapitalFormation() public {
        assertWithMsg(structuredAssetVault.status() != Status.CapitalFormation, "asset vault is not in capital formation state");
    }

    function verify_virtualTokenBalanceEqualsTokenBalance() public {
        assertEq(
            structuredAssetVault.virtualTokenBalance(),
            token.balanceOf(address(structuredAssetVault)),
            "virtual token balance is equal to actual token balance"
        );
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
            emit LogUint256("tranche id", i);
            assertEq(waterfall_new[i], waterfall_old[i], "waterfall value is equal before and after update");

            assertEq(
                trancheData_new[i].deficitCheckpoint.deficit,
                trancheData_old[i].deficitCheckpoint.deficit,
                "deficit value is preserved after subsequent update"
            );
            assertEq(
                trancheData_new[i].deficitCheckpoint.timestamp,
                trancheData_old[i].deficitCheckpoint.timestamp,
                "deficit timestamp is preserved after subsequent update"
            );

            assertEq(
                trancheCheckpoints_new[i].totalAssets,
                trancheCheckpoints_old[i].totalAssets,
                "total assets are preserved after subsequent update"
            );
            assertEq(
                trancheCheckpoints_new[i].protocolFeeRate,
                trancheCheckpoints_old[i].protocolFeeRate,
                "protocol fee rate is preserved after subsequent update"
            );
            assertEq(
                trancheCheckpoints_new[i].timestamp,
                trancheCheckpoints_old[i].timestamp,
                "timestamp is preserved after subsequent update"
            );
            assertEq(
                trancheCheckpoints_new[i].unpaidFees,
                trancheCheckpoints_old[i].unpaidFees,
                "unpaid fees are preserved after subsequent update"
            );
        }
    }

    function verify_onlyValidTransitions() public {
        Status currentStatus = structuredAssetVault.status();
        assertWithMsg(
            (previousStatus == Status.Live && currentStatus == Status.Live) ||
                (previousStatus == Status.Live && currentStatus == Status.Closed) ||
                (previousStatus == Status.Closed && currentStatus == Status.Closed),
            "only valid state transitions"
        );
    }

    function verify_onlyValidStatuses() public {
        Status status = structuredAssetVault.status();

        assertWithMsg(status == Status.CapitalFormation || status == Status.Live || status == Status.Closed, "only valid statuses");
    }

    function verify_tokensAreDistributedCorrectlyOnClose() public {
        structuredAssetVault.updateCheckpoints();

        uint256[] memory assumedTrancheValues = new uint256[](3);
        for (uint256 i = 1; i < 3; i++) {
            assumedTrancheValues[i] = structuredAssetVault.assumedTrancheValue(i);
        }

        manager.close(structuredAssetVault);
        emit LogString("close asset vault");

        ITrancheVault[] memory trancheVaults = structuredAssetVault.getTranches();
        for (uint256 i = 2; i > 0; i--) {
            emit LogUint256("tranche id", i);
            TrancheVault trancheVault = TrancheVault(address(trancheVaults[i]));
            TrancheVault lowerTrancheVault = TrancheVault(address(trancheVaults[i - 1]));

            uint256 trancheBalance = trancheVault.virtualTokenBalance();
            if (trancheBalance == assumedTrancheValues[i]) {
                continue;
            }

            assertLt(trancheBalance, assumedTrancheValues[i], "tranche balance is not greater than the assumed tranche value");

            uint256 lowerTrancheBalance = lowerTrancheVault.virtualTokenBalance();
            assertEq(lowerTrancheBalance, 0, "lower tranche is empty if tranche doesn't meet assumed value");
        }

        revert();
    }

    function verify_convertToAssetsIsLinear(
        uint256 rawTrancheId,
        uint256 rawA,
        uint256 rawX,
        uint256 rawB,
        uint256 rawY
    ) external {
        uint256 trancheId = rawTrancheId % _getNumberOfTranches();
        ITrancheVault tranche = structuredAssetVault.tranches(trancheId);
        uint256 a = rawA % 10**(token.decimals() - 1);
        uint256 b = rawB % 10**(token.decimals() - 1);
        uint256 x = (rawX % MAX_TOKENS) + 10**token.decimals();
        uint256 y = (rawY % MAX_TOKENS) + 10**token.decimals();
        emit LogUint256("scalar a", a);
        emit LogUint256("shares x", x);
        emit LogUint256("scalar b", b);
        emit LogUint256("shares y", y);
        assertClose(
            tranche.convertToAssets(a * x + b * y),
            a * tranche.convertToAssets(x) + b * tranche.convertToAssets(y),
            "convertToAssets is linear",
            10**token.decimals()
        );
    }

    function verify_convertToSharesIsLinear(
        uint256 rawTrancheId,
        uint256 rawA,
        uint256 rawX,
        uint256 rawB,
        uint256 rawY
    ) external {
        uint256 trancheId = rawTrancheId % _getNumberOfTranches();
        ITrancheVault tranche = structuredAssetVault.tranches(trancheId);
        uint256 a = rawA % 10**(token.decimals() - 1);
        uint256 b = rawB % 10**(token.decimals() - 1);
        uint256 x = (rawX % MAX_TOKENS) + 10**token.decimals();
        uint256 y = (rawY % MAX_TOKENS) + 10**token.decimals();
        emit LogUint256("scalar a", a);
        emit LogUint256("assets x", x);
        emit LogUint256("scalar b", b);
        emit LogUint256("assets y", y);
        assertClose(
            tranche.convertToShares(a * x + b * y),
            a * tranche.convertToShares(x) + b * tranche.convertToShares(y),
            "convertToShares is linear",
            10**token.decimals()
        );
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
