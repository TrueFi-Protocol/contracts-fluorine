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

import {Status} from "../interfaces/IStructuredAssetVault.sol";

struct WithdrawAllowed {
    /// @dev StructuredAssetVault status for which withdrawals should be enabled or disabled
    Status status;
    /// @dev Value indicating whether withdrawals should be enabled or disabled
    bool value;
}

/**
 * @title Contract for managing withdraw related settings
 * @dev Used by TrancheVault contract
 */
interface IWithdrawController {
    /**
     * @notice Event emitted when new floor is set
     * @param newFloor New floor value
     */
    event FloorChanged(uint256 newFloor);

    /**
     * @notice Event emitted when withdrawals are disabled or enabled for a specific StructuredAssetVault status
     * @param newWithdrawAllowed Value indicating whether withdrawals should be enabled or disabled
     * @param assetVaultStatus StructuredAssetVault status for which changes are applied
     */
    event WithdrawAllowedChanged(bool newWithdrawAllowed, Status assetVaultStatus);

    /**
     * @notice Event emitted when withdraw fee rate is switched
     * @param newFeeRate New withdraw fee rate value (in BPS)
     */
    event WithdrawFeeRateChanged(uint256 newFeeRate);

    /// @return WithdrawController manager role used for access control
    function MANAGER_ROLE() external view returns (bytes32);

    /// @return Min assets amount that needs to stay in TrancheVault interracting with WithdrawController when related StructuredAssetVault is not in Closed state
    function floor() external view returns (uint256);

    /// @return Rate (in BPS) of the fee applied to the withdraw amount
    function withdrawFeeRate() external view returns (uint256);

    /// @return Value indicating whether withdrawals are allowed when related StructuredAssetVault is in given status
    /// @param status StructuredAssetVault status
    function withdrawAllowed(Status status) external view returns (bool);

    /**
     * @notice Setup contract with given params
     * @dev Used by Initializable contract (can be called only once)
     * @param manager Address to which MANAGER_ROLE should be granted
     * @param withdrawFeeRate Withdraw fee rate (in BPS)
     * @param floor Floor value
     */
    function initialize(
        address manager,
        uint256 withdrawFeeRate,
        uint256 floor
    ) external;

    /**
     * @return assets Max assets amount that can be withdrawn from TrancheVault for shares of given owner
     * @param owner Shares owner address
     */
    function maxWithdraw(address owner) external view returns (uint256 assets);

    /**
     * @return shares Max TrancheVault shares amount given owner can burn to withdraw assets
     * @param owner Shares owner address
     */
    function maxRedeem(address owner) external view returns (uint256 shares);

    /**
     * @notice Simulates withdraw assets conversion including fees
     * @return shares Shares amount that needs to be burnt to obtain given assets amount
     * @param assets Tested assets amount
     */
    function previewWithdraw(uint256 assets) external view returns (uint256 shares);

    /**
     * @notice Simulates redeem shares conversion including fees
     * @return assets Assets amount that will be obtained from the given shares burnt
     * @param shares Tested shares amount
     */
    function previewRedeem(uint256 shares) external view returns (uint256 assets);

    /**
     * @notice Simulates withdraw result
     * @return shares Shares amount that needs to be burnt to make a withdrawal with given params
     * @return withdrawFee Fee for a withdrawal with given params
     * @param sender Supposed withdraw transaction sender address
     * @param assets Supposed assets amount
     * @param receiver Supposed assets receiver address
     * @param owner Supposed shares owner
     */
    function onWithdraw(
        address sender,
        uint256 assets,
        address receiver,
        address owner
    ) external returns (uint256 shares, uint256 withdrawFee);

    /**
     * @notice Simulates redeem result
     * @return assets Assets amount that will be obtained from the redeem with given params
     * @return redeemFee Fee for a redeem with given params
     * @param sender Supposed redeem transaction sender address
     * @param shares Supposed shares amount
     * @param receiver Supposed assets receiver address
     * @param owner Supposed shares owner
     */
    function onRedeem(
        address sender,
        uint256 shares,
        address receiver,
        address owner
    ) external returns (uint256 assets, uint256 redeemFee);

    /**
     * @notice Floor setter
     * @param newFloor New floor value
     */
    function setFloor(uint256 newFloor) external;

    /**
     * @notice Withdraw allowed setter
     * @param newWithdrawAllowed Value indicating whether withdrawals should be allowed when related StructuredAssetVault is in given status
     * @param assetVaultStatus StructuredAssetVault status for which changes are applied
     */
    function setWithdrawAllowed(bool newWithdrawAllowed, Status assetVaultStatus) external;

    /**
     * @notice Withdraw fee rate setter
     * @param newFeeRate New withdraw fee rate (in BPS)
     */
    function setWithdrawFeeRate(uint256 newFeeRate) external;

    /**
     * @notice Allows to change floor, withdraw fee rate and enable or disable withdrawals at once
     * @param newFloor New floor value
     * @param newFeeRate New withdraw fee rate (in BPS)
     * @param newWithdrawAllowed New withdraw allowed settings
     */
    function configure(
        uint256 newFloor,
        uint256 newFeeRate,
        WithdrawAllowed memory newWithdrawAllowed
    ) external;
}
