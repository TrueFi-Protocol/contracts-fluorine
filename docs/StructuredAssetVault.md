# StructuredAssetVault API

## StructuredAssetVault

<br />

### MANAGER_ROLE

```solidity
bytes32 MANAGER_ROLE
```

<br />

### BORROWER_ROLE

```solidity
bytes32 BORROWER_ROLE
```

<br />

### REPAYER_ROLE

```solidity
bytes32 REPAYER_ROLE
```

<br />

### asset

```solidity
contract IERC20WithDecimals asset
```

<br />

### status

```solidity
enum Status status
```

<br />

### name

```solidity
string name
```

<br />

### endDate

```solidity
uint256 endDate
```

Returns expected end date or actual end date if AssetVault was closed prematurely.

<br />

### startDate

```solidity
uint256 startDate
```

<br />

### startDeadline

```solidity
uint256 startDeadline
```

Timestamp after which anyone can close the AssetVault if it's in capital formation.

<br />

### minimumSize

```solidity
uint256 minimumSize
```

<br />

### assetVaultDuration

```solidity
uint256 assetVaultDuration
```

<br />

### onlyAllowedBorrowers

```solidity
bool onlyAllowedBorrowers
```

<br />

### virtualTokenBalance

```solidity
uint256 virtualTokenBalance
```

<br />

### outstandingAssets

```solidity
uint256 outstandingAssets
```

<br />

### outstandingPrincipal

```solidity
uint256 outstandingPrincipal
```

<br />

### paidInterest

```solidity
uint256 paidInterest
```

<br />

### assetReportHistory

```solidity
string[] assetReportHistory
```

<br />

### tranches

```solidity
contract ITrancheVault[] tranches
```

<br />

### tranchesData

```solidity
struct TrancheData[] tranchesData
```

<br />

### expectedEquityRate

```solidity
struct ExpectedEquityRate expectedEquityRate
```

<br />

### initialize

```solidity
function initialize(address manager, address[] allowedBorrowers, contract IERC20WithDecimals _asset, contract IProtocolConfig _protocolConfig, struct AssetVaultParams assetVaultParams, struct TrancheInitData[] tranchesInitData, struct ExpectedEquityRate _expectedEquityRate) external
```

##### Arguments
| Name | Type | Description |
| ---- | ---- | ----------- |
| manager | address |  |
| allowedBorrowers | address[] |  |
| _asset | contract IERC20WithDecimals |  |
| _protocolConfig | contract IProtocolConfig |  |
| assetVaultParams | struct AssetVaultParams |  |
| tranchesInitData | struct TrancheInitData[] |  |
| _expectedEquityRate | struct ExpectedEquityRate |  |

<br />

### getTranches

```solidity
function getTranches() external view returns (contract ITrancheVault[])
```

##### Returns
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | contract ITrancheVault[] |  |

<br />

### getTrancheData

```solidity
function getTrancheData(uint256 i) external view returns (struct TrancheData)
```

##### Arguments
| Name | Type | Description |
| ---- | ---- | ----------- |
| i | uint256 |  |

##### Returns
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | struct TrancheData |  |

<br />

### totalAssets

```solidity
function totalAssets() external view returns (uint256)
```

##### Returns
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | Total value locked in the contract including yield from outstanding assets |

<br />

### liquidAssets

```solidity
function liquidAssets() external view returns (uint256)
```

##### Returns
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | Underlying token balance of AssetVault reduced by pending fees |

<br />

### latestAssetReportId

```solidity
function latestAssetReportId() external view returns (string)
```

##### Returns
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | string | Last asset report id in asset report history |

<br />

### getAssetReportHistory

```solidity
function getAssetReportHistory() external view returns (string[])
```

##### Returns
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | string[] | List of asset report ids in chronological order |

<br />

### totalPendingFees

```solidity
function totalPendingFees() public view returns (uint256)
```

##### Returns
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | Sum of all unsettled fees that tranches should pay |

<br />

### calculateWaterfallForTranche

```solidity
function calculateWaterfallForTranche(uint256 trancheIdx) external view returns (uint256)
```

##### Arguments
| Name | Type | Description |
| ---- | ---- | ----------- |
| trancheIdx | uint256 |  |

##### Returns
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |

<br />

### calculateWaterfallForTrancheWithoutFee

```solidity
function calculateWaterfallForTrancheWithoutFee(uint256 trancheIdx) external view returns (uint256)
```

##### Arguments
| Name | Type | Description |
| ---- | ---- | ----------- |
| trancheIdx | uint256 |  |

##### Returns
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |

<br />

### calculateWaterfall

```solidity
function calculateWaterfall() public view returns (uint256[])
```

Distributes AssetVault value among tranches respecting their target apys and fees.
Returns zeros for CapitalFormation and Closed AssetVault status.

##### Returns
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256[] | Array of current tranche values |

<br />

### calculateWaterfallWithoutFees

```solidity
function calculateWaterfallWithoutFees() public view returns (uint256[])
```

Distributes AssetVault value among tranches respecting their target apys, but not fees.
Returns zeros for CapitalFormation and Closed AssetVault status.

##### Returns
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256[] | Array of current tranche values (with pending fees not deducted) |

<br />

### checkTranchesRatiosFromTranche

```solidity
function checkTranchesRatiosFromTranche(uint256 newTotalAssets) external view
```

Reverts if tranche ratios are not met

##### Arguments
| Name | Type | Description |
| ---- | ---- | ----------- |
| newTotalAssets | uint256 | new total assets value of the tranche calling this function. Is ignored if not called by tranche |

<br />

### checkTranchesRatios

```solidity
function checkTranchesRatios() external view
```

Reverts if minimum subordinate ratio on any tranche is broken

<br />

### maxTrancheValueComplyingWithRatio

```solidity
function maxTrancheValueComplyingWithRatio(uint256 trancheIdx) external view returns (uint256)
```

##### Arguments
| Name | Type | Description |
| ---- | ---- | ----------- |
| trancheIdx | uint256 | Index of tranche for which max value should be calculated |

##### Returns
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 |  |

<br />

### minTrancheValueComplyingWithRatio

```solidity
function minTrancheValueComplyingWithRatio(uint256 trancheIdx) external view returns (uint256)
```

##### Arguments
| Name | Type | Description |
| ---- | ---- | ----------- |
| trancheIdx | uint256 | Index of tranche for which min value should be calculated |

##### Returns
| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | minTrancheValue Min tranche value that can be reached not to break minimum subordinate ratio of any tranche |

<br />

### updateCheckpoints

```solidity
function updateCheckpoints() public
```

Updates checkpoints on each tranche and pay pending fees

Can be executed only in Live status

<br />

### start

```solidity
function start() external
```

Launches the AssetVault making it possible to make disbursements.
@dev
- reverts if tranches ratios and AssetVault min size are not met,
- changes status to `Live`,
- sets `startDate` and `endDate`,
- transfers assets obtained in tranches to the AssetVault.

<br />

### close

```solidity
function close() external
```

Closes the AssetVault, making it possible to withdraw funds from tranche vaults.
@dev
- reverts if there are any active outstanding assets before the end date,
- changes status to `Closed`,
- calculates waterfall values for tranches and transfers the funds to the vaults,
- updates `endDate`.

<br />

### updateState

```solidity
function updateState(uint256 newOutstandingAssets, string newAssetReportId) external
```

##### Arguments
| Name | Type | Description |
| ---- | ---- | ----------- |
| newOutstandingAssets | uint256 |  |
| newAssetReportId | string |  |

<br />

### disburse

```solidity
function disburse(address recipient, uint256 amount, uint256 newOutstandingAssets, string newAssetReportId) external
```

##### Arguments
| Name | Type | Description |
| ---- | ---- | ----------- |
| recipient | address |  |
| amount | uint256 |  |
| newOutstandingAssets | uint256 |  |
| newAssetReportId | string |  |

<br />

### repay

```solidity
function repay(uint256 principalRepaid, uint256 interestRepaid, uint256 newOutstandingAssets, string newAssetReportId) external
```

##### Arguments
| Name | Type | Description |
| ---- | ---- | ----------- |
| principalRepaid | uint256 |  |
| interestRepaid | uint256 |  |
| newOutstandingAssets | uint256 |  |
| newAssetReportId | string |  |

<br />

### increaseVirtualTokenBalance

```solidity
function increaseVirtualTokenBalance(uint256 increment) external
```

##### Arguments
| Name | Type | Description |
| ---- | ---- | ----------- |
| increment | uint256 |  |

<br />

### decreaseVirtualTokenBalance

```solidity
function decreaseVirtualTokenBalance(uint256 decrement) external
```

##### Arguments
| Name | Type | Description |
| ---- | ---- | ----------- |
| decrement | uint256 |  |

<br />

