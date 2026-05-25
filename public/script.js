// ==========================================
// 1. VARIÁVEIS GLOBAIS
// ==========================================
let movModal, bootstrapModal, userModal, editUserModal, appToast;
let myChart      = null;
let editingId    = null;
let movProdutoId = null;
let movProdutoQtd  = 0;
let movProdutoNome = "";
let currentStatusFilter = "todos";

// Inicializa componentes Bootstrap após o DOM estar pronto
window.addEventListener("DOMContentLoaded", () => {
  movModal       = new bootstrap.Modal(document.getElementById("modalMovimentacao"));
  bootstrapModal  = new bootstrap.Modal(document.getElementById("modalProduto"));
  userModal      = new bootstrap.Modal(document.getElementById("modalUsuario"));
  editUserModal  = new bootstrap.Modal(document.getElementById("modalEditarUsuario"));
  appToast       = new bootstrap.Toast(document.getElementById("appToast"), { delay: 3000 });

  // Botão de mostrar/ocultar senha no modal de edição
  document.getElementById("toggleEditSenha").addEventListener("click", () => {
    const input = document.getElementById("edit-user-senha");
    const icon  = document.getElementById("toggleEditSenhaIcon");
    if (input.type === "password") {
      input.type  = "text";
      icon.className = "bi bi-eye-slash";
    } else {
      input.type  = "password";
      icon.className = "bi bi-eye";
    }
  });
});

// ==========================================
// 2. SISTEMA DE NOTIFICAÇÕES (TOAST)
//    Substitui os alert() por notificações elegantes
// ==========================================
function showToast(message, type = "success") {
  const toast   = document.getElementById("appToast");
  const msgEl   = document.getElementById("toastMessage");
  // Remove classes de cor anteriores
  toast.classList.remove("bg-success", "bg-danger", "bg-warning", "bg-info");
  toast.classList.add(`bg-${type}`);
  msgEl.textContent = message;
  appToast.show();
}

// ==========================================
// 3. LOGIN E INICIALIZAÇÃO
// ==========================================

window.addEventListener("load", () => {
  const savedUser = localStorage.getItem("usuarioLogado");
  if (savedUser) {
    document.getElementById("login-screen").classList.add("d-none");
    initApp();
    showSection("section-dashboard", "nav-dashboard");
    loadProducts();
  }
});

document.getElementById("loginForm").addEventListener("submit", async function (e) {
  e.preventDefault();

  const email = document.getElementById("login-email").value;
  const senha = document.getElementById("login-senha").value;
  const btn   = document.getElementById("loginBtn");
  btn.disabled    = true;
  btn.textContent = "Entrando…";

  try {
    const response = await fetch("/api/login", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ email, senha }),
    });
    const result = await response.json();

    if (response.ok) {
      localStorage.setItem("usuarioLogado", JSON.stringify(result));
      document.getElementById("login-screen").classList.add("d-none");
      initApp();
      showSection("section-dashboard", "nav-dashboard");
      loadProducts();
    } else {
      alert(result.erro || "E-mail ou senha incorretos.");
    }
  } catch {
    alert("Erro ao conectar com o servidor. Verifique se ele está em execução.");
  } finally {
    btn.disabled    = false;
    btn.textContent = "Entrar";
  }
});

// FIX #7: sidebar dinâmica baseada no usuário logado
function initApp() {
  const user = JSON.parse(localStorage.getItem("usuarioLogado"));
  if (!user) return;

  // Iniciais para o avatar
  const initials = user.nome
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  document.getElementById("sidebar-avatar").textContent = initials;
  document.getElementById("sidebar-nome").textContent   = user.nome;
  document.getElementById("sidebar-role").textContent   = user.role === "admin" ? "Administrador" : "Operador";

  // Aba Usuários: visível apenas para admin
  const navUsuarios = document.getElementById("nav-usuarios");
  if (user.role === "admin") {
    navUsuarios.classList.remove("d-none");
  } else {
    navUsuarios.classList.add("d-none");
  }
}

// ==========================================
// 4. NAVEGAÇÃO SPA
// ==========================================

function showSection(sectionId, navId) {
  document.querySelectorAll(".app-section").forEach((s) => s.classList.add("d-none"));
  document.querySelectorAll(".sidebar .nav-link").forEach((n) => {
    n.classList.remove("active", "text-white");
    n.classList.add("text-secondary");
  });

  document.getElementById(sectionId).classList.remove("d-none");
  const activeNav = document.getElementById(navId);
  if (activeNav) {
    activeNav.classList.remove("text-secondary");
    activeNav.classList.add("active", "text-white");
  }
}

// FIX #6: Dashboard recarrega dados ao ser revisitado
document.getElementById("nav-dashboard").addEventListener("click", (e) => {
  e.preventDefault();
  showSection("section-dashboard", "nav-dashboard");
  loadProducts();
});

document.getElementById("nav-produtos").addEventListener("click", (e) => {
  e.preventDefault();
  showSection("section-produtos", "nav-produtos");
  loadProducts();
});

document.getElementById("nav-historico").addEventListener("click", (e) => {
  e.preventDefault();
  showSection("section-historico", "nav-historico");
  loadHistory();
});

// FIX #5: evento registrado UMA única vez (havia duplicata nas seções 3 e 9)
document.getElementById("nav-usuarios").addEventListener("click", (e) => {
  e.preventDefault();
  const user = JSON.parse(localStorage.getItem("usuarioLogado"));
  if (user && user.role === "admin") {
    showSection("section-usuarios", "nav-usuarios");
    loadUsers();
  } else {
    showToast("Acesso negado. Apenas administradores.", "danger");
    showSection("section-produtos", "nav-produtos");
  }
});

document.getElementById("nav-logout").addEventListener("click", (e) => {
  e.preventDefault();

  // Modal de confirmação customizado — substitui confirm() que pode travar no Electron
  const overlay = document.createElement("div");
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.5);
    z-index:9999;display:flex;align-items:center;justify-content:center;
  `;
  overlay.innerHTML = `
    <div style="background:#fff;border-radius:16px;padding:32px;max-width:360px;
                width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.3);text-align:center;">
      <div style="font-size:40px;margin-bottom:12px;">👋</div>
      <h5 style="font-weight:700;margin-bottom:8px;">Sair do sistema?</h5>
      <p style="color:#64748b;font-size:14px;margin-bottom:24px;">
        Você precisará fazer login novamente para acessar.
      </p>
      <div style="display:flex;gap:12px;">
        <button id="logout-cancel"
          style="flex:1;padding:10px;border:1px solid #e2e8f0;border-radius:999px;
                 background:#f8fafc;cursor:pointer;font-weight:600;font-size:14px;">
          Cancelar
        </button>
        <button id="logout-confirm"
          style="flex:1;padding:10px;border:none;border-radius:999px;
                 background:#ef4444;color:#fff;cursor:pointer;font-weight:600;font-size:14px;">
          Sair
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById("logout-cancel").onclick = () => overlay.remove();

  document.getElementById("logout-confirm").onclick = () => {
    // Limpa sessão e recarrega a página completamente
    // Isso zera 100% do estado: Bootstrap, modais, backdrops, variáveis JS
    localStorage.removeItem("usuarioLogado");
    window.location.reload();
  };
});

// ==========================================
// 5. CARREGAMENTO DE PRODUTOS
// ==========================================

async function loadProducts() {
  try {
    const response = await fetch("/api/produtos");
    const products = await response.json();
    if (Array.isArray(products)) {
      renderTable(products);
      updateKPIs(products);
      renderChart(products);
    }
  } catch (error) {
    console.error("Falha ao buscar produtos:", error);
  }
}

function updateKPIs(products) {
  const total      = products.length;
  const valorTotal = products.reduce((acc, p) => acc + p.preco_unitario * p.quantidade_atual, 0);
  const alertas    = products.filter((p) => p.quantidade_atual > 0 && p.quantidade_atual <= (p.limite_minimo || 5)).length;
  const zerados    = products.filter((p) => p.quantidade_atual <= 0).length;

  document.getElementById("kpi-total").innerText   = total;
  document.getElementById("kpi-valor").innerText   = valorTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  document.getElementById("kpi-alertas").innerText = alertas;
  document.getElementById("kpi-zerados").innerText = zerados;
}

function getStockBadge(qtd, limite) {
  if (qtd <= 0)          return `<span class="badge badge-stock-empty rounded-pill px-3">${qtd} un</span>`;
  if (qtd <= limite)     return `<span class="badge badge-stock-low rounded-pill px-3">${qtd} un</span>`;
  return                        `<span class="badge badge-stock-ok rounded-pill px-3">${qtd} un</span>`;
}

function renderTable(products) {
  const tableBody = document.getElementById("table-body");
  const user = JSON.parse(localStorage.getItem("usuarioLogado")) || { role: "operador" };

  if (products.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center text-muted py-5">
          <i class="bi bi-inbox display-6 d-block mb-2 opacity-50"></i>
          Nenhum produto cadastrado. Clique em <strong>+ Novo Produto</strong> para começar.
        </td>
      </tr>`;
    return;
  }

  tableBody.innerHTML = products
    .map(
      (p, index) => `
      <tr data-limite="${p.limite_minimo || 5}" data-id="${p.id}">
        <td class="ps-4 text-secondary fw-bold">${index + 1}</td>
        <td><div class="fw-bold text-dark">${p.nome}</div></td>
        <td class="text-secondary small">${p.descricao || '<span class="fst-italic">Sem descrição</span>'}</td>
        <td>${getStockBadge(p.quantidade_atual, p.limite_minimo || 5)}</td>
        <td class="fw-bold">${Number(p.preco_unitario).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
        <td class="fw-bold text-success">
          ${(p.quantidade_atual * p.preco_unitario).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
        </td>
        <td class="text-end pe-4">
          ${
            user.role === "admin"
              ? `<button class="btn btn-sm btn-outline-secondary border-0 rounded-pill px-3 me-1"
                         onclick="prepareEdit(${p.id})" title="Editar">
                   <i class="bi bi-pencil"></i>
                 </button>
                 <button class="btn btn-sm btn-outline-danger border-0 rounded-pill px-3 me-1"
                         onclick="deleteProduct(${p.id})" title="Excluir">
                   <i class="bi bi-trash"></i>
                 </button>`
              : ""
          }
          <button class="btn btn-sm btn-outline-primary border-0 rounded-pill px-3"
                  onclick="prepareMov(${p.id}, ${p.quantidade_atual}, '${p.nome.replace(/'/g, "\\'")}')"
                  title="Movimentar Estoque">
            <i class="bi bi-arrow-left-right"></i>
          </button>
        </td>
      </tr>`
    )
    .join("");

  applyAllFilters();
}

// ==========================================
// 6. CRUD DE PRODUTOS
// ==========================================

document.getElementById("openModal").addEventListener("click", () => {
  editingId = null;
  document.getElementById("productForm").reset();
  document.getElementById("quantidade").value    = "0";
  document.getElementById("limite_minimo").value = "5";
  document.getElementById("modalProdutoTitle").innerText = "Cadastrar Novo Produto";
});

// FIX #8 + #11: usa GET /api/produtos/:id em vez de buscar a lista inteira
async function prepareEdit(id) {
  editingId = id;
  try {
    const response = await fetch(`/api/produtos/${id}`);
    const product  = await response.json();

    if (!product || !product.id) throw new Error("Produto não encontrado.");

    document.getElementById("nome").value         = product.nome;
    document.getElementById("descricao").value    = product.descricao || "";
    document.getElementById("preco").value        = product.preco_unitario;
    document.getElementById("quantidade").value   = product.quantidade_atual;
    document.getElementById("limite_minimo").value = product.limite_minimo ?? 5;
    document.getElementById("modalProdutoTitle").innerText = `Editar: ${product.nome}`;
    bootstrapModal.show();
  } catch {
    showToast("Erro ao carregar dados do produto.", "danger");
  }
}

document.getElementById("productForm").onsubmit = async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;

  const productData = {
    nome:             document.getElementById("nome").value,
    descricao:        document.getElementById("descricao").value,
    preco_unitario:   parseFloat(document.getElementById("preco").value),
    quantidade_atual: parseInt(document.getElementById("quantidade").value) || 0,
    limite_minimo:    parseInt(document.getElementById("limite_minimo").value) || 5,
  };

  const url    = editingId ? `/api/produtos/${editingId}` : "/api/produtos";
  const method = editingId ? "PUT" : "POST";

  try {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(productData),
    });
    const result = await response.json();

    if (response.ok) {
      bootstrapModal.hide();
      document.getElementById("productForm").reset();
      loadProducts();
      showToast(editingId ? "Produto atualizado com sucesso!" : "Produto cadastrado com sucesso!");
      editingId = null;
    } else {
      showToast(result.erro || "Erro ao salvar produto.", "danger");
    }
  } catch {
    showToast("Erro de comunicação com o servidor.", "danger");
  } finally {
    btn.disabled = false;
  }
};

async function deleteProduct(id) {
  if (confirm("Tem certeza que deseja excluir este produto? Esta ação não pode ser desfeita.")) {
    try {
      const response = await fetch(`/api/produtos/${id}`, { method: "DELETE" });
      if (response.ok) {
        loadProducts();
        showToast("Produto excluído com sucesso.");
      } else {
        const err = await response.json();
        showToast(err.erro || "Erro ao excluir produto.", "danger");
      }
    } catch {
      showToast("Erro de comunicação com o servidor.", "danger");
    }
  }
}

// ==========================================
// 7. MOVIMENTAÇÃO DE ESTOQUE
// ==========================================

function prepareMov(id, qtd, nome) {
  movProdutoId   = id;
  movProdutoQtd  = qtd;
  movProdutoNome = nome;
  document.getElementById("movimentacaoForm").reset();
  document.getElementById("mov-produto-nome").textContent = `Produto: ${nome}`;
  updateSaldoInfo(0);
  movModal.show();
}

function updateSaldoInfo(qtdInformada) {
  const tipo      = document.getElementById("mov-tipo").value;
  const novoSaldo = tipo === "entrada" ? movProdutoQtd + qtdInformada : movProdutoQtd - qtdInformada;
  const infoEl    = document.getElementById("mov-saldo-info");
  infoEl.textContent = `Saldo atual: ${movProdutoQtd} un. → Novo saldo: ${novoSaldo} un.`;
  infoEl.className   = `form-text fw-medium ${novoSaldo < 0 ? "text-danger" : "text-muted"}`;
}

document.getElementById("mov-tipo").addEventListener("change", () => {
  updateSaldoInfo(parseInt(document.getElementById("mov-qtd").value) || 0);
});
document.getElementById("mov-qtd").addEventListener("input", function () {
  updateSaldoInfo(parseInt(this.value) || 0);
});

document.getElementById("movimentacaoForm").onsubmit = async (e) => {
  e.preventDefault();
  const tipo         = document.getElementById("mov-tipo").value;
  const qtdInformada = parseInt(document.getElementById("mov-qtd").value);
  const user         = JSON.parse(localStorage.getItem("usuarioLogado"));

  if (tipo === "saida" && movProdutoQtd - qtdInformada < 0) {
    if (!confirm(`Atenção: saldo insuficiente (${movProdutoQtd} un). O estoque ficará negativo. Confirmar mesmo assim?`)) return;
  }

  try {
    const res = await fetch("/api/movimentacoes", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        produto_id:  movProdutoId,
        tipo,
        quantidade:  qtdInformada,
        usuario_id:  user?.id,
        forcar:      true,
      }),
    });
    const result = await res.json();

    if (res.ok) {
      movModal.hide();
      loadProducts();
      showToast(`${tipo === "entrada" ? "Entrada" : "Saída"} de ${qtdInformada} un. registrada! Novo saldo: ${result.novo_saldo} un.`);
    } else {
      showToast(result.erro || "Erro na movimentação.", "danger");
    }
  } catch {
    showToast("Erro de comunicação com o servidor.", "danger");
  }
};

// ==========================================
// 8. FILTROS E BUSCA EM TEMPO REAL
// ==========================================

function applyAllFilters() {
  const termoBusca = document.getElementById("searchInput").value.toLowerCase();
  const linhas     = document.querySelectorAll("#table-body tr[data-id]");

  linhas.forEach((linha) => {
    const nome      = linha.querySelector("td:nth-child(2)")?.textContent.toLowerCase() || "";
    const descricao = linha.querySelector("td:nth-child(3)")?.textContent.toLowerCase() || "";
    const qtd       = parseInt(linha.querySelector("td:nth-child(4)")?.textContent.replace(/\D/g, "")) || 0;
    const limite    = parseInt(linha.getAttribute("data-limite")) || 5;

    let atendeStatus = false;
    if (currentStatusFilter === "todos")  atendeStatus = true;
    if (currentStatusFilter === "baixo")  atendeStatus = qtd > 0 && qtd <= limite;
    if (currentStatusFilter === "zerado") atendeStatus = qtd <= 0;

    const atendeBusca = nome.includes(termoBusca) || descricao.includes(termoBusca);
    linha.style.display = atendeStatus && atendeBusca ? "" : "none";
  });
}

document.getElementById("searchInput").addEventListener("input", applyAllFilters);

document.querySelectorAll(".filter-btn").forEach((btn) => {
  btn.addEventListener("click", function () {
    // Reset todos os botões
    document.querySelectorAll(".filter-btn").forEach((b) => {
      const filter = b.getAttribute("data-filter");
      if (filter === "todos")  { b.className = "btn btn-sm rounded-pill px-3 fw-medium btn-outline-dark filter-btn"; }
      if (filter === "baixo")  { b.className = "btn btn-sm rounded-pill px-3 fw-medium btn-outline-warning filter-btn"; }
      if (filter === "zerado") { b.className = "btn btn-sm rounded-pill px-3 fw-medium btn-outline-danger filter-btn"; }
    });

    // Ativa o clicado
    const filter = this.getAttribute("data-filter");
    if (filter === "todos")  this.className = "btn btn-sm rounded-pill px-3 fw-medium btn-dark filter-btn";
    if (filter === "baixo")  this.className = "btn btn-sm rounded-pill px-3 fw-medium btn-warning filter-btn";
    if (filter === "zerado") this.className = "btn btn-sm rounded-pill px-3 fw-medium btn-danger filter-btn";

    currentStatusFilter = filter;
    applyAllFilters();
  });
});

// ==========================================
// 9. GRÁFICO (CHART.JS) — FASE 3
// ==========================================

function renderChart(products) {
  const ctx = document.getElementById("patrimonioChart").getContext("2d");
  if (myChart) myChart.destroy();

  // Top 10 por valor em estoque
  const sorted = [...products]
    .sort((a, b) => b.quantidade_atual * b.preco_unitario - a.quantidade_atual * a.preco_unitario)
    .slice(0, 10);

  const labels = sorted.map((p) => (p.nome.length > 16 ? p.nome.substring(0, 16) + "…" : p.nome));
  const data   = sorted.map((p) => (p.quantidade_atual * p.preco_unitario).toFixed(2));
  const colors = sorted.map((p) => {
    if (p.quantidade_atual <= 0)                          return "#ef4444"; // zerado
    if (p.quantidade_atual <= (p.limite_minimo || 5))     return "#f59e0b"; // alerta
    return "#10b981";                                                        // normal
  });

  myChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label:            "Valor em Estoque (R$)",
        data,
        backgroundColor: colors,
        borderRadius:    8,
        borderSkipped:   false,
        maxBarThickness: 48,
      }],
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: "#f1f5f9" },
          ticks: { callback: (v) => "R$ " + Number(v).toLocaleString("pt-BR") },
        },
        x: { grid: { display: false } },
      },
    },
  });
}

// ==========================================
// 10. EXPORTAÇÃO EXCEL — FASE 3
// ==========================================

async function exportToExcel() {
  try {
    const response = await fetch("/api/produtos");
    const products = await response.json();

    const dataParaExcel = products.map((p) => ({
      "ID":                p.id,
      "Produto":           p.nome,
      "Descrição":         p.descricao || "Sem descrição",
      "Qtd. em Estoque":   p.quantidade_atual,
      "Alerta Mínimo":     p.limite_minimo || 5,
      "Status":            p.quantidade_atual <= 0 ? "Zerado" : p.quantidade_atual <= (p.limite_minimo || 5) ? "Estoque Baixo" : "Normal",
      "Preço Unit. (R$)":  Number(p.preco_unitario),
      "Valor Total (R$)":  Number(p.quantidade_atual * p.preco_unitario),
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataParaExcel);
    const workbook  = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Relatório de Estoque");

    const dataHoje = new Date().toLocaleDateString("pt-BR").replace(/\//g, "-");
    XLSX.writeFile(workbook, `EstoquePro_${dataHoje}.xlsx`);
    showToast("Relatório exportado com sucesso!");
  } catch {
    showToast("Erro ao exportar relatório.", "danger");
  }
}

// ==========================================
// 11. HISTÓRICO DE MOVIMENTAÇÕES — FASE 3
//     (rota GET /api/movimentacoes era inexistente; agora existe no backend)
// ==========================================

async function loadHistory() {
  const tbody = document.getElementById("table-historico");
  tbody.innerHTML = `
    <tr>
      <td colspan="6" class="text-center py-4">
        <div class="spinner-border spinner-border-sm text-success me-2" role="status"></div>
        Carregando histórico…
      </td>
    </tr>`;

  try {
    const response = await fetch("/api/movimentacoes");
    const history  = await response.json();

    if (!Array.isArray(history) || history.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center text-muted py-5">
            <i class="bi bi-clock-history display-6 d-block mb-2 opacity-50"></i>
            Nenhuma movimentação registrada ainda.
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = history
      .map((h) => {
        const data      = new Date(h.data_movimentacao).toLocaleString("pt-BR");
        const tipoBadge = h.tipo === "entrada"
          ? `<span class="badge badge-stock-ok rounded-pill px-3"><i class="bi bi-arrow-down-circle me-1"></i>Entrada</span>`
          : `<span class="badge badge-stock-empty rounded-pill px-3"><i class="bi bi-arrow-up-circle me-1"></i>Saída</span>`;

        return `
          <tr>
            <td class="ps-4 text-secondary">#${h.id}</td>
            <td class="small text-secondary">${data}</td>
            <td class="fw-bold">${h.produto_nome || '<span class="fst-italic text-muted">Produto removido</span>'}</td>
            <td>${tipoBadge}</td>
            <td class="fw-bold">${h.quantidade} un.</td>
            <td class="text-secondary">${h.usuario_nome || '<span class="fst-italic">Sistema</span>'}</td>
          </tr>`;
      })
      .join("");
  } catch {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center text-danger py-4">
          <i class="bi bi-exclamation-circle me-1"></i>Erro ao carregar histórico.
        </td>
      </tr>`;
  }
}

// ==========================================
// 12. GESTÃO DE USUÁRIOS
// ==========================================

async function loadUsers() {
  try {
    const response = await fetch("/api/usuarios");
    const users    = await response.json();
    const tbody    = document.getElementById("table-usuarios");
    const loggedUser = JSON.parse(localStorage.getItem("usuarioLogado"));

    if (users.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-5">Nenhum usuário encontrado.</td></tr>`;
      return;
    }

    tbody.innerHTML = users
      .map(
        (u) => {
          const isMe = loggedUser && u.id === loggedUser.id;
          return `
          <tr>
            <td class="ps-4 text-secondary">#${u.id}</td>
            <td class="fw-bold">
              ${u.nome}
              ${isMe ? '<span class="badge bg-success ms-2 rounded-pill" style="font-size:10px;">Você</span>' : ""}
            </td>
            <td class="text-secondary">${u.email}</td>
            <td>
              <span class="badge ${u.role === "admin" ? "bg-dark" : "bg-secondary"} rounded-pill px-3">
                ${u.role === "admin" ? "👑 Admin" : "👤 Operador"}
              </span>
            </td>
            <td class="text-end pe-4 d-flex justify-content-end gap-2">
              <button class="btn btn-sm btn-outline-success border-0 rounded-pill px-3"
                      onclick="prepareEditUser(${u.id})" title="Editar usuário">
                <i class="bi bi-pencil me-1"></i>Editar
              </button>
              ${
                u.role !== "admin"
                  ? `<button class="btn btn-sm btn-outline-danger border-0 rounded-pill px-3"
                             onclick="deleteUser(${u.id})" title="Excluir usuário">
                       <i class="bi bi-trash me-1"></i>Excluir
                     </button>`
                  : '<span class="text-muted small align-self-center"><i class="bi bi-shield-check me-1"></i>Protegido</span>'
              }
            </td>
          </tr>`;
        }
      )
      .join("");
  } catch {
    showToast("Erro ao carregar usuários.", "danger");
  }
}

// Abre o modal de edição preenchido com os dados atuais do usuário
async function prepareEditUser(id) {
  try {
    const response = await fetch(`/api/usuarios/${id}`);
    if (!response.ok) throw new Error();
    const user = await response.json();

    const loggedUser = JSON.parse(localStorage.getItem("usuarioLogado"));
    const isMe       = loggedUser && user.id === loggedUser.id;

    // Preenche o formulário
    document.getElementById("edit-user-id").value    = user.id;
    document.getElementById("edit-user-nome").value  = user.nome;
    document.getElementById("edit-user-email").value = user.email;
    document.getElementById("edit-user-senha").value = "";
    document.getElementById("edit-user-role").value  = user.role;

    // Restaura visibilidade da senha
    const senhaInput = document.getElementById("edit-user-senha");
    senhaInput.type  = "password";
    document.getElementById("toggleEditSenhaIcon").className = "bi bi-eye";

    // Badge identificando quem está sendo editado
    const badge = document.getElementById("editUserBadge");
    if (isMe) {
      badge.innerHTML = `<i class="bi bi-person-circle text-success fs-5"></i>
        Você está editando o seu <strong>próprio perfil</strong>.`;
      badge.className = "alert alert-success border rounded-3 py-2 px-3 mb-4 d-flex align-items-center gap-2 small fw-medium";
    } else {
      badge.innerHTML = `<i class="bi bi-person text-secondary fs-5"></i>
        Editando: <strong>${user.nome}</strong>`;
      badge.className = "alert alert-light border rounded-3 py-2 px-3 mb-4 d-flex align-items-center gap-2 small fw-medium";
    }

    // Aviso ao alterar o próprio nível de acesso
    const roleWarning = document.getElementById("edit-role-warning");
    const roleSelect  = document.getElementById("edit-user-role");

    roleWarning.classList.toggle("d-none", !isMe);
    roleSelect.addEventListener("change", () => {
      if (isMe) roleWarning.classList.remove("d-none");
    });

    editUserModal.show();
  } catch {
    showToast("Erro ao carregar dados do usuário.", "danger");
  }
}

document.getElementById("editarUsuarioForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn  = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;

  const id    = document.getElementById("edit-user-id").value;
  const nome  = document.getElementById("edit-user-nome").value;
  const email = document.getElementById("edit-user-email").value;
  const senha = document.getElementById("edit-user-senha").value;
  const role  = document.getElementById("edit-user-role").value;

  try {
    const response = await fetch(`/api/usuarios/${id}`, {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ nome, email, senha, role }),
    });
    const result = await response.json();

    if (response.ok) {
      editUserModal.hide();

      // Se o admin editou o próprio perfil, atualiza o localStorage e a sidebar
      const loggedUser = JSON.parse(localStorage.getItem("usuarioLogado"));
      if (loggedUser && loggedUser.id === parseInt(id)) {
        const updated = { ...loggedUser, nome, email, role };
        localStorage.setItem("usuarioLogado", JSON.stringify(updated));
        initApp(); // Atualiza sidebar com novo nome/role
      }

      loadUsers();
      showToast("Usuário atualizado com sucesso!");
    } else {
      showToast(result.erro || "Erro ao atualizar usuário.", "danger");
    }
  } catch {
    showToast("Erro de comunicação com o servidor.", "danger");
  } finally {
    btn.disabled = false;
  }
});

document.getElementById("usuarioForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;

  const novoUsuario = {
    nome:  document.getElementById("user-nome").value,
    email: document.getElementById("user-email").value,
    senha: document.getElementById("user-senha").value,
    role:  document.getElementById("user-role").value,
  };

  try {
    const response = await fetch("/api/usuarios", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(novoUsuario),
    });
    const result = await response.json();

    if (response.ok) {
      userModal.hide();
      document.getElementById("usuarioForm").reset();
      loadUsers();
      showToast("Usuário cadastrado com sucesso!");
    } else {
      showToast(result.erro || "Erro ao criar usuário.", "danger");
    }
  } catch {
    showToast("Erro de comunicação com o servidor.", "danger");
  } finally {
    btn.disabled = false;
  }
});

async function deleteUser(id) {
  if (confirm("Tem certeza que deseja excluir este usuário?")) {
    try {
      const response = await fetch(`/api/usuarios/${id}`, { method: "DELETE" });
      if (response.ok) {
        loadUsers();
        showToast("Usuário excluído com sucesso.");
      } else {
        const err = await response.json();
        showToast(err.erro || "Erro ao excluir usuário.", "danger");
      }
    } catch {
      showToast("Erro de comunicação com o servidor.", "danger");
    }
  }
}
