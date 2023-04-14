import "StructuredAssetVault.spec"

methods {
    totalAssets() => AUTO
    totalAssetsBeforeFees() => AUTO
    totalPendingFeesForAssets(uint256) => AUTO
    // Unsound: AUTO => HAVOC_ECF can change virtualTokenBalance when paying fees
    updateCheckpointFromPortfolio(uint256, uint256) => AUTO
}

rule nothingElseTransitionsToCapitalFormation(method f) filtered { f -> !isUpgradeFunction(f) } {
    sav.Status status_old = status();

    env e;
    callFunction(f, e);

    sav.Status status_new = status();

    require status_new == sav.Status.CapitalFormation;

    assert status_old == sav.Status.CapitalFormation;
}

rule startTransitionsFromCapitalFormation {
    sav.Status status_old = status();

    env e;
    start(e);

    assert status_old == sav.Status.CapitalFormation;
}

rule startTransitionsToLive {
    env e;
    start(e);

    sav.Status status_new = status();

    assert status_new == sav.Status.Live;
}

rule onlyStartTransitionsToLive(method f) filtered { f -> !isUpgradeFunction(f) } {
    sav.Status status_old = status();

    env e;
    callFunction(f, e);

    sav.Status status_new = status();

    require status_new != status_old && status_new == sav.Status.Live;

    assert f.selector == start().selector;
}

rule closeTransitionsFromCapitalFormationOrLive {
    sav.Status status_old = status();

    env e;
    close(e);

    assert status_old == sav.Status.CapitalFormation || status_old == sav.Status.Live;
}

rule closeTransitionsToClosed {
    env e;
    close(e);

    sav.Status status_new = status();

    assert status_new == sav.Status.Closed;
}

rule onlyCloseTransitionsToClosed(method f) filtered { f -> !isUpgradeFunction(f) } {
    sav.Status status_old = status();

    env e;
    callFunction(f, e);

    sav.Status status_new = status();

    require status_new != status_old && status_new == sav.Status.Closed;

    assert f.selector == close().selector;
}

rule nothingElseTransitionsFromClosed(method f) filtered { f -> !isUpgradeFunction(f) } {
    sav.Status status_old = status();

    env e;
    callFunction(f, e);

    sav.Status status_new = status();

    require status_old == sav.Status.Closed;

    assert status_new == sav.Status.Closed;
}

rule onlyStartOrCloseTransitionStatus(method f) filtered { f -> !isUpgradeFunction(f) } {
    sav.Status status_old = status();

    env e;
    callFunction(f, e);

    sav.Status status_new = status();

    require status_new != status_old;

    assert f.selector == start().selector || f.selector == close().selector;
}
