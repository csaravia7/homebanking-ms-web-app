#!/usr/bin/env python3
"""
HomeBanking Load Generator — Playwright / Chromium headless

Simula usuarios reales navegando la aplicación completa:
  login → dashboard → accounts → transactions → cards → logout → (repite)

Variables de entorno:
  FRONTEND_URL      URL del frontend  (default: http://web-frontend)
  CONCURRENT_USERS  Usuarios paralelos (default: 2)
  THINK_TIME_MIN    Pausa mínima entre acciones en segundos (default: 1.5)
  THINK_TIME_MAX    Pausa máxima entre acciones en segundos (default: 4.0)
  LOOP_FOREVER      true/false — ciclar indefinidamente (default: true)
  HEADLESS          true/false — sin ventana (default: true)
"""
import asyncio
import logging
import os
import random
import time
from dataclasses import dataclass, field
from typing import Optional

from playwright.async_api import (
    Browser,
    BrowserContext,
    Page,
    async_playwright,
    TimeoutError as PlaywrightTimeout,
)

# ── Configuración ─────────────────────────────────────────────────────────────
FRONTEND_URL     = os.getenv("FRONTEND_URL", "http://web-frontend").rstrip("/")
CONCURRENT_USERS = int(os.getenv("CONCURRENT_USERS", "2"))
THINK_MIN        = float(os.getenv("THINK_TIME_MIN", "1.5"))
THINK_MAX        = float(os.getenv("THINK_TIME_MAX", "4.0"))
LOOP_FOREVER     = os.getenv("LOOP_FOREVER", "true").lower() == "true"
HEADLESS         = os.getenv("HEADLESS", "true").lower() == "true"
ACTION_TIMEOUT   = int(os.getenv("ACTION_TIMEOUT_MS", "20000"))
NAV_TIMEOUT      = int(os.getenv("NAV_TIMEOUT_MS", "30000"))

DEMO_USERS = [
    {"email": "test@example.com",  "password": "password123", "name": "Test User"},
    {"email": "alice@example.com", "password": "password123", "name": "Alice"},
    {"email": "bob@example.com",   "password": "password123", "name": "Bob"},
]

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [loadgen] %(levelname)s %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
log = logging.getLogger("loadgen")


# ── Estadísticas ──────────────────────────────────────────────────────────────
@dataclass
class Stats:
    sessions_ok:  int = 0
    sessions_err: int = 0
    page_loads:   int = 0
    errors:       int = 0
    start_time:   float = field(default_factory=time.time)

    def report(self):
        elapsed = time.time() - self.start_time
        rate = self.page_loads / max(elapsed, 1)
        log.info(
            f"── Stats ── sesiones OK:{self.sessions_ok} ERR:{self.sessions_err} "
            f"pages:{self.page_loads} errors:{self.errors} "
            f"rate:{rate:.2f} pages/s elapsed:{elapsed:.0f}s"
        )


stats = Stats()


# ── Helpers ───────────────────────────────────────────────────────────────────
async def think():
    await asyncio.sleep(random.uniform(THINK_MIN, THINK_MAX))


async def nav(page: Page, path: str, label: str) -> bool:
    """Navega a una ruta y espera networkidle. Retorna True si tuvo éxito."""
    url = f"{FRONTEND_URL}{path}"
    try:
        await page.goto(url, wait_until="networkidle", timeout=NAV_TIMEOUT)
        stats.page_loads += 1
        log.debug(f"  ✓ {label} ({url})")
        return True
    except PlaywrightTimeout:
        stats.errors += 1
        log.warning(f"  ⚠ timeout en {label} ({url})")
        return False


async def click_if_visible(page: Page, selector: str, timeout: int = 3000) -> bool:
    try:
        loc = page.locator(selector).first
        await loc.wait_for(state="visible", timeout=timeout)
        await loc.click()
        return True
    except Exception:
        return False


# ── Escenarios ────────────────────────────────────────────────────────────────
async def scenario_login(page: Page, user: dict) -> bool:
    ok = await nav(page, "/login", "Login page")
    if not ok:
        return False

    try:
        # Soporta múltiples selectores según diseño del frontend
        for sel in ["input[type='email']", "input[name='email']", "#email"]:
            if await page.locator(sel).count() > 0:
                await page.fill(sel, user["email"])
                break

        for sel in ["input[type='password']", "input[name='password']", "#password"]:
            if await page.locator(sel).count() > 0:
                await page.fill(sel, user["password"])
                break

        await page.click("button[type='submit']")
        await page.wait_for_url(f"{FRONTEND_URL}/**", timeout=NAV_TIMEOUT)
        log.info(f"  ✓ Login exitoso — {user['name']}")
        return True
    except Exception as e:
        stats.errors += 1
        log.warning(f"  ⚠ Login falló: {e}")
        return False


async def scenario_dashboard(page: Page):
    await nav(page, "/", "Dashboard")
    await think()


async def scenario_accounts(page: Page):
    await nav(page, "/accounts", "Accounts list")
    await think()

    # Intentar abrir formulario de nueva cuenta
    opened = await click_if_visible(
        page,
        "button:has-text('Nueva'), button:has-text('New'), "
        "button:has-text('Cuenta'), a:has-text('Nueva Cuenta')"
    )
    if opened:
        log.debug("  → Formulario nueva cuenta abierto")
        await think()
        # Cerrar modal si hay un botón Cancel/Close
        await click_if_visible(
            page,
            "button:has-text('Cancel'), button:has-text('Cancelar'), "
            "button:has-text('Close'), button[aria-label='close']"
        )


async def scenario_transactions(page: Page):
    await nav(page, "/transactions", "Transactions list")
    await think()

    # Intentar abrir formulario de nueva transacción
    opened = await click_if_visible(
        page,
        "button:has-text('Nueva'), button:has-text('New'), "
        "button:has-text('Transferencia'), button:has-text('Transfer')"
    )
    if opened:
        log.debug("  → Formulario nueva transacción abierto")
        await think()
        await click_if_visible(
            page,
            "button:has-text('Cancel'), button:has-text('Cancelar'), "
            "button:has-text('Close'), button[aria-label='close']"
        )


async def scenario_cards(page: Page):
    await nav(page, "/cards", "Cards list")
    await think()

    # Ver detalle de una tarjeta si existe
    card = page.locator(".card, [class*='card'], [data-testid='card']").first
    if await card.count() > 0:
        try:
            await card.click(timeout=3000)
            await think()
        except Exception:
            pass


async def scenario_new_account_with_card(page: Page):
    """Flujo completo de onboarding: crear cuenta con tarjeta."""
    await nav(page, "/accounts/new", "New account form")
    await think()

    # Si no hay form en /accounts/new, intentar botón desde /accounts
    if "new" not in page.url:
        await nav(page, "/accounts", "Accounts (fallback)")
        await click_if_visible(page, "button:has-text('Nueva'), button:has-text('New')")
        await think()


async def scenario_notifications(page: Page):
    """Ver notificaciones si la ruta existe."""
    await nav(page, "/notifications", "Notifications")
    await think()


# ── Sesión completa de usuario ────────────────────────────────────────────────
async def run_session(browser: Browser, user_idx: int, session_id: str):
    user = DEMO_USERS[user_idx % len(DEMO_USERS)]
    log.info(f"[{session_id}] → Iniciando sesión como {user['email']}")

    ctx: BrowserContext = await browser.new_context(
        viewport={"width": 1280, "height": 800},
        # User-agent que emula Chrome en Linux (como ejecuta en el pod)
        user_agent=(
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
        ),
        locale="es-ES",
        timezone_id="America/Bogota",
        ignore_https_errors=True,
    )
    page: Page = await ctx.new_page()
    page.set_default_timeout(ACTION_TIMEOUT)

    # Suprimir errores de consola del navegador en los logs
    page.on("console", lambda msg: log.debug(f"  browser [{msg.type}]: {msg.text}"))

    try:
        # ── Login ─────────────────────────────────────────────────────────────
        logged_in = await scenario_login(page, user)
        if not logged_in:
            stats.sessions_err += 1
            return

        await think()

        # ── Escenarios en orden aleatorio para simular carga más realista ─────
        scenarios = [
            scenario_dashboard,
            scenario_accounts,
            scenario_transactions,
            scenario_cards,
            scenario_notifications,
        ]
        # Siempre dashboard primero, el resto aleatorio
        await scenario_dashboard(page)
        for fn in random.sample(scenarios[1:], len(scenarios) - 1):
            await fn(page)
            await think()

        # ── Logout ────────────────────────────────────────────────────────────
        await click_if_visible(
            page,
            "button:has-text('Logout'), button:has-text('Salir'), "
            "a:has-text('Logout'), [data-testid='logout']"
        )

        stats.sessions_ok += 1
        log.info(f"[{session_id}] ✓ Sesión completada")
        stats.report()

    except PlaywrightTimeout as e:
        stats.sessions_err += 1
        log.warning(f"[{session_id}] Timeout: {e}")
    except Exception as e:
        stats.sessions_err += 1
        log.error(f"[{session_id}] Error inesperado: {e}")
    finally:
        await ctx.close()


# ── Loop por usuario virtual ──────────────────────────────────────────────────
async def user_loop(browser: Browser, user_idx: int):
    sid = 0
    while True:
        sid += 1
        await run_session(browser, user_idx, f"u{user_idx:02d}-s{sid:04d}")
        if not LOOP_FOREVER:
            break
        # Pausa entre sesiones (simula usuario que vuelve más tarde)
        pause = random.uniform(5, 15)
        log.debug(f"[u{user_idx:02d}] Esperando {pause:.1f}s antes de la próxima sesión")
        await asyncio.sleep(pause)


# ── Esperar disponibilidad del frontend ───────────────────────────────────────
async def wait_for_frontend(browser: Browser, retries: int = 30, delay: int = 10):
    log.info(f"Esperando que el frontend esté disponible en {FRONTEND_URL} ...")
    for attempt in range(1, retries + 1):
        try:
            ctx = await browser.new_context(ignore_https_errors=True)
            page = await ctx.new_page()
            resp = await page.goto(FRONTEND_URL, wait_until="load", timeout=8000)
            await ctx.close()
            if resp and resp.status < 500:
                log.info(f"✓ Frontend disponible (HTTP {resp.status}) tras {attempt} intento(s)")
                return
        except Exception as e:
            log.info(f"  Intento {attempt}/{retries}: {e}")
        await asyncio.sleep(delay)
    log.warning("Frontend no disponible después de todos los intentos — continuando de todas formas")


# ── Entry point ───────────────────────────────────────────────────────────────
async def main():
    log.info("═" * 60)
    log.info("HomeBanking Load Generator")
    log.info(f"  Frontend URL:          {FRONTEND_URL}")
    log.info(f"  Usuarios concurrentes: {CONCURRENT_USERS}")
    log.info(f"  Think time:            {THINK_MIN}s – {THINK_MAX}s")
    log.info(f"  Loop forever:          {LOOP_FOREVER}")
    log.info(f"  Headless:              {HEADLESS}")
    log.info("═" * 60)

    async with async_playwright() as pw:
        browser: Browser = await pw.chromium.launch(
            headless=HEADLESS,
            args=[
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--disable-software-rasterizer",
                "--disable-background-timer-throttling",
                "--disable-backgrounding-occluded-windows",
                "--disable-renderer-backgrounding",
                "--single-process",              # reduce memoria en K8s
            ],
        )
        log.info("✓ Chromium iniciado")

        await wait_for_frontend(browser)

        tasks = [
            asyncio.create_task(user_loop(browser, i))
            for i in range(CONCURRENT_USERS)
        ]
        try:
            await asyncio.gather(*tasks)
        finally:
            await browser.close()
            log.info("Chromium cerrado. Stats finales:")
            stats.report()


if __name__ == "__main__":
    asyncio.run(main())
