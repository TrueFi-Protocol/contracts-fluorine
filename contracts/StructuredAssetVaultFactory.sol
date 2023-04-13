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

import {AccessControlEnumerable} from "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {IStructuredAssetVaultFactory, TrancheData, ITrancheVault, IERC20WithDecimals, IStructuredAssetVault, IProtocolConfig, AssetVaultParams, ExpectedEquityRate, TrancheInitData} from "./interfaces/IStructuredAssetVaultFactory.sol";
import {ProxyWrapper} from "./proxy/ProxyWrapper.sol";

contract StructuredAssetVaultFactory is IStructuredAssetVaultFactory, AccessControlEnumerable {
    using Address for address;
    using EnumerableSet for EnumerableSet.AddressSet;

    bytes32 public constant WHITELISTED_MANAGER_ROLE = keccak256("WHITELISTED_MANAGER_ROLE"); // 0x0f1a06f478c6d93b4de7d3729d5b62d1767a80e47459ec53d09d36e3042f5253

    address public immutable trancheImplementation;
    address public immutable assetVaultImplementation;
    IProtocolConfig public immutable protocolConfig;

    mapping(address => EnumerableSet.AddressSet) internal allowedBorrowers;
    IStructuredAssetVault[] internal assetVaults;

    constructor(
        address _assetVaultImplementation,
        address _trancheImplementation,
        IProtocolConfig _protocolConfig
    ) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        assetVaultImplementation = _assetVaultImplementation;
        trancheImplementation = _trancheImplementation;
        protocolConfig = _protocolConfig;
    }

    function getAssetVaults() external view returns (IStructuredAssetVault[] memory) {
        return assetVaults;
    }

    function getAllowedBorrowers(address manager) public view returns (address[] memory) {
        return allowedBorrowers[manager].values();
    }

    function isBorrowerAllowed(address manager, address borrower) external view returns (bool) {
        return allowedBorrowers[manager].contains(borrower);
    }

    function setAllowedBorrower(
        address manager,
        address borrower,
        bool shouldAllow
    ) external {
        require(msg.sender == protocolConfig.protocolAdmin(), "SAVF: Only protocol admin");
        require(hasRole(WHITELISTED_MANAGER_ROLE, manager), "SAVF: Manager not whitelisted");

        EnumerableSet.AddressSet storage _allowedBorrowers = allowedBorrowers[manager];

        if (shouldAllow) {
            _allowedBorrowers.add(borrower);
        } else {
            _allowedBorrowers.remove(borrower);
        }

        emit AllowedBorrowersChanged(manager, _allowedBorrowers.values());
    }

    function createAssetVault(
        IERC20WithDecimals asset,
        AssetVaultParams calldata assetVaultParams,
        TrancheData[] calldata tranchesData,
        ExpectedEquityRate calldata expectedEquityRate,
        bool onlyAllowedBorrowers
    ) external {
        address manager = msg.sender;
        require(hasRole(WHITELISTED_MANAGER_ROLE, manager), "SAVF: Only whitelisted manager");

        (TrancheInitData[] memory tranchesInitData, ITrancheVault[] memory tranches) = _deployTranches(asset, tranchesData);

        IStructuredAssetVault newAssetVault = IStructuredAssetVault(
            address(
                new ProxyWrapper(
                    assetVaultImplementation,
                    abi.encodeWithSelector(
                        IStructuredAssetVault.initialize.selector,
                        manager,
                        onlyAllowedBorrowers ? allowedBorrowers[manager].values() : _everyoneAllowed(),
                        asset,
                        protocolConfig,
                        assetVaultParams,
                        tranchesInitData,
                        expectedEquityRate
                    )
                )
            )
        );
        assetVaults.push(newAssetVault);

        emit AssetVaultCreated(newAssetVault, manager, tranches);
    }

    function _everyoneAllowed() internal pure returns (address[] memory) {
        address[] memory everyoneAllowed = new address[](1);
        everyoneAllowed[0] = address(0);
        return everyoneAllowed;
    }

    function _deployTranches(IERC20WithDecimals asset, TrancheData[] calldata tranchesData)
        internal
        returns (TrancheInitData[] memory trancheInitData, ITrancheVault[] memory tranches)
    {
        uint256 tranchesCount = tranchesData.length;
        trancheInitData = new TrancheInitData[](tranchesCount);
        tranches = new ITrancheVault[](tranchesCount);

        for (uint256 i = 0; i < tranchesCount; i++) {
            TrancheData memory trancheData = tranchesData[i];

            address depositController = Clones.clone(trancheData.depositControllerImplementation);
            depositController.functionCall(trancheData.depositControllerInitData);

            address withdrawController = Clones.clone(trancheData.withdrawControllerImplementation);
            withdrawController.functionCall(trancheData.withdrawControllerInitData);

            address transferController = Clones.clone(trancheData.transferControllerImplementation);
            transferController.functionCall(trancheData.transferControllerInitData);

            ITrancheVault tranche = ITrancheVault(
                address(
                    new ProxyWrapper(
                        trancheImplementation,
                        abi.encodeWithSelector(
                            ITrancheVault.initialize.selector,
                            trancheData.name,
                            trancheData.symbol,
                            asset,
                            depositController,
                            withdrawController,
                            transferController,
                            protocolConfig,
                            i,
                            msg.sender,
                            trancheData.managerFeeRate
                        )
                    )
                )
            );

            trancheInitData[i] = TrancheInitData(tranche, trancheData.targetApy, trancheData.minSubordinateRatio);

            tranches[i] = tranche;
        }
    }
}
