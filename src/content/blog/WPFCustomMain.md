---
title: WPF自定义程序启动入口Main
excerpt: 创建WPF并自定义程序启动入口，以获取项目的完整生命周期控制
publishDate: 2026-06-27
updatedAt: 2026-06-27
tags:
  - WPF
  - C#
  - .NET
  - Desktop
---

本篇文章将教学如何创建WPF时自定义程序启动入口`Main`，以获取项目的完整生命周期控制。

## 默认程序启动入口

默认情况下，WPF 默认启动入口本质上是 `App.xaml` 对应生成的 `Main() `方法。

不过，在项目创建之后你应该会看到：
```xml
<Application x:Class="MyApp.App"
             xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
             xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
             StartupUri="MainWindow.xaml">
</Application>
```
以及：
```C#
public partial class App : Application
{
}
```
但是`Main`方法一般是无法看到的，这是因为它是由 WPF 的 XAML 编译器自动生成的。大致等价于：
```C#
[STAThread]
public static void Main()
{
    var app = new App();
    app.InitializeComponent();
    app.Run();
}
```
而如果`App.xaml`中配置了：
```xml
StartupUri="MainWindow.xaml"
```
那么 `app.Run()` 后，WPF 会自动创建并显示 `MainWindow`。

## App.OnStartup

一种方便且实用的手动控制启动逻辑的方式是，通过删除`App.xaml`中的`StartupUri`，然后在`App.xaml.cs`中重写`App.OnStartup`方法。

例如以下用法：
```C#
public partial class App : Application
{
    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);

        var window = new MainWindow();
        window.Show();
    }
}
```
不过，这个时候启动入口仍然是WPF自动生成的`Main()`，只不过截至到窗口创建之前，程序行为将自定义控制。

## 完全获取启动入口

实际上，想要创建自定义的`Main`函数，并将其替换WPF自动生成的入口点并不复杂。

首先至少需要新建一个类用于承载入口点，通常来说会被命名为`Program`或者`Startup`。这将后续作为`csproj`中指定自定义入口的关键。

在`Program.cs`中，需要手写以下函数：
```C#
public static class Program
{
    [STAThread]
    public static void Main()
    {
        var app = new App();
        app.InitializeComponent();

        var window = new MainWindow();
        app.Run(window);
    }
}
```
需要注意的是，`[STAThread]`标签是必须的，如果没有该标签则无法运行。

然后在WPF项目的`csproj`文件中，在`ProjectProperties`中添加一个属性：
```xml
<StartupObject>Assembly.Class</StartupObject>
```
将此处的`Assembly.Class`替换为上述新建的用于承载入口点的类。注意这里的`Assembly`是你的程序集名称。

同样的，需要删除`App.xaml`中的`StartupUri`以确保入口点唯一。

一切就绪之后，你的WPF项目将会以你自定义的入口开始。

## 窗口渲染

在自定义程序启动入口之后，可以在自建的`Main`函数中处理初始化逻辑。需要注意的是，要想窗口正常被渲染出来，`App()`或者`MainWindow()`相关的代码是必须的。

此处的`MainWindow`指的不是新建WPF项目时默认的窗口文件名字，而是`App`上的一个属性，同名为`MainWindow`。

以下这两行代码是窗口渲染的关键：
```C#
App.InitializeComponent();
```
```C#
App.Run(window);
```
其中`InitializeComponent()`的调用时机必须要早，甚至必须早于一些你自定义的逻辑，否则有可能发生引擎错误。因此当你发现输入自定义逻辑之后窗口无法渲染或者引擎崩溃，尝试将`InitializeComponent()`调用放在更早期的位置有可能解决问题。

此外，`InitializeComponent()`在手动定义程序入口之后通常会发生无法找到对应函数的报错，这是因为`App`在没有样式的情况下会剔除该函数，导致无法在`App`上调用。

要想解决这个问题，仅需要在`App.xaml`中随便定义一个样式或者任意资源即可，例如下图：
```xml
<Application
  x:Class="LuvLetter.App"
  xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
  xmlns:local="clr-namespace:LuvLetter"
>
  <Application.Resources>
    <Style x:Key="Test" />
  </Application.Resources>
</Application>
```
此处的Style样式只是一个空样式，使用一个`x:Key`属性将其限定应用范围防止样式扩散。

在后期有自定义的Style样式的时候就可以删掉这个空样式，毕竟它只是用于解决`InitializeComponent()`被剔除的问题。

> 需要注意的是，该问题似乎在某些高版本的.NET SDK上不会出现，即没有空样式占位的情况下也能顺利编译InitializeComponent()，但大多数情况下会发生这种错误。

## 进阶玩法

在获取了程序启动入口之后，可以将窗口单例，登录逻辑，配置初始化等功能写在这里。最普遍的应用是将`Microsoft.Extensions.Hosting`或者`Microsoft.Extensions.DependencyInjection`容器放置于此。

而如果使用了DI容器，不妨将`App`本身也纳入容器，以实现生命周期统一由容器接管的效果。