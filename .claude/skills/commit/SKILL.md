---
name: commit
description: "完整的繁體中文 Git commit + push + 驗證流程。自動分析變更內容、生成繁體中文 commit 訊息、推送到遠端並確認成功。"
---

# Commit & Push Skill

當使用者執行 `/commit` 時，依照以下步驟完整執行 Git 工作流程：

## 執行步驟

### 步驟 1：分析現有變更
執行以下指令了解目前狀態：
```bash
git status
git diff --staged
git diff
git log --oneline -3
```

### 步驟 2：確認要提交的範圍
- 如果有**未暫存**的變更，詢問使用者是否要一併加入，或僅提交已暫存的部分
- 如果**完全沒有**變更，回報「沒有需要提交的內容」並停止

### 步驟 3：生成繁體中文 commit 訊息
根據變更內容，撰寫符合以下規則的 commit 訊息：

**訊息格式：**
```
<類型>: <簡短描述（繁體中文，25字以內）>

<詳細說明（若有必要）>
```

**類型前綴（使用中文或英文皆可）：**
- `feat` / `功能` - 新功能
- `fix` / `修復` - Bug 修復
- `refactor` / `重構` - 程式碼重構
- `style` / `樣式` - UI/CSS 調整
- `docs` / `文件` - 文件更新
- `chore` / `維護` - 設定、依賴更新

**禁止：**
- 使用簡體中文
- 使用英文描述（技術術語除外）
- 訊息過於籠統（如「更新檔案」）

### 步驟 4：執行 commit
```bash
git add <相關檔案>   # 依實際情況加入
git commit -m "<生成的訊息>"
```

### 步驟 5：推送到遠端
```bash
git push origin $(git branch --show-current)
```

如果 push 失敗（例如需要先 pull），先執行：
```bash
git pull --rebase origin $(git branch --show-current)
git push origin $(git branch --show-current)
```

### 步驟 6：驗證成功
```bash
git log --oneline -1
git ls-remote origin HEAD
```

比對本地與遠端的 commit hash 是否一致。

### 步驟 7：回報結果
以以下格式向使用者確認：
```
✅ 提交成功
- Commit: <hash> - <訊息>
- 分支: <branch-name>
- 遠端: 已同步 (hash 一致)
```

若任何步驟失敗，說明錯誤原因並提供解決方案，**不要** 靜默跳過。

## 注意事項
- 永遠不要使用 `git add .` 或 `git add -A` 暗自加入所有檔案，先顯示清單讓使用者確認
- 不要加入 `.env`、密鑰檔案或大型二進位檔
- 若使用者在指令後附帶說明（如 `/commit 修復登入頁面間距`），將該說明作為 commit 訊息的主軸