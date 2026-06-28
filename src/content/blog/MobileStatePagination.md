---
title: 在移动端浏览器上使用状态分页
excerpt: 使用状态切换组织移动端单页体验，并处理原生滚动、横向轮播和浏览器下拉刷新之间的冲突。
publishDate: 2026-06-28
updatedAt: 2026-06-28
tags:
  - Frontend
  - Mobile
  - JavaScript
  - CSS
image: https://upload.wikimedia.org/wikipedia/commons/c/c3/Opera_Mini_using_the_new_interface_for_Wikipedia_mobile.jpg
---

本篇文章记录一次个人站点首页移动端适配的修复过程。问题本身并不复杂：页面有 `home`、`about`、`blogs` 三种状态，前两者更像单页展示，最后一个则需要显示文章列表，并保留横向滑动的博客卡片。

真正麻烦的地方在于移动端浏览器并不只有一种滚动行为。页面纵向滚动、横向 carousel 滚动、触摸手势切换状态、浏览器下拉刷新，这几种行为会同时竞争同一组手势。如果没有明确区分边界，很容易出现“某个状态正常，另一个状态完全不能滑动”的问题。

## 页面状态

这个首页并不是传统意义上的多页面路由，而是通过一个状态字段控制当前视图：

```html
<main class="story-home is-cover" data-carousel-root data-view="cover">
  ...
</main>
```

脚本中维护三个状态：

```ts
type StoryView = 'cover' | 'about' | 'posts';
```

其中：

- `cover` 是首页封面。
- `about` 是个人介绍。
- `posts` 是博客列表。

在桌面端，滚轮可以推动状态切换，也可以推动横向 carousel。这个逻辑比较自然，因为桌面端没有浏览器下拉刷新，也没有触摸滚动的惯性边界。

移动端则不同。移动端的 `cover` 和 `about` 更适合保持单屏体验，通过上下滑切换状态；但 `posts` 必须回到原生滚动，因为文章卡片和标签数量会超出一屏。

## 最初的错误

最初的问题来自一个不够清晰的边界：把页面状态切换和页面滚动放在同一个触摸处理逻辑里。

移动端触摸事件大致长这样：

```ts
const handleTouchMove = (event: TouchEvent) => {
  const touch = event.touches[0];
  const deltaX = touch.clientX - touchStartX;
  const deltaY = touch.clientY - touchStartY;

  if (shouldPreventNativeVerticalGesture(deltaX, deltaY, event.target)) {
    event.preventDefault();
  }

  handleVerticalGesture(deltaX, deltaY, elapsed);
};
```

这段逻辑对 `cover` 和 `about` 是合理的，因为这两个状态确实不希望页面发生原生滚动。它们只需要识别上下滑，并切换到前一个或后一个状态。

但当页面进入 `posts` 时，继续使用同一套逻辑就会出问题。因为 `posts` 既需要在顶部向下滑时回到 `about`，又需要在普通情况下允许页面向上滑动，让屏幕向下滚动。如果一律 `preventDefault()`，原生滚动就被吃掉了。

换句话说，错误不在于使用了触摸事件，而在于没有区分“状态分页手势”和“内容滚动手势”。

## 横向轮播的干扰

博客列表中还有一个横向 carousel：

```html
<div class="story-home__track" data-carousel-track tabindex="0">
  ...
</div>
```

在桌面端，滚轮可以被转换成横向滚动。但在移动端，横向滑动本身就是浏览器擅长的原生行为，强行用脚本接管反而会让体验变差。

因此移动端的思路应该是：

- 横向滑动卡片交给 carousel 自己的原生滚动。
- 纵向滑动页面交给 `posts` 的滚动容器。
- 只有状态切换的边界手势交给脚本处理。

对应的 CSS 要允许横向和纵向手势自然发生：

```css
.story-home__track {
  overflow-x: auto;
  overflow-y: hidden;
  touch-action: pan-x pan-y;
  -webkit-overflow-scrolling: touch;
}
```

这里的重点是不要在父容器上粗暴地写 `touch-action: pan-y` 或 `touch-action: none`，否则 carousel 的横向滑动会被一起影响。

## 浏览器下拉刷新

移动端浏览器还有一个特殊行为：当页面处于顶部时继续向下拉，浏览器可能触发刷新。

这和我们想要的行为冲突。因为在 `posts` 的顶部向下拉，本意是返回上一个状态，也就是 `about`，而不是刷新页面。

解决方法不是重新接管整个 `posts` 页面，而是只处理顶部边界：

```ts
const isPostsTopPull = (deltaX: number, deltaY: number) =>
  isMobileLayout()
  && root.dataset.view === 'posts'
  && touchStartScrollY <= 1
  && getPageScrollTop() <= 1
  && deltaY > 0
  && Math.abs(deltaY) > Math.abs(deltaX) * 1.1;
```

只有满足以下条件时，才认为这是“顶部下拉返回上一页”：

- 当前是移动端布局。
- 当前状态是 `posts`。
- 手势开始时页面就在顶部。
- 当前页面仍然在顶部。
- 手势方向是向下拉。
- 纵向位移明显大于横向位移。

这样普通的向上滑动不会被拦截，页面可以继续原生滚动；只有顶部下拉才会进入状态切换。

```ts
if (isPostsTopPull(deltaX, deltaY)) {
  event.preventDefault();

  const elapsed = Date.now() - touchStartTime;
  if (handleVerticalGesture(deltaX, deltaY, elapsed)) {
    touchHandledAt = Date.now();
    touchStartTime = 0;
  }
}
```

这段代码里 `preventDefault()` 的作用非常窄：只挡住浏览器的下拉刷新，不阻止正常阅读时的页面滚动。

## 正确的滚动容器

另一个容易踩坑的地方是滚动容器。

一开始尝试让 `body` 或 `window` 在 `posts` 状态下恢复滚动，但这会和 `cover/about` 的单页锁定互相影响。更稳定的做法是让首页根节点自己成为滚动容器。

在移动端：

```css
.story-home {
  height: 100svh;
  overflow-x: hidden;
  overflow-y: hidden;
}

.story-home[data-view='posts'] {
  height: 100svh;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior-y: contain;
  -webkit-overflow-scrolling: touch;
}
```

这样 `cover` 和 `about` 仍然是单屏状态，不会拖动整个页面；而 `posts` 进入自己的滚动上下文，内容超出一屏时可以正常纵向滚动。

脚本中也要读取正确的滚动源：

```ts
const getPageScrollTop = () =>
  isMobileLayout() && root.dataset.view === 'posts'
    ? root.scrollTop
    : window.scrollY;
```

如果 CSS 使用 `.story-home` 作为滚动容器，而脚本仍然判断 `window.scrollY`，就会出现“实际已经滚动了，但脚本认为还在顶部”的错判。这个错判会再次导致手势被错误拦截。

## 状态切换

状态切换时，除了修改 `data-view`，还需要同步到 `html` 和 `body`，方便 CSS 精确控制根节点行为：

```ts
const setView = (view: StoryView) => {
  root.dataset.view = view;
  document.documentElement.dataset.storyView = view;
  document.body.dataset.storyView = view;
};
```

然后移动端可以按状态控制根节点：

```css
html.story-home-lock,
body.story-home-lock {
  overflow: hidden;
  overscroll-behavior-y: contain;
}

html.story-home-lock[data-story-view='posts'],
body.story-home-lock[data-story-view='posts'] {
  overflow: hidden;
  overscroll-behavior-y: contain;
}
```

这里 `posts` 也让 `body` 保持隐藏，是因为真正滚动的不是 `body`，而是 `.story-home`。这可以避免根页面和内部容器同时滚动，造成滑动方向、回弹、刷新手势混杂在一起。

## 最终规则

最终可以把移动端行为总结为四条规则：

- `home` 和 `about` 是状态分页，不进行原生页面滚动。
- `blogs` 是内容页，使用 `.story-home` 原生纵向滚动。
- `blogs` 内的 carousel 保留原生横向滚动。
- 只有当 `blogs` 已经在顶部并继续向下拉时，才拦截手势并返回 `about`。

这几条规则看起来简单，但重要的是不要让它们混在一起。状态分页和内容滚动不是同一件事，横向 carousel 和纵向阅读也不是同一件事。移动端浏览器的手势系统很敏感，越是粗暴地统一处理，越容易和浏览器默认行为打架。

## 小结

这次修复的关键不是某一行 CSS 或某一个 `preventDefault()`，而是重新划清责任：

- CSS 决定哪个容器负责滚动。
- JavaScript 只处理状态切换和边界手势。
- 浏览器继续负责普通滚动和惯性滑动。

当页面以状态分页组织内容时，移动端适配最容易出错的地方就是“看起来像一页，实际上又需要局部滚动”。处理这类问题时，应当先确定滚动容器，再决定哪些手势真的需要脚本介入。只要滚动边界是清晰的，移动端浏览器就会比我们写的大多数手势逻辑更可靠。
