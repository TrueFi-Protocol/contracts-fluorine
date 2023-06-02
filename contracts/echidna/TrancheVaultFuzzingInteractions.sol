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
import {ITrancheVault} from "../interfaces/ITrancheVault.sol";

contract TrancheVaultFuzzingInteractions is StructuredAssetVaultFuzzingInitCapitalFormation {
    function deposit(
        uint8 rawTrancheId,
        uint256 rawAmount,
        uint8 rawLender
    ) public {
        uint256 trancheId = rawTrancheId % _getNumberOfTranches();
        address lender = addresses[rawLender % addresses.length];
        uint256 amount = rawAmount % token.balanceOf(address(lender));
        ITrancheVault tranche = structuredAssetVault.tranches(trancheId);

        _depositAs(tranche, lender, amount);
    }

    function withdraw(
        uint8 rawTrancheId,
        uint256 rawAmount,
        uint8 rawLender
    ) public {
        uint256 trancheId = rawTrancheId % _getNumberOfTranches();
        ITrancheVault tranche = structuredAssetVault.tranches(trancheId);
        address lender = addresses[rawLender % addresses.length];
        uint256 amount = rawAmount % tranche.maxWithdraw(address(lender));

        _withdrawAs(tranche, lender, amount);
    }
}
