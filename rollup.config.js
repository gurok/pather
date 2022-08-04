import { nodeResolve } from "@rollup/plugin-node-resolve";
import { terser } from "rollup-plugin-terser";

import pkg from "./package.json";

let build = pkg.files[0];

export default
[
	{
		// UMD
		input: "source/main.js",
		plugins:
		[
			nodeResolve(),
			terser(
			{
				mangle:
				{
					properties:
					{
						reserved: ["Pather", "a", "c", "h", "l", "m", "q", "s", "t", "v", "z", "accumulator"]
					},
					toplevel: true
				}
			})
		],
		output:
		{
			file: `${build}/${pkg.name}.min.js`,
			format: "umd",
			name: "Pather", // this is the name of the global object
			esModule: false,
			exports: "named",
			sourcemap: true
		}
	},
	// ESM and CJS
	{
		input: "source/main.js",
		plugins:
		[
			nodeResolve()
		],
		output:
		[
			{
				dir: `${build}/esm`,
				format: "esm",
				exports: "named",
				sourcemap: true,
			},
			{
				dir: `${build}/cjs`,
				format: "cjs",
				exports: "named",
				sourcemap: true,
			}
		]
	}
];
