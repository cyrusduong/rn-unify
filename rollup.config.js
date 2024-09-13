import resolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import { chmodSync } from "fs";

const file = "lib/index.js";

const shebang = {
  name: "add-shebang",
  generateBundle(_options, bundle) {
    // console.log({ bundle });
    const fileName = "index.js";
    const shebang = "#!/usr/bin/env node\n\n";
    // Check if the file exists in the bundle
    if (bundle[fileName]) {
      // Add the shebang to the top of the file
      bundle[fileName].code = shebang + bundle[fileName].code;
      // console.log(`Shebang added to ${fileName}`);
    } else {
      console.error(`${fileName} not found in bundle.`);
    }
  },
};

const makeExecutable = {
  name: "make-executable",
  generateBundle(_options, bundle) {
    // console.log({ bundle });
    if (bundle) {
      chmodSync(file, "755");
      // console.log(`Shebang added to ${fileName}`);
    } else {
      console.error(`No bundle config found`);
    }
  },
};

export default {
  input: "src/index.ts",
  output: {
    file,
    format: "es",
  },
  plugins: [resolve(), typescript(), shebang, makeExecutable],
};
