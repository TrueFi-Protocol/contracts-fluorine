import "StructuredAssetVault_AUTO_summaries.spec"

rule statusAndNonStatusFunctionsCoverAllFunctions(method f) {
    env e;
    callFunction(f, e);

    assert f.isView ||
        isCapitalFormationOnlyFunction(f) ||
        isLiveOnlyFunction(f) ||
        isClosedOnlyFunction(f) ||
        isCapitalFormationOrLiveOnlyFunction(f) ||
        isLiveOrClosedOnlyFunction(f) ||
        isCapitalFormationOrClosedOnlyFunction(f) ||
        isCapitalFormationOrLiveOrClosedOnlyFunction(f);
}

rule capitalFormationOnlyFunctionsCanOnlyBeCalledInCapitalFormation(method f) filtered {
    f -> isCapitalFormationOnlyFunction(f)
} {
    sav.Status status_old = status();

    env e;
    callFunction(f, e);

    assert status_old == sav.Status.CapitalFormation;
}

rule liveOnlyFunctionsCanOnlyBeCalledInLive(method f) filtered {
    f -> isLiveOnlyFunction(f)
} {
    sav.Status status_old = status();

    env e;
    callFunction(f, e);

    assert status_old == sav.Status.Live;
}

rule closedOnlyFunctionsCanOnlyBeCalledInClosed(method f) filtered {
    f -> isClosedOnlyFunction(f)
} {
    sav.Status status_old = status();

    env e;
    callFunction(f, e);

    assert status_old == sav.Status.Closed;
}

rule capitalFormationOrLiveOnlyFunctionsCanOnlyBeCalledInCapitalFormationOrLive(method f) filtered {
    f -> isCapitalFormationOrLiveOnlyFunction(f)
} {
    sav.Status status_old = status();

    env e;
    callFunction(f, e);

    assert status_old == sav.Status.CapitalFormation || status_old == sav.Status.Live;
}

rule liveOrClosedOnlyFunctionsCanOnlyBeCalledInLiveOrClosed(method f) filtered {
    f -> isLiveOrClosedOnlyFunction(f)
} {
    sav.Status status_old = status();

    env e;
    callFunction(f, e);

    assert status_old == sav.Status.Live || status_old == sav.Status.Closed;
}

rule capitalFormationOrClosedOnlyFunctionsCanOnlyBeCalledInCapitalFormationOrClosed(method f) filtered {
    f -> isCapitalFormationOrClosedOnlyFunction(f)
} {
    sav.Status status_old = status();

    env e;
    callFunction(f, e);

    assert status_old == sav.Status.CapitalFormation || status_old == sav.Status.Closed;
}

rule capitalFormationOrLiveOrClosedOnlyFunctionsCanOnlyBeCalledInCapitalFormationOrLiveOrClosed(method f) filtered {
    f -> isCapitalFormationOrLiveOrClosedOnlyFunction(f)
} {
    sav.Status status_old = status();

    env e;
    callFunction(f, e);

    assert status_old == sav.Status.CapitalFormation || status_old == sav.Status.Live || status_old == sav.Status.Closed;
}
