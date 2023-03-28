# StructuredAssetVaultFactory API

## StructuredAssetVaultFactory

<br />

### WHITELISTED_MANAGER_ROLE

```solidity
bytes32 WHITELISTED_MANAGER_ROLE
```

<br />

### trancheImplementation

```solidity
address trancheImplementation
```

<br />

### assetVaultImplementation

```solidity
address assetVaultImplementation
```

<br />

### protocolConfig

```solidity
contract IProtocolConfig protocolConfig
```

<br />

### constructor

```solidity
constructor(address _assetVaultImplementation, address _trancheImplementation, contract IProtocolConfig _protocolConfig) public
```

##### Arguments
| Name | Type | Description |
| ---- | ---- | ----------- |
| _assetVaultImplementation | address |  |
| _trancheImplementation | address |  |
| _protocolConfig | contract IProtocolConfig |  |

<br />

### getAssetVaults

```solidity
function getAssetVaults() external view returns (contract IStructuredAssetVault[])
```

##### Returns
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | contract IStructuredAssetVault[] | All created Asset Vaults' addresses |

<br />

### getAllowedBorrowers

```solidity
function getAllowedBorrowers(address manager) public view returns (address[])
```

##### Arguments
| Name | Type | Description |
| ---- | ---- | ----------- |
| manager | address | Address of supposed Asset Vault manager |

##### Returns
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address[] |  |

<br />

### isBorrowerAllowed

```solidity
function isBorrowerAllowed(address manager, address borrower) external view returns (bool)
```

##### Arguments
| Name | Type | Description |
| ---- | ---- | ----------- |
| manager | address | Address of supposed Asset Vault manager |
| borrower | address | Address of supposed Asset Vault borrower |

##### Returns
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | Value indicating whether given borrower is included in manager's allowed borrowers list |

<br />

### setAllowedBorrower

```solidity
function setAllowedBorrower(address manager, address borrower, bool shouldAllow) external
```

@notice
- adds or removes provided address from given manager's allowed borrowers list
- can be executed only by protocol admin
- reverts if given manager address does not have WHITELISTED_MANAGER_ROLE granted

##### Arguments
| Name | Type | Description |
| ---- | ---- | ----------- |
| manager | address | Address of supposed Asset Vault manager |
| borrower | address | Address of supposed Asset Vault borrower |
| shouldAllow | bool | Value indicating whether given borrower should be added or removed from given manager's allowed borrowers list |

<br />

### createAssetVault

```solidity
function createAssetVault(contract IERC20WithDecimals asset, struct AssetVaultParams assetVaultParams, struct TrancheData[] tranchesData, struct ExpectedEquityRate expectedEquityRate, bool onlyAllowedBorrowers) external
```

Creates a Asset Vault along with its tranche vaults

Tranche vaults are ordered from the most volatile to the most stable

##### Arguments
| Name | Type | Description |
| ---- | ---- | ----------- |
| asset | contract IERC20WithDecimals | Address of ERC20 token on which Asset Vault should operate |
| assetVaultParams | struct AssetVaultParams | Parameters used for Asset Vault deployment |
| tranchesData | struct TrancheData[] | Data used for tranche vaults deployment |
| expectedEquityRate | struct ExpectedEquityRate | APY range ({ from, to }) that is expected to be reached by tranche with index 0 |
| onlyAllowedBorrowers | bool | Value indicating whether funds in Asset Vault can be disbursed only to restricted addresses or everyone can receive |

<br />

