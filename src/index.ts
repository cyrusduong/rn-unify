import { exec, execSync, SpawnSyncReturns } from "child_process";
import { promisify } from "util";
import fs from "fs";

const execAsync = promisify(exec);

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
async function isRnPackage(pkgName: string) {
  // console.log(`Checking if ${pkgName} contains NativeModule code`);
  const cmd = `rg --quiet --max-count=1 --no-ignore --glob ${extGlob} -e "${rnModuleExpression}" "node_modules/${pkgName}"`;
  try {
    await execAsync(cmd);
    return true;
  } catch (e) {
    const error = e as SpawnSyncReturns<any>;
    if (error?.status === 1) return false; // in rg this is nothing found, not a failure
    // console.error(error);
    return false;
  }
}

async function findRnPackages(packages: string[]) {
  const promises = packages.map(async (pkgName) => {
    const result = await isRnPackage(pkgName);
    return result ? pkgName : null;
  });

  const rnPackages = await Promise.all(promises);
  return rnPackages.filter(Boolean) as string[];
}

function findPackageDuplicates(packageMap: Map<string, Set<string>>) {
  let multipleVersions = 0;
  const packages: string[] = [];
  packageMap.forEach((versions, key) => {
    // console.log(`Evaluating package: ${key}`);

    if (versions.size > 1) {
      multipleVersions++;
      packages.push(key);
    }
  });

  console.log(
    `Found ${multipleVersions} duplicate package versions out of ${packageMap.size}`,
  );
  return packages;
}

function parseYarnLockForPackages() {
  const file = fs.readFileSync("yarn.lock", "utf8");
  const packages = new Map<string, Set<string>>();
  const lines = file.split("\n");
  let currentPackageName = "";

  lines.forEach((line) => {
    line = line.trim();
    if (line.endsWith(":") && !line.includes("dependencies")) {
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
    } else if (line.startsWith("version")) {
      const currentPackageSet = packages.get(currentPackageName);
      const [_, version] = line.replaceAll('"', "").split(" ");
      currentPackageSet?.add(version);
    }
  });

  return packages;
}

console.time("versions");
const packageMap = parseYarnLockForPackages();
const packages = Array.from(packageMap.keys());
console.timeEnd("versions");

console.time("rnPackages");
const rnPackages = findRnPackages(packages);
console.timeEnd("rnPackages");

console.time("dupes");
const duplicates = findPackageDuplicates(packageMap);
console.timeEnd("dupes");

console.time("duplicateRnPackages");
const duplicateRnPackages = (await rnPackages).filter((v) =>
  duplicates.includes(v),
);
console.log(duplicateRnPackages);
console.timeEnd("duplicateRnPackages");
