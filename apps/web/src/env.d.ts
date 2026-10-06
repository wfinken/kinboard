declare const __KINBOARD_API_BASE_URL__: string;
declare module '*.css';
declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<object, object, unknown>;
  export default component;
}
