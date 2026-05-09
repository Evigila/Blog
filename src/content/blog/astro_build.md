---
title: 使用Astro构建静态博客网站
excerpt: 从零开始使用Astro构建网站，并搭配Github/Cloudflare部署至公网。
publishDate: 2026-05-01
updatedAt: 2026-05-09
tags:
  - Astro
  - Github
  - CloudFlare
  - 教程
---

本篇文章将从零教学如何使用Astro部署静态博客网站，将资源托管在Github仓库中，并搭配使用CloudFlare的工人和Github Action的CICD完成自动部署在公共互联网中。这也是本网站的构建历史。

## 关于 Astro

常见的SSG（Static Site Generation）技术有很多，例如 Hugo, Next.js, Nuxt.js 等等，本站使用Astro构建，因此以此为例。但该教程适用于所有SSG技术。

Astro 是一个专为构建快速、内容驱动型网站（如博客、营销网站、文档、作品集）而设计的现代化开源Web前端框架，与其他框架相比它减少了 JavaScript 的开销和复杂性。如果你需要一个加载速度快、具有良好 SEO 的网站，那么 Astro 是一个不错的选择。

[Astro 官网](https://astro.build/)

> 前提条件：  
> 需要安装 Node.js 运行时环境大于 v22.12.0 的更高双数版本。  
> 奇数版本是不被支持的，例如 v23。  
> 查询 Node.js 版本请使用 `node -v` 命令。  
> 下载 Node.js 请前往官网 https://nodejs.org/

Astro 提供了一键启动命令，允许你快速创建一个新项目。如果这是你第一次创建 Astro 项目，则该命令会首先配置好 Astro 环境：

```bash
npm create astro@latest
```

输入命令后，Astro 会向你显示向导对话，首先是需要你提供一个项目名称，也就是即将创建的文件夹名称。

你可以选择一路使用推荐配置完成向导对话，但 Astro 默认会给你提供一个模板项目。如果你希望完成从零开始搭建属于你自己的页面，则可以选择 Empty template 空白模板。

这里推荐勾选 Git 初始化以及 Install dependencies 选项，当然它们都是默认选项。

简单介绍一下安装后的项目结构：

- `src/`             ---> 源码目录
- `public/`          ---> 资源目录
- `package.json`     ---> 项目清单
- `astro.config.mjs` ---> Astro 配置文件
- `tsconfig.json`    ---> TypeScript 配置文件

你应该将图片等非代码资源存放在public/目录下，而将代码存放在src/目录下。

> 注意，`src/pages/`是一个特殊的目录，它规定了 Astro 最基本的页面路径。删除该目录会导致 Astro 无法正常工作！

常用的开发命令：

- `npm run dev`      ---> 启动服务器，你该前往默认 `http://localhost:4321` 网址上预览你的网站！你所看到的默认是 `index.astro` 的内容。
- `npm run build`    ---> 构建你的网站

Astro 支持热更新，这意味着你可以在不重启服务器的情况下，修改源码并立刻获得最新版本。

使用 `localhost` 而不是 `127.0.0.1` 访问网站，后者有可能无法访问成功。

## 创建页面

在 `pages` 文件夹下方继续创建 `.astro` 文件，每一个文件都将被视为一个页面。

网页路由的方式则是从`pages/`为根，以文件名称为路由路径。例如`pages/myfirstpost`的网址将是 `localhost:4321/myfirstpost`，而如果在 `pages`下再创建一层文件夹`folder`，那么新的网址将是`localhost:4321/folder/myfirstpost`。

<!--待补充-->