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
image: https://github.com/Evigila/picx-images-hosting/raw/master/chrome-displayed-on-screen.232jmlgdt0.webp
---

本篇文章展示站点首页移动端适配的处理过程。问题本身并不复杂：页面有 `home`、`about`、`blogs` 三种状态，前两者更像单页展示，最后一个则需要显示文章列表，并保留横向滑动的博客卡片。

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

- `cover` 是首页封面（home）。
- `about` 是个人介绍。
- `posts` 是博客列表（blogs）。

在桌面端，滚轮可以推动状态切换，也可以推动横向 carousel。这个逻辑比较自然，因为桌面端没有浏览器下拉刷新，也没有触摸滚动的惯性边界。

移动端则不同。移动端的 `cover` 和 `about` 更适合保持单屏体验，通过上下滑切换状态；但 `posts` 必须回到原生滚动，因为文章卡片和标签数量会超出一屏。

## 状态机定义

首先要明确页面状态的切换以及后续控制页面滚动的逻辑，同时还要兼顾移动端的触摸处理。

已知状态有 `cover` | `about` | `posts`，其中 `cover` 和 `about` 为单屏模式，而 `posts` 为内容模式，也就是允许页面内部产生纵向滚动。

三者之间的状态是：

- `cover`：上一页（无），下一页（about）
- `about`：上一页（cover），下一页（posts）
- `posts`：上一页（about），下一页（无）

将上述逻辑适配进移动端触摸处理，也就是手指向下滑动时尝试进入上一页，手指向上滑动时尝试进入下一页。但这里要特别注意：`posts` 是一个内容页，用户在 `posts` 中向上滑动时，大多数情况下并不是要切换状态，而是要继续阅读更靠下的内容。

因此状态机应当只在两个场景中工作：

- `cover/about` 中的上下滑动，用于切换单屏状态。
- `posts` 已经滚动到顶部时的向下拉动，用于回到 `about`。

## 单屏浏览

为了让 `cover` 和 `about` 表现为真正的单屏页面，需要先锁住根页面滚动。这里可以在初始化脚本中给 `html` 和 `body` 加上标记：

```ts
document.documentElement.classList.add('story-home-lock');
document.body.classList.add('story-home-lock');
```

然后在移动端样式中锁定根节点：

```css
@media (max-width: 1120px), (hover: none) and (pointer: coarse) {
  html.story-home-lock,
  body.story-home-lock {
    overflow: hidden;
    overscroll-behavior-y: contain;
  }

  .story-home {
    height: 100svh;
    overflow-x: hidden;
    overflow-y: hidden;
    overscroll-behavior-y: contain;
  }
}
```

这里使用 `100svh` 而不是传统的 `100vh`，是为了减少移动端浏览器地址栏收起或展开时造成的高度跳动。`overflow-y: hidden` 则保证 `cover` 和 `about` 不会变成普通滚动页。

接下来需要在 `posts` 状态下单独打开滚动：

```css
@media (max-width: 1120px), (hover: none) and (pointer: coarse) {
  .story-home[data-view='posts'] {
    height: 100svh;
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior-y: contain;
    -webkit-overflow-scrolling: touch;
  }
}
```

这表示真正负责滚动的不是 `window`，也不是 `body`，而是 `.story-home` 这个根容器。这样做的好处是 `cover/about` 仍然可以保持单屏锁定，而 `posts` 又可以拥有独立的阅读滚动区域。

由于状态会影响根节点和页面容器的滚动方式，切换状态时需要同步到 DOM：

```ts
const setView = (view: StoryView) => {
  root.dataset.view = view;
  document.documentElement.dataset.storyView = view;
  document.body.dataset.storyView = view;

  root.classList.toggle('is-cover', view === 'cover');
  root.classList.toggle('is-about', view === 'about');
  root.classList.toggle('is-posts', view === 'posts');
};
```

当进入新的状态时，还可以顺手把滚动位置重置，避免从 `posts` 回到 `about` 后保留上一次的滚动偏移：

```ts
const showAbout = () => {
  setView('about');
  root.scrollTo({ top: 0, behavior: 'auto' });
};

const showPosts = () => {
  setView('posts');
  root.scrollTo({ top: 0, behavior: 'auto' });
};
```

## 横向轮播

博客列表中还有一个横向 carousel：

```html
<div class="story-home__track" data-carousel-track tabindex="0">
  ...
</div>
```

在桌面端，滚轮被转换成横向滚动。但在移动端，横向滑动本身就是浏览器擅长的原生行为，因此无需再对滚动逻辑做出处理。如下：

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

这里的重点是不要在父容器上写 `touch-action: pan-y` 或 `touch-action: none`，否则 carousel 的横向滑动会被一起影响。

## Filter 横向滑动

移动端还有一个容易被忽略的区域：标签筛选列表。桌面端可以把 Filter 放在侧边栏里纵向排列，但移动端屏幕宽度有限，更适合把它做成横向滚动条。

页面结构可以保持简单：

```html
<div class="story-home__tag-list" data-filter-list tabindex="0">
  <button class="story-home__tag-button is-active" type="button" data-filter-tag="all">
    所有标签
  </button>
  ...
</div>
```

移动端 CSS 中将其从 grid 改成横向 flex：

```css
@media (max-width: 1120px), (hover: none) and (pointer: coarse) {
  .story-home__tag-list {
    display: flex;
    gap: 0.55rem;
    width: 100%;
    max-width: 100%;
    overflow-x: auto;
    overflow-y: hidden;
    touch-action: pan-x pan-y;
    overscroll-behavior-inline: contain;
    scroll-snap-type: x proximity;
    -webkit-overflow-scrolling: touch;
  }

  .story-home__tag-button {
    flex: 0 0 auto;
    width: auto;
    white-space: nowrap;
    scroll-snap-align: start;
  }
}
```

这里的 `flex: 0 0 auto` 很重要，它可以避免按钮被强行压缩；`white-space: nowrap` 则防止标签文字换行导致按钮高度跳动。

如果还希望桌面端滚轮和移动端触控板都能更自然地操作 Filter，可以在脚本中根据当前布局决定滚动方向：

```ts
const handleFilterWheel = (event: WheelEvent) => {
  const mainDelta = Math.abs(event.deltaY) > Math.abs(event.deltaX)
    ? event.deltaY
    : event.deltaX;

  if (!filterList || mainDelta === 0) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  if (isMobileLayout()) {
    filterList.scrollBy({
      left: mainDelta * 1.4,
      behavior: 'auto',
    });
  } else {
    filterList.scrollBy({
      top: mainDelta * 1.4,
      behavior: 'auto',
    });
  }
};
```

这段代码的作用是：桌面端 Filter 仍然纵向滚动，移动端 Filter 则横向滚动。注意它只绑定在 `data-filter-list` 上，不要绑定到整个页面，否则会再次影响 `posts` 的原生纵向阅读。

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

## 上下滑检测

完整的触摸检测可以分成三步：记录起点、计算位移、根据状态决定是否切换页面。

首先在 `touchstart` 中记录手指起点、当前滚动位置和开始时间：

```ts
let touchStartX = 0;
let touchStartY = 0;
let touchStartScrollY = 0;
let touchStartTime = 0;

const getPageScrollTop = () =>
  isMobileLayout() && root.dataset.view === 'posts'
    ? root.scrollTop
    : window.scrollY;

const handleTouchStart = (event: TouchEvent) => {
  const touch = event.touches[0];
  if (!touch) {
    return;
  }

  touchStartX = touch.clientX;
  touchStartY = touch.clientY;
  touchStartScrollY = getPageScrollTop();
  touchStartTime = Date.now();
};
```

这里的 `getPageScrollTop()` 是为了适配前文提到的滚动容器：在 `posts` 中读取 `.story-home.scrollTop`，在其他状态中读取 `window.scrollY`。

接着定义纵向切页规则：

```ts
const handleVerticalGesture = (
  deltaX: number,
  deltaY: number,
  elapsed: number,
) => {
  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);

  if (elapsed > 900 || absY < 52 || absY < absX * 1.2) {
    return false;
  }

  if (deltaY < 0) {
    if (root.dataset.view === 'cover') {
      showAbout();
      return true;
    }

    if (root.dataset.view === 'about') {
      showPosts();
      return true;
    }

    return false;
  }

  if (deltaY > 0) {
    if (root.dataset.view === 'about') {
      showCover();
      return true;
    }

    if (root.dataset.view === 'posts') {
      showAbout();
      return true;
    }
  }

  return false;
};
```

其中 `deltaY < 0` 代表手指向上滑，也就是尝试进入下一页；`deltaY > 0` 代表手指向下滑，也就是尝试回到上一页。`absY < absX * 1.2` 用来排除横向滑动，避免 carousel 被误判成上下切页。

最后在 `touchmove` 中决定是否交给状态机：

```ts
const handleTouchMove = (event: TouchEvent) => {
  const touch = event.touches[0];
  if (!touch || touchStartTime === 0) {
    return;
  }

  const deltaX = touch.clientX - touchStartX;
  const deltaY = touch.clientY - touchStartY;

  if (isMobileLayout() && root.dataset.view === 'posts') {
    if (isPostsTopPull(deltaX, deltaY)) {
      event.preventDefault();

      const elapsed = Date.now() - touchStartTime;
      if (handleVerticalGesture(deltaX, deltaY, elapsed)) {
        touchStartTime = 0;
      }
    }

    return;
  }

  event.preventDefault();

  const elapsed = Date.now() - touchStartTime;
  if (handleVerticalGesture(deltaX, deltaY, elapsed)) {
    touchStartTime = 0;
  }
};
```

这一段是整个移动端分页的关键：如果当前是 `posts`，就只处理顶部下拉；如果不是 `posts`，才把上下滑交给状态机。这样既保留了 `cover/about` 的单屏切换，又不会破坏 `posts` 的原生滚动。

## 滚动容器错位

这里最容易出现的错误，是 CSS 和脚本对“谁在滚动”这件事理解不一致。

如果 CSS 让 `.story-home` 成为滚动容器，但脚本仍然读取 `window.scrollY`，那么脚本会一直认为页面还在顶部。结果就是用户明明已经在 `posts` 中滚动了一段距离，顶部下拉判断仍然可能误触发。

反过来，如果 CSS 让 `body` 恢复滚动，而脚本又用 `.story-home.scrollTop` 判断顶部，也会得到永远为 `0` 的结果。因此滚动容器需要在 CSS 和 JavaScript 中保持一致：

- CSS 中由 `.story-home[data-view='posts']` 负责 `overflow-y: auto`。
- JavaScript 中由 `root.scrollTop` 判断 `posts` 的滚动位置。
- `html/body` 保持 `overflow: hidden`，避免根页面和内部容器同时滚动。

这个约定确定之后，再处理顶部下拉、浏览器刷新和状态切换就会稳定很多。

## 统一切换入口

状态按钮也应该复用同一套切换函数：

```ts
viewButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const view = button.dataset.storyView;

    if (view === 'cover') {
      showCover();
    } else if (view === 'about') {
      showAbout();
    } else if (view === 'posts') {
      showPosts();
    }
  });
});
```

这样无论用户是点击导航按钮，还是通过上下滑动切换状态，最终都会走同一套 `showCover()`、`showAbout()`、`showPosts()`，状态不会分叉。

如果后续还要支持 URL 参数、键盘切换、返回按钮等入口，也应该尽量让它们调用同一组函数，而不是在不同事件里分别修改 `data-view`。状态类问题最怕多个入口各改各的，最后视觉状态、滚动状态和导航高亮互相对不上。

## 规则建模

综上所述，可以把移动端行为总结为四条规则以建模：

- `home` 和 `about` 是状态分页，不进行原生页面滚动。
- `blogs` 是内容页，使用 `.story-home` 原生纵向滚动。
- `blogs` 内的 carousel 保留原生横向滚动。
- 只有当 `blogs` 已经在顶部并继续向下拉时，才拦截手势并返回 `about`。