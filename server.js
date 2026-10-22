const http = require('http');
const { Server } = require('socket.io');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

dotenv.config();

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: true },
  maxHttpBufferSize: 1e6
});

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'tojael_daniel_dev_chave_secreta_super_segura_2026_iptv';
const ADMIN_KEY = process.env.ADMIN_KEY || 'minha_chave_admin_123';

const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// Garantir que a pasta de dados existe localmente
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify({ users: [] }, null, 2));

app.use(cors());
app.use(express.json({ limit: '10kb' }));
app.use(express.static(__dirname));

// --- FUNÇÕES DE BANCO DE DADOS LOCAL (JSON) ---
function carregarUsuarios() {
  try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); }
  catch { return { users: [] }; }
}

function salvarUsuarios(data) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2));
}

function duracaoParaMs(valor) {
  const m = String(valor).trim().toLowerCase().match(/^(\d+)(m|h|d)$/);
  if (!m) return null;
  const num = Number(m[1]);
  if (num <= 0) return null;
  if (m[2] === 'm') return num * 60 * 1000;
  if (m[2] === 'h') return num * 60 * 60 * 1000;
  if (m[2] === 'd') return num * 24 * 60 * 60 * 1000;
  return null;
}

// --- ROTAS DA API ---

// 1. Rota de Status
app.get('/api/status', (req, res) => {
  res.json({ ok: true, service: 'TOJAEL IPTV', status: 'online' });
});

// 2. Rota de Criação de Teste/Usuário (USADA PELOS BOTS DO TELEGRAM E WHATSAPP)
app.post('/api/admin/create-user', async (req, res) => {
  try {
    const { adminKey, duration = '15m' } = req.body;

    if (adminKey !== ADMIN_KEY) {
      return res.status(403).json({ ok: false, error: 'Não autorizado. Chave incorreta.' });
    }

    const duracaoMs = duracaoParaMs(duration);
    if (!duracaoMs) {
      return res.status(400).json({ ok: false, error: 'Duração inválida. Use ex: 15m, 1h, 1d, 30d, 365d.' });
    }

    const db = carregarUsuarios();
    
    let username;
    do {
      username = 'TOJAEL-' + crypto.randomBytes(3).toString('hex').toUpperCase();
    } while (db.users.some(u => u.username === username));

    const password = crypto.randomBytes(3).toString('hex').toUpperCase();
    const agora = new Date();
    const expiracao = new Date(agora.getTime() + duracaoMs);

    const passwordHash = await bcrypt.hash(password, 10);

    const newUser = {
      id: crypto.randomUUID(),
      username,
      passwordHash,
      status: 'ativo',
      createdAt: agora.toISOString(),
      expiresAt: expiracao.toISOString(),
      lastLogin: null
    };

    db.users.push(newUser);
    salvarUsuarios(db);

    console.log(`⚡ [TOJAEL IPTV] Novo utilizador criado pelo Bot: ${username} (Validade: ${duration})`);

    res.json({
      ok: true,
      user: {
        username,
        password,
        duration,
        createdAt: newUser.createdAt,
        expiresAt: newUser.expiresAt
      }
    });

  } catch (err) {
    console.error('Erro ao criar usuário:', err);
    res.status(500).json({ ok: false, error: 'Erro interno no servidor.' });
  }
});

// Serve o index.html para qualquer outra rota visual
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Inicia o Servidor
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('⚡ TOJAEL IPTV - SERVIDOR ONLINE');
  console.log(`🌐 Servidor rodando na porta ${PORT}`);
  console.log(`🔗 http://localhost:${PORT}`);
  console.log('');
});
