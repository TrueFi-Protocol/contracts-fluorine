using StructuredAssetVault as sav

methods {
    getRoleAdmin(bytes32) returns bytes32 envfree
    hasRole(bytes32, address) returns bool envfree

    DEFAULT_ADMIN_ROLE() returns bytes32 envfree

    sav.MANAGER_ROLE() returns bytes32 envfree
    sav.PAUSER_ROLE() returns bytes32 envfree
    sav.tranches(uint256) returns address envfree

    pauserAddress() returns address => protocolPauserGhost()
}

rule nonManagersCannotCallNonViewFunctionsWhenPaused(method f) filtered {
  f -> !f.isFallback 
    && !f.isView
    && !isProxyFunction(f)
    && !isHarnessFunction(f)
    && f.selector != renounceRole(bytes32,address).selector
} {
    address sender;
    bytes32 role;
    requireInvariant onlyDefaultAdminIsRoleAdmin(role);
    env _e1;
    require paused(_e1);

    env e;
    require e.msg.sender == sender;
    require tranchesCountGhost <= 3;
    require sender != sav.tranches(0);
    require sender != sav.tranches(1);
    require sender != sav.tranches(2);
    require !hasRole(DEFAULT_ADMIN_ROLE(), e.msg.sender);
    require !hasRole(sav.MANAGER_ROLE(), e.msg.sender);
    require !hasRole(sav.PAUSER_ROLE(), e.msg.sender);
    require sender != protocolPauserGhost();
    callFunctionWithRevert(f, e, role);

    assert lastReverted;
}

rule pausedContractCanAlwaysBeUnpaused() {
    env _e;
    require paused(_e);

    env e;
    require hasRole(PAUSER_ROLE(), e.msg.sender);
    require e.msg.value == 0;
    unpause@withrevert(e);

    assert !lastReverted;
}

invariant onlyDefaultAdminIsRoleAdmin(bytes32 role)
    getRoleAdmin(role) == DEFAULT_ADMIN_ROLE()
    filtered { f -> !isProxyFunction(f) && !isManuallyChecked(f) && !f.isFallback }

definition isManuallyChecked(method f) returns bool = 
    f.selector == close().selector ||
    f.selector == disburse(address,uint256,uint256,string).selector ||
    f.selector == repay(uint256,uint256,uint256,string).selector ||
    f.selector == updateState(uint256,string).selector;

function callFunctionWithRevert(method f, env e, bytes32 role_optional) {
    if (f.selector == grantRole(bytes32,address).selector) {
        address target;
        grantRole@withrevert(e, role_optional, target);
    } else if (f.selector == revokeRole(bytes32,address).selector) {
        address target;
        revokeRole@withrevert(e, role_optional, target);
    } else {
        calldataarg args;
        f@withrevert(e, args);
    }
}

definition isProxyFunction(method f) returns bool =
    f.selector == upgradeTo(address).selector ||
    f.selector == upgradeToAndCall(address,bytes).selector ||
    f.selector == sav.initialize(address,address[],address,address,(string,uint256,uint256,uint256),(address,uint128,uint128)[],(uint256,uint256)).selector;

definition isHarnessFunction(method f) returns bool = false;

ghost protocolPauserGhost() returns address;
ghost uint256 tranchesCountGhost;

// Introduces an assumption that tranches.length == tranchesData.length
hook Sload uint256 value sav.tranches.(offset 0) STORAGE {
    require value == tranchesCountGhost;
}
hook Sload uint256 value sav.tranchesData.(offset 0) STORAGE {
    require value == tranchesCountGhost;
}
