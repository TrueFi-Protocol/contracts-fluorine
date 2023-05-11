import "StructuredAssetVault_AUTO_summaries.spec"

rule vaultCantBeClosedFromCapitalFormationBeforeStartDeadlineByNonManager() {
    require status() == sav.Status.CapitalFormation;
    
    uint256 timestamp;
    require timestamp < startDeadline();

    env e;
    require !hasRole(MANAGER_ROLE(), e.msg.sender);
    require e.block.timestamp == timestamp;
    close@withrevert(e);

    assert lastReverted;
}

rule vaultCanAlwaysBeClosedInCapitalFormationByManager() {
    require status() == sav.Status.CapitalFormation;
    require !paused();
    // in capitalFormation outstandingAssets can't grow
    require outstandingAssets() == 0;

    uint256 timestamp;

    storage initialState = lastStorage; 

    // asserts that call won't revert due to updateCheckpoints()
    env e1;
    updateCheckpoints(e1);
    require e1.block.timestamp == timestamp;

    env e;
    require hasRole(MANAGER_ROLE(), e.msg.sender);
    require e.msg.value == 0;
    require e.block.timestamp == timestamp;
    close@withrevert(e) at initialState;

    assert !lastReverted;
}

rule vaultCanAlwaysBeClosedIfNotStartedBeforeStartDeadline() {
    require status() == sav.Status.CapitalFormation;
    require !paused();
    // in capitalFormation outstandingAssets can't grow
    require outstandingAssets() == 0;

    uint256 timestamp;
    require timestamp >= startDeadline();

    storage initialState = lastStorage; 

    // asserts that call won't revert due to updateCheckpoints()
    env e1;
    require e1.block.timestamp == timestamp;
    updateCheckpoints(e1);

    env e;
    require hasRole(MANAGER_ROLE(), e.msg.sender);
    require e.msg.value == 0;
    require e.block.timestamp == timestamp;
    close@withrevert(e) at initialState;

    assert !lastReverted;
}

rule vaultCanAlwaysBeClosedAfterEndDateInCapitalFormation() {
    require status() == sav.Status.CapitalFormation;
    require !paused();
    require endDate() >= startDeadline();
    
    uint256 timestamp;
    require timestamp > endDate();

    storage initialState = lastStorage; 

    // asserts that call won't revert due to updateCheckpoints()
    env e1;
    require e1.block.timestamp == timestamp;
    updateCheckpoints(e1);

    env e;
    require e.msg.value == 0;
    require e.block.timestamp == timestamp;
    close@withrevert(e) at initialState;

    assert !lastReverted;
}
