# 数据库表结构

> ORM：Prisma + SQLite
> 数据库文件：E:\smart-tutor\prisma\dev.db

## 模型清单

### Plan（套餐）
| 字段 | 类型 | 说明 |
| code | String | 主键，如 basic/standard/pro/teacher_plus/school |
| name | String | 显示名 |
| price | Int | 月价（分） |
| imageEnabled | Boolean | 拍照 |
| voiceEnabled | Boolean | 语音 |
| ttsEnabled | Boolean | TTS |
| photoPerDay | Int | 每日拍照上限 |
| voiceMinPerDay | Int | 每日语音上限（分钟） |
| ttsCharPerDay | Int | 每日 TTS 上限（字符） |

### Subscription（订阅）
| 字段 | 类型 | 说明 |
| userId | String | 用户 ID |
| planCode | String | 关联 Plan.code |
| status | String | active/cancelled |
| startDate | DateTime | 开始 |
| endDate | DateTime | 结束 |

### UsageQuota（日配额）
| 字段 | 类型 | 说明 |
| userId | String | 用户 ID |
| photoUsedToday | Int | 今日已用拍照 |
| voiceUsedToday | Int | 今日已用语音（分钟） |
| ttsCharUsedToday | Int | 今日已用 TTS（字符） |
| quotaDate | DateTime | 配额日期（非今日则重置） |

### CreditPack（算力包）
| 字段 | 类型 | 说明 |
| userId | String | 用户 ID |
| amount | Int | 总额（分） |
| used | Int | 已用（分） |
| purchasedAt | DateTime | 购买时间 |

### DiagnosisSession（诊断会话）
| 字段 | 类型 | 说明 |
| id | String | cuid |
| studentId | String | 学生 ID |
| weakPoints | String | JSON |
| createdAt | DateTime | 创建时间 |

### PlanSession（规划会话）
| 字段 | 类型 | 说明 |
| id | String | cuid |
| studentId | String | 学生 ID |
| type | String | remedy/preview |
| content | String | JSON 规划步骤 |
| createdAt | DateTime | 创建时间 |

### Report（报告）
| 字段 | 类型 | 说明 |
| id | String | cuid |
| studentId | String | 学生 ID |
| diagnosisId | String? | 关联诊断 |
| planId | String? | 关联规划 |
| role | String | student/parent/teacher |
| title | String | 报告标题 |
| content | String | JSON 报告内容 |
| createdAt | DateTime | 创建时间 |

共 8 张表。
