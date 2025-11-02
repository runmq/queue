import {defineConfig} from "tsup";

export default defineConfig({
    entry: ["src/core/index.ts"],
    format: ["cjs", "esm"],
    dts: true,
    splitting: false,
    sourcemap: true,
    skipNodeModulesBundle: true,
    clean: true,
});