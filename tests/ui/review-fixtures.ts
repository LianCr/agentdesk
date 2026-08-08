import type { ReviewDetailView, ReviewSummaryView } from "../../components/reviews/types";

// Review UI fixtures, generated once from the real M4 engine plus the M5-A/B
// routing, checklist and snapshot code, so the mocked browser tests exercise
// the true payload shape. Regenerate by running the engine, never by editing
// values here.
//
// `archivedSnapshot` deliberately contains a value the current products cannot
// produce: if the review page ever recomputed a comparison instead of
// rendering what was stored, that string would disappear.

export const reviewFixtures = {
  "caseCPending": {
    "reviewId": "rev_fixture_case_c",
    "sourceType": "comparison_draft",
    "snapshot": {
      "schemaVersion": 1,
      "comparisonId": "cmp_fixture",
      "productA": {
        "documentId": "doc_securerate5_v1",
        "documentName": "Demo SecureRate 5 Fixed Annuity Guide",
        "productName": "Demo SecureRate 5",
        "productCategory": "fixed_annuity"
      },
      "productB": {
        "documentId": "doc_indexflex_ul_v1",
        "documentName": "Demo IndexFlex UL Product Guide",
        "productName": "Demo IndexFlex UL",
        "productCategory": "indexed_universal_life"
      },
      "clientContext": {
        "caseId": "DEMO-2026-003",
        "displayName": "Demo Client C",
        "language": "zh",
        "age": 67,
        "dependents": "unknown",
        "primaryGoal": "higher_fixed_rate_for_savings",
        "budgetMonthly": "unknown",
        "coverageHorizon": "unknown",
        "existingCoverageNote": "fixed annuity purchased in 2021; surrender period through 2028",
        "riskTolerance": "unknown",
        "tobaccoUse": "unknown",
        "desiredCoverageAmount": "unknown",
        "replacementContext": true,
        "clientQuestions": [
          "现在的年金利率太低，想换一个利率高一点的，可以吗？"
        ]
      },
      "dimensions": [
        {
          "dimensionId": "product_type",
          "labelZh": "产品类型",
          "labelEn": "Product type",
          "core": true,
          "cells": [
            {
              "dimensionId": "product_type",
              "productId": "doc_securerate5_v1",
              "availability": "available",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "Single-Premium Deferred Fixed Annuity",
              "rawValue": "Single-Premium Deferred Fixed Annuity",
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_023",
                  "documentId": "doc_securerate5_v1",
                  "documentName": "Demo SecureRate 5 Fixed Annuity Guide",
                  "productName": "Demo SecureRate 5",
                  "chunkId": "doc_securerate5_v1:c001",
                  "pageStart": 2,
                  "pageEnd": 2,
                  "section": "Overview, Issue Ages and Premium Limits",
                  "quote": "Single-Premium Deferred Fixed Annuity",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  2
                ],
                "evidenceQuoteCount": 1
              }
            },
            {
              "dimensionId": "product_type",
              "productId": "doc_indexflex_ul_v1",
              "availability": "available",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "Flexible-Premium Indexed Universal Life",
              "rawValue": "Flexible-Premium Indexed Universal Life",
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_001",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c001",
                  "pageStart": 2,
                  "pageEnd": 2,
                  "section": "Overview and Death Benefit Options",
                  "quote": "Flexible-Premium Indexed Universal Life",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  2
                ],
                "evidenceQuoteCount": 1
              }
            }
          ]
        },
        {
          "dimensionId": "eligibility",
          "labelZh": "投保年龄",
          "labelEn": "Issue ages",
          "core": false,
          "cells": [
            {
              "dimensionId": "eligibility",
              "productId": "doc_securerate5_v1",
              "availability": "available",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "18–85",
              "rawValue": {
                "min": 18,
                "max": 85,
                "display": "18–85"
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_024",
                  "documentId": "doc_securerate5_v1",
                  "documentName": "Demo SecureRate 5 Fixed Annuity Guide",
                  "productName": "Demo SecureRate 5",
                  "chunkId": "doc_securerate5_v1:c001",
                  "pageStart": 2,
                  "pageEnd": 2,
                  "section": "Overview, Issue Ages and Premium Limits",
                  "quote": "18–85",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  2
                ],
                "evidenceQuoteCount": 1
              }
            },
            {
              "dimensionId": "eligibility",
              "productId": "doc_indexflex_ul_v1",
              "availability": "available",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "0–75",
              "rawValue": {
                "min": 0,
                "max": 75,
                "display": "0–75"
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_002",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c003",
                  "pageStart": 3,
                  "pageEnd": 3,
                  "section": "Eligibility, Premium Flexibility and Five-Year No-Lapse Guarantee",
                  "quote": "0–75",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  3
                ],
                "evidenceQuoteCount": 1
              }
            }
          ]
        },
        {
          "dimensionId": "contract_size",
          "labelZh": "保额 / 合同金额",
          "labelEn": "Coverage amount / contract size",
          "core": false,
          "cells": [
            {
              "dimensionId": "contract_size",
              "productId": "doc_securerate5_v1",
              "availability": "available",
              "format": "currency",
              "sourceKind": "direct",
              "displayValue": "最低保费 Minimum premium: $10,000 · 最高保费 Maximum premium: $1,000,000 without prior home-office approval",
              "rawValue": {
                "minimumPremium": {
                  "amount": 10000,
                  "display": "$10,000"
                },
                "maximumPremium": {
                  "amount": 1000000,
                  "display": "$1,000,000 without prior home-office approval"
                }
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_025",
                  "documentId": "doc_securerate5_v1",
                  "documentName": "Demo SecureRate 5 Fixed Annuity Guide",
                  "productName": "Demo SecureRate 5",
                  "chunkId": "doc_securerate5_v1:c001",
                  "pageStart": 2,
                  "pageEnd": 2,
                  "section": "Overview, Issue Ages and Premium Limits",
                  "quote": "$10,000",
                  "claimIds": []
                },
                {
                  "citationId": "cit_026",
                  "documentId": "doc_securerate5_v1",
                  "documentName": "Demo SecureRate 5 Fixed Annuity Guide",
                  "productName": "Demo SecureRate 5",
                  "chunkId": "doc_securerate5_v1:c001",
                  "pageStart": 2,
                  "pageEnd": 2,
                  "section": "Overview, Issue Ages and Premium Limits",
                  "quote": "$1,000,000 without prior home-office approval",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  2
                ],
                "evidenceQuoteCount": 2
              }
            },
            {
              "dimensionId": "contract_size",
              "productId": "doc_indexflex_ul_v1",
              "availability": "available",
              "format": "currency",
              "sourceKind": "direct",
              "displayValue": "最低身故保额 Minimum face amount: $100,000",
              "rawValue": {
                "amount": 100000,
                "display": "$100,000"
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_003",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c001",
                  "pageStart": 2,
                  "pageEnd": 2,
                  "section": "Overview and Death Benefit Options",
                  "quote": "$100,000",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  2
                ],
                "evidenceQuoteCount": 1
              }
            }
          ]
        },
        {
          "dimensionId": "coverage_duration",
          "labelZh": "保障期限",
          "labelEn": "Coverage duration",
          "core": true,
          "cells": [
            {
              "dimensionId": "coverage_duration",
              "productId": "doc_securerate5_v1",
              "availability": "not_applicable",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "不适用 Not applicable",
              "rawValue": null,
              "derivation": null,
              "citations": [],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 0,
                "anchorPages": [],
                "evidenceQuoteCount": 0
              }
            },
            {
              "dimensionId": "coverage_duration",
              "productId": "doc_indexflex_ul_v1",
              "availability": "available",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "无失效保证 No-lapse guarantee: Five-Year No-Lapse Guarantee if the required minimum monthly premium is paid.",
              "rawValue": {
                "years": 5,
                "display": "Five-Year No-Lapse Guarantee if the required minimum monthly premium is paid."
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_004",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c004",
                  "pageStart": 3,
                  "pageEnd": 3,
                  "section": "Eligibility, Premium Flexibility and Five-Year No-Lapse Guarantee > Five-Year No-Lapse Guarantee",
                  "quote": "Five-Year No-Lapse Guarantee if the required minimum monthly premium is paid.",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  3
                ],
                "evidenceQuoteCount": 1
              }
            }
          ]
        },
        {
          "dimensionId": "premium_structure",
          "labelZh": "保费 / 缴费结构",
          "labelEn": "Premium / contribution structure",
          "core": true,
          "cells": [
            {
              "dimensionId": "premium_structure",
              "productId": "doc_securerate5_v1",
              "availability": "available",
              "format": "currency",
              "sourceKind": "direct",
              "displayValue": "最低保费 Minimum premium: $10,000 · 最高保费 Maximum premium: $1,000,000 without prior home-office approval",
              "rawValue": {
                "minimumPremium": {
                  "amount": 10000,
                  "display": "$10,000"
                },
                "maximumPremium": {
                  "amount": 1000000,
                  "display": "$1,000,000 without prior home-office approval"
                }
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_025",
                  "documentId": "doc_securerate5_v1",
                  "documentName": "Demo SecureRate 5 Fixed Annuity Guide",
                  "productName": "Demo SecureRate 5",
                  "chunkId": "doc_securerate5_v1:c001",
                  "pageStart": 2,
                  "pageEnd": 2,
                  "section": "Overview, Issue Ages and Premium Limits",
                  "quote": "$10,000",
                  "claimIds": []
                },
                {
                  "citationId": "cit_026",
                  "documentId": "doc_securerate5_v1",
                  "documentName": "Demo SecureRate 5 Fixed Annuity Guide",
                  "productName": "Demo SecureRate 5",
                  "chunkId": "doc_securerate5_v1:c001",
                  "pageStart": 2,
                  "pageEnd": 2,
                  "section": "Overview, Issue Ages and Premium Limits",
                  "quote": "$1,000,000 without prior home-office approval",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  2
                ],
                "evidenceQuoteCount": 2
              }
            },
            {
              "dimensionId": "premium_structure",
              "productId": "doc_indexflex_ul_v1",
              "availability": "available",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "Flexible, subject to policy minimums and tax-law maximums.",
              "rawValue": {
                "display": "Flexible, subject to policy minimums and tax-law maximums."
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_005",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c003",
                  "pageStart": 3,
                  "pageEnd": 3,
                  "section": "Eligibility, Premium Flexibility and Five-Year No-Lapse Guarantee",
                  "quote": "Flexible, subject to policy minimums and tax-law maximums.",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  3
                ],
                "evidenceQuoteCount": 1
              }
            }
          ]
        },
        {
          "dimensionId": "cash_value",
          "labelZh": "现金价值 / 账户价值",
          "labelEn": "Cash value / account value",
          "core": true,
          "cells": [
            {
              "dimensionId": "cash_value",
              "productId": "doc_securerate5_v1",
              "availability": "not_applicable",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "不适用 Not applicable",
              "rawValue": null,
              "derivation": null,
              "citations": [],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 0,
                "anchorPages": [],
                "evidenceQuoteCount": 0
              }
            },
            {
              "dimensionId": "cash_value",
              "productId": "doc_indexflex_ul_v1",
              "availability": "available",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "指数账户 Indexed account: Annual point-to-point method linked to the Index, excluding dividends. · 提取 Withdrawals: Minimum partial withdrawal $500; withdrawals reduce death benefit and cash value.",
              "rawValue": {
                "indexedAccount": {
                  "display": "Annual point-to-point method linked to the Index, excluding dividends."
                },
                "withdrawals": {
                  "display": "Minimum partial withdrawal $500; withdrawals reduce death benefit and cash value."
                }
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_006",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c007",
                  "pageStart": 5,
                  "pageEnd": 5,
                  "section": "Indexed Account Mechanics",
                  "quote": "Annual point-to-point method linked to the Index, excluding dividends.",
                  "claimIds": []
                },
                {
                  "citationId": "cit_007",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c011",
                  "pageStart": 6,
                  "pageEnd": 6,
                  "section": "Surrender Charge Schedule, Loans and Withdrawals > Withdrawals",
                  "quote": "Minimum partial withdrawal $500; withdrawals reduce death benefit and cash value.",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  5,
                  6
                ],
                "evidenceQuoteCount": 2
              }
            }
          ]
        },
        {
          "dimensionId": "guaranteed_elements",
          "labelZh": "保证要素",
          "labelEn": "Guaranteed elements",
          "core": true,
          "cells": [
            {
              "dimensionId": "guaranteed_elements",
              "productId": "doc_securerate5_v1",
              "availability": "available",
              "format": "percent",
              "sourceKind": "direct",
              "displayValue": "初始利率保证 Initial rate guarantee: guaranteed for the first five contract years · 保证最低利率 Guaranteed minimum rate: 1.00%",
              "rawValue": {
                "initialRate.guaranteeYears": 5,
                "guaranteedMinimumRate.rate": 0.01
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_027",
                  "documentId": "doc_securerate5_v1",
                  "documentName": "Demo SecureRate 5 Fixed Annuity Guide",
                  "productName": "Demo SecureRate 5",
                  "chunkId": "doc_securerate5_v1:c002",
                  "pageStart": 3,
                  "pageEnd": 3,
                  "section": "Interest Rates",
                  "quote": "guaranteed for the first five contract years",
                  "claimIds": []
                },
                {
                  "citationId": "cit_028",
                  "documentId": "doc_securerate5_v1",
                  "documentName": "Demo SecureRate 5 Fixed Annuity Guide",
                  "productName": "Demo SecureRate 5",
                  "chunkId": "doc_securerate5_v1:c002",
                  "pageStart": 3,
                  "pageEnd": 3,
                  "section": "Interest Rates",
                  "quote": "1.00%",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  3
                ],
                "evidenceQuoteCount": 2
              }
            },
            {
              "dimensionId": "guaranteed_elements",
              "productId": "doc_indexflex_ul_v1",
              "availability": "available",
              "format": "percent",
              "sourceKind": "direct",
              "displayValue": "指数账户保证下限 Indexed account floor: 0.00% · 保证最低 cap Guaranteed minimum cap: 3.00% · 保证最低参与率 Guaranteed minimum participation rate: 50% · 固定账户保证最低利率 Fixed account guaranteed minimum rate: 2.00%",
              "rawValue": {
                "floor.rate": 0,
                "cap.guaranteedMinimumRate": 0.03,
                "participation.guaranteedMinimumRate": 0.5,
                "fixedAccount.guaranteedMinimumRate": 0.02
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_008",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c007",
                  "pageStart": 5,
                  "pageEnd": 5,
                  "section": "Indexed Account Mechanics",
                  "quote": "0.00%",
                  "claimIds": []
                },
                {
                  "citationId": "cit_009",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c007",
                  "pageStart": 5,
                  "pageEnd": 5,
                  "section": "Indexed Account Mechanics",
                  "quote": "3.00%",
                  "claimIds": []
                },
                {
                  "citationId": "cit_010",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c007",
                  "pageStart": 5,
                  "pageEnd": 5,
                  "section": "Indexed Account Mechanics",
                  "quote": "50%",
                  "claimIds": []
                },
                {
                  "citationId": "cit_011",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c005",
                  "pageStart": 4,
                  "pageEnd": 4,
                  "section": "Fixed Account and Charges > Fixed Account",
                  "quote": "2.00%",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  4,
                  5
                ],
                "evidenceQuoteCount": 4
              }
            }
          ]
        },
        {
          "dimensionId": "non_guaranteed_elements",
          "labelZh": "非保证要素",
          "labelEn": "Non-guaranteed elements",
          "core": true,
          "cells": [
            {
              "dimensionId": "non_guaranteed_elements",
              "productId": "doc_securerate5_v1",
              "availability": "available",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "续期利率 Renewal rates: Declared annually after year five.",
              "rawValue": {
                "display": "Declared annually after year five."
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_029",
                  "documentId": "doc_securerate5_v1",
                  "documentName": "Demo SecureRate 5 Fixed Annuity Guide",
                  "productName": "Demo SecureRate 5",
                  "chunkId": "doc_securerate5_v1:c002",
                  "pageStart": 3,
                  "pageEnd": 3,
                  "section": "Interest Rates",
                  "quote": "Declared annually after year five.",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  3
                ],
                "evidenceQuoteCount": 1
              }
            },
            {
              "dimensionId": "non_guaranteed_elements",
              "productId": "doc_indexflex_ul_v1",
              "availability": "available",
              "format": "percent",
              "sourceKind": "direct",
              "displayValue": "当前 cap Current cap: 9.50% · 当前参与率 Current participation rate: 100% · 费率变更 Rate changes: Current caps and participation rates are declared by the carrier and may change for future segments.",
              "rawValue": {
                "cap.currentRate": 0.095,
                "participation.currentRate": 1,
                "rateChanges": {
                  "display": "Current caps and participation rates are declared by the carrier and may change for future segments."
                }
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_012",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c007",
                  "pageStart": 5,
                  "pageEnd": 5,
                  "section": "Indexed Account Mechanics",
                  "quote": "9.50%",
                  "claimIds": []
                },
                {
                  "citationId": "cit_013",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c007",
                  "pageStart": 5,
                  "pageEnd": 5,
                  "section": "Indexed Account Mechanics",
                  "quote": "100%",
                  "claimIds": []
                },
                {
                  "citationId": "cit_014",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c007",
                  "pageStart": 5,
                  "pageEnd": 5,
                  "section": "Indexed Account Mechanics",
                  "quote": "Current caps and participation rates are declared by the carrier and may change for future segments.",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  5
                ],
                "evidenceQuoteCount": 3
              }
            }
          ]
        },
        {
          "dimensionId": "crediting_mechanics",
          "labelZh": "计息 / 利率机制",
          "labelEn": "Crediting / rate mechanics",
          "core": false,
          "cells": [
            {
              "dimensionId": "crediting_mechanics",
              "productId": "doc_securerate5_v1",
              "availability": "available",
              "format": "percent",
              "sourceKind": "direct",
              "displayValue": "初始利率 Initial rate: 4.25% · 续期利率 Renewal rates: Declared annually after year five.",
              "rawValue": {
                "initialRate.rate": 0.0425,
                "renewalRates": {
                  "display": "Declared annually after year five."
                }
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_030",
                  "documentId": "doc_securerate5_v1",
                  "documentName": "Demo SecureRate 5 Fixed Annuity Guide",
                  "productName": "Demo SecureRate 5",
                  "chunkId": "doc_securerate5_v1:c002",
                  "pageStart": 3,
                  "pageEnd": 3,
                  "section": "Interest Rates",
                  "quote": "4.25%",
                  "claimIds": []
                },
                {
                  "citationId": "cit_029",
                  "documentId": "doc_securerate5_v1",
                  "documentName": "Demo SecureRate 5 Fixed Annuity Guide",
                  "productName": "Demo SecureRate 5",
                  "chunkId": "doc_securerate5_v1:c002",
                  "pageStart": 3,
                  "pageEnd": 3,
                  "section": "Interest Rates",
                  "quote": "Declared annually after year five.",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  3
                ],
                "evidenceQuoteCount": 2
              }
            },
            {
              "dimensionId": "crediting_mechanics",
              "productId": "doc_indexflex_ul_v1",
              "availability": "available",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "Annual point-to-point method linked to the Index, excluding dividends.",
              "rawValue": {
                "display": "Annual point-to-point method linked to the Index, excluding dividends."
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_006",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c007",
                  "pageStart": 5,
                  "pageEnd": 5,
                  "section": "Indexed Account Mechanics",
                  "quote": "Annual point-to-point method linked to the Index, excluding dividends.",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  5
                ],
                "evidenceQuoteCount": 1
              }
            }
          ]
        },
        {
          "dimensionId": "surrender_liquidity",
          "labelZh": "退保费用与流动性",
          "labelEn": "Surrender charges and liquidity",
          "core": true,
          "cells": [
            {
              "dimensionId": "surrender_liquidity",
              "productId": "doc_securerate5_v1",
              "availability": "available",
              "format": "years",
              "sourceKind": "derived",
              "displayValue": "退保费用表在第 1–7 个合同年收取费用,第 8 年起为 0。 The surrender-charge schedule applies charges through contract year 7; from year 8 the charge is 0. · 免费提取 Free withdrawal: 10% of account value per contract year, beginning in year 2. · 市场价值调整 Market value adjustment: Market Value Adjustment applies to withdrawals exceeding the free amount during the surrender-charge period.",
              "rawValue": 7,
              "derivation": {
                "ruleId": "LAST_NONZERO_SURRENDER_CHARGE_YEAR",
                "inputFactRefs": [
                  "surrenderChargeSchedule.chargesByYearPercent",
                  "surrenderChargeSchedule.basis"
                ],
                "reconciledWithPath": "surrenderPeriodYears"
              },
              "citations": [
                {
                  "citationId": "cit_031",
                  "documentId": "doc_securerate5_v1",
                  "documentName": "Demo SecureRate 5 Fixed Annuity Guide",
                  "productName": "Demo SecureRate 5",
                  "chunkId": "doc_securerate5_v1:c004",
                  "pageStart": 4,
                  "pageEnd": 4,
                  "section": "Accessing Money > Surrender Charge Schedule",
                  "quote": "Surrender Charge Schedule",
                  "claimIds": []
                },
                {
                  "citationId": "cit_032",
                  "documentId": "doc_securerate5_v1",
                  "documentName": "Demo SecureRate 5 Fixed Annuity Guide",
                  "productName": "Demo SecureRate 5",
                  "chunkId": "doc_securerate5_v1:c003",
                  "pageStart": 4,
                  "pageEnd": 4,
                  "section": "Accessing Money > Free Withdrawal",
                  "quote": "10% of account value per contract year, beginning in year 2.",
                  "claimIds": []
                },
                {
                  "citationId": "cit_033",
                  "documentId": "doc_securerate5_v1",
                  "documentName": "Demo SecureRate 5 Fixed Annuity Guide",
                  "productName": "Demo SecureRate 5",
                  "chunkId": "doc_securerate5_v1:c005",
                  "pageStart": 4,
                  "pageEnd": 4,
                  "section": "Accessing Money > Market Value Adjustment",
                  "quote": "Market Value Adjustment applies to withdrawals exceeding the free amount during the surrender-charge period.",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  4
                ],
                "evidenceQuoteCount": 3
              }
            },
            {
              "dimensionId": "surrender_liquidity",
              "productId": "doc_indexflex_ul_v1",
              "availability": "available",
              "format": "years",
              "sourceKind": "derived",
              "displayValue": "退保费用表在第 1–10 个合同年收取费用,第 11 年起为 0。 The surrender-charge schedule applies charges through contract year 10; from year 11 the charge is 0. · 提取 Withdrawals: Minimum partial withdrawal $500; withdrawals reduce death benefit and cash value.",
              "rawValue": 10,
              "derivation": {
                "ruleId": "LAST_NONZERO_SURRENDER_CHARGE_YEAR",
                "inputFactRefs": [
                  "surrenderChargeSchedule.chargesByYear",
                  "surrenderChargeSchedule.basis"
                ],
                "reconciledWithPath": "surrenderCharge.years"
              },
              "citations": [
                {
                  "citationId": "cit_015",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c009",
                  "pageStart": 6,
                  "pageEnd": 6,
                  "section": "Surrender Charge Schedule, Loans and Withdrawals > Surrender Charge Schedule (per $1,000 of face amount)",
                  "quote": "Surrender Charge Schedule (per $1,000 of face amount)",
                  "claimIds": []
                },
                {
                  "citationId": "cit_007",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c011",
                  "pageStart": 6,
                  "pageEnd": 6,
                  "section": "Surrender Charge Schedule, Loans and Withdrawals > Withdrawals",
                  "quote": "Minimum partial withdrawal $500; withdrawals reduce death benefit and cash value.",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  6
                ],
                "evidenceQuoteCount": 2
              }
            }
          ]
        },
        {
          "dimensionId": "riders",
          "labelZh": "附加险 / 可选利益",
          "labelEn": "Riders / optional benefits",
          "core": true,
          "cells": [
            {
              "dimensionId": "riders",
              "productId": "doc_securerate5_v1",
              "availability": "available",
              "format": "boolean",
              "sourceKind": "direct",
              "displayValue": "This product does not offer optional riders.",
              "rawValue": false,
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_034",
                  "documentId": "doc_securerate5_v1",
                  "documentName": "Demo SecureRate 5 Fixed Annuity Guide",
                  "productName": "Demo SecureRate 5",
                  "chunkId": "doc_securerate5_v1:c008",
                  "pageStart": 5,
                  "pageEnd": 5,
                  "section": "Annuitization Options > Optional Riders",
                  "quote": "This product does not offer optional riders.",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  5
                ],
                "evidenceQuoteCount": 1
              }
            },
            {
              "dimensionId": "riders",
              "productId": "doc_indexflex_ul_v1",
              "availability": "available",
              "format": "textList",
              "sourceKind": "direct",
              "displayValue": "Terminal and chronic illness. · Overloan Protection. · Disability.",
              "rawValue": {
                "riders[0].name": "Accelerated Death Benefit",
                "riders[1].name": "Overloan Protection",
                "riders[2].name": "Waiver of Monthly Deductions"
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_016",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c012",
                  "pageStart": 7,
                  "pageEnd": 7,
                  "section": "Riders > Accelerated Death Benefit",
                  "quote": "Terminal and chronic illness.",
                  "claimIds": []
                },
                {
                  "citationId": "cit_017",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c013",
                  "pageStart": 7,
                  "pageEnd": 7,
                  "section": "Riders > Overloan Protection",
                  "quote": "Overloan Protection.",
                  "claimIds": []
                },
                {
                  "citationId": "cit_018",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c014",
                  "pageStart": 7,
                  "pageEnd": 7,
                  "section": "Riders > Waiver of Monthly Deductions",
                  "quote": "Disability.",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  7
                ],
                "evidenceQuoteCount": 3
              }
            }
          ]
        },
        {
          "dimensionId": "illustration_documentation",
          "labelZh": "illustration / 文件要求",
          "labelEn": "Illustration / documentation",
          "core": false,
          "cells": [
            {
              "dimensionId": "illustration_documentation",
              "productId": "doc_securerate5_v1",
              "availability": "not_provided",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "演示资料未提供 Not provided in demo materials",
              "rawValue": null,
              "derivation": null,
              "citations": [],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 0,
                "anchorPages": [],
                "evidenceQuoteCount": 0
              }
            },
            {
              "dimensionId": "illustration_documentation",
              "productId": "doc_indexflex_ul_v1",
              "availability": "available",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "Guaranteed and non-guaranteed columns must be shown in a personalized illustration.",
              "rawValue": {
                "display": "Guaranteed and non-guaranteed columns must be shown in a personalized illustration."
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_019",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c015",
                  "pageStart": 8,
                  "pageEnd": 8,
                  "section": "Disclosures > Personalized Illustration",
                  "quote": "Guaranteed and non-guaranteed columns must be shown in a personalized illustration.",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  8
                ],
                "evidenceQuoteCount": 1
              }
            }
          ]
        },
        {
          "dimensionId": "important_limitations",
          "labelZh": "重要限制与披露",
          "labelEn": "Important limitations and disclosures",
          "core": false,
          "cells": [
            {
              "dimensionId": "important_limitations",
              "productId": "doc_securerate5_v1",
              "availability": "available",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "税务提示 Tax note: Tax-deferred growth. Withdrawals before age 59½ may be subject to a 10% federal tax penalty. Consult a tax advisor. · 转保披露 Replacement disclosure: Replacing an existing annuity or life policy may begin a new surrender-charge period and may forfeit existing benefits. State replacement forms are required. · 适合性审核 Suitability review: Heightened suitability review applies to applicants age 65 and older under this Demo policy.",
              "rawValue": {
                "taxNote": {
                  "display": "Tax-deferred growth. Withdrawals before age 59½ may be subject to a 10% federal tax penalty. Consult a tax advisor.",
                  "penaltyAgeDisplay": "59½",
                  "penaltyRate": 0.1,
                  "penaltyRateDisplay": "10%"
                },
                "replacement": {
                  "display": "Replacing an existing annuity or life policy may begin a new surrender-charge period and may forfeit existing benefits. State replacement forms are required."
                },
                "suitability": {
                  "heightenedReviewAge": 65,
                  "display": "Heightened suitability review applies to applicants age 65 and older under this Demo policy."
                }
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_035",
                  "documentId": "doc_securerate5_v1",
                  "documentName": "Demo SecureRate 5 Fixed Annuity Guide",
                  "productName": "Demo SecureRate 5",
                  "chunkId": "doc_securerate5_v1:c009",
                  "pageStart": 6,
                  "pageEnd": 6,
                  "section": "Tax Notes, Replacement Disclosure and 65+ Suitability Review > Tax Notes",
                  "quote": "Tax-deferred growth. Withdrawals before age 59½ may be subject to a 10% federal tax penalty. Consult a tax advisor.",
                  "claimIds": []
                },
                {
                  "citationId": "cit_036",
                  "documentId": "doc_securerate5_v1",
                  "documentName": "Demo SecureRate 5 Fixed Annuity Guide",
                  "productName": "Demo SecureRate 5",
                  "chunkId": "doc_securerate5_v1:c010",
                  "pageStart": 6,
                  "pageEnd": 6,
                  "section": "Tax Notes, Replacement Disclosure and 65+ Suitability Review > Replacement Disclosure",
                  "quote": "Replacing an existing annuity or life policy may begin a new surrender-charge period and may forfeit existing benefits. State replacement forms are required.",
                  "claimIds": []
                },
                {
                  "citationId": "cit_037",
                  "documentId": "doc_securerate5_v1",
                  "documentName": "Demo SecureRate 5 Fixed Annuity Guide",
                  "productName": "Demo SecureRate 5",
                  "chunkId": "doc_securerate5_v1:c011",
                  "pageStart": 6,
                  "pageEnd": 6,
                  "section": "Tax Notes, Replacement Disclosure and 65+ Suitability Review > Suitability Review",
                  "quote": "Heightened suitability review applies to applicants age 65 and older under this Demo policy.",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  6
                ],
                "evidenceQuoteCount": 3
              }
            },
            {
              "dimensionId": "important_limitations",
              "productId": "doc_indexflex_ul_v1",
              "availability": "available",
              "format": "textList",
              "sourceKind": "direct",
              "displayValue": "Not a security. · Not a direct investment in an index or stock market. · Policy values depend on policy-specific charges, costs and crediting.",
              "rawValue": {
                "disclosures[0]": "Not a security.",
                "disclosures[1]": "Not a direct investment in an index or stock market.",
                "disclosures[2]": "Policy values depend on policy-specific charges, costs and crediting."
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_020",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c018",
                  "pageStart": 8,
                  "pageEnd": 8,
                  "section": "Disclosures > Important Notes",
                  "quote": "Not a security.",
                  "claimIds": []
                },
                {
                  "citationId": "cit_021",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c018",
                  "pageStart": 8,
                  "pageEnd": 8,
                  "section": "Disclosures > Important Notes",
                  "quote": "Not a direct investment in an index or stock market.",
                  "claimIds": []
                },
                {
                  "citationId": "cit_022",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c018",
                  "pageStart": 8,
                  "pageEnd": 8,
                  "section": "Disclosures > Important Notes",
                  "quote": "Policy values depend on policy-specific charges, costs and crediting.",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  8
                ],
                "evidenceQuoteCount": 3
              }
            }
          ]
        }
      ],
      "observations": [
        {
          "observationId": "obs_001",
          "type": "RATE_GUARANTEE_SHORTER_THAN_SURRENDER",
          "textZh": "初始利率保证期为 5 个合同年;退保费用表在第 1–7 个合同年收取费用,第 8 年起为 0。利率保证期结束时,合同可能仍处于退保费用表覆盖期间。",
          "textEn": "The initial rate-guarantee period runs for 5 contract years. The surrender-charge schedule shows non-zero charges through contract year 7 and 0 beginning in year 8. At the end of the rate-guarantee period, the contract may still be within the surrender-charge schedule.",
          "factRefs": [
            {
              "dimensionId": "guaranteed_elements",
              "productId": "doc_securerate5_v1"
            },
            {
              "dimensionId": "surrender_liquidity",
              "productId": "doc_securerate5_v1"
            }
          ],
          "citationIds": [
            "cit_027",
            "cit_028",
            "cit_031",
            "cit_032",
            "cit_033"
          ],
          "severity": "review_note"
        },
        {
          "observationId": "obs_002",
          "type": "COVERAGE_STRUCTURE_DIFFERS",
          "textZh": "两款产品的合同结构不同:一方有寿险保障期限,另一方不适用该概念。",
          "textEn": "The contract structures differ: one carries a life-insurance coverage duration, the other has no such concept.",
          "factRefs": [
            {
              "dimensionId": "coverage_duration",
              "productId": "doc_indexflex_ul_v1"
            },
            {
              "dimensionId": "coverage_duration",
              "productId": "doc_securerate5_v1"
            }
          ],
          "citationIds": [
            "cit_004"
          ],
          "severity": "informational"
        },
        {
          "observationId": "obs_003",
          "type": "NON_GUARANTEED_ELEMENTS_PRESENT",
          "textZh": "本次比较涉及非保证要素;这些数值由承保方宣告,可能随时间变化,需持牌经纪人复核。",
          "textEn": "This comparison involves non-guaranteed elements; those values are declared by the carrier, can change over time, and require licensed-agent review.",
          "factRefs": [
            {
              "dimensionId": "non_guaranteed_elements",
              "productId": "doc_indexflex_ul_v1"
            },
            {
              "dimensionId": "non_guaranteed_elements",
              "productId": "doc_securerate5_v1"
            }
          ],
          "citationIds": [
            "cit_012",
            "cit_013",
            "cit_014",
            "cit_029"
          ],
          "severity": "review_note"
        },
        {
          "observationId": "obs_004",
          "type": "ILLUSTRATION_REQUIRED_DIFFERS",
          "textZh": "只有其中一款产品在资料中说明了个性化 illustration 的要求;另一款资料未提供该说明。",
          "textEn": "Only one of the products documents a personalized-illustration requirement; the other's materials state none.",
          "factRefs": [
            {
              "dimensionId": "illustration_documentation",
              "productId": "doc_indexflex_ul_v1"
            }
          ],
          "citationIds": [
            "cit_019"
          ],
          "severity": "review_note"
        }
      ],
      "missingClientInformation": [
        {
          "field": "desiredCoverageAmount",
          "reasonZh": "尚未确认客户期望的身故保额,无法评估保障缺口。",
          "reasonEn": "The desired death-benefit amount is not stated, so coverage need cannot be evaluated.",
          "relevantTo": [
            "contract_size",
            "premium_structure"
          ],
          "requiredFor": "coverage_need"
        },
        {
          "field": "tobaccoUse",
          "reasonZh": "尚未确认吸烟状况,寿险费率分档取决于此。",
          "reasonEn": "Tobacco use is not stated; life-insurance rate classes depend on it.",
          "relevantTo": [
            "premium_structure",
            "eligibility"
          ],
          "requiredFor": "cost_comparison"
        },
        {
          "field": "underwritingClass",
          "reasonZh": "核保分类由承保方在核保时决定,资料中的样本费率不等于实际费率。",
          "reasonEn": "The underwriting class is set by the carrier at underwriting; sample rates are not actual rates.",
          "relevantTo": [
            "premium_structure"
          ],
          "requiredFor": "cost_comparison"
        },
        {
          "field": "employerGroupCoverage",
          "reasonZh": "尚未确认是否已有团体或雇主提供的保障。",
          "reasonEn": "Whether employer or group coverage already exists has not been confirmed.",
          "relevantTo": [
            "contract_size"
          ],
          "requiredFor": "coverage_need"
        },
        {
          "field": "plannedPremiumDuration",
          "reasonZh": "灵活保费产品需要确认计划缴费年限。",
          "reasonEn": "A flexible-premium product requires the planned premium-paying duration.",
          "relevantTo": [
            "premium_structure"
          ],
          "requiredFor": "illustration"
        },
        {
          "field": "cashValueTimeHorizon",
          "reasonZh": "尚未确认现金价值积累的时间目标。",
          "reasonEn": "The time horizon for cash-value accumulation is not stated.",
          "relevantTo": [
            "cash_value"
          ],
          "requiredFor": "illustration"
        },
        {
          "field": "withdrawalExpectations",
          "reasonZh": "尚未确认取用或提取资金的预期。",
          "reasonEn": "Expectations about access to or withdrawal of funds are not stated.",
          "relevantTo": [
            "cash_value",
            "surrender_liquidity"
          ],
          "requiredFor": "illustration"
        },
        {
          "field": "personalizedIllustration",
          "reasonZh": "资料未提供个性化 illustration;保证与非保证栏必须由承保方出具。",
          "reasonEn": "No personalized illustration is available; guaranteed and non-guaranteed columns must come from the carrier.",
          "relevantTo": [
            "illustration_documentation",
            "non_guaranteed_elements"
          ],
          "requiredFor": "illustration"
        },
        {
          "field": "currentSurrenderCharge",
          "reasonZh": "尚未确认现有合同的退保费用。",
          "reasonEn": "The surrender charge on the existing contract is not known.",
          "relevantTo": [
            "surrender_liquidity"
          ],
          "requiredFor": "replacement_review"
        },
        {
          "field": "currentMarketValueAdjustment",
          "reasonZh": "尚未确认现有合同的市场价值调整。",
          "reasonEn": "The market value adjustment on the existing contract is not known.",
          "relevantTo": [
            "surrender_liquidity"
          ],
          "requiredFor": "replacement_review"
        },
        {
          "field": "existingGuaranteedRateEndDate",
          "reasonZh": "尚未确认现有合同的保证利率何时结束。",
          "reasonEn": "The end date of the existing contract's guaranteed rate is not known.",
          "relevantTo": [
            "guaranteed_elements"
          ],
          "requiredFor": "replacement_review"
        },
        {
          "field": "currentAccountValue",
          "reasonZh": "尚未确认现有合同的当前账户价值。",
          "reasonEn": "The current account value of the existing contract is not known.",
          "relevantTo": [
            "contract_size"
          ],
          "requiredFor": "replacement_review"
        },
        {
          "field": "benefitsThatMayBeLost",
          "reasonZh": "尚未确认转换后可能失去的既有利益或保证。",
          "reasonEn": "Benefits or guarantees that may be forfeited on replacement have not been identified.",
          "relevantTo": [
            "guaranteed_elements",
            "important_limitations"
          ],
          "requiredFor": "replacement_review"
        }
      ],
      "comparisonStatus": "complete",
      "reviewReasons": [
        "CLIENT_FACING_DRAFT",
        "NON_GUARANTEED_ELEMENTS",
        "ILLUSTRATION_REQUIRED",
        "ANNUITY_CONTEXT",
        "SURRENDER_CHARGE_EXPOSURE",
        "MARKET_VALUE_ADJUSTMENT_EXPOSURE",
        "AGE_65_PLUS",
        "REPLACEMENT_CONTEXT"
      ],
      "disclaimerZh": "本比较为内部工作草稿,仅供持牌保险经纪人审阅。所有产品与数据均为虚构演示资料。本文不构成最终推荐、suitability 判断、报价、保单 illustration,也不构成法律或税务意见。",
      "disclaimerEn": "This comparison is an internal working draft for licensed-agent review. All products and data are fictional demonstration materials. It is not a final recommendation, a suitability determination, a quote, a policy illustration, or legal or tax advice.",
      "meta": {
        "comparisonEngineVersion": 1,
        "factRegistryVersion": 1
      }
    },
    "snapshotSha256": "dd7bdc00a5eb7a01ac160b204d0acb993e519eb7ebc9c76ac759020902ca63cd",
    "workflowDecision": "block_client_draft",
    "requiredApprovalLevel": "licensed_agent_required",
    "reviewReasons": [
      "CLIENT_FACING_DRAFT",
      "NON_GUARANTEED_ELEMENTS",
      "ILLUSTRATION_REQUIRED",
      "ANNUITY_CONTEXT",
      "SURRENDER_CHARGE_EXPOSURE",
      "MARKET_VALUE_ADJUSTMENT_EXPOSURE",
      "AGE_65_PLUS",
      "REPLACEMENT_CONTEXT"
    ],
    "checklist": [
      {
        "key": "current contract surrender charge",
        "labelZh": "现有合同的退保费用",
        "labelEn": "Current contract surrender charge",
        "sourceKind": "fixture_checklist"
      },
      {
        "key": "current contract market value adjustment",
        "labelZh": "现有合同的市场价值调整",
        "labelEn": "Current contract market value adjustment",
        "sourceKind": "fixture_checklist"
      },
      {
        "key": "existing guaranteed rate end date",
        "labelZh": "现有保证利率的到期日",
        "labelEn": "Existing guaranteed-rate end date",
        "sourceKind": "fixture_checklist"
      },
      {
        "key": "new contract guaranteed rate period",
        "labelZh": "新合同的保证利率期间",
        "labelEn": "New contract guaranteed-rate period",
        "sourceKind": "fixture_checklist"
      },
      {
        "key": "new contract surrender period",
        "labelZh": "新合同的退保费用期间",
        "labelEn": "New contract surrender-charge period",
        "sourceKind": "fixture_checklist"
      },
      {
        "key": "benefits that may be forfeited",
        "labelZh": "可能失去的既有利益",
        "labelEn": "Benefits that may be forfeited",
        "sourceKind": "fixture_checklist"
      },
      {
        "key": "state replacement forms",
        "labelZh": "州替换申报表",
        "labelEn": "State replacement forms",
        "sourceKind": "fixture_checklist"
      },
      {
        "key": "age-based suitability review",
        "labelZh": "基于年龄的适合性审核",
        "labelEn": "Age-based suitability review",
        "sourceKind": "fixture_checklist"
      },
      {
        "key": "desiredCoverageAmount",
        "labelZh": "期望身故保额",
        "labelEn": "Desired death benefit",
        "sourceKind": "missing_client_info"
      },
      {
        "key": "tobaccoUse",
        "labelZh": "吸烟状况",
        "labelEn": "Tobacco use",
        "sourceKind": "missing_client_info"
      },
      {
        "key": "underwritingClass",
        "labelZh": "核保分类",
        "labelEn": "Underwriting class",
        "sourceKind": "missing_client_info"
      },
      {
        "key": "employerGroupCoverage",
        "labelZh": "团体/雇主保障",
        "labelEn": "Employer or group coverage",
        "sourceKind": "missing_client_info"
      },
      {
        "key": "plannedPremiumDuration",
        "labelZh": "计划缴费年限",
        "labelEn": "Planned premium duration",
        "sourceKind": "missing_client_info"
      },
      {
        "key": "cashValueTimeHorizon",
        "labelZh": "现金价值时间目标",
        "labelEn": "Cash-value time horizon",
        "sourceKind": "missing_client_info"
      },
      {
        "key": "withdrawalExpectations",
        "labelZh": "取用预期",
        "labelEn": "Withdrawal expectations",
        "sourceKind": "missing_client_info"
      },
      {
        "key": "personalizedIllustration",
        "labelZh": "个性化 illustration",
        "labelEn": "Personalized illustration",
        "sourceKind": "missing_client_info"
      },
      {
        "key": "currentAccountValue",
        "labelZh": "现有账户价值",
        "labelEn": "Current account value",
        "sourceKind": "missing_client_info"
      }
    ],
    "reviewState": "pending_review",
    "reviewer": null,
    "decisionNote": null,
    "revisionInstructions": null,
    "createdAt": "2026-08-01T10:00:00+00:00",
    "updatedAt": "2026-08-01T10:00:00+00:00",
    "citationUrls": {
      "cit_023": "/documents/demo-securerate-5.pdf#page=2",
      "cit_001": "/documents/demo-indexflex-ul.pdf#page=2",
      "cit_024": "/documents/demo-securerate-5.pdf#page=2",
      "cit_002": "/documents/demo-indexflex-ul.pdf#page=3",
      "cit_025": "/documents/demo-securerate-5.pdf#page=2",
      "cit_026": "/documents/demo-securerate-5.pdf#page=2",
      "cit_003": "/documents/demo-indexflex-ul.pdf#page=2",
      "cit_004": "/documents/demo-indexflex-ul.pdf#page=3",
      "cit_005": "/documents/demo-indexflex-ul.pdf#page=3",
      "cit_006": "/documents/demo-indexflex-ul.pdf#page=5",
      "cit_007": "/documents/demo-indexflex-ul.pdf#page=6",
      "cit_027": "/documents/demo-securerate-5.pdf#page=3",
      "cit_028": "/documents/demo-securerate-5.pdf#page=3",
      "cit_008": "/documents/demo-indexflex-ul.pdf#page=5",
      "cit_009": "/documents/demo-indexflex-ul.pdf#page=5",
      "cit_010": "/documents/demo-indexflex-ul.pdf#page=5",
      "cit_011": "/documents/demo-indexflex-ul.pdf#page=4",
      "cit_029": "/documents/demo-securerate-5.pdf#page=3",
      "cit_012": "/documents/demo-indexflex-ul.pdf#page=5",
      "cit_013": "/documents/demo-indexflex-ul.pdf#page=5",
      "cit_014": "/documents/demo-indexflex-ul.pdf#page=5",
      "cit_030": "/documents/demo-securerate-5.pdf#page=3",
      "cit_031": "/documents/demo-securerate-5.pdf#page=4",
      "cit_032": "/documents/demo-securerate-5.pdf#page=4",
      "cit_033": "/documents/demo-securerate-5.pdf#page=4",
      "cit_015": "/documents/demo-indexflex-ul.pdf#page=6",
      "cit_034": "/documents/demo-securerate-5.pdf#page=5",
      "cit_016": "/documents/demo-indexflex-ul.pdf#page=7",
      "cit_017": "/documents/demo-indexflex-ul.pdf#page=7",
      "cit_018": "/documents/demo-indexflex-ul.pdf#page=7",
      "cit_019": "/documents/demo-indexflex-ul.pdf#page=8",
      "cit_035": "/documents/demo-securerate-5.pdf#page=6",
      "cit_036": "/documents/demo-securerate-5.pdf#page=6",
      "cit_037": "/documents/demo-securerate-5.pdf#page=6",
      "cit_020": "/documents/demo-indexflex-ul.pdf#page=8",
      "cit_021": "/documents/demo-indexflex-ul.pdf#page=8",
      "cit_022": "/documents/demo-indexflex-ul.pdf#page=8"
    },
    "events": [
      {
        "eventId": "evt_fixture_created",
        "reviewId": "rev_fixture_case_c",
        "eventType": "REVIEW_CREATED",
        "actor": "Demo Reviewer",
        "payload": {},
        "occurredAt": "2026-08-01T10:00:00+00:00"
      }
    ]
  },
  "caseAPending": {
    "reviewId": "rev_fixture_case_a",
    "sourceType": "comparison_draft",
    "snapshot": {
      "schemaVersion": 1,
      "comparisonId": "cmp_fixture",
      "productA": {
        "documentId": "doc_termplus20_v1",
        "documentName": "Demo TermPlus 20 Product Guide",
        "productName": "Demo TermPlus 20",
        "productCategory": "term_life"
      },
      "productB": {
        "documentId": "doc_indexflex_ul_v1",
        "documentName": "Demo IndexFlex UL Product Guide",
        "productName": "Demo IndexFlex UL",
        "productCategory": "indexed_universal_life"
      },
      "clientContext": {
        "caseId": "DEMO-2026-001",
        "displayName": "Demo Client A",
        "language": "zh",
        "age": 38,
        "dependents": 2,
        "primaryGoal": "income_replacement",
        "budgetMonthly": 250,
        "coverageHorizon": "20-25",
        "existingCoverageNote": "none",
        "riskTolerance": "low",
        "tobaccoUse": "unknown",
        "desiredCoverageAmount": "unknown",
        "replacementContext": false,
        "clientQuestions": []
      },
      "dimensions": [
        {
          "dimensionId": "product_type",
          "labelZh": "产品类型",
          "labelEn": "Product type",
          "core": true,
          "cells": [
            {
              "dimensionId": "product_type",
              "productId": "doc_termplus20_v1",
              "availability": "available",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "20-Year Level Term Life Insurance",
              "rawValue": "20-Year Level Term Life Insurance",
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_023",
                  "documentId": "doc_termplus20_v1",
                  "documentName": "Demo TermPlus 20 Product Guide",
                  "productName": "Demo TermPlus 20",
                  "chunkId": "doc_termplus20_v1:c001",
                  "pageStart": 2,
                  "pageEnd": 2,
                  "section": "At a Glance",
                  "quote": "20-Year Level Term Life Insurance",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  2
                ],
                "evidenceQuoteCount": 1
              }
            },
            {
              "dimensionId": "product_type",
              "productId": "doc_indexflex_ul_v1",
              "availability": "available",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "Flexible-Premium Indexed Universal Life",
              "rawValue": "Flexible-Premium Indexed Universal Life",
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_001",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c001",
                  "pageStart": 2,
                  "pageEnd": 2,
                  "section": "Overview and Death Benefit Options",
                  "quote": "Flexible-Premium Indexed Universal Life",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  2
                ],
                "evidenceQuoteCount": 1
              }
            }
          ]
        },
        {
          "dimensionId": "eligibility",
          "labelZh": "投保年龄",
          "labelEn": "Issue ages",
          "core": false,
          "cells": [
            {
              "dimensionId": "eligibility",
              "productId": "doc_termplus20_v1",
              "availability": "available",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "18–60",
              "rawValue": {
                "min": 18,
                "max": 60,
                "display": "18–60"
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_024",
                  "documentId": "doc_termplus20_v1",
                  "documentName": "Demo TermPlus 20 Product Guide",
                  "productName": "Demo TermPlus 20",
                  "chunkId": "doc_termplus20_v1:c001",
                  "pageStart": 2,
                  "pageEnd": 2,
                  "section": "At a Glance",
                  "quote": "18–60",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  2
                ],
                "evidenceQuoteCount": 1
              }
            },
            {
              "dimensionId": "eligibility",
              "productId": "doc_indexflex_ul_v1",
              "availability": "available",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "0–75",
              "rawValue": {
                "min": 0,
                "max": 75,
                "display": "0–75"
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_002",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c003",
                  "pageStart": 3,
                  "pageEnd": 3,
                  "section": "Eligibility, Premium Flexibility and Five-Year No-Lapse Guarantee",
                  "quote": "0–75",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  3
                ],
                "evidenceQuoteCount": 1
              }
            }
          ]
        },
        {
          "dimensionId": "contract_size",
          "labelZh": "保额 / 合同金额",
          "labelEn": "Coverage amount / contract size",
          "core": false,
          "cells": [
            {
              "dimensionId": "contract_size",
              "productId": "doc_termplus20_v1",
              "availability": "available",
              "format": "currency",
              "sourceKind": "direct",
              "displayValue": "身故保额 Face amount: $100,000–$2,000,000",
              "rawValue": {
                "min": 100000,
                "max": 2000000,
                "display": "$100,000–$2,000,000"
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_025",
                  "documentId": "doc_termplus20_v1",
                  "documentName": "Demo TermPlus 20 Product Guide",
                  "productName": "Demo TermPlus 20",
                  "chunkId": "doc_termplus20_v1:c001",
                  "pageStart": 2,
                  "pageEnd": 2,
                  "section": "At a Glance",
                  "quote": "$100,000–$2,000,000",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  2
                ],
                "evidenceQuoteCount": 1
              }
            },
            {
              "dimensionId": "contract_size",
              "productId": "doc_indexflex_ul_v1",
              "availability": "available",
              "format": "currency",
              "sourceKind": "direct",
              "displayValue": "最低身故保额 Minimum face amount: $100,000",
              "rawValue": {
                "amount": 100000,
                "display": "$100,000"
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_003",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c001",
                  "pageStart": 2,
                  "pageEnd": 2,
                  "section": "Overview and Death Benefit Options",
                  "quote": "$100,000",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  2
                ],
                "evidenceQuoteCount": 1
              }
            }
          ]
        },
        {
          "dimensionId": "coverage_duration",
          "labelZh": "保障期限",
          "labelEn": "Coverage duration",
          "core": true,
          "cells": [
            {
              "dimensionId": "coverage_duration",
              "productId": "doc_termplus20_v1",
              "availability": "available",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "Level and guaranteed for 20 years. After the level period, coverage is annually renewable at attained-age rates that increase each year; see policy schedule. Coverage may continue to age 95.",
              "rawValue": {
                "levelYears": 20,
                "coverageMaxAge": 95,
                "display": "Level and guaranteed for 20 years. After the level period, coverage is annually renewable at attained-age rates that increase each year; see policy schedule. Coverage may continue to age 95."
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_026",
                  "documentId": "doc_termplus20_v1",
                  "documentName": "Demo TermPlus 20 Product Guide",
                  "productName": "Demo TermPlus 20",
                  "chunkId": "doc_termplus20_v1:c004",
                  "pageStart": 4,
                  "pageEnd": 4,
                  "section": "Premium Structure",
                  "quote": "Level and guaranteed for 20 years. After the level period, coverage is annually renewable at attained-age rates that increase each year; see policy schedule. Coverage may continue to age 95.",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  4
                ],
                "evidenceQuoteCount": 1
              }
            },
            {
              "dimensionId": "coverage_duration",
              "productId": "doc_indexflex_ul_v1",
              "availability": "available",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "无失效保证 No-lapse guarantee: Five-Year No-Lapse Guarantee if the required minimum monthly premium is paid.",
              "rawValue": {
                "years": 5,
                "display": "Five-Year No-Lapse Guarantee if the required minimum monthly premium is paid."
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_004",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c004",
                  "pageStart": 3,
                  "pageEnd": 3,
                  "section": "Eligibility, Premium Flexibility and Five-Year No-Lapse Guarantee > Five-Year No-Lapse Guarantee",
                  "quote": "Five-Year No-Lapse Guarantee if the required minimum monthly premium is paid.",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  3
                ],
                "evidenceQuoteCount": 1
              }
            }
          ]
        },
        {
          "dimensionId": "premium_structure",
          "labelZh": "保费 / 缴费结构",
          "labelEn": "Premium / contribution structure",
          "core": true,
          "cells": [
            {
              "dimensionId": "premium_structure",
              "productId": "doc_termplus20_v1",
              "availability": "available",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "Level and guaranteed for 20 years. After the level period, coverage is annually renewable at attained-age rates that increase each year; see policy schedule. Coverage may continue to age 95.",
              "rawValue": {
                "levelYears": 20,
                "coverageMaxAge": 95,
                "display": "Level and guaranteed for 20 years. After the level period, coverage is annually renewable at attained-age rates that increase each year; see policy schedule. Coverage may continue to age 95."
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_026",
                  "documentId": "doc_termplus20_v1",
                  "documentName": "Demo TermPlus 20 Product Guide",
                  "productName": "Demo TermPlus 20",
                  "chunkId": "doc_termplus20_v1:c004",
                  "pageStart": 4,
                  "pageEnd": 4,
                  "section": "Premium Structure",
                  "quote": "Level and guaranteed for 20 years. After the level period, coverage is annually renewable at attained-age rates that increase each year; see policy schedule. Coverage may continue to age 95.",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  4
                ],
                "evidenceQuoteCount": 1
              }
            },
            {
              "dimensionId": "premium_structure",
              "productId": "doc_indexflex_ul_v1",
              "availability": "available",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "Flexible, subject to policy minimums and tax-law maximums.",
              "rawValue": {
                "display": "Flexible, subject to policy minimums and tax-law maximums."
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_005",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c003",
                  "pageStart": 3,
                  "pageEnd": 3,
                  "section": "Eligibility, Premium Flexibility and Five-Year No-Lapse Guarantee",
                  "quote": "Flexible, subject to policy minimums and tax-law maximums.",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  3
                ],
                "evidenceQuoteCount": 1
              }
            }
          ]
        },
        {
          "dimensionId": "cash_value",
          "labelZh": "现金价值 / 账户价值",
          "labelEn": "Cash value / account value",
          "core": true,
          "cells": [
            {
              "dimensionId": "cash_value",
              "productId": "doc_termplus20_v1",
              "availability": "available",
              "format": "boolean",
              "sourceKind": "direct",
              "displayValue": "None. The policy does not accumulate cash value.",
              "rawValue": false,
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_027",
                  "documentId": "doc_termplus20_v1",
                  "documentName": "Demo TermPlus 20 Product Guide",
                  "productName": "Demo TermPlus 20",
                  "chunkId": "doc_termplus20_v1:c001",
                  "pageStart": 2,
                  "pageEnd": 2,
                  "section": "At a Glance",
                  "quote": "None. The policy does not accumulate cash value.",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  2
                ],
                "evidenceQuoteCount": 1
              }
            },
            {
              "dimensionId": "cash_value",
              "productId": "doc_indexflex_ul_v1",
              "availability": "available",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "指数账户 Indexed account: Annual point-to-point method linked to the Index, excluding dividends. · 提取 Withdrawals: Minimum partial withdrawal $500; withdrawals reduce death benefit and cash value.",
              "rawValue": {
                "indexedAccount": {
                  "display": "Annual point-to-point method linked to the Index, excluding dividends."
                },
                "withdrawals": {
                  "display": "Minimum partial withdrawal $500; withdrawals reduce death benefit and cash value."
                }
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_006",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c007",
                  "pageStart": 5,
                  "pageEnd": 5,
                  "section": "Indexed Account Mechanics",
                  "quote": "Annual point-to-point method linked to the Index, excluding dividends.",
                  "claimIds": []
                },
                {
                  "citationId": "cit_007",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c011",
                  "pageStart": 6,
                  "pageEnd": 6,
                  "section": "Surrender Charge Schedule, Loans and Withdrawals > Withdrawals",
                  "quote": "Minimum partial withdrawal $500; withdrawals reduce death benefit and cash value.",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  5,
                  6
                ],
                "evidenceQuoteCount": 2
              }
            }
          ]
        },
        {
          "dimensionId": "guaranteed_elements",
          "labelZh": "保证要素",
          "labelEn": "Guaranteed elements",
          "core": true,
          "cells": [
            {
              "dimensionId": "guaranteed_elements",
              "productId": "doc_termplus20_v1",
              "availability": "available",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "保费保证 Premium guarantee: Level and guaranteed for 20 years. After the level period, coverage is annually renewable at attained-age rates that increase each year; see policy schedule. Coverage may continue to age 95.",
              "rawValue": 20,
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_026",
                  "documentId": "doc_termplus20_v1",
                  "documentName": "Demo TermPlus 20 Product Guide",
                  "productName": "Demo TermPlus 20",
                  "chunkId": "doc_termplus20_v1:c004",
                  "pageStart": 4,
                  "pageEnd": 4,
                  "section": "Premium Structure",
                  "quote": "Level and guaranteed for 20 years. After the level period, coverage is annually renewable at attained-age rates that increase each year; see policy schedule. Coverage may continue to age 95.",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  4
                ],
                "evidenceQuoteCount": 1
              }
            },
            {
              "dimensionId": "guaranteed_elements",
              "productId": "doc_indexflex_ul_v1",
              "availability": "available",
              "format": "percent",
              "sourceKind": "direct",
              "displayValue": "指数账户保证下限 Indexed account floor: 0.00% · 保证最低 cap Guaranteed minimum cap: 3.00% · 保证最低参与率 Guaranteed minimum participation rate: 50% · 固定账户保证最低利率 Fixed account guaranteed minimum rate: 2.00%",
              "rawValue": {
                "floor.rate": 0,
                "cap.guaranteedMinimumRate": 0.03,
                "participation.guaranteedMinimumRate": 0.5,
                "fixedAccount.guaranteedMinimumRate": 0.02
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_008",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c007",
                  "pageStart": 5,
                  "pageEnd": 5,
                  "section": "Indexed Account Mechanics",
                  "quote": "0.00%",
                  "claimIds": []
                },
                {
                  "citationId": "cit_009",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c007",
                  "pageStart": 5,
                  "pageEnd": 5,
                  "section": "Indexed Account Mechanics",
                  "quote": "3.00%",
                  "claimIds": []
                },
                {
                  "citationId": "cit_010",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c007",
                  "pageStart": 5,
                  "pageEnd": 5,
                  "section": "Indexed Account Mechanics",
                  "quote": "50%",
                  "claimIds": []
                },
                {
                  "citationId": "cit_011",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c005",
                  "pageStart": 4,
                  "pageEnd": 4,
                  "section": "Fixed Account and Charges > Fixed Account",
                  "quote": "2.00%",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  4,
                  5
                ],
                "evidenceQuoteCount": 4
              }
            }
          ]
        },
        {
          "dimensionId": "non_guaranteed_elements",
          "labelZh": "非保证要素",
          "labelEn": "Non-guaranteed elements",
          "core": true,
          "cells": [
            {
              "dimensionId": "non_guaranteed_elements",
              "productId": "doc_termplus20_v1",
              "availability": "not_applicable",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "不适用 Not applicable",
              "rawValue": null,
              "derivation": null,
              "citations": [],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 0,
                "anchorPages": [],
                "evidenceQuoteCount": 0
              }
            },
            {
              "dimensionId": "non_guaranteed_elements",
              "productId": "doc_indexflex_ul_v1",
              "availability": "available",
              "format": "percent",
              "sourceKind": "direct",
              "displayValue": "当前 cap Current cap: 9.50% · 当前参与率 Current participation rate: 100% · 费率变更 Rate changes: Current caps and participation rates are declared by the carrier and may change for future segments.",
              "rawValue": {
                "cap.currentRate": 0.095,
                "participation.currentRate": 1,
                "rateChanges": {
                  "display": "Current caps and participation rates are declared by the carrier and may change for future segments."
                }
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_012",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c007",
                  "pageStart": 5,
                  "pageEnd": 5,
                  "section": "Indexed Account Mechanics",
                  "quote": "9.50%",
                  "claimIds": []
                },
                {
                  "citationId": "cit_013",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c007",
                  "pageStart": 5,
                  "pageEnd": 5,
                  "section": "Indexed Account Mechanics",
                  "quote": "100%",
                  "claimIds": []
                },
                {
                  "citationId": "cit_014",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c007",
                  "pageStart": 5,
                  "pageEnd": 5,
                  "section": "Indexed Account Mechanics",
                  "quote": "Current caps and participation rates are declared by the carrier and may change for future segments.",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  5
                ],
                "evidenceQuoteCount": 3
              }
            }
          ]
        },
        {
          "dimensionId": "crediting_mechanics",
          "labelZh": "计息 / 利率机制",
          "labelEn": "Crediting / rate mechanics",
          "core": false,
          "cells": [
            {
              "dimensionId": "crediting_mechanics",
              "productId": "doc_termplus20_v1",
              "availability": "not_applicable",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "不适用 Not applicable",
              "rawValue": null,
              "derivation": null,
              "citations": [],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 0,
                "anchorPages": [],
                "evidenceQuoteCount": 0
              }
            },
            {
              "dimensionId": "crediting_mechanics",
              "productId": "doc_indexflex_ul_v1",
              "availability": "available",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "Annual point-to-point method linked to the Index, excluding dividends.",
              "rawValue": {
                "display": "Annual point-to-point method linked to the Index, excluding dividends."
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_006",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c007",
                  "pageStart": 5,
                  "pageEnd": 5,
                  "section": "Indexed Account Mechanics",
                  "quote": "Annual point-to-point method linked to the Index, excluding dividends.",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  5
                ],
                "evidenceQuoteCount": 1
              }
            }
          ]
        },
        {
          "dimensionId": "surrender_liquidity",
          "labelZh": "退保费用与流动性",
          "labelEn": "Surrender charges and liquidity",
          "core": true,
          "cells": [
            {
              "dimensionId": "surrender_liquidity",
              "productId": "doc_termplus20_v1",
              "availability": "not_applicable",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "不适用 Not applicable",
              "rawValue": null,
              "derivation": null,
              "citations": [],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 0,
                "anchorPages": [],
                "evidenceQuoteCount": 0
              }
            },
            {
              "dimensionId": "surrender_liquidity",
              "productId": "doc_indexflex_ul_v1",
              "availability": "available",
              "format": "years",
              "sourceKind": "derived",
              "displayValue": "退保费用表在第 1–10 个合同年收取费用,第 11 年起为 0。 The surrender-charge schedule applies charges through contract year 10; from year 11 the charge is 0. · 提取 Withdrawals: Minimum partial withdrawal $500; withdrawals reduce death benefit and cash value.",
              "rawValue": 10,
              "derivation": {
                "ruleId": "LAST_NONZERO_SURRENDER_CHARGE_YEAR",
                "inputFactRefs": [
                  "surrenderChargeSchedule.chargesByYear",
                  "surrenderChargeSchedule.basis"
                ],
                "reconciledWithPath": "surrenderCharge.years"
              },
              "citations": [
                {
                  "citationId": "cit_015",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c009",
                  "pageStart": 6,
                  "pageEnd": 6,
                  "section": "Surrender Charge Schedule, Loans and Withdrawals > Surrender Charge Schedule (per $1,000 of face amount)",
                  "quote": "Surrender Charge Schedule (per $1,000 of face amount)",
                  "claimIds": []
                },
                {
                  "citationId": "cit_007",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c011",
                  "pageStart": 6,
                  "pageEnd": 6,
                  "section": "Surrender Charge Schedule, Loans and Withdrawals > Withdrawals",
                  "quote": "Minimum partial withdrawal $500; withdrawals reduce death benefit and cash value.",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  6
                ],
                "evidenceQuoteCount": 2
              }
            }
          ]
        },
        {
          "dimensionId": "riders",
          "labelZh": "附加险 / 可选利益",
          "labelEn": "Riders / optional benefits",
          "core": true,
          "cells": [
            {
              "dimensionId": "riders",
              "productId": "doc_termplus20_v1",
              "availability": "available",
              "format": "textList",
              "sourceKind": "direct",
              "displayValue": "Terminal illness with life expectancy of 12 months or less; up to 75% of face amount, maximum $500,000; no upfront charge; actuarial discount applies when exercised. · Total disability; issue ages 18–55; six-month waiting period. · $5,000 units; maximum $25,000 per child.",
              "rawValue": {
                "riders[0].name": "Accelerated Death Benefit",
                "riders[1].name": "Waiver of Premium",
                "riders[2].name": "Child Term Rider"
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_028",
                  "documentId": "doc_termplus20_v1",
                  "documentName": "Demo TermPlus 20 Product Guide",
                  "productName": "Demo TermPlus 20",
                  "chunkId": "doc_termplus20_v1:c007",
                  "pageStart": 5,
                  "pageEnd": 5,
                  "section": "Conversion Privilege and Riders > Accelerated Death Benefit",
                  "quote": "Terminal illness with life expectancy of 12 months or less; up to 75% of face amount, maximum $500,000; no upfront charge; actuarial discount applies when exercised.",
                  "claimIds": []
                },
                {
                  "citationId": "cit_029",
                  "documentId": "doc_termplus20_v1",
                  "documentName": "Demo TermPlus 20 Product Guide",
                  "productName": "Demo TermPlus 20",
                  "chunkId": "doc_termplus20_v1:c008",
                  "pageStart": 5,
                  "pageEnd": 5,
                  "section": "Conversion Privilege and Riders > Waiver of Premium",
                  "quote": "Total disability; issue ages 18–55; six-month waiting period.",
                  "claimIds": []
                },
                {
                  "citationId": "cit_030",
                  "documentId": "doc_termplus20_v1",
                  "documentName": "Demo TermPlus 20 Product Guide",
                  "productName": "Demo TermPlus 20",
                  "chunkId": "doc_termplus20_v1:c009",
                  "pageStart": 5,
                  "pageEnd": 5,
                  "section": "Conversion Privilege and Riders > Child Term Rider",
                  "quote": "$5,000 units; maximum $25,000 per child.",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  5
                ],
                "evidenceQuoteCount": 3
              }
            },
            {
              "dimensionId": "riders",
              "productId": "doc_indexflex_ul_v1",
              "availability": "available",
              "format": "textList",
              "sourceKind": "direct",
              "displayValue": "Terminal and chronic illness. · Overloan Protection. · Disability.",
              "rawValue": {
                "riders[0].name": "Accelerated Death Benefit",
                "riders[1].name": "Overloan Protection",
                "riders[2].name": "Waiver of Monthly Deductions"
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_016",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c012",
                  "pageStart": 7,
                  "pageEnd": 7,
                  "section": "Riders > Accelerated Death Benefit",
                  "quote": "Terminal and chronic illness.",
                  "claimIds": []
                },
                {
                  "citationId": "cit_017",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c013",
                  "pageStart": 7,
                  "pageEnd": 7,
                  "section": "Riders > Overloan Protection",
                  "quote": "Overloan Protection.",
                  "claimIds": []
                },
                {
                  "citationId": "cit_018",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c014",
                  "pageStart": 7,
                  "pageEnd": 7,
                  "section": "Riders > Waiver of Monthly Deductions",
                  "quote": "Disability.",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  7
                ],
                "evidenceQuoteCount": 3
              }
            }
          ]
        },
        {
          "dimensionId": "illustration_documentation",
          "labelZh": "illustration / 文件要求",
          "labelEn": "Illustration / documentation",
          "core": false,
          "cells": [
            {
              "dimensionId": "illustration_documentation",
              "productId": "doc_termplus20_v1",
              "availability": "not_provided",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "演示资料未提供 Not provided in demo materials",
              "rawValue": null,
              "derivation": null,
              "citations": [],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 0,
                "anchorPages": [],
                "evidenceQuoteCount": 0
              }
            },
            {
              "dimensionId": "illustration_documentation",
              "productId": "doc_indexflex_ul_v1",
              "availability": "available",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "Guaranteed and non-guaranteed columns must be shown in a personalized illustration.",
              "rawValue": {
                "display": "Guaranteed and non-guaranteed columns must be shown in a personalized illustration."
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_019",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c015",
                  "pageStart": 8,
                  "pageEnd": 8,
                  "section": "Disclosures > Personalized Illustration",
                  "quote": "Guaranteed and non-guaranteed columns must be shown in a personalized illustration.",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  8
                ],
                "evidenceQuoteCount": 1
              }
            }
          ]
        },
        {
          "dimensionId": "important_limitations",
          "labelZh": "重要限制与披露",
          "labelEn": "Important limitations and disclosures",
          "core": false,
          "cells": [
            {
              "dimensionId": "important_limitations",
              "productId": "doc_termplus20_v1",
              "availability": "available",
              "format": "textList",
              "sourceKind": "direct",
              "displayValue": "Suicide within two years results in refund of premiums paid. · Two-year contestability period. · Material misrepresentation may affect coverage.",
              "rawValue": {
                "exclusions[0]": "Suicide within two years results in refund of premiums paid.",
                "exclusions[1]": "Two-year contestability period.",
                "exclusions[2]": "Material misrepresentation may affect coverage."
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_031",
                  "documentId": "doc_termplus20_v1",
                  "documentName": "Demo TermPlus 20 Product Guide",
                  "productName": "Demo TermPlus 20",
                  "chunkId": "doc_termplus20_v1:c010",
                  "pageStart": 6,
                  "pageEnd": 6,
                  "section": "Exclusions, Limitations and Disclosures",
                  "quote": "Suicide within two years results in refund of premiums paid.",
                  "claimIds": []
                },
                {
                  "citationId": "cit_032",
                  "documentId": "doc_termplus20_v1",
                  "documentName": "Demo TermPlus 20 Product Guide",
                  "productName": "Demo TermPlus 20",
                  "chunkId": "doc_termplus20_v1:c010",
                  "pageStart": 6,
                  "pageEnd": 6,
                  "section": "Exclusions, Limitations and Disclosures",
                  "quote": "Two-year contestability period.",
                  "claimIds": []
                },
                {
                  "citationId": "cit_033",
                  "documentId": "doc_termplus20_v1",
                  "documentName": "Demo TermPlus 20 Product Guide",
                  "productName": "Demo TermPlus 20",
                  "chunkId": "doc_termplus20_v1:c010",
                  "pageStart": 6,
                  "pageEnd": 6,
                  "section": "Exclusions, Limitations and Disclosures",
                  "quote": "Material misrepresentation may affect coverage.",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  6
                ],
                "evidenceQuoteCount": 3
              }
            },
            {
              "dimensionId": "important_limitations",
              "productId": "doc_indexflex_ul_v1",
              "availability": "available",
              "format": "textList",
              "sourceKind": "direct",
              "displayValue": "Not a security. · Not a direct investment in an index or stock market. · Policy values depend on policy-specific charges, costs and crediting.",
              "rawValue": {
                "disclosures[0]": "Not a security.",
                "disclosures[1]": "Not a direct investment in an index or stock market.",
                "disclosures[2]": "Policy values depend on policy-specific charges, costs and crediting."
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_020",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c018",
                  "pageStart": 8,
                  "pageEnd": 8,
                  "section": "Disclosures > Important Notes",
                  "quote": "Not a security.",
                  "claimIds": []
                },
                {
                  "citationId": "cit_021",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c018",
                  "pageStart": 8,
                  "pageEnd": 8,
                  "section": "Disclosures > Important Notes",
                  "quote": "Not a direct investment in an index or stock market.",
                  "claimIds": []
                },
                {
                  "citationId": "cit_022",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c018",
                  "pageStart": 8,
                  "pageEnd": 8,
                  "section": "Disclosures > Important Notes",
                  "quote": "Policy values depend on policy-specific charges, costs and crediting.",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  8
                ],
                "evidenceQuoteCount": 3
              }
            }
          ]
        }
      ],
      "observations": [
        {
          "observationId": "obs_001",
          "type": "CASH_VALUE_FEATURE_DIFFERS",
          "textZh": "两款产品在是否积累现金价值这一点上不同,资料对各自的表述见对应引用。",
          "textEn": "The two products differ on whether the policy accumulates cash value; each side's documented wording is cited.",
          "factRefs": [
            {
              "dimensionId": "cash_value",
              "productId": "doc_indexflex_ul_v1"
            },
            {
              "dimensionId": "cash_value",
              "productId": "doc_termplus20_v1"
            }
          ],
          "citationIds": [
            "cit_006",
            "cit_007",
            "cit_027"
          ],
          "severity": "informational"
        },
        {
          "observationId": "obs_002",
          "type": "NON_GUARANTEED_ELEMENTS_PRESENT",
          "textZh": "本次比较涉及非保证要素;这些数值由承保方宣告,可能随时间变化,需持牌经纪人复核。",
          "textEn": "This comparison involves non-guaranteed elements; those values are declared by the carrier, can change over time, and require licensed-agent review.",
          "factRefs": [
            {
              "dimensionId": "non_guaranteed_elements",
              "productId": "doc_indexflex_ul_v1"
            }
          ],
          "citationIds": [
            "cit_012",
            "cit_013",
            "cit_014"
          ],
          "severity": "review_note"
        },
        {
          "observationId": "obs_003",
          "type": "ILLUSTRATION_REQUIRED_DIFFERS",
          "textZh": "只有其中一款产品在资料中说明了个性化 illustration 的要求;另一款资料未提供该说明。",
          "textEn": "Only one of the products documents a personalized-illustration requirement; the other's materials state none.",
          "factRefs": [
            {
              "dimensionId": "illustration_documentation",
              "productId": "doc_indexflex_ul_v1"
            }
          ],
          "citationIds": [
            "cit_019"
          ],
          "severity": "review_note"
        }
      ],
      "missingClientInformation": [
        {
          "field": "desiredCoverageAmount",
          "reasonZh": "尚未确认客户期望的身故保额,无法评估保障缺口。",
          "reasonEn": "The desired death-benefit amount is not stated, so coverage need cannot be evaluated.",
          "relevantTo": [
            "contract_size",
            "premium_structure"
          ],
          "requiredFor": "coverage_need"
        },
        {
          "field": "tobaccoUse",
          "reasonZh": "尚未确认吸烟状况,寿险费率分档取决于此。",
          "reasonEn": "Tobacco use is not stated; life-insurance rate classes depend on it.",
          "relevantTo": [
            "premium_structure",
            "eligibility"
          ],
          "requiredFor": "cost_comparison"
        },
        {
          "field": "underwritingClass",
          "reasonZh": "核保分类由承保方在核保时决定,资料中的样本费率不等于实际费率。",
          "reasonEn": "The underwriting class is set by the carrier at underwriting; sample rates are not actual rates.",
          "relevantTo": [
            "premium_structure"
          ],
          "requiredFor": "cost_comparison"
        },
        {
          "field": "employerGroupCoverage",
          "reasonZh": "尚未确认是否已有团体或雇主提供的保障。",
          "reasonEn": "Whether employer or group coverage already exists has not been confirmed.",
          "relevantTo": [
            "contract_size"
          ],
          "requiredFor": "coverage_need"
        },
        {
          "field": "plannedPremiumDuration",
          "reasonZh": "灵活保费产品需要确认计划缴费年限。",
          "reasonEn": "A flexible-premium product requires the planned premium-paying duration.",
          "relevantTo": [
            "premium_structure"
          ],
          "requiredFor": "illustration"
        },
        {
          "field": "cashValueTimeHorizon",
          "reasonZh": "尚未确认现金价值积累的时间目标。",
          "reasonEn": "The time horizon for cash-value accumulation is not stated.",
          "relevantTo": [
            "cash_value"
          ],
          "requiredFor": "illustration"
        },
        {
          "field": "withdrawalExpectations",
          "reasonZh": "尚未确认取用或提取资金的预期。",
          "reasonEn": "Expectations about access to or withdrawal of funds are not stated.",
          "relevantTo": [
            "cash_value",
            "surrender_liquidity"
          ],
          "requiredFor": "illustration"
        },
        {
          "field": "personalizedIllustration",
          "reasonZh": "资料未提供个性化 illustration;保证与非保证栏必须由承保方出具。",
          "reasonEn": "No personalized illustration is available; guaranteed and non-guaranteed columns must come from the carrier.",
          "relevantTo": [
            "illustration_documentation",
            "non_guaranteed_elements"
          ],
          "requiredFor": "illustration"
        }
      ],
      "comparisonStatus": "complete",
      "reviewReasons": [
        "CLIENT_FACING_DRAFT",
        "NON_GUARANTEED_ELEMENTS",
        "ILLUSTRATION_REQUIRED",
        "SURRENDER_CHARGE_EXPOSURE"
      ],
      "disclaimerZh": "本比较为内部工作草稿,仅供持牌保险经纪人审阅。所有产品与数据均为虚构演示资料。本文不构成最终推荐、suitability 判断、报价、保单 illustration,也不构成法律或税务意见。",
      "disclaimerEn": "This comparison is an internal working draft for licensed-agent review. All products and data are fictional demonstration materials. It is not a final recommendation, a suitability determination, a quote, a policy illustration, or legal or tax advice.",
      "meta": {
        "comparisonEngineVersion": 1,
        "factRegistryVersion": 1
      }
    },
    "snapshotSha256": "203654bfdc8f0458628c428e30292e48e5937a386bf7288dd00c777ff905c455",
    "workflowDecision": "allow_internal_draft",
    "requiredApprovalLevel": "enhanced_review",
    "reviewReasons": [
      "CLIENT_FACING_DRAFT",
      "NON_GUARANTEED_ELEMENTS",
      "ILLUSTRATION_REQUIRED",
      "SURRENDER_CHARGE_EXPOSURE"
    ],
    "checklist": [
      {
        "key": "desiredCoverageAmount",
        "labelZh": "期望身故保额",
        "labelEn": "Desired death benefit",
        "sourceKind": "missing_client_info"
      },
      {
        "key": "tobaccoUse",
        "labelZh": "吸烟状况",
        "labelEn": "Tobacco use",
        "sourceKind": "missing_client_info"
      },
      {
        "key": "underwritingClass",
        "labelZh": "核保分类",
        "labelEn": "Underwriting class",
        "sourceKind": "missing_client_info"
      },
      {
        "key": "employerGroupCoverage",
        "labelZh": "团体/雇主保障",
        "labelEn": "Employer or group coverage",
        "sourceKind": "missing_client_info"
      },
      {
        "key": "plannedPremiumDuration",
        "labelZh": "计划缴费年限",
        "labelEn": "Planned premium duration",
        "sourceKind": "missing_client_info"
      },
      {
        "key": "cashValueTimeHorizon",
        "labelZh": "现金价值时间目标",
        "labelEn": "Cash-value time horizon",
        "sourceKind": "missing_client_info"
      },
      {
        "key": "withdrawalExpectations",
        "labelZh": "取用预期",
        "labelEn": "Withdrawal expectations",
        "sourceKind": "missing_client_info"
      },
      {
        "key": "personalizedIllustration",
        "labelZh": "个性化 illustration",
        "labelEn": "Personalized illustration",
        "sourceKind": "missing_client_info"
      }
    ],
    "reviewState": "pending_review",
    "reviewer": null,
    "decisionNote": null,
    "revisionInstructions": null,
    "createdAt": "2026-08-01T10:00:00+00:00",
    "updatedAt": "2026-08-01T10:00:00+00:00",
    "citationUrls": {
      "cit_023": "/documents/demo-termplus-20.pdf#page=2",
      "cit_001": "/documents/demo-indexflex-ul.pdf#page=2",
      "cit_024": "/documents/demo-termplus-20.pdf#page=2",
      "cit_002": "/documents/demo-indexflex-ul.pdf#page=3",
      "cit_025": "/documents/demo-termplus-20.pdf#page=2",
      "cit_003": "/documents/demo-indexflex-ul.pdf#page=2",
      "cit_026": "/documents/demo-termplus-20.pdf#page=4",
      "cit_004": "/documents/demo-indexflex-ul.pdf#page=3",
      "cit_005": "/documents/demo-indexflex-ul.pdf#page=3",
      "cit_027": "/documents/demo-termplus-20.pdf#page=2",
      "cit_006": "/documents/demo-indexflex-ul.pdf#page=5",
      "cit_007": "/documents/demo-indexflex-ul.pdf#page=6",
      "cit_008": "/documents/demo-indexflex-ul.pdf#page=5",
      "cit_009": "/documents/demo-indexflex-ul.pdf#page=5",
      "cit_010": "/documents/demo-indexflex-ul.pdf#page=5",
      "cit_011": "/documents/demo-indexflex-ul.pdf#page=4",
      "cit_012": "/documents/demo-indexflex-ul.pdf#page=5",
      "cit_013": "/documents/demo-indexflex-ul.pdf#page=5",
      "cit_014": "/documents/demo-indexflex-ul.pdf#page=5",
      "cit_015": "/documents/demo-indexflex-ul.pdf#page=6",
      "cit_028": "/documents/demo-termplus-20.pdf#page=5",
      "cit_029": "/documents/demo-termplus-20.pdf#page=5",
      "cit_030": "/documents/demo-termplus-20.pdf#page=5",
      "cit_016": "/documents/demo-indexflex-ul.pdf#page=7",
      "cit_017": "/documents/demo-indexflex-ul.pdf#page=7",
      "cit_018": "/documents/demo-indexflex-ul.pdf#page=7",
      "cit_019": "/documents/demo-indexflex-ul.pdf#page=8",
      "cit_031": "/documents/demo-termplus-20.pdf#page=6",
      "cit_032": "/documents/demo-termplus-20.pdf#page=6",
      "cit_033": "/documents/demo-termplus-20.pdf#page=6",
      "cit_020": "/documents/demo-indexflex-ul.pdf#page=8",
      "cit_021": "/documents/demo-indexflex-ul.pdf#page=8",
      "cit_022": "/documents/demo-indexflex-ul.pdf#page=8"
    },
    "events": [
      {
        "eventId": "evt_fixture_created",
        "reviewId": "rev_fixture_case_a",
        "eventType": "REVIEW_CREATED",
        "actor": "Demo Reviewer",
        "payload": {},
        "occurredAt": "2026-08-01T10:00:00+00:00"
      }
    ]
  },
  "noClientPending": {
    "reviewId": "rev_fixture_no_client",
    "sourceType": "comparison_draft",
    "snapshot": {
      "schemaVersion": 1,
      "comparisonId": "cmp_fixture",
      "productA": {
        "documentId": "doc_termplus20_v1",
        "documentName": "Demo TermPlus 20 Product Guide",
        "productName": "Demo TermPlus 20",
        "productCategory": "term_life"
      },
      "productB": {
        "documentId": "doc_indexflex_ul_v1",
        "documentName": "Demo IndexFlex UL Product Guide",
        "productName": "Demo IndexFlex UL",
        "productCategory": "indexed_universal_life"
      },
      "clientContext": null,
      "dimensions": [
        {
          "dimensionId": "product_type",
          "labelZh": "产品类型",
          "labelEn": "Product type",
          "core": true,
          "cells": [
            {
              "dimensionId": "product_type",
              "productId": "doc_termplus20_v1",
              "availability": "available",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "20-Year Level Term Life Insurance",
              "rawValue": "20-Year Level Term Life Insurance",
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_023",
                  "documentId": "doc_termplus20_v1",
                  "documentName": "Demo TermPlus 20 Product Guide",
                  "productName": "Demo TermPlus 20",
                  "chunkId": "doc_termplus20_v1:c001",
                  "pageStart": 2,
                  "pageEnd": 2,
                  "section": "At a Glance",
                  "quote": "20-Year Level Term Life Insurance",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  2
                ],
                "evidenceQuoteCount": 1
              }
            },
            {
              "dimensionId": "product_type",
              "productId": "doc_indexflex_ul_v1",
              "availability": "available",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "Flexible-Premium Indexed Universal Life",
              "rawValue": "Flexible-Premium Indexed Universal Life",
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_001",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c001",
                  "pageStart": 2,
                  "pageEnd": 2,
                  "section": "Overview and Death Benefit Options",
                  "quote": "Flexible-Premium Indexed Universal Life",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  2
                ],
                "evidenceQuoteCount": 1
              }
            }
          ]
        },
        {
          "dimensionId": "eligibility",
          "labelZh": "投保年龄",
          "labelEn": "Issue ages",
          "core": false,
          "cells": [
            {
              "dimensionId": "eligibility",
              "productId": "doc_termplus20_v1",
              "availability": "available",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "18–60",
              "rawValue": {
                "min": 18,
                "max": 60,
                "display": "18–60"
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_024",
                  "documentId": "doc_termplus20_v1",
                  "documentName": "Demo TermPlus 20 Product Guide",
                  "productName": "Demo TermPlus 20",
                  "chunkId": "doc_termplus20_v1:c001",
                  "pageStart": 2,
                  "pageEnd": 2,
                  "section": "At a Glance",
                  "quote": "18–60",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  2
                ],
                "evidenceQuoteCount": 1
              }
            },
            {
              "dimensionId": "eligibility",
              "productId": "doc_indexflex_ul_v1",
              "availability": "available",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "0–75",
              "rawValue": {
                "min": 0,
                "max": 75,
                "display": "0–75"
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_002",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c003",
                  "pageStart": 3,
                  "pageEnd": 3,
                  "section": "Eligibility, Premium Flexibility and Five-Year No-Lapse Guarantee",
                  "quote": "0–75",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  3
                ],
                "evidenceQuoteCount": 1
              }
            }
          ]
        },
        {
          "dimensionId": "contract_size",
          "labelZh": "保额 / 合同金额",
          "labelEn": "Coverage amount / contract size",
          "core": false,
          "cells": [
            {
              "dimensionId": "contract_size",
              "productId": "doc_termplus20_v1",
              "availability": "available",
              "format": "currency",
              "sourceKind": "direct",
              "displayValue": "身故保额 Face amount: $100,000–$2,000,000",
              "rawValue": {
                "min": 100000,
                "max": 2000000,
                "display": "$100,000–$2,000,000"
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_025",
                  "documentId": "doc_termplus20_v1",
                  "documentName": "Demo TermPlus 20 Product Guide",
                  "productName": "Demo TermPlus 20",
                  "chunkId": "doc_termplus20_v1:c001",
                  "pageStart": 2,
                  "pageEnd": 2,
                  "section": "At a Glance",
                  "quote": "$100,000–$2,000,000",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  2
                ],
                "evidenceQuoteCount": 1
              }
            },
            {
              "dimensionId": "contract_size",
              "productId": "doc_indexflex_ul_v1",
              "availability": "available",
              "format": "currency",
              "sourceKind": "direct",
              "displayValue": "最低身故保额 Minimum face amount: $100,000",
              "rawValue": {
                "amount": 100000,
                "display": "$100,000"
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_003",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c001",
                  "pageStart": 2,
                  "pageEnd": 2,
                  "section": "Overview and Death Benefit Options",
                  "quote": "$100,000",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  2
                ],
                "evidenceQuoteCount": 1
              }
            }
          ]
        },
        {
          "dimensionId": "coverage_duration",
          "labelZh": "保障期限",
          "labelEn": "Coverage duration",
          "core": true,
          "cells": [
            {
              "dimensionId": "coverage_duration",
              "productId": "doc_termplus20_v1",
              "availability": "available",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "Level and guaranteed for 20 years. After the level period, coverage is annually renewable at attained-age rates that increase each year; see policy schedule. Coverage may continue to age 95.",
              "rawValue": {
                "levelYears": 20,
                "coverageMaxAge": 95,
                "display": "Level and guaranteed for 20 years. After the level period, coverage is annually renewable at attained-age rates that increase each year; see policy schedule. Coverage may continue to age 95."
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_026",
                  "documentId": "doc_termplus20_v1",
                  "documentName": "Demo TermPlus 20 Product Guide",
                  "productName": "Demo TermPlus 20",
                  "chunkId": "doc_termplus20_v1:c004",
                  "pageStart": 4,
                  "pageEnd": 4,
                  "section": "Premium Structure",
                  "quote": "Level and guaranteed for 20 years. After the level period, coverage is annually renewable at attained-age rates that increase each year; see policy schedule. Coverage may continue to age 95.",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  4
                ],
                "evidenceQuoteCount": 1
              }
            },
            {
              "dimensionId": "coverage_duration",
              "productId": "doc_indexflex_ul_v1",
              "availability": "available",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "无失效保证 No-lapse guarantee: Five-Year No-Lapse Guarantee if the required minimum monthly premium is paid.",
              "rawValue": {
                "years": 5,
                "display": "Five-Year No-Lapse Guarantee if the required minimum monthly premium is paid."
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_004",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c004",
                  "pageStart": 3,
                  "pageEnd": 3,
                  "section": "Eligibility, Premium Flexibility and Five-Year No-Lapse Guarantee > Five-Year No-Lapse Guarantee",
                  "quote": "Five-Year No-Lapse Guarantee if the required minimum monthly premium is paid.",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  3
                ],
                "evidenceQuoteCount": 1
              }
            }
          ]
        },
        {
          "dimensionId": "premium_structure",
          "labelZh": "保费 / 缴费结构",
          "labelEn": "Premium / contribution structure",
          "core": true,
          "cells": [
            {
              "dimensionId": "premium_structure",
              "productId": "doc_termplus20_v1",
              "availability": "available",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "Level and guaranteed for 20 years. After the level period, coverage is annually renewable at attained-age rates that increase each year; see policy schedule. Coverage may continue to age 95.",
              "rawValue": {
                "levelYears": 20,
                "coverageMaxAge": 95,
                "display": "Level and guaranteed for 20 years. After the level period, coverage is annually renewable at attained-age rates that increase each year; see policy schedule. Coverage may continue to age 95."
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_026",
                  "documentId": "doc_termplus20_v1",
                  "documentName": "Demo TermPlus 20 Product Guide",
                  "productName": "Demo TermPlus 20",
                  "chunkId": "doc_termplus20_v1:c004",
                  "pageStart": 4,
                  "pageEnd": 4,
                  "section": "Premium Structure",
                  "quote": "Level and guaranteed for 20 years. After the level period, coverage is annually renewable at attained-age rates that increase each year; see policy schedule. Coverage may continue to age 95.",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  4
                ],
                "evidenceQuoteCount": 1
              }
            },
            {
              "dimensionId": "premium_structure",
              "productId": "doc_indexflex_ul_v1",
              "availability": "available",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "Flexible, subject to policy minimums and tax-law maximums.",
              "rawValue": {
                "display": "Flexible, subject to policy minimums and tax-law maximums."
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_005",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c003",
                  "pageStart": 3,
                  "pageEnd": 3,
                  "section": "Eligibility, Premium Flexibility and Five-Year No-Lapse Guarantee",
                  "quote": "Flexible, subject to policy minimums and tax-law maximums.",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  3
                ],
                "evidenceQuoteCount": 1
              }
            }
          ]
        },
        {
          "dimensionId": "cash_value",
          "labelZh": "现金价值 / 账户价值",
          "labelEn": "Cash value / account value",
          "core": true,
          "cells": [
            {
              "dimensionId": "cash_value",
              "productId": "doc_termplus20_v1",
              "availability": "available",
              "format": "boolean",
              "sourceKind": "direct",
              "displayValue": "None. The policy does not accumulate cash value.",
              "rawValue": false,
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_027",
                  "documentId": "doc_termplus20_v1",
                  "documentName": "Demo TermPlus 20 Product Guide",
                  "productName": "Demo TermPlus 20",
                  "chunkId": "doc_termplus20_v1:c001",
                  "pageStart": 2,
                  "pageEnd": 2,
                  "section": "At a Glance",
                  "quote": "None. The policy does not accumulate cash value.",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  2
                ],
                "evidenceQuoteCount": 1
              }
            },
            {
              "dimensionId": "cash_value",
              "productId": "doc_indexflex_ul_v1",
              "availability": "available",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "指数账户 Indexed account: Annual point-to-point method linked to the Index, excluding dividends. · 提取 Withdrawals: Minimum partial withdrawal $500; withdrawals reduce death benefit and cash value.",
              "rawValue": {
                "indexedAccount": {
                  "display": "Annual point-to-point method linked to the Index, excluding dividends."
                },
                "withdrawals": {
                  "display": "Minimum partial withdrawal $500; withdrawals reduce death benefit and cash value."
                }
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_006",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c007",
                  "pageStart": 5,
                  "pageEnd": 5,
                  "section": "Indexed Account Mechanics",
                  "quote": "Annual point-to-point method linked to the Index, excluding dividends.",
                  "claimIds": []
                },
                {
                  "citationId": "cit_007",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c011",
                  "pageStart": 6,
                  "pageEnd": 6,
                  "section": "Surrender Charge Schedule, Loans and Withdrawals > Withdrawals",
                  "quote": "Minimum partial withdrawal $500; withdrawals reduce death benefit and cash value.",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  5,
                  6
                ],
                "evidenceQuoteCount": 2
              }
            }
          ]
        },
        {
          "dimensionId": "guaranteed_elements",
          "labelZh": "保证要素",
          "labelEn": "Guaranteed elements",
          "core": true,
          "cells": [
            {
              "dimensionId": "guaranteed_elements",
              "productId": "doc_termplus20_v1",
              "availability": "available",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "保费保证 Premium guarantee: Level and guaranteed for 20 years. After the level period, coverage is annually renewable at attained-age rates that increase each year; see policy schedule. Coverage may continue to age 95.",
              "rawValue": 20,
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_026",
                  "documentId": "doc_termplus20_v1",
                  "documentName": "Demo TermPlus 20 Product Guide",
                  "productName": "Demo TermPlus 20",
                  "chunkId": "doc_termplus20_v1:c004",
                  "pageStart": 4,
                  "pageEnd": 4,
                  "section": "Premium Structure",
                  "quote": "Level and guaranteed for 20 years. After the level period, coverage is annually renewable at attained-age rates that increase each year; see policy schedule. Coverage may continue to age 95.",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  4
                ],
                "evidenceQuoteCount": 1
              }
            },
            {
              "dimensionId": "guaranteed_elements",
              "productId": "doc_indexflex_ul_v1",
              "availability": "available",
              "format": "percent",
              "sourceKind": "direct",
              "displayValue": "指数账户保证下限 Indexed account floor: 0.00% · 保证最低 cap Guaranteed minimum cap: 3.00% · 保证最低参与率 Guaranteed minimum participation rate: 50% · 固定账户保证最低利率 Fixed account guaranteed minimum rate: 2.00%",
              "rawValue": {
                "floor.rate": 0,
                "cap.guaranteedMinimumRate": 0.03,
                "participation.guaranteedMinimumRate": 0.5,
                "fixedAccount.guaranteedMinimumRate": 0.02
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_008",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c007",
                  "pageStart": 5,
                  "pageEnd": 5,
                  "section": "Indexed Account Mechanics",
                  "quote": "0.00%",
                  "claimIds": []
                },
                {
                  "citationId": "cit_009",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c007",
                  "pageStart": 5,
                  "pageEnd": 5,
                  "section": "Indexed Account Mechanics",
                  "quote": "3.00%",
                  "claimIds": []
                },
                {
                  "citationId": "cit_010",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c007",
                  "pageStart": 5,
                  "pageEnd": 5,
                  "section": "Indexed Account Mechanics",
                  "quote": "50%",
                  "claimIds": []
                },
                {
                  "citationId": "cit_011",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c005",
                  "pageStart": 4,
                  "pageEnd": 4,
                  "section": "Fixed Account and Charges > Fixed Account",
                  "quote": "2.00%",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  4,
                  5
                ],
                "evidenceQuoteCount": 4
              }
            }
          ]
        },
        {
          "dimensionId": "non_guaranteed_elements",
          "labelZh": "非保证要素",
          "labelEn": "Non-guaranteed elements",
          "core": true,
          "cells": [
            {
              "dimensionId": "non_guaranteed_elements",
              "productId": "doc_termplus20_v1",
              "availability": "not_applicable",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "不适用 Not applicable",
              "rawValue": null,
              "derivation": null,
              "citations": [],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 0,
                "anchorPages": [],
                "evidenceQuoteCount": 0
              }
            },
            {
              "dimensionId": "non_guaranteed_elements",
              "productId": "doc_indexflex_ul_v1",
              "availability": "available",
              "format": "percent",
              "sourceKind": "direct",
              "displayValue": "当前 cap Current cap: 9.50% · 当前参与率 Current participation rate: 100% · 费率变更 Rate changes: Current caps and participation rates are declared by the carrier and may change for future segments.",
              "rawValue": {
                "cap.currentRate": 0.095,
                "participation.currentRate": 1,
                "rateChanges": {
                  "display": "Current caps and participation rates are declared by the carrier and may change for future segments."
                }
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_012",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c007",
                  "pageStart": 5,
                  "pageEnd": 5,
                  "section": "Indexed Account Mechanics",
                  "quote": "9.50%",
                  "claimIds": []
                },
                {
                  "citationId": "cit_013",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c007",
                  "pageStart": 5,
                  "pageEnd": 5,
                  "section": "Indexed Account Mechanics",
                  "quote": "100%",
                  "claimIds": []
                },
                {
                  "citationId": "cit_014",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c007",
                  "pageStart": 5,
                  "pageEnd": 5,
                  "section": "Indexed Account Mechanics",
                  "quote": "Current caps and participation rates are declared by the carrier and may change for future segments.",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  5
                ],
                "evidenceQuoteCount": 3
              }
            }
          ]
        },
        {
          "dimensionId": "crediting_mechanics",
          "labelZh": "计息 / 利率机制",
          "labelEn": "Crediting / rate mechanics",
          "core": false,
          "cells": [
            {
              "dimensionId": "crediting_mechanics",
              "productId": "doc_termplus20_v1",
              "availability": "not_applicable",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "不适用 Not applicable",
              "rawValue": null,
              "derivation": null,
              "citations": [],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 0,
                "anchorPages": [],
                "evidenceQuoteCount": 0
              }
            },
            {
              "dimensionId": "crediting_mechanics",
              "productId": "doc_indexflex_ul_v1",
              "availability": "available",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "Annual point-to-point method linked to the Index, excluding dividends.",
              "rawValue": {
                "display": "Annual point-to-point method linked to the Index, excluding dividends."
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_006",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c007",
                  "pageStart": 5,
                  "pageEnd": 5,
                  "section": "Indexed Account Mechanics",
                  "quote": "Annual point-to-point method linked to the Index, excluding dividends.",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  5
                ],
                "evidenceQuoteCount": 1
              }
            }
          ]
        },
        {
          "dimensionId": "surrender_liquidity",
          "labelZh": "退保费用与流动性",
          "labelEn": "Surrender charges and liquidity",
          "core": true,
          "cells": [
            {
              "dimensionId": "surrender_liquidity",
              "productId": "doc_termplus20_v1",
              "availability": "not_applicable",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "不适用 Not applicable",
              "rawValue": null,
              "derivation": null,
              "citations": [],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 0,
                "anchorPages": [],
                "evidenceQuoteCount": 0
              }
            },
            {
              "dimensionId": "surrender_liquidity",
              "productId": "doc_indexflex_ul_v1",
              "availability": "available",
              "format": "years",
              "sourceKind": "derived",
              "displayValue": "退保费用表在第 1–10 个合同年收取费用,第 11 年起为 0。 The surrender-charge schedule applies charges through contract year 10; from year 11 the charge is 0. · 提取 Withdrawals: Minimum partial withdrawal $500; withdrawals reduce death benefit and cash value.",
              "rawValue": 10,
              "derivation": {
                "ruleId": "LAST_NONZERO_SURRENDER_CHARGE_YEAR",
                "inputFactRefs": [
                  "surrenderChargeSchedule.chargesByYear",
                  "surrenderChargeSchedule.basis"
                ],
                "reconciledWithPath": "surrenderCharge.years"
              },
              "citations": [
                {
                  "citationId": "cit_015",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c009",
                  "pageStart": 6,
                  "pageEnd": 6,
                  "section": "Surrender Charge Schedule, Loans and Withdrawals > Surrender Charge Schedule (per $1,000 of face amount)",
                  "quote": "Surrender Charge Schedule (per $1,000 of face amount)",
                  "claimIds": []
                },
                {
                  "citationId": "cit_007",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c011",
                  "pageStart": 6,
                  "pageEnd": 6,
                  "section": "Surrender Charge Schedule, Loans and Withdrawals > Withdrawals",
                  "quote": "Minimum partial withdrawal $500; withdrawals reduce death benefit and cash value.",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  6
                ],
                "evidenceQuoteCount": 2
              }
            }
          ]
        },
        {
          "dimensionId": "riders",
          "labelZh": "附加险 / 可选利益",
          "labelEn": "Riders / optional benefits",
          "core": true,
          "cells": [
            {
              "dimensionId": "riders",
              "productId": "doc_termplus20_v1",
              "availability": "available",
              "format": "textList",
              "sourceKind": "direct",
              "displayValue": "Terminal illness with life expectancy of 12 months or less; up to 75% of face amount, maximum $500,000; no upfront charge; actuarial discount applies when exercised. · Total disability; issue ages 18–55; six-month waiting period. · $5,000 units; maximum $25,000 per child.",
              "rawValue": {
                "riders[0].name": "Accelerated Death Benefit",
                "riders[1].name": "Waiver of Premium",
                "riders[2].name": "Child Term Rider"
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_028",
                  "documentId": "doc_termplus20_v1",
                  "documentName": "Demo TermPlus 20 Product Guide",
                  "productName": "Demo TermPlus 20",
                  "chunkId": "doc_termplus20_v1:c007",
                  "pageStart": 5,
                  "pageEnd": 5,
                  "section": "Conversion Privilege and Riders > Accelerated Death Benefit",
                  "quote": "Terminal illness with life expectancy of 12 months or less; up to 75% of face amount, maximum $500,000; no upfront charge; actuarial discount applies when exercised.",
                  "claimIds": []
                },
                {
                  "citationId": "cit_029",
                  "documentId": "doc_termplus20_v1",
                  "documentName": "Demo TermPlus 20 Product Guide",
                  "productName": "Demo TermPlus 20",
                  "chunkId": "doc_termplus20_v1:c008",
                  "pageStart": 5,
                  "pageEnd": 5,
                  "section": "Conversion Privilege and Riders > Waiver of Premium",
                  "quote": "Total disability; issue ages 18–55; six-month waiting period.",
                  "claimIds": []
                },
                {
                  "citationId": "cit_030",
                  "documentId": "doc_termplus20_v1",
                  "documentName": "Demo TermPlus 20 Product Guide",
                  "productName": "Demo TermPlus 20",
                  "chunkId": "doc_termplus20_v1:c009",
                  "pageStart": 5,
                  "pageEnd": 5,
                  "section": "Conversion Privilege and Riders > Child Term Rider",
                  "quote": "$5,000 units; maximum $25,000 per child.",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  5
                ],
                "evidenceQuoteCount": 3
              }
            },
            {
              "dimensionId": "riders",
              "productId": "doc_indexflex_ul_v1",
              "availability": "available",
              "format": "textList",
              "sourceKind": "direct",
              "displayValue": "Terminal and chronic illness. · Overloan Protection. · Disability.",
              "rawValue": {
                "riders[0].name": "Accelerated Death Benefit",
                "riders[1].name": "Overloan Protection",
                "riders[2].name": "Waiver of Monthly Deductions"
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_016",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c012",
                  "pageStart": 7,
                  "pageEnd": 7,
                  "section": "Riders > Accelerated Death Benefit",
                  "quote": "Terminal and chronic illness.",
                  "claimIds": []
                },
                {
                  "citationId": "cit_017",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c013",
                  "pageStart": 7,
                  "pageEnd": 7,
                  "section": "Riders > Overloan Protection",
                  "quote": "Overloan Protection.",
                  "claimIds": []
                },
                {
                  "citationId": "cit_018",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c014",
                  "pageStart": 7,
                  "pageEnd": 7,
                  "section": "Riders > Waiver of Monthly Deductions",
                  "quote": "Disability.",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  7
                ],
                "evidenceQuoteCount": 3
              }
            }
          ]
        },
        {
          "dimensionId": "illustration_documentation",
          "labelZh": "illustration / 文件要求",
          "labelEn": "Illustration / documentation",
          "core": false,
          "cells": [
            {
              "dimensionId": "illustration_documentation",
              "productId": "doc_termplus20_v1",
              "availability": "not_provided",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "演示资料未提供 Not provided in demo materials",
              "rawValue": null,
              "derivation": null,
              "citations": [],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 0,
                "anchorPages": [],
                "evidenceQuoteCount": 0
              }
            },
            {
              "dimensionId": "illustration_documentation",
              "productId": "doc_indexflex_ul_v1",
              "availability": "available",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "Guaranteed and non-guaranteed columns must be shown in a personalized illustration.",
              "rawValue": {
                "display": "Guaranteed and non-guaranteed columns must be shown in a personalized illustration."
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_019",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c015",
                  "pageStart": 8,
                  "pageEnd": 8,
                  "section": "Disclosures > Personalized Illustration",
                  "quote": "Guaranteed and non-guaranteed columns must be shown in a personalized illustration.",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  8
                ],
                "evidenceQuoteCount": 1
              }
            }
          ]
        },
        {
          "dimensionId": "important_limitations",
          "labelZh": "重要限制与披露",
          "labelEn": "Important limitations and disclosures",
          "core": false,
          "cells": [
            {
              "dimensionId": "important_limitations",
              "productId": "doc_termplus20_v1",
              "availability": "available",
              "format": "textList",
              "sourceKind": "direct",
              "displayValue": "Suicide within two years results in refund of premiums paid. · Two-year contestability period. · Material misrepresentation may affect coverage.",
              "rawValue": {
                "exclusions[0]": "Suicide within two years results in refund of premiums paid.",
                "exclusions[1]": "Two-year contestability period.",
                "exclusions[2]": "Material misrepresentation may affect coverage."
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_031",
                  "documentId": "doc_termplus20_v1",
                  "documentName": "Demo TermPlus 20 Product Guide",
                  "productName": "Demo TermPlus 20",
                  "chunkId": "doc_termplus20_v1:c010",
                  "pageStart": 6,
                  "pageEnd": 6,
                  "section": "Exclusions, Limitations and Disclosures",
                  "quote": "Suicide within two years results in refund of premiums paid.",
                  "claimIds": []
                },
                {
                  "citationId": "cit_032",
                  "documentId": "doc_termplus20_v1",
                  "documentName": "Demo TermPlus 20 Product Guide",
                  "productName": "Demo TermPlus 20",
                  "chunkId": "doc_termplus20_v1:c010",
                  "pageStart": 6,
                  "pageEnd": 6,
                  "section": "Exclusions, Limitations and Disclosures",
                  "quote": "Two-year contestability period.",
                  "claimIds": []
                },
                {
                  "citationId": "cit_033",
                  "documentId": "doc_termplus20_v1",
                  "documentName": "Demo TermPlus 20 Product Guide",
                  "productName": "Demo TermPlus 20",
                  "chunkId": "doc_termplus20_v1:c010",
                  "pageStart": 6,
                  "pageEnd": 6,
                  "section": "Exclusions, Limitations and Disclosures",
                  "quote": "Material misrepresentation may affect coverage.",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  6
                ],
                "evidenceQuoteCount": 3
              }
            },
            {
              "dimensionId": "important_limitations",
              "productId": "doc_indexflex_ul_v1",
              "availability": "available",
              "format": "textList",
              "sourceKind": "direct",
              "displayValue": "Not a security. · Not a direct investment in an index or stock market. · Policy values depend on policy-specific charges, costs and crediting.",
              "rawValue": {
                "disclosures[0]": "Not a security.",
                "disclosures[1]": "Not a direct investment in an index or stock market.",
                "disclosures[2]": "Policy values depend on policy-specific charges, costs and crediting."
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_020",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c018",
                  "pageStart": 8,
                  "pageEnd": 8,
                  "section": "Disclosures > Important Notes",
                  "quote": "Not a security.",
                  "claimIds": []
                },
                {
                  "citationId": "cit_021",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c018",
                  "pageStart": 8,
                  "pageEnd": 8,
                  "section": "Disclosures > Important Notes",
                  "quote": "Not a direct investment in an index or stock market.",
                  "claimIds": []
                },
                {
                  "citationId": "cit_022",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c018",
                  "pageStart": 8,
                  "pageEnd": 8,
                  "section": "Disclosures > Important Notes",
                  "quote": "Policy values depend on policy-specific charges, costs and crediting.",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  8
                ],
                "evidenceQuoteCount": 3
              }
            }
          ]
        }
      ],
      "observations": [
        {
          "observationId": "obs_001",
          "type": "CASH_VALUE_FEATURE_DIFFERS",
          "textZh": "两款产品在是否积累现金价值这一点上不同,资料对各自的表述见对应引用。",
          "textEn": "The two products differ on whether the policy accumulates cash value; each side's documented wording is cited.",
          "factRefs": [
            {
              "dimensionId": "cash_value",
              "productId": "doc_indexflex_ul_v1"
            },
            {
              "dimensionId": "cash_value",
              "productId": "doc_termplus20_v1"
            }
          ],
          "citationIds": [
            "cit_006",
            "cit_007",
            "cit_027"
          ],
          "severity": "informational"
        },
        {
          "observationId": "obs_002",
          "type": "NON_GUARANTEED_ELEMENTS_PRESENT",
          "textZh": "本次比较涉及非保证要素;这些数值由承保方宣告,可能随时间变化,需持牌经纪人复核。",
          "textEn": "This comparison involves non-guaranteed elements; those values are declared by the carrier, can change over time, and require licensed-agent review.",
          "factRefs": [
            {
              "dimensionId": "non_guaranteed_elements",
              "productId": "doc_indexflex_ul_v1"
            }
          ],
          "citationIds": [
            "cit_012",
            "cit_013",
            "cit_014"
          ],
          "severity": "review_note"
        },
        {
          "observationId": "obs_003",
          "type": "ILLUSTRATION_REQUIRED_DIFFERS",
          "textZh": "只有其中一款产品在资料中说明了个性化 illustration 的要求;另一款资料未提供该说明。",
          "textEn": "Only one of the products documents a personalized-illustration requirement; the other's materials state none.",
          "factRefs": [
            {
              "dimensionId": "illustration_documentation",
              "productId": "doc_indexflex_ul_v1"
            }
          ],
          "citationIds": [
            "cit_019"
          ],
          "severity": "review_note"
        }
      ],
      "missingClientInformation": [],
      "comparisonStatus": "complete",
      "reviewReasons": [
        "CLIENT_FACING_DRAFT",
        "NON_GUARANTEED_ELEMENTS",
        "ILLUSTRATION_REQUIRED",
        "SURRENDER_CHARGE_EXPOSURE"
      ],
      "disclaimerZh": "本比较为内部工作草稿,仅供持牌保险经纪人审阅。所有产品与数据均为虚构演示资料。本文不构成最终推荐、suitability 判断、报价、保单 illustration,也不构成法律或税务意见。",
      "disclaimerEn": "This comparison is an internal working draft for licensed-agent review. All products and data are fictional demonstration materials. It is not a final recommendation, a suitability determination, a quote, a policy illustration, or legal or tax advice.",
      "meta": {
        "comparisonEngineVersion": 1,
        "factRegistryVersion": 1
      }
    },
    "snapshotSha256": "072fc0af8420b86043400667370e75790a4c759d638f4def35f5fd437ba168b6",
    "workflowDecision": "allow_internal_draft",
    "requiredApprovalLevel": "enhanced_review",
    "reviewReasons": [
      "CLIENT_FACING_DRAFT",
      "NON_GUARANTEED_ELEMENTS",
      "ILLUSTRATION_REQUIRED",
      "SURRENDER_CHARGE_EXPOSURE"
    ],
    "checklist": [],
    "reviewState": "pending_review",
    "reviewer": null,
    "decisionNote": null,
    "revisionInstructions": null,
    "createdAt": "2026-08-01T10:00:00+00:00",
    "updatedAt": "2026-08-01T10:00:00+00:00",
    "citationUrls": {
      "cit_023": "/documents/demo-termplus-20.pdf#page=2",
      "cit_001": "/documents/demo-indexflex-ul.pdf#page=2",
      "cit_024": "/documents/demo-termplus-20.pdf#page=2",
      "cit_002": "/documents/demo-indexflex-ul.pdf#page=3",
      "cit_025": "/documents/demo-termplus-20.pdf#page=2",
      "cit_003": "/documents/demo-indexflex-ul.pdf#page=2",
      "cit_026": "/documents/demo-termplus-20.pdf#page=4",
      "cit_004": "/documents/demo-indexflex-ul.pdf#page=3",
      "cit_005": "/documents/demo-indexflex-ul.pdf#page=3",
      "cit_027": "/documents/demo-termplus-20.pdf#page=2",
      "cit_006": "/documents/demo-indexflex-ul.pdf#page=5",
      "cit_007": "/documents/demo-indexflex-ul.pdf#page=6",
      "cit_008": "/documents/demo-indexflex-ul.pdf#page=5",
      "cit_009": "/documents/demo-indexflex-ul.pdf#page=5",
      "cit_010": "/documents/demo-indexflex-ul.pdf#page=5",
      "cit_011": "/documents/demo-indexflex-ul.pdf#page=4",
      "cit_012": "/documents/demo-indexflex-ul.pdf#page=5",
      "cit_013": "/documents/demo-indexflex-ul.pdf#page=5",
      "cit_014": "/documents/demo-indexflex-ul.pdf#page=5",
      "cit_015": "/documents/demo-indexflex-ul.pdf#page=6",
      "cit_028": "/documents/demo-termplus-20.pdf#page=5",
      "cit_029": "/documents/demo-termplus-20.pdf#page=5",
      "cit_030": "/documents/demo-termplus-20.pdf#page=5",
      "cit_016": "/documents/demo-indexflex-ul.pdf#page=7",
      "cit_017": "/documents/demo-indexflex-ul.pdf#page=7",
      "cit_018": "/documents/demo-indexflex-ul.pdf#page=7",
      "cit_019": "/documents/demo-indexflex-ul.pdf#page=8",
      "cit_031": "/documents/demo-termplus-20.pdf#page=6",
      "cit_032": "/documents/demo-termplus-20.pdf#page=6",
      "cit_033": "/documents/demo-termplus-20.pdf#page=6",
      "cit_020": "/documents/demo-indexflex-ul.pdf#page=8",
      "cit_021": "/documents/demo-indexflex-ul.pdf#page=8",
      "cit_022": "/documents/demo-indexflex-ul.pdf#page=8"
    },
    "events": [
      {
        "eventId": "evt_fixture_created",
        "reviewId": "rev_fixture_no_client",
        "eventType": "REVIEW_CREATED",
        "actor": "Demo Reviewer",
        "payload": {},
        "occurredAt": "2026-08-01T10:00:00+00:00"
      }
    ]
  },
  "caseAApproved": {
    "reviewId": "rev_fixture_approved",
    "sourceType": "comparison_draft",
    "snapshot": {
      "schemaVersion": 1,
      "comparisonId": "cmp_fixture",
      "productA": {
        "documentId": "doc_termplus20_v1",
        "documentName": "Demo TermPlus 20 Product Guide",
        "productName": "Demo TermPlus 20",
        "productCategory": "term_life"
      },
      "productB": {
        "documentId": "doc_indexflex_ul_v1",
        "documentName": "Demo IndexFlex UL Product Guide",
        "productName": "Demo IndexFlex UL",
        "productCategory": "indexed_universal_life"
      },
      "clientContext": {
        "caseId": "DEMO-2026-001",
        "displayName": "Demo Client A",
        "language": "zh",
        "age": 38,
        "dependents": 2,
        "primaryGoal": "income_replacement",
        "budgetMonthly": 250,
        "coverageHorizon": "20-25",
        "existingCoverageNote": "none",
        "riskTolerance": "low",
        "tobaccoUse": "unknown",
        "desiredCoverageAmount": "unknown",
        "replacementContext": false,
        "clientQuestions": []
      },
      "dimensions": [
        {
          "dimensionId": "product_type",
          "labelZh": "产品类型",
          "labelEn": "Product type",
          "core": true,
          "cells": [
            {
              "dimensionId": "product_type",
              "productId": "doc_termplus20_v1",
              "availability": "available",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "20-Year Level Term Life Insurance",
              "rawValue": "20-Year Level Term Life Insurance",
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_023",
                  "documentId": "doc_termplus20_v1",
                  "documentName": "Demo TermPlus 20 Product Guide",
                  "productName": "Demo TermPlus 20",
                  "chunkId": "doc_termplus20_v1:c001",
                  "pageStart": 2,
                  "pageEnd": 2,
                  "section": "At a Glance",
                  "quote": "20-Year Level Term Life Insurance",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  2
                ],
                "evidenceQuoteCount": 1
              }
            },
            {
              "dimensionId": "product_type",
              "productId": "doc_indexflex_ul_v1",
              "availability": "available",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "Flexible-Premium Indexed Universal Life",
              "rawValue": "Flexible-Premium Indexed Universal Life",
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_001",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c001",
                  "pageStart": 2,
                  "pageEnd": 2,
                  "section": "Overview and Death Benefit Options",
                  "quote": "Flexible-Premium Indexed Universal Life",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  2
                ],
                "evidenceQuoteCount": 1
              }
            }
          ]
        },
        {
          "dimensionId": "eligibility",
          "labelZh": "投保年龄",
          "labelEn": "Issue ages",
          "core": false,
          "cells": [
            {
              "dimensionId": "eligibility",
              "productId": "doc_termplus20_v1",
              "availability": "available",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "18–60",
              "rawValue": {
                "min": 18,
                "max": 60,
                "display": "18–60"
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_024",
                  "documentId": "doc_termplus20_v1",
                  "documentName": "Demo TermPlus 20 Product Guide",
                  "productName": "Demo TermPlus 20",
                  "chunkId": "doc_termplus20_v1:c001",
                  "pageStart": 2,
                  "pageEnd": 2,
                  "section": "At a Glance",
                  "quote": "18–60",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  2
                ],
                "evidenceQuoteCount": 1
              }
            },
            {
              "dimensionId": "eligibility",
              "productId": "doc_indexflex_ul_v1",
              "availability": "available",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "0–75",
              "rawValue": {
                "min": 0,
                "max": 75,
                "display": "0–75"
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_002",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c003",
                  "pageStart": 3,
                  "pageEnd": 3,
                  "section": "Eligibility, Premium Flexibility and Five-Year No-Lapse Guarantee",
                  "quote": "0–75",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  3
                ],
                "evidenceQuoteCount": 1
              }
            }
          ]
        },
        {
          "dimensionId": "contract_size",
          "labelZh": "保额 / 合同金额",
          "labelEn": "Coverage amount / contract size",
          "core": false,
          "cells": [
            {
              "dimensionId": "contract_size",
              "productId": "doc_termplus20_v1",
              "availability": "available",
              "format": "currency",
              "sourceKind": "direct",
              "displayValue": "身故保额 Face amount: $100,000–$2,000,000",
              "rawValue": {
                "min": 100000,
                "max": 2000000,
                "display": "$100,000–$2,000,000"
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_025",
                  "documentId": "doc_termplus20_v1",
                  "documentName": "Demo TermPlus 20 Product Guide",
                  "productName": "Demo TermPlus 20",
                  "chunkId": "doc_termplus20_v1:c001",
                  "pageStart": 2,
                  "pageEnd": 2,
                  "section": "At a Glance",
                  "quote": "$100,000–$2,000,000",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  2
                ],
                "evidenceQuoteCount": 1
              }
            },
            {
              "dimensionId": "contract_size",
              "productId": "doc_indexflex_ul_v1",
              "availability": "available",
              "format": "currency",
              "sourceKind": "direct",
              "displayValue": "最低身故保额 Minimum face amount: $100,000",
              "rawValue": {
                "amount": 100000,
                "display": "$100,000"
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_003",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c001",
                  "pageStart": 2,
                  "pageEnd": 2,
                  "section": "Overview and Death Benefit Options",
                  "quote": "$100,000",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  2
                ],
                "evidenceQuoteCount": 1
              }
            }
          ]
        },
        {
          "dimensionId": "coverage_duration",
          "labelZh": "保障期限",
          "labelEn": "Coverage duration",
          "core": true,
          "cells": [
            {
              "dimensionId": "coverage_duration",
              "productId": "doc_termplus20_v1",
              "availability": "available",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "Level and guaranteed for 20 years. After the level period, coverage is annually renewable at attained-age rates that increase each year; see policy schedule. Coverage may continue to age 95.",
              "rawValue": {
                "levelYears": 20,
                "coverageMaxAge": 95,
                "display": "Level and guaranteed for 20 years. After the level period, coverage is annually renewable at attained-age rates that increase each year; see policy schedule. Coverage may continue to age 95."
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_026",
                  "documentId": "doc_termplus20_v1",
                  "documentName": "Demo TermPlus 20 Product Guide",
                  "productName": "Demo TermPlus 20",
                  "chunkId": "doc_termplus20_v1:c004",
                  "pageStart": 4,
                  "pageEnd": 4,
                  "section": "Premium Structure",
                  "quote": "Level and guaranteed for 20 years. After the level period, coverage is annually renewable at attained-age rates that increase each year; see policy schedule. Coverage may continue to age 95.",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  4
                ],
                "evidenceQuoteCount": 1
              }
            },
            {
              "dimensionId": "coverage_duration",
              "productId": "doc_indexflex_ul_v1",
              "availability": "available",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "无失效保证 No-lapse guarantee: Five-Year No-Lapse Guarantee if the required minimum monthly premium is paid.",
              "rawValue": {
                "years": 5,
                "display": "Five-Year No-Lapse Guarantee if the required minimum monthly premium is paid."
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_004",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c004",
                  "pageStart": 3,
                  "pageEnd": 3,
                  "section": "Eligibility, Premium Flexibility and Five-Year No-Lapse Guarantee > Five-Year No-Lapse Guarantee",
                  "quote": "Five-Year No-Lapse Guarantee if the required minimum monthly premium is paid.",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  3
                ],
                "evidenceQuoteCount": 1
              }
            }
          ]
        },
        {
          "dimensionId": "premium_structure",
          "labelZh": "保费 / 缴费结构",
          "labelEn": "Premium / contribution structure",
          "core": true,
          "cells": [
            {
              "dimensionId": "premium_structure",
              "productId": "doc_termplus20_v1",
              "availability": "available",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "Level and guaranteed for 20 years. After the level period, coverage is annually renewable at attained-age rates that increase each year; see policy schedule. Coverage may continue to age 95.",
              "rawValue": {
                "levelYears": 20,
                "coverageMaxAge": 95,
                "display": "Level and guaranteed for 20 years. After the level period, coverage is annually renewable at attained-age rates that increase each year; see policy schedule. Coverage may continue to age 95."
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_026",
                  "documentId": "doc_termplus20_v1",
                  "documentName": "Demo TermPlus 20 Product Guide",
                  "productName": "Demo TermPlus 20",
                  "chunkId": "doc_termplus20_v1:c004",
                  "pageStart": 4,
                  "pageEnd": 4,
                  "section": "Premium Structure",
                  "quote": "Level and guaranteed for 20 years. After the level period, coverage is annually renewable at attained-age rates that increase each year; see policy schedule. Coverage may continue to age 95.",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  4
                ],
                "evidenceQuoteCount": 1
              }
            },
            {
              "dimensionId": "premium_structure",
              "productId": "doc_indexflex_ul_v1",
              "availability": "available",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "Flexible, subject to policy minimums and tax-law maximums.",
              "rawValue": {
                "display": "Flexible, subject to policy minimums and tax-law maximums."
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_005",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c003",
                  "pageStart": 3,
                  "pageEnd": 3,
                  "section": "Eligibility, Premium Flexibility and Five-Year No-Lapse Guarantee",
                  "quote": "Flexible, subject to policy minimums and tax-law maximums.",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  3
                ],
                "evidenceQuoteCount": 1
              }
            }
          ]
        },
        {
          "dimensionId": "cash_value",
          "labelZh": "现金价值 / 账户价值",
          "labelEn": "Cash value / account value",
          "core": true,
          "cells": [
            {
              "dimensionId": "cash_value",
              "productId": "doc_termplus20_v1",
              "availability": "available",
              "format": "boolean",
              "sourceKind": "direct",
              "displayValue": "None. The policy does not accumulate cash value.",
              "rawValue": false,
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_027",
                  "documentId": "doc_termplus20_v1",
                  "documentName": "Demo TermPlus 20 Product Guide",
                  "productName": "Demo TermPlus 20",
                  "chunkId": "doc_termplus20_v1:c001",
                  "pageStart": 2,
                  "pageEnd": 2,
                  "section": "At a Glance",
                  "quote": "None. The policy does not accumulate cash value.",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  2
                ],
                "evidenceQuoteCount": 1
              }
            },
            {
              "dimensionId": "cash_value",
              "productId": "doc_indexflex_ul_v1",
              "availability": "available",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "指数账户 Indexed account: Annual point-to-point method linked to the Index, excluding dividends. · 提取 Withdrawals: Minimum partial withdrawal $500; withdrawals reduce death benefit and cash value.",
              "rawValue": {
                "indexedAccount": {
                  "display": "Annual point-to-point method linked to the Index, excluding dividends."
                },
                "withdrawals": {
                  "display": "Minimum partial withdrawal $500; withdrawals reduce death benefit and cash value."
                }
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_006",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c007",
                  "pageStart": 5,
                  "pageEnd": 5,
                  "section": "Indexed Account Mechanics",
                  "quote": "Annual point-to-point method linked to the Index, excluding dividends.",
                  "claimIds": []
                },
                {
                  "citationId": "cit_007",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c011",
                  "pageStart": 6,
                  "pageEnd": 6,
                  "section": "Surrender Charge Schedule, Loans and Withdrawals > Withdrawals",
                  "quote": "Minimum partial withdrawal $500; withdrawals reduce death benefit and cash value.",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  5,
                  6
                ],
                "evidenceQuoteCount": 2
              }
            }
          ]
        },
        {
          "dimensionId": "guaranteed_elements",
          "labelZh": "保证要素",
          "labelEn": "Guaranteed elements",
          "core": true,
          "cells": [
            {
              "dimensionId": "guaranteed_elements",
              "productId": "doc_termplus20_v1",
              "availability": "available",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "保费保证 Premium guarantee: Level and guaranteed for 20 years. After the level period, coverage is annually renewable at attained-age rates that increase each year; see policy schedule. Coverage may continue to age 95.",
              "rawValue": 20,
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_026",
                  "documentId": "doc_termplus20_v1",
                  "documentName": "Demo TermPlus 20 Product Guide",
                  "productName": "Demo TermPlus 20",
                  "chunkId": "doc_termplus20_v1:c004",
                  "pageStart": 4,
                  "pageEnd": 4,
                  "section": "Premium Structure",
                  "quote": "Level and guaranteed for 20 years. After the level period, coverage is annually renewable at attained-age rates that increase each year; see policy schedule. Coverage may continue to age 95.",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  4
                ],
                "evidenceQuoteCount": 1
              }
            },
            {
              "dimensionId": "guaranteed_elements",
              "productId": "doc_indexflex_ul_v1",
              "availability": "available",
              "format": "percent",
              "sourceKind": "direct",
              "displayValue": "指数账户保证下限 Indexed account floor: 0.00% · 保证最低 cap Guaranteed minimum cap: 3.00% · 保证最低参与率 Guaranteed minimum participation rate: 50% · 固定账户保证最低利率 Fixed account guaranteed minimum rate: 2.00%",
              "rawValue": {
                "floor.rate": 0,
                "cap.guaranteedMinimumRate": 0.03,
                "participation.guaranteedMinimumRate": 0.5,
                "fixedAccount.guaranteedMinimumRate": 0.02
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_008",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c007",
                  "pageStart": 5,
                  "pageEnd": 5,
                  "section": "Indexed Account Mechanics",
                  "quote": "0.00%",
                  "claimIds": []
                },
                {
                  "citationId": "cit_009",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c007",
                  "pageStart": 5,
                  "pageEnd": 5,
                  "section": "Indexed Account Mechanics",
                  "quote": "3.00%",
                  "claimIds": []
                },
                {
                  "citationId": "cit_010",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c007",
                  "pageStart": 5,
                  "pageEnd": 5,
                  "section": "Indexed Account Mechanics",
                  "quote": "50%",
                  "claimIds": []
                },
                {
                  "citationId": "cit_011",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c005",
                  "pageStart": 4,
                  "pageEnd": 4,
                  "section": "Fixed Account and Charges > Fixed Account",
                  "quote": "2.00%",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  4,
                  5
                ],
                "evidenceQuoteCount": 4
              }
            }
          ]
        },
        {
          "dimensionId": "non_guaranteed_elements",
          "labelZh": "非保证要素",
          "labelEn": "Non-guaranteed elements",
          "core": true,
          "cells": [
            {
              "dimensionId": "non_guaranteed_elements",
              "productId": "doc_termplus20_v1",
              "availability": "not_applicable",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "不适用 Not applicable",
              "rawValue": null,
              "derivation": null,
              "citations": [],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 0,
                "anchorPages": [],
                "evidenceQuoteCount": 0
              }
            },
            {
              "dimensionId": "non_guaranteed_elements",
              "productId": "doc_indexflex_ul_v1",
              "availability": "available",
              "format": "percent",
              "sourceKind": "direct",
              "displayValue": "当前 cap Current cap: 9.50% · 当前参与率 Current participation rate: 100% · 费率变更 Rate changes: Current caps and participation rates are declared by the carrier and may change for future segments.",
              "rawValue": {
                "cap.currentRate": 0.095,
                "participation.currentRate": 1,
                "rateChanges": {
                  "display": "Current caps and participation rates are declared by the carrier and may change for future segments."
                }
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_012",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c007",
                  "pageStart": 5,
                  "pageEnd": 5,
                  "section": "Indexed Account Mechanics",
                  "quote": "9.50%",
                  "claimIds": []
                },
                {
                  "citationId": "cit_013",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c007",
                  "pageStart": 5,
                  "pageEnd": 5,
                  "section": "Indexed Account Mechanics",
                  "quote": "100%",
                  "claimIds": []
                },
                {
                  "citationId": "cit_014",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c007",
                  "pageStart": 5,
                  "pageEnd": 5,
                  "section": "Indexed Account Mechanics",
                  "quote": "Current caps and participation rates are declared by the carrier and may change for future segments.",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  5
                ],
                "evidenceQuoteCount": 3
              }
            }
          ]
        },
        {
          "dimensionId": "crediting_mechanics",
          "labelZh": "计息 / 利率机制",
          "labelEn": "Crediting / rate mechanics",
          "core": false,
          "cells": [
            {
              "dimensionId": "crediting_mechanics",
              "productId": "doc_termplus20_v1",
              "availability": "not_applicable",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "不适用 Not applicable",
              "rawValue": null,
              "derivation": null,
              "citations": [],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 0,
                "anchorPages": [],
                "evidenceQuoteCount": 0
              }
            },
            {
              "dimensionId": "crediting_mechanics",
              "productId": "doc_indexflex_ul_v1",
              "availability": "available",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "Annual point-to-point method linked to the Index, excluding dividends.",
              "rawValue": {
                "display": "Annual point-to-point method linked to the Index, excluding dividends."
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_006",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c007",
                  "pageStart": 5,
                  "pageEnd": 5,
                  "section": "Indexed Account Mechanics",
                  "quote": "Annual point-to-point method linked to the Index, excluding dividends.",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  5
                ],
                "evidenceQuoteCount": 1
              }
            }
          ]
        },
        {
          "dimensionId": "surrender_liquidity",
          "labelZh": "退保费用与流动性",
          "labelEn": "Surrender charges and liquidity",
          "core": true,
          "cells": [
            {
              "dimensionId": "surrender_liquidity",
              "productId": "doc_termplus20_v1",
              "availability": "not_applicable",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "不适用 Not applicable",
              "rawValue": null,
              "derivation": null,
              "citations": [],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 0,
                "anchorPages": [],
                "evidenceQuoteCount": 0
              }
            },
            {
              "dimensionId": "surrender_liquidity",
              "productId": "doc_indexflex_ul_v1",
              "availability": "available",
              "format": "years",
              "sourceKind": "derived",
              "displayValue": "退保费用表在第 1–10 个合同年收取费用,第 11 年起为 0。 The surrender-charge schedule applies charges through contract year 10; from year 11 the charge is 0. · 提取 Withdrawals: Minimum partial withdrawal $500; withdrawals reduce death benefit and cash value.",
              "rawValue": 10,
              "derivation": {
                "ruleId": "LAST_NONZERO_SURRENDER_CHARGE_YEAR",
                "inputFactRefs": [
                  "surrenderChargeSchedule.chargesByYear",
                  "surrenderChargeSchedule.basis"
                ],
                "reconciledWithPath": "surrenderCharge.years"
              },
              "citations": [
                {
                  "citationId": "cit_015",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c009",
                  "pageStart": 6,
                  "pageEnd": 6,
                  "section": "Surrender Charge Schedule, Loans and Withdrawals > Surrender Charge Schedule (per $1,000 of face amount)",
                  "quote": "Surrender Charge Schedule (per $1,000 of face amount)",
                  "claimIds": []
                },
                {
                  "citationId": "cit_007",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c011",
                  "pageStart": 6,
                  "pageEnd": 6,
                  "section": "Surrender Charge Schedule, Loans and Withdrawals > Withdrawals",
                  "quote": "Minimum partial withdrawal $500; withdrawals reduce death benefit and cash value.",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  6
                ],
                "evidenceQuoteCount": 2
              }
            }
          ]
        },
        {
          "dimensionId": "riders",
          "labelZh": "附加险 / 可选利益",
          "labelEn": "Riders / optional benefits",
          "core": true,
          "cells": [
            {
              "dimensionId": "riders",
              "productId": "doc_termplus20_v1",
              "availability": "available",
              "format": "textList",
              "sourceKind": "direct",
              "displayValue": "Terminal illness with life expectancy of 12 months or less; up to 75% of face amount, maximum $500,000; no upfront charge; actuarial discount applies when exercised. · Total disability; issue ages 18–55; six-month waiting period. · $5,000 units; maximum $25,000 per child.",
              "rawValue": {
                "riders[0].name": "Accelerated Death Benefit",
                "riders[1].name": "Waiver of Premium",
                "riders[2].name": "Child Term Rider"
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_028",
                  "documentId": "doc_termplus20_v1",
                  "documentName": "Demo TermPlus 20 Product Guide",
                  "productName": "Demo TermPlus 20",
                  "chunkId": "doc_termplus20_v1:c007",
                  "pageStart": 5,
                  "pageEnd": 5,
                  "section": "Conversion Privilege and Riders > Accelerated Death Benefit",
                  "quote": "Terminal illness with life expectancy of 12 months or less; up to 75% of face amount, maximum $500,000; no upfront charge; actuarial discount applies when exercised.",
                  "claimIds": []
                },
                {
                  "citationId": "cit_029",
                  "documentId": "doc_termplus20_v1",
                  "documentName": "Demo TermPlus 20 Product Guide",
                  "productName": "Demo TermPlus 20",
                  "chunkId": "doc_termplus20_v1:c008",
                  "pageStart": 5,
                  "pageEnd": 5,
                  "section": "Conversion Privilege and Riders > Waiver of Premium",
                  "quote": "Total disability; issue ages 18–55; six-month waiting period.",
                  "claimIds": []
                },
                {
                  "citationId": "cit_030",
                  "documentId": "doc_termplus20_v1",
                  "documentName": "Demo TermPlus 20 Product Guide",
                  "productName": "Demo TermPlus 20",
                  "chunkId": "doc_termplus20_v1:c009",
                  "pageStart": 5,
                  "pageEnd": 5,
                  "section": "Conversion Privilege and Riders > Child Term Rider",
                  "quote": "$5,000 units; maximum $25,000 per child.",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  5
                ],
                "evidenceQuoteCount": 3
              }
            },
            {
              "dimensionId": "riders",
              "productId": "doc_indexflex_ul_v1",
              "availability": "available",
              "format": "textList",
              "sourceKind": "direct",
              "displayValue": "Terminal and chronic illness. · Overloan Protection. · Disability.",
              "rawValue": {
                "riders[0].name": "Accelerated Death Benefit",
                "riders[1].name": "Overloan Protection",
                "riders[2].name": "Waiver of Monthly Deductions"
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_016",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c012",
                  "pageStart": 7,
                  "pageEnd": 7,
                  "section": "Riders > Accelerated Death Benefit",
                  "quote": "Terminal and chronic illness.",
                  "claimIds": []
                },
                {
                  "citationId": "cit_017",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c013",
                  "pageStart": 7,
                  "pageEnd": 7,
                  "section": "Riders > Overloan Protection",
                  "quote": "Overloan Protection.",
                  "claimIds": []
                },
                {
                  "citationId": "cit_018",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c014",
                  "pageStart": 7,
                  "pageEnd": 7,
                  "section": "Riders > Waiver of Monthly Deductions",
                  "quote": "Disability.",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  7
                ],
                "evidenceQuoteCount": 3
              }
            }
          ]
        },
        {
          "dimensionId": "illustration_documentation",
          "labelZh": "illustration / 文件要求",
          "labelEn": "Illustration / documentation",
          "core": false,
          "cells": [
            {
              "dimensionId": "illustration_documentation",
              "productId": "doc_termplus20_v1",
              "availability": "not_provided",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "演示资料未提供 Not provided in demo materials",
              "rawValue": null,
              "derivation": null,
              "citations": [],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 0,
                "anchorPages": [],
                "evidenceQuoteCount": 0
              }
            },
            {
              "dimensionId": "illustration_documentation",
              "productId": "doc_indexflex_ul_v1",
              "availability": "available",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "Guaranteed and non-guaranteed columns must be shown in a personalized illustration.",
              "rawValue": {
                "display": "Guaranteed and non-guaranteed columns must be shown in a personalized illustration."
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_019",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c015",
                  "pageStart": 8,
                  "pageEnd": 8,
                  "section": "Disclosures > Personalized Illustration",
                  "quote": "Guaranteed and non-guaranteed columns must be shown in a personalized illustration.",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  8
                ],
                "evidenceQuoteCount": 1
              }
            }
          ]
        },
        {
          "dimensionId": "important_limitations",
          "labelZh": "重要限制与披露",
          "labelEn": "Important limitations and disclosures",
          "core": false,
          "cells": [
            {
              "dimensionId": "important_limitations",
              "productId": "doc_termplus20_v1",
              "availability": "available",
              "format": "textList",
              "sourceKind": "direct",
              "displayValue": "Suicide within two years results in refund of premiums paid. · Two-year contestability period. · Material misrepresentation may affect coverage.",
              "rawValue": {
                "exclusions[0]": "Suicide within two years results in refund of premiums paid.",
                "exclusions[1]": "Two-year contestability period.",
                "exclusions[2]": "Material misrepresentation may affect coverage."
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_031",
                  "documentId": "doc_termplus20_v1",
                  "documentName": "Demo TermPlus 20 Product Guide",
                  "productName": "Demo TermPlus 20",
                  "chunkId": "doc_termplus20_v1:c010",
                  "pageStart": 6,
                  "pageEnd": 6,
                  "section": "Exclusions, Limitations and Disclosures",
                  "quote": "Suicide within two years results in refund of premiums paid.",
                  "claimIds": []
                },
                {
                  "citationId": "cit_032",
                  "documentId": "doc_termplus20_v1",
                  "documentName": "Demo TermPlus 20 Product Guide",
                  "productName": "Demo TermPlus 20",
                  "chunkId": "doc_termplus20_v1:c010",
                  "pageStart": 6,
                  "pageEnd": 6,
                  "section": "Exclusions, Limitations and Disclosures",
                  "quote": "Two-year contestability period.",
                  "claimIds": []
                },
                {
                  "citationId": "cit_033",
                  "documentId": "doc_termplus20_v1",
                  "documentName": "Demo TermPlus 20 Product Guide",
                  "productName": "Demo TermPlus 20",
                  "chunkId": "doc_termplus20_v1:c010",
                  "pageStart": 6,
                  "pageEnd": 6,
                  "section": "Exclusions, Limitations and Disclosures",
                  "quote": "Material misrepresentation may affect coverage.",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  6
                ],
                "evidenceQuoteCount": 3
              }
            },
            {
              "dimensionId": "important_limitations",
              "productId": "doc_indexflex_ul_v1",
              "availability": "available",
              "format": "textList",
              "sourceKind": "direct",
              "displayValue": "Not a security. · Not a direct investment in an index or stock market. · Policy values depend on policy-specific charges, costs and crediting.",
              "rawValue": {
                "disclosures[0]": "Not a security.",
                "disclosures[1]": "Not a direct investment in an index or stock market.",
                "disclosures[2]": "Policy values depend on policy-specific charges, costs and crediting."
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_020",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c018",
                  "pageStart": 8,
                  "pageEnd": 8,
                  "section": "Disclosures > Important Notes",
                  "quote": "Not a security.",
                  "claimIds": []
                },
                {
                  "citationId": "cit_021",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c018",
                  "pageStart": 8,
                  "pageEnd": 8,
                  "section": "Disclosures > Important Notes",
                  "quote": "Not a direct investment in an index or stock market.",
                  "claimIds": []
                },
                {
                  "citationId": "cit_022",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c018",
                  "pageStart": 8,
                  "pageEnd": 8,
                  "section": "Disclosures > Important Notes",
                  "quote": "Policy values depend on policy-specific charges, costs and crediting.",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  8
                ],
                "evidenceQuoteCount": 3
              }
            }
          ]
        }
      ],
      "observations": [
        {
          "observationId": "obs_001",
          "type": "CASH_VALUE_FEATURE_DIFFERS",
          "textZh": "两款产品在是否积累现金价值这一点上不同,资料对各自的表述见对应引用。",
          "textEn": "The two products differ on whether the policy accumulates cash value; each side's documented wording is cited.",
          "factRefs": [
            {
              "dimensionId": "cash_value",
              "productId": "doc_indexflex_ul_v1"
            },
            {
              "dimensionId": "cash_value",
              "productId": "doc_termplus20_v1"
            }
          ],
          "citationIds": [
            "cit_006",
            "cit_007",
            "cit_027"
          ],
          "severity": "informational"
        },
        {
          "observationId": "obs_002",
          "type": "NON_GUARANTEED_ELEMENTS_PRESENT",
          "textZh": "本次比较涉及非保证要素;这些数值由承保方宣告,可能随时间变化,需持牌经纪人复核。",
          "textEn": "This comparison involves non-guaranteed elements; those values are declared by the carrier, can change over time, and require licensed-agent review.",
          "factRefs": [
            {
              "dimensionId": "non_guaranteed_elements",
              "productId": "doc_indexflex_ul_v1"
            }
          ],
          "citationIds": [
            "cit_012",
            "cit_013",
            "cit_014"
          ],
          "severity": "review_note"
        },
        {
          "observationId": "obs_003",
          "type": "ILLUSTRATION_REQUIRED_DIFFERS",
          "textZh": "只有其中一款产品在资料中说明了个性化 illustration 的要求;另一款资料未提供该说明。",
          "textEn": "Only one of the products documents a personalized-illustration requirement; the other's materials state none.",
          "factRefs": [
            {
              "dimensionId": "illustration_documentation",
              "productId": "doc_indexflex_ul_v1"
            }
          ],
          "citationIds": [
            "cit_019"
          ],
          "severity": "review_note"
        }
      ],
      "missingClientInformation": [
        {
          "field": "desiredCoverageAmount",
          "reasonZh": "尚未确认客户期望的身故保额,无法评估保障缺口。",
          "reasonEn": "The desired death-benefit amount is not stated, so coverage need cannot be evaluated.",
          "relevantTo": [
            "contract_size",
            "premium_structure"
          ],
          "requiredFor": "coverage_need"
        },
        {
          "field": "tobaccoUse",
          "reasonZh": "尚未确认吸烟状况,寿险费率分档取决于此。",
          "reasonEn": "Tobacco use is not stated; life-insurance rate classes depend on it.",
          "relevantTo": [
            "premium_structure",
            "eligibility"
          ],
          "requiredFor": "cost_comparison"
        },
        {
          "field": "underwritingClass",
          "reasonZh": "核保分类由承保方在核保时决定,资料中的样本费率不等于实际费率。",
          "reasonEn": "The underwriting class is set by the carrier at underwriting; sample rates are not actual rates.",
          "relevantTo": [
            "premium_structure"
          ],
          "requiredFor": "cost_comparison"
        },
        {
          "field": "employerGroupCoverage",
          "reasonZh": "尚未确认是否已有团体或雇主提供的保障。",
          "reasonEn": "Whether employer or group coverage already exists has not been confirmed.",
          "relevantTo": [
            "contract_size"
          ],
          "requiredFor": "coverage_need"
        },
        {
          "field": "plannedPremiumDuration",
          "reasonZh": "灵活保费产品需要确认计划缴费年限。",
          "reasonEn": "A flexible-premium product requires the planned premium-paying duration.",
          "relevantTo": [
            "premium_structure"
          ],
          "requiredFor": "illustration"
        },
        {
          "field": "cashValueTimeHorizon",
          "reasonZh": "尚未确认现金价值积累的时间目标。",
          "reasonEn": "The time horizon for cash-value accumulation is not stated.",
          "relevantTo": [
            "cash_value"
          ],
          "requiredFor": "illustration"
        },
        {
          "field": "withdrawalExpectations",
          "reasonZh": "尚未确认取用或提取资金的预期。",
          "reasonEn": "Expectations about access to or withdrawal of funds are not stated.",
          "relevantTo": [
            "cash_value",
            "surrender_liquidity"
          ],
          "requiredFor": "illustration"
        },
        {
          "field": "personalizedIllustration",
          "reasonZh": "资料未提供个性化 illustration;保证与非保证栏必须由承保方出具。",
          "reasonEn": "No personalized illustration is available; guaranteed and non-guaranteed columns must come from the carrier.",
          "relevantTo": [
            "illustration_documentation",
            "non_guaranteed_elements"
          ],
          "requiredFor": "illustration"
        }
      ],
      "comparisonStatus": "complete",
      "reviewReasons": [
        "CLIENT_FACING_DRAFT",
        "NON_GUARANTEED_ELEMENTS",
        "ILLUSTRATION_REQUIRED",
        "SURRENDER_CHARGE_EXPOSURE"
      ],
      "disclaimerZh": "本比较为内部工作草稿,仅供持牌保险经纪人审阅。所有产品与数据均为虚构演示资料。本文不构成最终推荐、suitability 判断、报价、保单 illustration,也不构成法律或税务意见。",
      "disclaimerEn": "This comparison is an internal working draft for licensed-agent review. All products and data are fictional demonstration materials. It is not a final recommendation, a suitability determination, a quote, a policy illustration, or legal or tax advice.",
      "meta": {
        "comparisonEngineVersion": 1,
        "factRegistryVersion": 1
      }
    },
    "snapshotSha256": "203654bfdc8f0458628c428e30292e48e5937a386bf7288dd00c777ff905c455",
    "workflowDecision": "allow_internal_draft",
    "requiredApprovalLevel": "enhanced_review",
    "reviewReasons": [
      "CLIENT_FACING_DRAFT",
      "NON_GUARANTEED_ELEMENTS",
      "ILLUSTRATION_REQUIRED",
      "SURRENDER_CHARGE_EXPOSURE"
    ],
    "checklist": [
      {
        "key": "desiredCoverageAmount",
        "labelZh": "期望身故保额",
        "labelEn": "Desired death benefit",
        "sourceKind": "missing_client_info"
      },
      {
        "key": "tobaccoUse",
        "labelZh": "吸烟状况",
        "labelEn": "Tobacco use",
        "sourceKind": "missing_client_info"
      },
      {
        "key": "underwritingClass",
        "labelZh": "核保分类",
        "labelEn": "Underwriting class",
        "sourceKind": "missing_client_info"
      },
      {
        "key": "employerGroupCoverage",
        "labelZh": "团体/雇主保障",
        "labelEn": "Employer or group coverage",
        "sourceKind": "missing_client_info"
      },
      {
        "key": "plannedPremiumDuration",
        "labelZh": "计划缴费年限",
        "labelEn": "Planned premium duration",
        "sourceKind": "missing_client_info"
      },
      {
        "key": "cashValueTimeHorizon",
        "labelZh": "现金价值时间目标",
        "labelEn": "Cash-value time horizon",
        "sourceKind": "missing_client_info"
      },
      {
        "key": "withdrawalExpectations",
        "labelZh": "取用预期",
        "labelEn": "Withdrawal expectations",
        "sourceKind": "missing_client_info"
      },
      {
        "key": "personalizedIllustration",
        "labelZh": "个性化 illustration",
        "labelEn": "Personalized illustration",
        "sourceKind": "missing_client_info"
      }
    ],
    "reviewState": "approved",
    "reviewer": "Demo Reviewer",
    "decisionNote": "Facts and citations check out.",
    "revisionInstructions": null,
    "createdAt": "2026-08-01T10:00:00+00:00",
    "updatedAt": "2026-08-02T11:00:00+00:00",
    "citationUrls": {
      "cit_023": "/documents/demo-termplus-20.pdf#page=2",
      "cit_001": "/documents/demo-indexflex-ul.pdf#page=2",
      "cit_024": "/documents/demo-termplus-20.pdf#page=2",
      "cit_002": "/documents/demo-indexflex-ul.pdf#page=3",
      "cit_025": "/documents/demo-termplus-20.pdf#page=2",
      "cit_003": "/documents/demo-indexflex-ul.pdf#page=2",
      "cit_026": "/documents/demo-termplus-20.pdf#page=4",
      "cit_004": "/documents/demo-indexflex-ul.pdf#page=3",
      "cit_005": "/documents/demo-indexflex-ul.pdf#page=3",
      "cit_027": "/documents/demo-termplus-20.pdf#page=2",
      "cit_006": "/documents/demo-indexflex-ul.pdf#page=5",
      "cit_007": "/documents/demo-indexflex-ul.pdf#page=6",
      "cit_008": "/documents/demo-indexflex-ul.pdf#page=5",
      "cit_009": "/documents/demo-indexflex-ul.pdf#page=5",
      "cit_010": "/documents/demo-indexflex-ul.pdf#page=5",
      "cit_011": "/documents/demo-indexflex-ul.pdf#page=4",
      "cit_012": "/documents/demo-indexflex-ul.pdf#page=5",
      "cit_013": "/documents/demo-indexflex-ul.pdf#page=5",
      "cit_014": "/documents/demo-indexflex-ul.pdf#page=5",
      "cit_015": "/documents/demo-indexflex-ul.pdf#page=6",
      "cit_028": "/documents/demo-termplus-20.pdf#page=5",
      "cit_029": "/documents/demo-termplus-20.pdf#page=5",
      "cit_030": "/documents/demo-termplus-20.pdf#page=5",
      "cit_016": "/documents/demo-indexflex-ul.pdf#page=7",
      "cit_017": "/documents/demo-indexflex-ul.pdf#page=7",
      "cit_018": "/documents/demo-indexflex-ul.pdf#page=7",
      "cit_019": "/documents/demo-indexflex-ul.pdf#page=8",
      "cit_031": "/documents/demo-termplus-20.pdf#page=6",
      "cit_032": "/documents/demo-termplus-20.pdf#page=6",
      "cit_033": "/documents/demo-termplus-20.pdf#page=6",
      "cit_020": "/documents/demo-indexflex-ul.pdf#page=8",
      "cit_021": "/documents/demo-indexflex-ul.pdf#page=8",
      "cit_022": "/documents/demo-indexflex-ul.pdf#page=8"
    },
    "events": [
      {
        "eventId": "evt_fixture_created",
        "reviewId": "rev_fixture_case_a",
        "eventType": "REVIEW_CREATED",
        "actor": "Demo Reviewer",
        "payload": {},
        "occurredAt": "2026-08-01T10:00:00+00:00"
      },
      {
        "eventId": "evt_fixture_approved",
        "reviewId": "rev_fixture_approved",
        "eventType": "APPROVED",
        "actor": "Demo Reviewer",
        "payload": {
          "note": "Facts and citations check out."
        },
        "occurredAt": "2026-08-02T11:00:00+00:00"
      }
    ]
  },
  "archivedSnapshot": {
    "reviewId": "rev_fixture_archived",
    "sourceType": "comparison_draft",
    "snapshot": {
      "schemaVersion": 1,
      "comparisonId": "cmp_fixture",
      "productA": {
        "documentId": "doc_termplus20_v1",
        "documentName": "Demo TermPlus 20 Product Guide",
        "productName": "Demo TermPlus 20",
        "productCategory": "term_life"
      },
      "productB": {
        "documentId": "doc_indexflex_ul_v1",
        "documentName": "Demo IndexFlex UL Product Guide",
        "productName": "Demo IndexFlex UL",
        "productCategory": "indexed_universal_life"
      },
      "clientContext": {
        "caseId": "DEMO-2026-001",
        "displayName": "Demo Client A",
        "language": "zh",
        "age": 38,
        "dependents": 2,
        "primaryGoal": "income_replacement",
        "budgetMonthly": 250,
        "coverageHorizon": "20-25",
        "existingCoverageNote": "none",
        "riskTolerance": "low",
        "tobaccoUse": "unknown",
        "desiredCoverageAmount": "unknown",
        "replacementContext": false,
        "clientQuestions": []
      },
      "dimensions": [
        {
          "dimensionId": "product_type",
          "labelZh": "产品类型",
          "labelEn": "Product type",
          "core": true,
          "cells": [
            {
              "dimensionId": "product_type",
              "productId": "doc_termplus20_v1",
              "availability": "available",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "ARCHIVED-ONLY VALUE 1997-A",
              "rawValue": "20-Year Level Term Life Insurance",
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_023",
                  "documentId": "doc_termplus20_v1",
                  "documentName": "Demo TermPlus 20 Product Guide",
                  "productName": "Demo TermPlus 20",
                  "chunkId": "doc_termplus20_v1:c001",
                  "pageStart": 2,
                  "pageEnd": 2,
                  "section": "At a Glance",
                  "quote": "20-Year Level Term Life Insurance",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  2
                ],
                "evidenceQuoteCount": 1
              }
            },
            {
              "dimensionId": "product_type",
              "productId": "doc_indexflex_ul_v1",
              "availability": "available",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "Flexible-Premium Indexed Universal Life",
              "rawValue": "Flexible-Premium Indexed Universal Life",
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_001",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c001",
                  "pageStart": 2,
                  "pageEnd": 2,
                  "section": "Overview and Death Benefit Options",
                  "quote": "Flexible-Premium Indexed Universal Life",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  2
                ],
                "evidenceQuoteCount": 1
              }
            }
          ]
        },
        {
          "dimensionId": "eligibility",
          "labelZh": "投保年龄",
          "labelEn": "Issue ages",
          "core": false,
          "cells": [
            {
              "dimensionId": "eligibility",
              "productId": "doc_termplus20_v1",
              "availability": "available",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "18–60",
              "rawValue": {
                "min": 18,
                "max": 60,
                "display": "18–60"
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_024",
                  "documentId": "doc_termplus20_v1",
                  "documentName": "Demo TermPlus 20 Product Guide",
                  "productName": "Demo TermPlus 20",
                  "chunkId": "doc_termplus20_v1:c001",
                  "pageStart": 2,
                  "pageEnd": 2,
                  "section": "At a Glance",
                  "quote": "18–60",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  2
                ],
                "evidenceQuoteCount": 1
              }
            },
            {
              "dimensionId": "eligibility",
              "productId": "doc_indexflex_ul_v1",
              "availability": "available",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "0–75",
              "rawValue": {
                "min": 0,
                "max": 75,
                "display": "0–75"
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_002",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c003",
                  "pageStart": 3,
                  "pageEnd": 3,
                  "section": "Eligibility, Premium Flexibility and Five-Year No-Lapse Guarantee",
                  "quote": "0–75",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  3
                ],
                "evidenceQuoteCount": 1
              }
            }
          ]
        },
        {
          "dimensionId": "contract_size",
          "labelZh": "保额 / 合同金额",
          "labelEn": "Coverage amount / contract size",
          "core": false,
          "cells": [
            {
              "dimensionId": "contract_size",
              "productId": "doc_termplus20_v1",
              "availability": "available",
              "format": "currency",
              "sourceKind": "direct",
              "displayValue": "身故保额 Face amount: $100,000–$2,000,000",
              "rawValue": {
                "min": 100000,
                "max": 2000000,
                "display": "$100,000–$2,000,000"
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_025",
                  "documentId": "doc_termplus20_v1",
                  "documentName": "Demo TermPlus 20 Product Guide",
                  "productName": "Demo TermPlus 20",
                  "chunkId": "doc_termplus20_v1:c001",
                  "pageStart": 2,
                  "pageEnd": 2,
                  "section": "At a Glance",
                  "quote": "$100,000–$2,000,000",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  2
                ],
                "evidenceQuoteCount": 1
              }
            },
            {
              "dimensionId": "contract_size",
              "productId": "doc_indexflex_ul_v1",
              "availability": "available",
              "format": "currency",
              "sourceKind": "direct",
              "displayValue": "最低身故保额 Minimum face amount: $100,000",
              "rawValue": {
                "amount": 100000,
                "display": "$100,000"
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_003",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c001",
                  "pageStart": 2,
                  "pageEnd": 2,
                  "section": "Overview and Death Benefit Options",
                  "quote": "$100,000",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  2
                ],
                "evidenceQuoteCount": 1
              }
            }
          ]
        },
        {
          "dimensionId": "coverage_duration",
          "labelZh": "保障期限",
          "labelEn": "Coverage duration",
          "core": true,
          "cells": [
            {
              "dimensionId": "coverage_duration",
              "productId": "doc_termplus20_v1",
              "availability": "available",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "Level and guaranteed for 20 years. After the level period, coverage is annually renewable at attained-age rates that increase each year; see policy schedule. Coverage may continue to age 95.",
              "rawValue": {
                "levelYears": 20,
                "coverageMaxAge": 95,
                "display": "Level and guaranteed for 20 years. After the level period, coverage is annually renewable at attained-age rates that increase each year; see policy schedule. Coverage may continue to age 95."
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_026",
                  "documentId": "doc_termplus20_v1",
                  "documentName": "Demo TermPlus 20 Product Guide",
                  "productName": "Demo TermPlus 20",
                  "chunkId": "doc_termplus20_v1:c004",
                  "pageStart": 4,
                  "pageEnd": 4,
                  "section": "Premium Structure",
                  "quote": "Level and guaranteed for 20 years. After the level period, coverage is annually renewable at attained-age rates that increase each year; see policy schedule. Coverage may continue to age 95.",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  4
                ],
                "evidenceQuoteCount": 1
              }
            },
            {
              "dimensionId": "coverage_duration",
              "productId": "doc_indexflex_ul_v1",
              "availability": "available",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "无失效保证 No-lapse guarantee: Five-Year No-Lapse Guarantee if the required minimum monthly premium is paid.",
              "rawValue": {
                "years": 5,
                "display": "Five-Year No-Lapse Guarantee if the required minimum monthly premium is paid."
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_004",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c004",
                  "pageStart": 3,
                  "pageEnd": 3,
                  "section": "Eligibility, Premium Flexibility and Five-Year No-Lapse Guarantee > Five-Year No-Lapse Guarantee",
                  "quote": "Five-Year No-Lapse Guarantee if the required minimum monthly premium is paid.",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  3
                ],
                "evidenceQuoteCount": 1
              }
            }
          ]
        },
        {
          "dimensionId": "premium_structure",
          "labelZh": "保费 / 缴费结构",
          "labelEn": "Premium / contribution structure",
          "core": true,
          "cells": [
            {
              "dimensionId": "premium_structure",
              "productId": "doc_termplus20_v1",
              "availability": "available",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "Level and guaranteed for 20 years. After the level period, coverage is annually renewable at attained-age rates that increase each year; see policy schedule. Coverage may continue to age 95.",
              "rawValue": {
                "levelYears": 20,
                "coverageMaxAge": 95,
                "display": "Level and guaranteed for 20 years. After the level period, coverage is annually renewable at attained-age rates that increase each year; see policy schedule. Coverage may continue to age 95."
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_026",
                  "documentId": "doc_termplus20_v1",
                  "documentName": "Demo TermPlus 20 Product Guide",
                  "productName": "Demo TermPlus 20",
                  "chunkId": "doc_termplus20_v1:c004",
                  "pageStart": 4,
                  "pageEnd": 4,
                  "section": "Premium Structure",
                  "quote": "Level and guaranteed for 20 years. After the level period, coverage is annually renewable at attained-age rates that increase each year; see policy schedule. Coverage may continue to age 95.",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  4
                ],
                "evidenceQuoteCount": 1
              }
            },
            {
              "dimensionId": "premium_structure",
              "productId": "doc_indexflex_ul_v1",
              "availability": "available",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "Flexible, subject to policy minimums and tax-law maximums.",
              "rawValue": {
                "display": "Flexible, subject to policy minimums and tax-law maximums."
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_005",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c003",
                  "pageStart": 3,
                  "pageEnd": 3,
                  "section": "Eligibility, Premium Flexibility and Five-Year No-Lapse Guarantee",
                  "quote": "Flexible, subject to policy minimums and tax-law maximums.",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  3
                ],
                "evidenceQuoteCount": 1
              }
            }
          ]
        },
        {
          "dimensionId": "cash_value",
          "labelZh": "现金价值 / 账户价值",
          "labelEn": "Cash value / account value",
          "core": true,
          "cells": [
            {
              "dimensionId": "cash_value",
              "productId": "doc_termplus20_v1",
              "availability": "available",
              "format": "boolean",
              "sourceKind": "direct",
              "displayValue": "None. The policy does not accumulate cash value.",
              "rawValue": false,
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_027",
                  "documentId": "doc_termplus20_v1",
                  "documentName": "Demo TermPlus 20 Product Guide",
                  "productName": "Demo TermPlus 20",
                  "chunkId": "doc_termplus20_v1:c001",
                  "pageStart": 2,
                  "pageEnd": 2,
                  "section": "At a Glance",
                  "quote": "None. The policy does not accumulate cash value.",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  2
                ],
                "evidenceQuoteCount": 1
              }
            },
            {
              "dimensionId": "cash_value",
              "productId": "doc_indexflex_ul_v1",
              "availability": "available",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "指数账户 Indexed account: Annual point-to-point method linked to the Index, excluding dividends. · 提取 Withdrawals: Minimum partial withdrawal $500; withdrawals reduce death benefit and cash value.",
              "rawValue": {
                "indexedAccount": {
                  "display": "Annual point-to-point method linked to the Index, excluding dividends."
                },
                "withdrawals": {
                  "display": "Minimum partial withdrawal $500; withdrawals reduce death benefit and cash value."
                }
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_006",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c007",
                  "pageStart": 5,
                  "pageEnd": 5,
                  "section": "Indexed Account Mechanics",
                  "quote": "Annual point-to-point method linked to the Index, excluding dividends.",
                  "claimIds": []
                },
                {
                  "citationId": "cit_007",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c011",
                  "pageStart": 6,
                  "pageEnd": 6,
                  "section": "Surrender Charge Schedule, Loans and Withdrawals > Withdrawals",
                  "quote": "Minimum partial withdrawal $500; withdrawals reduce death benefit and cash value.",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  5,
                  6
                ],
                "evidenceQuoteCount": 2
              }
            }
          ]
        },
        {
          "dimensionId": "guaranteed_elements",
          "labelZh": "保证要素",
          "labelEn": "Guaranteed elements",
          "core": true,
          "cells": [
            {
              "dimensionId": "guaranteed_elements",
              "productId": "doc_termplus20_v1",
              "availability": "available",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "保费保证 Premium guarantee: Level and guaranteed for 20 years. After the level period, coverage is annually renewable at attained-age rates that increase each year; see policy schedule. Coverage may continue to age 95.",
              "rawValue": 20,
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_026",
                  "documentId": "doc_termplus20_v1",
                  "documentName": "Demo TermPlus 20 Product Guide",
                  "productName": "Demo TermPlus 20",
                  "chunkId": "doc_termplus20_v1:c004",
                  "pageStart": 4,
                  "pageEnd": 4,
                  "section": "Premium Structure",
                  "quote": "Level and guaranteed for 20 years. After the level period, coverage is annually renewable at attained-age rates that increase each year; see policy schedule. Coverage may continue to age 95.",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  4
                ],
                "evidenceQuoteCount": 1
              }
            },
            {
              "dimensionId": "guaranteed_elements",
              "productId": "doc_indexflex_ul_v1",
              "availability": "available",
              "format": "percent",
              "sourceKind": "direct",
              "displayValue": "指数账户保证下限 Indexed account floor: 0.00% · 保证最低 cap Guaranteed minimum cap: 3.00% · 保证最低参与率 Guaranteed minimum participation rate: 50% · 固定账户保证最低利率 Fixed account guaranteed minimum rate: 2.00%",
              "rawValue": {
                "floor.rate": 0,
                "cap.guaranteedMinimumRate": 0.03,
                "participation.guaranteedMinimumRate": 0.5,
                "fixedAccount.guaranteedMinimumRate": 0.02
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_008",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c007",
                  "pageStart": 5,
                  "pageEnd": 5,
                  "section": "Indexed Account Mechanics",
                  "quote": "0.00%",
                  "claimIds": []
                },
                {
                  "citationId": "cit_009",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c007",
                  "pageStart": 5,
                  "pageEnd": 5,
                  "section": "Indexed Account Mechanics",
                  "quote": "3.00%",
                  "claimIds": []
                },
                {
                  "citationId": "cit_010",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c007",
                  "pageStart": 5,
                  "pageEnd": 5,
                  "section": "Indexed Account Mechanics",
                  "quote": "50%",
                  "claimIds": []
                },
                {
                  "citationId": "cit_011",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c005",
                  "pageStart": 4,
                  "pageEnd": 4,
                  "section": "Fixed Account and Charges > Fixed Account",
                  "quote": "2.00%",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  4,
                  5
                ],
                "evidenceQuoteCount": 4
              }
            }
          ]
        },
        {
          "dimensionId": "non_guaranteed_elements",
          "labelZh": "非保证要素",
          "labelEn": "Non-guaranteed elements",
          "core": true,
          "cells": [
            {
              "dimensionId": "non_guaranteed_elements",
              "productId": "doc_termplus20_v1",
              "availability": "not_applicable",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "不适用 Not applicable",
              "rawValue": null,
              "derivation": null,
              "citations": [],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 0,
                "anchorPages": [],
                "evidenceQuoteCount": 0
              }
            },
            {
              "dimensionId": "non_guaranteed_elements",
              "productId": "doc_indexflex_ul_v1",
              "availability": "available",
              "format": "percent",
              "sourceKind": "direct",
              "displayValue": "当前 cap Current cap: 9.50% · 当前参与率 Current participation rate: 100% · 费率变更 Rate changes: Current caps and participation rates are declared by the carrier and may change for future segments.",
              "rawValue": {
                "cap.currentRate": 0.095,
                "participation.currentRate": 1,
                "rateChanges": {
                  "display": "Current caps and participation rates are declared by the carrier and may change for future segments."
                }
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_012",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c007",
                  "pageStart": 5,
                  "pageEnd": 5,
                  "section": "Indexed Account Mechanics",
                  "quote": "9.50%",
                  "claimIds": []
                },
                {
                  "citationId": "cit_013",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c007",
                  "pageStart": 5,
                  "pageEnd": 5,
                  "section": "Indexed Account Mechanics",
                  "quote": "100%",
                  "claimIds": []
                },
                {
                  "citationId": "cit_014",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c007",
                  "pageStart": 5,
                  "pageEnd": 5,
                  "section": "Indexed Account Mechanics",
                  "quote": "Current caps and participation rates are declared by the carrier and may change for future segments.",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  5
                ],
                "evidenceQuoteCount": 3
              }
            }
          ]
        },
        {
          "dimensionId": "crediting_mechanics",
          "labelZh": "计息 / 利率机制",
          "labelEn": "Crediting / rate mechanics",
          "core": false,
          "cells": [
            {
              "dimensionId": "crediting_mechanics",
              "productId": "doc_termplus20_v1",
              "availability": "not_applicable",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "不适用 Not applicable",
              "rawValue": null,
              "derivation": null,
              "citations": [],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 0,
                "anchorPages": [],
                "evidenceQuoteCount": 0
              }
            },
            {
              "dimensionId": "crediting_mechanics",
              "productId": "doc_indexflex_ul_v1",
              "availability": "available",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "Annual point-to-point method linked to the Index, excluding dividends.",
              "rawValue": {
                "display": "Annual point-to-point method linked to the Index, excluding dividends."
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_006",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c007",
                  "pageStart": 5,
                  "pageEnd": 5,
                  "section": "Indexed Account Mechanics",
                  "quote": "Annual point-to-point method linked to the Index, excluding dividends.",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  5
                ],
                "evidenceQuoteCount": 1
              }
            }
          ]
        },
        {
          "dimensionId": "surrender_liquidity",
          "labelZh": "退保费用与流动性",
          "labelEn": "Surrender charges and liquidity",
          "core": true,
          "cells": [
            {
              "dimensionId": "surrender_liquidity",
              "productId": "doc_termplus20_v1",
              "availability": "not_applicable",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "不适用 Not applicable",
              "rawValue": null,
              "derivation": null,
              "citations": [],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 0,
                "anchorPages": [],
                "evidenceQuoteCount": 0
              }
            },
            {
              "dimensionId": "surrender_liquidity",
              "productId": "doc_indexflex_ul_v1",
              "availability": "available",
              "format": "years",
              "sourceKind": "derived",
              "displayValue": "退保费用表在第 1–10 个合同年收取费用,第 11 年起为 0。 The surrender-charge schedule applies charges through contract year 10; from year 11 the charge is 0. · 提取 Withdrawals: Minimum partial withdrawal $500; withdrawals reduce death benefit and cash value.",
              "rawValue": 10,
              "derivation": {
                "ruleId": "LAST_NONZERO_SURRENDER_CHARGE_YEAR",
                "inputFactRefs": [
                  "surrenderChargeSchedule.chargesByYear",
                  "surrenderChargeSchedule.basis"
                ],
                "reconciledWithPath": "surrenderCharge.years"
              },
              "citations": [
                {
                  "citationId": "cit_015",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c009",
                  "pageStart": 6,
                  "pageEnd": 6,
                  "section": "Surrender Charge Schedule, Loans and Withdrawals > Surrender Charge Schedule (per $1,000 of face amount)",
                  "quote": "Surrender Charge Schedule (per $1,000 of face amount)",
                  "claimIds": []
                },
                {
                  "citationId": "cit_007",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c011",
                  "pageStart": 6,
                  "pageEnd": 6,
                  "section": "Surrender Charge Schedule, Loans and Withdrawals > Withdrawals",
                  "quote": "Minimum partial withdrawal $500; withdrawals reduce death benefit and cash value.",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  6
                ],
                "evidenceQuoteCount": 2
              }
            }
          ]
        },
        {
          "dimensionId": "riders",
          "labelZh": "附加险 / 可选利益",
          "labelEn": "Riders / optional benefits",
          "core": true,
          "cells": [
            {
              "dimensionId": "riders",
              "productId": "doc_termplus20_v1",
              "availability": "available",
              "format": "textList",
              "sourceKind": "direct",
              "displayValue": "Terminal illness with life expectancy of 12 months or less; up to 75% of face amount, maximum $500,000; no upfront charge; actuarial discount applies when exercised. · Total disability; issue ages 18–55; six-month waiting period. · $5,000 units; maximum $25,000 per child.",
              "rawValue": {
                "riders[0].name": "Accelerated Death Benefit",
                "riders[1].name": "Waiver of Premium",
                "riders[2].name": "Child Term Rider"
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_028",
                  "documentId": "doc_termplus20_v1",
                  "documentName": "Demo TermPlus 20 Product Guide",
                  "productName": "Demo TermPlus 20",
                  "chunkId": "doc_termplus20_v1:c007",
                  "pageStart": 5,
                  "pageEnd": 5,
                  "section": "Conversion Privilege and Riders > Accelerated Death Benefit",
                  "quote": "Terminal illness with life expectancy of 12 months or less; up to 75% of face amount, maximum $500,000; no upfront charge; actuarial discount applies when exercised.",
                  "claimIds": []
                },
                {
                  "citationId": "cit_029",
                  "documentId": "doc_termplus20_v1",
                  "documentName": "Demo TermPlus 20 Product Guide",
                  "productName": "Demo TermPlus 20",
                  "chunkId": "doc_termplus20_v1:c008",
                  "pageStart": 5,
                  "pageEnd": 5,
                  "section": "Conversion Privilege and Riders > Waiver of Premium",
                  "quote": "Total disability; issue ages 18–55; six-month waiting period.",
                  "claimIds": []
                },
                {
                  "citationId": "cit_030",
                  "documentId": "doc_termplus20_v1",
                  "documentName": "Demo TermPlus 20 Product Guide",
                  "productName": "Demo TermPlus 20",
                  "chunkId": "doc_termplus20_v1:c009",
                  "pageStart": 5,
                  "pageEnd": 5,
                  "section": "Conversion Privilege and Riders > Child Term Rider",
                  "quote": "$5,000 units; maximum $25,000 per child.",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  5
                ],
                "evidenceQuoteCount": 3
              }
            },
            {
              "dimensionId": "riders",
              "productId": "doc_indexflex_ul_v1",
              "availability": "available",
              "format": "textList",
              "sourceKind": "direct",
              "displayValue": "Terminal and chronic illness. · Overloan Protection. · Disability.",
              "rawValue": {
                "riders[0].name": "Accelerated Death Benefit",
                "riders[1].name": "Overloan Protection",
                "riders[2].name": "Waiver of Monthly Deductions"
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_016",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c012",
                  "pageStart": 7,
                  "pageEnd": 7,
                  "section": "Riders > Accelerated Death Benefit",
                  "quote": "Terminal and chronic illness.",
                  "claimIds": []
                },
                {
                  "citationId": "cit_017",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c013",
                  "pageStart": 7,
                  "pageEnd": 7,
                  "section": "Riders > Overloan Protection",
                  "quote": "Overloan Protection.",
                  "claimIds": []
                },
                {
                  "citationId": "cit_018",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c014",
                  "pageStart": 7,
                  "pageEnd": 7,
                  "section": "Riders > Waiver of Monthly Deductions",
                  "quote": "Disability.",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  7
                ],
                "evidenceQuoteCount": 3
              }
            }
          ]
        },
        {
          "dimensionId": "illustration_documentation",
          "labelZh": "illustration / 文件要求",
          "labelEn": "Illustration / documentation",
          "core": false,
          "cells": [
            {
              "dimensionId": "illustration_documentation",
              "productId": "doc_termplus20_v1",
              "availability": "not_provided",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "演示资料未提供 Not provided in demo materials",
              "rawValue": null,
              "derivation": null,
              "citations": [],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 0,
                "anchorPages": [],
                "evidenceQuoteCount": 0
              }
            },
            {
              "dimensionId": "illustration_documentation",
              "productId": "doc_indexflex_ul_v1",
              "availability": "available",
              "format": "text",
              "sourceKind": "direct",
              "displayValue": "Guaranteed and non-guaranteed columns must be shown in a personalized illustration.",
              "rawValue": {
                "display": "Guaranteed and non-guaranteed columns must be shown in a personalized illustration."
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_019",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c015",
                  "pageStart": 8,
                  "pageEnd": 8,
                  "section": "Disclosures > Personalized Illustration",
                  "quote": "Guaranteed and non-guaranteed columns must be shown in a personalized illustration.",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  8
                ],
                "evidenceQuoteCount": 1
              }
            }
          ]
        },
        {
          "dimensionId": "important_limitations",
          "labelZh": "重要限制与披露",
          "labelEn": "Important limitations and disclosures",
          "core": false,
          "cells": [
            {
              "dimensionId": "important_limitations",
              "productId": "doc_termplus20_v1",
              "availability": "available",
              "format": "textList",
              "sourceKind": "direct",
              "displayValue": "Suicide within two years results in refund of premiums paid. · Two-year contestability period. · Material misrepresentation may affect coverage.",
              "rawValue": {
                "exclusions[0]": "Suicide within two years results in refund of premiums paid.",
                "exclusions[1]": "Two-year contestability period.",
                "exclusions[2]": "Material misrepresentation may affect coverage."
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_031",
                  "documentId": "doc_termplus20_v1",
                  "documentName": "Demo TermPlus 20 Product Guide",
                  "productName": "Demo TermPlus 20",
                  "chunkId": "doc_termplus20_v1:c010",
                  "pageStart": 6,
                  "pageEnd": 6,
                  "section": "Exclusions, Limitations and Disclosures",
                  "quote": "Suicide within two years results in refund of premiums paid.",
                  "claimIds": []
                },
                {
                  "citationId": "cit_032",
                  "documentId": "doc_termplus20_v1",
                  "documentName": "Demo TermPlus 20 Product Guide",
                  "productName": "Demo TermPlus 20",
                  "chunkId": "doc_termplus20_v1:c010",
                  "pageStart": 6,
                  "pageEnd": 6,
                  "section": "Exclusions, Limitations and Disclosures",
                  "quote": "Two-year contestability period.",
                  "claimIds": []
                },
                {
                  "citationId": "cit_033",
                  "documentId": "doc_termplus20_v1",
                  "documentName": "Demo TermPlus 20 Product Guide",
                  "productName": "Demo TermPlus 20",
                  "chunkId": "doc_termplus20_v1:c010",
                  "pageStart": 6,
                  "pageEnd": 6,
                  "section": "Exclusions, Limitations and Disclosures",
                  "quote": "Material misrepresentation may affect coverage.",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  6
                ],
                "evidenceQuoteCount": 3
              }
            },
            {
              "dimensionId": "important_limitations",
              "productId": "doc_indexflex_ul_v1",
              "availability": "available",
              "format": "textList",
              "sourceKind": "direct",
              "displayValue": "Not a security. · Not a direct investment in an index or stock market. · Policy values depend on policy-specific charges, costs and crediting.",
              "rawValue": {
                "disclosures[0]": "Not a security.",
                "disclosures[1]": "Not a direct investment in an index or stock market.",
                "disclosures[2]": "Policy values depend on policy-specific charges, costs and crediting."
              },
              "derivation": null,
              "citations": [
                {
                  "citationId": "cit_020",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c018",
                  "pageStart": 8,
                  "pageEnd": 8,
                  "section": "Disclosures > Important Notes",
                  "quote": "Not a security.",
                  "claimIds": []
                },
                {
                  "citationId": "cit_021",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c018",
                  "pageStart": 8,
                  "pageEnd": 8,
                  "section": "Disclosures > Important Notes",
                  "quote": "Not a direct investment in an index or stock market.",
                  "claimIds": []
                },
                {
                  "citationId": "cit_022",
                  "documentId": "doc_indexflex_ul_v1",
                  "documentName": "Demo IndexFlex UL Product Guide",
                  "productName": "Demo IndexFlex UL",
                  "chunkId": "doc_indexflex_ul_v1:c018",
                  "pageStart": 8,
                  "pageEnd": 8,
                  "section": "Disclosures > Important Notes",
                  "quote": "Policy values depend on policy-specific charges, costs and crediting.",
                  "claimIds": []
                }
              ],
              "conflictReason": null,
              "diagnostics": {
                "candidateChunkCount": 1,
                "anchorPages": [
                  8
                ],
                "evidenceQuoteCount": 3
              }
            }
          ]
        }
      ],
      "observations": [
        {
          "observationId": "obs_001",
          "type": "CASH_VALUE_FEATURE_DIFFERS",
          "textZh": "两款产品在是否积累现金价值这一点上不同,资料对各自的表述见对应引用。",
          "textEn": "The two products differ on whether the policy accumulates cash value; each side's documented wording is cited.",
          "factRefs": [
            {
              "dimensionId": "cash_value",
              "productId": "doc_indexflex_ul_v1"
            },
            {
              "dimensionId": "cash_value",
              "productId": "doc_termplus20_v1"
            }
          ],
          "citationIds": [
            "cit_006",
            "cit_007",
            "cit_027"
          ],
          "severity": "informational"
        },
        {
          "observationId": "obs_002",
          "type": "NON_GUARANTEED_ELEMENTS_PRESENT",
          "textZh": "本次比较涉及非保证要素;这些数值由承保方宣告,可能随时间变化,需持牌经纪人复核。",
          "textEn": "This comparison involves non-guaranteed elements; those values are declared by the carrier, can change over time, and require licensed-agent review.",
          "factRefs": [
            {
              "dimensionId": "non_guaranteed_elements",
              "productId": "doc_indexflex_ul_v1"
            }
          ],
          "citationIds": [
            "cit_012",
            "cit_013",
            "cit_014"
          ],
          "severity": "review_note"
        },
        {
          "observationId": "obs_003",
          "type": "ILLUSTRATION_REQUIRED_DIFFERS",
          "textZh": "只有其中一款产品在资料中说明了个性化 illustration 的要求;另一款资料未提供该说明。",
          "textEn": "Only one of the products documents a personalized-illustration requirement; the other's materials state none.",
          "factRefs": [
            {
              "dimensionId": "illustration_documentation",
              "productId": "doc_indexflex_ul_v1"
            }
          ],
          "citationIds": [
            "cit_019"
          ],
          "severity": "review_note"
        }
      ],
      "missingClientInformation": [
        {
          "field": "desiredCoverageAmount",
          "reasonZh": "尚未确认客户期望的身故保额,无法评估保障缺口。",
          "reasonEn": "The desired death-benefit amount is not stated, so coverage need cannot be evaluated.",
          "relevantTo": [
            "contract_size",
            "premium_structure"
          ],
          "requiredFor": "coverage_need"
        },
        {
          "field": "tobaccoUse",
          "reasonZh": "尚未确认吸烟状况,寿险费率分档取决于此。",
          "reasonEn": "Tobacco use is not stated; life-insurance rate classes depend on it.",
          "relevantTo": [
            "premium_structure",
            "eligibility"
          ],
          "requiredFor": "cost_comparison"
        },
        {
          "field": "underwritingClass",
          "reasonZh": "核保分类由承保方在核保时决定,资料中的样本费率不等于实际费率。",
          "reasonEn": "The underwriting class is set by the carrier at underwriting; sample rates are not actual rates.",
          "relevantTo": [
            "premium_structure"
          ],
          "requiredFor": "cost_comparison"
        },
        {
          "field": "employerGroupCoverage",
          "reasonZh": "尚未确认是否已有团体或雇主提供的保障。",
          "reasonEn": "Whether employer or group coverage already exists has not been confirmed.",
          "relevantTo": [
            "contract_size"
          ],
          "requiredFor": "coverage_need"
        },
        {
          "field": "plannedPremiumDuration",
          "reasonZh": "灵活保费产品需要确认计划缴费年限。",
          "reasonEn": "A flexible-premium product requires the planned premium-paying duration.",
          "relevantTo": [
            "premium_structure"
          ],
          "requiredFor": "illustration"
        },
        {
          "field": "cashValueTimeHorizon",
          "reasonZh": "尚未确认现金价值积累的时间目标。",
          "reasonEn": "The time horizon for cash-value accumulation is not stated.",
          "relevantTo": [
            "cash_value"
          ],
          "requiredFor": "illustration"
        },
        {
          "field": "withdrawalExpectations",
          "reasonZh": "尚未确认取用或提取资金的预期。",
          "reasonEn": "Expectations about access to or withdrawal of funds are not stated.",
          "relevantTo": [
            "cash_value",
            "surrender_liquidity"
          ],
          "requiredFor": "illustration"
        },
        {
          "field": "personalizedIllustration",
          "reasonZh": "资料未提供个性化 illustration;保证与非保证栏必须由承保方出具。",
          "reasonEn": "No personalized illustration is available; guaranteed and non-guaranteed columns must come from the carrier.",
          "relevantTo": [
            "illustration_documentation",
            "non_guaranteed_elements"
          ],
          "requiredFor": "illustration"
        }
      ],
      "comparisonStatus": "complete",
      "reviewReasons": [
        "CLIENT_FACING_DRAFT",
        "NON_GUARANTEED_ELEMENTS",
        "ILLUSTRATION_REQUIRED",
        "SURRENDER_CHARGE_EXPOSURE"
      ],
      "disclaimerZh": "本比较为内部工作草稿,仅供持牌保险经纪人审阅。所有产品与数据均为虚构演示资料。本文不构成最终推荐、suitability 判断、报价、保单 illustration,也不构成法律或税务意见。",
      "disclaimerEn": "This comparison is an internal working draft for licensed-agent review. All products and data are fictional demonstration materials. It is not a final recommendation, a suitability determination, a quote, a policy illustration, or legal or tax advice.",
      "meta": {
        "comparisonEngineVersion": 1,
        "factRegistryVersion": 1
      }
    },
    "snapshotSha256": "203654bfdc8f0458628c428e30292e48e5937a386bf7288dd00c777ff905c455",
    "workflowDecision": "allow_internal_draft",
    "requiredApprovalLevel": "enhanced_review",
    "reviewReasons": [
      "CLIENT_FACING_DRAFT",
      "NON_GUARANTEED_ELEMENTS",
      "ILLUSTRATION_REQUIRED",
      "SURRENDER_CHARGE_EXPOSURE"
    ],
    "checklist": [
      {
        "key": "desiredCoverageAmount",
        "labelZh": "期望身故保额",
        "labelEn": "Desired death benefit",
        "sourceKind": "missing_client_info"
      },
      {
        "key": "tobaccoUse",
        "labelZh": "吸烟状况",
        "labelEn": "Tobacco use",
        "sourceKind": "missing_client_info"
      },
      {
        "key": "underwritingClass",
        "labelZh": "核保分类",
        "labelEn": "Underwriting class",
        "sourceKind": "missing_client_info"
      },
      {
        "key": "employerGroupCoverage",
        "labelZh": "团体/雇主保障",
        "labelEn": "Employer or group coverage",
        "sourceKind": "missing_client_info"
      },
      {
        "key": "plannedPremiumDuration",
        "labelZh": "计划缴费年限",
        "labelEn": "Planned premium duration",
        "sourceKind": "missing_client_info"
      },
      {
        "key": "cashValueTimeHorizon",
        "labelZh": "现金价值时间目标",
        "labelEn": "Cash-value time horizon",
        "sourceKind": "missing_client_info"
      },
      {
        "key": "withdrawalExpectations",
        "labelZh": "取用预期",
        "labelEn": "Withdrawal expectations",
        "sourceKind": "missing_client_info"
      },
      {
        "key": "personalizedIllustration",
        "labelZh": "个性化 illustration",
        "labelEn": "Personalized illustration",
        "sourceKind": "missing_client_info"
      }
    ],
    "reviewState": "pending_review",
    "reviewer": null,
    "decisionNote": null,
    "revisionInstructions": null,
    "createdAt": "2026-08-01T10:00:00+00:00",
    "updatedAt": "2026-08-01T10:00:00+00:00",
    "citationUrls": {
      "cit_023": "/documents/demo-termplus-20.pdf#page=2",
      "cit_001": "/documents/demo-indexflex-ul.pdf#page=2",
      "cit_024": "/documents/demo-termplus-20.pdf#page=2",
      "cit_002": "/documents/demo-indexflex-ul.pdf#page=3",
      "cit_025": "/documents/demo-termplus-20.pdf#page=2",
      "cit_003": "/documents/demo-indexflex-ul.pdf#page=2",
      "cit_026": "/documents/demo-termplus-20.pdf#page=4",
      "cit_004": "/documents/demo-indexflex-ul.pdf#page=3",
      "cit_005": "/documents/demo-indexflex-ul.pdf#page=3",
      "cit_027": "/documents/demo-termplus-20.pdf#page=2",
      "cit_006": "/documents/demo-indexflex-ul.pdf#page=5",
      "cit_007": "/documents/demo-indexflex-ul.pdf#page=6",
      "cit_008": "/documents/demo-indexflex-ul.pdf#page=5",
      "cit_009": "/documents/demo-indexflex-ul.pdf#page=5",
      "cit_010": "/documents/demo-indexflex-ul.pdf#page=5",
      "cit_011": "/documents/demo-indexflex-ul.pdf#page=4",
      "cit_012": "/documents/demo-indexflex-ul.pdf#page=5",
      "cit_013": "/documents/demo-indexflex-ul.pdf#page=5",
      "cit_014": "/documents/demo-indexflex-ul.pdf#page=5",
      "cit_015": "/documents/demo-indexflex-ul.pdf#page=6",
      "cit_028": "/documents/demo-termplus-20.pdf#page=5",
      "cit_029": "/documents/demo-termplus-20.pdf#page=5",
      "cit_030": "/documents/demo-termplus-20.pdf#page=5",
      "cit_016": "/documents/demo-indexflex-ul.pdf#page=7",
      "cit_017": "/documents/demo-indexflex-ul.pdf#page=7",
      "cit_018": "/documents/demo-indexflex-ul.pdf#page=7",
      "cit_019": "/documents/demo-indexflex-ul.pdf#page=8",
      "cit_031": "/documents/demo-termplus-20.pdf#page=6",
      "cit_032": "/documents/demo-termplus-20.pdf#page=6",
      "cit_033": "/documents/demo-termplus-20.pdf#page=6",
      "cit_020": "/documents/demo-indexflex-ul.pdf#page=8",
      "cit_021": "/documents/demo-indexflex-ul.pdf#page=8",
      "cit_022": "/documents/demo-indexflex-ul.pdf#page=8"
    },
    "events": [
      {
        "eventId": "evt_fixture_created",
        "reviewId": "rev_fixture_case_a",
        "eventType": "REVIEW_CREATED",
        "actor": "Demo Reviewer",
        "payload": {},
        "occurredAt": "2026-08-01T10:00:00+00:00"
      }
    ]
  }
} as unknown as Record<string, ReviewDetailView>;

export const queueFixture: ReviewSummaryView[] = [
  {
    "reviewId": "rev_fixture_case_c",
    "reviewState": "pending_review",
    "workflowDecision": "block_client_draft",
    "requiredApprovalLevel": "licensed_agent_required",
    "clientDisplayName": "Demo Client C",
    "clientCaseId": "DEMO-2026-003",
    "productAName": "Demo SecureRate 5",
    "productBName": "Demo IndexFlex UL",
    "reviewReasonCount": 8,
    "createdAt": "2026-08-01T10:00:00+00:00",
    "updatedAt": "2026-08-01T10:00:00+00:00"
  },
  {
    "reviewId": "rev_fixture_case_a",
    "reviewState": "pending_review",
    "workflowDecision": "allow_internal_draft",
    "requiredApprovalLevel": "enhanced_review",
    "clientDisplayName": "Demo Client A",
    "clientCaseId": "DEMO-2026-001",
    "productAName": "Demo TermPlus 20",
    "productBName": "Demo IndexFlex UL",
    "reviewReasonCount": 4,
    "createdAt": "2026-08-01T10:00:00+00:00",
    "updatedAt": "2026-08-01T10:00:00+00:00"
  },
  {
    "reviewId": "rev_fixture_no_client",
    "reviewState": "pending_review",
    "workflowDecision": "allow_internal_draft",
    "requiredApprovalLevel": "enhanced_review",
    "clientDisplayName": null,
    "clientCaseId": null,
    "productAName": "Demo TermPlus 20",
    "productBName": "Demo IndexFlex UL",
    "reviewReasonCount": 4,
    "createdAt": "2026-08-01T10:00:00+00:00",
    "updatedAt": "2026-08-01T10:00:00+00:00"
  },
  {
    "reviewId": "rev_fixture_approved",
    "reviewState": "approved",
    "workflowDecision": "allow_internal_draft",
    "requiredApprovalLevel": "enhanced_review",
    "clientDisplayName": "Demo Client A",
    "clientCaseId": "DEMO-2026-001",
    "productAName": "Demo TermPlus 20",
    "productBName": "Demo IndexFlex UL",
    "reviewReasonCount": 4,
    "createdAt": "2026-08-01T10:00:00+00:00",
    "updatedAt": "2026-08-02T11:00:00+00:00"
  },
  {
    "reviewId": "rev_fixture_archived",
    "reviewState": "pending_review",
    "workflowDecision": "allow_internal_draft",
    "requiredApprovalLevel": "enhanced_review",
    "clientDisplayName": "Demo Client A",
    "clientCaseId": "DEMO-2026-001",
    "productAName": "Demo TermPlus 20",
    "productBName": "Demo IndexFlex UL",
    "reviewReasonCount": 4,
    "createdAt": "2026-08-01T10:00:00+00:00",
    "updatedAt": "2026-08-01T10:00:00+00:00"
  }
];
