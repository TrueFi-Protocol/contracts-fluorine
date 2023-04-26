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

import {IAccessControlEnumerable} from "@openzeppelin/contracts/access/IAccessControlEnumerable.sol";
import {IProtocolConfig} from "./IProtocolConfig.sol";
import {ITrancheVault} from "./ITrancheVault.sol";
import {IERC20WithDecimals} from "./IERC20WithDecimals.sol";
import {IProtocolConfig} from "./IProtocolConfig.sol";
import {IStructuredAssetVault, TrancheInitData, AssetVaultParams, ExpectedEquityRate} from "./IStructuredAssetVault.sol";

struct TrancheData {
    /// @dev Tranche name
    string name;
    /// @dev Tranche symbol
    string symbol;
    /// @dev Implementation of the controller applied when calling deposit-related functions
    address depositControllerImplementation;
    /// @dev Encoded args with initialize method selector from deposit controller
    bytes depositControllerInitData;
    /// @dev Implementation of the controller applied when calling withdraw-related functions
    address withdrawControllerImplementation;
    /// @dev Encoded args with initialize method selector from withdraw controller
    bytes withdrawControllerInitData;
    /// @dev Implementation of the controller used when calling transfer-related functions
    address transferControllerImplementation;
    /// @dev Encoded args with initialize method selector from transfer controller
    bytes transferControllerInitData;
    /// @dev The APY expected to be granted at the end of the asset vault
    uint128 targetApy;
    /// @dev The minimum ratio of funds obtained in a tranche vault to its subordinate tranches
    uint128 minSubordinateRatio;
    /// @dev Manager fee expressed in BPS
    uint256 managerFeeRate;
}

/**
 * @title A factory for deploying Structured Asset Vaults
 * @dev Only whitelisted users can create asset vaults
 */
interface IStructuredAssetVaultFactory is IAccessControlEnumerable {
    /**
     * @notice Event fired on asset vault creation
     * @param newAssetVault Address of the newly created asset vault
     * @param manager Address of the asset vault manager
     * @param tranches List of adresses of tranche vaults deployed to store assets
     */
    event AssetVaultCreated(IStructuredAssetVault indexed newAssetVault, address indexed manager, ITrancheVault[] tranches);

    /**
     * @notice Event fired when list of allowed borrowers for specific manager is changed
     * @param manager Manager address
     * @param allowedBorrowers List of allowed borrowers associated with the manager
     */
    event AllowedBorrowersChanged(address indexed manager, address[] allowedBorrowers);

    /// @return Whitelisted manager role used for access control, allowing a user with this role to create StructuredAssetVault
    function WHITELISTED_MANAGER_ROLE() external view returns (bytes32);

    /// @return Address of the Tranche contract implementation used for asset vault deployment
    function trancheImplementation() external view returns (address);

    /// @return Address of the StructuredAssetVault contract implementation used for asset vault deployment
    function assetVaultImplementation() external view returns (address);

    /// @return Address of the ProtocolConfig
    function protocolConfig() external view returns (IProtocolConfig);

    /**
     * @param manager Address of supposed Asset Vault manager
     * @return allowedBorrowers List of addresses to which BORROWER_ROLE should be granted if given manager creates Asset Vault with onlyAllowedBorrowers flag set
     */
    function getAllowedBorrowers(address manager) external view returns (address[] memory allowedBorrowers);

    /**
     * @param manager Address of supposed Asset Vault manager
     * @param borrower Address of supposed Asset Vault borrower
     * @return Value indicating whether given borrower is included in manager's allowed borrowers list
     */
    function isBorrowerAllowed(address manager, address borrower) external view returns (bool);

    /**
     * @notice - adds or removes provided address from given manager's allowed borrowers list
     *         - can be executed only by protocol admin
     *         - reverts if given manager address does not have WHITELISTED_MANAGER_ROLE granted
     * @param manager Address of supposed Asset Vault manager
     * @param borrower Address of supposed Asset Vault borrower
     * @param shouldAllow Value indicating whether given borrower should be added or removed from given manager's allowed borrowers list
     */
    function setAllowedBorrower(
        address manager,
        address borrower,
        bool shouldAllow
    ) external;

    /**
     * @notice Creates a Asset Vault along with its tranche vaults
     * @dev Tranche vaults are ordered from the most volatile to the most stable
     * @param asset Address of ERC20 token on which Asset Vault should operate
     * @param assetVaultParams Parameters used for Asset Vault deployment
     * @param tranchesData Data used for tranche vaults deployment
     * @param expectedEquityRate APY range ({ from, to }) that is expected to be reached by tranche with index 0
     * @param onlyAllowedBorrowers Value indicating whether funds in Asset Vault can be disbursed only to restricted addresses or everyone can receive
     */
    function createAssetVault(
        IERC20WithDecimals asset,
        AssetVaultParams calldata assetVaultParams,
        TrancheData[] calldata tranchesData,
        ExpectedEquityRate calldata expectedEquityRate,
        bool onlyAllowedBorrowers
    ) external;

    /// @return All created Asset Vaults' addresses
    function getAssetVaults() external view returns (IStructuredAssetVault[] memory);
}
