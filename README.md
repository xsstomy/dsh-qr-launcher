# dsh-qr-launcher

让 DeepSeek Harness (DSH) Web 界面「手机扫一扫即可访问」的轻量级插件：

- **终端二维码**：`dsh web` 启动就绪后，终端自动打印局域网访问二维码（ANSI，主题无关）+ 明文 URL；
- **Web 面板**：DSH 设置页新增「二维码访问」分节，可扫码、复制明文 URL、调节尺寸、刷新；
- **IP 自动探测**：排除虚拟网卡/隧道优先选择真实局域网 IP；支持 `DSH_QR_IP` 手动指定；
- **零侵入、零运行时依赖**：不改动 DSH 官方任何文件，不引入任何运行时 npm 依赖（二维码引擎已内置）。

> ⚠️ 安全提示：二维码包含访问令牌（token），任何人扫码即可访问本机 DSH。
> 请仅在可信局域网内使用；在公共 WiFi / 屏幕共享时不要暴露终端或本面板。

---

## 安装

`dsh plugin` 会把包加入 profile 的 `dependencies` 与 `dsh.profile.bundles`
层栈，并应用本包 `dsh.bundle.patch` 声明的 `cordis.patch.yml`（插入
`qr-launcher` Loader 行）。安装后重启 `dsh web` 即生效。

### 方式一：npm registry（需要 npm 账号）

发布到 npm 后：

```bash
dsh plugin --profile web add dsh-qr-launcher
```

### 方式二：本地路径安装（无需 npm 账号，推荐，本机当前采用）

直接把插件源码目录作为依赖装进 profile，pnpm 走本地 `link:` 协议，**不经过
npm registry**，也**不需要登录 npm**：

```bash
# 在插件目录的上级执行（或直接写绝对路径，均可）：
dsh plugin --profile web add dsh-qr-launcher
# 等价于：
dsh plugin --profile web add /Users/xiashi/work/github/projects/dsh-qr-launcher
```

安装后验证（AC-01）：

```bash
dsh plugin --profile web list   # 应出现 dsh-qr-launcher
```

特点与注意事项：

- pnpm 以 `link:` 方式安装，`~/.dsh/profiles/web/node_modules/dsh-qr-launcher`
  是指向插件仓库的**符号链接**：后续改插件源码**无需重新安装**，重启 `dsh web`
  即生效（本包没有构建步骤，源码即产物）；
- 因此**不要删除/移动插件仓库目录**，否则 profile 里的链接会失效；
- 安装前建议先备份 profile（出问题可回滚）：

  ```bash
  cp ~/.dsh/profiles/web/{package.json,pnpm-lock.yaml,cordis.patch.yml} /tmp/dsh-web-profile-backup/ 2>/dev/null || \
    mkdir -p /tmp/dsh-web-profile-backup && cp ~/.dsh/profiles/web/{package.json,pnpm-lock.yaml,cordis.patch.yml} /tmp/dsh-web-profile-backup/
  ```

### 方式三：tarball 离线安装（适合拷到别的机器 / 无网环境）

```bash
cd dsh-qr-launcher
npm pack            # 生成 dsh-qr-launcher-<version>.tgz（约 26 kB，不含 devDependencies）
# 把 tgz 拷到目标机器任意目录，然后在目标机器上：
dsh plugin --profile web add /path/to/dsh-qr-launcher-0.1.0.tgz
```

> 目标机器同样需要安装 pnpm（`dsh plugin` 依赖它）与 dsh。

## 卸载与回滚

```bash
dsh plugin --profile web remove dsh-qr-launcher
```

重启 `dsh web` 后，终端与设置页均不再显示二维码（AC-08）。

若安装过程出了问题，可用备份还原：

```bash
cp /tmp/dsh-web-profile-backup/package.json ~/.dsh/profiles/web/
cp /tmp/dsh-web-profile-backup/pnpm-lock.yaml ~/.dsh/profiles/web/
cp /tmp/dsh-web-profile-backup/cordis.patch.yml ~/.dsh/profiles/web/
cd ~/.dsh/profiles/web && pnpm install
```

## 使用

1. 确保手机与运行 DSH 的机器在同一局域网；想让手机真正能连上，还需要把
   webserver 绑定到 `0.0.0.0`（推荐直接安装 [dsh-lan-access](https://www.npmjs.com/package/dsh-lan-access)）。
2. 重新启动：`dsh --profile web`。启动完成后终端会打印二维码与明文 URL
   （前提：webserver 已绑定 `0.0.0.0` 且探测到局域网 IP）。
3. 手机扫码 → 直接进入 DSH Web（无需重复认证）。
4. 在电脑上打开 DSH Web → 设置 →「二维码访问」：同样可扫码/复制链接。

> DSH 的**配置平面**（设置、模型/凭据、Agent Preset 等）按官方安全设计仅限
> 本机回环访问；手机扫码后可用「对话/看进度/会话内选模型」，配置变更请在工作
> 电脑本机完成（与 `dsh-lan-access` 相同的边界）。

## 配置（环境变量）

| 变量 | 说明 | 默认 |
| :--- | :--- | :--- |
| `DSH_QR_IP` | 手动指定二维码所用 IP（须为合法 IPv4 字面量） | 自动探测 |
| `DSH_QR_TERMINAL=0` | 关闭终端二维码输出（Web 面板不受影响） | 开启 |
| `DSH_QR_NO_TERMINAL=1` | 同上，另一写法 | 开启 |
| `DSH_QR_LANG=en` | 终端文案切换为英文 | 中文 |

示例：

```bash
DSH_QR_IP=192.168.1.100 DSH_QR_TERMINAL=0 dsh --profile web
```

## 行为说明

- 二维码内容：`http://{局域网IP}:{端口}/?token={进程令牌}`，其中 IP 按
  「真实网卡优先、虚拟/隧道网卡兜底」的顺序从**全部非内部 IPv4** 中挑选，
  与 DSH 自身的 `/api` 信任栅栏同源；
- 若 webserver 未绑定 `0.0.0.0`，终端与 Web 面板都会给出明确提示（安装
  `dsh-lan-access` 或覆盖 webserver 行 host），不会打印无效二维码；
- 若探测不到局域网 IP，终端打印「未检测到局域网 IP，请检查网络」；
- Web 面板状态由宿主在**每次 index 响应**时实时采样注入（IP/端口/token 变化
  后刷新页面即可），无需额外 RPC；
- 二维码生成 < 10ms，不影响 DSH 启动；
- 不存储 token；注入的页面数据只出现在已认证的 index 响应中（未认证请求
  返回 401，无任何内容）。

## 兼容性

- DSH v0.1.x（Cordis 插件机制，`dsh web`/`--profile web`）；
- Node.js ≥ 18；
- 可与 `dsh-lan-access` 联合使用（它负责开启局域网监听，本插件负责展示）；
- 不建议与其他「二维码/移动访问」类插件（如 `dsh-pocket` 等）并存，以免
  重复展示。

## 开发

```bash
npm install        # 安装测试依赖（jsqr / playwright-core，仅开发用）
npm test           # 单元测试：QR 编码→栅格化→jsqr 解码回路、IP 选择、状态、终端渲染
```

端到端验证（可选，需本机 Chrome）：

```bash
# 1) 用一份隔离 profile 启动 dsh web（示例端口 3095）
#    dsh --profile qrtest --port 3095 --no-open
# 2) 打开页面并进入设置→二维码访问，断言画布渲染：
node test/e2e.mjs "http://127.0.0.1:3095/?token=<从终端日志取>"
```

## 文件结构

```
lib/index.js        宿主插件（terminal 二维码 + index 状态注入）
lib/net.js          局域网 IPv4 探测/选择（纯函数，可测）
lib/state.js        二维码状态推导（纯函数，可测）
lib/qr.js           二维码矩阵生成（封装 vendor 引擎）
lib/terminal.js     终端 ANSI 二维码与文案
lib/client.js       浏览器端 bundle（设置页「二维码访问」面板）
vendor/qrcode/      内置 QR Code 引擎（Kazuhiko Arase，MIT，见 THIRD_PARTY_NOTICES）
cordis.patch.yml    bundle patch：插入 qr-launcher Loader 行
test/               单元测试 + e2e 脚本
```

## 许可证

MIT © xsstomy。内置二维码引擎与 devDependencies 的许可证见
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。