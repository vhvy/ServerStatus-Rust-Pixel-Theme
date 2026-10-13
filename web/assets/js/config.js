/* 修改这里即可配置主题，无需安装依赖或编译。部署到后端同域时建议 endpoint: '/json/stats.json'。 */
window.PIXEL_STATUS_CONFIG = {
  title: "vhvy's Server Status",
  defaultTheme: 'light',
  endpoint: '/json/stats.json',
  refreshInterval: 5000,
  staleAfter: 30,
  requestTimeout: 8000,
  historyLimit: 60,
  // 可按节点 name 指定插画：compute / storage / router；插画不代表探测到的硬件。
  nodeArt: {},
};
