import fs from "fs";
import fg from "fast-glob";
import path from "path";
import { execSync } from "child_process";

let unresolveablePackagesFound = false;

function splitVersion(version: string) {
  return version.split(".").map(Number);
}

function getNewerVersion(
  a: string | null,
  b: string,
  opts?: { breakOnMajorVersion?: boolean; packageName?: string },
) {
  if (a === null) {
    return null;
  }

  const aParts = splitVersion(a);
  const bParts = splitVersion(b);

  for (let i = 0; i < aParts.length; i++) {
    if (i === 0 && opts?.breakOnMajorVersion) {
      if (aParts[0] !== bParts[0]) {
        unresolveablePackagesFound = true;
        console.log(
          `${opts?.packageName} major versions ${a} and ${b} are unresolvable.`,
        );
        return null;
      }
    }

    if (aParts[i] > bParts[i]) return a;
    if (aParts[i] < bParts[i]) return b;
  }

  return a; // If they are the same, return the first
}

function newestVersionFromList(
  versions: string[],
  opts?: { packageName?: string },
) {
  let newVersion: string | null = versions[0];
  for (let i = 1; i < versions.length; i++) {
    newVersion = getNewerVersion(newVersion, versions[i], {
      breakOnMajorVersion: true,
      packageName: opts?.packageName,
    });
  }
  return newVersion;
}

const extensionsToCheck = ["js", "ts", "tsx", "kts", "java", "m", "h", "swift"];
const extGlob = extensionsToCheck.map((ext) => `**/*.${ext}`);
const rnModuleExpression =
  /ReactContextBaseJavaModule|RCTBridgeModule|ReactPackage|NativeModule/;
async function isRnPackage(pkgName: string) {
  const cwd = path.join("node_modules", pkgName);
  const files = await fg(extGlob, {
    cwd,
    absolute: true,
    onlyFiles: true,
  });

  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    if (rnModuleExpression.test(content)) {
      return pkgName;
    }
  }

  return null;
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

function findNotHoistedRnPackages(rnPackages: string[]) {
  const notHoisted = rnPackages
    .map((packageName) => {
      // console.log(`Checking if ${packageName} is hoisted to root node_modules`);
      if (!fs.existsSync(`node_modules/${packageName}`)) return packageName;
    })
    .filter(Boolean);

  return notHoisted;
}

function updateResolutions(
  duplicatePackages: string[],
  packageMap: Map<string, Set<string>>,
) {
  let shouldRerunYarn = false;
  const packageJsonPath = path.resolve("package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

  if (!packageJson.resolutions) {
    shouldRerunYarn = true;
    console.log("No resolutions key found in package.json, adding one.");
    packageJson.resolutions = {};
  }

  duplicatePackages.forEach((packageName) => {
    const versions = Array.from(packageMap.get(packageName) || []);
    if (versions.length > 1) {
      const newVersion = newestVersionFromList(versions, {
        packageName,
      });

      if (
        newVersion !== null &&
        newVersion !== packageJson.resolutions?.[packageName]
      ) {
        shouldRerunYarn = true;
        packageJson.resolutions[packageName] = newVersion;
      }
    }
  });

  if (shouldRerunYarn) {
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    console.log("Updated package.json resolutions with resolved versions.");
    console.log("Please re-run yarn to update the node_moudles tree");
  }
}

const packageMap = parseYarnLockForPackages();
const packages = Array.from(packageMap.keys());
const rnPackages = await findRnPackages(packages);
const duplicates = findPackageDuplicates(packageMap);

// We should verify/check that the rnPackges found exist at the root "as to avoid"
const notHoisted = findNotHoistedRnPackages(rnPackages);
if (notHoisted.length > 0) {
  console.log(
    "Following RN packages not found in root node_modules, should these be installed?",
  );
  console.log(notHoisted);
}

// Check packages that might need manual duplication checking
const duplicateRnPackages = rnPackages.filter((v) => duplicates.includes(v));
if (duplicateRnPackages.length > 1) {
  console.log("Found dupilicated versions of the following RN packages:");
  console.log(duplicateRnPackages);
  updateResolutions(duplicateRnPackages, packageMap);

  if (unresolveablePackagesFound) {
    console.warn(
      "warning: There are packages that cannot be automatically resolved using resolutions.",
    );
    console.log(
      "Please use `yarn why {packageName}` to understand why they are required.",
    );
  }
} else {
  console.log(
    "It appears everything is in order, no duplicated RN packages found.",
  );
}

// TODO: Needs a peerDep flow in our FE repo
