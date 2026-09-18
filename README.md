# Evigila 的博客

基于 Astro 构建的静态个人博客，内容集中于 .NET、C#、桌面应用与 Web 开发实践。

## 页面

- `/`：首页、近期文章与作者信息
- `/articles`：全部文章
- `/tags`、`/tags/[tag]`：标签目录与筛选结果
- `/posts/[slug]`：文章正文、目录、阅读进度、分享与评论
- `/friend`：友链
- `/about`：作者信息、社交平台与兴趣

## 本地预览

在项目根目录双击 `start-local.bat`，即可启动本地预览服务器。默认访问地址为 `http://127.0.0.1:4321/`。
如果启动失败，窗口会暂停并保留错误信息，按任意键即可关闭。

也可以在命令行中指定端口或监听地址：

```bat
start-local.bat -Port 4322 -ListenAddress 0.0.0.0
```

常用 npm 命令：

```bash
npm run dev
npm run build
npm run preview
```

项目要求 Node.js 22.12.0 或更高版本。根目录启动脚本会在依赖缺失时自动执行 `npm ci`。

## 内容维护

文章位于 `src/content/blog`，Frontmatter 结构由 `src/content.config.ts` 定义。文章封面位于 `public/images/posts`。站点名称、作者信息和外部链接集中维护在 `src/data/site.ts`。

## 设计基线

博客采用 Colligere Workspace 的界面规范作为设计基线，并保留自己的品牌与信息架构：

- Segoe UI 与 17px 普通文字
- `#153A32` 主色和 `#16745F` 强调色
- 68px 顶栏，头像与四个纯图标入口整体居中；单一圆角选择层及顶部边缘标记在项目间平移，文章模块在顶栏下方显示二级导航
- 1180px 集中内容轨道、平面模块、细边框和 48px 标准控件
- 全部文章使用固定三列 Grid 卡片，内容标签结果使用与首页一致的文章行；所有页面复用只包含版权信息的统一页脚
- 980px、760px、520px 响应式断点，最低支持 320px 宽度

博客适配后的现行规范见 [`docs/design.md`](docs/design.md)，人工验收清单见 [`docs/manual-testing.md`](docs/manual-testing.md)。
