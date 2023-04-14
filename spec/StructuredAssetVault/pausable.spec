import "StructuredAssetVault_AUTO_summaries.spec"

methods {
    pauserAddress() returns address => protocolPauserGhost()
}

ghost protocolPauserGhost() returns address;

rule nonTrancheOrPauserCannotCallNonViewFunctionsWhenPaused(method f) filtered {
    f -> !f.isView && !isUpgradeFunction(f) && !isInitialize(f) && !isRoleAdminOnlyFunction(f) && !isRenounceRole(f)
} {
    require paused();

    env e;
    require forall uint256 trancheIdx . e.msg.sender != tranches(trancheIdx);
    require !hasRole(PAUSER_ROLE(), e.msg.sender);
    require e.msg.sender != protocolPauserGhost();
    calldataarg args;
    f@withrevert(e, args);

    assert lastReverted;
}

rule pausedContractCanAlwaysBeUnpausedByPauserRole() {
    require paused();

    env e;
    require hasRole(PAUSER_ROLE(), e.msg.sender);
    require e.msg.value == 0;
    unpause@withrevert(e);

    assert !lastReverted;
}

rule pausedContractCanAlwaysBeUnpausedByProtocolConfigPauser() {
    require paused();

    env e;
    require e.msg.sender == protocolPauserGhost();
    require e.msg.value == 0;
    unpause@withrevert(e);

    assert !lastReverted;
}
