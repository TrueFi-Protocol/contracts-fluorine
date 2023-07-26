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

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {Upgradeable} from "./proxy/Upgradeable.sol";
import {IERC20WithDecimals} from "./interfaces/IERC20WithDecimals.sol";
import {ITrancheVault, Checkpoint} from "./interfaces/ITrancheVault.sol";
import {IProtocolConfig} from "./interfaces/IProtocolConfig.sol";
import {IDepositController} from "./interfaces/IDepositController.sol";
import {IWithdrawController} from "./interfaces/IWithdrawController.sol";
import {IStructuredAssetVault, Status, TrancheData, TrancheInitData, AssetVaultParams, ExpectedEquityRate, BASIS_PRECISION, YEAR} from "./interfaces/IStructuredAssetVault.sol";

contract StructuredAssetVault is IStructuredAssetVault, Upgradeable {
    using SafeERC20 for IERC20WithDecimals;

    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE"); // 0x241ecf16d79d0f8dbfb92cbc07fe17840425976cf0667f022fe9877caa831b08
    bytes32 public constant BORROWER_ROLE = keccak256("BORROWER_ROLE"); // 0x2344277e405079ec07749d374ba0b5862a4e45a6a05ac889dbb4a991c6f9354d
    bytes32 public constant REPAYER_ROLE = keccak256("REPAYER_ROLE"); // 0x9c60024347074fd9de2c1e36003080d22dbc76a41ef87444d21e361bcb39118e

    IERC20WithDecimals public asset;

    Status public status;
    string public name;
    uint256 public endDate;
    uint256 public startDate;
    uint256 public startDeadline;
    uint256 public minimumSize;
    uint256 public assetVaultDuration;
    bool public onlyAllowedBorrowers;

    uint256 public virtualTokenBalance;
    uint256 public outstandingAssets;
    uint256 public outstandingPrincipal;
    uint256 public paidInterest;
    string[] public assetReportHistory;

    ITrancheVault[] public tranches;
    TrancheData[] public tranchesData;
    ExpectedEquityRate public expectedEquityRate;

    uint256 internal actionId;

    function initialize(
        address manager,
        address[] memory allowedBorrowers,
        IERC20WithDecimals _asset,
        IProtocolConfig _protocolConfig,
        AssetVaultParams memory assetVaultParams,
        TrancheInitData[] memory tranchesInitData,
        ExpectedEquityRate memory _expectedEquityRate
    ) public initializer {
        __Upgradeable_init(_protocolConfig.protocolAdmin(), _protocolConfig);

        require(assetVaultParams.duration > 0, "SAV: Duration cannot be zero");
        require(tranchesInitData[0].targetApy == 0, "SAV: Target APY in tranche 0");
        require(tranchesInitData[0].minSubordinateRatio == 0, "SAV: Min sub ratio in tranche 0");

        _grantRole(MANAGER_ROLE, manager);
        _grantRole(REPAYER_ROLE, manager);
        _setRoleAdmin(REPAYER_ROLE, MANAGER_ROLE);

        if (allowedBorrowers.length == 1 && allowedBorrowers[0] == address(0)) {
            onlyAllowedBorrowers = false;
        } else {
            onlyAllowedBorrowers = true;
            for (uint256 i = 0; i < allowedBorrowers.length; i++) {
                _grantRole(BORROWER_ROLE, allowedBorrowers[i]);
            }
        }

        uint256 tranchesCount = tranchesInitData.length;
        uint8 tokenDecimals = _asset.decimals();

        protocolConfig = _protocolConfig;
        asset = _asset;
        name = assetVaultParams.name;
        assetVaultDuration = assetVaultParams.duration;
        startDeadline = block.timestamp + assetVaultParams.capitalFormationPeriod;
        minimumSize = assetVaultParams.minimumSize;
        expectedEquityRate = _expectedEquityRate;

        for (uint256 i = 0; i < tranchesCount; i++) {
            TrancheInitData memory initData = tranchesInitData[i];
            require(tokenDecimals == initData.tranche.decimals(), "SAV: Decimals mismatched");

            tranches.push(initData.tranche);
            initData.tranche.setPortfolio(this);
            _asset.safeApprove(address(initData.tranche), type(uint256).max);
            tranchesData.push(TrancheData(initData.targetApy, initData.minSubordinateRatio, 0, 0));
        }

        emit AssetVaultInitialized(tranches);
    }

    // -- view functions --

    function getTranches() external view returns (ITrancheVault[] memory) {
        return tranches;
    }

    function getTrancheData(uint256 i) external view returns (TrancheData memory) {
        return tranchesData[i];
    }

    function totalAssets() external view returns (uint256) {
        return _sum(_tranchesTotalAssets());
    }

    function liquidAssets() external view returns (uint256) {
        uint256 _totalPendingFees = totalPendingFees();
        return _saturatingSub(virtualTokenBalance, _totalPendingFees);
    }

    function latestAssetReportId() external view returns (string memory) {
        if (assetReportHistory.length == 0) {
            return "";
        }
        return assetReportHistory[assetReportHistory.length - 1];
    }

    function getAssetReportHistory() external view returns (string[] memory) {
        return assetReportHistory;
    }

    function totalPendingFees() public view returns (uint256) {
        uint256 sum = 0;
        uint256 tranchesCount = tranches.length;
        uint256[] memory _totalAssets = calculateWaterfallWithoutFees();

        for (uint256 i = 0; i < tranchesCount; i++) {
            sum += tranches[i].totalPendingFeesForAssets(_totalAssets[i]);
        }

        return sum;
    }

    function _totalAssetsBeforeFees() internal view returns (uint256) {
        return virtualTokenBalance + outstandingAssets;
    }

    // -- waterfall --

    function calculateWaterfallForTranche(uint256 trancheIdx) external view returns (uint256) {
        require(trancheIdx < tranches.length, "SAV: Tranche index out of bounds");
        return calculateWaterfall()[trancheIdx];
    }

    function calculateWaterfallForTrancheWithoutFee(uint256 trancheIdx) external view returns (uint256) {
        require(trancheIdx < tranches.length, "SAV: Tranche index out of bounds");
        return calculateWaterfallWithoutFees()[trancheIdx];
    }

    function calculateWaterfall() public view returns (uint256[] memory) {
        return _calculateWaterfall(_totalAssetsBeforeFees());
    }

    function _calculateWaterfall(uint256 assetsLeft) internal view returns (uint256[] memory) {
        uint256[] memory waterfall = _calculateWaterfallWithoutFees(assetsLeft);
        for (uint256 i = 0; i < waterfall.length; i++) {
            uint256 waterfallValue = waterfall[i];
            uint256 pendingFees = tranches[i].totalPendingFeesForAssets(waterfallValue);
            waterfall[i] = _saturatingSub(waterfallValue, pendingFees);
        }
        return waterfall;
    }

    function calculateWaterfallWithoutFees() public view returns (uint256[] memory) {
        return _calculateWaterfallWithoutFees(_totalAssetsBeforeFees());
    }

    function _calculateWaterfallWithoutFees(uint256 assetsLeft) internal view returns (uint256[] memory) {
        uint256[] memory waterfall = new uint256[](tranches.length);
        if (status != Status.Live) {
            for (uint256 i = 0; i < waterfall.length; i++) {
                waterfall[i] = tranches[i].totalAssetsBeforeFees();
            }
            return waterfall;
        }

        uint256 limitedBlockTimestamp = _limitedBlockTimestamp();

        for (uint256 i = waterfall.length - 1; i > 0; i--) {
            uint256 assumedTrancheValue = _assumedTrancheValue(i, limitedBlockTimestamp);

            if (assumedTrancheValue >= assetsLeft) {
                waterfall[i] = assetsLeft;
                return waterfall;
            }

            waterfall[i] = assumedTrancheValue;
            assetsLeft -= assumedTrancheValue;
        }

        waterfall[0] = assetsLeft;

        return waterfall;
    }

    function _assumedTrancheValue(uint256 trancheIdx, uint256 timestamp) internal view returns (uint256) {
        Checkpoint memory checkpoint = tranches[trancheIdx].getCheckpoint();
        TrancheData memory trancheData = tranchesData[trancheIdx];

        uint256 timePassedSinceCheckpoint = _saturatingSub(timestamp, checkpoint.timestamp);
        return
            _withInterest(checkpoint.totalAssets + checkpoint.deficit, trancheData.targetApy, timePassedSinceCheckpoint) +
            checkpoint.unpaidFees;
    }

    function _withInterest(
        uint256 initialValue,
        uint256 targetApy,
        uint256 timePassed
    ) internal pure returns (uint256) {
        uint256 interest = (initialValue * targetApy * timePassed) / YEAR / BASIS_PRECISION;
        return initialValue + interest;
    }

    // -- tranches ratios --

    function checkTranchesRatiosFromTranche(uint256 newTotalAssets) external view {
        uint256[] memory _totalAssets = calculateWaterfall();
        for (uint256 i = 0; i < _totalAssets.length; i++) {
            if (msg.sender == address(tranches[i])) {
                _totalAssets[i] = newTotalAssets;
            }
        }
        _checkTranchesRatios(_totalAssets);
    }

    function checkTranchesRatios() external view {
        _checkTranchesRatios(_tranchesTotalAssets());
    }

    function _tranchesTotalAssets() internal view returns (uint256[] memory) {
        if (status == Status.Live) {
            return calculateWaterfall();
        }

        uint256[] memory _totalAssets = new uint256[](tranches.length);
        for (uint256 i = 0; i < _totalAssets.length; i++) {
            _totalAssets[i] = tranches[i].totalAssets();
        }
        return _totalAssets;
    }

    function _checkTranchesRatios(uint256[] memory _totalAssets) internal view {
        uint256 subordinateValue = _totalAssets[0];

        for (uint256 i = 1; i < _totalAssets.length; i++) {
            uint256 minSubordinateRatio = tranchesData[i].minSubordinateRatio;
            uint256 trancheValue = _totalAssets[i];

            bool isMinRatioRequired = minSubordinateRatio != 0;
            if (isMinRatioRequired) {
                uint256 subordinateValueInBps = subordinateValue * BASIS_PRECISION;
                uint256 lowerBound = trancheValue * minSubordinateRatio;
                bool isMinRatioSatisfied = subordinateValueInBps >= lowerBound;
                require(isMinRatioSatisfied, "SAV: Tranche min ratio not met");
            }

            subordinateValue += trancheValue;
        }
    }

    function maxTrancheValueComplyingWithRatio(uint256 trancheIdx) external view returns (uint256) {
        if (status != Status.Live || trancheIdx == 0) {
            return type(uint256).max;
        }

        uint256[] memory waterfallValues = calculateWaterfall();

        uint256 subordinateValue = 0;
        for (uint256 i = 0; i < trancheIdx; i++) {
            subordinateValue += waterfallValues[i];
        }

        uint256 minSubordinateRatio = tranchesData[trancheIdx].minSubordinateRatio;
        if (minSubordinateRatio == 0) {
            return type(uint256).max;
        }

        return (subordinateValue * BASIS_PRECISION) / minSubordinateRatio;
    }

    function minTrancheValueComplyingWithRatio(uint256 trancheIdx) external view returns (uint256) {
        if (status != Status.Live) {
            return 0;
        }

        uint256[] memory trancheValues = calculateWaterfall();
        uint256 tranchesCount = trancheValues.length;
        if (trancheIdx == tranchesCount - 1) {
            return 0;
        }

        uint256 subordinateValueWithoutTranche = 0;
        uint256 maxThreshold = 0;
        for (uint256 i = 0; i < tranchesCount - 1; i++) {
            uint256 trancheValue = trancheValues[i];
            if (i != trancheIdx) {
                subordinateValueWithoutTranche += trancheValue;
            }
            if (i >= trancheIdx) {
                uint256 lowerBound = (trancheValues[i + 1] * tranchesData[i + 1].minSubordinateRatio) / BASIS_PRECISION;
                uint256 minTrancheValue = _saturatingSub(lowerBound, subordinateValueWithoutTranche);
                maxThreshold = Math.max(minTrancheValue, maxThreshold);
            }
        }
        return maxThreshold;
    }

    // -- update checkpoints --

    function updateCheckpoints() public whenNotPaused {
        require(status != Status.CapitalFormation, "SAV: No checkpoints before start");
        uint256[] memory _totalAssetsAfter = calculateWaterfall();
        for (uint256 i = 0; i < _totalAssetsAfter.length; i++) {
            tranches[i].updateCheckpointFromPortfolio(_totalAssetsAfter[i]);
        }
    }

    function calculateDeficit(
        uint256 i,
        uint256 realTotalAssets,
        uint256 pendingFees,
        uint256 unpaidFees
    ) external view returns (uint256) {
        uint256 timestamp = _limitedBlockTimestamp();
        uint256 assumedTotalAssets = _assumedTrancheValue(i, timestamp);
        uint256 assumedTotalAssetsAfterFees = _saturatingSub(assumedTotalAssets, Math.max(pendingFees, unpaidFees));
        return _saturatingSub(assumedTotalAssetsAfterFees, realTotalAssets);
    }

    // -- vault status management --

    function start() external whenNotPaused {
        _requireManagerRole();
        require(status == Status.CapitalFormation, "SAV: Only in capital formation");
        uint256[] memory _totalAssets = _tranchesTotalAssets();
        _checkTranchesRatios(_totalAssets);
        require(_sum(_totalAssets) >= minimumSize, "SAV: Minimum size not reached");

        _changeAssetVaultStatus(Status.Live);

        startDate = block.timestamp;
        endDate = block.timestamp + assetVaultDuration;

        uint256 tranchesCount = tranches.length;
        for (uint256 i = 0; i < tranchesCount; i++) {
            tranches[i].onPortfolioStart();
        }
    }

    function close() external whenNotPaused {
        require(status != Status.Closed, "SAV: AssetVault already closed");
        bool isAfterEndDate = block.timestamp > endDate;
        require(isAfterEndDate || outstandingAssets == 0, "SAV: Outstanding assets exist");

        bool isManager = hasRole(MANAGER_ROLE, msg.sender);

        if (status == Status.Live) {
            require(isManager || isAfterEndDate, "SAV: Can't close before end date");
            _closeTranches();
        } else {
            require(isManager || block.timestamp >= startDeadline, "SAV: Only after start deadline");
        }

        _changeAssetVaultStatus(Status.Closed);
        updateCheckpoints();

        if (!isAfterEndDate) {
            endDate = block.timestamp;
        }
    }

    function _closeTranches() internal {
        updateCheckpoints();
        uint256 limitedBlockTimestamp = _limitedBlockTimestamp();
        uint256[] memory waterfall = _calculateWaterfall(virtualTokenBalance);

        for (uint256 i = 0; i < waterfall.length; i++) {
            TrancheData storage trancheData = tranchesData[i];
            if (i != 0) {
                trancheData.maxValueOnClose = _assumedTrancheValue(i, limitedBlockTimestamp);
            }
            uint256 waterfallValue = waterfall[i];
            trancheData.distributedAssets = waterfallValue;
            _transfer(tranches[i], waterfallValue);
        }
    }

    function _transfer(ITrancheVault tranche, uint256 amount) internal {
        asset.safeTransfer(address(tranche), amount);
        tranche.onTransfer(amount);
        virtualTokenBalance -= amount;
    }

    function _changeAssetVaultStatus(Status newStatus) internal {
        status = newStatus;
        emit AssetVaultStatusChanged(newStatus);
    }

    // -- outstanding assets management --

    function updateState(uint256 newOutstandingAssets, string calldata newAssetReportId) public whenNotPaused {
        _requireManagerRole();
        require(status != Status.CapitalFormation, "SAV: Not allowed before start");

        updateCheckpoints();
        outstandingAssets = newOutstandingAssets;
        _pushAssetReportId(newAssetReportId);
        updateCheckpoints();

        emit StateUpdated(actionId++, newOutstandingAssets, newAssetReportId);
    }

    function disburse(
        address recipient,
        uint256 amount,
        string calldata newAssetReportId
    ) public override whenNotPaused {
        _requireManagerRole();
        require(recipient != address(this), "SAV: Recipient cannot be SAV");
        require(recipient != address(0), "SAV: Recipient zero address");
        if (onlyAllowedBorrowers) {
            require(hasRole(BORROWER_ROLE, recipient), "SAV: Recipient not whitelisted");
        }
        require(status == Status.Live, "SAV: AssetVault is not live");
        updateCheckpoints();

        require(virtualTokenBalance >= amount, "SAV: Insufficient funds");
        outstandingPrincipal += amount;
        virtualTokenBalance -= amount;
        outstandingAssets += amount;
        _pushAssetReportId(newAssetReportId);

        asset.safeTransfer(recipient, amount);

        emit Disburse(actionId++, recipient, amount, newAssetReportId);
    }

    function disburseThenUpdateState(
        address recipient,
        uint256 amount,
        uint256 newOutstandingAssetsAfterDisburse,
        string calldata newAssetReportId
    ) external override {
        disburse(recipient, amount, newAssetReportId);
        updateState(newOutstandingAssetsAfterDisburse, newAssetReportId);
    }

    function repay(
        uint256 principalRepaid,
        uint256 interestRepaid,
        string calldata newAssetReportId
    ) public override whenNotPaused {
        address repayer = msg.sender;
        assert(repayer != address(this));
        require(hasRole(REPAYER_ROLE, repayer), "SAV: Only repayer");
        require(status != Status.CapitalFormation, "SAV: Can repay only after start");
        require(principalRepaid <= outstandingPrincipal, "SAV: Principal overpayment");
        uint256 totalRepaid = principalRepaid + interestRepaid;
        require(totalRepaid <= outstandingAssets, "SAV: Outstanding assets overpayment");

        updateCheckpoints();
        outstandingPrincipal -= principalRepaid;
        paidInterest += interestRepaid;
        outstandingAssets -= totalRepaid;
        _pushAssetReportId(newAssetReportId);

        if (status == Status.Closed) {
            _repayInClosed(totalRepaid);
        } else {
            virtualTokenBalance += totalRepaid;
            asset.safeTransferFrom(repayer, address(this), totalRepaid);
            updateCheckpoints();
        }

        emit Repay(actionId++, repayer, principalRepaid, interestRepaid, newAssetReportId);
    }

    function updateStateThenRepay(
        uint256 newOutstandingAssetsBeforeRepay,
        uint256 principalRepaid,
        uint256 interestRepaid,
        string calldata newAssetReportId
    ) external override {
        updateState(newOutstandingAssetsBeforeRepay, newAssetReportId);
        repay(principalRepaid, interestRepaid, newAssetReportId);
    }

    function _repayInClosed(uint256 undistributedAssets) internal {
        for (uint256 i = tranches.length - 1; i > 0; i--) {
            if (undistributedAssets == 0) {
                return;
            }

            TrancheData memory trancheData = tranchesData[i];
            uint256 trancheFreeCapacity = trancheData.maxValueOnClose - trancheData.distributedAssets;
            if (trancheFreeCapacity == 0) {
                continue;
            }

            uint256 trancheShare = Math.min(trancheFreeCapacity, undistributedAssets);
            undistributedAssets -= trancheShare;
            _repayToTranche(i, trancheShare);
        }

        if (undistributedAssets == 0) {
            return;
        }

        _repayToTranche(0, undistributedAssets);
    }

    function _repayToTranche(uint256 trancheIdx, uint256 amount) internal {
        ITrancheVault tranche = tranches[trancheIdx];
        tranchesData[trancheIdx].distributedAssets += amount;
        asset.safeTransferFrom(msg.sender, address(tranche), amount);
        tranche.onTransfer(amount);
        tranche.updateCheckpoint();
    }

    // -- virtual token balance management --

    function increaseVirtualTokenBalance(uint256 increment) external {
        _changeVirtualTokenBalance(SafeCast.toInt256(increment));
    }

    function decreaseVirtualTokenBalance(uint256 decrement) external {
        _changeVirtualTokenBalance(-SafeCast.toInt256(decrement));
    }

    function _changeVirtualTokenBalance(int256 delta) internal {
        uint256 tranchesCount = tranches.length;
        for (uint256 i = 0; i < tranchesCount; i++) {
            if (msg.sender == address(tranches[i])) {
                virtualTokenBalance = delta < 0 ? virtualTokenBalance - uint256(-delta) : virtualTokenBalance + uint256(delta);
                return;
            }
        }
        revert("SAV: Not a tranche");
    }

    // -- utils --

    function _saturatingSub(uint256 x, uint256 y) internal pure returns (uint256) {
        return x > y ? x - y : 0;
    }

    function _sum(uint256[] memory components) internal pure returns (uint256) {
        uint256 sum;
        for (uint256 i = 0; i < components.length; i++) {
            sum += components[i];
        }
        return sum;
    }

    function _limitedBlockTimestamp() internal view returns (uint256) {
        return Math.min(block.timestamp, endDate);
    }

    function _requireManagerRole() internal view {
        require(hasRole(MANAGER_ROLE, msg.sender), "SAV: Only manager");
    }

    function _pushAssetReportId(string calldata newAssetReportId) internal {
        uint256 assetReportHistoryLength = assetReportHistory.length;
        if (assetReportHistoryLength == 0) {
            assetReportHistory.push(newAssetReportId);
            return;
        }
        string memory lastAssetReportId = assetReportHistory[assetReportHistoryLength - 1];
        if (keccak256(bytes(lastAssetReportId)) != keccak256(bytes(newAssetReportId))) {
            assetReportHistory.push(newAssetReportId);
        }
    }
}
