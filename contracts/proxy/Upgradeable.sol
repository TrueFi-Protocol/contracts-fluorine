// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {AccessControlEnumerableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import {IProtocolConfig} from "../interfaces/IProtocolConfig.sol";

abstract contract Upgradeable is AccessControlEnumerableUpgradeable, UUPSUpgradeable, PausableUpgradeable {
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    IProtocolConfig public protocolConfig;

    constructor() initializer {}

    function __Upgradeable_init(address admin, IProtocolConfig _protocolConfig) internal onlyInitializing {
        AccessControlEnumerableUpgradeable.__AccessControlEnumerable_init();
        __Pausable_init();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        protocolConfig = _protocolConfig;
    }

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    function pause() external {
        _requirePauser();
        super._pause();
    }

    function unpause() external {
        _requirePauser();
        super._unpause();
    }

    function _requirePauser() internal view {
        require(hasRole(PAUSER_ROLE, msg.sender) || msg.sender == protocolConfig.pauserAddress(), "UP: Only pauser");
    }
}
