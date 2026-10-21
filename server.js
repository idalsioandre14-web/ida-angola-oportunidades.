const express = require("express");
const session = require("express-session");
const PgSession = require("connect-pg-simple")(session);
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");

const app = express();
const port = process.env.PORT || 3000;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes("render.com")
    ? { rejectUnauthorized: false } : undefined
});

app.set("trust proxy", process.env.TRUST_PROXY === "1" ? 1 : false);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.urlencoded({ extended: false, limit: "20kb" }));
app.use(express.json({ limit: "20kb" }));
app.use(session({
  store: new PgSession({ pool, tableName: "user_sessions", createTableIfMissing: true }),
  secret: process.env.SESSION_SECRET || "development-only-change-me",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 8 * 60 * 60 * 1000 }
}));

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: true, legacyHeaders: false });
const esc = (v) => String(v || "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
const creatorOnly = (req, res, next) => req.session && req.session.creator ? next() : res.redirect("/criador/entrar");
const page = (title, body) => `<!doctype html><html lang="pt"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} | IDA Angola Oportunidades</title><link rel="stylesheet" href="/style.css"></head><body><header><a href="/" class="brand">IDA <span>Angola Oportunidades</span></a><nav><a href="/">Vagas</a><a href="/publicar">Publicar vaga grátis</a><a href="/criador/entrar">Criador</a></nav></header><main>${body}</main><footer>IDA Angola Oportunidades · Consulte sempre o anúncio original antes de se candidatar.</footer></body></html>`;

async function initDb() {
  await pool.query(`CREATE TABLE IF NOT EXISTS jobs (
    id SERIAL PRIMARY KEY, title TEXT NOT NULL, company TEXT NOT NULL, location TEXT NOT NULL,
    summary TEXT NOT NULL, source TEXT NOT NULL DEFAULT 'IDA Angola Oportunidades',
    original_url TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
}
app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("/", async (_req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM jobs WHERE status='approved' ORDER BY created_at DESC LIMIT 100");
    const cards = rows.map(j => `<article class="job"><small>${esc(j.source)} · ${new Date(j.created_at).toLocaleDateString("pt-PT")}</small><h2>${esc(j.title)}</h2><p><b>${esc(j.company)}</b> · ${esc(j.location)}</p><p>${esc(j.summary)}</p><a class="button" href="${esc(j.original_url)}" target="_blank" rel="noopener noreferrer">Ver anúncio original ↗</a></article>`).join("");
    res.send(page("Vagas de emprego", `<section class="hero"><p class="eyebrow">OPORTUNIDADES EM ANGOLA</p><h1>Encontra a tua próxima oportunidade.</h1><p>Vagas gratuitas, resumos claros e acesso ao anúncio original.</p><a class="button" href="/publicar">Publicar vaga grátis</a></section><h2>Vagas disponíveis</h2><div class="jobs">${cards || "<p>Ainda não há vagas publicadas. Volta em breve!</p>"}</div>`));
  } catch(e) { next(e); }
});
app.get("/publicar", (_req,res) => res.send(page("Publicar vaga", `<h1>Publicar vaga grátis</h1><p>As vagas são revistas pelo criador antes de aparecerem publicamente.</p><form method="post" action="/publicar"><label>Nome da vaga<input name="title" required maxlength="150"></label><label>Empresa<input name="company" required maxlength="150"></label><label>Localização<input name="location" required maxlength="150"></label><label>Resumo da vaga<textarea name="summary" required maxlength="2000"></textarea></label><label>Link do anúncio original<input name="original_url" type="url" required placeholder="https://..." maxlength="1000"></label><label>Fonte (empresa ou site)<input name="source" required maxlength="150"></label><button>Enviar para aprovação</button></form>`)));
app.post("/publicar", async (req,res,next) => {
  try {
    const { title, company, location, summary, original_url, source } = req.body;
    let url;
    try { url = new URL(original_url); } catch { return res.status(400).send(page("Erro", "<h1>Link inválido</h1><p>Indica um endereço web válido.</p><a href='/publicar'>Voltar</a>")); }
    if (!["https:", "http:"].includes(url.protocol)) return res.status(400).send("Link inválido");
    await pool.query("INSERT INTO jobs(title,company,location,summary,source,original_url,status) VALUES($1,$2,$3,$4,$5,$6,'pending')",
      [String(title||"").trim(),String(company||"").trim(),String(location||"").trim(),String(summary||"").trim(),String(source||"").trim(),url.toString()]);
    res.send(page("Enviado", "<h1>Vaga enviada!</h1><p>Obrigado. O anúncio ficará visível depois da revisão do criador.</p><a class='button' href='/'>Voltar às vagas</a>"));
  } catch(e) { next(e); }
});
app.get("/criador/entrar", (req,res) => res.send(page("Área do criador", `<h1>Área privada do criador</h1><p>Entrada reservada ao responsável pelo site.</p><form method="post" action="/criador/entrar"><label>E-mail<input name="email" type="email" autocomplete="username" required></label><label>Palavra-passe<input name="password" type="password" autocomplete="current-password" required></label><button>Entrar</button></form>`)));
app.post("/criador/entrar", loginLimiter, async (req,res) => {
  const email = (process.env.CREATOR_EMAIL || "").trim().toLowerCase();
  const hash = process.env.CREATOR_PASSWORD_HASH || "";
  const valid = email && hash && String(req.body.email||"").trim().toLowerCase() === email && await bcrypt.compare(String(req.body.password||""), hash).catch(()=>false);
  if (!valid) return res.status(401).send(page("Entrada recusada", "<h1>Não foi possível entrar</h1><p>Verifica os dados ou a configuração do servidor.</p><a href='/criador/entrar'>Tentar novamente</a>"));
  req.session.regenerate(err => { if(err) return res.status(500).send("Erro de sessão"); req.session.creator = true; res.redirect("/criador"); });
});
app.get("/criador", creatorOnly, async (_req,res,next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM jobs ORDER BY created_at DESC LIMIT 200");
    const list = rows.map(j => `<article class="job"><h2>${esc(j.title)}</h2><p>${esc(j.company)} · ${esc(j.location)} · Estado: <b>${esc(j.status)}</b></p><p>${esc(j.summary)}</p><div class="actions"><form method="post" action="/criador/jobs/${j.id}/approve"><button>Aprovar</button></form><form method="post" action="/criador/jobs/${j.id}/reject"><button class="secondary">Rejeitar</button></form><form method="post" action="/criador/jobs/${j.id}/delete" onsubmit="return confirm('Apagar esta vaga?')"><button class="danger">Apagar</button></form></div></article>`).join("");
    res.send(page("Painel do criador", `<div class="split"><h1>Painel do criador</h1><form method="post" action="/criador/sair"><button class="secondary">Sair</button></form></div><p>Aprova apenas anúncios legítimos e confirma os links antes de publicar.</p>${list || "<p>Não há vagas registadas.</p>"}`));
  } catch(e) { next(e); }
});
app.post("/criador/jobs/:id/approve", creatorOnly, async (req,res,next) => { try { await pool.query("UPDATE jobs SET status='approved' WHERE id=$1",[req.params.id]); res.redirect("/criador"); } catch(e){next(e);} });
app.post("/criador/jobs/:id/reject", creatorOnly, async (req,res,next) => { try { await pool.query("UPDATE jobs SET status='rejected' WHERE id=$1",[req.params.id]); res.redirect("/criador"); } catch(e){next(e);} });
app.post("/criador/jobs/:id/delete", creatorOnly, async (req,res,next) => { try { await pool.query("DELETE FROM jobs WHERE id=$1",[req.params.id]); res.redirect("/criador"); } catch(e){next(e);} });
app.post("/criador/sair", creatorOnly, (req,res) => req.session.destroy(()=>res.redirect("/")));
app.use(express.static(path.join(__dirname,"public")));
app.use((err,_req,res,_next) => { console.error(err); res.status(500).send(page("Erro", "<h1>Ocorreu um erro</h1><p>Tenta novamente mais tarde.</p>")); });
initDb().then(() => app.listen(port, () => console.log(`IDA Oportunidades a correr na porta ${port}`))).catch(err => { console.error("Falha ao iniciar a base de dados:", err); process.exit(1); });