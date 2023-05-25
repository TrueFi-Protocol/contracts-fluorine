import "StructuredAssetVault_AUTO_summaries.spec"

rule onlyUpdateStateDisburseOrRepayChangesOutstandingAssets(method f) filtered { f -> !isUpgradeFunction(f) } {
    uint256 outstandingAssets_old = outstandingAssets();

    env e;
    callFunction(f, e);

    uint256 outstandingAssets_new = outstandingAssets();

    require outstandingAssets_new != outstandingAssets_old;

    assert
        f.selector == disburse(address,uint256,string).selector ||
        f.selector == disburseThenUpdateState(address,uint256,uint256,string).selector ||
        f.selector == repay(uint256,uint256,string).selector ||
        f.selector == updateState(uint256,string).selector ||
        f.selector == updateStateThenRepay(uint256,uint256,uint256,string).selector;
}

rule onlyManagerIncreasesOutstandingAssets(method f) filtered { f -> !isUpgradeFunction(f) } {
    uint256 outstandingAssets_old = outstandingAssets();

    env e;
    callFunction(f, e);

    uint256 outstandingAssets_new = outstandingAssets();

    require outstandingAssets_new > outstandingAssets_old;

    assert hasRole(MANAGER_ROLE(), e.msg.sender);
}

rule onlyRepayerOrManagerDecreasesOutstandingAssets(method f) filtered { f -> !isUpgradeFunction(f) } {
    uint256 outstandingAssets_old = outstandingAssets();

    env e;
    callFunction(f, e);

    uint256 outstandingAssets_new = outstandingAssets();

    require outstandingAssets_new < outstandingAssets_old;

    assert hasRole(REPAYER_ROLE(), e.msg.sender) || hasRole(MANAGER_ROLE(), e.msg.sender);
}

rule disburseIncreasesOutstandingAssets() {
    uint256 outstandingAssets_old = outstandingAssets();

    env e;
    uint256 amount;
    disburse(e, _, amount, _);

    uint256 outstandingAssets_new = outstandingAssets();

    assert outstandingAssets_new == outstandingAssets_old + amount;
}

rule repayDecreasesOutstandingAssets() {
    uint256 outstandingAssets_old = outstandingAssets();

    env e;
    uint256 principal;
    uint256 interest;
    repay(e, principal, interest, _);

    uint256 outstandingAssets_new = outstandingAssets();

    assert outstandingAssets_new == outstandingAssets_old - principal - interest;
}

rule updateStateSetsOutstandingAssets() {
    env e;
    uint256 outstandingAssets_param;
    updateState(e, outstandingAssets_param, _);

    uint256 outstandingAssets_new = outstandingAssets();

    assert outstandingAssets_new == outstandingAssets_param;
}
