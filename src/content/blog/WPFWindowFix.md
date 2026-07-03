---
title: WPF无边框窗口最大化边界修复
excerpt: 通过拦截WM_GETMINMAXINFO修复WPF自定义窗口Chrome在最大化时覆盖任务栏、边缘溢出或被裁剪的问题。
publishDate: 2026-07-03
updatedAt: 2026-07-03
tags:
  - WPF
  - C#
  - .NET
  - Desktop
image: https://github.com/Evigila/picx-images-hosting/raw/master/maxresdefault.9gx92d8d5t.webp
---

本篇文章将教学如何修复 WPF 自定义窗口 Chrome 后，窗口在最大化时出现的边界错误。

具体而言，是WPF 窗口移除系统非客户区并使用自定义 Chrome 后，进入 `WindowState.Maximized` 状态时，窗口管理器不再完整接管标准窗口框架行为，导致最大化尺寸或位置没有正确限制在当前显示器工作区内，从而出现覆盖任务栏、边缘伸出屏幕、内容被不可见边框裁剪等现象。

fullscreen 通常意味着应用主动占满整个显示器，比如游戏独占全屏或者视频全屏；而 WPF 的 `WindowState.Maximized` 仍然是普通顶层窗口的最大化状态，理论上应该尊重任务栏所在的工作区。

## 问题来源

标准 Windows 窗口由两部分组成：

- 非客户区：系统绘制和管理的标题栏、边框、调整大小区域、系统菜单、最小化、最大化和关闭按钮。
- 客户区：应用自己绘制和管理的内容区域。

WPF 提供了两种常见方式来自定义窗口外观：

- 将 `WindowStyle` 设置为 `None`。
- 使用 `System.Windows.Shell.WindowChrome` 扩展或替换系统窗口框架。

这两种方式看起来只是“换一套标题栏样式”，但本质上是改变了系统非客户区和应用客户区之间的边界。Microsoft 的 `WindowChrome` 文档也明确说明：设置 `WindowStyle.None` 会移除非客户区，同时也会失去非客户区提供的系统行为，其中一个副作用就是窗口最大化时会覆盖 Windows 任务栏。

因此，默认标题栏并不只是一块 UI，它还附带了一整套窗口管理行为。**去掉它之后，必须自己把这些行为补回来。**

## Windows 最大化逻辑

很多时候我们会直觉地认为最大化只是：

```csharp
window.Left = 0;
window.Top = 0;
window.Width = screen.Width;
window.Height = screen.Height;
```

但真正的 Windows 最大化逻辑要复杂一些。它需要考虑：

- 当前窗口属于哪一块显示器。
- 当前显示器完整区域是多少。
- 当前显示器工作区是多少。
- 任务栏在底部、顶部、左侧还是右侧。
- 多显示器坐标是否存在负值。
- 最大化后的左上角位置是否需要相对显示器偏移。

Win32 在窗口尺寸或位置即将改变时，会向窗口发送 `WM_GETMINMAXINFO` 消息。这个消息的 `lParam` 指向一个 `MINMAXINFO` 结构，应用可以通过修改该结构来覆盖默认的最大化尺寸和位置。

我们可以从此处入手。

## 修复方案

修复逻辑可以总结为一句话：

> 在窗口最大化之前，拦截 `WM_GETMINMAXINFO`，把最大化位置和最大化尺寸改成当前显示器的工作区。

完整过程如下：

- 通过 WPF 的 `WindowInteropHelper` 获取窗口对应的 Win32 `HWND`。
- 通过 `HwndSource.AddHook` 接入窗口消息循环。
- 只处理 `WM_GETMINMAXINFO`。
- 通过 `MonitorFromWindow` 找到窗口所在的显示器。
- 通过 `GetMonitorInfo` 取得显示器完整区域和工作区。
- 将 `MINMAXINFO.ptMaxPosition` 和 `MINMAXINFO.ptMaxSize` 写回为工作区坐标。

其中“显示器完整区域”和“工作区”是两个不同概念：

- `MonitorArea` 表示整块显示器的矩形。
- `WorkArea` 表示扣除任务栏等系统保留区域后的可用矩形。

如果任务栏在底部，`WorkArea.Bottom` 通常会小于 `MonitorArea.Bottom`。如果任务栏在左侧，`WorkArea.Left` 会大于 `MonitorArea.Left`。因此修复代码不能只处理底部任务栏，而应该基于矩形差值计算。

## 完整代码

以下是用于修复该问题的 `WindowFix.cs`：

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

## 引用命名空间

先看文件开头：

```csharp
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Interop;
```

`System.Runtime.InteropServices` 用于 P/Invoke 和结构体内存布局。这里需要调用 `user32.dll`，也需要用 `Marshal.PtrToStructure` 和 `Marshal.StructureToPtr` 在托管结构体和非托管指针之间转换。

`System.Windows` 提供 WPF 的 `Window` 类型。这个服务对外暴露的是 `Attach(Window window)`，因此它依赖 WPF 窗口对象。

`System.Windows.Interop` 是 WPF 和 Win32 互操作的关键命名空间。`WindowInteropHelper` 用来从 WPF `Window` 取得 `HWND`，`HwndSource` 用来把 Win32 消息接入 WPF。

## 消息常量

```csharp
private const int WmGetMinMaxInfo = 0x0024;
```

`0x0024` 是 Win32 消息 `WM_GETMINMAXINFO` 的值。

当窗口大小或位置即将变化时，系统会发送这个消息。

```csharp
private HwndSource? hwndSource;
```

这里保存 `HwndSource` 引用。

`HwndSource` 是 WPF 内容和 Win32 `HWND` 之间的桥。后续调用 `AddHook` 后，窗口消息会被转发到自定义的 `WindowProc` 方法中。

保留字段还有一个实际作用：窗口关闭时可以调用 `RemoveHook` 移除消息钩子，避免窗口生命周期结束后还留下无意义的回调引用。

## 附加到窗口

```csharp
public void Attach(Window window)
```

这是修复类的入口。调用方只需要把需要修复的窗口传进来即可。

通常可以在窗口构造完成后调用：

```csharp
windowFix.Attach(this);
```

```csharp
if (new WindowInteropHelper(window).Handle != IntPtr.Zero)
{
    AttachHook(window);
    return;
}
```

`new WindowInteropHelper(window).Handle` 用来取得 WPF 窗口背后的 Win32 句柄。

如果句柄不是 `IntPtr.Zero`，说明该窗口的底层 `HWND` 已经创建好了，可以立刻安装消息钩子。

`AttachHook(window)` 是真正安装钩子的逻辑。

`return` 表示已经完成绑定，不需要再等待 `SourceInitialized`。

```csharp
window.SourceInitialized += Window_SourceInitialized;
```

如果当前还没有 `HWND`，说明窗口尚未完成 Win32 源初始化。此时不能调用 `HwndSource.FromHwnd`，因为还没有可用句柄。

`SourceInitialized` 是 WPF 专门用于 Win32 互操作的事件。它触发时，窗口底层源已经创建，适合进行这类消息钩子注册。

```csharp
void Window_SourceInitialized(object? sender, EventArgs e)
```

这里定义了一个局部事件处理函数。局部函数的好处是作用域很小，只服务于当前 `Attach` 方法。

```csharp
window.SourceInitialized -= Window_SourceInitialized;
```

事件触发后立即解除订阅。

这个服务只需要初始化一次。

```csharp
AttachHook(window);
```

此时 `HWND` 已经创建完成，因此可以正式安装窗口消息钩子。

## 安装消息钩子

```csharp
private void AttachHook(Window window)
```

这个方法负责从 WPF 窗口进入 Win32 消息层。

```csharp
var hwnd = new WindowInteropHelper(window).Handle;
```

再次取得窗口句柄。

```csharp
if (hwnd == IntPtr.Zero)
{
    return;
}
```

如果仍然拿不到句柄，就直接返回。

```csharp
hwndSource = HwndSource.FromHwnd(hwnd);
```

通过 `HWND` 找到对应的 `HwndSource`。

有了 `HwndSource`，WPF 就允许我们监听该窗口收到的 Win32 消息。

```csharp
hwndSource?.AddHook(WindowProc);
```

向 `HwndSource` 添加消息钩子。

从这一刻开始，窗口收到的大多数 Win32 消息都会进入 `WindowProc`。其中就包括本篇文章关心的 `WM_GETMINMAXINFO`。

```csharp
window.Closed += (_, _) => hwndSource?.RemoveHook(WindowProc);
```

窗口关闭时移除消息钩子。

## 处理窗口消息

```csharp
private IntPtr WindowProc(
    IntPtr hwnd,
    int message,
    IntPtr wParam,
    IntPtr lParam,
    ref bool handled
)
```

这是 WPF `HwndSourceHook` 所要求的方法签名。它非常接近传统 Win32 的窗口过程函数。

`hwnd` 是收到消息的窗口句柄。

`message` 是消息编号。

`wParam` 和 `lParam` 是消息附带参数。不同消息对它们有不同解释。

`handled` 用来告诉 WPF 这个消息是否已经被处理。

返回值是 `IntPtr`，对应 Win32 窗口过程的返回值。

```csharp
if (message != WmGetMinMaxInfo)
{
    return IntPtr.Zero;
}
```

如果当前消息不是 `WM_GETMINMAXINFO`，服务不做任何处理。

这非常重要。消息钩子会收到大量消息，鼠标、键盘、尺寸、激活、DPI、绘制等都可能进入这里。修复服务只应该处理自己的目标消息，避免影响正常窗口行为。

```csharp
WmGetMinMaxInfoCore(hwnd, lParam);
```

当消息匹配时，进入核心修复逻辑。

`lParam` 此时指向 `MINMAXINFO` 结构。核心方法会读取这个结构，修改最大化尺寸和位置，然后写回原地址。

```csharp
handled = true;
```

告诉 WPF 当前消息已经处理。

设置为 `true` 后，后续钩子不会继续处理该消息，WPF 也不会再用默认逻辑覆盖我们写入的最大化参数。

```csharp
return IntPtr.Zero;
```

Win32 文档要求应用处理 `WM_GETMINMAXINFO` 后返回 0。

```csharp
var monitor = MonitorFromWindow(hwnd, MonitorOptions.MonitorDefaultToNearest);
```

这行代码通过窗口句柄找到对应显示器。

`MonitorFromWindow` 会返回与窗口矩形交集最大的显示器。如果窗口不在任何显示器上，`MonitorDefaultToNearest` 会让它返回最近的显示器。

这个选项对多显示器尤其重要。因为窗口最大化时应该最大化到它所在的显示器，而不是永远最大化到主显示器。

```csharp
if (monitor == IntPtr.Zero)
{
    return;
}
```

如果没有找到显示器，就放弃修复。

```csharp
var monitorInfo = new MonitorInfo { Size = Marshal.SizeOf<MonitorInfo>() };
```

创建 `MONITORINFO` 对应的托管结构体，并设置 `Size`。

Win32 的 `GetMonitorInfo` 要求调用方先把 `cbSize` 填为结构体大小，这样 API 才知道传入的是哪种结构。

```csharp
if (!GetMonitorInfo(monitor, ref monitorInfo))
{
    return;
}
```

调用 Win32 API 获取显示器信息。

成功后，`monitorInfo.MonitorArea` 是完整显示器区域，`monitorInfo.WorkArea` 是工作区。

如果调用失败，就直接返回，交给系统默认行为。

```csharp
var minMaxInfo = Marshal.PtrToStructure<MinMaxInfo>(lParam);
```

把 `lParam` 指向的非托管 `MINMAXINFO` 结构复制成托管结构体。

此时修改 `minMaxInfo` 只是修改托管副本，还没有写回原始消息参数。

```csharp
var workArea = monitorInfo.WorkArea;
var monitorArea = monitorInfo.MonitorArea;
```

取出工作区和完整显示器区域，方便后续计算。

```csharp
minMaxInfo.MaxPosition.X = Math.Abs(workArea.Left - monitorArea.Left);
minMaxInfo.MaxPosition.Y = Math.Abs(workArea.Top - monitorArea.Top);
```

设置最大化后的左上角偏移。

如果任务栏在左侧，`workArea.Left` 会比 `monitorArea.Left` 大，`MaxPosition.X` 就应该向右偏移。

如果任务栏在顶部，`workArea.Top` 会比 `monitorArea.Top` 大，`MaxPosition.Y` 就应该向下偏移。

这里使用 `Math.Abs` 是为了得到正向偏移量。

```csharp
minMaxInfo.MaxSize.X = Math.Abs(workArea.Right - workArea.Left);
minMaxInfo.MaxSize.Y = Math.Abs(workArea.Bottom - workArea.Top);
```

设置最大化后的宽度和高度。

宽度等于工作区右边界减去左边界，高度等于工作区下边界减去上边界。

如果任务栏在底部，高度会自然变小；如果任务栏在右侧，宽度会自然变小。这样窗口最大化后就不会覆盖任务栏，也不会伸出可用区域。

```csharp
Marshal.StructureToPtr(minMaxInfo, lParam, true);
```

把修改后的托管结构体写回 `lParam` 指向的非托管内存。第三个参数 `true` 表示在写入前调用清理逻辑处理目标内存中旧结构体的字段。

## Win32 函数声明

```csharp
[DllImport("user32.dll", SetLastError = true)]
private static extern IntPtr MonitorFromWindow(IntPtr hwnd, MonitorOptions flags);
```

```csharp
[DllImport("user32.dll", EntryPoint = "GetMonitorInfoW", SetLastError = true)]
[return: MarshalAs(UnmanagedType.Bool)]
private static extern bool GetMonitorInfo(IntPtr monitor, ref MonitorInfo monitorInfo);
```

## 枚举和结构体

```csharp
private enum MonitorOptions : uint
{
    MonitorDefaultToNearest = 0x00000002,
}
```

该枚举对应 `MonitorFromWindow` 的标志位。

`0x00000002` 是 `MONITOR_DEFAULTTONEAREST`，表示如果窗口没有落在任何显示器上，则选择最近的显示器。

```csharp
[StructLayout(LayoutKind.Sequential)]
private struct Point
{
    public int X;

    public int Y;
}
```

`Point` 对应 Win32 的 `POINT`。

`StructLayout(LayoutKind.Sequential)` 表示字段必须按照声明顺序排布。P/Invoke 结构体必须保证托管布局和 Win32 布局一致，否则读写出来的值会错位。

`X` 和 `Y` 分别表示横向和纵向坐标或尺寸。

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

`Rect` 对应 Win32 的 `RECT`。

它不是用 `X、Y、Width、Height` 表示矩形，而是用左、上、右、下四条边界表示矩形。

因此计算宽高时需要使用：

```csharp
Right - Left
Bottom - Top
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

`MonitorInfo` 对应 Win32 的 `MONITORINFO`。

`Size` 对应 `cbSize`，调用 `GetMonitorInfo` 前必须设置。

`MonitorArea` 对应 `rcMonitor`，表示完整显示器区域。

`WorkArea` 对应 `rcWork`，表示可用工作区。

`Flags` 对应 `dwFlags`，可用于判断是否为主显示器。

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

`MinMaxInfo` 对应 Win32 的 `MINMAXINFO`。

`Reserved` 是保留字段，不使用。

`MaxSize` 是最大化窗口的宽度和高度。

`MaxPosition` 是最大化窗口左上角位置。

`MinTrackSize` 是用户拖动调整窗口时允许的最小尺寸。

`MaxTrackSize` 是用户拖动调整窗口时允许的最大尺寸。

本次修复只修改 `MaxSize` 和 `MaxPosition`。因为问题发生在最大化边界，而不是拖动窗口时的最小最大尺寸。

## 修复裁剪

无边框 WPF 窗口最大化出问题，本质上是“系统默认最大化参数”和“应用实际窗口框架”之间不再匹配。

标准窗口最大化时，系统知道非客户区在哪里，也知道边框该如何压进或避开工作区。但当应用移除非客户区并自己绘制标题栏之后，系统看到的窗口结构已经不再是标准窗口。于是最大化计算可能使用了不适合当前窗口的尺寸和位置。

当系统发送 `WM_GETMINMAXINFO` 时，它还没有真正把窗口移动到最大化位置。此时写入：

```csharp
minMaxInfo.MaxPosition.X = Math.Abs(workArea.Left - monitorArea.Left);
minMaxInfo.MaxPosition.Y = Math.Abs(workArea.Top - monitorArea.Top);
minMaxInfo.MaxSize.X = Math.Abs(workArea.Right - workArea.Left);
minMaxInfo.MaxSize.Y = Math.Abs(workArea.Bottom - workArea.Top);
```
窗口仍然是正常的 `WindowState.Maximized`，但最大化边界被修正为工作区边界。

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

如果项目使用依赖注入，也可以将 `WindowFix` 注册为窗口级服务，再在窗口构造函数中注入并调用。

需要注意的是，这个服务应该绑定到具体窗口实例。它内部保存了 `HwndSource`，因此不适合把同一个服务实例同时复用到多个窗口上。多窗口场景下，每个窗口应当拥有自己的修复服务实例，或者把服务改造成按窗口保存多个 `HwndSource` 的形式。

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