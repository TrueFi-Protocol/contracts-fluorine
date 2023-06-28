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

import {IAccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/IAccessControlUpgradeable.sol";
import {ITrancheVault} from "./ITrancheVault.sol";
import {IERC20WithDecimals} from "./IERC20WithDecimals.sol";
import {IProtocolConfig} from "./IProtocolConfig.sol";

uint256 constant BASIS_PRECISION = 10000;
uint256 constant YEAR = 365 days;

enum Status {
    CapitalFormation,
    Live,
    Closed
}

struct TrancheData {
    /// @dev The APY expected to be granted at the end of the AssetVault Live phase (in BPS)
    uint128 targetApy;
    /// @dev The minimum required ratio of the sum of subordinate tranches assets to the tranche assets (in BPS)
    uint128 minSubordinateRatio;
    /// @dev The amount of assets transferred to the tranche after close() was called
    uint256 distributedAssets;
    /// @dev The potential maximum amount of tranche assets available to withdraw after close() was called
    uint256 maxValueOnClose;
}

struct TrancheInitData {
    /// @dev Address of the tranche vault
    ITrancheVault tranche;
    /// @dev The APY expected to be granted at the end of the AssetVault Live phase (in BPS)
    uint128 targetApy;
    /// @dev The minimum ratio of the sum of subordinate tranches assets to the tranche assets (in BPS)
    uint128 minSubordinateRatio;
}

struct AssetVaultParams {
    /// @dev AssetVault name
    string name;
    /// @dev AssetVault duration in seconds
    uint256 duration;
    /// @dev Capital formation period in seconds, used to calculate assetVault start deadline
    uint256 capitalFormationPeriod;
    /// @dev Minimum deposited amount needed to start the assetVault
    uint256 minimumSize;
}

struct ExpectedEquityRate {
    /// @dev Minimum expected APY on tranche 0 (expressed in bps)
    uint256 from;
    /// @dev Maximum expected APY on tranche 0 (expressed in bps)
    uint256 to;
}

/**
 * @title Structured AssetVault used for obtaining funds and managing disbursements
 * @notice AssetVault consists of multiple tranches, each offering a different yield for the lender
 *         based on the respective risk.
 */

interface IStructuredAssetVault is IAccessControlUpgradeable {
    /**
     * @notice Event emitted when assetVault is initialized
     * @param tranches Array of tranches addresses
     */
    event AssetVaultInitialized(ITrancheVault[] tranches);

    /**
     * @notice Event emitted when AssetVault status is changed
     * @param newStatus AssetVault status set
     */
    event AssetVaultStatusChanged(Status newStatus);

    /**
     * @notice Event emitted on updateState function call
     * @param actionId Unique id among all action types (updateState, disburse, repay)
     * @param outstandingAssets New outstanding assets amount declared by SAV manager
     * @param assetReportId IPFS CID under which asset report reflecting current SAV state is stored
     */
    event StateUpdated(uint256 indexed actionId, uint256 outstandingAssets, string indexed assetReportId);

    /**
     * @notice Event emitted on disburse function call
     * @param actionId Unique id among all action types (updateState, disburse, repay)
     * @param recipient Address to which funds are disbursed
     * @param amount Disbursed amount
     * @param assetReportId IPFS CID under which asset report reflecting current SAV state is stored
     */
    event Disburse(uint256 indexed actionId, address indexed recipient, uint256 amount, string indexed assetReportId);

    /**
     * @notice Event emitted on repay function call
     * @param actionId Unique id among all action types (updateState, disburse, repay)
     * @param caller Address from which function was called
     * @param principalRepaid Principal part of outstanding assets declared to be repaid
     * @param interestRepaid Interest part of outstanding assets declared to be repaid
     * @param assetReportId IPFS CID under which asset report reflecting current SAV state is stored
     */
    event Repay(
        uint256 indexed actionId,
        address indexed caller,
        uint256 principalRepaid,
        uint256 interestRepaid,
        string indexed assetReportId
    );

    /**
     * @notice Event emitted when tranches checkpoint is changed
     * @param totalAssets New values of tranches
     * @param protocolFeeRates New protocol fee rates for each tranche
     */
    event CheckpointUpdated(uint256[] totalAssets, uint256[] protocolFeeRates);

    /// @return Access control role allowing access to contract management functions
    function MANAGER_ROLE() external view returns (bytes32);

    /// @return Access control role allowing to call repay function
    function REPAYER_ROLE() external view returns (bytes32);

    /// @return Access control role allowing to disburse money to address with it
    function BORROWER_ROLE() external view returns (bytes32);

    /// @return Name of the StructuredAssetVault
    function name() external view returns (string memory);

    /// @return Address of asset which portfolio operates on
    function asset() external view returns (IERC20WithDecimals);

    /// @return Current AssetVault status
    function status() external view returns (Status);

    /// @return Timestamp of block in which StructuredAssetVault was switched to Live phase
    function startDate() external view returns (uint256);

    /**
     * @dev Returns expected end date or actual end date if AssetVault was closed prematurely.
     * @return The date by which the manager is supposed to close the AssetVault.
     */
    function endDate() external view returns (uint256);

    /**
     * @dev Timestamp after which anyone can close the AssetVault if it's in capital formation.
     * @return The date by which the manager is supposed to launch the AssetVault.
     */
    function startDeadline() external view returns (uint256);

    /// @return Minimum sum of all tranches assets required to be met to switch StructuredAssetVault to Live phase
    function minimumSize() external view returns (uint256);

    /**
     * @notice Launches the AssetVault making it possible to make disbursements.
     * @dev - reverts if tranches ratios and AssetVault min size are not met,
     *      - changes status to `Live`,
     *      - sets `startDate` and `endDate`,
     *      - transfers assets obtained in tranches to the AssetVault.
     */
    function start() external;

    /**
     * @notice Closes the AssetVault, making it possible to withdraw funds from tranche vaults.
     * @dev - reverts if there are any active outstanding assets before the end date,
     *      - changes status to `Closed`,
     *      - calculates waterfall values for tranches and transfers the funds to the vaults,
     *      - updates `endDate`.
     */
    function close() external;

    /**
     * @notice Distributes AssetVault value among tranches respecting their target apys and fees.
     *         Returns deposits for CapitalFormation and Closed AssetVault status.
     * @return Array of current tranche values
     */
    function calculateWaterfall() external view returns (uint256[] memory);

    /**
     * @notice Distributes AssetVault value among tranches respecting their target apys, but not fees.
     *         Returns deposits for CapitalFormation and Closed AssetVault status.
     * @return Array of current tranche values (with pending fees not deducted)
     */
    function calculateWaterfallWithoutFees() external view returns (uint256[] memory);

    /**
     * @param trancheIndex Index of tranche
     * @return Current value of tranche in Live status, equal to deposit for other statuses
     */
    function calculateWaterfallForTranche(uint256 trancheIndex) external view returns (uint256);

    /**
     * @param trancheIndex Index of tranche
     * @return Current value of tranche (with pending fees not deducted) in Live status, equal to deposit for other statuses
     */
    function calculateWaterfallForTrancheWithoutFee(uint256 trancheIndex) external view returns (uint256);

    /**
     * @notice Setup contract with given params
     * @dev Used by Initializable contract (can be called only once)
     * @param manager Address on which MANAGER_ROLE is granted
     * @param allowedBorrowers List of addresses on which BORROWER_ROLE should be granted, [address(0)] if all borrowers are allowed
     * @param asset Address of ERC20 token used by AssetVault
     * @param protocolConfig Address of ProtocolConfig contract
     * @param assetVaultParams Parameters to configure AssetVault
     * @param tranchesInitData Parameters to configure tranches
     * @param expectedEquityRate APY range that is expected to be reached by Equity tranche
     */
    function initialize(
        address manager,
        address[] memory allowedBorrowers,
        IERC20WithDecimals asset,
        IProtocolConfig protocolConfig,
        AssetVaultParams memory assetVaultParams,
        TrancheInitData[] memory tranchesInitData,
        ExpectedEquityRate memory expectedEquityRate
    ) external;

    /**
     * @param trancheIdx Index of tranche used for waterfall
     * @return tranche Address of tranche with given index
     */
    function tranches(uint256 trancheIdx) external view returns (ITrancheVault tranche);

    /// @return tranches Array of AssetVault's tranches addresses
    function getTranches() external view returns (ITrancheVault[] memory tranches);

    /**
     * @param trancheIdx Index of tranche used for waterfall
     * @return trancheData Struct of parameters describing tranche with given index
     */
    function getTrancheData(uint256 trancheIdx) external view returns (TrancheData memory trancheData);

    /**
     * @notice Updates checkpoints on each tranche and pay pending fees
     * @dev Can be executed only in Live and Closed status
     */
    function updateCheckpoints() external;

    function calculateDeficit(
        uint256 i,
        uint256 realTotalAssets,
        uint256 pendingFees,
        uint256 unpaidFees
    ) external view returns (uint256);

    /// @return Total value locked in the contract including yield from outstanding assets
    function totalAssets() external view returns (uint256);

    /// @return Underlying token balance of AssetVault reduced by pending fees
    function liquidAssets() external view returns (uint256);

    /// @return Sum of all unsettled fees that tranches should pay
    function totalPendingFees() external view returns (uint256);

    /// @return Asset balance of this contract
    function virtualTokenBalance() external view returns (uint256);

    /// @return Amount of assets disbursed from vault including accrued yield
    function outstandingAssets() external view returns (uint256);

    /// @return Amount of assets disbursed from vault
    function outstandingPrincipal() external view returns (uint256);

    /// @return Sum of interest repaid to contract so far
    function paidInterest() external view returns (uint256);

    /// @return Last asset report id in asset report history
    function latestAssetReportId() external view returns (string memory);

    /// @return List of asset report ids in chronological order
    function getAssetReportHistory() external view returns (string[] memory);

    /**
     * @notice Increases virtual AssetVault value
     * @dev Must be called by a tranche
     * @param delta Amount by which virtual token balance should be increased
     */
    function increaseVirtualTokenBalance(uint256 delta) external;

    /**
     * @notice Decrease virtual AssetVault value
     * @dev Must be called by a tranche
     * @param delta Amount by which virtual token balance should be decreased
     */
    function decreaseVirtualTokenBalance(uint256 delta) external;

    /// @notice Reverts if minimum subordinate ratio on any tranche is broken
    function checkTranchesRatios() external view;

    /**
     * @notice Reverts if tranche ratios are not met
     * @param newTotalAssets new total assets value of the tranche calling this function.
     * @dev Is ignored if not called by tranche
     */
    function checkTranchesRatiosFromTranche(uint256 newTotalAssets) external view;

    /**
     * @param trancheIdx Index of tranche for which max value should be calculated
     * @return maxTrancheValue Max tranche value that can be reached not to break minimum subordinate ratio of any tranche
     */
    function maxTrancheValueComplyingWithRatio(uint256 trancheIdx) external view returns (uint256 maxTrancheValue);

    /**
     * @param trancheIdx Index of tranche for which min value should be calculated
     * @return minTrancheValue Min tranche value that can be reached not to break minimum subordinate ratio of any tranche
     */
    function minTrancheValueComplyingWithRatio(uint256 trancheIdx) external view returns (uint256);

    /**
     * @notice
     * - can be called only by address with MANAGER_ROLE granted
     * - reverts in Capital Formation
     * @param newOutstandingAssets Amount of outstanding assets declared by the manager
     * @param assetReportId IPFS CID under which asset report reflecting current SAV state is stored
     */
    function updateState(uint256 newOutstandingAssets, string calldata assetReportId) external;

    /**
     * @notice
     * - can be called only by address with MANAGER_ROLE granted
     * - reverts in Capital Formation and Closed
     * - when onlyAllowedBorrower is set reverts if recipient does not have BORROWER_ROLE
     * @param recipient Address to which funds are disbursed
     * @param amount Disbursed amount
     * @param assetReportId IPFS CID under which asset report reflecting current SAV state is stored
     */
    function disburse(
        address recipient,
        uint256 amount,
        string memory assetReportId
    ) external;

    /**
     * @notice
     * - can be called only by address with MANAGER_ROLE granted
     * - reverts in Capital Formation and Closed
     * - when onlyAllowedBorrower is set reverts if recipient does not have BORROWER_ROLE
     * @param recipient Address to which funds are disbursed
     * @param amount Disbursed amount
     * @param newOutstandingAssetsAfterDisburse New outstanding assets amount declared by SAV manager
     * @param assetReportId IPFS CID under which asset report reflecting current SAV state is stored
     */
    function disburseThenUpdateState(
        address recipient,
        uint256 amount,
        uint256 newOutstandingAssetsAfterDisburse,
        string memory assetReportId
    ) external;

    /**
     * @notice
     * - can be called only by address with REPAYER_ROLE granted
     * - reverts in Capital Formation
     * @param assetReportId IPFS CID under which asset report reflecting current SAV state is stored
     * @param principalRepaid Principal part of outstanding assets declared to be repaid
     * @param interestRepaid Interest part of outstanding assets declared to be repaid
     */
    function repay(
        uint256 principalRepaid,
        uint256 interestRepaid,
        string memory assetReportId
    ) external;

    /**
     * @notice
     * - can be called only by address with REPAYER_ROLE granted
     * - reverts in Capital Formation
     * @param newOutstandingAssetsBeforeRepay New outstanding assets amount declared by SAV manager
     * @param assetReportId IPFS CID under which asset report reflecting current SAV state is stored
     * @param principalRepaid Principal part of outstanding assets declared to be repaid
     * @param interestRepaid Interest part of outstanding assets declared to be repaid
     */
    function updateStateThenRepay(
        uint256 newOutstandingAssetsBeforeRepay,
        uint256 principalRepaid,
        uint256 interestRepaid,
        string memory assetReportId
    ) external;
}
