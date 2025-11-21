# Hướng dẫn Test Extension

## Cách 1: Chạy Extension Development Host (Khuyến nghị)

### Bước 1: Mở project trong VSCode
```bash
cd tomemiru-personal-tools/release-vscode-extension
code .
```

### Bước 2: Compile TypeScript
```bash
npm run compile
```

### Bước 3: Chạy Extension
1. Nhấn `F5` hoặc vào menu **Run > Start Debugging**
2. Một cửa sổ VSCode mới sẽ mở với tiêu đề "[Extension Development Host]"
3. Extension sẽ được load trong cửa sổ này

### Bước 4: Test các tính năng

#### Test Authentication
1. Mở Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
2. Gõ `Tomemiru Release: Configure Settings`
3. Chọn authentication method (vscode/env/manual)
4. Nếu chọn `vscode`, sẽ có popup đăng nhập GitHub

#### Test Start Workflow
1. Đảm bảo có file `release-config.json` trong workspace
2. Command Palette → `Tomemiru Release: Start Workflow`
3. Chọn repo
4. Nếu `useAdvancedPRSelection = true`: sẽ hiện webview với checkbox
5. Nếu `useAdvancedPRSelection = false`: sẽ hiện QuickPick

#### Test PR Selection UI (Advanced)
1. Trong Extension Development Host, mở sidebar "Tomemiru Release"
2. Click vào "PR Selection" view
3. Chọn PRs bằng checkbox
4. Xem validation status (✅/⚠️/❌)
5. Click "Xác nhận" để chọn PRs

#### Test Dry-run Mode
1. Mở Settings (`Cmd+,`)
2. Tìm `tomemiruRelease.dryRunByDefault`
3. Set = `true` để bật dry-run
4. Chạy bất kỳ command nào (Merge PRs, Create Release PR, etc.)
5. Sẽ thấy dialog "[DRY-RUN]" và có thể chọn "Thực thi thật" hoặc "Chỉ xem"

#### Test Workflow Commands
- `Tomemiru Release: Check PRs` - Kiểm tra PRs có sẵn sàng merge không
- `Tomemiru Release: Merge PRs` - Merge PRs vào develop
- `Tomemiru Release: Create Release PR` - Tạo PR từ develop → main
- `Tomemiru Release: Bump Version` - Bump version trong package.json
- `Tomemiru Release: Merge Release PR` - Merge release PR vào main
- `Tomemiru Release: Create Tag` - Tạo và push tag
- `Tomemiru Release: Deploy Branch` - Xử lý deploy branch

## Cách 2: Package và Install Extension

### Build extension package
```bash
npm run package
```

Sẽ tạo file `.vsix` trong thư mục extension.

### Install extension
1. VSCode → Extensions (`Cmd+Shift+X`)
2. Click "..." menu → "Install from VSIX..."
3. Chọn file `.vsix` vừa tạo
4. Reload VSCode

## Cách 3: Debug với Breakpoints

1. Đặt breakpoint trong code TypeScript
2. Nhấn `F5` để start debugging
3. Trong Extension Development Host, thực hiện action trigger breakpoint
4. Debugger sẽ dừng tại breakpoint
5. Có thể inspect variables, step through code

## Test Checklist

### ✅ Authentication
- [ ] VSCode OAuth login
- [ ] Env file token
- [ ] Manual token input
- [ ] Status bar hiển thị user

### ✅ Configuration
- [ ] Load `release-config.json`
- [ ] Validate config schema
- [ ] Settings UI hoạt động

### ✅ PR Selection
- [ ] Fetch PRs từ GitHub
- [ ] QuickPick mode hoạt động
- [ ] Advanced UI với checkbox
- [ ] Validation hiển thị đúng
- [ ] CI status check
- [ ] Conflict detection

### ✅ Dry-run
- [ ] Dry-run mode bật/tắt
- [ ] Dialog confirmation hiển thị
- [ ] Preview message đúng
- [ ] Có thể chuyển sang "Thực thi thật"

### ✅ Workflow Commands
- [ ] Check PRs
- [ ] Merge PRs (với dry-run)
- [ ] Create Release PR (với dry-run)
- [ ] Bump Version (với dry-run)
- [ ] Merge Release PR (với dry-run)
- [ ] Create Tag (với dry-run)
- [ ] Deploy Branch

### ✅ Dashboard
- [ ] Hiển thị selected PRs
- [ ] Status message update
- [ ] Action buttons hoạt động
- [ ] Refresh button

## Troubleshooting

### Extension không load
- Kiểm tra `package.json` có đúng `main` entry point
- Kiểm tra `activationEvents` có match
- Xem Output panel → "Log (Extension Host)"

### Lỗi authentication
- Kiểm tra GitHub token có đúng scope (repo, workflow, write:packages)
- Kiểm tra `.env` file nếu dùng env method

### Lỗi config
- Kiểm tra `release-config.json` có đúng schema
- Xem error message trong Output panel

### Webview không hiển thị
- Kiểm tra CSP trong HTML template
- Kiểm tra `localResourceRoots` trong webview options
- Xem Console trong Developer Tools (Help → Toggle Developer Tools)

## Debug Tips

1. **Console Logs**: Mở Developer Tools (`Cmd+Shift+I` / `Ctrl+Shift+I`) để xem console logs
2. **Extension Host Logs**: View → Output → chọn "Log (Extension Host)"
3. **Webview DevTools**: Right-click vào webview → Inspect Element

## Test với Real Data

Để test với data thật:
1. Tạo `release-config.json` với repo thật
2. Đảm bảo có GitHub token với quyền phù hợp
3. Test với PRs thật (có thể tạo test PRs trước)
4. **Lưu ý**: Dry-run mode sẽ không thực thi, an toàn để test

