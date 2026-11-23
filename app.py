# -*- coding: utf-8 -*-
"""建站工坊 · Flask 后端（基于 Flask-SQLAlchemy + Flask-Login）"""
import json
import os
import hashlib
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


class EmailCode(db.Model):
    """邮箱验证码：注册验证与找回密码共用，只存哈希不存明文。"""
    __tablename__ = "email_code"
    id = db.Column(db.String(64), primary_key=True, default=lambda: new_id("ec_"))
    email = db.Column(db.String(120), nullable=False, index=True)
    code_hash = db.Column(db.String(80), nullable=False)
    purpose = db.Column(db.String(16), nullable=False)      # register / reset
    expires_at = db.Column(db.Integer, nullable=False)      # 毫秒时间戳
    used = db.Column(db.Boolean, default=False, nullable=False)
    attempts = db.Column(db.Integer, default=0, nullable=False)
    ip = db.Column(db.String(64), default="")
    created_at = db.Column(db.Integer, default=now_ms, index=True)


class UserProfile(db.Model):
    """个人资料：与 user 一对一。独立成表，老库不用改列（create_all 会自动建表）。"""
    __tablename__ = "user_profile"
    user_id = db.Column(db.String(64), primary_key=True)
    bio = db.Column(db.String(200), nullable=False, default="")
    avatar = db.Column(db.String(16), nullable=False, default="")   # emoji 头像，空则用首字母
    color = db.Column(db.String(16), nullable=False, default="#2563eb")
    updated_at = db.Column(db.BigInteger, default=now_ms)


class Message(db.Model):
    """留言板：所有人可读，登录可发，仅站长可删（软删除，误删可在数据库后台恢复）。"""
    __tablename__ = "message"
    id = db.Column(db.String(64), primary_key=True, default=lambda: new_id("msg_"))
    user_id = db.Column(db.String(64), nullable=False, index=True)
    user_name = db.Column(db.String(24), nullable=False)
    avatar = db.Column(db.String(16), nullable=False, default="")
    color = db.Column(db.String(16), nullable=False, default="#2563eb")
    content = db.Column(db.String(500), nullable=False)
    created_at = db.Column(db.BigInteger, default=now_ms, index=True)
    deleted = db.Column(db.Boolean, default=False, nullable=False)
    deleted_by = db.Column(db.String(64), nullable=False, default="")
    deleted_at = db.Column(db.BigInteger, default=0)



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


def profile_of(user_id):
    """取资料，没有就建一条空的（首次登录/注册后自动拥有）。"""
    p = db.session.get(UserProfile, user_id)
    if not p:
        p = UserProfile(user_id=user_id, bio="", avatar="", color="#2563eb")
        db.session.add(p)
        try:
            db.session.commit()
        except Exception:
            db.session.rollback()
            p = db.session.get(UserProfile, user_id) or p
    return p


def user_dict(u):
    p = db.session.get(UserProfile, u.id)
    return {"id": u.id, "name": u.name, "email": u.email,
            "avatar": (p.avatar if p else "") or "",
            "color": (p.color if p else "") or "#2563eb",
            "bio": (p.bio if p else "") or "",
            "createdAt": u.created_at}


def message_dict(m):
    return {"id": m.id, "userId": m.user_id, "name": m.user_name,
            "avatar": m.avatar or "", "color": m.color or "#2563eb",
            "content": m.content, "createdAt": m.created_at}


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


@app.route("/profile")
@app.route("/profile.html")
def profile_page():
    return render_template("profile.html")


@app.route("/board")
@app.route("/board.html")
def board_page():
    return render_template("board.html")


@app.route("/api/health")
def health():
    return ok(backend="flask", version=2)


# ---------------------------------------------------------------- 邮箱验证码
CODE_TTL_MS = 10 * 60 * 1000        # 验证码有效期 10 分钟
CODE_RESEND_MS = 60 * 1000          # 同一邮箱重发间隔 60 秒
CODE_MAX_ATTEMPTS = 5               # 单个验证码最多试错 5 次
IP_WINDOW_MS = 10 * 60 * 1000       # IP 限流窗口 10 分钟
IP_MAX_SENDS = 10                   # 窗口内同 IP 最多发 10 封


# 常见邮箱服务商的发信服务器。有了这张表，只填「邮箱 + 授权码」就能发信，
# 不用去查 smtp.xxx.com 和端口。键是域名后缀，匹配时从最具体到最宽泛（vip.qq.com → qq.com）。
SMTP_PRESETS = {
    "qq.com": ("smtp.qq.com", 465, "ssl"),
    "vip.qq.com": ("smtp.qq.com", 465, "ssl"),
    "foxmail.com": ("smtp.qq.com", 465, "ssl"),
    "exmail.qq.com": ("smtp.exmail.qq.com", 465, "ssl"),
    "163.com": ("smtp.163.com", 465, "ssl"),
    "126.com": ("smtp.126.com", 465, "ssl"),
    "yeah.net": ("smtp.yeah.net", 465, "ssl"),
    "qiye.163.com": ("smtp.qiye.163.com", 465, "ssl"),
    "sina.com": ("smtp.sina.com", 465, "ssl"),
    "sina.cn": ("smtp.sina.cn", 465, "ssl"),
    "sohu.com": ("smtp.sohu.com", 465, "ssl"),
    "139.com": ("smtp.139.com", 465, "ssl"),
    "189.cn": ("smtp.189.cn", 465, "ssl"),
    "aliyun.com": ("smtp.aliyun.com", 465, "ssl"),
    "gmail.com": ("smtp.gmail.com", 465, "ssl"),
    "googlemail.com": ("smtp.gmail.com", 465, "ssl"),
    "outlook.com": ("smtp-mail.outlook.com", 587, "starttls"),
    "hotmail.com": ("smtp-mail.outlook.com", 587, "starttls"),
    "live.com": ("smtp-mail.outlook.com", 587, "starttls"),
    "msn.com": ("smtp-mail.outlook.com", 587, "starttls"),
    "office365.com": ("smtp.office365.com", 587, "starttls"),
    "yahoo.com": ("smtp.mail.yahoo.com", 465, "ssl"),
    "icloud.com": ("smtp.mail.me.com", 587, "starttls"),
    "me.com": ("smtp.mail.me.com", 587, "starttls"),
    "mac.com": ("smtp.mail.me.com", 587, "starttls"),
    "zoho.com": ("smtp.zoho.com", 465, "ssl"),
    "zoho.com.cn": ("smtp.zoho.com.cn", 465, "ssl"),
    "yandex.com": ("smtp.yandex.com", 465, "ssl"),
    "yandex.ru": ("smtp.yandex.ru", 465, "ssl"),
    "gmx.com": ("smtp.gmx.com", 587, "starttls"),
    "gmx.net": ("smtp.gmx.net", 587, "starttls"),
    "feishu.cn": ("smtp.feishu.cn", 465, "ssl"),
}

_SMTP_OK = {}   # host -> (端口, 加密方式)：探测成功过的组合，进程内复用，省掉重复试错


def smtp_preset_for(addr):
    """按邮箱域名找发信服务器。返回 (host, port, tls, 是否靠猜)；域名都取不到时返回 None。"""
    domain = (addr or "").rsplit("@", 1)[-1].strip().strip(".").lower()
    if not domain or "." not in domain:
        return None
    parts = domain.split(".")
    for i in range(len(parts) - 1):
        key = ".".join(parts[i:])
        if key in SMTP_PRESETS:
            return SMTP_PRESETS[key] + (False,)
    # 认不出来的多半是企业邮箱，习惯用 smtp.域名；端口不确定，交给 send_mail 逐个试
    return ("smtp." + domain, 465, "ssl", True)


def mail_conf():
    """读取 SMTP 配置。HOST 留空时按 SMTP_USER 的邮箱域名自动识别，
    所以换任何一家邮箱都不用改代码；连账号都没填才进入开发模式。"""
    host = clean(os.environ.get("SITE_BUILDER_SMTP_HOST"), 120)
    raw_port = clean(os.environ.get("SITE_BUILDER_SMTP_PORT"), 8)
    raw_tls = (clean(os.environ.get("SITE_BUILDER_SMTP_TLS"), 12) or "").lower()
    user = clean(os.environ.get("SITE_BUILDER_SMTP_USER"), 160)

    auto = raw_port.lower() == "auto"
    source = "env" if host else ""
    if not host and user:
        preset = smtp_preset_for(user)
        if preset:
            host, p_port, p_tls, guessed = preset
            auto = auto or guessed
            raw_port = raw_port or str(p_port)
            raw_tls = raw_tls or p_tls
            source = "guess" if guessed else "preset"

    if raw_port.lower() == "auto":
        auto = True
    try:
        port = int(raw_port or 465)
    except ValueError:
        port, auto = 465, True

    return {
        "host": host,
        "port": port,
        "auto": auto,
        "source": source,
        "user": user,
        "password": os.environ.get("SITE_BUILDER_SMTP_PASS") or "",
        "sender": clean(os.environ.get("SITE_BUILDER_SMTP_FROM"), 160) or user,
        "tls": raw_tls or "ssl",
        "dev": os.environ.get("SITE_BUILDER_MAIL_DEV") == "1" or not host,
        "strict": os.environ.get("SITE_BUILDER_MAIL_STRICT") == "1",
    }


def _allow_dev_echo():
    """验证码要不要直接回显在页面上。
    只对本机（和显式 SITE_BUILDER_MAIL_DEV=1）开放：线上域名如果没有配置 SMTP 还回显验证码，
    「忘记密码」就等于一个能重置任意账号（含站长）密码的后门。"""
    if os.environ.get("SITE_BUILDER_MAIL_DEV") == "1":
        return True
    host = (request.host or "").split(":")[0].strip("[]").lower()
    return host in ("127.0.0.1", "localhost", "::1", "0.0.0.0")


def smtp_candidates(conf):
    """要依次尝试的 (端口, 加密方式)。
    显式配了端口就只试一个；自动识别时按「上次成功的 → 预设 → 465/ssl → 587/starttls → 25/none」。"""
    if not conf["auto"]:
        return [(conf["port"], conf["tls"])]
    seq = []
    hit = _SMTP_OK.get(conf["host"])
    if hit:
        seq.append(hit)
    seq.append((conf["port"], conf["tls"]))
    seq += [(465, "ssl"), (587, "starttls"), (25, "none")]
    out = []
    for item in seq:
        if item not in out:
            out.append(item)
    return out


def send_mail(to_addr, subject, text):
    """发送纯文本邮件，返回 (成功?, 错误信息)。
    自动识别模式下会依次试几种常见端口；认证被拒则立刻停（换端口也没用）。"""
    conf = mail_conf()
    if not conf["host"]:
        return False, "未配置 SMTP"
    import smtplib
    from email.header import Header
    from email.mime.text import MIMEText
    from email.utils import formataddr

    msg = MIMEText(text, "plain", "utf-8")
    msg["Subject"] = Header(subject, "utf-8")
    msg["From"] = formataddr((str(Header("建站工坊", "utf-8")), conf["sender"]))
    msg["To"] = to_addr

    last = "未知错误"
    for port, tls in smtp_candidates(conf):
        srv = None
        try:
            if tls == "ssl":
                srv = smtplib.SMTP_SSL(conf["host"], port, timeout=8)
            else:
                srv = smtplib.SMTP(conf["host"], port, timeout=8)
            srv.ehlo()
            if tls == "starttls":
                srv.starttls()
                srv.ehlo()
            if conf["user"]:
                srv.login(conf["user"], conf["password"])
            srv.sendmail(conf["sender"], [to_addr], msg.as_string())
            _SMTP_OK[conf["host"]] = (port, tls)
            return True, ""
        except smtplib.SMTPAuthenticationError as exc:
            return False, ("登录被拒绝：请确认填的是授权码/应用专用密码，且该邮箱已开启 SMTP 服务。%s"
                           % str(exc)[:120])
        except Exception as exc:
            last = "%s:%d/%s → %s" % (conf["host"], port, tls, str(exc)[:120])
        finally:
            try:
                if srv is not None:
                    srv.quit()
            except Exception:
                pass
    return False, last


def code_digest(email, purpose, code):
    raw = "%s|%s|%s|%s" % (app.config.get("SECRET_KEY", ""), email, purpose, code)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def client_ip():
    fwd = request.headers.get("X-Forwarded-For", "")
    if fwd:
        return clean(fwd.split(",")[0], 64)
    return clean(request.remote_addr or "", 64)


def purge_old_codes():
    """顺手清掉一天前的记录，避免表无限增长。"""
    cutoff = now_ms() - 24 * 3600 * 1000
    EmailCode.query.filter(EmailCode.created_at < cutoff).delete(synchronize_session=False)
    db.session.commit()


def issue_code(email, purpose, ip=""):
    """生成 6 位数字验证码并入库，返回明文（仅用于发信或开发模式回显）。"""
    code = "%06d" % secrets.randbelow(1000000)
    rec = EmailCode(email=email, purpose=purpose, ip=ip,
                    code_hash=code_digest(email, purpose, code),
                    expires_at=now_ms() + CODE_TTL_MS)
    db.session.add(rec)
    db.session.commit()
    return code


def consume_code(email, purpose, raw_code):
    """校验验证码，返回 (是否通过, 错误提示)。只有通过时才标记已用。"""
    code = clean(raw_code, 12)
    if not code:
        return False, "请填写邮箱验证码"

    latest = (EmailCode.query
              .filter_by(email=email, purpose=purpose, used=False)
              .order_by(EmailCode.created_at.desc())
              .first())
    if not latest:
        return False, "请先获取邮箱验证码"
    if latest.expires_at < now_ms():
        return False, "验证码已过期，请重新获取"
    if latest.attempts >= CODE_MAX_ATTEMPTS:
        return False, "验证码错误次数过多，请重新获取"

    digest = code_digest(email, purpose, code)
    candidates = (EmailCode.query
                  .filter(EmailCode.email == email, EmailCode.purpose == purpose,
                          EmailCode.used == False,                       # noqa: E712
                          EmailCode.expires_at > now_ms())
                  .order_by(EmailCode.created_at.desc())
                  .limit(5).all())
    hit = None
    for rec in candidates:
        if rec.code_hash == digest:
            hit = rec
            break

    if hit is None:
        latest.attempts = (latest.attempts or 0) + 1
        db.session.commit()
        left = CODE_MAX_ATTEMPTS - latest.attempts
        if left > 0:
            return False, "验证码不正确，还可再试 %d 次" % left
        return False, "验证码错误次数过多，请重新获取"

    hit.used = True
    db.session.commit()
    return True, ""


@app.route("/api/auth/send-code", methods=["POST"])
def auth_send_code():
    d = body()
    email = clean(d.get("email"), 120).lower()
    purpose = clean(d.get("purpose"), 16) or "register"
    if purpose not in ("register", "reset", "email"):
        return fail("参数不正确")
    if not EMAIL_RE.match(email):
        return fail("邮箱格式不正确")

    exists = User.query.filter_by(email=email).first()
    if purpose == "register" and exists:
        return fail("该邮箱已注册，请直接登录", 409)
    if purpose == "reset" and not exists:
        return fail("该邮箱未注册", 404)
    if purpose == "email":
        # 换绑邮箱：验证码发到「新邮箱」，因此新邮箱必须可用且没被其他账号占用
        if not current_user.is_authenticated:
            return fail("请先登录", 401)
        if exists and exists.id != current_user.id:
            return fail("该邮箱已被其他账号使用", 409)

    last = (EmailCode.query.filter_by(email=email, purpose=purpose)
            .order_by(EmailCode.created_at.desc()).first())
    if last and now_ms() - (last.created_at or 0) < CODE_RESEND_MS:
        wait = int((CODE_RESEND_MS - (now_ms() - last.created_at)) / 1000) + 1
        return fail("请 %d 秒后再获取验证码" % wait, 429)

    ip = client_ip()
    if ip:
        recent = (EmailCode.query
                  .filter(EmailCode.ip == ip,
                          EmailCode.created_at > now_ms() - IP_WINDOW_MS)
                  .count())
        if recent >= IP_MAX_SENDS:
            return fail("请求过于频繁，请稍后再试", 429)

    conf = mail_conf()
    if not conf["host"] and not _allow_dev_echo():
        return fail("服务器未配置邮件服务（SITE_BUILDER_SMTP_HOST），暂时无法发送验证码", 503)

    purge_old_codes()
    code = issue_code(email, purpose, ip)

    label = {"register": "注册验证", "reset": "重置密码", "email": "更换邮箱"}.get(purpose, "邮箱验证")
    text = ("你正在为《建站工坊》进行%s，验证码：%s\n\n"
            "该验证码 10 分钟内有效，请勿泄露给他人。\n"
            "如果这不是你本人的操作，请忽略这封邮件。" % (label, code))
    # 开发模式（没配 SMTP，或显式 MAIL_DEV=1）：只在本机回显，不真发信
    if conf["dev"] and _allow_dev_echo():
        return ok(dev=True, devCode=code, cooldown=60, ttl=600,
                  msg="未配置邮件服务，验证码已直接显示（仅本机开发可用）")

    sent, err = send_mail(email, "【建站工坊】%s验证码 %s" % (label, code), text)

    if sent:
        return ok(dev=False, cooldown=60, ttl=600,
                  msg="验证码已发送，请查收邮件（也看看垃圾箱）")
    return fail("验证码发送失败：%s" % err, 502)


@app.route("/api/auth/reset-password", methods=["POST"])
def auth_reset_password():
    d = body()
    email = clean(d.get("email"), 120).lower()
    code = clean(d.get("code"), 12)
    password = str(d.get("password") or "")
    if not EMAIL_RE.match(email):
        return fail("邮箱格式不正确")
    if len(password) < 6:
        return fail("新密码至少 6 位")
    user = User.query.filter_by(email=email).first()
    if not user:
        return fail("邮箱未注册", 404)
    passed, err = consume_code(email, "reset", code)
    if not passed:
        return fail(err)
    user.pass_hash = generate_password_hash(password)
    db.session.commit()
    return ok(msg="密码已重置，请用新密码登录")


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

    # 注册必须通过邮箱验证码，防止乱填他人邮箱
    passed, err = consume_code(email, "register", d.get("code"))
    if not passed:
        return fail(err)

    user = User(name=name, email=email, pass_hash=generate_password_hash(password))
    db.session.add(user)
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return fail("该邮箱已注册，请直接登录", 409)
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
    user = user_dict(current_user) if current_user.is_authenticated else None
    if user:
        user["isAdmin"] = is_site_admin(current_user)
    return ok(user=user)


# ---------------------------------------------------------------- 个人资料
@app.route("/api/profile")
@login_required
def get_profile():
    p = profile_of(current_user.id)
    return ok(
        user=user_dict(current_user),
        profile={"bio": p.bio, "avatar": p.avatar, "color": p.color},
        stats={
            "projects": Project.query.filter_by(owner_id=current_user.id).count(),
            "templates": Template.query.filter_by(owner_id=current_user.id).count(),
            "messages": Message.query.filter_by(user_id=current_user.id, deleted=False).count(),
        },
        joinedAt=current_user.created_at,
        isAdmin=is_site_admin(current_user),
    )


@app.route("/api/profile", methods=["POST"])
@login_required
def update_profile():
    d = body()
    name = clean(d.get("name"), 24)
    if not name:
        return fail("昵称不能为空")
    if len(name) < 2:
        return fail("昵称至少 2 个字")
    bio = clean(d.get("bio"), 200)
    avatar = clean(d.get("avatar"), 8)
    color = clean(d.get("color"), 16)
    if color and not re.match(r"^#[0-9a-fA-F]{6}$", color):
        return fail("头像颜色格式不正确")
    p = profile_of(current_user.id)
    current_user.name = name
    p.bio = bio
    p.avatar = avatar
    p.color = color or p.color
    p.updated_at = now_ms()
    db.session.commit()
    return ok(user=user_dict(current_user), msg="资料已保存")


@app.route("/api/profile/password", methods=["POST"])
@login_required
def change_password():
    d = body()
    old = str(d.get("oldPassword") or "")
    new = str(d.get("newPassword") or "")
    if not check_password_hash(current_user.pass_hash, old):
        return fail("当前密码不正确", 401)
    if len(new) < 6:
        return fail("新密码至少 6 位")
    if new == old:
        return fail("新密码不能与当前密码相同")
    current_user.pass_hash = generate_password_hash(new)
    db.session.commit()
    return ok(msg="密码已更新，下次请用新密码登录")


@app.route("/api/profile/email", methods=["POST"])
@login_required
def change_email():
    d = body()
    email = clean(d.get("email"), 120).lower()
    if not EMAIL_RE.match(email):
        return fail("邮箱格式不正确")
    if email == (current_user.email or "").lower():
        return fail("新邮箱与当前邮箱相同")
    if User.query.filter_by(email=email).first():
        return fail("该邮箱已被使用", 409)
    passed, err = consume_code(email, "email", d.get("code"))
    if not passed:
        return fail(err)
    current_user.email = email
    db.session.commit()
    _ADMIN_STATE["email"] = ""  # 站长身份缓存失效，下次重新判定
    return ok(user=user_dict(current_user), msg="邮箱已更新")


# ---------------------------------------------------------------- 留言板
@app.route("/api/messages")
def list_messages():
    try:
        page = max(1, int(request.args.get("page", "1")))
    except (TypeError, ValueError):
        page = 1
    per = 20
    q = Message.query.filter_by(deleted=False)
    total = q.count()
    items = q.order_by(Message.created_at.desc()).offset((page - 1) * per).limit(per).all()
    return ok(items=[message_dict(m) for m in items], total=total, page=page,
              pages=max(1, (total + per - 1) // per), per=per,
              isAdmin=is_site_admin())


@app.route("/api/messages", methods=["POST"])
@login_required
def create_message():
    content = clean(body().get("content"), 500)
    if len(content) < 2:
        return fail("留言至少 2 个字")
    last = (Message.query.filter_by(user_id=current_user.id)
            .order_by(Message.created_at.desc()).first())
    if last and now_ms() - (last.created_at or 0) < 15000:
        return fail("留言太频繁，休息一下再发", 429)
    p = profile_of(current_user.id)
    m = Message(user_id=current_user.id, user_name=current_user.name,
                avatar=p.avatar or "", color=p.color or "#2563eb", content=content)
    db.session.add(m)
    db.session.commit()
    return ok(item=message_dict(m), msg="留言已发布")


@app.route("/api/messages/<mid>", methods=["DELETE"])
@login_required
def delete_message(mid):
    if not is_site_admin(current_user):
        return fail("只有站长可以删除留言", 403)
    m = db.session.get(Message, mid)
    if not m or m.deleted:
        return fail("留言不存在", 404)
    m.deleted = True
    m.deleted_by = current_user.email or ""
    m.deleted_at = now_ms()
    db.session.commit()
    return ok(msg="留言已删除")


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


# ---------------------------------------------------------------- 数据库管理（图形化）
# 站长专用后台：概览 / 表浏览 / 行编辑 / SQL 控制台 / 结构 / 导出 / 备份。
# 站长判定：SITE_BUILDER_ADMIN_EMAILS 优先（逗号分隔），否则最早注册的账号即站长。
# 兼容 SQLite（本地 / 自有服务器）与 PostgreSQL（Vercel + Supabase）。
import csv
import io

from flask import Response, send_file, session
from sqlalchemy import MetaData, Table as _SaTable, and_ as _sa_and
from sqlalchemy import inspect as _sa_inspect, text as _sa_text
from sqlalchemy.schema import CreateTable as _SaCreateTable

app.config["SESSION_COOKIE_SAMESITE"] = app.config.get("SESSION_COOKIE_SAMESITE") or "Lax"

_ADMIN_STATE = {"email": "", "checked": 0.0}
_ADMIN_TABLES = {}


def _admin_emails():
    raw = (os.environ.get("SITE_BUILDER_ADMIN_EMAILS") or "").replace(";", ",")
    return [x.strip().lower() for x in raw.split(",") if x.strip()]


def site_admin_email(force=False):
    """站长邮箱：显式配置优先，否则取最早注册的账号（开箱即用，无需配置）。"""
    fixed = _admin_emails()
    if fixed:
        return fixed[0]
    now = time.time()
    if not force and _ADMIN_STATE["email"] and now - _ADMIN_STATE["checked"] < 20:
        return _ADMIN_STATE["email"]
    email = ""
    try:
        first = db.session.query(User).order_by(User.created_at.asc()).first()
        if first:
            email = (first.email or "").lower()
    except Exception:
        email = ""
    _ADMIN_STATE["email"] = email
    _ADMIN_STATE["checked"] = now
    return email


def is_site_admin(user=None):
    user = user or current_user
    if not getattr(user, "is_authenticated", False):
        return False
    email = (getattr(user, "email", "") or "").lower()
    fixed = _admin_emails()
    if fixed:
        return email in fixed
    return bool(email) and email == site_admin_email()


def _admin_guard():
    if not current_user.is_authenticated:
        return fail("请先登录站长账号", 401)
    if not is_site_admin(current_user):
        return fail("只有站长账号可以管理数据库", 403)
    return None


def _db_token():
    tok = session.get("db_admin_token")
    if not tok:
        tok = secrets.token_urlsafe(24)
        session["db_admin_token"] = tok
    return tok


def _token_guard():
    if request.headers.get("X-DB-Token") != session.get("db_admin_token"):
        return fail("页面已过期，请刷新后重试", 419)
    return None


def _q(name):
    return db.engine.dialect.identifier_preparer.quote(str(name))


def _model_tables():
    if not _ADMIN_TABLES:
        for model in (User, Project, Template, Module):
            _ADMIN_TABLES[model.__tablename__] = model
    return _ADMIN_TABLES


def _table_names():
    insp = _sa_inspect(db.engine)
    try:
        names = list(insp.get_table_names())
    except Exception:
        names = []
    try:
        for view in insp.get_view_names():
            if view not in names:
                names.append(view)
    except Exception:
        pass
    return sorted([n for n in names if not n.startswith("sqlite_")], key=lambda s: s.lower())


def _core_table(name):
    model = _model_tables().get(name)
    if model is not None:
        return model.__table__
    return _SaTable(name, MetaData(), autoload_with=db.engine)


def _table_info(name):
    if name not in _table_names():
        raise KeyError(name)
    insp = _sa_inspect(db.engine)
    cols = []
    for col in insp.get_columns(name):
        cols.append({
            "name": col.get("name"),
            "type": str(col.get("type")),
            "nullable": bool(col.get("nullable", True)),
            "default": None if col.get("default") is None else str(col.get("default")),
            "pk": False,
        })
    try:
        pk = list(insp.get_pk_constraint(name).get("constrained_columns") or [])
    except Exception:
        pk = []
    for col in cols:
        col["pk"] = col["name"] in pk
    return {"name": name, "columns": cols, "pk": pk, "readonly": not pk}


def _cell(value, limit=600):
    if value is None:
        return None
    if isinstance(value, bool) or isinstance(value, (int, float)):
        return value
    if isinstance(value, (bytes, bytearray, memoryview)):
        try:
            value = bytes(value).decode("utf-8")
        except Exception:
            raw = bytes(value)
            return {"__cut": True, "text": raw.hex()[:limit], "len": len(raw)}
    if isinstance(value, (dict, list)):
        value = json.dumps(value, ensure_ascii=False)
    if not isinstance(value, str):
        value = str(value)
    if len(value) > limit:
        return {"__cut": True, "text": value[:limit], "len": len(value)}
    return value


def _short_db_error(err):
    msg = str(getattr(err, "orig", None) or err)
    return re.sub(r"\s+", " ", msg).strip()[:300]


def _sql_literal(value):
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        if db.engine.dialect.name == "sqlite":
            return "1" if value else "0"
        return "TRUE" if value else "FALSE"
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, (bytes, bytearray, memoryview)):
        return "X'%s'" % bytes(value).hex()
    return "'" + str(value).replace("'", "''") + "'"


@app.route("/admin/db")
@app.route("/admin/db/")
@app.route("/dbadmin.html")
def db_admin_page():
    resp = app.make_response(render_template("dbadmin.html"))
    resp.headers["Cache-Control"] = "no-store"
    return resp


@app.route("/api/admin/db/overview")
def db_admin_overview():
    guard = _admin_guard()
    if guard:
        return guard
    engine = db.engine
    insp = _sa_inspect(engine)
    tables, total = [], 0
    for name in _table_names():
        try:
            with engine.connect() as conn:
                rows = int(conn.execute(_sa_text("SELECT COUNT(*) FROM " + _q(name))).scalar() or 0)
        except Exception:
            rows = -1
        try:
            columns = len(insp.get_columns(name))
        except Exception:
            columns = 0
        tables.append({"name": name, "rows": rows, "columns": columns})
        if rows > 0:
            total += rows
    size = None
    if engine.dialect.name == "sqlite":
        try:
            path = engine.url.database
            if path and os.path.exists(path):
                size = os.path.getsize(path)
        except Exception:
            size = None
    version = ""
    try:
        with engine.connect() as conn:
            if engine.dialect.name == "sqlite":
                version = "SQLite " + str(conn.execute(_sa_text("select sqlite_version()")).scalar())
            else:
                version = str(conn.execute(_sa_text("select version()")).scalar() or "").split(",")[0]
    except Exception:
        version = engine.dialect.name
    return ok(engine=engine.dialect.name,
              engineLabel="SQLite" if engine.dialect.name == "sqlite" else "PostgreSQL",
              version=version, size=size, tables=tables, totalRows=total,
              admin=current_user.email, token=_db_token(),
              adminSource="环境变量" if _admin_emails() else "最早注册的账号")


@app.route("/api/admin/db/table/<name>")
def db_admin_rows(name):
    guard = _admin_guard()
    if guard:
        return guard
    try:
        info = _table_info(name)
    except KeyError:
        return fail("数据表不存在", 404)
    cols = [c["name"] for c in info["columns"]]
    if not cols:
        return fail("该表没有可读取的列", 400)
    try:
        page = max(1, int(request.args.get("page", "1")))
        size = min(200, max(5, int(request.args.get("size", "50"))))
    except (TypeError, ValueError):
        page, size = 1, 50
    qtext = (request.args.get("q") or "").strip()[:200]
    sort = request.args.get("sort") or ""
    if sort not in cols:
        sort = info["pk"][0] if info["pk"] else cols[0]
    direction = "DESC" if (request.args.get("dir") or "").lower() == "desc" else "ASC"

    where, params = "", {}
    if qtext:
        parts = []
        for i, col in enumerate(cols):
            key = "q%d" % i
            params[key] = "%" + qtext + "%"
            parts.append("CAST(%s AS TEXT) LIKE :%s" % (_q(col), key))
        where = " WHERE (" + " OR ".join(parts) + ")"
    base = " FROM " + _q(name) + where
    try:
        with db.engine.connect() as conn:
            total = int(conn.execute(_sa_text("SELECT COUNT(*)" + base), params).scalar() or 0)
            sql = ("SELECT *" + base + " ORDER BY " + _q(sort) + " " + direction +
                   " LIMIT :_limit OFFSET :_offset")
            res = conn.execute(_sa_text(sql), dict(params, _limit=size, _offset=(page - 1) * size))
            keys = list(res.keys())
            rows = [dict(zip(keys, [_cell(v) for v in row])) for row in res.fetchall()]
    except Exception as err:
        return fail("读取失败：" + _short_db_error(err), 500)
    return ok(table=name, columns=info["columns"], pk=info["pk"], readonly=info["readonly"],
              rows=rows, total=total, page=page, size=size, sort=sort, dir=direction.lower(),
              searched=bool(qtext))


@app.route("/api/admin/db/table/<name>/structure")
def db_admin_structure(name):
    guard = _admin_guard()
    if guard:
        return guard
    try:
        info = _table_info(name)
    except KeyError:
        return fail("数据表不存在", 404)
    indexes = []
    try:
        for idx in _sa_inspect(db.engine).get_indexes(name):
            indexes.append({"name": idx.get("name"), "columns": idx.get("column_names") or [],
                            "unique": bool(idx.get("unique"))})
    except Exception:
        pass
    uniques = []
    try:
        for uc in _sa_inspect(db.engine).get_unique_constraints(name):
            uniques.append({"name": uc.get("name") or "", "columns": uc.get("column_names") or []})
    except Exception:
        pass
    ddl = ""
    try:
        ddl = str(_SaCreateTable(_core_table(name)).compile(db.engine)).strip() + ";"
    except Exception:
        ddl = ""
    return ok(info=info, indexes=indexes, uniques=uniques, ddl=ddl)


@app.route("/api/admin/db/table/<name>/row")
def db_admin_row_get(name):
    guard = _admin_guard()
    if guard:
        return guard
    try:
        info = _table_info(name)
    except KeyError:
        return fail("数据表不存在", 404)
    if not info["pk"]:
        return fail("该表没有主键，无法定位单条记录", 400)
    try:
        key = json.loads(request.args.get("key") or "{}")
    except Exception:
        return fail("记录标识无效", 400)
    if not isinstance(key, dict):
        return fail("记录标识无效", 400)
    clause, params = "", {}
    for i, col in enumerate(info["pk"]):
        if col not in key:
            return fail("缺少主键 " + col, 400)
        params["k%d" % i] = key[col]
        clause += (" AND " if clause else "") + _q(col) + " = :k%d" % i
    try:
        with db.engine.connect() as conn:
            res = conn.execute(_sa_text("SELECT * FROM " + _q(name) + " WHERE " + clause), params)
            keys = list(res.keys())
            row = res.fetchone()
    except Exception as err:
        return fail("读取失败：" + _short_db_error(err), 500)
    if not row:
        return fail("记录不存在", 404)
    return ok(row={k: _cell(v, 10 * 1000 * 1000) for k, v in zip(keys, row)}, info=info)


@app.route("/api/admin/db/table/<name>/row", methods=["POST"])
def db_admin_row_save(name):
    guard = _admin_guard() or _token_guard()
    if guard:
        return guard
    data = body()
    action = data.get("action")
    values = data.get("values") if isinstance(data.get("values"), dict) else {}
    key = data.get("key") if isinstance(data.get("key"), dict) else {}
    try:
        info = _table_info(name)
        table = _core_table(name)
    except KeyError:
        return fail("数据表不存在", 404)
    cols = [c["name"] for c in info["columns"]]
    clean = {k: v for k, v in values.items() if k in cols}

    if action == "insert":
        # 空值不写入，交给列默认值（id / created_at 等由模型自动生成）
        clean = {k: v for k, v in clean.items() if v != ""}
        if name == "user":
            # 用户表的密码只接受明文入口，服务端负责哈希，避免管理员手填哈希出错
            password = str(data.get("password") or "")
            if len(password) < 6:
                return fail("请填写至少 6 位的初始密码")
            clean.pop("pass_hash", None)
            clean["pass_hash"] = generate_password_hash(password)
        if not clean:
            return fail("请至少填写一个字段")
        try:
            with db.engine.begin() as conn:
                conn.execute(table.insert().values(**clean))
        except Exception as err:
            return fail("新增失败：" + _short_db_error(err), 400)
        return ok()

    if action not in ("update", "delete"):
        return fail("未知操作", 400)
    if not info["pk"]:
        return fail("该表没有主键，无法定位记录", 400)
    cond = []
    for col in info["pk"]:
        if col not in key:
            return fail("缺少主键 " + col, 400)
        cond.append(table.c[col] == key[col])

    if action == "update":
        clean.pop("pass_hash", None)
        if not clean:
            return fail("没有需要更新的字段")
        try:
            with db.engine.begin() as conn:
                res = conn.execute(table.update().where(_sa_and(*cond)).values(**clean))
                count = res.rowcount
        except Exception as err:
            return fail("保存失败：" + _short_db_error(err), 400)
        return ok(count=count)

    try:
        with db.engine.begin() as conn:
            res = conn.execute(table.delete().where(_sa_and(*cond)))
            count = res.rowcount
    except Exception as err:
        return fail("删除失败：" + _short_db_error(err), 400)
    return ok(count=count)


@app.route("/api/admin/db/user/<uid>/password", methods=["POST"])
def db_admin_reset_password(uid):
    guard = _admin_guard() or _token_guard()
    if guard:
        return guard
    password = str(body().get("password") or "")
    if len(password) < 6:
        return fail("新密码至少 6 位")
    user = db.session.get(User, uid)
    if not user:
        return fail("用户不存在", 404)
    user.pass_hash = generate_password_hash(password)
    db.session.commit()
    return ok()


@app.route("/api/admin/db/query", methods=["POST"])
def db_admin_query():
    guard = _admin_guard() or _token_guard()
    if guard:
        return guard
    data = body()
    sql = str(data.get("sql") or "").strip()
    if not sql:
        return fail("请输入 SQL")
    if len(sql) > 20000:
        return fail("SQL 过长")
    stripped = sql.rstrip().rstrip(";")
    if ";" in stripped:
        return fail("一次只能执行一条 SQL 语句")
    upper = re.sub(r"\s+", " ", stripped).upper()
    danger = ""
    if re.match(r"^(DROP|TRUNCATE|ALTER)\b", upper):
        danger = "结构变更（DROP / TRUNCATE / ALTER）"
    elif re.match(r"^DELETE\b", upper) and " WHERE " not in upper:
        danger = "删除整表数据（DELETE 没有 WHERE）"
    elif re.match(r"^UPDATE\b", upper) and " WHERE " not in upper:
        danger = "更新整表数据（UPDATE 没有 WHERE）"
    if danger and not data.get("confirm"):
        return ok(needConfirm=danger)
    try:
        with db.engine.begin() as conn:
            res = conn.execute(_sa_text(stripped))
            if res.returns_rows:
                keys = list(res.keys())
                rows = [[_cell(v) for v in row] for row in res.fetchmany(501)]
                cut = len(rows) > 500
                return ok(kind="rows", columns=keys, rows=rows[:500], truncated=cut)
            return ok(kind="exec", rowcount=res.rowcount)
    except Exception as err:
        return fail("执行失败：" + _short_db_error(err), 400)


@app.route("/api/admin/db/maintenance", methods=["POST"])
def db_admin_maintenance():
    guard = _admin_guard() or _token_guard()
    if guard:
        return guard
    action = str(body().get("action") or "")
    engine = db.engine
    if action == "vacuum":
        if engine.dialect.name != "sqlite":
            return fail("VACUUM 仅 SQLite 支持")
        with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
            conn.execute(_sa_text("VACUUM"))
        return ok(msg="已整理数据库文件，体积通常会变小")
    if action == "analyze":
        with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
            conn.execute(_sa_text("ANALYZE"))
        return ok(msg="统计信息已更新，查询会更快")
    if action == "integrity":
        if engine.dialect.name != "sqlite":
            return fail("完整性检查仅 SQLite 支持")
        with engine.connect() as conn:
            rows = conn.execute(_sa_text("PRAGMA integrity_check")).fetchall()
        text = "; ".join(str(r[0]) for r in rows)
        return ok(msg=("数据库完好" if text.strip() == "ok" else "检查结果：" + text))
    return fail("未知操作", 400)


@app.route("/api/admin/db/export")
def db_admin_export():
    guard = _admin_guard()
    if guard:
        return guard
    fmt = (request.args.get("format") or "csv").lower()
    name = request.args.get("table") or ""
    tables = _table_names()
    if fmt in ("csv", "sql") and name:
        if name not in tables:
            return fail("数据表不存在", 404)
        tables = [name]

    if fmt == "csv":
        if not name:
            return fail("请指定要导出的表")
        buf = io.StringIO()
        writer = csv.writer(buf)
        try:
            with db.engine.connect() as conn:
                res = conn.execute(_sa_text("SELECT * FROM " + _q(name)))
                keys = list(res.keys())
                writer.writerow(keys)
                for i, row in enumerate(res):
                    if i >= 20000:
                        break
                    writer.writerow(["" if v is None else
                                     (json.dumps(v, ensure_ascii=False) if isinstance(v, (dict, list)) else v)
                                     for v in row])
        except Exception as err:
            return fail("导出失败：" + _short_db_error(err), 500)
        return Response("\ufeff" + buf.getvalue(), mimetype="text/csv; charset=utf-8",
                        headers={"Content-Disposition": "attachment; filename=%s.csv" % name})

    if fmt == "json":
        payload = {"exportedAt": time.strftime("%Y-%m-%d %H:%M:%S"), "tables": {}}
        for table in tables:
            try:
                with db.engine.connect() as conn:
                    res = conn.execute(_sa_text("SELECT * FROM " + _q(table) + " LIMIT 5000"))
                    keys = list(res.keys())
                    payload["tables"][table] = [dict(zip(keys, [_cell(v, 10 ** 9) for v in row]))
                                                for row in res.fetchall()]
            except Exception as err:
                payload["tables"][table] = {"error": _short_db_error(err)}
        return Response(json.dumps(payload, ensure_ascii=False, indent=2, default=str),
                        mimetype="application/json",
                        headers={"Content-Disposition": "attachment; filename=site_builder_export.json"})

    if fmt == "sql":
        lines = ["-- 建站工坊数据库导出", "-- 时间：" + time.strftime("%Y-%m-%d %H:%M:%S"),
                 "-- 引擎：" + db.engine.dialect.name, ""]
        for table in tables:
            try:
                lines.append(str(_SaCreateTable(_core_table(table)).compile(db.engine)).strip() + ";")
            except Exception:
                lines.append("-- 无法生成 " + table + " 的建表语句")
            try:
                with db.engine.connect() as conn:
                    res = conn.execute(_sa_text("SELECT * FROM " + _q(table) + " LIMIT 5000"))
                    cols = list(res.keys())
                    for row in res.fetchall():
                        lines.append("INSERT INTO %s (%s) VALUES (%s);" % (
                            _q(table), ", ".join(_q(c) for c in cols),
                            ", ".join(_sql_literal(v) for v in row)))
            except Exception as err:
                lines.append("-- 导出 " + table + " 失败：" + _short_db_error(err))
            lines.append("")
        return Response("\n".join(lines), mimetype="application/sql; charset=utf-8",
                        headers={"Content-Disposition": "attachment; filename=site_builder_dump.sql"})

    return fail("不支持的导出格式", 400)


@app.route("/api/admin/db/backup")
def db_admin_backup():
    guard = _admin_guard()
    if guard:
        return guard
    engine = db.engine
    if engine.dialect.name != "sqlite":
        return fail("当前使用 PostgreSQL，请改用「导出 SQL」或「导出 JSON」备份", 400)
    path = engine.url.database
    if not path or not os.path.exists(path):
        return fail("找不到数据库文件", 404)
    return send_file(path, as_attachment=True,
                     download_name="site_builder_%s.db" % time.strftime("%Y%m%d_%H%M%S"))

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

    # --- Windows 中文计算机名兼容补丁 ---
    # Python 3.8 在 Windows 下执行 socket.getfqdn(host) 时，会用 UTF-8 去解码
    # 以 GBK 表示的本机名，抛 UnicodeDecodeError（invalid start byte），
    # app.run() 在绑定端口阶段就直接崩溃，浏览器表现为"无法访问"。
    # 这里做一层容错包装：解析失败时退回主机名本身，不影响正常监听。
    try:
        import socket as _socket_mod
        if not getattr(_socket_mod.getfqdn, "_sb_safe", False):
            _orig_getfqdn = _socket_mod.getfqdn

            def _sb_safe_getfqdn(name=""):
                try:
                    return _orig_getfqdn(name)
                except Exception:
                    return name or "localhost"

            _sb_safe_getfqdn._sb_safe = True
            _socket_mod.getfqdn = _sb_safe_getfqdn
    except Exception:
        pass

    # 监听 0.0.0.0 而非 127.0.0.1：云平台（如 KataBump）的反向代理需要从外部转发流量进来，
    # 只监听本机将导致域名访问 502。本地双击访问 127.0.0.1:5000 仍然正常。
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "5000")))
