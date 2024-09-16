import { ExecException, execSync } from "child_process";
import fs from "fs";

function splitVersion(version: string) {
  return version.split(".").map(Number);
}

function getNewerVersion(a: string, b: string) {
  const aParts = splitVersion(a);
  const bParts = splitVersion(b);

  for (let i = 0; i < aParts.length; i++) {
    if (aParts[i] > bParts[i]) return a;
    if (aParts[i] < bParts[i]) return b;
  }

  return a; // If they are the same, return the first
}

function newestVersionFromList(versions: string[]) {
  let newVersion = versions[0];
  for (let i = 1; i < versions.length; i++) {
    newVersion = getNewerVersion(newVersion, versions[i]);
  }
  return newVersion;
}

function resolveConflicts({
  packageName,
  versions,
}: {
  packageName: string;
  versions: string[];
}) {
  let newVersion = newestVersionFromList(versions);
  console.log(
    `Resolved conflict for ${packageName}. Using version ${newVersion}`,
  );
}

function isPackageInstalled(pkg: string) {
  try {
    return execSync(`yarn list ${pkg}`, { encoding: "utf8" });
  } catch (error) {
    console.error("${pkg} is not installed");
  }
}

interface YarnDependency {
  name: string;
  version: string;
  children?: YarnDependency[];
}

function getPackageList() {
  console.log("Getting packages in repo");
  const json = execSync("yarn list --json", { encoding: "utf8" });
  const parsed = JSON.parse(json);
  const packages = parsed.data.trees as YarnDependency[];
  // console.log({ packages });
  return packages;
}

function why(pkg: string) {
  console.log(`Running yarn why for ${pkg}`);
  try {
    return execSync(`yarn why ${pkg}`, { encoding: "utf8" });
  } catch (error) {
    console.error(
      `Error finding reason for ${pkg}: ${(error as Error)?.message}`,
    );
  }
  console.log(`Finished yarn why for ${pkg}`);
}

const extentionsToCheck = ["js", "ts", "tsx", "kts", "java", "m", "h", "swift"];
const extGlob = extentionsToCheck.map((ext) => `"*.${ext}"`).join(" --glob ");
const rnModuleExpression =
  "ReactContextBaseJavaModule|RCTBridgeModule|ReactPackage|NativeModule";
function isRnPackage(pkgName: string) {
  // console.log(`Checking if ${pkgName} contains NativeModule code`);
  try {
    execSync(
      `rg --max-count=1 --no-ignore --glob ${extGlob} -e "${rnModuleExpression}" "node_modules/${pkgName}"`,
      { stdio: "ignore" },
    );
    return true;
  } catch (e) {
    const error = e as ExecException;
    // console.error(error.message);
    // if (error?.code === 1) return false; // in rg this is nothing found, but no failure
    return false;
  }
}

// Note: is this faster? Maybe reimplement and compare rather than using yarn list to search set of paths.
function findRnPackages() {
  const result = execSync(
    `rg --files-with-matches --max-count=1 --no-ignore -e "${rnModuleExpression}" node_modules | sort | uniq`,
  );
  console.log("Found following packages in your project that needs checked:");
  const rnPackages: string[] = result.toString().trimEnd().split("\n");
  console.log(rnPackages);
  return rnPackages;
}

function findPackageDuplicates(packageMap: Map<string, Set<string>>) {
  let multipleVersions = 0;
  packageMap.forEach((versions, key) => {
    console.log(`Evaluating package: ${key}`);

    if (versions.size > 1) {
      multipleVersions++;
    }
  });

  console.log(
    `Found ${multipleVersions} duplicate package versions out of ${packageMap.size}`,
  );
}

function parseYarnLock() {
  const file = fs.readFileSync("yarn.lock", "utf8");
  const packages = new Map<string, Set<string>>();
  const lines = file.split("\n");
  let currentPackageName = "";

  lines.forEach((line) => {
    if (line.endsWith(":")) {
      const split = line.replace('"', "").split("@");
      if (split[0] === "") {
        // leading @ is a scoped package
        currentPackageName = `@${split[1]}`;
      } else {
        currentPackageName = split[0];
      }

      // Initalize the set if this is a new name we're encountering
      const currentPackageSet = packages.get(currentPackageName);
      if (!currentPackageSet) {
        packages.set(currentPackageName, new Set());
      }
    } else if (line.trim().startsWith("version")) {
      const currentPackageSet = packages.get(currentPackageName);
      const [_, version] = line.trim().replaceAll('"', "").split(" ");
      currentPackageSet?.add(version);
    }
  });

  return packages;
}

// const pkgVersions: { [key: string]: Set<string> } = {};
//
// Object.keys(parsed).forEach((key) => {
//   const [pkgName, version] = key.split("@").filter(Boolean); // Handle scoped packages
//   if (!pkgVersions[pkgName]) {
//     pkgVersions[pkgName] = new Set();
//   }
//   pkgVersions[pkgName].add(parsed[key].version);
// });

// console.time("list");
// const list = getPackageList();
// console.log({ list });
// console.timeEnd("list");

console.time("versions");
const list = parseYarnLock();
console.timeEnd("versions");

console.time("dupes");
const duplicates = findPackageDuplicates(list);
console.timeEnd("dupes");

// console.time("rg");
// const grepResult = findRnPackages();
// console.timeEnd("rg");
// console.log({ grepResult });

// console.time("filter");
// const rnPackagesThatAreDuplicated = duplicates.filter(([name]) =>
//   isRnPackage(name),
// );
// rnPackagesThatAreDuplicated.forEach(([name, versionsSet]) => {
//   const versions = Array.from(versionsSet);
//   console.log(`Package: ${name}, Versions: ${versions.join(", ")}`);
// });
// console.timeEnd("filter");

// const whys = rnPackages.map(why);
// console.log(whys);
