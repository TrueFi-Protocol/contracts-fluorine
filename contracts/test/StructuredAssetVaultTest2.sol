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

import "../StructuredAssetVault.sol";

/**
 * @dev This contract is used to test the StructuredAssetVault contract.
 *      The intention is to easily set non-settable values and have access to private methods.
 *      Please don't override any StructuredAssetVault methods in this contract.
 */
contract StructuredAssetVaultTest2 is StructuredAssetVault {
    constructor(
        address manager,
        address[] memory allowedBorrowers,
        IERC20WithDecimals _asset,
        IProtocolConfig _protocolConfig,
        AssetVaultParams memory assetVaultParams,
        TrancheInitData[] memory tranchesInitData,
        ExpectedEquityRate memory _expectedEquityRate
    ) {
        initialize(manager, allowedBorrowers, _asset, _protocolConfig, assetVaultParams, tranchesInitData, _expectedEquityRate);
    }

    function assumedTrancheValue(uint256 trancheIdx) external view returns (uint256) {
        return _assumedTrancheValue(trancheIdx, _limitedBlockTimestamp());
    }
}
