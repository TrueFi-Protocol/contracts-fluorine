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

import {StructuredAssetVaultFuzzingInteractionsLive} from "./StructuredAssetVaultFuzzingInteractionsLive.sol";
import {BASIS_PRECISION, YEAR} from "../interfaces/IStructuredAssetVault.sol";
import {Status, TrancheData} from "../interfaces/IStructuredAssetVault.sol";
import {StructuredAssetVault} from "../StructuredAssetVault.sol";
import {ITrancheVault, Checkpoint} from "../interfaces/ITrancheVault.sol";
import {TrancheVault} from "../carbon/TrancheVault.sol";

uint256 constant DAY = 1 days;

contract StructuredAssetVaultFuzzingInvariantsLive is StructuredAssetVaultFuzzingInteractionsLive {
    function verify_minSubordinateRatioIsSatisfiedIfExpectedEquityRateIsMatched() external view {
        require(_expectedEquityRateMatched());

        assert(_minSubordinateRatioSatisfied());
    }
}
