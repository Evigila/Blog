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
image: /images/posts/wpf-custom-main.webp
---

默认情况下，WPF 默认启动入口是 `App.xaml` 对应生成的 `Main() `方法。不过，由于。网的优良传统，以及微软大发慈悲（？），Main 方法被隐藏了起来。正常情况下也无法访问到它，对于一些有代码洁癖~~比如我~~和希望自己全权掌控应用生命周期的小伙伴来说，这无疑是不可接受的。

虽然我们无法访问到内置的 Main，不过我们可以创建另一个 Main，并指定为程序入口~~有牛~~。

“与其寻找主公，不如为自己创造一个主公”（

## 新建项目

通常情况下，在项目创建之后你应该会看到：
```xml
<Application x:Class="MyApp.App"
             xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
             xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
             StartupUri="MainWindow.xaml">
</Application>
```
以及：
```csharp
public partial class App : Application
{
}
```
而`Main`方法一般是无法看到的，这是因为它是由 WPF 的 XAML 编译器自动生成的。大致等价于：
```csharp
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

微软实际上已经将这一部分封装好，但是我不接受（

## App.OnStartup（不推荐）

一种方便且实用的手动控制启动逻辑的方式是，通过删除`App.xaml`中的`StartupUri`，然后在`App.xaml.cs`中重写`App.OnStartup`方法。

例如以下用法：
```csharp
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
不过，这个时候启动入口仍然是WPF自动生成的`Main()`，只不过截至到窗口创建之前，程序行为允许自定义控制。这无疑是一种临时的措施，想要完整掌控生命周期，这种程度是远远不够的。

## 替换启动入口

实际上，想要创建自定义的`Main`函数，并将其替换WPF自动生成的入口点并不复杂。

首先至少需要新建一个类用于承载入口点，通常来说会被命名为`Program`或者`Startup`。这将后续作为`csproj`中指定自定义入口的关键。

在`Program.cs`中，需要手写以下函数：
```csharp
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
需要注意的是，`[STAThread]`标签是必须的，如果没有该标签则无法运行。然后在WPF项目的`csproj`文件中，在`ProjectProperties`中添加一个属性：
```xml
<StartupObject>Assembly.Class</StartupObject>
```
将此处的`Assembly.Class`替换为上述新建的用于承载入口点的类。注意这里的`Assembly`是你的程序集名称。同样的，需要删除`App.xaml`中的`StartupUri`以确保入口点唯一。

就这么简单，一切就绪之后，你的WPF项目将会以你自定义的入口开始。

## 窗口渲染

在自定义程序启动入口之后，可以在自建的`Main`函数中处理初始化逻辑。需要注意的是，要想窗口正常被渲染出来，`App()`或者`MainWindow()`相关的代码是必须的。此处的`MainWindow`指的不是新建WPF项目时默认的窗口文件名字，而是`App`上的一个属性，同名为`MainWindow`。

```csharp
App.InitializeComponent();
```
```csharp
App.Run(window);
```
其中`InitializeComponent()`的调用时机必须要早，甚至必须早于一些你自定义的逻辑，否则有可能发生引擎错误。因此当你发现输入自定义逻辑之后窗口无法渲染或者引擎崩溃，尝试将`InitializeComponent()`调用放在更早期的位置有可能解决问题。

此外，`InitializeComponent()`在手动定义程序入口之后通常会发生无法找到对应函数的报错，这是因为`App`在没有样式的情况下会剔除该函数，导致无法在`App`上调用。

要想解决这个问题，仅需要在`App.xaml`中随便定义一个样式或者任意资源即可，例如下图：
```xml
<Application
  x:Class="MyApp.App"
  xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
  xmlns:local="clr-namespace:MyApp"
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

## 修改脚本属性（极力不推荐！）

注意到有大量的教程教学如何自定义 Main，而通常他们是通过修改脚本的属性，例如将 `App.xaml.cs` 改为 `Page` 从而使得 WPF 引擎无法识别并自动创建隐式 Main。

本人曾经尝试上述方法但失败过，不仅比本篇文章的方法要慢，更加的麻烦，且该操作是不可逆的！

该操作是不可逆的！

该操作是不可逆的！（说三遍

而且App.xaml.cs作为 WPF 应用的核心脚本文件，后续还需要通过它来配置例如全局样式，或者资源文件注入等行为，将App.xaml改为Page可能会触发意想不到的后果！而想要弥补，唯一的方法是重开项目。

鉴于此，完全不推荐通过修改脚本属性的方式来抑制程序生成 Main。