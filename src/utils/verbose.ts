import minimist = require('minimist');
import { magenta } from 'chalk';

const {verbose:verboseEnabled} = minimist(process.argv);

export function verbose(...args: any[]) {
	verboseEnabled && console.info(...args.map(a => /bool|string|number/.test(typeof a) ? magenta(a) : a));
}

