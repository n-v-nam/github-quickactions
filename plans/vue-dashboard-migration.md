# Chuyển Dashboard Webview sang Vue 3

## Mục tiêu
- Bỏ render HTML thủ công từ `DashboardProvider`.
- Tạo front-end Vue 3 (Vite) để quản lý state, UI, event một cách rõ ràng.
- Build bundle (JS/CSS) để VSCode webview nạp, giao tiếp qua `postMessage`.

## Kiến trúc đề xuất
1. **Webview app**: `webviews/dashboard/`
   - Vite + Vue 3 + TypeScript.
   - Component hóa: `DashboardApp`, `RepoSelector`, `PendingList`, `RepoBlock`, `PRCard`, `ActionsGrid`.
   - Store (Pinia hoặc reactive module) chịu trách nhiệm:
     - `currentRepo`, `pendingPRs`, `repoBlocks`, `statusMessage`.
     - Methods: `init(initialState)`, `addPendingPR`, `confirmPRs`, `handleMessage`, `sendCommand`.
2. **Build output**: `media/dashboard/dist/index.html` + `assets/*.js|css`.
3. **DashboardProvider**:
   - Thay `getHtml()` để đọc `dist/index.html`.
   - Inject CSP nonce + `initialState` JSON + URI mapping (`getWebviewUri`).
   - Không render repo blocks bằng string nữa.

## Các bước thực hiện

### 1. Setup project Vue
- `npm install -D vite @vitejs/plugin-vue vue vue-tsc`
- Thư mục `webviews/dashboard/` gồm:
  - `package.json` (hoặc dùng chung root scripts).
  - `tsconfig.json`, `vite.config.ts`.
  - `src/main.ts`, `src/App.vue`, `src/vscode.ts`, `src/store/index.ts`.
- `vite.config.ts` chú ý:
  - `base: ''`, `build.assetsDir = '.'`.
  - Output vào `../../media/dashboard/dist`.
  - Define `process.env.NODE_ENV`.

### 2. Triển khai Vue components
- `App.vue`: layout chính, gồm `RepoSelector`, list `RepoBlock`, status banner.
- `RepoSelector.vue`: dropdown repo, input PR, pending list, buttons (`Thêm`, `Xác nhận`).
- `RepoBlock.vue`: header + list `PRCard` + actions grid.
- `PRCard.vue`: hiển thị chi tiết PR, validation message, nút `Check`, `Merge`, `Remove`.
- `StatusToast.vue`/`StatusBanner`: hiển thị thông báo (success/error) từ store.

### 3. State & Messaging
- `store/dashboard.ts`:
  - `state = reactive({ statusMessage, repoOptions, pendingPRs, repoBlocks, currentRepo... })`.
  - `init(initialState)` nhận từ backend.
  - `handleMessage(event)` cập nhật state theo `message.command`.
  - Methods gửi lệnh: `checkPR`, `mergePR`, `removeRepoBlock`...
- `vscode.ts` helper (`const vscode = acquireVsCodeApi()`).
- Trong `main.ts`:
  - Đọc `window.__INITIAL_STATE__` (object inject bởi provider).
  - `store.init(initialState)`.
  - `window.addEventListener('message', store.handleMessage)`.

### 4. Build Scripts & Gitignore
- Root `package.json`:
  - `"build:webview": "vite build --config webviews/dashboard/vite.config.ts"`
  - `"dev:webview": "vite dev --config ..."`
  - `postinstall`/`prepublish`: chạy `npm run build:webview`.
- `.gitignore`: thêm `media/dashboard/dist`.
- (Option) `README` update hướng dẫn dev webview (`npm run dev:webview` + `vsce watch`).

### 5. Cập nhật DashboardProvider
- Sử dụng `getWebviewUri` cho JS/CSS bundle.
- Inject initialState:
  ```ts
  const initialState = {
    statusMessage: this.statusMessage,
    repoOptions: this.getRepoOptions(),
    repoBlocks: this.repoBlocks,
    config: {...}
  }
  ```
  Trong HTML: `<script nonce="${nonce}">window.__INITIAL_STATE__ = ${serialized};</script>`
- Gửi `repoOptions` qua initial state thay vì render `<option>` server-side.

### 6. Xóa template cũ
- `media/dashboard.html` sẽ chỉ dùng khi develop? → thay bằng `dist/index.html`.
- Nếu vẫn cần fallback, giữ file nhưng minimal.

### 7. Test
- `npm run build:webview`
- `npm run compile`
- F5 extension, mở Dashboard, test:
  - Add PR, pending list, confirm → block hiển thị.
  - Check/Merge/Remove, actions log ok.
  - Reload VSCode → state khởi tạo đúng.

### 8. Lợi ích
- UI logic tập trung ở Vue, ít lỗi event.
- Dễ mở rộng (thêm tabs, filter) chỉ cần update component.
- Có thể unit-test store dễ dàng.

