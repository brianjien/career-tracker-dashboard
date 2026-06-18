import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const owner = process.env.WASMER_OWNER || "brianjienop49792399";
const appName = process.env.WASMER_APP_NAME || "uiuc-mcs-internship-tracker";
const wasmerBin = process.env.WASMER_BIN || path.join(os.homedir(), ".wasmer", "bin", "wasmer");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: "inherit",
    ...options,
  });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function appYaml() {
  return `kind: wasmer.io/App.v0
name: ${appName}
owner: ${owner}
package: .
locality:
  regions:
    - fr-pari1
capabilities:
  database:
    engine: mysql
debug: true
enableDatabase: true
annotations:
  shipitcli.com/config:
    commands: {}
    cross_platform: wasix_wasm32
    database: mysql
    extra_dependencies:
      - uvicorn
    framework: flask
    install_requires_all_files: false
    main_file: app.py
    port: 8080
    precompile_python: true
    python_extra_index_url: https://pythonindex.wasix.org/simple
    python_version: "3.13"
    server: uvicorn
    uses_ffmpeg: false
    uses_pandoc: false
    uv_version: 0.8.15
    wsgi_application: a:app
  shipitcli.com/provider: python
  shipitcli.com/version: 0.21.2
`;
}

const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "career-tracker-wasmer-"));

try {
  run("npm", ["run", "build"]);

  await fs.copyFile(path.join(projectRoot, "app.py"), path.join(tempRoot, "app.py"));
  await fs.copyFile(path.join(projectRoot, "a.py"), path.join(tempRoot, "a.py"));
  await fs.copyFile(path.join(projectRoot, "requirements.txt"), path.join(tempRoot, "requirements.txt"));
  await fs.cp(path.join(projectRoot, "dist"), path.join(tempRoot, "dist"), { recursive: true });
  await fs.writeFile(path.join(tempRoot, "app.yaml"), appYaml(), "utf8");

  run(wasmerBin, ["deploy", "--dir", tempRoot, "--build-remote", "--non-interactive", "--no-persist-id"]);
} finally {
  await fs.rm(tempRoot, { recursive: true, force: true });
}
