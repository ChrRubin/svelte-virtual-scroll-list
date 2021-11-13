import svelte from "rollup-plugin-svelte"
import pkg from "../package.json"
import autoPreprocess from 'svelte-preprocess';
import typescript from '@rollup/plugin-typescript';

export default {
    input: pkg.svelte,
    output: {
        sourcemap: true,
        format: "es",
        name: "app",
        file: pkg.module,
    },
    plugins: [
        svelte({
            compilerOptions: {
                // enable run-time checks when not in production
                dev: false,
                preprocess: autoPreprocess(),
            },
        }),
        typescript({ sourceMap: false })
    ],
}
