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

import {StructuredAssetVaultFuzzingInitCapitalFormation} from "./StructuredAssetVaultFuzzingInitCapitalFormation.sol";
import {BASIS_PRECISION, YEAR} from "../interfaces/IStructuredAssetVault.sol";

import {ABDKMath64x64} from "./ABDKMath64x64.sol";

uint256 constant DAY = 1 days;

contract StructuredAssetVaultFuzzingInitLive is StructuredAssetVaultFuzzingInitCapitalFormation {
    using ABDKMath64x64 for int128;

    uint256[] public initialTrancheValues;

    constructor() {
        _startAssetVault();
        _disburseInitialTokens();
    }

    function _startAssetVault() internal {
        for (uint256 i = 0; i < _getNumberOfTranches(); i++) {
            initialTrancheValues.push(structuredAssetVault.tranches(i).totalAssets());
        }
        manager.start(structuredAssetVault);
    }

    function _disburseInitialTokens() internal {
        // TODO
    }

    function _expectedEquityRateMatched() internal view returns (bool) {
        (uint256 lowerBound, uint256 upperBound) = _expectedEquityBounds();

        uint256 equityValue = equityTranche.totalAssets();

        return equityValue >= lowerBound && equityValue <= upperBound;
    }

    function _expectedEquityBounds() internal view returns (uint256 lowerBound, uint256 upperBound) {
        uint256 timePassed = block.timestamp - structuredAssetVault.startDate();
        int128 initialEquityValue = ABDKMath64x64.fromUInt(initialTrancheValues[0]);
        int128 _lowerBound = initialEquityValue.mul(
            _exp((expectedEquityRate.from - 4 * FEE_RATE) * timePassed, BASIS_PRECISION * YEAR)
        );
        int128 _upperBound = initialEquityValue.mul(_exp(expectedEquityRate.to * timePassed, BASIS_PRECISION * YEAR));

        lowerBound = _lowerBound.toUInt();
        upperBound = _upperBound.toUInt();
    }

    function _exp(uint256 numerator, uint256 denominator) internal pure returns (int128) {
        int128 _numerator = ABDKMath64x64.fromUInt(numerator);
        int128 _denominator = ABDKMath64x64.fromUInt(denominator);
        int128 x = _numerator.div(_denominator);
        return ABDKMath64x64.exp(x);
    }
}
