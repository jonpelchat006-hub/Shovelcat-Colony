/**
 * DAEMON / SERVICE INSTALLER
 * ==========================
 *
 * Installs the Shovelcat spore as a system service:
 *   - Windows: Task Scheduler (runs at login, restarts on failure)
 *   - Linux:   systemd user unit
 *
 * The spore runs as the user, not as root/admin.
 * It should be invisible — no console window, no tray icon, just results.
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const TASK_NAME = "ShovelcatSpore";

// ── Windows: Task Scheduler ────────────────────────────────────────────

function installWindows(exePath: string): { success: boolean; message: string } {
  try {
    // Create XML for Task Scheduler
    const xml = `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.4" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>Shovelcat derivative chain optimizer</Description>
    <Author>Shovelcat</Author>
  </RegistrationInfo>
  <Triggers>
    <LogonTrigger>
      <Enabled>true</Enabled>
    </LogonTrigger>
  </Triggers>
  <Principals>
    <Principal>
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>LeastPrivilege</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>true</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>true</Hidden>
    <RunOnlyIfIdle>false</RunOnlyIfIdle>
    <WakeToRun>false</WakeToRun>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <Priority>7</Priority>
    <RestartOnFailure>
      <Interval>PT1M</Interval>
      <Count>3</Count>
    </RestartOnFailure>
  </Settings>
  <Actions>
    <Exec>
      <Command>node</Command>
      <Arguments>"${exePath}" start</Arguments>
    </Exec>
  </Actions>
</Task>`;

    const xmlPath = path.join(require("os").tmpdir(), "shovelcat-task.xml");
    fs.writeFileSync(xmlPath, xml, "utf-16le");

    execSync(`schtasks /Create /TN "${TASK_NAME}" /XML "${xmlPath}" /F`, {
      encoding: "utf-8",
      stdio: "pipe",
    });

    fs.unlinkSync(xmlPath);

    return { success: true, message: `Task "${TASK_NAME}" installed. Runs at login, hidden, restarts on failure.` };
  } catch (e: any) {
    return { success: false, message: `Failed to install: ${e.message}` };
  }
}

function uninstallWindows(): { success: boolean; message: string } {
  try {
    execSync(`schtasks /Delete /TN "${TASK_NAME}" /F`, {
      encoding: "utf-8",
      stdio: "pipe",
    });
    return { success: true, message: `Task "${TASK_NAME}" removed.` };
  } catch (e: any) {
    return { success: false, message: `Failed to uninstall: ${e.message}` };
  }
}

function statusWindows(): { installed: boolean; running: boolean; info: string } {
  try {
    const out = execSync(`schtasks /Query /TN "${TASK_NAME}" /FO CSV /NH`, {
      encoding: "utf-8",
      stdio: "pipe",
    });
    const running = out.includes("Running");
    return { installed: true, running, info: out.trim() };
  } catch {
    return { installed: false, running: false, info: "Not installed" };
  }
}

// ── Linux: systemd user unit ───────────────────────────────────────────

function installLinux(exePath: string): { success: boolean; message: string } {
  try {
    const unitDir = path.join(require("os").homedir(), ".config", "systemd", "user");
    if (!fs.existsSync(unitDir)) fs.mkdirSync(unitDir, { recursive: true });

    const unit = `[Unit]
Description=Shovelcat derivative chain optimizer
After=default.target

[Service]
Type=simple
ExecStart=/usr/bin/node ${exePath} start
Restart=on-failure
RestartSec=10

[Install]
WantedBy=default.target
`;

    fs.writeFileSync(path.join(unitDir, "shovelcat.service"), unit);

    execSync("systemctl --user daemon-reload", { encoding: "utf-8", stdio: "pipe" });
    execSync("systemctl --user enable shovelcat.service", { encoding: "utf-8", stdio: "pipe" });
    execSync("systemctl --user start shovelcat.service", { encoding: "utf-8", stdio: "pipe" });

    return { success: true, message: "systemd user unit installed and started." };
  } catch (e: any) {
    return { success: false, message: `Failed to install: ${e.message}` };
  }
}

function uninstallLinux(): { success: boolean; message: string } {
  try {
    execSync("systemctl --user stop shovelcat.service", { encoding: "utf-8", stdio: "pipe" });
    execSync("systemctl --user disable shovelcat.service", { encoding: "utf-8", stdio: "pipe" });

    const unitPath = path.join(require("os").homedir(), ".config", "systemd", "user", "shovelcat.service");
    if (fs.existsSync(unitPath)) fs.unlinkSync(unitPath);

    execSync("systemctl --user daemon-reload", { encoding: "utf-8", stdio: "pipe" });
    return { success: true, message: "systemd unit removed." };
  } catch (e: any) {
    return { success: false, message: `Failed to uninstall: ${e.message}` };
  }
}

function statusLinux(): { installed: boolean; running: boolean; info: string } {
  try {
    const out = execSync("systemctl --user status shovelcat.service", {
      encoding: "utf-8",
      stdio: "pipe",
    });
    const running = out.includes("active (running)");
    return { installed: true, running, info: out.trim() };
  } catch {
    return { installed: false, running: false, info: "Not installed" };
  }
}

// ── Cross-platform API ─────────────────────────────────────────────────

export function installService(exePath: string): { success: boolean; message: string } {
  return process.platform === "win32" ? installWindows(exePath) : installLinux(exePath);
}

export function uninstallService(): { success: boolean; message: string } {
  return process.platform === "win32" ? uninstallWindows() : uninstallLinux();
}

export function serviceStatus(): { installed: boolean; running: boolean; info: string } {
  return process.platform === "win32" ? statusWindows() : statusLinux();
}
