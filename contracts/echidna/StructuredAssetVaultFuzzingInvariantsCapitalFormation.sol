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
        structuredAssetVault.start();

        uint256 subordinateValue = equityTranche.totalAssets();

        for (uint256 i = 1; i < _getNumberOfTranches(); i++) {
            ITrancheVault tranche = structuredAssetVault.tranches(i);

            uint256 trancheValue = tranche.totalAssets();

            (, uint128 minSubordinateRatio, , , ) = structuredAssetVault.tranchesData(i);

            assert(subordinateValue * BASIS_PRECISION >= trancheValue * minSubordinateRatio);
        }
    }
}
