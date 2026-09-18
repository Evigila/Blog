---
title: WPF无边框窗口最大化边界修复
excerpt: 通过拦截WM_GETMINMAXINFO修复WPF自定义窗口Chrome在最大化时覆盖任务栏、边缘溢出或被裁剪的问题。
publishDate: 2026-07-03
updatedAt: 2026-07-03
tags:
  - WPF
  - C#
  - .NET
image: /images/posts/wpf-window-fix.webp
---

这是一个由来已久的 WPF 已知问题，当同时设置 `WindowStyle` 为 `None` 且使用 `System.Windows.Shell.WindowChrome`替换原有窗口，会导致 WPF 应用外观发生奇怪反应。在 Github，StackOverflow，Reddit 上都多有提及，然而，多数帖子围绕 WPF 自身属性进行讨论，例如设置某某某个属性可以解决，但适用性非常差。

本篇文章采用另一种视角，使用 `Win32 API` 拦截窗口事件，并修复有关的问题。以下是具体的操作过程。

## WPF 自定义窗口框架

标准 Windows 窗口由非客户区（系统绘制和管理的标题栏、边框、调整大小区域、系统菜单、最小化、最大化和关闭按钮等）和客户区（应用自己绘制和管理的内容区域），即 `Client-Area` 和 `Non-Client-Area`。

当将 `WindowStyle` 设置为 `None`，并使用`System.Windows.Shell.WindowChrome` 替换系统窗口框架时，问题就会出现。虽然看起来只是隐藏了标题栏样式，但本质上是改变了非客户区和客户区之间的边界。

通过微软文档可知：设置 `WindowStyle.None` 会移除非客户区，同时也会失去非客户区提供的系统行为，其中一个副作用就是窗口最大化时会覆盖 Windows 任务栏。而最明显的缺陷就是，窗口边缘会伸出屏幕，导致一部分内容不可见或者被裁剪。

[Github issue #3626](https://github.com/dotnet/wpf/issues/3626)指出，最大化行为和 `WindowStyle.None` 搭配使用的时候，甚至可能会发生性能骤降的问题。多数帖子也曾报告，任意像素发生溢出屏幕时，会迫使 WPF 程序渲染禁用硬件加速，从而导致性能低下和卡顿。

虽然不能稳定复现，但我曾在其中一台较老的台式机上观察到过这个问题，简而言之性能骤降的程度出乎我的意料，使用 GridSplitter 时会发生极其严重的卡顿。

## WM_GETMINMAXINFO

Windows 窗口最大化时会发生一系列的操作，包括但不限于：
- 判断当前窗口属于哪一块显示器。
- 判断当前显示器完整区域是多少。
- 判断当前显示器工作区是多少。
- 判断任务栏在底部、顶部、左侧还是右侧。
- 判断多显示器坐标是否存在负值。
- 判断最大化后的左上角位置是否需要相对显示器偏移。
等等。

不过，Win32 在窗口尺寸或位置即将改变时，会向窗口发送 `WM_GETMINMAXINFO` 消息。这个消息的 `lParam` 指向一个 `MINMAXINFO` 结构，应用可以通过修改该结构来覆盖默认的最大化尺寸和位置。因此，我们可以从此处入手，接替 WPF 窗口的尺寸行为。

## 拦截 Win32 消息

我们通过 WPF 的 `WindowInteropHelper` 获取窗口对应的 Win32 `HWND`，并使用 `HwndSource.AddHook` 接入窗口消息循环。由于我们只关心 `WM_GETMINMAXINFO`，因此无需拦截其他消息。

之后再通过 `MonitorFromWindow` 找到窗口所在的显示器，使用 `GetMonitorInfo` 取得显示器完整区域和工作区，最后将 `MINMAXINFO.ptMaxPosition` 和 `MINMAXINFO.ptMaxSize` 写回为工作区坐标，就可以实现接替。

以下是代码部分。

## 完整代码（拆解部分见下文）

```csharp
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Interop;

namespace WPFWindowFix;

internal sealed class WindowFix
{
    private const int WmGetMinMaxInfo = 0x0024;

    private HwndSource? hwndSource;

    public void Attach(Window window)
    {
        if (new WindowInteropHelper(window).Handle != IntPtr.Zero)
        {
            AttachHook(window);
            return;
        }

        window.SourceInitialized += Window_SourceInitialized;

        void Window_SourceInitialized(object? sender, EventArgs e)
        {
            window.SourceInitialized -= Window_SourceInitialized;
            AttachHook(window);
        }
    }

    private void AttachHook(Window window)
    {
        var hwnd = new WindowInteropHelper(window).Handle;
        if (hwnd == IntPtr.Zero)
        {
            return;
        }

        hwndSource = HwndSource.FromHwnd(hwnd);
        hwndSource?.AddHook(WindowProc);
        window.Closed += (_, _) => hwndSource?.RemoveHook(WindowProc);
    }

    private IntPtr WindowProc(
        IntPtr hwnd,
        int message,
        IntPtr wParam,
        IntPtr lParam,
        ref bool handled
    )
    {
        if (message != WmGetMinMaxInfo)
        {
            return IntPtr.Zero;
        }

        WmGetMinMaxInfoCore(hwnd, lParam);
        handled = true;
        return IntPtr.Zero;
    }

    private static void WmGetMinMaxInfoCore(IntPtr hwnd, IntPtr lParam)
    {
        var monitor = MonitorFromWindow(hwnd, MonitorOptions.MonitorDefaultToNearest);
        if (monitor == IntPtr.Zero)
        {
            return;
        }

        var monitorInfo = new MonitorInfo { Size = Marshal.SizeOf<MonitorInfo>() };
        if (!GetMonitorInfo(monitor, ref monitorInfo))
        {
            return;
        }

        var minMaxInfo = Marshal.PtrToStructure<MinMaxInfo>(lParam);
        var workArea = monitorInfo.WorkArea;
        var monitorArea = monitorInfo.MonitorArea;

        minMaxInfo.MaxPosition.X = Math.Abs(workArea.Left - monitorArea.Left);
        minMaxInfo.MaxPosition.Y = Math.Abs(workArea.Top - monitorArea.Top);
        minMaxInfo.MaxSize.X = Math.Abs(workArea.Right - workArea.Left);
        minMaxInfo.MaxSize.Y = Math.Abs(workArea.Bottom - workArea.Top);

        Marshal.StructureToPtr(minMaxInfo, lParam, true);
    }

    [DllImport("user32.dll", SetLastError = true)]
    private static extern IntPtr MonitorFromWindow(IntPtr hwnd, MonitorOptions flags);

    [DllImport("user32.dll", EntryPoint = "GetMonitorInfoW", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetMonitorInfo(IntPtr monitor, ref MonitorInfo monitorInfo);

    private enum MonitorOptions : uint
    {
        MonitorDefaultToNearest = 0x00000002,
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct Point
    {
        public int X;

        public int Y;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct Rect
    {
        public int Left;

        public int Top;

        public int Right;

        public int Bottom;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct MonitorInfo
    {
        public int Size;

        public Rect MonitorArea;

        public Rect WorkArea;

        public int Flags;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct MinMaxInfo
    {
        public Point Reserved;

        public Point MaxSize;

        public Point MaxPosition;

        public Point MinTrackSize;

        public Point MaxTrackSize;
    }
}
```

## WM_GETMINMAXINFO的消息常量

```csharp
private const int WmGetMinMaxInfo = 0x0024;
```

`0x0024` 是 Win32 消息 `WM_GETMINMAXINFO` 的值。当窗口大小或位置即将变化时，系统就会发送这个消息。拦截此消息后继续后续操作。

## 附加到窗口

```csharp
public void Attach(Window window)
```

该 Attach 函数是修复代码的封装入口。把需要修复的窗口传进来，并在该窗口构造完成后立刻调用，就能实现安装钩子获取句柄并监听消息的逻辑。

## 部署钩子

```csharp
private void AttachHook(Window window)
```

这个方法负责从 WPF 窗口进入 Win32 消息层。

```csharp
var hwnd = new WindowInteropHelper(window).Handle;
```

确保已经取得窗口句柄。

```csharp
hwndSource = HwndSource.FromHwnd(hwnd);
```

通过 `HWND` 找到对应的 `HwndSource`。有了 `HwndSource`，WPF 就允许我们监听该窗口收到的 Win32 消息。

```csharp
hwndSource?.AddHook(WindowProc);
```

向 `HwndSource` 添加消息钩子。从这一刻开始，窗口收到的大多数 Win32 消息都会进入 `WindowProc`。其中就包括我们关心的 `WM_GETMINMAXINFO`。

```csharp
window.Closed += (_, _) => hwndSource?.RemoveHook(WindowProc);
```

养成好习惯，在窗口关闭时移除消息钩子。

## 解析窗口消息

```csharp
private IntPtr WindowProc(
    IntPtr hwnd,
    int message,
    IntPtr wParam,
    IntPtr lParam,
    ref bool handled
)
```

这是 WPF `HwndSourceHook` 的标准方法签名。其中，`hwnd` 是目标窗口句柄。`message` 是消息。`wParam` 和 `lParam` 是消息参数。`handled` 用来标注该消息是否已经被处理。

```csharp
if (message != WmGetMinMaxInfo)
{
    return IntPtr.Zero;
}
```

如果当前消息不是 `WM_GETMINMAXINFO`，则跳过。我们只关心`WM_GETMINMAXINFO`。

```csharp
handled = true;
```

告诉 WPF 当前消息已经处理。这样在我们接替尺寸行为逻辑后，WPF 也不会再用默认逻辑覆盖我们写入的逻辑。

```csharp
var monitor = MonitorFromWindow(hwnd, MonitorOptions.MonitorDefaultToNearest);
```

然后我们需要通过这行代码搭配窗口句柄找到目标显示器。`MonitorFromWindow` 会返回与窗口矩形交集最大的显示器。如果窗口不在任何显示器上，那 `MonitorDefaultToNearest` 会返回最近的显示器。

如果你是多显示屏，这是必须处理的。（其实非多显示屏也应该处理）

## 修复并部署

```csharp
var monitorInfo = new MonitorInfo { Size = Marshal.SizeOf<MonitorInfo>() };
```

创建 `MONITORINFO` 对应的托管结构体，并设置其 `Size`。

```csharp
if (!GetMonitorInfo(monitor, ref monitorInfo))
{
    return;
}
```

调用 Win32 API 获取显示器信息。成功后，`monitorInfo.MonitorArea` 是完整显示器区域，`monitorInfo.WorkArea` 是工作区。如果调用失败，就直接返回，交给系统默认行为。

```csharp
var minMaxInfo = Marshal.PtrToStructure<MinMaxInfo>(lParam);
```

把 `lParam` 指向的非托管 `MINMAXINFO` 结构复制成托管结构体。要注意，此时修改 `minMaxInfo` 只是修改托管副本，还没有写回原始消息参数。

```csharp
var workArea = monitorInfo.WorkArea;
var monitorArea = monitorInfo.MonitorArea;
```

先取出工作区和完整显示器区域，方便后续计算。

```csharp
minMaxInfo.MaxPosition.X = Math.Abs(workArea.Left - monitorArea.Left);
minMaxInfo.MaxPosition.Y = Math.Abs(workArea.Top - monitorArea.Top);
```

设置最大化后的左上角偏移。如果任务栏在左侧，`workArea.Left` 会比 `monitorArea.Left` 大，`MaxPosition.X` 就应该向右偏移。如果任务栏在顶部，`workArea.Top` 会比 `monitorArea.Top` 大，`MaxPosition.Y` 就应该向下偏移。记得使用 `Math.Abs` 得到正向偏移量。

```csharp
minMaxInfo.MaxSize.X = Math.Abs(workArea.Right - workArea.Left);
minMaxInfo.MaxSize.Y = Math.Abs(workArea.Bottom - workArea.Top);
```

设置最大化后的宽度和高度。逻辑很简单：宽度等于工作区右边界减去左边界，高度等于工作区下边界减去上边界。这种情况下如果任务栏在底部，高度会自然变小；如果任务栏在右侧，宽度会自然变小。这样窗口最大化后就不会覆盖任务栏，也不会伸出可用区域。

```csharp
Marshal.StructureToPtr(minMaxInfo, lParam, true);
```

最后再把修改后的托管结构体写回 `lParam` 指向的非托管内存。第三个参数使用 `true` 确保在写入前调用清理逻辑处理目标内存中旧结构体的字段。

## 相关Win32 API导入

```csharp
[DllImport("user32.dll", SetLastError = true)]
private static extern IntPtr MonitorFromWindow(IntPtr hwnd, MonitorOptions flags);
```

```csharp
[DllImport("user32.dll", EntryPoint = "GetMonitorInfoW", SetLastError = true)]
[return: MarshalAs(UnmanagedType.Bool)]
private static extern bool GetMonitorInfo(IntPtr monitor, ref MonitorInfo monitorInfo);
```

## 相关枚举和结构体

```csharp
private enum MonitorOptions : uint
{
    MonitorDefaultToNearest = 0x00000002,
}
```

该枚举对应 `MonitorFromWindow` 的标志位。`0x00000002` 是 `MONITOR_DEFAULTTONEAREST`，表示如果窗口没有落在任何显示器上，则选择最近的显示器。

```csharp
[StructLayout(LayoutKind.Sequential)]
private struct Point
{
    public int X;

    public int Y;
}
```

```csharp
[StructLayout(LayoutKind.Sequential)]
private struct Rect
{
    public int Left;

    public int Top;

    public int Right;

    public int Bottom;
}
```

```csharp
[StructLayout(LayoutKind.Sequential)]
private struct MonitorInfo
{
    public int Size;

    public Rect MonitorArea;

    public Rect WorkArea;

    public int Flags;
}
```

`MonitorArea` 对应 `rcMonitor`，表示完整显示器区域。`WorkArea` 对应 `rcWork`，表示可用工作区。`Flags` 对应 `dwFlags`，可用于判断是否为主显示器。

```csharp
[StructLayout(LayoutKind.Sequential)]
private struct MinMaxInfo
{
    public Point Reserved;

    public Point MaxSize;

    public Point MaxPosition;

    public Point MinTrackSize;

    public Point MaxTrackSize;
}
```

`MaxSize` 是最大化窗口的宽度和高度。`MaxPosition` 是最大化窗口左上角位置。

## 使用方式

在窗口创建后，把服务附加到窗口即可：

```csharp
public partial class MainWindow : Window
{
    private readonly WindowFix windowFix = new();

    public MainWindow()
    {
        InitializeComponent();
        windowFix.Attach(this);
    }
}
```

如果项目使用依赖注入，也可以将 `WindowFix` 注册为服务，再在窗口构造函数中注入并调用。

需要注意的是，这个服务应该绑定到具体窗口实例。它内部保存了 `HwndSource`，因此不适合把同一个服务实例同时复用到多个窗口上。

多窗口场景下，每个窗口应当拥有自己的修复服务实例，或者把服务改造成按窗口保存多个 `HwndSource` 的形式。

本文就不多赘述，原理都是相同的。

## 封面图片

封面图片来源自Youtuber - AngelSix 大神的 WPF教程合集中的第四集，在视频末尾他提及了该问题，是WPF已知存在的一个BUG。  
[C# WPF Tutorial - AngelSix](https://www.youtube.com/watch?v=TDOxHx-AMqQ) （可跳转视频，有墙）

## 参考资料

- [WindowChrome Class - Microsoft Learn](https://learn.microsoft.com/en-us/dotnet/api/system.windows.shell.windowchrome)
- [WM_GETMINMAXINFO message - Microsoft Learn](https://learn.microsoft.com/en-us/windows/win32/winmsg/wm-getminmaxinfo)
- [MINMAXINFO structure - Microsoft Learn](https://learn.microsoft.com/en-us/windows/win32/api/winuser/ns-winuser-minmaxinfo)
- [MONITORINFO structure - Microsoft Learn](https://learn.microsoft.com/en-us/windows/win32/api/winuser/ns-winuser-monitorinfo)
- [MonitorFromWindow function - Microsoft Learn](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-monitorfromwindow)
- [GetMonitorInfoW function - Microsoft Learn](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getmonitorinfow)
- [HwndSource.AddHook Method - Microsoft Learn](https://learn.microsoft.com/en-us/dotnet/api/system.windows.interop.hwndsource.addhook)
