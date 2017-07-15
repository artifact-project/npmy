import {tmpdir} from 'os';
import {resolve, relative} from 'path';
import * as minimist from 'minimist';
import Manager from './src/Manager/Manager';
import {createSpinner} from './src/utils/utils';
import {getPackageJSON} from './src/PackageJSON/PackageJSON';

const {
	_:targetPaths = [],
	include,
} = minimist(process.argv.slice(2));

console.log(`NPMy (ctrl+c -> exit)`);
console.log(` - tmp: ${tmpdir()}`);
include && console.log(` - include: ${include}`);
console.log(`---------------------`);


// Autorun
(async function () {
	const manager = new Manager();

	!targetPaths.length && targetPaths.push('.');

	for (const relativePath of targetPaths) {
		const path = resolve(relativePath);
		const spinner = createSpinner(` %s ${path}`, true);
		const lists = await manager.scan(path, include);

		spinner.stop(true);

		console.log(` ${path}`);

		lists.forEach(({path:pkgPath, rc}) => {
			const {allDependencies} = getPackageJSON(pkgPath);

			console.log(`   /${relative(path, pkgPath)}`);

			Object.entries(rc)
				.filter(([depName]) => allDependencies.hasOwnProperty(depName))
				.forEach(([depName, path]) => {
					console.log(`     [${depName}] -> ${path}`);
				});
		});
	}

	console.log('\nRunning');

	await manager.run();
})();
