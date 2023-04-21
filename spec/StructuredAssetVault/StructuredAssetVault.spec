import "../Shared.spec"

using MockToken as token
using StructuredAssetVault as sav

methods {
    getRoleAdmin(bytes32) returns bytes32 envfree
    hasRole(bytes32, address) returns bool envfree
    paused() returns bool envfree
    status() returns sav.Status envfree
    tranches(uint256) returns address envfree
    virtualTokenBalance() returns uint256 envfree

    BORROWER_ROLE() returns bytes32 envfree
    DEFAULT_ADMIN_ROLE() returns bytes32 envfree
    MANAGER_ROLE() returns bytes32 envfree
    PAUSER_ROLE() returns bytes32 envfree
    REPAYER_ROLE() returns bytes32 envfree
}

// RULES

// FUNCTIONS

function callFunction(method f, env e) {
    calldataarg args;
    f(e, args);
}

// DEFINITIONS

// - role definitions

definition roleAdminIsDefaultAdminOrManager(bytes32 role) returns bool =
    getRoleAdmin(role) == DEFAULT_ADMIN_ROLE() || getRoleAdmin(role) == MANAGER_ROLE();

definition isUpgradeFunction(method f) returns bool =
    f.selector == upgradeTo(address).selector ||
    f.selector == upgradeToAndCall(address,bytes).selector;

definition isInitialize(method f) returns bool =
    f.selector == initialize(address,address[],address,address,(string,uint256,uint256,uint256),(address,uint128,uint128)[],(uint256,uint256)).selector;

definition isRoleAdminOnlyFunction(method f) returns bool =
    f.selector == grantRole(bytes32,address).selector ||
    f.selector == revokeRole(bytes32,address).selector;

definition isManagerOnlyFunction(method f) returns bool =
    f.selector == disburse(address,uint256,uint256,string).selector ||
    f.selector == start().selector ||
    f.selector == updateState(uint256,string).selector;

definition isRepayerOnlyFunction(method f) returns bool =
    f.selector == repay(uint256,uint256,uint256,string).selector;

definition isRenounceRole(method f) returns bool =
    f.selector == renounceRole(bytes32,address).selector;

definition isNonRoleRequiredFunction(method f) returns bool =
    f.selector == close().selector ||
    f.selector == decreaseVirtualTokenBalance(uint256).selector ||
    f.selector == increaseVirtualTokenBalance(uint256).selector ||
    f.selector == pause().selector ||
    f.selector == unpause().selector ||
    f.selector == updateCheckpoints().selector;

// - status definitions

definition isCapitalFormationOnlyFunction(method f) returns bool =
    f.selector == start().selector;

definition isLiveOnlyFunction(method f) returns bool =
    f.selector == disburse(address,uint256,uint256,string).selector;

definition isClosedOnlyFunction(method f) returns bool =
    false;

definition isCapitalFormationOrLiveOnlyFunction(method f) returns bool =
    f.selector == close().selector;

definition isLiveOrClosedOnlyFunction(method f) returns bool =
    f.selector == repay(uint256,uint256,uint256,string).selector ||
    f.selector == updateCheckpoints().selector ||
    f.selector == updateState(uint256,string).selector;

definition isCapitalFormationOrClosedOnlyFunction(method f) returns bool =
    false;

definition isCapitalFormationOrLiveOrClosedOnlyFunction(method f) returns bool =
    f.selector == decreaseVirtualTokenBalance(uint256).selector ||
    f.selector == grantRole(bytes32,address).selector ||
    f.selector == increaseVirtualTokenBalance(uint256).selector ||
    f.selector == initialize(address,address[],address,address,(string,uint256,uint256,uint256),(address,uint128,uint128)[],(uint256,uint256)).selector ||
    f.selector == pause().selector ||
    f.selector == renounceRole(bytes32,address).selector ||
    f.selector == revokeRole(bytes32,address).selector ||
    f.selector == unpause().selector ||
    f.selector == upgradeTo(address).selector ||
    f.selector == upgradeToAndCall(address,bytes).selector;

// GHOSTS
