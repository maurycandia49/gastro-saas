from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from django.utils import timezone

from .models import BusinessSchedule, ConfiguracionNegocio


def ensure_business_settings(business):
    settings, _ = ConfiguracionNegocio.objects.get_or_create(negocio=business)
    existing_weekdays = set(
        BusinessSchedule.objects
        .filter(negocio=business, weekday__in=range(7))
        .values_list('weekday', flat=True)
    )
    missing_schedules = [
        BusinessSchedule(
            negocio=business,
            weekday=weekday,
            is_closed=False,
            opening_time='00:00',
            closing_time='23:59',
        )
        for weekday in range(7)
        if weekday not in existing_weekdays
    ]
    if missing_schedules:
        BusinessSchedule.objects.bulk_create(missing_schedules, ignore_conflicts=True)
    return settings


def get_business_open_status(business, at_datetime=None):
    settings = ensure_business_settings(business)
    tz = ZoneInfo(settings.timezone)
    now = (at_datetime or timezone.now()).astimezone(tz)
    current_day = now.weekday()
    schedule = business.schedules.filter(weekday=current_day).first()
    is_open = False
    opens_at = None
    closes_at = None
    if schedule and not schedule.is_closed and schedule.opening_time and schedule.closing_time:
        opens_at = schedule.opening_time
        closes_at = schedule.closing_time
        is_open = schedule.opening_time <= now.time() <= schedule.closing_time

    next_opening = None
    for offset in range(0, 8):
        day = (current_day + offset) % 7
        candidate = business.schedules.filter(weekday=day, is_closed=False).first()
        if not candidate or not candidate.opening_time:
            continue
        candidate_date = now.date() + timedelta(days=offset)
        candidate_dt = datetime.combine(candidate_date, candidate.opening_time, tzinfo=tz)
        if candidate_dt > now:
            next_opening = candidate_dt
            break

    accepts_orders = settings.orders_enabled and (is_open or settings.accept_orders_when_closed)
    message = 'Abierto' if is_open else 'Cerrado'
    if not settings.orders_enabled:
        message = 'Pedidos deshabilitados'
    elif not is_open and next_opening:
        message = f'Proxima apertura {next_opening.strftime("%d/%m %H:%M")}'
    return {
        'is_open': is_open,
        'accepts_orders': accepts_orders,
        'current_day': current_day,
        'opens_at': opens_at,
        'closes_at': closes_at,
        'next_opening': next_opening,
        'message': message,
    }


def calculate_delivery_fee(settings, subtotal, fulfillment_type):
    if fulfillment_type == 'pickup':
        return 0
    if settings.free_delivery_from is not None and subtotal >= settings.free_delivery_from:
        return 0
    return settings.delivery_fee
