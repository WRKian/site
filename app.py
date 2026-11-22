# -*- coding: utf-8 -*-
"""建站工坊 · Flask 后端（基于 Flask-SQLAlchemy + Flask-Login）"""
import json
import os
import re
import secrets
import time

from flask import Flask, abort, jsonify, render_template, request, send_from_directory
from flask_login import (
    LoginManager, UserMixin, current_user, login_required,
    login_user, logout_user,
)
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text as sa_text
from werkzeug.security import check_password_hash, generate_password_hash

# 云平台可通过环境变量注入配置，这里主动加载 .env（本地双击运行时没有也无妨）。
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# 模板目录指向项目根目录，保留直接双击 index.html（file://）打开的降级模式
app = Flask(__name__, template_folder=BASE_DIR)

_SECRET = os.environ.get("SITE_BUILDER_SECRET")
if not _SECRET and os.environ.get("WERKZEUG_RUN_MAIN") != "true" and \
        os.environ.get("FLASK_ENV") == "production":
    # 生产部署（gunicorn/WSGI）务必设置强随机密钥，本地双击运行不受影响
    import warnings
    warnings.warn(
        "SITE_BUILDER_SECRET 未设置，正在使用开发密钥。"
        "生产环境请设置随机密钥：python -c \"import secrets;print(secrets.token_hex(32))\"",
        stacklevel=2,
    )
app.config["SECRET_KEY"] = _SECRET or "site-builder-dev-key"
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

# ---------------------------------------------------------------- 数据库配置
# 云平台（Koyeb/Render 等）的本地磁盘是临时的（重启/休眠后清空），所以线上必须用外部数据库。
# 这里优先读取 DATABASE_URL（Supabase 免费 PostgreSQL 提供），
# 没有配置时自动降级为本地 SQLite（方便你在自己电脑上双击运行、调试）。
_db_url = os.environ.get("DATABASE_URL") or os.environ.get("SITE_BUILDER_DATABASE_URL")
if _db_url:
    # 去掉从网页复制时混入的首尾空格/换行，否则库名会变成 "postgres\n" 导致连不上
    _db_url = _db_url.strip()
    # SQLAlchemy 2.x 不认 postgres:// 这个老前缀（Heroku/部分平台会给出），统一改成 postgresql://
    if _db_url.startswith("postgres://"):
        _db_url = "postgresql://" + _db_url[len("postgres://"):]
    # Vercel/Render 等平台：SQLAlchemy 2.x 对 postgresql:// 默认加载 psycopg(v3)，
    # 但本项目依赖装的是 psycopg2-binary（模块名 psycopg2），
    # 因此显式指定 +psycopg2，避免 ModuleNotFoundError: No module named 'psycopg'。
    # 已经是 postgresql+psycopg2:// 的不会被重复处理。
    if _db_url.startswith("postgresql://"):
        _db_url = "postgresql+psycopg2://" + _db_url[len("postgresql://"):]
    app.config["SQLALCHEMY_DATABASE_URI"] = _db_url
    # Supabase 会在连接空闲一段时间后主动断开，开启预检 + 回收避免"连接已失效"报错
    app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
        "pool_pre_ping": True,
        "pool_recycle": 240,
    }
else:
    _db_path = os.environ.get("SITE_BUILDER_DB") or os.path.join(BASE_DIR, "site_builder.db")
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///" + _db_path.replace("\\", "/")

db = SQLAlchemy(app)
login_manager = LoginManager(app)

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
ALLOWED_EXT = {".html", ".css", ".js", ".json", ".map", ".svg",
               ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico",
               ".woff", ".woff2", ".ttf"}
DENY_FILES = {"app.py", "requirements.txt", "site_builder.db", ".flask_secret"}


# ---------------------------------------------------------------- 模型
def now_ms():
    return int(time.time() * 1000)


def new_id(prefix):
    return prefix + secrets.token_hex(9)


class User(db.Model, UserMixin):
    id = db.Column(db.String(64), primary_key=True, default=lambda: new_id("u_"))
    name = db.Column(db.String(24), nullable=False)
    email = db.Column(db.String(120), nullable=False, unique=True)
    pass_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.BigInteger, default=now_ms)


class Project(db.Model):
    id = db.Column(db.String(64), primary_key=True, default=lambda: new_id("p_"))
    owner_id = db.Column(db.String(64), db.ForeignKey("user.id"), nullable=False, index=True)
    name = db.Column(db.String(80), nullable=False)
    data = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.BigInteger, default=now_ms)
    updated_at = db.Column(db.BigInteger, default=now_ms)


class Template(db.Model):
    id = db.Column(db.String(64), primary_key=True, default=lambda: new_id("t_"))
    owner_id = db.Column(db.String(64), db.ForeignKey("user.id"), nullable=False, index=True)
    name = db.Column(db.String(40), nullable=False)
    descr = db.Column(db.String(120), nullable=False, default="")
    category = db.Column(db.String(40), nullable=False, default="我的模板")
    tags = db.Column(db.Text, nullable=False, default='["自定义"]')
    color = db.Column(db.String(20), nullable=False, default="#64748b")
    emoji = db.Column(db.String(16), nullable=False, default="⭐")
    data = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.BigInteger, default=now_ms)


class Module(db.Model):
    id = db.Column(db.String(64), primary_key=True, default=lambda: new_id("m_"))
    owner_id = db.Column(db.String(64), db.ForeignKey("user.id"), nullable=False, index=True)
    name = db.Column(db.String(40), nullable=False)
    ico = db.Column(db.String(16), nullable=False, default="◧")
    data = db.Column(db.Text, nullable=False)
    updated_at = db.Column(db.BigInteger, default=now_ms)


with app.app_context():
    db.create_all()

    # 迁移：旧版把毫秒时间戳定义成 Integer，PostgreSQL 的 int4 上限 2147483647，
    # 装不下毫秒时间戳（约 1.7e12）会报 NumericValueOutOfRange。
    # 已建好的表 create_all() 不会改列类型，这里主动把 5 列升级为 BIGINT（幂等，可重复执行）。
    # 仅对 PostgreSQL 生效；SQLite 的 INTEGER 本身就是 8 字节，无需处理。
    if str(db.engine.url).startswith("postgresql"):
        _migrations = [
            ("user", "created_at"),
            ("project", "created_at"), ("project", "updated_at"),
            ("template", "created_at"),
            ("module", "updated_at"),
        ]
        for _table, _column in _migrations:
            try:
                db.session.execute(sa_text(
                    'ALTER TABLE "%s" ALTER COLUMN "%s" TYPE BIGINT' % (_table, _column)
                ))
                db.session.commit()
            except Exception:
                db.session.rollback()  # 列已是 BIGINT 或表不存在时忽略，不影响启动


@login_manager.user_loader
def load_user(uid):
    return db.session.get(User, uid)


@login_manager.unauthorized_handler
def unauthorized():
    return jsonify(ok=False, msg="请先登录"), 401


# ---------------------------------------------------------------- 工具
def ok(**kwargs):
    return jsonify(dict(ok=True, **kwargs))


def fail(msg, code=400):
    return jsonify(ok=False, msg=msg), code


def body():
    d = request.get_json(silent=True)
    return d if isinstance(d, dict) else {}


def clean(value, limit):
    return str(value if value is not None else "").strip()[:limit]


def user_dict(u):
    return {"id": u.id, "name": u.name, "email": u.email}


def project_dict(p):
    return {"id": p.id, "ownerId": p.owner_id, "name": p.name,
            "data": json.loads(p.data), "createdAt": p.created_at,
            "updatedAt": p.updated_at}


def template_dict(t):
    return {"id": t.id, "ownerId": t.owner_id, "name": t.name,
            "desc": t.descr, "category": t.category,
            "tags": json.loads(t.tags), "color": t.color,
            "emoji": t.emoji, "data": json.loads(t.data),
            "createdAt": t.created_at}


# ---------------------------------------------------------------- 页面
@app.route("/")
def index():
    return render_template("index.html")


@app.route("/hello")
def hello():
    return "Hello, Flask!"


@app.route("/editor")
@app.route("/editor.html")
def editor():
    return render_template("editor.html")


@app.route("/api/health")
def health():
    return ok(backend="flask", version=2)


# ---------------------------------------------------------------- 账号
@app.route("/api/register", methods=["POST"])
def register():
    d = body()
    name, email = clean(d.get("name"), 24), clean(d.get("email"), 120).lower()
    password = str(d.get("password") or "")
    if not name:
        return fail("请填写昵称")
    if not EMAIL_RE.match(email):
        return fail("邮箱格式不正确")
    if len(password) < 6:
        return fail("密码至少 6 位")
    if User.query.filter_by(email=email).first():
        return fail("该邮箱已注册，请直接登录", 409)

    user = User(name=name, email=email, pass_hash=generate_password_hash(password))
    db.session.add(user)
    db.session.commit()
    login_user(user)
    return ok(user=user_dict(user))


@app.route("/api/login", methods=["POST"])
def login():
    d = body()
    email = clean(d.get("email"), 120).lower()
    user = User.query.filter_by(email=email).first()
    if not user:
        return fail("邮箱未注册", 404)
    if not check_password_hash(user.pass_hash, str(d.get("password") or "")):
        return fail("密码不正确", 401)
    login_user(user)
    return ok(user=user_dict(user))


@app.route("/api/logout", methods=["POST"])
def logout():
    logout_user()
    return ok()


@app.route("/api/me")
def me():
    return ok(user=user_dict(current_user) if current_user.is_authenticated else None)


# ---------------------------------------------------------------- 项目
@app.route("/api/projects")
@login_required
def list_projects():
    items = Project.query.filter_by(owner_id=current_user.id).order_by(Project.updated_at.desc())
    return ok(items=[project_dict(p) for p in items])


@app.route("/api/projects", methods=["POST"])
@login_required
def save_project():
    d = body()
    data = d.get("data")
    if not isinstance(data, dict):
        return fail("项目数据无效")
    name = clean(d.get("name") or data.get("name"), 80) or "未命名页面"

    project = Project.query.filter_by(owner_id=current_user.id, name=name).first()
    if project is None:
        project = Project(owner_id=current_user.id, name=name)
        db.session.add(project)
    project.data = json.dumps(data, ensure_ascii=False)
    project.updated_at = now_ms()
    db.session.commit()
    return ok(id=project.id, name=name)


@app.route("/api/projects/<pid>", methods=["DELETE"])
@login_required
def delete_project(pid):
    n = Project.query.filter_by(id=pid, owner_id=current_user.id).delete()
    db.session.commit()
    return ok() if n else fail("项目不存在", 404)


# ---------------------------------------------------------------- 模板
@app.route("/api/templates")
@login_required
def list_templates():
    items = Template.query.filter_by(owner_id=current_user.id).order_by(Template.created_at.desc())
    return ok(items=[template_dict(t) for t in items])


@app.route("/api/templates", methods=["POST"])
@login_required
def save_template():
    d = body()
    data = d.get("data")
    if not isinstance(data, dict):
        return fail("模板数据无效")
    t = Template(
        owner_id=current_user.id,
        name=clean(d.get("name"), 40) or "我的模板",
        descr=clean(d.get("desc"), 120) or "由我的页面保存的模板",
        data=json.dumps(data, ensure_ascii=False),
    )
    db.session.add(t)
    db.session.commit()
    return ok(id=t.id)


@app.route("/api/templates/<tid>", methods=["DELETE"])
@login_required
def delete_template(tid):
    n = Template.query.filter_by(id=tid, owner_id=current_user.id).delete()
    db.session.commit()
    return ok() if n else fail("模板不存在", 404)


# ---------------------------------------------------------------- 模块
@app.route("/api/modules")
@login_required
def list_modules():
    rows = Module.query.filter_by(owner_id=current_user.id).order_by(Module.updated_at.desc())
    return ok(items=[{
        "id": m.id, "name": m.name, "ico": m.ico,
        "blocks": json.loads(m.data), "updatedAt": m.updated_at,
    } for m in rows])


@app.route("/api/modules", methods=["POST"])
@login_required
def save_modules():
    items = body().get("items")
    if not isinstance(items, list) or len(items) > 200:
        return fail("模块数据无效")
    saved = 0
    for item in items:
        if not isinstance(item, dict) or not isinstance(item.get("blocks"), list):
            continue
        name = clean(item.get("name"), 40) or "未命名模块"
        mod = Module.query.filter_by(owner_id=current_user.id, name=name).first()
        if mod is None:
            mod = Module(owner_id=current_user.id, name=name)
            db.session.add(mod)
        mod.ico = clean(item.get("ico"), 16) or "◧"
        mod.data = json.dumps(item["blocks"], ensure_ascii=False)
        mod.updated_at = now_ms()
        saved += 1
    db.session.commit()
    return ok(count=saved)


@app.route("/api/modules/<mid>", methods=["DELETE"])
@login_required
def delete_module(mid):
    n = Module.query.filter_by(id=mid, owner_id=current_user.id).delete()
    db.session.commit()
    return ok() if n else fail("模块不存在", 404)


# ---------------------------------------------------------------- 静态资源
@app.route("/<path:filename>")
def static_file(filename):
    parts = filename.replace("\\", "/").split("/")
    if any(not p or p.startswith(".") for p in parts):
        abort(404)
    if parts[-1] in DENY_FILES or os.path.splitext(parts[-1])[1].lower() not in ALLOWED_EXT:
        abort(404)
    return send_from_directory(BASE_DIR, filename)


@app.errorhandler(413)
def too_large(error):
    return fail("数据量过大，请精简页面后重试", 413)


if __name__ == "__main__":
    # 监听 0.0.0.0 而非 127.0.0.1：云平台（如 KataBump）的反向代理需要从外部转发流量进来，
    # 只监听本机将导致域名访问 502。本地双击访问 127.0.0.1:5000 仍然正常。
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "5000")))
