/** Local review page: real report components and API client, with no generated battle data. */
export function battleReplayPreviewPage({ queryModule, missionId }) {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module">
import RefreshRuntime from '/@react-refresh';
RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type;
window.__vite_plugin_react_preamble_installed__ = true;
const React = (await import('/node_modules/.vite/deps/react.js')).default;
const { createRoot } = (await import('/node_modules/.vite/deps/react-dom_client.js')).default;
const { QueryClient, QueryClientProvider } = await import('${queryModule}');
const { ApiProvider } = await import('/src/api/context.tsx');
const { Api } = await import('/src/api/client.ts');
const { BattleReports } = await import('/src/screens/BattleReports.tsx');
const { ToastProvider } = await import('/src/ui/Toast.tsx');
const i18n = (await import('/src/i18n/index.ts')).default;
await import('/src/styles.css'); await i18n.changeLanguage('tr');
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
createRoot(document.getElementById('root')).render(React.createElement(QueryClientProvider, { client },
 React.createElement(ApiProvider, { api: new Api() }, React.createElement(ToastProvider, null,
 React.createElement(BattleReports, { open: { missionId: '${missionId}', request: 1 } })))));
</script></body></html>`;
}
