// SPDX-License-Identifier: BUSL-1.1
// Business Source License 1.1
// License text copyright (c) 2017 MariaDB Corporation Ab, All Rights Reserved. "Business Source License" is a trademark of MariaDB Corporation Ab.

// Parameters
// Licensor: TrueFi Foundation Ltd.
// Licensed Work: Structured Asset Vaults. The Licensed Work is (c) 2023 TrueFi Foundation Ltd.
// Additional Use Grant: Any uses listed and defined at this [LICENSE](https://github.com/trusttoken/contracts-fluorine/license.md)
// Change Date: December 31, 2030
// Change License: MIT

pragma solidity ^0.8.18;

import "../StructuredAssetVault.sol";
import {TestContract} from "./TestContract.sol";

/**
 * @dev This contract is used to test the StructuredAssetVault contract.
 *      The intention is to easily set non-settable values and have access to private methods.
 *      Please don't override any StructuredAssetVault methods in this contract.
 */
contract StructuredAssetVaultTest is StructuredAssetVault, TestContract {
    function setTrancheMinSubordinateRatio(uint256 trancheIdx, uint128 ratio) external {
        tranchesData[trancheIdx].minSubordinateRatio = ratio;
    }

    function onPortfolioStart(ITrancheVault tranche) external {
        tranche.onPortfolioStart();
    }

    function setMinimumSize(uint256 newSize) external {
        minimumSize = newSize;
    }

    function mockIncreaseVirtualTokenBalance(uint256 increment) external {
        virtualTokenBalance += increment;
    }

    function mockDecreaseVirtualTokenBalance(uint256 decrement) external {
        virtualTokenBalance -= decrement;
    }

    function mockOutstandingPrincipal(uint256 mockedValue) external {
        outstandingPrincipal = mockedValue;
    }

    function mockOutstandingAssets(uint256 mockedValue) external {
        outstandingAssets = mockedValue;
    }
}
