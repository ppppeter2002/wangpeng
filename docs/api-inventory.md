# API 接口清单

> 生成日期：2026-09-21
> 项目路径：E:\smart-tutor\
> 端口：3000

## 文本
| 方法 | 路径 | 用途 | 配额 |
| POST | /api/chat | 文本问答 | 无（基础功能） |

## 语音（半双工）
| 方法 | 路径 | 用途 | 配额 |
| POST | /api/voice/chat | 语音聊天（ASR→文本→TTS） | voice + tts |

## 拍照
| 方法 | 路径 | 用途 | 配额 |
| POST | /api/photo/diagnose | 拍照归因诊断 | image |

## 规划
| 方法 | 路径 | 用途 | 配额 |
| POST | /api/plan/remedy | 补课规划 | 无 |
| POST | /api/plan/preview | 预习规划 | 无 |
| GET  | /api/plan/:studentId | 规划历史 | 无 |

## 计费
| 方法 | 路径 | 用途 |
| GET  | /api/billing/plans | 套餐列表 |
| POST | /api/billing/subscribe | 订阅 |
| POST | /api/billing/cancel | 取消订阅 |
| POST | /api/billing/check-feature | 功能开关检查 |
| POST | /api/billing/buy-credit | 算力包购买（占位） |

## 报告
| 方法 | 路径 | 用途 |
| POST | /api/report/generate | 生成三端报告 |
| GET  | /api/report/:studentId/:role | 查询报告 |

共 14 个接口。
