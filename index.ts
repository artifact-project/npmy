import * as minimist from 'minimist';
import { resolve } from 'path';
import { bold, gray } from 'chalk';
import { getLatestVersion } from './src/utils/npm';
import { verbose } from './src/utils/verbose';

const {
	link,
	help,
} = minimist(process.argv.slice(2));

const cmd = help
	? 'help'
	: link
	? 'link'
	: 'run'
;

if (!cmd) {
	console.error(`Unknown '${cmd}' command`);
	process.exit(1);
}

const pkg = require(resolve(__dirname, 'package.json'));

verbose(pkg.name, pkg.version);

getLatestVersion(pkg.name).then((version) => {
	if (pkg.version !== version) {
		console.log('⚠️ ', bold.yellow(`npm i -g ${pkg.name}@${version}`), gray(`(current: ${pkg.version})`));
		console.log('');
	}

	require(`./cmd/${cmd}`);
});
