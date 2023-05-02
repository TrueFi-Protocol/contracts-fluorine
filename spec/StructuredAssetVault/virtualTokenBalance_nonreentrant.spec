import "StructuredAssetVault_AUTO_summaries.spec"

rule onlyCloseDecreaseAndDisburseDirectlyDecreaseVirtualTokenBalance(method f) filtered {
    f -> !isUpgradeFunction(f)
} {
    uint256 virtualTokenBalance_old = virtualTokenBalance();

    env e;
    callFunction(f, e);

    uint256 virtualTokenBalance_new = virtualTokenBalance();

    require virtualTokenBalance_new < virtualTokenBalance_old;

    assert
        f.selector == close().selector ||
        f.selector == decreaseVirtualTokenBalance(uint256).selector ||
        f.selector == disburse(address,uint256,uint256,string).selector;
}

rule onlyIncreaseAndRepayDirectlyIncreaseVirtualTokenBalance(method f) filtered {
    f -> !isUpgradeFunction(f)
} {
    uint256 virtualTokenBalance_old = virtualTokenBalance();

    env e;
    callFunction(f, e);

    uint256 virtualTokenBalance_new = virtualTokenBalance();

    require virtualTokenBalance_new > virtualTokenBalance_old;

    assert // start().selector relies on a tranche call to increaseVTB()
        f.selector == increaseVirtualTokenBalance(uint256).selector ||
        f.selector == repay(uint256,uint256,uint256,string).selector;
}

rule closeWhenLiveDecreasesVirtualTokenBalance() {
    require status() == sav.Status.Live;

    uint256 virtualTokenBalance_old = virtualTokenBalance();

    env e;
    close(e);

    uint256 virtualTokenBalance_new = virtualTokenBalance();

    // TODO determine whether it's possible to make this a strict inequality,
    // by hinting with the _calculateWaterfall() function
    assert virtualTokenBalance_new <= virtualTokenBalance_old;
}

rule closeWhenNotLiveDoesntChangeVirtualTokenBalance() {
    require status() != sav.Status.Live;

    uint256 virtualTokenBalance_old = virtualTokenBalance();

    env e;
    close(e);

    uint256 virtualTokenBalance_new = virtualTokenBalance();

    assert virtualTokenBalance_new == virtualTokenBalance_old;
}

rule decreaseDecreasesVirtualTokenBalance(uint256 amount) {
    uint256 virtualTokenBalance_old = virtualTokenBalance();

    env e;
    decreaseVirtualTokenBalance(e, amount);

    uint256 virtualTokenBalance_new = virtualTokenBalance();

    assert virtualTokenBalance_new == virtualTokenBalance_old - amount;
}

rule disburseDecreasesVirtualTokenBalance(uint256 amount) {
    uint256 virtualTokenBalance_old = virtualTokenBalance();

    env e;
    disburse(e, _, amount, _, _);

    uint256 virtualTokenBalance_new = virtualTokenBalance();

    assert virtualTokenBalance_new == virtualTokenBalance_old - amount;
}

rule increaseIncreasesVirtualTokenBalance(uint256 amount) {
    uint256 virtualTokenBalance_old = virtualTokenBalance();

    env e;
    increaseVirtualTokenBalance(e, amount);

    uint256 virtualTokenBalance_new = virtualTokenBalance();

    assert virtualTokenBalance_new == virtualTokenBalance_old + amount;
}

rule repayWhenClosedDoesntChangeVirtualTokenBalance() {
    require status() == sav.Status.Closed;

    uint256 virtualTokenBalance_old = virtualTokenBalance();

    env e;
    repay(e, _, _, _, _);

    uint256 virtualTokenBalance_new = virtualTokenBalance();

    assert virtualTokenBalance_new == virtualTokenBalance_old;
}

rule repayWhenNotClosedIncreasesVirtualTokenBalance(uint256 principalRepaid, uint256 interestRepaid) {
    require status() != sav.Status.Closed;

    uint256 virtualTokenBalance_old = virtualTokenBalance();

    env e;
    repay(e, principalRepaid, interestRepaid, _, _);

    uint256 virtualTokenBalance_new = virtualTokenBalance();

    assert virtualTokenBalance_new == virtualTokenBalance_old + principalRepaid + interestRepaid;
}

rule nonTrancheCantCallDecreaseVirtualTokenBalance() {
    env e;
    require forall uint256 i . e.msg.sender != tranches(i);
    decreaseVirtualTokenBalance@withrevert(e, _);

    assert lastReverted;
}

rule nonTrancheCantCallIncreaseVirtualTokenBalance() {
    env e;
    require forall uint256 i . e.msg.sender != tranches(i);
    increaseVirtualTokenBalance@withrevert(e, _);

    assert lastReverted;
}

rule decreaseVirtualTokenBalanceWontRevertWhenConditionsMet(uint256 amount, uint256 i) {
    env e;
    require e.msg.value == 0;
    require e.msg.sender == tranches(i);
    require amount <= max_uint128;
    require amount <= virtualTokenBalance();
    decreaseVirtualTokenBalance@withrevert(e, amount);

    assert !lastReverted;
}

rule increaseVirtualTokenBalanceWontRevertWhenConditionsMet(uint256 amount, uint256 i) {
    env e;
    require e.msg.value == 0;
    require e.msg.sender == tranches(i);
    require amount <= max_uint128;
    require amount + virtualTokenBalance() <= max_uint256;
    increaseVirtualTokenBalance@withrevert(e, amount);

    assert !lastReverted;
}
