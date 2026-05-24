# MyClipboard

macOS 菜单栏剪贴板管理器。

## 开发运行

```bash
npm install
npm start
```

## 打包发布

```bash
npm run build:mac
```

产物在 `dist/` 目录：
- `MyClipboard-1.0.0-arm64.dmg` — 双击安装

如需公证和签名，配置 `CSC_LINK`、`APPLE_ID` 等环境变量后重新打包。
