/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';

  const component: DefineComponent<object, object, unknown>;
  export default component;
}

declare module '*.wgsl' {
  const shaderSource: string;
  export default shaderSource;
}

declare module 'muigui' {
  export default class GUI {
    static converters: {
      radToDeg: unknown;
    };

    add(target: object, property: string, ...args: unknown[]): { name(label: string): unknown };
    onChange(callback: () => void): void;
    destroy?(): void;
  }
}
