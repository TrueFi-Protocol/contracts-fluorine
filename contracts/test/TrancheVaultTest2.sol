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

import {TrancheVault} from "contracts-carbon/contracts/TrancheVault.sol";
import {IERC20WithDecimals} from "contracts-carbon/contracts/interfaces/IERC20WithDecimals.sol";
import {IDepositController} from "contracts-carbon/contracts/interfaces/IDepositController.sol";
import {IWithdrawController} from "contracts-carbon/contracts/interfaces/IWithdrawController.sol";
import {ITransferController} from "contracts-carbon/contracts/interfaces/ITransferController.sol";
import {IProtocolConfig} from "contracts-carbon/contracts/interfaces/IProtocolConfig.sol";

contract TrancheVaultTest2 is TrancheVault {
    constructor(
        string memory _name,
        string memory _symbol,
        address _token,
        IDepositController _depositController,
        IWithdrawController _withdrawController,
        ITransferController _transferController,
        address _protocolConfig,
        uint256 _waterfallIndex,
        address manager,
        uint256 _managerFeeRate
    ) {
        initialize(
            _name,
            _symbol,
            IERC20WithDecimals(_token),
            _depositController,
            _withdrawController,
            _transferController,
            IProtocolConfig(_protocolConfig),
            _waterfallIndex,
            manager,
            _managerFeeRate
        );
    }
}
