NPMy
----
`npm link` on steroids.

```
npm install -g npmy
```

### Usage

 0. `npm install -g npmy`
 1. `cd path/to/project`
 2. Add `.npmyrc` to `.gitignore`
 3. `touch .npmyrc`
 4. Edit `.npmyrc` as JSON-file and write `{"%TARGET_DEPENDENCY%": "%LOCAL_PATH_TO_PACKAGE_FOLDER%"}`
 5. `npmy .`
 6. ...
 7. Profit!


### API

`npmy [path] [--include=pattern]`

 - `path` — by default current folder
 - `include` — see [glob](https://github.com/isaacs/node-glob#glob-primer)


### Description of work

`npmy` — special tool for local packages development, subjecting to other packages being in development.

Usually I solve this task via npm link, or just symlink. These methods don't work,
when dependent package has difficult publish cycle (modifies it's source, e.g. using Babel/Rollup/etc)
or there are more then one.

Trust me, `npmy` covers all above mentioned tasks.


### Development

 - `npm i`
 - `npm test`, [code coverage](./coverage/lcov-report/index.html)
