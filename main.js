const { app, BrowserWindow } = require("electron");
const path = require("path");
const { fork } = require("child_process");
const http = require("http");
const fs   = require("fs");

let mainWindow;
let serverProcess;
let serverPort = 3000;

// Encontra uma porta TCP livre automaticamente
function getFreePort() {
  return new Promise((resolve, reject) => {
    const net = require("net");
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

async function startServer() {
  const userDataPath = app.getPath("userData");
  if (!fs.existsSync(userDataPath)) fs.mkdirSync(userDataPath, { recursive: true });
  const dbPath = path.join(userDataPath, "estoque.db");

  // Porta livre — evita conflito com outros apps do cliente
  const port = await getFreePort();
  serverPort = port;
  console.log("[Main] Banco de dados em:", dbPath);
  console.log("[Main] Porta escolhida:", port);

  serverProcess = fork(path.join(__dirname, "server.js"), [], {
    env: {
      ...process.env,
      PORT: String(port),
      DB_PATH: dbPath,
    },
    silent: true,
  });

  serverProcess.stdout.on("data", (d) => console.log("[Server]", d.toString().trim()));
  serverProcess.stderr.on("data", (d) => console.error("[Server ERR]", d.toString().trim()));
}

function waitForServer(url, retries = 30, interval = 1000) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const try_ = () => {
      http.get(url, () => resolve()).on("error", () => {
        if (++attempts >= retries) reject(new Error("Servidor não iniciou a tempo."));
        else setTimeout(try_, interval);
      });
    };
    try_();
  });
}

function createWindow() {
  // Ícone da janela e da barra de tarefas
  const iconPath = path.join(__dirname, "public", "icon.ico");

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    title: "Estoque Pro",
    icon: iconPath,
    show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
    autoHideMenuBar: true,
    backgroundColor: "#f1f5f9",
  });

  mainWindow.loadURL(`data:text/html,
    <html>
      <body style="margin:0;display:flex;align-items:center;justify-content:center;
                   height:100vh;background:#f1f5f9;font-family:sans-serif;flex-direction:column;gap:16px;">
        <div style="font-size:48px;">📦</div>
        <div style="font-size:20px;font-weight:bold;color:#0f172a;">Estoque Pro</div>
        <div style="color:#64748b;font-size:14px;">Iniciando o servidor, aguarde…</div>
        <div style="width:40px;height:40px;border:4px solid #e2e8f0;
                    border-top-color:#10b981;border-radius:50%;
                    animation:spin 0.8s linear infinite;"></div>
        <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
      </body>
    </html>
  `);

  mainWindow.show();

  waitForServer(`http://localhost:${serverPort}/api/status`)
    .then(() => mainWindow.loadURL(`http://localhost:${serverPort}`))
    .catch((err) => {
      mainWindow.loadURL(`data:text/html,
        <html>
          <body style="margin:0;display:flex;align-items:center;justify-content:center;
                       height:100vh;background:#fff1f2;font-family:sans-serif;flex-direction:column;gap:12px;">
            <div style="font-size:48px;">⚠️</div>
            <div style="font-size:18px;font-weight:bold;color:#991b1b;">Erro ao iniciar o servidor</div>
            <div style="color:#64748b;font-size:13px;">${err.message}</div>
            <button onclick="location.reload()"
                    style="margin-top:8px;padding:10px 24px;background:#10b981;color:#fff;
                           border:none;border-radius:999px;cursor:pointer;font-size:14px;font-weight:bold;">
              Tentar novamente
            </button>
          </body>
        </html>
      `);
    });

  mainWindow.on("closed", () => { mainWindow = null; });
}

app.on("ready", async () => {
  await startServer();
  createWindow();
});

app.on("window-all-closed", () => {
  if (serverProcess) serverProcess.kill();
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (mainWindow === null) createWindow();
});
