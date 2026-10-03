declare const __API_BASE_URL__: string;
declare const __EVENTS_BASE_URL__: string;
declare const __ENABLE_TOOL_LINKS__: boolean;

declare module "*.html" {
  const markup: string;
  export default markup;
}

declare const System: {
  import<TModule = unknown>(moduleName: string): Promise<TModule>;
};
