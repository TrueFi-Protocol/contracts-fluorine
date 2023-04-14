import "StructuredAssetVault_AUTO_summaries.spec"

rule roleAndNonRoleFunctionsCoverAllFunctions(method f) {
    env e;
    callFunction(f, e);

    assert f.isView ||
        isUpgradeFunction(f) ||
        isInitialize(f) ||
        isRoleAdminOnlyFunction(f) ||
        isManagerOnlyFunction(f) ||
        isRepayerOnlyFunction(f) ||
        isRenounceRole(f) ||
        isNonRoleRequiredFunction(f);
}

rule upgradeFunctionsCanOnlyBeCalledByDefaultAdmin(method f) filtered { f -> isUpgradeFunction(f) } {
    env e;
    bool msgSenderHadDefaultAdminRole = hasRole(DEFAULT_ADMIN_ROLE(), e.msg.sender);
    callFunction(f, e);

    assert msgSenderHadDefaultAdminRole;
}

invariant allRoleAdminsAreDefaultAdminOrManager(bytes32 role)
    roleAdminIsDefaultAdminOrManager(role)
    filtered { f -> !isUpgradeFunction(f) }

rule roleAdminOnlyFunctionsCanOnlyBeCalledByRoleAdmin(method f) filtered { f -> isRoleAdminOnlyFunction(f) } {
    require forall bytes32 role . roleAdminIsDefaultAdminOrManager(role);

    env e;
    bool msgSenderHadRoleAdminRole = hasRole(DEFAULT_ADMIN_ROLE(), e.msg.sender) || hasRole(MANAGER_ROLE(), e.msg.sender);
    callFunction(f, e);

    assert msgSenderHadRoleAdminRole;
}

rule managerOnlyFunctionsCanOnlyBeCalledByManager(method f) filtered { f -> isManagerOnlyFunction(f) } {
    env e;
    bool msgSenderHadManagerRole = hasRole(MANAGER_ROLE(), e.msg.sender);
    callFunction(f, e);

    assert msgSenderHadManagerRole;
}

rule repayerOnlyFunctionsCanOnlyBeCalledByRepayer(method f) filtered { f -> isRepayerOnlyFunction(f) } {
    env e;
    bool msgSenderHadRepayerRole = hasRole(REPAYER_ROLE(), e.msg.sender);
    callFunction(f, e);

    assert msgSenderHadRepayerRole;
}

rule renounceRoleCanOnlyBeCalledByUserWithRole(bytes32 role) {
    env e;
    bool msgSenderHadRole = hasRole(role, e.msg.sender);
    renounceRole(e, role, _);

    assert msgSenderHadRole;
}

rule onlyInitializeOrNonRoleFunctionsCanBeCalledByUsersWithoutAnyRole(method f) filtered {
    f -> !f.isView && !isUpgradeFunction(f)
} {
    env e;
    require forall bytes32 role . roleAdminIsDefaultAdminOrManager(role) && !hasRole(role, e.msg.sender);
    callFunction(f, e);

    assert isInitialize(f) || isNonRoleRequiredFunction(f);
}
