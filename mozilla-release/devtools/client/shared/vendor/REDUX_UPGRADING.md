[//]: # (
  This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
)

# Upgrading redux

## Getting the Source

```bash
git clone https://github.com/reactjs/redux
cd redux
git checkout v3.7.2 # checkout the right version tag
```

## Building

```bash
npm install
npm run build:umd
cp dist/redux.js <gecko-dev>/devtools/client/shared/vendor/redux.js
```

## Patching react-redux

- open `redux.js`
- Add the version number to the top of the file:
  ```
  /**
   * react-redux v3.7.2
   */
  ```
