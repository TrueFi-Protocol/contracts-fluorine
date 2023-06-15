using StructuredAssetVaultHarness as savh
using TrancheVaultWrapper as tvw

methods {
    assetBalance() returns uint256 envfree
    tranches(uint256) returns address envfree
    tranchesLength() returns uint256 envfree
    virtualTokenBalance() returns uint256 envfree
}

// DEFINITIONS

definition isUpgradeFunction(method f) returns bool =
    f.selector == upgradeTo(address).selector ||
    f.selector == upgradeToAndCall(address,bytes).selector;
