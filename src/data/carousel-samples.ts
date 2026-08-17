import type { EditorialPostSummary } from './blog';

const sampleDefinitions = [
	['DispatcherPriority 与界面响应顺序', '从输入、渲染到后台任务，整理 WPF Dispatcher 队列中不同优先级的执行边界。', ['WPF', '.NET', 'SAMPLE']],
	['依赖属性元数据的覆盖规则', '分析 DefaultValue、继承与属性变更回调在派生控件中的合并方式。', ['WPF', 'C#', 'SAMPLE']],
	['Visual Tree 与 Logical Tree', '对比两种对象树在资源查找、事件路由和模板展开时承担的职责。', ['WPF', 'Desktop', 'SAMPLE']],
	['路由事件的冒泡与隧道', '通过一组输入事件案例观察 Preview 与普通路由事件的传播顺序。', ['WPF', 'C#', 'SAMPLE']],
	['ControlTemplate 状态设计', '将视觉状态、触发器和模板部件组织成更容易维护的控件契约。', ['WPF', 'UI', 'SAMPLE']],
	['ResourceDictionary 合并策略', '讨论大型桌面项目中主题资源的拆分、覆盖顺序与按需加载。', ['WPF', '.NET', 'SAMPLE']],
] as const;

export const carouselSamplePosts: EditorialPostSummary[] = sampleDefinitions.map(([title, excerpt, tags], index) => ({
	title,
	excerpt,
	href: '/articles',
	date: `2026/08/${String(30 - index).padStart(2, '0')}`,
	tags: [...tags],
	readingTime: `${4 + (index % 6)} min read`,
}));
