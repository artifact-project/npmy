import {join} from 'path';
const cache:{[path: string]: PackageJSON} = {};

export interface PackageJSON {
	name: string;
	version: string;
	scripts: object;
	dependencies: object;
	devDependencies: object;
	peerDependencies: object;
	allDependencies: object;
	files: string[];
}

export function getPackageJSON(path): PackageJSON {
	if (!cache.hasOwnProperty(path)) {
		const json: PackageJSON = require(join(path, 'package.json'));

		json.allDependencies = {
			...(json.dependencies || {}),
			...(json.devDependencies || {}),
		};

		cache[path] = json;
	}

	return cache[path];
}
