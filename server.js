const express = require("express");
const path    = require("path");
const cors    = require("cors");
const { adapter: db, init } = require("./database");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Status
app.get("/api/status", (req, res) => {
  res.json({ mensagem: "Estoque Pro API rodando!" });
});

// ==========================================
// PRODUTOS
// ==========================================

app.get("/api/produtos", (req, res) => {
  db.all("SELECT * FROM products ORDER BY nome", [], (err, rows) => {
    if (err) return res.status(500).json({ erro: err.message });
    res.json(rows);
  });
});

app.get("/api/produtos/:id", (req, res) => {
  db.get("SELECT * FROM products WHERE id = ?", [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ erro: err.message });
    if (!row) return res.status(404).json({ erro: "Produto não encontrado." });
    res.json(row);
  });
});

app.post("/api/produtos", (req, res) => {
  const { nome, descricao, preco_unitario, quantidade_atual, limite_minimo } = req.body;
  if (!nome || nome.trim() === "")
    return res.status(400).json({ erro: "O nome do produto é obrigatório." });
  if (preco_unitario == null || isNaN(preco_unitario) || preco_unitario < 0)
    return res.status(400).json({ erro: "Preço unitário inválido." });

  db.run(
    "INSERT INTO products (nome, descricao, preco_unitario, quantidade_atual, limite_minimo) VALUES (?, ?, ?, ?, ?)",
    [nome.trim(), descricao || "", preco_unitario, quantidade_atual || 0, limite_minimo || 5],
    function (err) {
      if (err) return res.status(500).json({ erro: err.message });
      res.status(201).json({ id: this.lastID, mensagem: "Produto cadastrado com sucesso!" });
    }
  );
});

app.put("/api/produtos/:id", (req, res) => {
  const { id } = req.params;
  const { nome, descricao, preco_unitario, quantidade_atual, limite_minimo } = req.body;
  if (!nome || nome.trim() === "")
    return res.status(400).json({ erro: "O nome do produto é obrigatório." });
  if (preco_unitario == null || isNaN(preco_unitario) || preco_unitario < 0)
    return res.status(400).json({ erro: "Preço unitário inválido." });

  db.run(
    "UPDATE products SET nome=?, descricao=?, preco_unitario=?, quantidade_atual=?, limite_minimo=? WHERE id=?",
    [nome.trim(), descricao || "", preco_unitario, quantidade_atual, limite_minimo || 5, id],
    function (err) {
      if (err) return res.status(500).json({ erro: err.message });
      if (this.changes === 0) return res.status(404).json({ erro: "Produto não encontrado." });
      res.json({ mensagem: "Produto atualizado com sucesso!" });
    }
  );
});

app.delete("/api/produtos/:id", (req, res) => {
  db.run("DELETE FROM products WHERE id = ?", [req.params.id], function (err) {
    if (err) return res.status(500).json({ erro: err.message });
    if (this.changes === 0) return res.status(404).json({ erro: "Produto não encontrado." });
    res.json({ mensagem: "Produto excluído com sucesso!" });
  });
});

// ==========================================
// MOVIMENTAÇÕES
// ==========================================

app.post("/api/movimentacoes", (req, res) => {
  const { produto_id, tipo, quantidade, usuario_id, forcar } = req.body;
  if (!produto_id || !tipo || !quantidade || quantidade <= 0)
    return res.status(400).json({ erro: "Dados inválidos para movimentação." });
  if (!["entrada", "saida"].includes(tipo))
    return res.status(400).json({ erro: "Tipo deve ser 'entrada' ou 'saida'." });

  const delta = tipo === "entrada" ? Math.abs(quantidade) : -Math.abs(quantidade);

  db.get("SELECT quantidade_atual FROM products WHERE id = ?", [produto_id], (err, row) => {
    if (err) return res.status(500).json({ erro: err.message });
    if (!row) return res.status(404).json({ erro: "Produto não encontrado." });

    const novoSaldo = row.quantidade_atual + delta;
    if (novoSaldo < 0 && !forcar)
      return res.status(400).json({ erro: `Saldo insuficiente. Estoque atual: ${row.quantidade_atual} un.`, requer_confirmacao: true });

    db.run(
      "UPDATE products SET quantidade_atual = quantidade_atual + ? WHERE id = ?",
      [delta, produto_id],
      function (err) {
        if (err) return res.status(500).json({ erro: err.message });
        db.run(
          "INSERT INTO stock_transactions (produto_id, usuario_id, tipo, quantidade) VALUES (?, ?, ?, ?)",
          [produto_id, usuario_id || null, tipo, Math.abs(quantidade)],
          function (logErr) { if (logErr) console.error("Histórico:", logErr.message); }
        );
        res.json({ mensagem: "Estoque atualizado!", novo_saldo: novoSaldo });
      }
    );
  });
});

app.get("/api/movimentacoes", (req, res) => {
  db.all(
    `SELECT st.id, st.tipo, st.quantidade, st.data_movimentacao,
            p.nome AS produto_nome, u.nome AS usuario_nome
     FROM stock_transactions st
     LEFT JOIN products p ON st.produto_id = p.id
     LEFT JOIN users    u ON st.usuario_id = u.id
     ORDER BY st.id DESC LIMIT 200`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ erro: err.message });
      res.json(rows);
    }
  );
});

// ==========================================
// USUÁRIOS
// ==========================================

app.get("/api/usuarios", (req, res) => {
  db.all("SELECT id, nome, email, role FROM users ORDER BY nome", [], (err, rows) => {
    if (err) return res.status(500).json({ erro: err.message });
    res.json(rows);
  });
});

app.get("/api/usuarios/:id", (req, res) => {
  db.get("SELECT id, nome, email, role FROM users WHERE id = ?", [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ erro: err.message });
    if (!row) return res.status(404).json({ erro: "Usuário não encontrado." });
    res.json(row);
  });
});

app.post("/api/usuarios", (req, res) => {
  const { nome, email, senha, role } = req.body;
  if (!nome || !email || !senha)
    return res.status(400).json({ erro: "Nome, e-mail e senha são obrigatórios." });

  db.run(
    "INSERT INTO users (nome, email, senha_hash, role) VALUES (?, ?, ?, ?)",
    [nome, email, senha, role || "operador"],
    function (err) {
      if (err) {
        if (err.message && err.message.includes("UNIQUE"))
          return res.status(409).json({ erro: "Este e-mail já está em uso." });
        return res.status(500).json({ erro: err.message });
      }
      res.status(201).json({ id: this.lastID, mensagem: "Usuário criado com sucesso!" });
    }
  );
});

app.put("/api/usuarios/:id", (req, res) => {
  const { id } = req.params;
  const { nome, email, senha, role } = req.body;
  if (!nome || nome.trim() === "") return res.status(400).json({ erro: "O nome é obrigatório." });
  if (!email || email.trim() === "") return res.status(400).json({ erro: "O e-mail é obrigatório." });

  const sql    = senha && senha.trim()
    ? "UPDATE users SET nome=?, email=?, senha_hash=?, role=? WHERE id=?"
    : "UPDATE users SET nome=?, email=?, role=? WHERE id=?";
  const params = senha && senha.trim()
    ? [nome.trim(), email.trim(), senha.trim(), role || "operador", id]
    : [nome.trim(), email.trim(), role || "operador", id];

  db.run(sql, params, function (err) {
    if (err) {
      if (err.message && err.message.includes("UNIQUE"))
        return res.status(409).json({ erro: "Este e-mail já está em uso por outro usuário." });
      return res.status(500).json({ erro: err.message });
    }
    if (this.changes === 0) return res.status(404).json({ erro: "Usuário não encontrado." });
    res.json({ mensagem: "Usuário atualizado com sucesso!" });
  });
});

app.delete("/api/usuarios/:id", (req, res) => {
  db.run("DELETE FROM users WHERE id = ? AND role != 'admin'", [req.params.id], function (err) {
    if (err) return res.status(500).json({ erro: err.message });
    if (this.changes === 0)
      return res.status(403).json({ erro: "Não é possível remover um administrador." });
    res.json({ mensagem: "Usuário removido com sucesso." });
  });
});

// ==========================================
// LOGIN
// ==========================================

app.post("/api/login", (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) return res.status(400).json({ erro: "E-mail e senha são obrigatórios." });

  db.get(
    "SELECT id, nome, email, role FROM users WHERE email = ? AND senha_hash = ?",
    [email, senha],
    (err, user) => {
      if (err) return res.status(500).json({ erro: err.message });
      if (user) return res.json(user);
      res.status(401).json({ erro: "E-mail ou senha incorretos." });
    }
  );
});

// ==========================================
// START — aguarda o banco inicializar antes de ouvir
// ==========================================

const PORT = process.env.PORT || 3000;

init().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🚀 Estoque Pro rodando em: http://localhost:${PORT}`);
    console.log(`   Login padrão: admin@estoque.com / admin123\n`);
  });
}).catch((err) => {
  console.error("Falha ao inicializar banco de dados:", err);
  process.exit(1);
});
