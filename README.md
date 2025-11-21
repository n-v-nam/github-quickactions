# Tomemiru Release Manager (VSCode Extension)

Extension giúp điều phối quy trình release cho toàn bộ hệ thống Tomemiru (frontend, API, database, …) trực tiếp trong VSCode. Mỗi repo có block riêng với đầy đủ thao tác git/GitHub + deploy, đảm bảo luôn có bước xác nhận trước khi push/publish/tag.

## Tổng quan Dashboard

- Giao diện webview viết bằng Vue 3, hiển thị theo dạng tab (mỗi tab = 1 repo cấu hình trong VSCode settings).
- Mọi repo luôn có block mặc định, không cần nhập PR trước.
- Toàn bộ trạng thái chạy workflow được stream về dashboard và đồng thời hiển thị qua `vscode.window.showInformationMessage`.
- Modal confirm hỗ trợ chuyển nhanh giữa chế độ `dry-run` và `execute`; luôn có bước xác nhận trước các thao tác cuối (push, commit, publish, tag, force push…).

## Nhóm chức năng theo repo

1. **Check & Merge vào develop (theo PR nhập tay)**
   - Kiểm tra từng PR với branch develop.
   - Merge tuần tự các PR hợp lệ, hỗ trợ tùy chọn Squash & Merge và custom commit message.

2. **Tạo PR develop → main**
   - Sinh PR tự động, title mặc định `:rocket: Release dd/MM` nhưng có thể chỉnh trong UI.

3. **DB pre-release (chỉ `tomemiru-db`)**
   - Từ develop: pull mới nhất, tạo branch pre-release, chạy publish `{nextVersion}-pre-release`.

4. **Deploy STG (JP)**
   - Chỉ áp dụng cho `tomemiru` và `tomemiru-api`, luôn force push từ develop sang `deploy-jp`.
   - Với `tomemiru-api`: hỏi có cập nhật version package DB không, cho nhập version, commit và chạy `yarn staging:deploy`.

5. **Merge các release PR (develop → main)**
   - Fetch danh sách PR đang mở, hiển thị để xác nhận.
   - Kiểm tra mergeability, yêu cầu approve GitHub.
   - Tùy chọn Rebase & Merge.

6. **Bump version `package.json`**
   - Checkout branch chỉ định (mặc định develop), pull mới nhất, tăng version theo rule hiện tại, commit và push.

7. **DB official release (chỉ `tomemiru-db`)**
   - Từ main đã sync origin, chạy `yarn publish` tạo version chính thức theo `package.json`.

8. **Tạo và push release tag**
   - Checkout main, đảm bảo đồng bộ, tạo tag `v{package.json.version}` và push.

9. **Reset deploy branches**
   - Chọn danh sách deploy branch của repo, force push main lên các branch đó để đồng bộ.

Mỗi action đều bắn status realtime + có loading riêng trên button để tránh thao tác trùng.

## Cấu trúc thư mục

```
release-vscode-extension
├── package.json                  # metadata extension + contributes + settings
├── tsconfig.json
├── src/
│   ├── extension.ts              # entry point, mở webview panel
│   ├── commands/                 # lệnh cấu hình (Configure Settings,...)
│   ├── services/                 # Auth/Git/GitHub/Config/WorkflowRunner
│   └── views/                    # DashboardProvider, StatusBarManager
├── webviews/
│   └── dashboard/                # Vue 3 app cho dashboard
│       ├── src/
│       │   ├── App.vue
│       │   ├── components/
│       │   ├── store/dashboard.ts
│       │   └── types.ts
│       └── vite.config.ts
└── media/
    └── dashboard/dist/           # bundle đã build cho webview
```

## Công nghệ sử dụng

- TypeScript + VSCode Extension API.
- Vue 3 + Vite cho webview dashboard.
- `simple-git` cho thao tác git (checkout, pull, push, tag, rebase, force push…).
- `@octokit/rest` để tương tác GitHub (PR, merge, status…).
- Không còn phụ thuộc `release-config.json`; toàn bộ config lấy từ VSCode settings.

## Command Palette hiện có

- `Tomemiru Release: Open Dashboard`
- `Tomemiru Release: Configure Settings`

Mọi workflow đều thao tác trong dashboard, không còn các command đơn lẻ.

## Cấu hình (VSCode Settings `tomemiruRelease`)

| Setting | Mặc định | Giải thích |
| --- | --- | --- |
| `authMethod` | `vscode` | `vscode` (OAuth tích hợp), `env` (đọc `.env`), `manual`. |
| `manualToken` | `""` | PAT dùng khi `authMethod = manual`, lưu trong Secret Storage. |
| `workspaceEnvFile` | `.env` | Đường dẫn file chứa `GITHUB_TOKEN` khi `authMethod = env`. |
| `defaultOwner` | `tomemiru` | GitHub owner mặc định cho toàn bộ repo. |
| `repoPaths` | `{ tomemiru: "../tomemiru", ... }` | Map repo → local path (có thể relative hoặc absolute). |
| `repoConfigs` | xem `package.json` | Khai báo `isDbRepo`, `dependsOnDb`, `dbPackageName`, `deployBranches` cho từng repo. |
| `dryRunByDefault` | `true` | Modal confirm mặc định chọn dry-run. |

> Lưu ý: extension chỉ đọc cấu hình tại đây, không dùng `release-config.json` nữa.

## Thiết lập & chạy thử

```bash
cd tomemiru-personal-tools/release-vscode-extension
npm install
npm run compile
```

### Chạy Extension Development Host

1. Mở project trong VSCode rồi nhấn `F5` (Run → Start Debugging).
2. Cửa sổ `[Extension Development Host]` sẽ xuất hiện.
3. Tại cửa sổ mới:
   - Mở Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`).
   - Gõ `Tomemiru Release` để mở Dashboard hoặc Configure Settings.

## Checklist kiểm thử

- Cập nhật VSCode settings: `repoPaths`, `repoConfigs`, token GitHub.
- Mở Dashboard → xác minh các tab repo hiển thị đúng.
- Chạy thử từng action ở chế độ dry-run, xem status log trong dashboard + VSCode notification.
- Chạy thực tế một action đơn giản (ví dụ bump version) trên repo test để kiểm tra confirm modal, loading state, log.

## Liên hệ

- Owner: @azoom-nguyen-van-nam, @n-v-nam