import "StructuredAssetVault.spec"

methods {
    totalAssets() => AUTO
    totalAssetsBeforeFees() => AUTO
    totalPendingFeesForAssets(uint256) => AUTO
    // Unsound: AUTO => HAVOC_ECF can change virtualTokenBalance when paying fees
    updateCheckpointFromPortfolio(uint256, uint256) => AUTO
}
