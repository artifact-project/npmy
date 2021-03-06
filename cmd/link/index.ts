import {join, resolve, relative} from 'path';
import * as minimist from 'minimist';
import Manager from '../../src/Manager/Manager';
import {createSpinner, glob, existsSync, writeFileSync, readFileSync, mkdirSync, rmdirSync, tmpdir} from '../../src/utils/utils';
import {getPackageJSON} from '../../src/PackageJSON/PackageJSON';

const {
	_:targetPaths = [],
	include,
	add,
	verbose,
	version,
	pkg,
	to,
	cwd = __dirname,
} = minimist(process.argv.slice(2));

process.on('unhandledRejection', (reason: any, p: any) => {
	console.log('\x1b[31m----------------------------');
	console.error('Unhandled Rejection at promise:', p);
	console.error('Reason:', reason);
	console.log('----------------------------\x1b[0m');
	process.exit(1);
});

if (version) {
	console.log(`NPMy v${require('./package.json').version}`);
	process.exit(0);
}

console.log(`\x1b[32mNPMy\x1b[0m (ctrl+c -> exit)`);
console.log(` - cwd: ${cwd}`);
console.log(` - tmp: ${tmpdir()}`);

try {
	// rmdirSync(tmpdir());
	mkdirSync(tmpdir());
} catch (_) {}

add && console.log(` - add: ${add}`);
include && console.log(` - include: ${include}`);

if (verbose) {
	console.log(` - verbose: enabled`);
	process.env.VERBOSE = 'true';
}

console.log(`---------------------`);

// Autorun
(async function () {
	const manager = new Manager();

	!targetPaths.length && targetPaths.push('.');

	if (add) {
		const list = await glob(add);
		const records = {};

		list.forEach(realtivePath => {
			const path = resolve(realtivePath);
			const json = getPackageJSON(path);

			if (json) {
				records[json.name] = path;
			}
		});

		console.log(` - Added ${Object.keys(records).length} packages`);
		console.log(JSON.stringify(records, null, 2));

		targetPaths.forEach(targetPath => {
			const filename = resolve(join(targetPath, '.npmyrc'));
			const json = existsSync(filename) ? JSON.parse(readFileSync(filename) + '') : {};

			writeFileSync(filename, JSON.stringify({
				...json,
				...records,
				// ...Object.entries(records).reduce((map, [name, path]) => {
				// 	map[name] = relative(targetPath, path as string);
				// 	return map;
				// }, {}),
			}, null, 2));
		});
	}

	if (pkg) {
		if (!to) {
			console.warn(`\x1b[35m '--to' must be defined\x1b[0m`);
		} else {
			console.log(` - Create link: '${pkg}' -> '${to}'`);
			manager.setLink(pkg, to, cwd);
		}
	}

	for (const relativePath of targetPaths) {
		const path = resolve(relativePath);
		const spinner = createSpinner(` %s ${path}`, true);
		const lists = await manager.scan(path, include);

		spinner.stop(true);

		console.log(` ${path}`);

		lists.forEach(({path:pkgPath, rc}) => {
			const {allDependencies} = getPackageJSON(pkgPath);

			console.log(`   /${relative(path, pkgPath)}`);

			Object.keys(rc)
				.filter((depName) => allDependencies.hasOwnProperty(depName))
				.forEach((depName) => {
					console.log(`     [${depName}] -> ${rc[depName]}`);
				});
		});
	}

	console.log('\nRunning');

	await manager.run();
})();
