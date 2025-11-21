# Tomemiru Release Manager (VSCode Extension)

Extension giúp điều phối workflow release nhiều repo (frontend, backend, DB) ngay trong VSCode với giao diện trực quan, an toàn hơn CLI script hiện tại.

## Tính năng hiện tại

- Sidebar dashboard hiển thị trạng thái repo, workflow và các PR đã chọn.
- Command palette:
  - `Tomemiru Release: Start Workflow` – đọc `release-config.json`, fetch PRs open trên GitHub để chọn merge.
  - `Tomemiru Release: Check PRs`, `Merge PRs`, `Create Release PR`.
  - `Tomemiru Release: Deploy Branch`, `Bump Version`, `Merge Release`, `Create Tag`.
  - `Tomemiru Release: Open Dashboard`.
  - `Tomemiru Release: Configure Settings`.
- Status bar cho biết trạng thái đăng nhập GitHub.
- Service layer (Auth/Git/GitHub/Config) sẵn sàng để gắn logic merge, deploy, publish trong các bước tiếp theo.

## Cấu trúc

```
release-vscode-extension
├── package.json              # khai báo extension
├── tsconfig.json             # cấu hình TypeScript
├── src/
│   ├── extension.ts          # entry point
│   ├── commands/             # lệnh VSCode (start workflow, configure settings,…)
│   ├── services/             # Auth/Git/Github/Config
│   └── views/                # Dashboard webview + status bar
└── media/                    # icon cho activity bar & extension
```

## Công nghệ

- TypeScript + VSCode Extension API.
- `@octokit/rest` để gọi GitHub API.
- `simple-git` để thao tác git (checkout, pull, force-with-lease, validate trạng thái).
- `Ajv` để validate `release-config.json`.
- `Ora`/VSCode progress API để hiển thị tiến trình (sẽ gắn ở các bước workflow sau).

## Thiết lập & chạy thử

```bash
cd tomemiru-personal-tools/release-vscode-extension
npm install
npm run compile
```

### Chạy Extension Development Host

1. Mở thư mục extension trong VSCode:
   ```bash
   code tomemiru-personal-tools/release-vscode-extension
   ```

2. Nhấn `F5` hoặc vào **Run > Start Debugging**

3. Một cửa sổ VSCode mới sẽ mở với tiêu đề "[Extension Development Host]"

4. Trong cửa sổ mới:
   - Mở Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
   - Gõ `Tomemiru Release` để xem tất cả commands
   - Hoặc mở sidebar "Tomemiru Release" để xem Dashboard

### Test Checklist

- ✅ **Authentication**: `Tomemiru Release: Configure Settings` → chọn auth method
- ✅ **Start Workflow**: Chọn repo → fetch PRs → chọn PRs (QuickPick hoặc Advanced UI)
- ✅ **PR Selection UI**: Mở sidebar → "PR Selection" → checkbox + validation
- ✅ **Dry-run Mode**: Settings → `dryRunByDefault = true` → test các commands
- ✅ **Workflow Commands**: Check PRs, Merge PRs, Create Release PR, Bump Version, etc.

Xem chi tiết trong [TESTING.md](./TESTING.md)

## Cấu hình

Extension đọc các settings dưới namespace `tomemiruRelease`:

| Setting | Mặc định | Giải thích |
| --- | --- | --- |
| `authMethod` | `vscode` | `vscode` (OAuth tích hợp), `env` (đọc `.env`), `manual`. |
| `manualToken` | `""` | PAT dùng khi `authMethod = manual`. |
| `workspaceEnvFile` | `.env` | Đường dẫn file chứa `GITHUB_TOKEN` khi `authMethod = env`. |
| `repoPaths` | `{ tomemiru: "../tomemiru", ... }` | Map repo → localPath. |
| `defaultBranches` | xem package.json | Branch main/develop và danh sách deploy branches. |
| `dryRunByDefault` | `true` | Khi mở rộng workflow, mọi action sẽ chạy dry-run trước. |

Có thể chỉnh các giá trị này qua `Tomemiru Release: Configure Settings`.

## TODO kế tiếp

- Thêm PR selection UI đầy đủ (checkbox + validation + conflict detection).
- Triển khai workflow engine (check → merge → release PR → publish → sync).
- Bổ sung dry-run, force-with-lease, rollback UI, release notes generator.

## Liên hệ

- Owner: @azoom-nguyen-van-nam
- Tài liệu chi tiết: `release-automation-tool.plan.md` + `new-idea.md`

