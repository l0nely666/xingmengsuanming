"""批次 11 联调测试 · API 层：注册/登录/me/退出/缓存/历史上限/多用户隔离。

运行：cd backend && uv run python scripts/api_integration_test.py
"""

import json
import sqlite3
import time
from pathlib import Path

import urllib.error
import urllib.request

BASE = "http://localhost:8000"
DB_PATH = Path(__file__).resolve().parent.parent / "data" / "xingmeng.db"

results: list[tuple[bool, str, str]] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    results.append((ok, name, detail))
    print(f"{'✅' if ok else '❌'} {name}" + (f" — {detail}" if detail else ""))


def call(method: str, path: str, body: dict | None = None, token: str | None = None):
    """返回 (status, data, elapsed)。"""
    data = json.dumps(body, ensure_ascii=False).encode("utf-8") if body else None
    req = urllib.request.Request(BASE + path, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=240) as resp:
            raw = resp.read().decode("utf-8")
            return resp.status, json.loads(raw), time.time() - t0
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8")
        try:
            return e.code, json.loads(raw), time.time() - t0
        except Exception:
            return e.code, {"raw": raw}, time.time() - t0


def run() -> None:
    stamp = int(time.time())
    user_a = f"itA_{stamp}"
    user_b = f"itB_{stamp}"
    pwd = "secret123"

    horoscope = {
        "birth_date": "1995-08-15",
        "birth_time": "14:30",
        "birth_place": "江苏南京",
        "gender": "男",
        "relationship_status": "单身",
        "occupation": "软件工程师",
        "focus": "事业发展方向",
    }
    dream = {
        "dream_content": "梦见在很长的走廊里奔跑，最后到天台看到满天星星",
        "dream_time": "2026-10-13 02:30",
        "gender": "女",
        "age": "26-35岁",
        "occupation": "设计师",
        "recent_status": "工作压力较大",
        "focus": "是否应该换工作",
    }

    # ---------- 1. 注册 ----------
    st, d, _ = call("POST", "/api/auth/register", {"username": user_a, "password": pwd})
    check("注册用户 A", st == 200 and d.get("success"), f"HTTP {st} id={d.get('user', {}).get('id')}")
    token_a = d.get("token")

    st, d, _ = call("POST", "/api/auth/register", {"username": user_a, "password": pwd})
    check("同名再注册 → 409", st == 409, f"HTTP {st} error={d.get('error')}")

    st, d, _ = call("POST", "/api/auth/register", {"username": "x", "password": "123"})
    check("弱密码 → 422", st == 422, f"HTTP {st}")

    # ---------- 2. 登录 / me / token 校验 ----------
    st, d, _ = call("POST", "/api/auth/login", {"username": user_a, "password": "wrongpass"})
    check("错误密码 → 401", st == 401, f"HTTP {st}")

    st, d, _ = call("POST", "/api/auth/login", {"username": user_a, "password": pwd})
    check("登录成功", st == 200 and d.get("success"), f"HTTP {st}")
    token_a = d.get("token") or token_a

    st, d, _ = call("GET", "/api/auth/me", token=token_a)
    check("GET /me 带 token", st == 200 and d.get("user", {}).get("username") == user_a, f"HTTP {st}")

    st, d, _ = call("GET", "/api/auth/me", token="fake.token.value")
    check("GET /me 假 token → 401", st == 401, f"HTTP {st}")

    # ---------- 3. 路由保护（API 层） ----------
    st, d, _ = call("POST", "/api/horoscope/analyze", horoscope)
    check("analyze 不带 token → 401", st == 401, f"HTTP {st}")

    # ---------- 4. 星座分析：首次真实调用 ----------
    st, d, el = call("POST", "/api/horoscope/analyze", horoscope, token_a)
    check(
        "星座首次解析",
        st == 200 and d.get("success") and len(d.get("result") or "") > 50,
        f"HTTP {st} | {el:.1f}s | {len(d.get('result') or '')} 字 | cached={d.get('cached')}",
    )
    check("首次 cached=false", d.get("cached") is False, f"cached={d.get('cached')}")
    hid1 = d.get("history_id")
    check("首次返回 history_id", isinstance(hid1, int), f"history_id={hid1}")

    # SQLite 落库确认
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    rows = conn.execute("SELECT * FROM analyses WHERE id = ?", (hid1,)).fetchall()
    check("结果写入 SQLite analyses", len(rows) == 1, f"行数={len(rows)}")
    if rows:
        r = rows[0]
        check(
            "落库字段完整",
            bool(r["input_hash"]) and bool(r["result_text"]) and bool(r["created_at"]),
            f"hash前12={str(r['input_hash'])[:12]} result={len(r['result_text'])}字",
        )
    conn.close()

    # ---------- 5. 同参缓存 ----------
    st2, d2, el2 = call("POST", "/api/horoscope/analyze", horoscope, token_a)
    check("同参再提交 cached=true", d2.get("cached") is True, f"cached={d2.get('cached')}")
    check("同参 history_id 一致", d2.get("history_id") == hid1, f"{d2.get('history_id')} vs {hid1}")
    check("同参结果完全一致", d2.get("result") == d.get("result"), "")
    check(
        "同参秒回（未调大模型）",
        el2 < 2.0 and el2 < el / 5,
        f"{el2:.2f}s vs 首次 {el:.1f}s",
    )

    conn = sqlite3.connect(DB_PATH)
    cnt = conn.execute("SELECT COUNT(*) FROM analyses WHERE user_id = (SELECT id FROM users WHERE username=?) AND analysis_type='horoscope'", (user_a,)).fetchone()[0]
    conn.close()
    check("缓存命中未重复落库", cnt == 1, f"horoscope 行数={cnt}")

    # ---------- 6. 周公解梦：同流程 ----------
    st, d3, el3 = call("POST", "/api/dream/analyze", dream, token_a)
    check(
        "周公首次解析",
        st == 200 and d3.get("success") and len(d3.get("result") or "") > 50,
        f"HTTP {st} | {el3:.1f}s | {len(d3.get('result') or '')} 字 | cached={d3.get('cached')}",
    )
    check("周公首次 cached=false", d3.get("cached") is False, "")
    d_hid = d3.get("history_id")

    st, d4, el4 = call("POST", "/api/dream/analyze", dream, token_a)
    check("周公同参 cached=true", d4.get("cached") is True, f"cached={d4.get('cached')}")
    check("周公同参秒回", el4 < 2.0, f"{el4:.2f}s vs {el3:.1f}s")
    check("周公同参 history_id 一致", d4.get("history_id") == d_hid, "")

    # ---------- 7. 每账号每类型最多 5 条 ----------
    for i in range(2, 7):
        h = dict(horoscope)
        h["focus"] = f"事业发展方向-{i}"
        call("POST", "/api/horoscope/analyze", h, token_a)

    st, d5, _ = call("GET", "/api/history/horoscope", token=token_a)
    items = d5.get("items") or []
    check("星座历史列表恰好 5 条", len(items) == 5, f"实际 {len(items)} 条 ids={[i['id'] for i in items]}")
    ids = [i["id"] for i in items]
    check("最早记录已被删除", hid1 not in ids, f"首条 id={hid1} 已不在列表")
    check("列表按时间倒序", ids == sorted(ids, reverse=True), f"ids={ids}")

    # 周公 6 条不同内容
    for i in range(2, 7):
        dm = dict(dream)
        dm["focus"] = f"是否应该换工作-{i}"
        call("POST", "/api/dream/analyze", dm, token_a)
    st, d6, _ = call("GET", "/api/history/dream", token=token_a)
    d_items = d6.get("items") or []
    check("周公历史列表恰好 5 条", len(d_items) == 5, f"实际 {len(d_items)} 条")

    # ---------- 8. 历史详情 ----------
    some_id = items[0]["id"]
    st, d7, _ = call("GET", f"/api/history/horoscope/{some_id}", token=token_a)
    check(
        "历史详情可读",
        st == 200 and len((d7.get("item") or {}).get("result_text") or "") > 50,
        f"HTTP {st} result={len((d7.get('item') or {}).get('result_text') or '')}字",
    )

    # ---------- 9. 多用户隔离 ----------
    st, d8, _ = call("POST", "/api/auth/register", {"username": user_b, "password": pwd})
    token_b = d8.get("token")
    check("注册用户 B", st == 200 and d8.get("success"), f"id={d8.get('user', {}).get('id')}")

    st, d9, _ = call("GET", "/api/history/horoscope", token=token_b)
    check(
        "B 看不到 A 的历史",
        len(d9.get("items") or []) == 0,
        f"B 的 horoscope 历史={len(d9.get('items') or [])} 条",
    )
    st, d10, _ = call("GET", f"/api/history/horoscope/{some_id}", token=token_b)
    check("B 访问 A 的记录 → 404", st == 404, f"HTTP {st}")

    # B 自己分析，A 的历史不受影响
    h_b = dict(horoscope)
    h_b["focus"] = "B 的测试"
    call("POST", "/api/horoscope/analyze", h_b, token_b)
    st, d11, _ = call("GET", "/api/history/horoscope", token=token_a)
    check("A 的历史不被 B 影响（仍 5 条）", len(d11.get("items") or []) == 5, f"{len(d11.get('items') or [])} 条")

    # ---------- 10. 退出登录 ----------
    st, d12, _ = call("POST", "/api/auth/logout", token=token_a)
    check("退出登录成功", st == 200 and d12.get("success"), f"HTTP {st}")

    st, d13, _ = call("GET", "/api/auth/me", token=token_a)
    check("退出后 token 失效（/me → 401）", st == 401, f"HTTP {st}")

    st, d14, _ = call("POST", "/api/horoscope/analyze", horoscope, token=token_a)
    check("退出后 analyze → 401", st == 401, f"HTTP {st}")

    st, d15, _ = call("GET", "/api/history/horoscope", token=token_a)
    check("退出后 history → 401", st == 401, f"HTTP {st}")

    # ---------- 汇总 ----------
    passed = sum(1 for ok, _, _ in results if ok)
    print(f"\n===== API 联调结果：{passed}/{len(results)} 通过 =====")
    if passed != len(results):
        print("\n失败项：")
        for ok, name, detail in results:
            if not ok:
                print(f"  ❌ {name} — {detail}")
        raise SystemExit(1)


if __name__ == "__main__":
    run()
