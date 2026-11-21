# -*- coding: utf-8 -*-
"""通用 WSGI 入口：gunicorn / 各平台均通过本文件加载 app。

服务器版:  gunicorn wsgi:app
平台版(PaaS): 在控制台把 WSGI 入口设为 wsgi:app
"""
from app import app

# 部分平台要求变量名为 application，这里做兼容别名
application = app

if __name__ == "__main__":
    app.run()
