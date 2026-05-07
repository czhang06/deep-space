const { execFile } = require("node:child_process");
const path = require("node:path");

function execFileAsync(file, args) {
  return new Promise((resolve, reject) => {
    execFile(file, args, { timeout: 6000 }, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }

      if (stderr && stderr.trim()) {
        reject(new Error(stderr.trim()));
        return;
      }

      resolve(stdout);
    });
  });
}

class WindowsActivityService {
  constructor() {
    this.scriptPath = path.join(__dirname, "..", "scripts", "get-windows-activity.ps1");
  }

  async getCurrentActivity() {
    const stdout = await execFileAsync("powershell.exe", [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      this.scriptPath
    ]);

    return JSON.parse(stdout);
  }
}

module.exports = {
  WindowsActivityService
};
