# interfaces/IStructuredAssetVaultFactory API

## TrancheData

<br />

```solidity
struct TrancheData {
  string name;
  string symbol;
  address depositControllerImplementation;
  bytes depositControllerInitData;
  address withdrawControllerImplementation;
  bytes withdrawControllerInitData;
  address transferControllerImplementation;
  bytes transferControllerInitData;
  uint128 targetApy;
  uint128 minSubordinateRatio;
  uint256 managerFeeRate;
}
```
## IStructuredAssetVaultFactory

Only whitelisted users can create asset vaults

<br />

### AssetVaultCreated

```solidity
event AssetVaultCreated(contract IStructuredAssetVault newAssetVault, address manager, contract ITrancheVault[] tranches)
```

Event fired on asset vault creation

##### Arguments
| Name | Type | Description |
| ---- | ---- | ----------- |
| newAssetVault | contract IStructuredAssetVault | Address of the newly created asset vault |
| manager | address | Address of the asset vault manager |
| tranches | contract ITrancheVault[] | List of adresses of tranche vaults deployed to store assets |

<br />

### AllowedBorrowersChanged

```solidity
event AllowedBorrowersChanged(address manager, address[] allowedBorrowers)
```

Event fired when list of allowed borrowers for specific manager is changed

##### Arguments
| Name | Type | Description |
| ---- | ---- | ----------- |
| manager | address | Manager address |
| allowedBorrowers | address[] | List of allowed borrowers associated with the manager |

<br />

### WHITELISTED_MANAGER_ROLE

```solidity
function WHITELISTED_MANAGER_ROLE() external view returns (bytes32)
```

##### Returns
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bytes32 | Whitelisted manager role used for access control, allowing a user with this role to create StructuredAssetVault |

<br />

### trancheImplementation

```solidity
function trancheImplementation() external view returns (address)
```

##### Returns
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | Address of the Tranche contract implementation used for asset vault deployment |

<br />

### assetVaultImplementation

```solidity
function assetVaultImplementation() external view returns (address)
```

##### Returns
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | Address of the StructuredAssetVault contract implementation used for asset vault deployment |

<br />

### protocolConfig

```solidity
function protocolConfig() external view returns (contract IProtocolConfig)
```

##### Returns
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | contract IProtocolConfig | Address of the ProtocolConfig |

<br />

### getAllowedBorrowers

```solidity
function getAllowedBorrowers(address manager) external view returns (address[] allowedBorrowers)
```

##### Arguments
| Name | Type | Description |
| ---- | ---- | ----------- |
| manager | address | Address of supposed Asset Vault manager |

##### Returns
| Name | Type | Description |
| ---- | ---- | ----------- |
| allowedBorrowers | address[] | List of addresses to which BORROWER_ROLE should be granted if given manager creates Asset Vault with onlyAllowedBorrowers flag set |

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

### getAssetVaults

```solidity
function getAssetVaults() external view returns (contract IStructuredAssetVault[])
```

##### Returns
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | contract IStructuredAssetVault[] | All created Asset Vaults' addresses |

<br />

