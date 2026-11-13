"""Chicago stamps for QA fixtures. The pin is 12:30 so a frozen clock still reads 12:30 PM.
Events start at 18:00 and end at 21:00 that same day, after the pin, on any calendar date."""
from datetime import datetime, timedelta
import calendar
from zoneinfo import ZoneInfo

CT = ZoneInfo("America/Chicago")


def plan(day_shift=0):
    # Month grid is pinned to the 1st at 12:30 so every label day is in that month
    # and not in a past week. Live rows are ahead of the wall clock: dad-seat.js
    # compares them to Date.now(), which the harness cannot replace.
    wall = datetime.now(CT)
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
    return (p["soon_dt"] + timedelta(minutes=int(minutes))).isoformat(timespec="seconds")


def clock_init(pin_ms):
    """Runs before page scripts. The law reads LHClock and the board reads HouseScene.now."""
    return (
        "window.__qaPin=%d;"
        "window.LHClock={now:function(){return new Date(window.__qaPin);},ms:function(){return window.__qaPin;},"
        "at:function(v){return new Date(v);},realMs:function(){return Date.now();},override:'qa',frozen:true};"
        "window.HouseScene={now:function(){return new Date(window.__qaPin);}};"
    ) % int(pin_ms)
