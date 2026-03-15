const express = require('express');
const sqlite3 = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const ADMIN_CODE = 'lfzyyszsdng5255';

// 信任代理（解决 express-rate-limit 警告）
app.set('trust proxy', 1);

// Gzip 压缩
app.use(compression({
    filter: (req, res) => {
        if (req.headers['x-no-compression']) return false;
        return compression.filter(req, res);
    },
    threshold: 1024 // 大于 1KB 才压缩
}));

// 中间件
// CORS 配置（混合部署：允许前端域名跨域）
app.use(cors({
    origin: [
        'http://localhost:3000',
        'https://choril.icu',
        'https://www.choril.icu'
    ],
    credentials: true
}));
app.use(express.json());

// 静态资源 + 缓存控制
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: '7d', // 静态资源缓存 7 天
    etag: true,
    lastModified: true
}));

// 速率限制
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
});
app.use('/api/', limiter);

// 访问统计中间件（排除静态资源、API、favicon）
app.use((req, res, next) => {
    const excludePatterns = ['/api', '/favicon', '.js', '.css', '.png', '.jpg', '.ico', '.svg', '.woff', '.woff2', '.webp'];
    const shouldExclude = excludePatterns.some(pattern => req.path.includes(pattern));
    if (!shouldExclude) {
        try {
            const ip = req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress || 'unknown';
            db.prepare('INSERT INTO visits (ip, path, user_agent) VALUES (?, ?, ?)').run(
                String(ip).split(',')[0].trim(),
                req.path,
                req.get('user-agent') || ''
            );
        } catch (err) {
            // 忽略错误
        }
    }
    next();
});

// 数据库
const db = sqlite3(path.join(__dirname, 'data.db'));

// 初始化数据库
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

db.exec(`
    CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        username TEXT,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )
`);

db.exec(`
    CREATE TABLE IF NOT EXISTS visits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ip TEXT,
        path TEXT,
        user_agent TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

db.exec(`
    CREATE TABLE IF NOT EXISTS profile (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        name TEXT DEFAULT 'Choril',
        title TEXT DEFAULT '全栈开发工程师',
        bio TEXT DEFAULT '热爱编程，专注于Web开发和人工智能技术。',
        avatar TEXT DEFAULT '',
        email TEXT DEFAULT 'admin@choril.icu',
        phone TEXT DEFAULT '',
        location TEXT DEFAULT '中国',
        website TEXT DEFAULT '',
        github TEXT DEFAULT '',
        linkedin TEXT DEFAULT '',
        twitter TEXT DEFAULT '',
        wechat TEXT DEFAULT '',
        qq TEXT DEFAULT '',
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

db.exec(`
    CREATE TABLE IF NOT EXISTS skills (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        level INTEGER DEFAULT 80,
        category TEXT DEFAULT '技术',
        icon TEXT DEFAULT '',
        description TEXT DEFAULT '',
        display_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

db.exec(`
    CREATE TABLE IF NOT EXISTS education (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        school TEXT NOT NULL,
        degree TEXT DEFAULT '',
        major TEXT DEFAULT '',
        start_date TEXT DEFAULT '',
        end_date TEXT DEFAULT '',
        description TEXT DEFAULT '',
        display_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

db.exec(`
    CREATE TABLE IF NOT EXISTS experience (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company TEXT NOT NULL,
        position TEXT DEFAULT '',
        start_date TEXT DEFAULT '',
        end_date TEXT DEFAULT '',
        description TEXT DEFAULT '',
        technologies TEXT DEFAULT '',
        display_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        image TEXT DEFAULT '',
        link TEXT DEFAULT '',
        github TEXT DEFAULT '',
        technologies TEXT DEFAULT '',
        display_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

db.exec(`
    CREATE TABLE IF NOT EXISTS edit_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_name TEXT NOT NULL,
        record_id INTEGER,
        action TEXT NOT NULL,
        old_data TEXT,
        new_data TEXT,
        admin_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

const profileExists = db.prepare('SELECT id FROM profile').get();
if (!profileExists) {
    db.prepare(`INSERT INTO profile (id, name, title, bio, email, location, website, github) VALUES (1, ?, ?, ?, ?, ?, ?, ?)`).run(
        'Choril',
        '全栈开发工程师 | AI探索者',
        '热爱编程，专注于Web开发和人工智能技术。在代码的世界里构建未来，用技术改变生活。',
        'admin@choril.icu',
        '中国',
        'https://choril.icu',
        'https://github.com/choril'
    );
}

const skillsCount = db.prepare('SELECT COUNT(*) as count FROM skills').get();
if (skillsCount.count === 0) {
    const defaultSkills = [
        { name: 'JavaScript', level: 95, category: '前端开发', icon: 'fab fa-js', description: '精通ES6+特性、异步编程、模块化开发' },
        { name: 'React', level: 90, category: '前端开发', icon: 'fab fa-react', description: '熟练使用React Hooks、Redux状态管理' },
        { name: 'Vue.js', level: 88, category: '前端开发', icon: 'fab fa-vuejs', description: '掌握Vue3 Composition API、Vuex' },
        { name: 'Node.js', level: 88, category: '后端开发', icon: 'fab fa-node-js', description: '熟练使用Express、Koa框架' },
        { name: 'Python', level: 85, category: '后端开发', icon: 'fab fa-python', description: '熟悉Django、Flask框架及数据处理' },
        { name: 'TypeScript', level: 85, category: '前端开发', icon: 'fas fa-code', description: '熟练使用类型系统、泛型编程' },
        { name: 'MySQL', level: 80, category: '数据库', icon: 'fas fa-database', description: '熟悉SQL优化、索引设计' },
        { name: 'MongoDB', level: 78, category: '数据库', icon: 'fas fa-database', description: '掌握文档数据库设计与聚合查询' },
        { name: 'Docker', level: 75, category: '运维部署', icon: 'fab fa-docker', description: '熟悉容器化部署、Docker Compose' },
        { name: 'Git', level: 92, category: '工具', icon: 'fab fa-git-alt', description: '熟练使用Git工作流、分支管理' }
    ];
    defaultSkills.forEach((skill, index) => {
        db.prepare('INSERT INTO skills (name, level, category, icon, description, display_order) VALUES (?, ?, ?, ?, ?, ?)').run(
            skill.name, skill.level, skill.category, skill.icon, skill.description, index
        );
    });
}

const educationCount = db.prepare('SELECT COUNT(*) as count FROM education').get();
if (educationCount.count === 0) {
    const defaultEducation = [
        {
            school: '北京大学',
            degree: '本科',
            major: '计算机科学与技术',
            start_date: '2018-09',
            end_date: '2022-06',
            description: '主修课程：数据结构、算法设计、操作系统、计算机网络、数据库原理等。获得校级优秀学生奖学金。'
        }
    ];
    defaultEducation.forEach((edu, index) => {
        db.prepare('INSERT INTO education (school, degree, major, start_date, end_date, description, display_order) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
            edu.school, edu.degree, edu.major, edu.start_date, edu.end_date, edu.description, index
        );
    });
}

const experienceCount = db.prepare('SELECT COUNT(*) as count FROM experience').get();
if (experienceCount.count === 0) {
    const defaultExperience = [
        {
            company: '阿里巴巴',
            position: '前端开发工程师',
            start_date: '2022-07',
            end_date: '至今',
            description: '负责公司核心产品的前端开发工作，参与技术选型和架构设计。',
            technologies: 'React,TypeScript,Redux,Ant Design'
        }
    ];
    defaultExperience.forEach((exp, index) => {
        db.prepare('INSERT INTO experience (company, position, start_date, end_date, description, technologies, display_order) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
            exp.company, exp.position, exp.start_date, exp.end_date, exp.description, exp.technologies, index
        );
    });
}

const projectsCount = db.prepare('SELECT COUNT(*) as count FROM projects').get();
if (projectsCount.count === 0) {
    const defaultProjects = [
        {
            title: '个人主页系统',
            description: '采用现代Web技术栈开发的个人主页系统，支持后台管理、数据可视化等功能。',
            image: '',
            link: 'https://choril.icu',
            github: 'https://github.com/choril/homepage',
            technologies: 'React,Node.js,MongoDB,Chart.js'
        },
        {
            title: 'AI智能助手',
            description: '集成多种AI能力的智能助手平台，支持自然语言处理、图像识别等功能。',
            image: '',
            link: '',
            github: 'https://github.com/choril/ai-assistant',
            technologies: 'Python,PyTorch,FastAPI,React'
        }
    ];
    defaultProjects.forEach((proj, index) => {
        db.prepare('INSERT INTO projects (title, description, image, link, github, technologies, display_order) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
            proj.title, proj.description, proj.image, proj.link, proj.github, proj.technologies, index
        );
    });
}

// 创建默认管理员
const adminExists = db.prepare('SELECT id FROM users WHERE role = ?').get('admin');
if (!adminExists) {
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)').run(
        'admin',
        'admin@choril.icu',
        hashedPassword,
        'admin'
    );
    console.log('✅ 默认管理员账户已创建');
}

// JWT 验证中间件
function authMiddleware(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: '请先登录' });
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ error: 'Token 无效' });
    }
}

// 管理员验证中间件
function adminMiddleware(req, res, next) {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: '需要管理员权限' });
    }
    next();
}

// ============ 用户 API ============

// 注册
app.post('/api/register', (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ error: '请填写所有字段' });
    }

    if (password.length < 6) {
        return res.status(400).json({ error: '密码至少6位' });
    }

    try {
        const existingUser = db.prepare('SELECT id FROM users WHERE email = ? OR username = ?').get(email, username);
        if (existingUser) {
            return res.status(400).json({ error: '用户名或邮箱已存在' });
        }

        const hashedPassword = bcrypt.hashSync(password, 10);
        const result = db.prepare('INSERT INTO users (username, email, password) VALUES (?, ?, ?)').run(username, email, hashedPassword);

        res.status(201).json({ message: '注册成功', userId: result.lastInsertRowid });
    } catch (err) {
        console.error('注册错误:', err);
        res.status(500).json({ error: '注册失败' });
    }
});

// 登录
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: '请填写所有字段' });
    }

    try {
        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
        if (!user) {
            return res.status(401).json({ error: '邮箱或密码错误' });
        }

        const isValid = bcrypt.compareSync(password, user.password);
        if (!isValid) {
            return res.status(401).json({ error: '邮箱或密码错误' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role
            }
        });
    } catch (err) {
        console.error('登录错误:', err);
        res.status(500).json({ error: '登录失败' });
    }
});

// ============ 评论 API ============

// 获取所有评论
app.get('/api/comments', (req, res) => {
    try {
        const comments = db.prepare(`
            SELECT c.*, u.username 
            FROM comments c 
            LEFT JOIN users u ON c.user_id = u.id 
            ORDER BY c.created_at DESC
        `).all();
        res.json(comments);
    } catch (err) {
        console.error('获取评论错误:', err);
        res.status(500).json({ error: '获取评论失败' });
    }
});

// 发表评论
app.post('/api/comments', authMiddleware, (req, res) => {
    const { content } = req.body;

    if (!content || content.trim() === '') {
        return res.status(400).json({ error: '评论内容不能为空' });
    }

    try {
        const result = db.prepare('INSERT INTO comments (user_id, username, content) VALUES (?, ?, ?)').run(
            req.user.id,
            req.user.username,
            content.trim()
        );

        const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(result.lastInsertRowid);
        res.status(201).json(comment);
    } catch (err) {
        console.error('发表评论错误:', err);
        res.status(500).json({ error: '发表评论失败' });
    }
});

// 删除自己的评论
app.delete('/api/comments/:id', authMiddleware, (req, res) => {
    const commentId = req.params.id;

    try {
        const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(commentId);
        
        if (!comment) {
            return res.status(404).json({ error: '评论不存在' });
        }

        if (comment.user_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: '无权删除此评论' });
        }

        db.prepare('DELETE FROM comments WHERE id = ?').run(commentId);
        res.json({ message: '评论已删除' });
    } catch (err) {
        console.error('删除评论错误:', err);
        res.status(500).json({ error: '删除评论失败' });
    }
});

// ============ 管理员 API ============

// 管理员登录
app.post('/api/admin/login', (req, res) => {
    const { username, password, code } = req.body;

    if (!username || !password || !code) {
        return res.status(400).json({ error: '请填写所有字段' });
    }

    if (code !== ADMIN_CODE) {
        return res.status(401).json({ error: '验证码错误' });
    }

    try {
        const user = db.prepare('SELECT * FROM users WHERE username = ? AND role = ?').get(username, 'admin');
        if (!user) {
            return res.status(401).json({ error: '管理员账号不存在' });
        }

        const isValid = bcrypt.compareSync(password, user.password);
        if (!isValid) {
            return res.status(401).json({ error: '密码错误' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role
            }
        });
    } catch (err) {
        console.error('管理员登录错误:', err);
        res.status(500).json({ error: '登录失败' });
    }
});

// 获取所有用户（管理员）
app.get('/api/admin/users', authMiddleware, adminMiddleware, (req, res) => {
    try {
        const users = db.prepare('SELECT id, username, email, role, created_at FROM users ORDER BY created_at DESC').all();
        res.json(users);
    } catch (err) {
        console.error('获取用户列表错误:', err);
        res.status(500).json({ error: '获取用户列表失败' });
    }
});

// 删除用户（管理员）
app.delete('/api/admin/users/:id', authMiddleware, adminMiddleware, (req, res) => {
    const userId = req.params.id;

    try {
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
        
        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }

        if (user.role === 'admin') {
            return res.status(403).json({ error: '不能删除管理员' });
        }

        // 删除用户的所有评论
        db.prepare('DELETE FROM comments WHERE user_id = ?').run(userId);
        // 删除用户
        db.prepare('DELETE FROM users WHERE id = ?').run(userId);

        res.json({ message: '用户已删除' });
    } catch (err) {
        console.error('删除用户错误:', err);
        res.status(500).json({ error: '删除用户失败' });
    }
});

// 删除评论（管理员）
app.delete('/api/admin/comments/:id', authMiddleware, adminMiddleware, (req, res) => {
    const commentId = req.params.id;

    try {
        db.prepare('DELETE FROM comments WHERE id = ?').run(commentId);
        res.json({ message: '评论已删除' });
    } catch (err) {
        console.error('删除评论错误:', err);
        res.status(500).json({ error: '删除评论失败' });
    }
});

// 获取系统统计（管理员）
app.get('/api/admin/stats', authMiddleware, adminMiddleware, (req, res) => {
    try {
        const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
        const commentCount = db.prepare('SELECT COUNT(*) as count FROM comments').get().count;
        
        // 今日访问数（用 SQLite 的 date 函数比较）
        const todayVisits = db.prepare("SELECT COUNT(*) as count FROM visits WHERE date(created_at) = date('now')").get().count;

        res.json({
            users: userCount,
            comments: commentCount,
            visits: todayVisits
        });
    } catch (err) {
        console.error('获取统计错误:', err);
        res.status(500).json({ error: '获取统计失败' });
    }
});

// 获取今日访问记录（管理员）
app.get('/api/admin/visits', authMiddleware, adminMiddleware, (req, res) => {
    try {
        const visits = db.prepare("SELECT * FROM visits WHERE date(created_at) = date('now') ORDER BY created_at DESC").all();
        res.json(visits);
    } catch (err) {
        console.error('获取访问记录错误:', err);
        res.status(500).json({ error: '获取访问记录失败' });
    }
});

// ============ 个人主页编辑 API ============

function logEditHistory(tableName, recordId, action, oldData, newData, adminId) {
    try {
        db.prepare('INSERT INTO edit_history (table_name, record_id, action, old_data, new_data, admin_id) VALUES (?, ?, ?, ?, ?, ?)').run(
            tableName, recordId, action, 
            oldData ? JSON.stringify(oldData) : null, 
            newData ? JSON.stringify(newData) : null, 
            adminId
        );
    } catch (err) {
        console.error('记录编辑历史失败:', err);
    }
}

// 获取个人信息
app.get('/api/profile', (req, res) => {
    try {
        const profile = db.prepare('SELECT * FROM profile WHERE id = 1').get();
        res.json(profile || {});
    } catch (err) {
        console.error('获取个人信息错误:', err);
        res.status(500).json({ error: '获取个人信息失败' });
    }
});

// 更新个人信息
app.put('/api/admin/profile', authMiddleware, adminMiddleware, (req, res) => {
    try {
        const oldProfile = db.prepare('SELECT * FROM profile WHERE id = 1').get();
        const { name, title, bio, avatar, email, phone, location, website, github, linkedin, twitter, wechat, qq } = req.body;
        
        db.prepare(`UPDATE profile SET name = ?, title = ?, bio = ?, avatar = ?, email = ?, phone = ?, location = ?, website = ?, github = ?, linkedin = ?, twitter = ?, wechat = ?, qq = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1`).run(
            name, title, bio, avatar, email, phone, location, website, github, linkedin, twitter, wechat, qq
        );
        
        const newProfile = db.prepare('SELECT * FROM profile WHERE id = 1').get();
        logEditHistory('profile', 1, 'UPDATE', oldProfile, newProfile, req.user.id);
        
        res.json({ message: '更新成功', profile: newProfile });
    } catch (err) {
        console.error('更新个人信息错误:', err);
        res.status(500).json({ error: '更新失败' });
    }
});

// 获取技能列表
app.get('/api/skills', (req, res) => {
    try {
        const skills = db.prepare('SELECT * FROM skills ORDER BY display_order, id').all();
        res.json(skills);
    } catch (err) {
        console.error('获取技能列表错误:', err);
        res.status(500).json({ error: '获取技能列表失败' });
    }
});

// 添加技能
app.post('/api/admin/skills', authMiddleware, adminMiddleware, (req, res) => {
    try {
        const { name, level, category, icon, description } = req.body;
        const maxOrder = db.prepare('SELECT COALESCE(MAX(display_order), -1) as max FROM skills').get().max;
        
        const result = db.prepare('INSERT INTO skills (name, level, category, icon, description, display_order) VALUES (?, ?, ?, ?, ?, ?)').run(
            name, level || 80, category || '技术', icon || '', description || '', maxOrder + 1
        );
        
        const newSkill = db.prepare('SELECT * FROM skills WHERE id = ?').get(result.lastInsertRowid);
        logEditHistory('skills', result.lastInsertRowid, 'INSERT', null, newSkill, req.user.id);
        
        res.status(201).json(newSkill);
    } catch (err) {
        console.error('添加技能错误:', err);
        res.status(500).json({ error: '添加失败' });
    }
});

// 更新技能
app.put('/api/admin/skills/:id', authMiddleware, adminMiddleware, (req, res) => {
    try {
        const { id } = req.params;
        const oldSkill = db.prepare('SELECT * FROM skills WHERE id = ?').get(id);
        
        if (!oldSkill) {
            return res.status(404).json({ error: '技能不存在' });
        }
        
        const { name, level, category, icon, description } = req.body;
        db.prepare('UPDATE skills SET name = ?, level = ?, category = ?, icon = ?, description = ? WHERE id = ?').run(
            name, level, category, icon, description, id
        );
        
        const newSkill = db.prepare('SELECT * FROM skills WHERE id = ?').get(id);
        logEditHistory('skills', parseInt(id), 'UPDATE', oldSkill, newSkill, req.user.id);
        
        res.json(newSkill);
    } catch (err) {
        console.error('更新技能错误:', err);
        res.status(500).json({ error: '更新失败' });
    }
});

// 删除技能
app.delete('/api/admin/skills/:id', authMiddleware, adminMiddleware, (req, res) => {
    try {
        const { id } = req.params;
        const oldSkill = db.prepare('SELECT * FROM skills WHERE id = ?').get(id);
        
        if (!oldSkill) {
            return res.status(404).json({ error: '技能不存在' });
        }
        
        db.prepare('DELETE FROM skills WHERE id = ?').run(id);
        logEditHistory('skills', parseInt(id), 'DELETE', oldSkill, null, req.user.id);
        
        res.json({ message: '删除成功' });
    } catch (err) {
        console.error('删除技能错误:', err);
        res.status(500).json({ error: '删除失败' });
    }
});

// 技能排序
app.put('/api/admin/skills/reorder', authMiddleware, adminMiddleware, (req, res) => {
    try {
        const { orders } = req.body;
        orders.forEach(({ id, display_order }) => {
            db.prepare('UPDATE skills SET display_order = ? WHERE id = ?').run(display_order, id);
        });
        res.json({ message: '排序成功' });
    } catch (err) {
        console.error('技能排序错误:', err);
        res.status(500).json({ error: '排序失败' });
    }
});

// 获取教育背景
app.get('/api/education', (req, res) => {
    try {
        const education = db.prepare('SELECT * FROM education ORDER BY display_order, id DESC').all();
        res.json(education);
    } catch (err) {
        console.error('获取教育背景错误:', err);
        res.status(500).json({ error: '获取教育背景失败' });
    }
});

// 添加教育背景
app.post('/api/admin/education', authMiddleware, adminMiddleware, (req, res) => {
    try {
        const { school, degree, major, start_date, end_date, description } = req.body;
        const maxOrder = db.prepare('SELECT COALESCE(MAX(display_order), -1) as max FROM education').get().max;
        
        const result = db.prepare('INSERT INTO education (school, degree, major, start_date, end_date, description, display_order) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
            school, degree || '', major || '', start_date || '', end_date || '', description || '', maxOrder + 1
        );
        
        const newEdu = db.prepare('SELECT * FROM education WHERE id = ?').get(result.lastInsertRowid);
        logEditHistory('education', result.lastInsertRowid, 'INSERT', null, newEdu, req.user.id);
        
        res.status(201).json(newEdu);
    } catch (err) {
        console.error('添加教育背景错误:', err);
        res.status(500).json({ error: '添加失败' });
    }
});

// 更新教育背景
app.put('/api/admin/education/:id', authMiddleware, adminMiddleware, (req, res) => {
    try {
        const { id } = req.params;
        const oldEdu = db.prepare('SELECT * FROM education WHERE id = ?').get(id);
        
        if (!oldEdu) {
            return res.status(404).json({ error: '记录不存在' });
        }
        
        const { school, degree, major, start_date, end_date, description } = req.body;
        db.prepare('UPDATE education SET school = ?, degree = ?, major = ?, start_date = ?, end_date = ?, description = ? WHERE id = ?').run(
            school, degree, major, start_date, end_date, description, id
        );
        
        const newEdu = db.prepare('SELECT * FROM education WHERE id = ?').get(id);
        logEditHistory('education', parseInt(id), 'UPDATE', oldEdu, newEdu, req.user.id);
        
        res.json(newEdu);
    } catch (err) {
        console.error('更新教育背景错误:', err);
        res.status(500).json({ error: '更新失败' });
    }
});

// 删除教育背景
app.delete('/api/admin/education/:id', authMiddleware, adminMiddleware, (req, res) => {
    try {
        const { id } = req.params;
        const oldEdu = db.prepare('SELECT * FROM education WHERE id = ?').get(id);
        
        if (!oldEdu) {
            return res.status(404).json({ error: '记录不存在' });
        }
        
        db.prepare('DELETE FROM education WHERE id = ?').run(id);
        logEditHistory('education', parseInt(id), 'DELETE', oldEdu, null, req.user.id);
        
        res.json({ message: '删除成功' });
    } catch (err) {
        console.error('删除教育背景错误:', err);
        res.status(500).json({ error: '删除失败' });
    }
});

// 教育背景排序
app.put('/api/admin/education/reorder', authMiddleware, adminMiddleware, (req, res) => {
    try {
        const { orders } = req.body;
        orders.forEach(({ id, display_order }) => {
            db.prepare('UPDATE education SET display_order = ? WHERE id = ?').run(display_order, id);
        });
        res.json({ message: '排序成功' });
    } catch (err) {
        console.error('教育背景排序错误:', err);
        res.status(500).json({ error: '排序失败' });
    }
});

// 获取工作经历
app.get('/api/experience', (req, res) => {
    try {
        const experience = db.prepare('SELECT * FROM experience ORDER BY display_order, id DESC').all();
        res.json(experience);
    } catch (err) {
        console.error('获取工作经历错误:', err);
        res.status(500).json({ error: '获取工作经历失败' });
    }
});

// 添加工作经历
app.post('/api/admin/experience', authMiddleware, adminMiddleware, (req, res) => {
    try {
        const { company, position, start_date, end_date, description, technologies } = req.body;
        const maxOrder = db.prepare('SELECT COALESCE(MAX(display_order), -1) as max FROM experience').get().max;
        
        const result = db.prepare('INSERT INTO experience (company, position, start_date, end_date, description, technologies, display_order) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
            company, position || '', start_date || '', end_date || '', description || '', technologies || '', maxOrder + 1
        );
        
        const newExp = db.prepare('SELECT * FROM experience WHERE id = ?').get(result.lastInsertRowid);
        logEditHistory('experience', result.lastInsertRowid, 'INSERT', null, newExp, req.user.id);
        
        res.status(201).json(newExp);
    } catch (err) {
        console.error('添加工作经历错误:', err);
        res.status(500).json({ error: '添加失败' });
    }
});

// 更新工作经历
app.put('/api/admin/experience/:id', authMiddleware, adminMiddleware, (req, res) => {
    try {
        const { id } = req.params;
        const oldExp = db.prepare('SELECT * FROM experience WHERE id = ?').get(id);
        
        if (!oldExp) {
            return res.status(404).json({ error: '记录不存在' });
        }
        
        const { company, position, start_date, end_date, description, technologies } = req.body;
        db.prepare('UPDATE experience SET company = ?, position = ?, start_date = ?, end_date = ?, description = ?, technologies = ? WHERE id = ?').run(
            company, position, start_date, end_date, description, technologies, id
        );
        
        const newExp = db.prepare('SELECT * FROM experience WHERE id = ?').get(id);
        logEditHistory('experience', parseInt(id), 'UPDATE', oldExp, newExp, req.user.id);
        
        res.json(newExp);
    } catch (err) {
        console.error('更新工作经历错误:', err);
        res.status(500).json({ error: '更新失败' });
    }
});

// 删除工作经历
app.delete('/api/admin/experience/:id', authMiddleware, adminMiddleware, (req, res) => {
    try {
        const { id } = req.params;
        const oldExp = db.prepare('SELECT * FROM experience WHERE id = ?').get(id);
        
        if (!oldExp) {
            return res.status(404).json({ error: '记录不存在' });
        }
        
        db.prepare('DELETE FROM experience WHERE id = ?').run(id);
        logEditHistory('experience', parseInt(id), 'DELETE', oldExp, null, req.user.id);
        
        res.json({ message: '删除成功' });
    } catch (err) {
        console.error('删除工作经历错误:', err);
        res.status(500).json({ error: '删除失败' });
    }
});

// 工作经历排序
app.put('/api/admin/experience/reorder', authMiddleware, adminMiddleware, (req, res) => {
    try {
        const { orders } = req.body;
        orders.forEach(({ id, display_order }) => {
            db.prepare('UPDATE experience SET display_order = ? WHERE id = ?').run(display_order, id);
        });
        res.json({ message: '排序成功' });
    } catch (err) {
        console.error('工作经历排序错误:', err);
        res.status(500).json({ error: '排序失败' });
    }
});

// 获取项目列表
app.get('/api/projects', (req, res) => {
    try {
        const projects = db.prepare('SELECT * FROM projects ORDER BY display_order, id DESC').all();
        res.json(projects);
    } catch (err) {
        console.error('获取项目列表错误:', err);
        res.status(500).json({ error: '获取项目列表失败' });
    }
});

// 添加项目
app.post('/api/admin/projects', authMiddleware, adminMiddleware, (req, res) => {
    try {
        const { title, description, image, link, github, technologies } = req.body;
        const maxOrder = db.prepare('SELECT COALESCE(MAX(display_order), -1) as max FROM projects').get().max;
        
        const result = db.prepare('INSERT INTO projects (title, description, image, link, github, technologies, display_order) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
            title, description || '', image || '', link || '', github || '', technologies || '', maxOrder + 1
        );
        
        const newProject = db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);
        logEditHistory('projects', result.lastInsertRowid, 'INSERT', null, newProject, req.user.id);
        
        res.status(201).json(newProject);
    } catch (err) {
        console.error('添加项目错误:', err);
        res.status(500).json({ error: '添加失败' });
    }
});

// 更新项目
app.put('/api/admin/projects/:id', authMiddleware, adminMiddleware, (req, res) => {
    try {
        const { id } = req.params;
        const oldProject = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
        
        if (!oldProject) {
            return res.status(404).json({ error: '项目不存在' });
        }
        
        const { title, description, image, link, github, technologies } = req.body;
        db.prepare('UPDATE projects SET title = ?, description = ?, image = ?, link = ?, github = ?, technologies = ? WHERE id = ?').run(
            title, description, image, link, github, technologies, id
        );
        
        const newProject = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
        logEditHistory('projects', parseInt(id), 'UPDATE', oldProject, newProject, req.user.id);
        
        res.json(newProject);
    } catch (err) {
        console.error('更新项目错误:', err);
        res.status(500).json({ error: '更新失败' });
    }
});

// 删除项目
app.delete('/api/admin/projects/:id', authMiddleware, adminMiddleware, (req, res) => {
    try {
        const { id } = req.params;
        const oldProject = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
        
        if (!oldProject) {
            return res.status(404).json({ error: '项目不存在' });
        }
        
        db.prepare('DELETE FROM projects WHERE id = ?').run(id);
        logEditHistory('projects', parseInt(id), 'DELETE', oldProject, null, req.user.id);
        
        res.json({ message: '删除成功' });
    } catch (err) {
        console.error('删除项目错误:', err);
        res.status(500).json({ error: '删除失败' });
    }
});

// 项目排序
app.put('/api/admin/projects/reorder', authMiddleware, adminMiddleware, (req, res) => {
    try {
        const { orders } = req.body;
        orders.forEach(({ id, display_order }) => {
            db.prepare('UPDATE projects SET display_order = ? WHERE id = ?').run(display_order, id);
        });
        res.json({ message: '排序成功' });
    } catch (err) {
        console.error('项目排序错误:', err);
        res.status(500).json({ error: '排序失败' });
    }
});

// 获取编辑历史
app.get('/api/admin/history', authMiddleware, adminMiddleware, (req, res) => {
    try {
        const { table_name, limit = 50 } = req.query;
        let query = 'SELECT h.*, u.username as admin_name FROM edit_history h LEFT JOIN users u ON h.admin_id = u.id';
        const params = [];
        
        if (table_name) {
            query += ' WHERE h.table_name = ?';
            params.push(table_name);
        }
        
        query += ' ORDER BY h.created_at DESC LIMIT ?';
        params.push(parseInt(limit));
        
        const history = db.prepare(query).all(...params);
        res.json(history);
    } catch (err) {
        console.error('获取编辑历史错误:', err);
        res.status(500).json({ error: '获取编辑历史失败' });
    }
});

// 撤销操作
app.post('/api/admin/undo', authMiddleware, adminMiddleware, (req, res) => {
    try {
        const { history_id } = req.body;
        const history = db.prepare('SELECT * FROM edit_history WHERE id = ?').get(history_id);
        
        if (!history) {
            return res.status(404).json({ error: '历史记录不存在' });
        }
        
        if (history.action === 'DELETE' && history.old_data) {
            const oldData = JSON.parse(history.old_data);
            const columns = Object.keys(oldData).filter(k => k !== 'id' && k !== 'created_at');
            const placeholders = columns.map(() => '?').join(', ');
            const values = columns.map(k => oldData[k]);
            
            db.prepare(`INSERT INTO ${history.table_name} (${columns.join(', ')}) VALUES (${placeholders})`).run(...values);
        } else if (history.action === 'UPDATE' && history.old_data) {
            const oldData = JSON.parse(history.old_data);
            const columns = Object.keys(oldData).filter(k => k !== 'id' && k !== 'created_at');
            const setClause = columns.map(k => `${k} = ?`).join(', ');
            const values = columns.map(k => oldData[k]);
            values.push(history.record_id);
            
            db.prepare(`UPDATE ${history.table_name} SET ${setClause} WHERE id = ?`).run(...values);
        } else if (history.action === 'INSERT') {
            db.prepare(`DELETE FROM ${history.table_name} WHERE id = ?`).run(history.record_id);
        }
        
        db.prepare('DELETE FROM edit_history WHERE id = ?').run(history_id);
        
        res.json({ message: '撤销成功' });
    } catch (err) {
        console.error('撤销操作错误:', err);
        res.status(500).json({ error: '撤销失败' });
    }
});

// 图片上传（Base64）
app.post('/api/admin/upload', authMiddleware, adminMiddleware, (req, res) => {
    try {
        const { image, filename } = req.body;
        
        if (!image) {
            return res.status(400).json({ error: '请提供图片数据' });
        }
        
        const uploadsDir = path.join(__dirname, 'public', 'uploads');
        const fs = require('fs');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }
        
        const matches = image.match(/^data:image\/(\w+);base64,(.+)$/);
        if (!matches) {
            return res.status(400).json({ error: '无效的图片格式' });
        }
        
        const ext = matches[1];
        const base64Data = matches[2];
        const buffer = Buffer.from(base64Data, 'base64');
        
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(7);
        const newFilename = `${timestamp}-${randomStr}.${ext}`;
        const filepath = path.join(uploadsDir, newFilename);
        
        fs.writeFileSync(filepath, buffer);
        
        res.json({ 
            message: '上传成功', 
            url: `/uploads/${newFilename}` 
        });
    } catch (err) {
        console.error('图片上传错误:', err);
        res.status(500).json({ error: '上传失败' });
    }
});

// SPA 回退 - /admin 路由
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// 其他路由回退到首页（排除 API）
app.get(/^\/(?!api\/).*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 启动服务器
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 服务器运行在 http://localhost:${PORT}`);
    console.log(`📧 默认管理员账户: admin / admin123`);
    console.log(`🔐 管理员验证码: ${ADMIN_CODE}`);
});