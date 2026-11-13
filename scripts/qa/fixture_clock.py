"""Chicago stamps for QA fixtures. The pin is 12:30 so a frozen clock still reads 12:30 PM.
Sheet-today rows are 18:00 on that pinned day. Dad rows stay ahead of the wall clock."""
from datetime import datetime, timedelta
import calendar
import os
import sys
import threading
from zoneinfo import ZoneInfo

CT = ZoneInfo("America/Chicago")


def wall_now():
    raw = os.environ.get("WARDOS_WALL")
    if not raw:
        return datetime.now(CT)
    dt = datetime.fromisoformat(raw)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=CT)
    return dt.astimezone(CT)


def plan(day_shift=0):
    # Month grid is pinned to the 1st at 12:30 so every label day is in that month
    # and not in a past week. Sheet-today uses that same pin, so its rows are 18:00
    # on the pinned day. dad-seat.js compares to Date.now(), so Dad rows are later
    # than the wall clock and not on the pinned day.
    wall = wall_now()
    anchor = (wall + timedelta(days=int(day_shift))).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    pin = anchor.replace(hour=12, minute=30)
    start = anchor.replace(hour=18)
    end = anchor.replace(hour=21)
    soon = wall + timedelta(hours=3)
    soon_end = soon + timedelta(hours=3)
    year, month = pin.year, pin.month
    last = calendar.monthrange(year, month)[1]

    def iso(dt):
        return dt.isoformat(timespec="seconds")

    return {
        "pin": iso(pin),
        "pin_ms": int(pin.timestamp() * 1000),
        "start": iso(start),
        "end": iso(end),
        "start_dt": start,
        "soon": iso(soon),
        "soon_end": iso(soon_end),
        "soon_dt": soon,
        "day": pin.date().isoformat(),
        "month_start": "%04d-%02d-01" % (year, month),
        "month_end": "%04d-%02d-%02d" % (year, month, last),
        "year": year,
        "month": month,
    }


def day_key(p, day):
    return "%04d-%02d-%02d" % (p["year"], p["month"], int(day))


def shift_day(p, days):
    return (p["start_dt"] + timedelta(days=int(days))).date().isoformat()


def at(p, minutes):
    """Dad row, ahead of the wall clock and off the pinned day."""
    dt = p["soon_dt"] + timedelta(minutes=int(minutes))
    if dt.date() == p["start_dt"].date():
        dt = (p["start_dt"] + timedelta(days=1)).replace(hour=18, minute=0, second=0) + timedelta(minutes=int(minutes))
    return dt.isoformat(timespec="seconds")


def pin_at(p, minutes):
    """Sheet-today row: on the pinned day, after 12:30."""
    return (p["start_dt"] + timedelta(minutes=int(minutes))).isoformat(timespec="seconds")


def log_step(msg):
    sys.stderr.write("qa " + str(msg) + "\n")
    sys.stderr.flush()


def bound_step(name, fn, seconds=8, tap=None):
    """Wall-clock cap for close/open. A hit exits non-zero and does not retry."""
    label = name if tap is None else "%s tap %s" % (name, tap)
    log_step(label)
    cancel = threading.Event()

    def killer():
        if not cancel.wait(seconds):
            sys.stderr.write("FAIL %s exceeded %ss\n" % (label, seconds))
            sys.stderr.flush()
            os._exit(1)

    threading.Thread(target=killer, daemon=True).start()
    try:
        return fn()
    finally:
        cancel.set()


def release_context(page, ctx, tap=None):
    """Drop routes and listeners, then close the page and context. Close waits on an
    in-flight navigation, so this step has its own 8s cap."""
    def _do():
        if page is not None:
            try:
                page.unroute_all(behavior="ignoreErrors")
            except Exception:
                pass
            page.close(run_before_unload=False)
        if ctx is not None:
            ctx.close()
    bound_step("close-context", _do, 8, tap)


def open_context(browser, tap=None, init=None, **kwargs):
    ctx = bound_step("new-context", lambda: browser.new_context(**kwargs), 8, tap)
    try:
        ctx.set_default_timeout(8000)
        ctx.set_default_navigation_timeout(15000)
        if init:
            ctx.add_init_script(init)
        page = bound_step("new-page", lambda: ctx.new_page(), 8, tap)
        return ctx, page
    except BaseException:
        release_context(None, ctx, tap)
        raise


def arm_navigation_cutoff(page):
    """The tap only needs the sheet-index request to start. Fulfill that document
    immediately and abort the rest so context.close is not left waiting on the load."""
    def handle(route):
        try:
            if route.request.resource_type == "document":
                route.fulfill(status=200, content_type="text/html", body="<html></html>")
            else:
                route.abort()
        except Exception:
            try:
                route.abort()
            except Exception:
                pass
    page.route("**/*", handle)


def stop_httpd(httpd):
    """shutdown() waits for the serve loop. A stuck handler must not hold the process."""
    t = __import__("threading").Thread(target=httpd.shutdown, daemon=True)
    t.start()
    t.join(2)
    try:
        httpd.server_close()
    except Exception:
        pass


def clock_init(pin_ms):
    """Runs before page scripts. The law reads LHClock and the board reads HouseScene.now."""
    return (
        "window.__qaPin=%d;"
        "window.LHClock={now:function(){return new Date(window.__qaPin);},ms:function(){return window.__qaPin;},"
        "at:function(v){return new Date(v);},realMs:function(){return Date.now();},override:'qa',frozen:true};"
        "window.HouseScene={now:function(){return new Date(window.__qaPin);}};"
    ) % int(pin_ms)
