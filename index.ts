import {tmpdir} from 'os';
import {resolve} from 'path';
import * as minimist from 'minimist';
import Manager from './src/Manager/Manager';
import {createSpinner} from './src/utils/utils';


const {
	_:targetPaths,
} = minimist(process.argv.slice(2));
const NMPy = {};

// process.stdin.resume();
// process.on('SIGINT', () => process.exit());
process.on('uncaughtException', (err) => {
	console.error(err);
	process.exit();
});

console.log(`NPMy (ctrl+c -> exit)`);
console.log(`tmp: ${tmpdir()}`);
console.log(`---------------------`);


// Autorun
(async function () {
	const manager = new Manager();

	for (const relativePath of targetPaths) {
		const path = resolve(relativePath);
		const spinner = createSpinner(` %s ${path}`, true);
		const lists = await manager.scan(path);

		spinner.stop(true);

		console.log(` - ${path}`);

		lists.forEach(({name, rc}) => {
			console.log(`     ${name}`);

			Object.entries(rc).forEach(([depName, path]) => {
				console.log(`       - ${depName} -> ${path}`);
			});
		});
	}

	console.log('\nPrepare packages');

	await manager.run();
})();
