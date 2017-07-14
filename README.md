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
 3. `vi .npmyrc`
 4. `{"%TARGET_DEPENDENCY%": "%LOCAL_PATH_TO_PACKAGE_FOLDER%"}`
 5. `nmpy`


### Development

 - `npm i`
 - `npm test`, [code coverage](./coverage/lcov-report/index.html)
