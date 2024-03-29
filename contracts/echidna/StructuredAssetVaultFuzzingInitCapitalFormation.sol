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

import {IERC20WithDecimals} from "../interfaces/IERC20WithDecimals.sol";
import {ITrancheVault} from "../interfaces/ITrancheVault.sol";
import {IProtocolConfig} from "../interfaces/IProtocolConfig.sol";
import {ILenderVerifier} from "../interfaces/ILenderVerifier.sol";
import {IDepositController} from "../interfaces/IDepositController.sol";
import {IWithdrawController} from "../interfaces/IWithdrawController.sol";
import {ITransferController} from "../interfaces/ITransferController.sol";
import {IStructuredAssetVault, BASIS_PRECISION, YEAR, AssetVaultParams, TrancheInitData, ExpectedEquityRate} from "../interfaces/IStructuredAssetVault.sol";

import {TrancheVaultTest2} from "../test/TrancheVaultTest2.sol";
import {ProtocolConfigTest} from "contracts-carbon/contracts/test/ProtocolConfigTest.sol";
import {AllowAllLenderVerifier} from "contracts-carbon/contracts/lenderVerifiers/AllowAllLenderVerifier.sol";
import {DepositController} from "contracts-carbon/contracts/controllers/DepositController.sol";
import {WithdrawController} from "contracts-carbon/contracts/controllers/WithdrawController.sol";
import {TransferEnabledController} from "contracts-carbon/contracts/controllers/TransferEnabledController.sol";
import {StructuredAssetVault, Status} from "../StructuredAssetVault.sol";
import {StructuredAssetVaultTest2} from "../test/StructuredAssetVaultTest2.sol";
import {AddLoanParams} from "contracts-carbon/contracts/LoansManager.sol";
import {MockToken} from "contracts-carbon/contracts/mocks/MockToken.sol";

import {FuzzingBorrower} from "./FuzzingBorrower.sol";
import {FuzzingManager} from "./FuzzingManager.sol";

import {PropertiesAsserts} from "@crytic/properties/contracts/util/PropertiesHelper.sol";
import "@crytic/properties/contracts/util/Hevm.sol";

uint256 constant DAY = 1 days;
uint8 constant DECIMALS = 6;
uint256 constant MAX_TOKENS = 10e9 * 10**DECIMALS; // a billion tokens

contract StructuredAssetVaultFuzzingInitCapitalFormation is PropertiesAsserts {
    MockToken public token;
    FuzzingBorrower public borrower;
    FuzzingManager public manager;

    IProtocolConfig public protocolConfig;
    ILenderVerifier public lenderVerifier;
    ITrancheVault public equityTranche;
    ITrancheVault public juniorTranche;
    ITrancheVault public seniorTranche;
    StructuredAssetVaultTest2 public structuredAssetVault;

    ExpectedEquityRate public expectedEquityRate;
    uint256 internal constant FEE_RATE = (BASIS_PRECISION * 5) / 1000;

    uint256 internal constant ADDRESS_COUNT = 10;
    address[] public addresses;

    constructor() {
        _initializeToken();
        _initializeAddresses();
        _initializeManager();
        _initializeProtocolConfig();
        _initializeLenderVerifier();
        equityTranche = _initializeTranche(
            "Equity Tranche",
            "EQT",
            0,
            10**9 * 10**token.decimals() /* ceiling */
        );
        juniorTranche = _initializeTranche(
            "Junior Tranche",
            "JNT",
            1,
            10**9 * 10**token.decimals() /* ceiling */
        );
        seniorTranche = _initializeTranche(
            "Senior Tranche",
            "SNT",
            2,
            10**9 * 10**token.decimals() /* ceiling */
        );
        _initializeAssetVault();

        _initializeBorrower();

        _fillTranches();
        _repayerApproveVault();
    }

    function _initializeToken() internal {
        token = new MockToken(DECIMALS);
        token.mint(address(this), 1e6 * 10**token.decimals());
    }

    function _initializeAddresses() internal {
        for (uint256 i = 0; i < ADDRESS_COUNT; i++) {
            address newAddress = address(uint160(i + 1));
            token.mint(newAddress, 1e10 * 10**token.decimals());
            addresses.push(newAddress);
        }
    }

    function _initializeManager() internal {
        manager = new FuzzingManager();
        token.mint(address(manager), 1e6 * 10**token.decimals());
    }

    function _initializeProtocolConfig() internal {
        protocolConfig = IProtocolConfig(
            address(
                new ProtocolConfigTest(
                    FEE_RATE, /* _defaultProtocolFeeRate */
                    address(manager), /* _protocolAdmin */
                    address(manager), /* _protocolTreasury */
                    address(manager) /* _pauserAddress */
                )
            )
        );
    }

    function _initializeLenderVerifier() internal {
        lenderVerifier = ILenderVerifier(address(new AllowAllLenderVerifier()));
    }

    function _initializeTranche(
        string memory name,
        string memory symbol,
        uint256 waterfallIndex,
        uint256 ceiling
    ) internal returns (ITrancheVault) {
        DepositController depositController = new DepositController();
        depositController.initialize(
            address(manager), /* manager */
            address(lenderVerifier),
            FEE_RATE, /* _depositFeeRate */
            ceiling
        );
        manager.setDepositAllowed(IDepositController(address(depositController)), true, Status.Live);
        WithdrawController withdrawController = new WithdrawController();
        withdrawController.initialize(
            address(manager), /* manager */
            FEE_RATE, /* _withdrawFeeRate */
            10**token.decimals() /* _floor */
        );
        manager.setWithdrawAllowed(IWithdrawController(address(withdrawController)), true, Status.Live);
        TransferEnabledController transferController = new TransferEnabledController();

        ITrancheVault tranche = ITrancheVault(
            address(
                new TrancheVaultTest2(
                    name,
                    symbol,
                    address(token),
                    depositController,
                    withdrawController,
                    transferController,
                    address(protocolConfig),
                    waterfallIndex,
                    address(manager), /* manager */
                    FEE_RATE /* _managerFeeRate */
                )
            )
        );

        return tranche;
    }

    function _initializeAssetVault() internal {
        AssetVaultParams memory assetVaultParams = AssetVaultParams(
            "AssetVault",
            2 * YEAR, /* duration */
            90 * DAY, /* capitalFormationPeriod */
            0 /* minimumSize */
        );

        TrancheInitData[] memory tranchesInitData = new TrancheInitData[](3);
        tranchesInitData[0] = TrancheInitData(
            ITrancheVault(address(equityTranche)),
            0, /* targetApy */
            0 /* minSubordinateRatio */
        );
        tranchesInitData[1] = TrancheInitData(
            ITrancheVault(address(juniorTranche)),
            uint128((BASIS_PRECISION * 5) / 100), /* targetApy */
            uint128(BASIS_PRECISION / 2) /* minSubordinateRatio */
        );
        tranchesInitData[2] = TrancheInitData(
            ITrancheVault(address(seniorTranche)),
            uint128((BASIS_PRECISION * 3) / 100), /* targetApy */
            uint128((BASIS_PRECISION * 2) / 3) /* minSubordinateRatio */
        );

        address[] memory allowedBorrowers = new address[](1);
        allowedBorrowers[0] = address(borrower);

        expectedEquityRate = ExpectedEquityRate((BASIS_PRECISION * 7) / 100, (BASIS_PRECISION * 20) / 100);

        structuredAssetVault = new StructuredAssetVaultTest2(
            address(manager), /* manager */
            allowedBorrowers,
            IERC20WithDecimals(address(token)),
            IProtocolConfig(address(protocolConfig)),
            assetVaultParams,
            tranchesInitData,
            expectedEquityRate
        );
    }

    function _initializeBorrower() internal {
        borrower = new FuzzingBorrower();
        token.mint(address(borrower), 1e10 * 10**token.decimals());
    }

    function _depositAs(
        ITrancheVault tranche,
        address lender,
        uint256 amount
    ) internal {
        hevm.prank(lender);
        token.approve(address(tranche), amount);
        hevm.prank(lender);
        tranche.deposit(amount, lender);
    }

    function _withdrawAs(
        ITrancheVault tranche,
        address lender,
        uint256 amount
    ) internal {
        hevm.prank(lender);
        tranche.withdraw(amount, lender, lender);
    }

    function _fillTranches() internal {
        _depositAs(equityTranche, addresses[0], 2e6 * 10**token.decimals());
        _depositAs(juniorTranche, addresses[1], 3e6 * 10**token.decimals());
        _depositAs(seniorTranche, addresses[2], 5e6 * 10**token.decimals());
    }

    function _repayerApproveVault() internal {
        manager.approve(token, address(structuredAssetVault), 1e15 * 10**token.decimals());
    }

    function _getNumberOfTranches() internal view returns (uint256) {
        return structuredAssetVault.getTranches().length;
    }

    function _minSubordinateRatioSatisfied() internal returns (bool) {
        uint256 subordinateValue = equityTranche.totalAssets();
        emit LogUint256("subordinate value", subordinateValue);

        for (uint256 i = 1; i < _getNumberOfTranches(); i++) {
            ITrancheVault tranche = structuredAssetVault.tranches(i);

            uint256 trancheValue = tranche.totalAssets();
            emit LogUint256("tranche value", trancheValue);

            (, uint128 minSubordinateRatio, , ) = structuredAssetVault.tranchesData(i);

            if (subordinateValue * BASIS_PRECISION < trancheValue * minSubordinateRatio) {
                emit LogString("min subordinate ratio not satisfied");
                emit LogUint256("subordinate value * BASIS_PRECISION", subordinateValue * BASIS_PRECISION);
                emit LogUint256("trancheValue * minSubordinateRatio", trancheValue * minSubordinateRatio);
                return false;
            }
            subordinateValue += trancheValue;
            emit LogUint256("subordinate value", subordinateValue);
        }
        emit LogString("min subordinate ratio satisfied");
        return true;
    }

    /// @notice asserts that a is equal to b. Violations are logged using reason.
    function assertClose(
        uint256 a,
        uint256 b,
        string memory reason,
        uint256 tolerance
    ) internal {
        if (a + tolerance < b || b + tolerance < a) {
            assertEq(a, b, reason);
        }
    }
}
