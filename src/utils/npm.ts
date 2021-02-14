import latestVersion from 'latest-version';
import minimist = require('minimist');

const {
	registry, // 'https://registry.npmjs.org'
	r,
	reg,
	dr, // Use default registry
} = minimist(process.argv.slice(2));

let registryUrl = reg || r || registry;

if (dr) {
	registryUrl = 'https://registry.npmjs.org';
}

if (registryUrl) {
	process.env['npm_config_registry'] = registryUrl;
}

export function getRegistryUrl() {
	return registryUrl
}


export async function getLatestVersion(pkgName: string) {
	try {
		return await latestVersion(pkgName, <any>{registryUrl});
	} catch {
		return null;
	}
}
