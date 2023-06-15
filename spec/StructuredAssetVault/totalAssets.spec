import "StructuredAssetVaultHarness.spec"

methods {
    allowance(address,address) returns uint256 => AUTO
    calculateWaterfallForTrancheWithoutFee(uint256) returns uint256 => AUTO
    decimals() returns uint8 => AUTO
    protocolAdmin() returns address => AUTO
    protocolFeeRate() returns uint256 => AUTO
    protocolTreasury() returns address => AUTO
    status() returns savh.Status => AUTO

    approve(address,uint256) => DISPATCHER(false)
    transfer(address,uint256) => DISPATCHER(false)
    transferFrom(address,address,uint256) => DISPATCHER(false)

    onPortfolioStart() => DISPATCHER(false)
    onTransfer(uint256) => DISPATCHER(false)
    setPortfolio(address) => DISPATCHER(false)
    totalAssets() returns uint256 => DISPATCHER(false)
    totalAssetsBeforeFees() returns uint256 => DISPATCHER(false)
    totalPendingFeesForAssets(uint256) => DISPATCHER(false)
    updateCheckpoint() => DISPATCHER(false)
    updateCheckpointFromPortfolio(uint256,uint256) => DISPATCHER(false)
}

rule totalAssetsIsConstantWhenNoFeesAndFunctionIsntDecreaseVTBIncreaseVTBOrUpdateState(method f) filtered {
    f -> !isUpgradeFunction(f) &&
    f.selector != decreaseVirtualTokenBalance(uint256).selector &&
    f.selector != disburseThenUpdateState(address,uint256,uint256,string).selector &&
    f.selector != increaseVirtualTokenBalance(uint256).selector &&
    f.selector != updateState(uint256,string).selector &&
    f.selector != updateStateThenRepay(uint256,uint256,uint256,string).selector
} {
    // Assume unitranche
    require forall uint256 i . tranches(i) == tvw;
    require tranchesLength() == 1;

    uint256 timestamp;

    env e1;
    require e1.block.timestamp == timestamp;
    require totalPendingFees(e1) == 0;

    env e2;
    require e2.block.timestamp == timestamp;
    uint256 totalAssets_old = totalAssets(e2);

    env e3;
    require e3.block.timestamp == timestamp;
    calldataarg args;
    f(e3, args);

    env e4;
    require e4.block.timestamp == timestamp;
    uint256 totalAssets_new = totalAssets(e4);

    assert totalAssets_new == totalAssets_old;
}
