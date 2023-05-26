import "StructuredAssetVault.spec"

methods {
    getCheckpoint() => AUTO
    totalAssets() => AUTO
    totalAssetsBeforeFees() => AUTO
    totalPendingFeesForAssets(uint256) => AUTO

    onTransfer(uint256) => AUTO
    // Unsound: tranche transfers assets to portfolio + increases virtualTokenBalance
    onPortfolioStart() => AUTO
    // Unsound: token transfer can be reentrant
    transfer(address,uint256) => AUTO
    // Unsound: token transferFrom can be reentrant
    transferFrom(address,address,uint256) => AUTO
    // Unsound: tranche decreases virtualTokenBalance when paying fees
    updateCheckpoint() => AUTO
    // Unsound: tranche decreases virtualTokenBalance when paying fees
    updateCheckpointFromPortfolio(uint256,uint256) => AUTO
}
