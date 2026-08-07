# Public Regulatory Documents 公开监管文档

This directory holds **public consumer guides** used by the demo alongside the
fictional product brochures. They are kept strictly separate from the fictional
products: manifest entries here use `documentType: "regulatory_guide"` and
`isFictional: false`, and the UI and metadata filters must never mix the two.

本目录存放 Demo 使用的**公开消费者指南**,与虚构产品手册严格分离
(`documentType: "regulatory_guide"`、`isFictional: false`)。

## Not committed to git 不提交到仓库

Third-party PDFs are **not** committed to this repository unless their terms
clearly allow redistribution. Download them locally from the official sources
below; `.gitignore` excludes `*.pdf` in this directory.

第三方 PDF **不**提交到仓库。请按下方官方来源自行下载到本目录;
`.gitignore` 已排除本目录下的 `*.pdf`。

## Official download sources 官方下载来源

### 1. California Department of Insurance — Life Insurance Guide

- Publisher 发布方: California Department of Insurance (CDI)
- Official site 官网: <https://www.insurance.ca.gov>
- Navigation 路径: Consumers → Insurance Guides → Life Insurance Guide
  (<https://www.insurance.ca.gov/01-consumers/105-type/95-guides/01-life/>)
- Save as 保存为: `cdi-life-insurance-guide.pdf` (in this directory)

### 2. NAIC — Life Insurance Buyer's Guide

- Publisher 发布方: National Association of Insurance Commissioners (NAIC)
- Official site 官网: <https://content.naic.org>
- Navigation 路径: Consumer → Life Insurance → Life Insurance Buyer's Guide
- Save as 保存为: `naic-life-insurance-buyers-guide.pdf` (in this directory)

If a navigation path changes, locate the guide by name on the official site;
do not download it from third-party mirrors.

## Manifest

`manifest.json` in this directory describes the expected local files and their
official sources. It is validated by `scripts/validate-data.ts`.
