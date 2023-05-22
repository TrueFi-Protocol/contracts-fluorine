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

import {StructuredAssetVaultFuzzingInteractionsCapitalFormation} from "./StructuredAssetVaultFuzzingInteractionsCapitalFormation.sol";
import {Status, TrancheData} from "../interfaces/IStructuredAssetVault.sol";
import {StructuredAssetVault} from "../StructuredAssetVault.sol";
import {ITrancheVault, Checkpoint} from "../interfaces/ITrancheVault.sol";
import {TrancheVault} from "../carbon/TrancheVault.sol";
import {BASIS_PRECISION, TrancheData} from "../interfaces/IStructuredAssetVault.sol";

uint256 constant DAY = 1 days;

contract StructuredAssetVaultFuzzingInvariantsCapitalFormation is StructuredAssetVaultFuzzingInteractionsCapitalFormation {
    function verify_minSubordinateRatioIsSatisfiedOnStart() external {
        require(structuredAssetVault.status() == Status.CapitalFormation);
        manager.start(structuredAssetVault);
        emit LogString("start vault");

        assert(_minSubordinateRatioSatisfied());
    }

    function verify_totalAssetsContinuousOnStart() external {
        uint256[] memory totalAssetsBefore = _tranchesTotalAssets();

        manager.start(structuredAssetVault);

        uint256[] memory totalAssetsAfter = _tranchesTotalAssets();

        for (uint256 i = 0; i < totalAssetsBefore.length; i++) {
            emit LogUint256("tranche id", i);
            assertEq(totalAssetsBefore[i], totalAssetsAfter[i], "totalAssets are continous on start");
        }
    }

    function _tranchesTotalAssets() internal view returns (uint256[] memory totalAssets) {
        totalAssets = new uint256[](3);
        for (uint256 i = 0; i < _getNumberOfTranches(); i++) {
            totalAssets[i] = structuredAssetVault.tranches(i).totalAssets();
        }
    }

    function verify_assetVaultCanAlwaysBeClosedIfNotStartedBeforeStartDeadline() public {
        require(structuredAssetVault.status() == Status.CapitalFormation);

        uint256 startDeadline = structuredAssetVault.startDeadline();

        if (block.timestamp < startDeadline) {
            try structuredAssetVault.close() {
                assertWithMsg(false, "asset vault cannot be closed if it's before start deadline");
            } catch {
                // correct
            }
        } else {
            try structuredAssetVault.close() {
                // correct
            } catch {
                assertWithMsg(false, "asset vault can be closed after start deadline");
            }
        }

        revert();
    }
}
