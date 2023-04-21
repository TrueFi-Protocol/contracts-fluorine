using StructuredAssetVaultHarness as savh

methods {
    assetBalance() returns uint256 envfree
    virtualTokenBalance() returns uint256 envfree
}

// DEFINITIONS

definition isUpgradeFunction(method f) returns bool =
    f.selector == upgradeTo(address).selector ||
    f.selector == upgradeToAndCall(address,bytes).selector;
