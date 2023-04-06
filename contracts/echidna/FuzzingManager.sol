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

import {IStructuredAssetVault, Status} from "../StructuredAssetVault.sol";
import {IDepositController} from "../interfaces/IDepositController.sol";
import {IWithdrawController} from "../interfaces/IWithdrawController.sol";

contract FuzzingManager {
    function setDepositAllowed(
        IDepositController depositController,
        bool newDepositAllowed,
        Status portfolioStatus
    ) public {
        depositController.setDepositAllowed(newDepositAllowed, portfolioStatus);
    }

    function setWithdrawAllowed(
        IWithdrawController withdrawController,
        bool newWithdrawAllowed,
        Status portfolioStatus
    ) public {
        withdrawController.setWithdrawAllowed(newWithdrawAllowed, portfolioStatus);
    }

    function start(IStructuredAssetVault structuredAssetVault) public {
        structuredAssetVault.start();
    }

    function close(IStructuredAssetVault structuredAssetVault) public {
        structuredAssetVault.close();
    }
}
