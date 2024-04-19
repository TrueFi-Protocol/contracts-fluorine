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

import {StructuredAssetVaultFactory, IProtocolConfig, IERC20WithDecimals, AssetVaultParams, TrancheData, ExpectedEquityRate} from "../StructuredAssetVaultFactory.sol";

contract OpenStructuredAssetVaultFactory is StructuredAssetVaultFactory {
    constructor(
        address _assetVaultImplementation,
        address _trancheImplementation,
        IProtocolConfig _protocolConfig
    ) StructuredAssetVaultFactory(_assetVaultImplementation, _trancheImplementation, _protocolConfig) {}

    function createAssetVault(
        IERC20WithDecimals asset,
        AssetVaultParams calldata assetVaultParams,
        TrancheData[] calldata tranchesData,
        ExpectedEquityRate calldata expectedEquityRate,
        bool onlyAllowedBorrowers
    ) external override {
        _createAssetVault(asset, assetVaultParams, tranchesData, expectedEquityRate, onlyAllowedBorrowers);
    }
}
