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
import {TransferController} from "contracts-carbon/contracts/controllers/TransferController.sol";
import {StructuredAssetVault, Status} from "../StructuredAssetVault.sol";
import {StructuredAssetVaultTest2} from "../test/StructuredAssetVaultTest2.sol";
import {AddLoanParams} from "contracts-carbon/contracts/LoansManager.sol";
import {MockToken} from "contracts-carbon/contracts/mocks/MockToken.sol";

import {FuzzingLender} from "./FuzzingLender.sol";
import {FuzzingManager} from "./FuzzingManager.sol";

uint256 constant DAY = 1 days;

contract StructuredAssetVaultFuzzingInit {
    MockToken public token;
    FuzzingLender public lender;
    FuzzingManager public manager;

    IProtocolConfig public protocolConfig;
    ILenderVerifier public lenderVerifier;
    ITrancheVault public equityTranche;
    ITrancheVault public juniorTranche;
    ITrancheVault public seniorTranche;
    IStructuredAssetVault public structuredAssetVault;

    uint256 internal constant FEE_RATE = (BASIS_PRECISION * 5) / 1000;

    constructor() {
        _initializeToken();
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

        _initializeLender();

        _fillTranches();
        _startAssetVault();
        _disburseInitialTokens();
    }

    function _initializeToken() internal {
        token = new MockToken(
            6 /* decimals */
        );
        token.mint(address(this), 1e6 * 10**token.decimals());
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
        TransferController transferController = new TransferController();

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
            0 /* minSubordinateRatio */
        );
        tranchesInitData[2] = TrancheInitData(
            ITrancheVault(address(seniorTranche)),
            uint128((BASIS_PRECISION * 3) / 100), /* targetApy */
            0 /* minSubordinateRatio */
        );

        structuredAssetVault = new StructuredAssetVaultTest2(
            address(manager), /* manager */
            new address[](1), /* allowedBorrowers */
            IERC20WithDecimals(address(token)),
            IProtocolConfig(address(protocolConfig)),
            assetVaultParams,
            tranchesInitData,
            ExpectedEquityRate((BASIS_PRECISION * 2) / 100, (BASIS_PRECISION * 20) / 100)
        );
    }

    function _initializeLender() internal {
        lender = new FuzzingLender();
        token.mint(address(lender), 1e10 * 10**token.decimals());
    }

    function _fillTranches() internal {
        lender.deposit(ITrancheVault(address(equityTranche)), 2e6 * 10**token.decimals());
        lender.deposit(ITrancheVault(address(juniorTranche)), 3e6 * 10**token.decimals());
        lender.deposit(ITrancheVault(address(seniorTranche)), 5e6 * 10**token.decimals());
    }

    function _startAssetVault() internal {
        manager.start(structuredAssetVault);
    }

    function _disburseInitialTokens() internal {
        // TODO
    }
}
