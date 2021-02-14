import * as minimist from 'minimist';
import { resolve } from 'path';
import { bold } from 'chalk';
import { getLatestVersion } from './src/utils/npm';

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

getLatestVersion(pkg.name).then((version) => {
	if (pkg.vsersion !== version) {
		console.log('⚠️ ', bold.yellow(`npm i -g ${pkg.name}@${version}`));
		console.log('');
	}

	require(`./cmd/${cmd}`);
});
