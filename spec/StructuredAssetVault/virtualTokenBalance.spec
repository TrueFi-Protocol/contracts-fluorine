import "StructuredAssetVaultHarness.spec"

methods {
    allowance(address,address) returns uint256 => AUTO
    calculateWaterfallForTrancheWithoutFee(uint256) returns uint256 => AUTO
    decimals() returns uint8 => AUTO
    protocolAdmin() returns address => AUTO
    protocolFeeRate() returns uint256 => AUTO
    protocolTreasury() returns address => AUTO
    status() returns savh.Status => AUTO
    totalAssets() returns uint256 => AUTO
    totalAssetsBeforeFees() returns uint256 => AUTO
    totalPendingFeesForAssets(uint256) returns uint256 => AUTO

    approve(address,uint256) => DISPATCHER(false)
    transfer(address,uint256) => DISPATCHER(false)
    transferFrom(address,address,uint256) => DISPATCHER(false)

    onPortfolioStart() => DISPATCHER(true)
    onTransfer(uint256) => DISPATCHER(true)
    setPortfolio(address) => DISPATCHER(true)
    updateCheckpoint() => DISPATCHER(true)
    updateCheckpointFromPortfolio(uint256,uint256) => DISPATCHER(true)
}

// Does not account for outside asset transfer()s or transferFrom()s,
// which can modify assetBalance without affecting virtualTokenBalance
invariant virtualTokenBalanceEqualsAssetBalance()
    virtualTokenBalance() == assetBalance()
    filtered {
        f -> !isUpgradeFunction(f) &&
        f.selector != decreaseVirtualTokenBalance(uint256).selector &&
        f.selector != increaseVirtualTokenBalance(uint256).selector
    }
