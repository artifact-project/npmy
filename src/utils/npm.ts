import latestVersion from 'latest-version';
import minimist = require('minimist');
import { verbose } from './verbose';

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
	if (pkgName.slice(1).indexOf('@') > 0) {
		return pkgName.split('@').pop();
	}

	try {
		return await latestVersion(pkgName, <any>{registryUrl});
	} catch {
		return null;
	}
}

export async function detectPackage(value: string) {
	const [firstPart, ...parts] = value.split(/[/-]/);
	const names = value.includes('@') ? [value] : [value].concat(
		parts
			.map((_, i) => {
				const scope = [firstPart].concat(parts.slice(0, i)).join('-');
				const name = parts.slice(i).join('-');

				return `@${scope}/${name}`;
			})
			.reverse()
	);

	verbose('names:', names);

	for (const name of names) {
		const pkgName = name.split('@').slice(0, +name.startsWith('@') + 1).join('@');
		let version = await getLatestVersion(name);
		
		if (version !== null) {
			return {
				name: pkgName,
				version,
				fullName: `${pkgName}@${version}`,
			};
		}
	}

	return null;
}
