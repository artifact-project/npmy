import {join} from 'path';
const cache:{[path: string]: PackageJSON} = {};

export interface PackageJSON {
	name: string;
	version: string;
	bin: object;
	scripts: object;
	dependencies: object;
	devDependencies: object;
	peerDependencies: object;
	allDependencies: object;
	files: string[];
}

export function getPackageJSON(path): PackageJSON {
	if (!cache.hasOwnProperty(path)) {
		try {
			const json: PackageJSON = require(join(path, 'package.json'));

			json.allDependencies = {
				...(json.dependencies || {}),
				...(json.devDependencies || {}),
				...(json.peerDependencies || {}),
			};

			cache[path] = json;
		} catch (err) {
			cache[path] = null;
		}
	}

	return cache[path];
}
