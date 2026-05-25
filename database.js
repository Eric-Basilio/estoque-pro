/**
 * database.js — Adaptador sql.js (100% JavaScript puro, sem compilação nativa)
 *
 * sql.js carrega o banco em memória e persiste em arquivo .db manualmente.
 * A API exposta imita o sqlite3 (db.all / db.get / db.run com callbacks)
 * para que o server.js não precise ser alterado.
 */

const fs   = require("fs");
const path = require("path");

// FIX Bug 2: usa DB_PATH do env (definido pelo Electron) ou fallback local para dev
const DB_PATH = process.env.DB_PATH || path.resolve(__dirname, "estoque.db");

let SQL = null; // sql.js namespace
let db  = null; // instância do banco em memória

// Persiste o banco em disco após cada escrita
function saveDb() {
  try {
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  } catch (e) {
    console.error("Erro ao salvar banco:", e.message);
  }
}

// Converte o resultado do sql.js ({ columns, values }) para array de objetos
function toObjects(result) {
  if (!result || result.length === 0) return [];
  const { columns, values } = result[0];
  return values.map((row) => {
    const obj = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
}

// Cria as tabelas e insere o admin padrão
function setupSchema() {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      nome       TEXT    NOT NULL,
      email      TEXT    UNIQUE NOT NULL,
      senha_hash TEXT    NOT NULL,
      role       TEXT    NOT NULL DEFAULT 'operador'
    )
  `);

  db.run(`
    INSERT OR IGNORE INTO users (nome, email, senha_hash, role)
    VALUES ('Administrador', 'admin@estoque.com', 'admin123', 'admin')
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      nome             TEXT    NOT NULL,
      descricao        TEXT    DEFAULT '',
      preco_unitario   REAL    NOT NULL,
      quantidade_atual INTEGER NOT NULL DEFAULT 0,
      limite_minimo    INTEGER DEFAULT 5
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS stock_transactions (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      produto_id         INTEGER,
      usuario_id         INTEGER,
      tipo               TEXT    NOT NULL,
      quantidade         INTEGER NOT NULL,
      data_movimentacao  TEXT    DEFAULT (datetime('now','localtime'))
    )
  `);

  saveDb();
  console.log("✅ Tabelas verificadas/criadas com sucesso.");
}

// ─── API compatível com sqlite3 ───────────────────────────────────────────────

const adapter = {
  // Executa SELECT e retorna múltiplas linhas
  all(sql, params, callback) {
    try {
      const result = db.exec(sql, params);
      callback(null, toObjects(result));
    } catch (e) {
      callback(e);
    }
  },

  // Executa SELECT e retorna a primeira linha
  get(sql, params, callback) {
    try {
      const result = db.exec(sql, params);
      const rows   = toObjects(result);
      callback(null, rows[0] || null);
    } catch (e) {
      callback(e);
    }
  },

  // Executa INSERT / UPDATE / DELETE
  run(sql, params, callback) {
    try {
      db.run(sql, params);
      const changes = db.getRowsModified();
      // lastID via last_insert_rowid()
      let lastID = null;
      try {
        const r = db.exec("SELECT last_insert_rowid() AS id");
        lastID  = toObjects(r)[0]?.id ?? null;
      } catch (_) {}
      saveDb();
      if (callback) callback.call({ lastID, changes }, null);
    } catch (e) {
      if (callback) callback.call({ lastID: null, changes: 0 }, e);
    }
  },
};

// ─── Inicialização assíncrona ─────────────────────────────────────────────────

async function init() {
  const initSqlJs = require("sql.js");
  SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
    console.log("✅ Banco de dados carregado de:", DB_PATH);
  } else {
    db = new SQL.Database();
    console.log("✅ Novo banco de dados criado em:", DB_PATH);
  }

  setupSchema();
}

module.exports = { adapter, init };
